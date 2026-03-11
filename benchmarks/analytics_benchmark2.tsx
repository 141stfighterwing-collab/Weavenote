import React from 'react';
import AnalyticsModal from '../components/AnalyticsModal';
import { Note, NoteColor } from '../types';
import { render } from '@testing-library/react';
import { JSDOM } from 'jsdom';

// Basic mock
const sessionStorageMock = {
    store: {} as Record<string, string>,
    getItem(key: string) { return this.store[key] || null; },
    setItem(key: string, value: string) { this.store[key] = value; },
    removeItem(key: string) { delete this.store[key]; },
    clear() { this.store = {}; }
};
(global as any).sessionStorage = sessionStorageMock;
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).localStorage = sessionStorageMock;

async function runBenchmark(useWordCount: boolean) {
    console.log(`Starting benchmark (useWordCount=${useWordCount})...`);

    // Setup: Create a base set of notes to simulate an existing session
    const initialNotesCount = 2000;
    const notes: Note[] = [];
    const tagPool = ['security', 'react', 'python', 'general', 'personal', 'cyber', 'code', 'frontend', 'hack', 'firewall', 'css', 'html', 'js', 'ts', 'java'];

    for (let i = 0; i < initialNotesCount; i++) {
        const rawContent = `This is the content of note ${i}. ` + "Lorem ipsum ".repeat(50);

        // Add random tags
        const numTags = Math.floor(Math.random() * 5) + 1;
        const tags = [];
        for (let j = 0; j < numTags; j++) {
            tags.push(tagPool[Math.floor(Math.random() * tagPool.length)]);
        }

        notes.push({
            id: `note-${i}`,
            title: `Note ${i}`,
            content: rawContent,
            rawContent: rawContent,
            createdAt: Date.now(),
            userId: undefined,
            folderId: undefined,
            tags: tags,
            category: 'general',
            color: NoteColor.Blue,
            type: 'quick',
            ...(useWordCount ? { wordCount: rawContent.trim().split(/\s+/).filter(Boolean).length } : {})
        });
    }

    const start = performance.now();

    for (let i = 0; i < 50; i++) {
        render(<AnalyticsModal notes={notes} isOpen={true} onClose={() => {}} />);
    }

    const end = performance.now();
    const duration = end - start;

    console.log(`Total time: ${duration.toFixed(2)} ms`);
    console.log(`Average time per render: ${(duration / 50).toFixed(2)} ms\n`);
}

async function main() {
    await runBenchmark(false);
}

main().catch(console.error);