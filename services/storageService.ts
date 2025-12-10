

import { Note, NoteType, Folder } from '../types';
import JSZip from 'jszip';

const STORAGE_PREFIX = 'ideaweaver_notes_';
const FOLDERS_PREFIX = 'ideaweaver_folders_';
const BACKUP_KEY = 'ideaweaver_backups';
const LAST_BACKUP_TIME_KEY = 'ideaweaver_last_backup';
const GUEST_KEY = 'ideaweaver_guest_session';
const GUEST_FOLDERS_KEY = 'ideaweaver_guest_folders';

interface BackupSnapshot {
    timestamp: number;
    notes: Note[];
}

export interface UserUsageStats {
    noteCount: number;
    topCategory: string;
    persona: string;
    personaEmoji: string;
}

const getStorageKey = (username: string | null) => {
    if (!username) return GUEST_KEY;
    return `${STORAGE_PREFIX}${username}`;
};

const getFoldersKey = (username: string | null) => {
    if (!username) return GUEST_FOLDERS_KEY;
    return `${FOLDERS_PREFIX}${username}`;
};

/**
 * Loads notes. 
 * If username is provided, loads from LocalStorage (Persistent).
 * If null, loads from SessionStorage (Transient/Guest).
 */
export const loadNotes = (username: string | null): Note[] | null => {
    try {
        const key = getStorageKey(username);
        const storage = username ? localStorage : sessionStorage;
        const stored = storage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error("Failed to load notes from storage", e);
        return null;
    }
};

/**
 * Saves notes.
 */
export const saveNotes = (notes: Note[], username: string | null) => {
    try {
        const key = getStorageKey(username);
        const storage = username ? localStorage : sessionStorage;
        storage.setItem(key, JSON.stringify(notes));
    } catch (e) {
        console.error("Failed to save notes to storage", e);
    }
};

/**
 * Loads folders.
 */
export const loadFolders = (username: string | null): Folder[] => {
    try {
        const key = getFoldersKey(username);
        const storage = username ? localStorage : sessionStorage;
        const stored = storage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to load folders", e);
        return [];
    }
};

/**
 * Saves folders.
 */
export const saveFolders = (folders: Folder[], username: string | null) => {
    try {
        const key = getFoldersKey(username);
        const storage = username ? localStorage : sessionStorage;
        storage.setItem(key, JSON.stringify(folders));
    } catch (e) {
        console.error("Failed to save folders", e);
    }
};

/**
 * Gets the timestamp of the last successful backup (Global for device).
 */
export const getLastBackupTime = (): number | null => {
    const t = localStorage.getItem(LAST_BACKUP_TIME_KEY);
    return t ? parseInt(t, 10) : null;
};

/**
 * Checks if a backup is needed and performs it.
 * Only performs backup if user is logged in (persistent data).
 */
export const performAutoBackup = (notes: Note[], username: string | null): boolean => {
    if (!username || notes.length === 0) return false;

    const now = Date.now();
    const lastBackup = getLastBackupTime();
    // 3 times a day = 24h / 3 = 8 hours
    const BACKUP_INTERVAL = 8 * 60 * 60 * 1000; 

    if (!lastBackup || (now - lastBackup) > BACKUP_INTERVAL) {
        try {
            const existingBackupsStr = localStorage.getItem(BACKUP_KEY);
            let backups: BackupSnapshot[] = existingBackupsStr ? JSON.parse(existingBackupsStr) : [];
            
            backups.push({ timestamp: now, notes });
            
            if (backups.length > 5) {
                backups = backups.slice(backups.length - 5);
            }
            
            localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
            localStorage.setItem(LAST_BACKUP_TIME_KEY, now.toString());
            console.log("Auto-backup performed at", new Date(now).toLocaleTimeString());
            return true;
        } catch (e) {
            console.error("Backup failed", e);
            return false;
        }
    }
    return false;
};

/**
 * Convert a Note object to Markdown string
 */
const noteToMarkdown = (note: Note): string => {
    const dateStr = new Date(note.createdAt).toLocaleString();
    let md = `# ${note.title}\n\n`;
    md += `**Date:** ${dateStr} | **Category:** ${note.category} | **Type:** ${note.type}\n`;
    md += `**Tags:** ${note.tags.map(t => `#${t}`).join(' ')}\n\n`;
    md += `---\n\n`;
    md += note.content;
    
    // Append Project Specific Data if available
    if (note.projectData) {
        md += `\n\n## Project Details\n`;
        if (note.projectData.estimatedDuration) {
            md += `**Estimated Duration:** ${note.projectData.estimatedDuration}\n\n`;
        }
        
        if (note.projectData.deliverables?.length > 0) {
            md += `### Deliverables\n`;
            note.projectData.deliverables.forEach(d => md += `- ${d}\n`);
            md += `\n`;
        }

        if (note.projectData.milestones?.length > 0) {
            md += `### Milestones\n`;
            note.projectData.milestones.forEach(m => md += `- [${m.date || 'TBD'}] ${m.label} (${m.status})\n`);
            md += `\n`;
        }
    }
    
    return md;
};

/**
 * Download a single note as .md file
 */
