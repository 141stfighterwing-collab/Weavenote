import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Validation schema
const folderSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  order: z.number().int().default(0),
});

// Get all folders for a user
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    
    if (!userId) {
      return res.json([]); // Return empty for guest users
    }
    
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    
    res.json(folders.map(f => ({
      id: f.id,
      name: f.name,
      order: f.order,
      userId: f.userId,
    })));
  } catch (error) {
    next(error);
  }
});

// Create a new folder
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = folderSchema.parse(req.body);
    const userId = req.user.id;
    
    // Get max order
    const maxOrder = await prisma.folder.aggregate({
      where: { userId },
      _max: { order: true },
    });
    
    const order = data.order ?? (maxOrder._max.order ?? -1) + 1;
    
    const folder = await prisma.folder.create({
      data: {
        id: data.id,
        name: data.name,
        order,
        userId,
      },
    });
    
    res.status(201).json({
      id: folder.id,
      name: folder.name,
      order: folder.order,
      userId: folder.userId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update a folder
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = folderSchema.partial().parse(req.body);
    const userId = req.user.id;
    
    const folder = await prisma.folder.findFirst({
      where: { id, userId },
    });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    const updated = await prisma.folder.update({
      where: { id },
      data: {
        name: data.name,
        order: data.order,
      },
    });
    
    res.json({
      id: updated.id,
      name: updated.name,
      order: updated.order,
      userId: updated.userId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete a folder
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const folder = await prisma.folder.findFirst({
      where: { id, userId },
    });
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Optionally move notes to no folder
    await prisma.note.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    });
    
    await prisma.folder.delete({ where: { id } });
    
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Reorder folders
router.post('/reorder', authenticate, async (req, res, next) => {
  try {
    const { folderIds } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(folderIds)) {
      return res.status(400).json({ error: 'folderIds must be an array' });
    }
    
    await prisma.$transaction(
      folderIds.map((id, index) =>
        prisma.folder.updateMany({
          where: { id, userId },
          data: { order: index },
        })
      )
    );
    
    res.json({ message: 'Folders reordered successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
