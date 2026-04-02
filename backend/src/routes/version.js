import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Current application version
const CURRENT_VERSION = '1.4.1';

// Get system version info
router.get('/', async (req, res, next) => {
  try {
    let version = await prisma.systemVersion.findFirst({
      where: { status: 'applied' },
      orderBy: { appliedAt: 'desc' },
    });

    // If no version exists, create the initial one
    if (!version) {
      version = await prisma.systemVersion.create({
        data: {
          version: CURRENT_VERSION,
          patchNotes: 'Initial system deployment with PostgreSQL backend',
          isBreaking: false,
          requiresRestart: false,
          status: 'applied',
        },
      });
    }

    const history = await prisma.versionHistory.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      currentVersion: version.version,
      appliedAt: version.appliedAt,
      patchNotes: version.patchNotes,
      isBreaking: version.isBreaking,
      requiresRestart: version.requiresRestart,
      recentHistory: history,
    });
  } catch (error) {
    next(error);
  }
});

// Get full version history
router.get('/history', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const history = await prisma.systemVersion.findMany({
      orderBy: { appliedAt: 'desc' },
      include: {
        _count: {
          select: { history: true },
        },
      },
    });

    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Apply a new patch/version
router.post('/apply', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const schema = z.object({
      version: z.string(),
      patchNotes: z.string().optional(),
      isBreaking: z.boolean().default(false),
      requiresRestart: z.boolean().default(false),
    });

    const data = schema.parse(req.body);
    const userId = req.user.id;

    // Check if version already exists
    const existing = await prisma.systemVersion.findUnique({
      where: { version: data.version },
    });

    if (existing) {
      return res.status(409).json({ error: 'Version already exists' });
    }

    // Create new version
    const version = await prisma.systemVersion.create({
      data: {
        version: data.version,
        patchNotes: data.patchNotes,
        isBreaking: data.isBreaking,
        requiresRestart: data.requiresRestart,
        appliedBy: userId,
        status: 'applied',
      },
    });

    // Create history entry
    await prisma.versionHistory.create({
      data: {
        versionId: version.id,
        action: 'APPLY',
        details: `Applied version ${data.version}`,
        userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'VERSION_APPLY',
        details: `Applied system version ${data.version}`,
        ipAddress: req.ip,
      },
    });

    res.status(201).json(version);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Rollback to a previous version
router.post('/rollback/:version', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const targetVersion = z.string().regex(/^\d+\.\d+\.\d+$/).parse(req.params.version);
    const target = await prisma.systemVersion.findUnique({ where: { version: targetVersion } });
    if (!target) return res.status(404).json({ error: 'Target version not found' });

    const current = await prisma.systemVersion.findFirst({ where: { status: 'applied' }, orderBy: { appliedAt: 'desc' } });
    if (current && target.appliedAt >= current.appliedAt) return res.status(400).json({ error: 'Must rollback to an older version' });

    await prisma.$transaction([
      prisma.systemVersion.updateMany({ where: { appliedAt: { gt: target.appliedAt }, status: 'applied' }, data: { status: 'rolled_back' } }),
      prisma.versionHistory.create({ data: { versionId: target.id, action: 'ROLLBACK', details: `Rolled back to ${targetVersion}`, userId: req.user.id } }),
      prisma.auditLog.create({ data: { userId: req.user.id, action: 'VERSION_ROLLBACK', details: `Rolled back to ${targetVersion}`, ipAddress: req.ip } })
    ]);

    res.json({ message: `Successfully rolled back to version ${targetVersion}`, version: target });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid version format. Use x.y.z' });
    next(error);
  }
});

// Compare versions
router.get('/compare/:from/:to', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { from, to } = req.params;

    const [fromVersion, toVersion] = await Promise.all([
      prisma.systemVersion.findUnique({ where: { version: from } }),
      prisma.systemVersion.findUnique({ where: { version: to } }),
    ]);

    if (!fromVersion || !toVersion) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    // Get all versions between
    const versionsBetween = await prisma.systemVersion.findMany({
      where: {
        appliedAt: {
          gt: fromVersion.appliedAt,
          lte: toVersion.appliedAt,
        },
      },
      orderBy: { appliedAt: 'asc' },
    });

    const patchNotes = versionsBetween.map(v => ({
      version: v.version,
      patchNotes: v.patchNotes,
      isBreaking: v.isBreaking,
      appliedAt: v.appliedAt,
    }));

    res.json({
      from: fromVersion,
      to: toVersion,
      versionsBetween: versionsBetween.length,
      patchNotes,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
