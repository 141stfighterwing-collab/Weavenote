
import { Note, Folder, UserUsageStats } from '../types';
import JSZip from 'jszip';
import { db } from './firebase';
import { 
    collection, query, where, getDocs, setDoc, doc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { logTraffic } from './trafficService';

const GUEST_KEY = 'ideaweaver_guest_session';
const GUEST_FOLDERS_KEY = 'ideaweaver_guest_folders';

/**
 * XSS & INJECTION PROTECTION
 */
const sanitizeInput = (val: any): any => {
    if (typeof val === 'string') {
        return val
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
            .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, "")
            .replace(/on\w+="[^"]*"/gim, "") 
            .substring(0, 50000);
    }
    if (Array.isArray(val)) return val.map(sanitizeInput);
    if (val !== null && typeof val === 'object') {
        const cleaned: any = {};
        for (const key in val) cleaned[key] = sanitizeInput(val[key]);
        return cleaned;
    }
    return val;
};

const sanitizeForFirestore = <T>(data: T): T => {
    const cleaned = JSON.parse(JSON.stringify(data));
    return sanitizeInput(cleaned);
};

export const loadNotes = async (userId: string | null): Promise<Note[]> => {
    if (!userId) {
        const stored = sessionStorage.getItem(GUEST_KEY);
        return stored ? JSON.parse(stored) : [];
    }
    if (!db) return [];
    try {
        const q = query(collection(db, 'notes'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        const notes = snapshot.docs.map(d => d.data() as Note);
        logTraffic('GET', 'firestore/notes', 200, JSON.stringify(notes).length);
        return notes.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        logTraffic('GET', 'firestore/notes', 500, 0);
        return [];
    }
};

export const saveNote = async (note: Note, userId: string | null) => {
    const cleanNote = sanitizeForFirestore(note);
    if (!userId) {
        const notes = await loadNotes(null);
        const idx = notes.findIndex(n => n.id === cleanNote.id);
        if (idx >= 0) notes[idx] = cleanNote; else notes.push(cleanNote);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(notes));
        return;
    }
    if (!db) return;
    try {
        await setDoc(doc(db, 'notes', cleanNote.id), { ...cleanNote, userId });
        logTraffic('POST', 'firestore/notes', 200, JSON.stringify(cleanNote).length);
    } catch (e) {
        logTraffic('POST', 'firestore/notes', 500, 0);
        throw e;
    }
};

export const deleteNote = async (noteId: string, userId: string | null) => {
    if (!userId) {
        const notes = await loadNotes(null);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(notes.filter(n => n.id !== noteId)));
        return;
    }
    if (!db) return;
    await deleteDoc(doc(db, 'notes', noteId));
    logTraffic('DELETE', 'firestore/notes', 200, 0);
};

export const loadFolders = async (userId: string | null): Promise<Folder[]> => {
    if (!userId) return JSON.parse(sessionStorage.getItem(GUEST_FOLDERS_KEY) || '[]');
    if (!db) return [];
    const snapshot = await getDocs(query(collection(db, 'folders'), where('userId', '==', userId)));
    return snapshot.docs.map(d => d.data() as Folder).sort((a,b) => a.order - b.order);
};

export const saveFolder = async (folder: Folder, userId: string | null) => {
    if (!userId) {
        const folders = await loadFolders(null);
        const idx = folders.findIndex(f => f.id === folder.id);
        if (idx >= 0) folders[idx] = folder; else folders.push(folder);
        sessionStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(folders));
        return;
    }
    if (!db) return;
    await setDoc(doc(db, 'folders', folder.id), { ...folder, userId });
};

export const deleteFolder = async (folderId: string, userId: string | null) => {
    if (!userId) {
        const folders = await loadFolders(null);
        sessionStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(folders.filter(f => f.id !== folderId)));
        return;
    }
    if (!db) return;
    await deleteDoc(doc(db, 'folders', folderId));
};

export const syncAllNotes = async (notes: Note[], userId: string) => {
    if (!db || !userId) return;
    const batch = writeBatch(db);
    notes.slice(0, 490).forEach(note => {
        batch.set(doc(db, 'notes', note.id), sanitizeForFirestore({ ...note, userId }));
    });
    await batch.commit();
};

export const downloadAllNotesAsZip = async (notes: Note[]) => {
    const zip = new JSZip();
    const folder = zip.folder("WeaveNote_Export");
    notes.forEach(note => {
        const md = `# ${note.title}\n\n${note.content}`;
        folder?.file(`${note.title.replace(/[^a-z0-9]/gi, '_')}.md`, md);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WeaveNote_Export.zip`;
    link.click();
};

export const exportDataToFile = (notes: Note[]) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `WeaveNote_Backup.json`);
    link.click();
};
