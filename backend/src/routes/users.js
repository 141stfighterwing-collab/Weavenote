import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const profileUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const adminStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending', 'banned']),
  statusUntil: z.string().optional().nullable(),
});

// Update user profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const data = profileUpdateSchema.parse(req.body);
    const userId = req.user.id;
    
    const updateData = {};
    if (data.username) updateData.username = data.username;
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updateData.email = data.email;
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        uid: true,
        email: true,
        username: true,
        role: true,
        permission: true,
      },
    });
    
    res.json({
      id: user.id,
      uid: user.uid,
      email: user.email,
      username: user.username,
      role: user.role,
      permission: user.permission,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Cannot change password for this account' });
    }
    
    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    
    // Invalidate all sessions except current
    await prisma.session.deleteMany({
      where: { userId, id: { not: req.session.id } },
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Get user statistics
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [noteCount, notesByType, notesByCategory, topTags] = await Promise.all([
      prisma.note.count({ where: { userId, isDeleted: false } }),
      prisma.note.groupBy({
        by: ['type'],
        where: { userId, isDeleted: false },
        _count: true,
      }),
      prisma.note.groupBy({
        by: ['category'],
        where: { userId, isDeleted: false },
        _count: true,
      }),
      prisma.noteTag.groupBy({
        by: ['tag'],
        where: { note: { userId, isDeleted: false } },
        _count: true,
        orderBy: { _count: { tag: 'desc' } },
        take: 10,
      }),
    ]);
    
    res.json({
      noteCount,
      notesByType: Object.fromEntries(notesByType.map(t => [t.type, t._count])),
      notesByCategory: Object.fromEntries(notesByCategory.map(c => [c.category, c._count])),
      topTags: topTags.map(t => ({ tag: t.tag, count: t._count })),
    });
  } catch (error) {
    next(error);
  }
});

// Admin: Get all users
router.get('/admin/all', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        uid: true,
        email: true,
        username: true,
        role: true,
        permission: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        aiUsageCount: true,
        _count: {
          select: { notes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Admin: Update user status
router.patch('/admin/:id/status', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, statusUntil } = adminStatusSchema.parse(req.body);
    
    const user = await prisma.user.update({
      where: { id },
      data: {
        status,
        statusUntil: statusUntil ? new Date(statusUntil) : null,
      },
      select: {
        id: true,
        uid: true,
        email: true,
        username: true,
        role: true,
        status: true,
        statusUntil: true,
        permission: true,
        lastLogin: true,
        aiUsageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

export default router;
