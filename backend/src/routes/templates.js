import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Validation schema
const templateSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  type: z.enum(['quick', 'notebook', 'deep', 'code', 'project', 'contact', 'document']).default('quick'),
  content: z.string().optional().default(''),
  workflowSteps: z.array(z.string()).optional().default([]),
});

// Get all templates
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    const templates = await prisma.template.findMany({
      where: userId ? {
        OR: [
          { userId },
          { userId: null }, // Global templates
        ],
      } : {
        userId: null, // Only global templates for unauthenticated users
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Create template
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = templateSchema.parse(req.body);
    const userId = req.user.id;
    
    const template = await prisma.template.create({
      data: {
        id: data.id,
        title: data.title,
        type: data.type,
        content: data.content,
        workflowSteps: data.workflowSteps,
        userId,
      },
    });
    
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update template
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = templateSchema.partial().parse(req.body);
    const userId = req.user.id;
    
    const template = await prisma.template.findFirst({
      where: { id, userId },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const updated = await prisma.template.update({
      where: { id },
      data,
    });
    
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete template
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const template = await prisma.template.findFirst({
      where: { id, userId },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await prisma.template.delete({ where: { id } });
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
