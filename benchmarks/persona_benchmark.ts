import { Note, NoteColor } from '../types';

function computePersonaOld(notes: Note[]) {
    const allTags = notes.flatMap(n => n.tags.map(t => t.toLowerCase()));
    const personas = [
        { id: 'cyber', title: "Cybersecurity Specialist", emoji: "🛡️", description: "Securing networks and hunting threats.", color: "bg-slate-800 text-green-400 border-green-500", keywords: ['security', 'cyber', 'hack', 'firewall', 'auth', 'token', 'exploit', 'vuln', 'cve', 'pentest', 'crypto', 'phish', 'malware'] },
        { id: 'dev', title: "Code Wizard", emoji: "💻", description: "Turning coffee into code and fixing bugs.", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", keywords: ['code', 'dev', 'git', 'api', 'bug', 'react', 'js', 'ts', 'python', 'java', 'html', 'css', 'frontend', 'backend', 'fullstack', 'deploy', 'repo'] }
    ];
    let bestMatch = null, maxScore = 0;
    personas.forEach(p => { const score = allTags.filter(t => p.keywords.some(k => t.includes(k))).length; if (score > maxScore) { maxScore = score; bestMatch = p; } });
    if (bestMatch && maxScore > 0) return { title: (bestMatch as any).title, emoji: (bestMatch as any).emoji, description: (bestMatch as any).description, color: (bestMatch as any).color };
    return { title: "The Idea Weaver", emoji: "🕸️", description: "Spinning a web of diverse thoughts.", color: "bg-primary-100 text-primary-800" };
}

function computePersonaNew(notes: Note[]) {
    const tagCounts: Record<string, number> = {};
    for (let i = 0; i < notes.length; i++) {
        const tags = notes[i].tags;
        for (let j = 0; j < tags.length; j++) {
            const lower = tags[j].toLowerCase();
            tagCounts[lower] = (tagCounts[lower] || 0) + 1;
        }
    }

    const personas = [
        { id: 'cyber', title: "Cybersecurity Specialist", emoji: "🛡️", description: "Securing networks and hunting threats.", color: "bg-slate-800 text-green-400 border-green-500", keywords: ['security', 'cyber', 'hack', 'firewall', 'auth', 'token', 'exploit', 'vuln', 'cve', 'pentest', 'crypto', 'phish', 'malware'] },
        { id: 'dev', title: "Code Wizard", emoji: "💻", description: "Turning coffee into code and fixing bugs.", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", keywords: ['code', 'dev', 'git', 'api', 'bug', 'react', 'js', 'ts', 'python', 'java', 'html', 'css', 'frontend', 'backend', 'fullstack', 'deploy', 'repo'] }
    ];

    let bestMatch = null, maxScore = 0;
    for (let i = 0; i < personas.length; i++) {
        const p = personas[i];
        let score = 0;
        const entries = Object.entries(tagCounts);
        for (let j = 0; j < entries.length; j++) {
            const tag = entries[j][0];
            const count = entries[j][1];
            for (let k = 0; k < p.keywords.length; k++) {
                if (tag.includes(p.keywords[k])) {
                    score += count;
                    break; // stop checking other keywords for this tag
                }
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = p;
        }
    }

    if (bestMatch && maxScore > 0) return { title: (bestMatch as any).title, emoji: (bestMatch as any).emoji, description: (bestMatch as any).description, color: (bestMatch as any).color };
    return { title: "The Idea Weaver", emoji: "🕸️", description: "Spinning a web of diverse thoughts.", color: "bg-primary-100 text-primary-800" };
}

async function runBenchmark() {
    const initialNotesCount = 20000;
    const notes: Note[] = [];
    const tagPool = ['security', 'react', 'python', 'general', 'personal', 'cyber', 'code', 'frontend', 'hack', 'firewall', 'css', 'html', 'js', 'ts', 'java', 'auth', 'token', 'exploit', 'vuln', 'cve', 'pentest', 'crypto', 'phish', 'malware', 'git', 'api', 'bug', 'backend', 'fullstack', 'deploy', 'repo'];

    for (let i = 0; i < initialNotesCount; i++) {
        const numTags = Math.floor(Math.random() * 10) + 1;
        const tags = [];
        for (let j = 0; j < numTags; j++) {
            tags.push(tagPool[Math.floor(Math.random() * tagPool.length)]);
        }

        notes.push({
            id: `note-${i}`,
            title: `Note ${i}`,
            content: "",
            rawContent: "",
            createdAt: Date.now(),
            userId: undefined,
            folderId: undefined,
            tags: tags,
            category: 'general',
            color: NoteColor.Blue,
            type: 'quick'
        });
    }

    // Warmup
    computePersonaOld(notes);
    computePersonaNew(notes);

    const iters = 100;

    let start = performance.now();
    for (let i = 0; i < iters; i++) {
        computePersonaOld(notes);
    }
    let end = performance.now();
    console.log(`Old: ${(end - start).toFixed(2)} ms total, ${((end - start) / iters).toFixed(2)} ms per iter`);

    start = performance.now();
    for (let i = 0; i < iters; i++) {
        computePersonaNew(notes);
    }
    end = performance.now();
    console.log(`New: ${(end - start).toFixed(2)} ms total, ${((end - start) / iters).toFixed(2)} ms per iter`);
}

runBenchmark().catch(console.error);