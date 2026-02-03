import React, { useState, useRef, useEffect } from 'react';
import { NoteType, ProjectMilestone } from '../types';
import { parseDocument } from '../services/documentParser';
import { cleanAndFormatIngestedText } from '../services/geminiService';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: { 
    manualProgress?: number, 
    isCompleted?: boolean,
    manualObjectives?: { label: string, status: 'pending' | 'completed' }[],
    manualDeliverables?: { label: string, status: 'pending' | 'completed' }[],
    manualMilestones?: ProjectMilestone[]
  }) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  isGuest?: boolean;
  enableImages?: boolean;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false, isGuest = true 
}) => {
  const [title, setTitle] = useState('');
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [codeSnippet, setCodeSnippet] = useState('');

  // Project Engine State
  const [projectProgress, setProjectProgress] = useState(0);
  const [objectives, setObjectives] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [milestoneLabel, setMilestoneLabel] = useState('');

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const execCommand = (command: string, value: string = '') => {
    if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
    }
  };

  const insertCheckbox = () => {
    if (editorRef.current) {
        editorRef.current.focus();
        // Insert a markdown task list item
        document.execCommand('insertHTML', false, '<div>- [ ] &nbsp;</div>');
    }
  };

  const handleAction = async (useAI: boolean) => {
    if (useAI && isGuest) return; 

    let content = editorRef.current?.innerHTML || '';
    if (!content.trim() && !title.trim() && !objectives.trim() && !codeSnippet.trim()) return;
    
    if (activeType === 'code' && codeSnippet.trim()) {
      content += `\n\n\`\`\`\n${codeSnippet}\n\`\`\``;
    }

    const extraData = activeType === 'project' ? { 
        manualProgress: projectProgress, 
        isCompleted: projectProgress === 100,
        manualObjectives: objectives.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        manualDeliverables: deliverables.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        manualMilestones: milestoneLabel ? [{ label: milestoneLabel, date: new Date().toISOString().split('T')[0], status: 'pending' as const }] : []
    } : undefined;

    await onAddNote(content, activeType, [], [], useAI, title, extraData);
    
    if (editorRef.current) editorRef.current.innerHTML = '';
    setTitle(''); setProjectProgress(0); setObjectives(''); setDeliverables(''); setMilestoneLabel(''); setCodeSnippet('');
  };

  const getBackgroundColor = () => {
      switch (activeType) {
          case 'quick': return 'bg-yellow-50/80 border-yellow-200 dark:bg-yellow-900/10';
          case 'code': return 'bg-indigo-50/80 border-indigo-200 dark:bg-indigo-900/10';
          case 'project': return 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-900/10';
          default: return 'bg-slate-50 border-slate-200 dark:bg-slate-800/40';
      }
  };

  return (
    <div className={`rounded-xl shadow-lg border p-1 mb-8 transition-all duration-300 ${getBackgroundColor()}`}>
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'contact', 'document'] as NoteType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => onTypeChange?.(type)} 
                  className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all min-w-[70px] uppercase tracking-widest ${activeType === type ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600 border border-slate-100 dark:border-slate-700' : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}
                >
                    {type}
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
        <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-700 pr-2">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={activeType === 'project' ? "Project Name" : "Title (optional)"} className="flex-1 px-4 py-3 bg-transparent focus:outline-none font-bold text-lg text-slate-800 dark:text-white" />
            {activeType === 'document' && (
              <button onClick={() => fileInputRef.current?.click()} disabled={isParsingDoc} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                {isParsingDoc ? '⌛ Ingesting...' : '📎 Upload Docs'}
              </button>
            )}
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.txt,.md" multiple onChange={async (e) => {
                 const files = e.target.files;
                 if (!files) return;
                 setIsParsingDoc(true);
                 try {
                   for (const file of Array.from(files) as File[]) {
                     const raw = await parseDocument(file);
                     await onAddNote(raw, 'document', [], [], !isGuest, file.name);
                   }
                 } finally { setIsParsingDoc(false); }
            }} />
        </div>

        {activeType === 'project' && (
            <div className="p-4 bg-emerald-50/30 dark:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Project Health ({projectProgress}%)</label>
                            <input type="range" min="0" max="100" value={projectProgress} onChange={(e) => setProjectProgress(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Primary Objectives</label>
                            <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="One per line..." className="w-full h-24 p-3 text-xs border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 resize-none" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Next Milestone</label>
                            <input type="text" placeholder="e.g. Beta Release" value={milestoneLabel} onChange={(e) => setMilestoneLabel(e.target.value)} className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-700" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Final Deliverables</label>
                            <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} placeholder="One per line..." className="w-full h-24 p-3 text-xs border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-700 resize-none" />
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50/80 dark:bg-slate-900/50 border-b dark:border-slate-700 overflow-x-auto no-scrollbar">
            <select onChange={(e) => execCommand('fontName', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none max-w-[90px]">
                <option value="">Font</option>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select onChange={(e) => execCommand('fontSize', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none">
                <option value="">Size</option>
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            <button onClick={() => execCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded font-black text-xs px-2.5">B</button>
            <button onClick={() => execCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded italic text-xs px-2.5">/</button>
            <button onClick={() => execCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded underline text-xs px-2.5">U</button>
            <button onClick={() => execCommand('strikeThrough')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded line-through text-xs px-2.5">S</button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
            <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-bold px-2 uppercase tracking-tighter">Bullet</button>
            <button onClick={insertCheckbox} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-bold px-2 uppercase tracking-tighter flex items-center gap-1">Task</button>
            <button onClick={() => execCommand('indent')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded px-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M17 10l5 5-5 5M3 6h18M3 12h10M3 18h18"/></svg>
            </button>
        </div>

        <div className={`transition-all duration-300 ${activeType === 'code' ? 'min-h-[120px]' : 'min-h-[200px]'}`}>
            <div 
              ref={editorRef}
              contentEditable
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    execCommand('indent');
                }
              }}
              className={`w-full p-6 focus:outline-none text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap font-sans leading-relaxed empty:before:content-[attr(placeholder)] empty:before:text-slate-400 ${activeType === 'code' ? 'min-h-[120px]' : 'min-h-[200px]'}`}
              placeholder={activeType === 'code' ? "Add a description for this code snippet..." : "Start typing your ideas here... Styles apply in real-time."}
            />
        </div>

        {activeType === 'code' && (
          <div className="p-4 mx-2 mb-2 bg-slate-900 rounded-xl border border-slate-700 shadow-inner group transition-all focus-within:ring-2 focus-within:ring-indigo-500/50">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Example Code Block</label>
            <textarea
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              placeholder="Paste your example code here..."
              className="w-full h-48 bg-transparent text-indigo-300 font-mono text-xs outline-none resize-none custom-scrollbar placeholder:opacity-20"
            />
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 border-t dark:border-slate-700">
            <div className="flex items-center gap-3">
                <div className="text-[9px] text-slate-400 italic uppercase font-black tracking-widest">Tags generated by AI in background</div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleAction(false)} disabled={isProcessing} className="px-5 py-1.5 rounded-full font-bold text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 transition-colors uppercase tracking-widest">Add</button>
                <button 
                  onClick={() => handleAction(true)} 
                  disabled={isProcessing || isGuest} 
                  className={`px-5 py-1.5 rounded-full font-bold text-xs transition-all transform hover:-translate-y-0.5 shadow-md uppercase tracking-widest ${isGuest ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white'}`}
                >
                  {isProcessing ? '✨ Organizing...' : '✨ AI Neural'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;