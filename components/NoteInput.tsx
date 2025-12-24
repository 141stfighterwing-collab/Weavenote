import React, { useState, useRef } from 'react';
import { NoteType, ProjectMilestone } from '../types';
import { parseDocument } from '../services/documentParser';
import { cleanAndFormatIngestedText } from '../services/geminiService';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: { 
    manualProgress?: number, 
    isCompleted?: boolean,
    manualObjectives?: string[],
    manualDeliverables?: string[],
    manualMilestones?: ProjectMilestone[]
  }) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  isGuest?: boolean;
  enableImages?: boolean;
}

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false, isGuest = true 
}) => {
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [projectProgress, setProjectProgress] = useState(0);
  const [projectCompleted, setProjectCompleted] = useState(false);
  const [objectives, setObjectives] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [milestoneLabel, setMilestoneLabel] = useState('');

  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateInput = () => {
    if (title.length > 200) return "Title too long (max 200).";
    if (text.length > 10000) return "Content too long (max 10000).";
    if (code.length > 15000) return "Code block too large.";
    return null;
  };

  const handleAction = async (useAI: boolean) => {
    if (useAI && isGuest) return; // Guard for guest AI usage

    const error = validateInput();
    if (error) {
      setValidationError(error);
      setTimeout(() => setValidationError(null), 3000);
      return;
    }

    let rawSubmission = text;
    if (activeType === 'code' && code.trim()) {
        rawSubmission = `${text}\n\n### Script/Code\n\`\`\`\n${code}\n\`\`\``;
    }
    if (!rawSubmission.trim() && !title.trim() && !objectives.trim()) return;
    
    const extraData = activeType === 'project' ? { 
        manualProgress: projectProgress, 
        isCompleted: projectCompleted,
        manualObjectives: objectives.split('\n').filter(l => l.trim()),
        manualDeliverables: deliverables.split('\n').filter(l => l.trim()),
        manualMilestones: milestoneLabel ? [{ label: milestoneLabel, date: new Date().toISOString().split('T')[0], status: 'pending' as const }] : []
    } : undefined;

    await onAddNote(rawSubmission, activeType, [], [], useAI, title, extraData);
    
    setText(''); setCode(''); setTitle('');
    setProjectProgress(0); setProjectCompleted(false);
    setObjectives(''); setDeliverables(''); setMilestoneLabel('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingDoc(true);
    let rawText = "";
    try {
      rawText = await parseDocument(file);
      // Document ingestion with AI is also restricted to logged-in users
      if (!isGuest) {
        const cleaned = await cleanAndFormatIngestedText(rawText, file.name, "User"); 
        setTitle(cleaned.title || file.name.split('.')[0]);
        setText(cleaned.formattedContent);
      } else {
        setTitle(file.name.split('.')[0]);
        setText(rawText);
      }
    } catch (err: any) {
      console.error("Ingestion Error:", err);
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

  const isDisabled = (!text.trim() && !code.trim() && !title.trim() && !objectives.trim()) || isProcessing || isParsingDoc;

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

        <div className="flex flex-col md:flex-row">
            <div className={`flex-1 ${activeType === 'code' ? 'md:border-r border-slate-100 dark:border-slate-700' : ''}`}>
                <textarea 
                  ref={mainTextareaRef}
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder="Draft your entry here..." 
                  className="w-full h-40 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap" 
                />
            </div>
            {activeType === 'code' && (
                <div className="flex-1 bg-slate-950 dark:bg-black/40">
                    <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the actual code snippet here..." className="w-full h-40 p-4 bg-transparent border-0 focus:ring-0 outline-none resize-none text-indigo-300 font-mono text-xs whitespace-pre" />
                </div>
            )}
        </div>

        {validationError && (
          <div className="px-4 py-2 bg-red-100 text-red-600 text-xs font-bold animate-pulse">
            ⚠️ {validationError}
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 border-t dark:border-slate-700">
            <div className="text-[10px] text-slate-400 px-2 italic uppercase font-black tracking-widest">{activeType} mode</div>
            <div className="flex gap-2">
                <button type="button" onClick={() => handleAction(false)} disabled={isDisabled} className="px-4 py-1.5 rounded-full font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors">Add</button>
                <button 
                  type="button" 
                  onClick={() => handleAction(true)} 
                  disabled={isDisabled || isProcessing || isGuest} 
                  className={`px-4 py-1.5 rounded-full font-bold text-sm transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 shadow-md hover:shadow-lg ${isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white'}`}
                  title={isGuest ? "Login required for AI features" : "AI Organize"}
                >
                  {isProcessing ? '✨ Organizing...' : isGuest ? '✨ AI (Login)' : '✨ AI Organize'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;