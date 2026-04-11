import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const noteSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(500),
  content: z.string(),
  rawContent: z.string().optional(),
  category: z.string().default('general'),
  type: z.enum(['quick', 'notebook', 'deep', 'code', 'project', 'contact', 'document']).default('quick'),
  color: z.enum(['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'teal', 'rose', 'indigo', 'lime', 'sky', 'fuchsia', 'slate', 'red', 'cyan', 'violet', 'matrix']).default('yellow'),
  tags: z.array(z.string()).optional().default([]),
  folderId: z.string().nullable().optional(),
  isDeleted: z.boolean().optional().default(false),
  isSynthesized: z.boolean().optional().default(false),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  projectData: z.object({
    objectives: z.array(z.object({ label: z.string(), status: z.enum(['pending', 'completed']) })).optional(),
    deliverables: z.array(z.object({ label: z.string(), status: z.enum(['pending', 'completed']) })).optional(),
    milestones: z.array(z.object({ date: z.string(), label: z.string(), status: z.enum(['pending', 'completed']) })).optional(),
    timeline: z.array(z.object({ name: z.string(), startDate: z.string(), endDate: z.string() })).optional(),
    estimatedDuration: z.string().optional(),
    manualProgress: z.number().optional(),
    isCompleted: z.boolean().optional(),
    workflow: z.object({
      nodes: z.array(z.object({ id: z.string(), label: z.string(), rule: z.string().optional(), status: z.enum(['pending', 'in_progress', 'done']) })),
      edges: z.array(z.object({ source: z.string(), target: z.string() })),
    }).optional(),
  }).optional(),
});

// Get all notes for a user
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { type, folderId, isDeleted, search, limit = 100, offset = 0 } = req.query;
    
    if (!userId) {
      return res.json([]); // Return empty for guest users
    }
    
    const where = { userId };
    
    if (type) where.type = type;
    if (folderId !== undefined) where.folderId = folderId === 'null' ? null : folderId;
    if (isDeleted !== undefined) where.isDeleted = isDeleted === 'true';
    
    const notes = await prisma.note.findMany({
      where,
      include: {
        tags: true,
        projectData: {
          include: {
            objectives: { orderBy: { order: 'asc' } },
            deliverables: { orderBy: { order: 'asc' } },
            milestones: { orderBy: { order: 'asc' } },
            timeline: { orderBy: { order: 'asc' } },
            workflowNodes: { orderBy: { order: 'asc' } },
            workflowEdges: { orderBy: { order: 'asc' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });
    
    // Transform to match frontend format
    const transformedNotes = notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      rawContent: note.rawContent,
      category: note.category,
      type: note.type,
      color: note.color,
      createdAt: note.createdAt.getTime(),
      tags: note.tags.map(t => t.tag),
      folderId: note.folderId,
      userId: note.userId,
      isDeleted: note.isDeleted,
      deletedAt: note.deletedAt?.getTime(),
      isSynthesized: note.isSynthesized,
      accessCount: note.accessCount,
      wordCount: note.wordCount,
      textColor: note.textColor,
      backgroundColor: note.backgroundColor,
      projectData: note.projectData ? {
        objectives: note.projectData.objectives,
        deliverables: note.projectData.deliverables,
        milestones: note.projectData.milestones.map(m => ({
          ...m,
          date: m.date.toISOString().split('T')[0],
        })),
        timeline: note.projectData.timeline.map(t => ({
          ...t,
          startDate: t.startDate.toISOString().split('T')[0],
          endDate: t.endDate.toISOString().split('T')[0],
        })),
        estimatedDuration: note.projectData.estimatedDuration,
        manualProgress: note.projectData.manualProgress,
        isCompleted: note.projectData.isCompleted,
        workflow: note.projectData.workflowNodes.length > 0 ? {
          nodes: note.projectData.workflowNodes.map(n => ({
            id: n.nodeId,
            label: n.label,
            rule: n.rule,
            status: n.status,
          })),
          edges: note.projectData.workflowEdges.map(e => ({
            source: e.source,
            target: e.target,
          })),
        } : undefined,
      } : undefined,
    }));
    
    res.json(transformedNotes);
  } catch (error) {
    next(error);
  }
});

