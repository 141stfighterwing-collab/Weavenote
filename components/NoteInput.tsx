import React, { useState, useRef } from 'react';
import { NoteType } from '../types';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: { manualProgress?: number, isCompleted?: boolean }) => Promise<void>;
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
  const [manualProgress, setManualProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const [selectedType, setSelectedType] = useState<NoteType>(initialActiveType);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    await onAddNote(rawSubmission, selectedType, [], [], useAI, title, selectedType === 'project' ? { 
        manualProgress, 
        isCompleted 
    } : undefined);
    
    setText(''); setCode(''); setTitle(''); setMilestones(''); setDeliverables(''); setTimeline(''); setManualProgress(0); setIsCompleted(false);
  };

  const applyFormat = (format: 'bold' | 'italic' | 'bullet' | 'checkbox') => {
    const textarea = mainTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.substring(start, end);
    let newText = '';
    let cursorOffset = 0;

    switch (format) {
      case 'bold':
        newText = text.substring(0, start) + `**${selected}**` + text.substring(end);
        cursorOffset = 2;
        break;
      case 'italic':
        newText = text.substring(0, start) + `*${selected}*` + text.substring(end);
        cursorOffset = 1;
        break;
      case 'bullet':
        newText = text.substring(0, start) + `\n- ${selected}` + text.substring(end);
        cursorOffset = 3;
        break;
      case 'checkbox':
        newText = text.substring(0, start) + `\n- [ ] ${selected}` + text.substring(end);
        cursorOffset = 7;
        break;
    }

    setText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(end + cursorOffset, end + cursorOffset);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const textarea = mainTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = text.substring(0, start) + emoji + text.substring(end);
    setText(newText);
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
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

  const isDisabled = (!text.trim() && !code.trim() && !title.trim()) || isProcessing;

  if (readOnly) return <div className="p-6 text-center border-dashed border rounded-xl text-slate-400">🔒 Read Only</div>;

  return (
    <div className={`rounded-xl shadow-lg border p-1 mb-8 transition-all ${getBackgroundColor()}`}>
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar">
            {(['quick', 'deep', 'code', 'project', 'contact', 'document'] as NoteType[]).map(type => (
                <button key={type} onClick={() => setSelectedType(type)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all min-w-[70px] ${selectedType === type ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}>
                    <span className="capitalize">{type}</span>
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selectedType === 'project' ? "Project Name..." : "Title (optional)"} className="w-full px-4 py-3 bg-transparent border-b border-slate-100 dark:border-slate-700 focus:outline-none font-bold text-lg text-slate-800 dark:text-white" />

        {/* Formatting Toolbar */}
        {selectedType !== 'project' && (
          <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 overflow-x-auto no-scrollbar">
              <button onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs font-bold" title="Bold">B</button>
              <button onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs italic" title="Italic">I</button>
              <button onClick={() => applyFormat('bullet')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs" title="Bullet List">• List</button>
              <button onClick={() => applyFormat('checkbox')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs" title="Checkbox">[ ] Task</button>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
              {['✨', '🔥', '✅', '❌', '📅', '🚀', '💡'].map(emoji => (
                <button key={emoji} onClick={() => insertEmoji(emoji)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-sm">{emoji}</button>
              ))}
          </div>
        )}

        <div className="flex flex-col">
            {selectedType === 'project' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">📦 Deliverables</label>
                            <input value={deliverables} onChange={e => setDeliverables(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500" placeholder="UI Mockups, Backend API, Docs..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400">📅 Timeline & Estimates</label>
                            <input value={timeline} onChange={e => setTimeline(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500" placeholder="3 weeks, Start Q1..." />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold uppercase text-slate-400">📊 Manual Progress</label>
                                <span className="text-[10px] font-mono font-bold text-primary-600">{manualProgress}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={manualProgress} 
                                onChange={(e) => setManualProgress(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                            />
                        </div>
                        <div className="flex items-center gap-2 py-1">
                            <input 
                                type="checkbox" 
                                id="isCompleted" 
                                checked={isCompleted} 
                                onChange={(e) => setIsCompleted(e.target.checked)}
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                            />
                            <label htmlFor="isCompleted" className="text-xs font-bold text-slate-600 dark:text-slate-400">Mark as Completed</label>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase text-slate-400">🏁 Milestones (one per line)</label>
                        <textarea value={milestones} onChange={e => setMilestones(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm h-20 resize-none mb-2 outline-none focus:ring-1 focus:ring-primary-500" placeholder="1. Kickoff meeting&#10;2. Design approval..." />
                        
                        <label className="text-[10px] font-bold uppercase text-slate-400">📝 Detailed Project Context</label>
                        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Explain project goals..." className="flex-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-sm min-h-[60px] resize-none outline-none focus:ring-1 focus:ring-primary-500" />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row">
                    <div className={`flex-1 ${selectedType === 'code' ? 'md:border-r border-slate-100 dark:border-slate-700' : ''}`}>
                        <textarea 
                          ref={mainTextareaRef}
                          value={text} 
                          onChange={(e) => setText(e.target.value)} 
                          placeholder="Type your notes here... Paste structured lists or code blocks freely." 
                          className="w-full h-56 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap" 
                        />
                    </div>
                    {selectedType === 'code' && (
                        <div className="flex-1 bg-slate-950 dark:bg-black/40">
                            <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the actual code snippet here for specialized handling..." className="w-full h-56 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-indigo-300 font-mono text-xs whitespace-pre" />
                        </div>
                    )}
                </div>
            )}
        </div>
        
        <div className="flex items-center justify-between p-3 border-t dark:border-slate-700">
            <div className="text-[10px] text-slate-400 px-2 italic">Copy/Paste preserves structural spacing.</div>
            <div className="flex gap-2">
                <button type="button" onClick={() => handleAction(false)} disabled={isDisabled} className="px-4 py-1.5 rounded-full font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors">Add</button>
                <button type="button" onClick={() => handleAction(true)} disabled={isDisabled || isProcessing} className="px-4 py-1.5 rounded-full font-bold text-sm bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50">
                  {isProcessing ? '✨ Organizing...' : '✨ AI Organize'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;