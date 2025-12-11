import { Note, Folder, UserUsageStats, NoteType } from '../types';
import JSZip from 'jszip';
import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    doc, 
    deleteDoc, 
    writeBatch
} from 'firebase/firestore';

// Keys for Guest Mode (Session Storage)
const GUEST_KEY = 'ideaweaver_guest_session';
const GUEST_FOLDERS_KEY = 'ideaweaver_guest_folders';

/**
 * Load Notes (Async)
 */
export const loadNotes = async (userId: string | null): Promise<Note[]> => {
    // Guest Mode
    if (!userId) {
        const stored = sessionStorage.getItem(GUEST_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    // Firebase Mode
    if (!db) return [];
    try {
        const q = query(collection(db, 'notes'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as Note);
    } catch (e) {
        console.error("Firestore Load Error", e);
        return [];
    }
};

/**
 * Save/Update a SINGLE Note (Optimized for Firebase)
 */
export const saveNote = async (note: Note, userId: string | null) => {
    if (!userId) {
        // Guest: We have to load all, update one, save all
        const notes = await loadNotes(null);
        const idx = notes.findIndex(n => n.id === note.id);
        if (idx >= 0) notes[idx] = note;
        else notes.push(note);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(notes));
        return;
    }

    if (!db) return;
    try {
        await setDoc(doc(db, 'notes', note.id), { ...note, userId });
    } catch (e) {
        console.error("Firestore Save Error", e);
    }
};

/**
 * Delete a Note
 */
export const deleteNote = async (noteId: string, userId: string | null) => {
    if (!userId) {
        const notes = await loadNotes(null);
        const newNotes = notes.filter(n => n.id !== noteId);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(newNotes));
        return;
    }

    if (!db) return;
    try {
        await deleteDoc(doc(db, 'notes', noteId));
    } catch (e) {
        console.error("Firestore Delete Error", e);
    }
};

/**
 * Load Folders
 */
export const loadFolders = async (userId: string | null): Promise<Folder[]> => {
    if (!userId) {
        const stored = sessionStorage.getItem(GUEST_FOLDERS_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    if (!db) return [];
    try {
        const q = query(collection(db, 'folders'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as Folder).sort((a,b) => a.order - b.order);
    } catch (e) {
        return [];
    }
};

/**
 * Save/Update Folder
 */
export const saveFolder = async (folder: Folder, userId: string | null) => {
    if (!userId) {
        const folders = await loadFolders(null);
        const idx = folders.findIndex(f => f.id === folder.id);
        if (idx >= 0) folders[idx] = folder;
        else folders.push(folder);
        sessionStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(folders));
        return;
    }

    if (!db) return;
    try {
        // @ts-ignore
        await setDoc(doc(db, 'folders', folder.id), { ...folder, userId });
    } catch (e) {}
};

export const deleteFolder = async (folderId: string, userId: string | null) => {
    if (!userId) {
        const folders = await loadFolders(null);
        const newFolders = folders.filter(f => f.id !== folderId);
        sessionStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(newFolders));
        return;
    }
    if (!db) return;
    await deleteDoc(doc(db, 'folders', folderId));
};

/**
 * Sync All Notes (Used for bulk imports or reordering if needed)
 * Caution: Firestore writes cost money. Avoid full dumps.
 */
export const syncAllNotes = async (notes: Note[], userId: string) => {
    if (!db || !userId) return;
    const batch = writeBatch(db);
    notes.forEach(note => {
        const ref = doc(db, 'notes', note.id);
        batch.set(ref, { ...note, userId });
    });
    await batch.commit();
};

// ... Export/Markdown helpers remain same (Client side logic) ...

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
    return md;
};

export const downloadNoteAsMarkdown = (note: Note) => {
    const mdContent = noteToMarkdown(note);
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    link.href = url;
    link.download = `${filename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

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

export const exportDataToFile = (notes: Note[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `WeaveNote_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

export const parseImportFile = (jsonString: string): Note[] => {
    try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) return parsed as Note[];
        throw new Error("Invalid note format");
    } catch (e) {
        throw new Error("Failed to parse file");
    }
};

/**
 * Calculate Usage Stats (Async for Firestore)
 */
export const getUserStats = async (userId: string): Promise<UserUsageStats> => {
    const notes = await loadNotes(userId);
    
    const categoryCounts: Record<string, number> = {};
    notes.forEach(n => categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1);
    const topCategory = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
        noteCount: notes.length,
        topCategory,
        persona: "Analyzed User", // simplified for async context
        personaEmoji: "👤"
    };
};