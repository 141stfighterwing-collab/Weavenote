import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { config } from '../config/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// SECURITY: Use encryption key from config (guaranteed by fail-secure check in index.js)
const ENCRYPTION_KEY = config.security.encryptionKey;
const ALGORITHM = 'aes-256-gcm';

// Encrypt sensitive data
const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(64, '0').slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

// Decrypt sensitive data
const decrypt = (encryptedData) => {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(64, '0').slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
};

// Environment variables schema
const envVariableSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  isSecret: z.boolean().default(true),
  category: z.enum(['api', 'database', 'firebase', 'security', 'general']).default('general'),
  description: z.string().optional(),
});

// Get all environment variables (masked for secrets)
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const envVars = settings.map(s => ({
      id: s.id,
      key: s.key,
      value: s.isSecret ? '••••••••••••' : s.value,
      isSecret: s.isSecret,
      category: s.category,
      description: s.description,
      updatedAt: s.updatedAt,
      updatedBy: s.updatedBy,
    }));

    res.json(envVars);
  } catch (error) {
    next(error);
  }
});

// Get a single environment variable (decrypted for admins)
router.get('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const setting = await prisma.systemSetting.findUnique({
      where: { id },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const value = setting.isSecret ? decrypt(setting.value) : setting.value;

    res.json({
      id: setting.id,
      key: setting.key,
      value,
      isSecret: setting.isSecret,
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    });
  } catch (error) {
    next(error);
  }
});

// Create or update an environment variable
router.post('/', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const data = envVariableSchema.parse(req.body);
    const userId = req.user.id;

    // Encrypt if secret
    const valueToStore = data.isSecret ? encrypt(data.value) : data.value;

    // Upsert the setting
    const setting = await prisma.systemSetting.upsert({
      where: { key: data.key },
      update: {
        value: valueToStore,
        isSecret: data.isSecret,
        category: data.category,
        description: data.description,
        updatedBy: userId,
      },
      create: {
        key: data.key,
        value: valueToStore,
        isSecret: data.isSecret,
        category: data.category,
        description: data.description,
        updatedBy: userId,
      },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_ENV',
        details: `Updated environment variable: ${data.key}`,
        ipAddress: req.ip,
      },
    });

    res.json({
      id: setting.id,
      key: setting.key,
      value: data.isSecret ? '••••••••••••' : data.value,
      isSecret: setting.isSecret,
      category: setting.category,
      description: setting.description,
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete an environment variable
router.delete('/:id', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const setting = await prisma.systemSetting.findUnique({
      where: { id },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await prisma.systemSetting.delete({
      where: { id },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_ENV',
        details: `Deleted environment variable: ${setting.key}`,
        ipAddress: req.ip,
      },
    });

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Export environment to .env file format
router.post('/export', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const envContent = settings.map(s => {
      const value = s.isSecret ? decrypt(s.value) : s.value;
      return `# ${s.description || s.category}\n${s.key}=${value || ''}`;
    }).join('\n\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=".env"');
    res.send(envContent);
  } catch (error) {
    next(error);
  }
});

// Import environment from .env file content
router.post('/import', authenticate, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { content, category = 'general', isSecret = true } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    const lines = content.split('\n');
    const results = { imported: 0, skipped: 0, errors: [] };
    let currentKey = null;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }

      // Parse KEY=value format
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        try {
          const valueToStore = isSecret ? encrypt(value) : value;
          
          await prisma.systemSetting.upsert({
            where: { key },
            update: {
              value: valueToStore,
              isSecret,
              category,
              updatedBy: req.user.id,
            },
            create: {
              key,
              value: valueToStore,
              isSecret,
              category,
              updatedBy: req.user.id,
            },
          });
          
          results.imported++;
        } catch (err) {
          results.errors.push({ key, error: err.message });
        }
      }
    }

    // Log the import
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'IMPORT_ENV',
        details: `Imported ${results.imported} environment variables`,
        ipAddress: req.ip,
      },
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Get environment categories with counts
router.get('/categories/summary', authenticate, requireRole('admin', 'super_admin'), async (req, res, next) => {
  try {
    const summary = await prisma.systemSetting.groupBy({
      by: ['category'],
      _count: true,
    });

    res.json(summary.map(s => ({
      category: s.category,
      count: s._count,
    })));
  } catch (error) {
    next(error);
  }
});

export default router;
