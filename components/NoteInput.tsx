import React, { useState, useRef } from 'react';
import { NoteType } from '../types';
import { parseDocument } from '../services/documentParser';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string) => Promise<void>;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  enableImages?: boolean;
}

const NoteInput: React.FC<NoteInputProps> = ({ onAddNote, isProcessing, activeType: initialActiveType, readOnly = false }) => {
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  
  // Project specific states
  const [milestones, setMilestones] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [timeline, setTimeline] = useState('');
  
  const [selectedType, setSelectedType] = useState<NoteType>(initialActiveType);
  const [isParsing, setIsParsing] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => { setSelectedType(initialActiveType); }, [initialActiveType]);

  const handleAction = async (useAI: boolean) => {
    let rawSubmission = text;
    
    if (selectedType === 'code' && code.trim()) {
        rawSubmission = `${text}\n\n### Script/Code\n\`\`\`\n${code}\n\`\`\``;
    } else if (selectedType === 'project') {
        rawSubmission = `
# PROJECT PLAN
TITLE: ${title}
DELIVERABLES: ${deliverables}
MILESTONES:
${milestones}
TIMELINE: ${timeline}

## DETAILS
${text}`;
    }

    if (!rawSubmission.trim() && !title.trim()) return;
    await onAddNote(rawSubmission, selectedType, [], [], useAI, title);
    setText(''); setCode(''); setTitle(''); setMilestones(''); setDeliverables(''); setTimeline('');
  };

  const getBackgroundColor = () => {
      switch (selectedType) {
          case 'quick': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10';
          case 'deep': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10';
          case 'code': return 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10';
          case 'project': return 'bg-green-50 border-green-200 dark:bg-green-900/10';
          default: return 'bg-slate-50 border-slate-200';
      }
  };

  const isDisabled = (!text.trim() && !code.trim() && !title.trim()) || isProcessing || isParsing;

  if (readOnly) return <div className="p-6 text-center border-dashed border rounded-xl">🔒 Read Only</div>;

  return (
    <div className={`rounded-xl shadow-lg border p-1 mb-8 transition-all ${getBackgroundColor()}`}>
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar">
            {(['quick', 'deep', 'code', 'project', 'contact', 'document'] as NoteType[]).map(type => (
                <button key={type} onClick={() => setSelectedType(type)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-w-[70px] ${selectedType === type ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500'}`}>
                    <span className="capitalize">{type}</span>
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selectedType === 'project' ? "Project Name..." : "Title (optional)"} className="w-full px-4 py-3 bg-transparent border-b border-slate-100 dark:border-slate-700 focus:outline-none font-bold text-lg text-slate-800 dark:text-white" />

        <div className="flex flex-col">
            {selectedType === 'project' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">📦 Deliverables</label>
                            <input value={deliverables} onChange={e => setDeliverables(e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="UI Mockups, Backend API, Docs..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">📅 Timeline & Estimates</label>
                            <input value={timeline} onChange={e => setTimeline(e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1.5 text-sm" placeholder="3 weeks, Start Q1..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">🏁 Milestones (one per line)</label>
                            <textarea value={milestones} onChange={e => setMilestones(e.target.value)} className="w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1.5 text-sm h-24 resize-none" placeholder="1. Kickoff meeting&#10;2. Design approval&#10;3. Final testing..." />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase text-slate-400">📝 Detailed Project Context</label>
                        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Explain the project goal, constraints, and other specific details..." className="flex-1 w-full bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1.5 text-sm h-full resize-none" />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row">
                    <div className={`flex-1 ${selectedType === 'code' ? 'md:border-r dark:border-slate-700' : ''}`}>
                        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your notes here..." className="w-full h-40 p-4 bg-transparent border-0 focus:ring-0 resize-none text-slate-700 dark:text-slate-200 text-sm" />
                    </div>
                    {selectedType === 'code' && (
                        <div className="flex-1 bg-slate-950 dark:bg-black/40">
                            <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste code here..." className="w-full h-40 p-4 bg-transparent border-0 focus:ring-0 resize-none text-indigo-300 font-mono text-xs" />
                        </div>
                    )}
                </div>
            )}
        </div>
        
        <div className="flex items-center justify-between p-3 border-t dark:border-slate-700">
            <div className="text-[10px] text-slate-400 px-2 italic">Format: Markdown Supported</div>
            <div className="flex gap-2">
                <button type="button" onClick={() => handleAction(false)} disabled={isDisabled} className="px-4 py-1.5 rounded-full font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200">Add</button>
                <button type="button" onClick={() => handleAction(true)} disabled={isDisabled} className="px-4 py-1.5 rounded-full font-bold text-sm bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md">✨ AI Organize</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;