// Get a single note
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    // SECURITY: Explicitly check for userId to prevent IDOR vulnerabilities.
    // Prisma ignores undefined values in filters, which would allow unauthenticated access.
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const note = await prisma.note.findFirst({
      where: { id, userId },
      include: {
        tags: true,
        projectData: {
          include: {
            objectives: { orderBy: { order: 'asc' } },
            deliverables: { orderBy: { order: 'asc' } },
            milestones: { orderBy: { order: 'asc' } },
            timeline: { orderBy: { order: 'asc' } },
            workflowNodes: { orderBy: { order: 'asc' } },
            workflowEdges: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Increment access count
    await prisma.note.update({
      where: { id },
      data: { accessCount: { increment: 1 } },
    });
    
    res.json(note);
  } catch (error) {
    next(error);
  }
});

// Create a new note
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = noteSchema.parse(req.body);
    const userId = req.user.id;
    
    // Calculate word count
    const wordCount = data.content.split(/\s+/).filter(Boolean).length;
    
    // Create note with tags in transaction
    const note = await prisma.$transaction(async (tx) => {
      const newNote = await tx.note.create({
        data: {
          id: data.id,
          title: data.title,
          content: data.content,
          rawContent: data.rawContent || data.content,
          category: data.category,
          type: data.type,
          color: data.color,
          userId,
          folderId: data.folderId,
          isDeleted: data.isDeleted,
          isSynthesized: data.isSynthesized,
          textColor: data.textColor,
          backgroundColor: data.backgroundColor,
          wordCount,
          tags: {
            create: data.tags.map(tag => ({ tag })),
          },
        },
      });
      
      // Create project data if provided
      if (data.projectData && data.type === 'project') {
        await tx.projectData.create({
          data: {
            noteId: newNote.id,
            estimatedDuration: data.projectData.estimatedDuration,
            manualProgress: data.projectData.manualProgress,
            isCompleted: data.projectData.isCompleted,
            objectives: {
              create: data.projectData.objectives?.map((o, i) => ({
                label: o.label,
                status: o.status,
                order: i,
              })) || [],
            },
            deliverables: {
              create: data.projectData.deliverables?.map((d, i) => ({
                label: d.label,
                status: d.status,
                order: i,
              })) || [],
            },
            milestones: {
              create: data.projectData.milestones?.map((m, i) => ({
                date: new Date(m.date),
                label: m.label,
                status: m.status,
                order: i,
              })) || [],
            },
            timeline: {
              create: data.projectData.timeline?.map((t, i) => ({
                name: t.name,
                startDate: new Date(t.startDate),
                endDate: new Date(t.endDate),
                order: i,
              })) || [],
            },
            workflowNodes: {
              create: data.projectData.workflow?.nodes?.map((n, i) => ({
                nodeId: n.id,
                label: n.label,
                rule: n.rule,
                status: n.status,
                order: i,
              })) || [],
            },
            workflowEdges: {
              create: data.projectData.workflow?.edges?.map((e, i) => ({
                source: e.source,
                target: e.target,
                order: i,
              })) || [],
            },
          },
        });
      }
      
      return newNote;
    });
    
    res.status(201).json({ id: note.id, ...data, userId, createdAt: note.createdAt.getTime() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Update a note
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = noteSchema.partial().parse(req.body);
    const userId = req.user.id;
    
    // Check ownership
    const existingNote = await prisma.note.findFirst({
      where: { id, userId },
    });
    
    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Calculate word count if content updated
    const wordCount = data.content ? data.content.split(/\s+/).filter(Boolean).length : undefined;
    
    // Update note
    const note = await prisma.$transaction(async (tx) => {
      // Update tags if provided
      if (data.tags !== undefined) {
        await tx.noteTag.deleteMany({ where: { noteId: id } });
        await tx.noteTag.createMany({
          data: data.tags.map(tag => ({ noteId: id, tag })),
        });
      }
      
      return tx.note.update({
        where: { id },
        data: {
          title: data.title,
          content: data.content,
          rawContent: data.rawContent,
          category: data.category,
          type: data.type,
          color: data.color,
          folderId: data.folderId,
          isDeleted: data.isDeleted,
          deletedAt: data.isDeleted && !existingNote.isDeleted ? new Date() : null,
          isSynthesized: data.isSynthesized,
          textColor: data.textColor,
          backgroundColor: data.backgroundColor,
          wordCount,
        },
      });
    });
    
    res.json({ id: note.id, ...data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Delete a note
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { permanent } = req.query;
    
    const note = await prisma.note.findFirst({
      where: { id, userId },
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    if (permanent === 'true') {
      await prisma.note.delete({ where: { id } });
    } else {
      // Soft delete
      await prisma.note.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    }
    
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Restore a deleted note
router.post('/:id/restore', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const note = await prisma.note.findFirst({
      where: { id, userId, isDeleted: true },
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found or not deleted' });
    }
    
    await prisma.note.update({
      where: { id },
      data: { isDeleted: false, deletedAt: null },
    });
    
    res.json({ message: 'Note restored successfully' });
  } catch (error) {
    next(error);
  }
});

// Batch sync notes
router.post('/sync', authenticate, async (req, res, next) => {
  try {
    const { notes } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(notes)) {
      return res.status(400).json({ error: 'Notes must be an array' });
    }
    
    const results = { created: 0, updated: 0, errors: [] };
    
    for (const noteData of notes.slice(0, 100)) { // Limit to 100 notes per sync
      try {
        const existing = await prisma.note.findFirst({
          where: { id: noteData.id, userId },
        });
        
        if (existing) {
          await prisma.note.update({
            where: { id: noteData.id },
            data: {
              title: noteData.title,
              content: noteData.content,
              rawContent: noteData.rawContent,
              category: noteData.category,
              type: noteData.type,
              color: noteData.color,
              folderId: noteData.folderId,
              updatedAt: new Date(),
            },
          });
          results.updated++;
        } else {
          await prisma.note.create({
            data: {
              id: noteData.id,
              title: noteData.title,
              content: noteData.content,
              rawContent: noteData.rawContent || noteData.content,
              category: noteData.category || 'general',
              type: noteData.type || 'quick',
              color: noteData.color || 'yellow',
              userId,
              folderId: noteData.folderId,
              tags: {
                create: (noteData.tags || []).map(tag => ({ tag })),
              },
            },
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ id: noteData.id, error: err.message });
      }
    }
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

export default router;
