
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

// Helper: Firestore throws error if a field is 'undefined'. 
// We must strip undefined keys or convert them to null.
// JSON.stringify automatically removes keys with undefined values.
const sanitizeForFirestore = <T>(data: T): T => {
    return JSON.parse(JSON.stringify(data));
};

/**
 * Load Notes (Async)
 * Fetches notes belonging specifically to the logged-in user.
 */
export const loadNotes = async (userId: string | null): Promise<Note[]> => {
    // Guest Mode: Load from Browser RAM
    if (!userId) {
        try {
            const stored = sessionStorage.getItem(GUEST_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    // Firebase Mode: Load from Cloud Database
    if (!db) {
        console.warn("Firestore not initialized. Check config.");
        return [];
    }
    
    try {
        // Query: Select * from Notes where userId == currentUserId
        const q = query(collection(db, 'notes'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const notes = snapshot.docs.map(d => d.data() as Note);
        
        // Sort by newest first
        return notes.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        console.error("Firestore Load Error:", e);
        return [];
    }
};

/**
 * Save/Update a SINGLE Note
 */
export const saveNote = async (note: Note, userId: string | null) => {
    // Guest Mode
    if (!userId) {
        const notes = await loadNotes(null);
        const idx = notes.findIndex(n => n.id === note.id);
        if (idx >= 0) notes[idx] = note;
        else notes.push(note);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(notes));
        return;
    }

    // Firebase Mode
    if (!db) return;
    try {
        // Force the userId on the note data to ensure ownership
        const noteData = { ...note, userId };
        // Sanitize to remove 'undefined' fields (like folderId) which crash Firestore
        const cleanData = sanitizeForFirestore(noteData);
        
        await setDoc(doc(db, 'notes', note.id), cleanData);
        console.log(`Note ${note.id} saved to Cloud.`);
    } catch (e) {
        console.error("Firestore Save Error", e);
        throw e;
    }
};

/**
 * Delete a Note
 */
export const deleteNote = async (noteId: string, userId: string | null) => {
    // Guest Mode
    if (!userId) {
        const notes = await loadNotes(null);
        const newNotes = notes.filter(n => n.id !== noteId);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(newNotes));
        return;
    }

    // Firebase Mode
    if (!db) return;
    try {
        await deleteDoc(doc(db, 'notes', noteId));
        console.log(`Note ${noteId} deleted from Cloud.`);
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
        console.error("Folder Load Error", e);
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
        const folderData = { ...folder, userId };
        const cleanData = sanitizeForFirestore(folderData);
        await setDoc(doc(db, 'folders', folder.id), cleanData);
    } catch (e) {
        console.error("Folder Save Error", e);
    }
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
 * Sync All Notes (Used for bulk imports)
 */
export const syncAllNotes = async (notes: Note[], userId: string) => {
    if (!db || !userId) return;
    const batch = writeBatch(db);
    
    // Firestore batch limit is 500 operations. 
    // For simplicity, we assume <500 notes in this call or split logic needed.
    notes.slice(0, 490).forEach(note => {
        const ref = doc(db, 'notes', note.id);
        const cleanData = sanitizeForFirestore({ ...note, userId });
        batch.set(ref, cleanData);
    });
    
    await batch.commit();
};

// ... Export/Markdown helpers ...

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

export const getUserStats = async (userId: string): Promise<UserUsageStats> => {
    const notes = await loadNotes(userId);
    const categoryCounts: Record<string, number> = {};
    notes.forEach(n => categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1);
    const topCategory = Object.entries(categoryCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';

    return {
        noteCount: notes.length,
        topCategory,
        persona: "Analyzed User",
        personaEmoji: "👤"
    };
};
