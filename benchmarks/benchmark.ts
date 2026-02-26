
// Basic mock for sessionStorage
const sessionStorageMock = {
    store: {} as Record<string, string>,
    getItem(key: string) { return this.store[key] || null; },
    setItem(key: string, value: string) { this.store[key] = value; },
    removeItem(key: string) { delete this.store[key]; },
    clear() { this.store = {}; }
};
(global as any).sessionStorage = sessionStorageMock;
(global as any).window = {};
(global as any).document = {
    createElement: () => ({ setAttribute: () => {}, click: () => {} })
};

import { saveNote, loadNotes } from '../services/storageService';
import { Note, NoteColor } from '../types';

async function runBenchmark() {
    console.log("Starting benchmark...");

    // Setup: Create a base set of notes to simulate an existing session
    const initialNotesCount = 2000;
    const notes: Note[] = [];
    for (let i = 0; i < initialNotesCount; i++) {
        notes.push({
            id: `note-${i}`,
            title: `Note ${i}`,
            content: `This is the content of note ${i}. ` + "Lorem ipsum ".repeat(50),
            rawContent: `This is the content of note ${i}. ` + "Lorem ipsum ".repeat(50),
            createdAt: Date.now(),
            userId: undefined,
            folderId: undefined,
            tags: [],
            category: 'general',
            color: NoteColor.Blue,
            type: 'quick'
        });
    }

    // Pre-populate sessionStorage
    sessionStorage.setItem('ideaweaver_guest_session', JSON.stringify(notes));

    // Measure save operations
    const operationsCount = 50; // Reduced count but larger dataset
    const start = performance.now();

    for (let i = 0; i < operationsCount; i++) {
        // Pick a random note to update
        const noteIndex = Math.floor(Math.random() * initialNotesCount);
        const note = notes[noteIndex];

        // Simulate change
        note.content += ".";

        await saveNote(note, null);
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`Benchmark completed: ${operationsCount} save operations on ${initialNotesCount} existing notes.`);
    console.log(`Total time: ${duration.toFixed(2)} ms`);
    console.log(`Average time per save: ${(duration / operationsCount).toFixed(2)} ms`);
}

runBenchmark().catch(console.error);