export const downloadNoteAsMarkdown = (note: Note) => {
    const mdContent = noteToMarkdown(note);
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Sanitize filename
    const filename = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    
    link.href = url;
    link.download = `${filename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Bulk download all notes as a ZIP of .md files
 */
export const downloadAllNotesAsZip = async (notes: Note[]) => {
    if (notes.length === 0) return;
    
    const zip = new JSZip();
    const folder = zip.folder("WeaveNote_Export");
    
    notes.forEach(note => {
        const mdContent = noteToMarkdown(note);
        const filename = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50)}_${note.id.substring(0,6)}.md`;
        folder?.file(filename, mdContent);
    });
    
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WeaveNote_Export_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Manually export data to a JSON file
 */
export const exportDataToFile = (notes: Note[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `WeaveNote_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

/**
 * Import notes from a JSON string.
 * Returns the parsed notes array or throws error.
 */
export const parseImportFile = (jsonString: string): Note[] => {
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
            // Simple validation check: does first item have id and title?
            if (parsed.length > 0 && (!parsed[0].id || !parsed[0].title)) {
                throw new Error("Invalid note format");
            }
            return parsed as Note[];
        }
        throw new Error("File content is not a list of notes");
    } catch (e) {
        throw new Error("Failed to parse file");
    }
};

/**
 * Calculate Usage Stats and Persona for a specific user
 * Used by Admin Panel
 */
export const getUserStats = (username: string): UserUsageStats => {
    const notes = loadNotes(username) || [];
    
    // 1. Top Category
    const categoryCounts: Record<string, number> = {};
    notes.forEach(n => categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1);
    const topCategory = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';

    // 2. Persona Calculation
    let persona = "WeaveNote User";
    let personaEmoji = "🕸️";

    if (notes.length === 0) {
        persona = "Newcomer";
        personaEmoji = "👋";
    } else {
        // Shared Persona Definition Logic
        const allTags = notes.flatMap(n => n.tags.map(t => t.toLowerCase()));
        
        const personas = [
            { id: 'cyber', title: "Cybersecurity Specialist", emoji: "🛡️", keywords: ['security', 'cyber', 'hack', 'firewall', 'auth', 'vuln', 'cve', 'pentest'] },
            { id: 'network', title: "Network Architect", emoji: "🌐", keywords: ['network', 'ip', 'router', 'switch', 'wifi', 'dns', 'server', 'cloud', 'tcp'] },
            { id: 'nurse', title: "Compassionate Caregiver", emoji: "🩺", keywords: ['patient', 'meds', 'health', 'clinic', 'doctor', 'nurse', 'vitals'] },
            { id: 'lawyer', title: "The Legal Eagle", emoji: "⚖️", keywords: ['law', 'legal', 'court', 'contract', 'case', 'sue', 'compliance', 'judge'] },
            { id: 'dev', title: "Code Wizard", emoji: "💻", keywords: ['code', 'dev', 'git', 'api', 'bug', 'react', 'js', 'ts', 'python'] },
            { id: 'creative', title: "Creative Visionary", emoji: "🎨", keywords: ['design', 'art', 'ui', 'ux', 'color', 'draw', 'paint', 'write'] },
            { id: 'finance', title: "Financial Guru", emoji: "📈", keywords: ['money', 'budget', 'stock', 'crypto', 'invest', 'tax', 'finance'] },
            { id: 'fitness', title: "Fitness Enthusiast", emoji: "🏋️", keywords: ['gym', 'workout', 'run', 'diet', 'fitness', 'lift', 'cardio'] },
            { id: 'chef', title: "Master Chef", emoji: "🍳", keywords: ['recipe', 'cook', 'bake', 'food', 'dinner', 'lunch', 'kitchen'] },
            { id: 'travel', title: "The Globetrotter", emoji: "✈️", keywords: ['trip', 'flight', 'hotel', 'travel', 'vacation', 'passport'] },
            { id: 'student', title: "Dedicated Student", emoji: "🎒", keywords: ['study', 'test', 'exam', 'certification', 'class', 'school', 'learn'] },
            { id: 'parent', title: "The Busy Parent", emoji: "🏠", keywords: ['grocery', 'food', 'kids', 'home', 'chore', 'mom', 'dad'] }
        ];

        let bestMatch = null;
        let maxScore = 0;

        personas.forEach(p => {
            const score = allTags.filter(t => p.keywords.some(k => t.includes(k))).length;
            if (score > maxScore) {
                maxScore = score;
                bestMatch = p;
            }
        });

        if (bestMatch && maxScore > 0) {
            persona = bestMatch.title;
            personaEmoji = bestMatch.emoji;
        } else {
             // Fallback to Type Dominance
             const typeCounts: Record<NoteType, number> = { quick: 0, deep: 0, project: 0, contact: 0, document: 0 };
             notes.forEach(n => { if (typeCounts[n.type] !== undefined) typeCounts[n.type]++; });
             
             let maxType: NoteType = 'quick';
             let maxCount = -1;
             for (const [type, count] of Object.entries(typeCounts)) {
                 if (count > maxCount) { maxCount = count; maxType = type as NoteType; }
             }

             if (maxType === 'deep') { persona = "The Professor"; personaEmoji = "👨‍🏫"; }
             else if (maxType === 'project') { persona = "The Executive"; personaEmoji = "💼"; }
             else if (maxType === 'contact') { persona = "The Networker"; personaEmoji = "🤝"; }
             else if (maxType === 'document') { persona = "The Archivist"; personaEmoji = "📚"; }
             else if (maxType === 'quick') { persona = "Day-to-Day Organizer"; personaEmoji = "⚡"; }
        }
    }

    return {
        noteCount: notes.length,
        topCategory,
        persona,
        personaEmoji
    };
};
