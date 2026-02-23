import { Note, Folder, UserUsageStats } from '../types';
import JSZip from 'jszip';
import { db } from './firebase';
import { 
    collection, query, where, getDocs, setDoc, doc, deleteDoc, writeBatch
} from 'firebase/firestore';
import { logTraffic } from './trafficService';

const GUEST_KEY = 'ideaweaver_guest_session';
const GUEST_FOLDERS_KEY = 'ideaweaver_guest_folders';

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
    } catch (e: any) {
        logTraffic('GET', 'firestore/notes', 500, 0);
        console.error("CRITICAL: Firestore Read Failed", e.code, e.message);
        throw e;
    }
};

export const saveNote = async (note: Note, userId: string | null) => {
    if (!userId) {
        const notes: Note[] = await loadNotes(null).catch(() => []);
        const idx = notes.findIndex(n => n.id === note.id);
        if (idx >= 0) notes[idx] = note; else notes.push(note);
        sessionStorage.setItem(GUEST_KEY, JSON.stringify(notes));
        return;
    }
    if (!db) return;
    try {
        // FORCE the userId to be present at top level for security rules
        const noteWithUserId = { ...note, userId };
        const cleanNote = sanitizeForFirestore(noteWithUserId);
        await setDoc(doc(db, 'notes', cleanNote.id), cleanNote);
        logTraffic('POST', 'firestore/notes', 200, JSON.stringify(cleanNote).length);
    } catch (e) {
        logTraffic('POST', 'firestore/notes', 500, 0);
        throw e;
    }
};

export const deleteNote = async (noteId: string, userId: string | null) => {
    if (!userId) {
        const notes = await loadNotes(null).catch(() => []);
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
    try {
        const snapshot = await getDocs(query(collection(db, 'folders'), where('userId', '==', userId)));
        return snapshot.docs.map(d => d.data() as Folder).sort((a,b) => a.order - b.order);
    } catch (e) {
        throw e;
    }
};

export const saveFolder = async (folder: Folder, userId: string | null) => {
    if (!userId) {
        const folders: Folder[] = await loadFolders(null).catch(() => []);
        const idx = folders.findIndex(f => f.id === folder.id);
        if (idx >= 0) folders[idx] = folder; else folders.push(folder);
        sessionStorage.setItem(GUEST_FOLDERS_KEY, JSON.stringify(folders));
        return;
    }
    if (!db) return;
    // FORCE the userId for folder security
    await setDoc(doc(db, 'folders', folder.id), { ...folder, userId });
};

export const deleteFolder = async (folderId: string, userId: string | null) => {
    if (!userId) {
        const folders = await loadFolders(null).catch(() => []);
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
        const docRef = doc(db!, 'notes', note.id);
        batch.set(docRef, sanitizeForFirestore({ ...note, userId }));
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