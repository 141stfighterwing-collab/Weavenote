import React, { useState, useRef } from 'react';
import { NoteType } from '../types';
import { parseDocument } from '../services/documentParser';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: { manualProgress?: number, isCompleted?: boolean }) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  enableImages?: boolean;
}

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false 
}) => {
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  
  // Project-specific manual state
  const [projectProgress, setProjectProgress] = useState(0);
  const [projectCompleted, setProjectCompleted] = useState(false);

  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAction = async (useAI: boolean) => {
    let rawSubmission = text;
    if (activeType === 'code' && code.trim()) {
        rawSubmission = `${text}\n\n### Script/Code\n\`\`\`\n${code}\n\`\`\``;
    }
    if (!rawSubmission.trim() && !title.trim()) return;
    
    const extraData = activeType === 'project' ? { 
        manualProgress: projectProgress, 
        isCompleted: projectCompleted 
    } : undefined;

    await onAddNote(rawSubmission, activeType, [], [], useAI, title, extraData);
    
    setText(''); setCode(''); setTitle('');
    setProjectProgress(0); setProjectCompleted(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    try {
      const parsedText = await parseDocument(file);
      setText(prev => (prev ? prev + '\n\n' : '') + parsedText);
      if (!title) setTitle(file.name.split('.')[0]);
    } catch (err: any) {
      alert(err.message || "Failed to parse document");
    } finally {
      setIsParsingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
      case 'bold': newText = text.substring(0, start) + `**${selected}**` + text.substring(end); cursorOffset = 2; break;
      case 'italic': newText = text.substring(0, start) + `*${selected}*` + text.substring(end); cursorOffset = 1; break;
      case 'bullet': newText = text.substring(0, start) + `\n- ${selected}` + text.substring(end); cursorOffset = 3; break;
      case 'checkbox': newText = text.substring(0, start) + `\n- [ ] ${selected}` + text.substring(end); cursorOffset = 7; break;
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
    setText(text.substring(0, start) + emoji + text.substring(end));
  };

  const getBackgroundColor = () => {
      switch (activeType) {
          case 'quick': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10';
          case 'notebook': return 'bg-slate-50 border-slate-300 dark:bg-slate-900/10';
          case 'deep': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10';
          case 'code': return 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10';
          case 'project': return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10';
          case 'document': return 'bg-slate-100 border-slate-300 dark:bg-slate-800/50';
          default: return 'bg-slate-50 border-slate-200';
      }
  };

  const isDisabled = (!text.trim() && !code.trim() && !title.trim()) || isProcessing || isParsingDoc;

  if (readOnly) return <div className="p-6 text-center border-dashed border rounded-xl text-slate-400">🔒 Read Only</div>;

  return (
    <div className={`rounded-xl shadow-lg border p-1 mb-8 transition-all duration-300 ${getBackgroundColor()}`}>
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'contact', 'document'] as NoteType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => onTypeChange?.(type)} 
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition-all min-w-[70px] uppercase tracking-tight ${activeType === type ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-white/40 dark:hover:bg-slate-800/40'}`}
                >
                    {type}
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-1">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="w-full px-4 py-3 bg-transparent border-b border-slate-100 dark:border-slate-700 focus:outline-none font-bold text-lg text-slate-800 dark:text-white" />

        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 overflow-x-auto no-scrollbar">
            <button onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs font-bold" title="Bold">B</button>
            <button onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs italic" title="Italic">I</button>
            <button onClick={() => applyFormat('bullet')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs" title="Bullet List">• List</button>
            <button onClick={() => applyFormat('checkbox')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-xs" title="Checkbox">[ ] Task</button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            {['✨', '🔥', '✅', '🚀', '💡'].map(emoji => (
                <button key={emoji} onClick={() => insertEmoji(emoji)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-sm">{emoji}</button>
            ))}
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isParsingDoc}
              className="px-2 py-1 text-[10px] font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded flex items-center gap-1 transition-colors"
            >
              {isParsingDoc ? '⌛ Parsing...' : '📄 Ingest Document'}
            </button>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,.txt,.md" 
              className="hidden" 
              onChange={handleFileUpload}
            />
        </div>

        {activeType === 'project' && (
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center">
             <div className="flex-1 min-w-[200px]">
                <div className="flex justify-between mb-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Current Progress</label>
                   <span className="text-xs font-bold">{projectProgress}%</span>
                </div>
                <input 
                    type="range" min="0" max="100" value={projectProgress} 
                    onChange={(e) => setProjectProgress(parseInt(e.target.value))}
                    className="w-full h-1 bg-emerald-200 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
             </div>
             <button 
                type="button"
                onClick={() => setProjectCompleted(!projectCompleted)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${projectCompleted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
             >
                {projectCompleted ? '✓ Completed' : 'Mark as Completed'}
             </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row">
            <div className={`flex-1 ${activeType === 'code' ? 'md:border-r border-slate-100 dark:border-slate-700' : ''}`}>
                <textarea 
                  ref={mainTextareaRef}
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder={activeType === 'project' ? "Outline your project goals, milestones, or paste a rough plan..." : activeType === 'notebook' ? "Draft your entry here..." : "Type your notes here or upload a document..."} 
                  className="w-full h-56 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap" 
                />
            </div>
            {activeType === 'code' && (
                <div className="flex-1 bg-slate-950 dark:bg-black/40">
                    <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the actual code snippet here..." className="w-full h-56 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-indigo-300 font-mono text-xs whitespace-pre" />
                </div>
            )}
        </div>
        
        <div className="flex items-center justify-between p-3 border-t dark:border-slate-700">
            <div className="text-[10px] text-slate-400 px-2 italic uppercase font-black tracking-widest">{activeType} mode</div>
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