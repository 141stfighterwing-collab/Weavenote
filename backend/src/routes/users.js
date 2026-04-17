import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Update user profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;
    
    const updateData = {};
    if (username) updateData.username = username;
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      updateData.email = email;
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
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
router.get('/admin/all', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
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
router.patch('/admin/:id/status', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { id } = req.params;
    const { status, statusUntil } = req.body;
    
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
        permission: true,
        status: true,
        statusUntil: true,
        lastLogin: true,
        createdAt: true,
        aiUsageCount: true,
      },
    });
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
