import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Export notes in various formats
router.get('/notes/:format', authenticate, async (req, res, next) => {
  try {
    const { format } = req.params;
    const userId = req.user.id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const notes = await prisma.note.findMany({
      where: { userId, isDeleted: false },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (notes.length === 0) {
      return res.status(400).json({ error: 'No notes to export' });
    }
    
    let content;
    let filename;
    let contentType;
    
    switch (format) {
      case 'json':
        content = JSON.stringify({
          exportedAt: new Date().toISOString(),
          totalNotes: notes.length,
          userId,
          notes: notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            rawContent: n.rawContent,
            category: n.category,
            type: n.type,
            color: n.color,
            createdAt: n.createdAt.getTime(),
            tags: n.tags.map(t => t.tag),
            folderId: n.folderId,
          })),
        }, null, 2);
        filename = `WeaveNote_Database_${timestamp}.json`;
        contentType = 'application/json';
        break;
        
      case 'csv':
        const header = ['id', 'title', 'content', 'category', 'type', 'createdAt', 'folderId'];
        const rows = notes.map(n => [
          n.id,
          `"${n.title.replace(/"/g, '""')}"`,
          `"${n.content.replace(/"/g, '""').substring(0, 1000)}"`, // Truncate for CSV
          n.category,
          n.type,
          n.createdAt.getTime(),
          n.folderId || '',
        ].join(','));
        
        content = [header.join(','), ...rows].join('\n');
        filename = `WeaveNote_Database_${timestamp}.csv`;
        contentType = 'text/csv';
        break;
        
      case 'sql':
        const sqlHeader = [
          '-- WeaveNote SQL export',
          `-- Exported at: ${new Date().toISOString()}`,
          `-- User ID: ${userId}`,
          '',
          'CREATE TABLE IF NOT EXISTS notes (',
          '  id TEXT PRIMARY KEY,',
          '  title TEXT NOT NULL,',
          '  content TEXT NOT NULL,',
          '  category TEXT,',
          '  type TEXT,',
          '  color TEXT,',
          '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
          '  folder_id TEXT,',
          '  user_id TEXT',
          ');',
          '',
        ].join('\n');
        
        const escapeSql = (str) => str.replace(/\\/g, "\\\\").replace(/'/g, "''");
        
        const inserts = notes.map(n => 
          `INSERT INTO notes (id, title, content, category, type, color, created_at, folder_id, user_id) VALUES ('${escapeSql(n.id)}', '${escapeSql(n.title)}', '${escapeSql(n.content.substring(0, 5000))}', '${escapeSql(n.category)}', '${escapeSql(n.type)}', '${escapeSql(n.color)}', '${n.createdAt.toISOString()}', ${n.folderId ? `'${escapeSql(n.folderId)}'` : 'NULL'}, '${escapeSql(userId)}');`
        );
        
        content = [sqlHeader, ...inserts].join('\n');
        filename = `WeaveNote_Database_${timestamp}.sql`;
        contentType = 'application/sql';
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid format. Use json, csv, or sql.' });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

// Export notes as markdown files in a zip
router.get('/markdown', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const notes = await prisma.note.findMany({
      where: { userId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    
    if (notes.length === 0) {
      return res.status(400).json({ error: 'No notes to export' });
    }
    
    // Generate markdown content for each note
    const markdownFiles = notes.map(n => ({
      filename: `${n.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.md`,
      content: `# ${n.title}\n\n**Type:** ${n.type}\n**Category:** ${n.category}\n**Created:** ${n.createdAt.toISOString()}\n\n---\n\n${n.content}`,
    }));
    
    // Return as JSON for now (frontend can handle zip creation)
    res.json({
      files: markdownFiles,
      totalFiles: markdownFiles.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
