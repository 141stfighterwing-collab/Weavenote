import React, { useState, useRef, useEffect } from 'react';
import { NoteType, NoteColor, ProjectData } from '../types';
import { parseDocument } from '../services/documentParser';
import { getTagStyle } from './NoteCard';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: any, onStepUpdate?: (step: string) => void) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  isGuest?: boolean;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];
const EMOJIS = ["✨", "🚀", "💡", "📝", "✅", "🔥", "🛠️", "🎯", "📊", "🧠", "💻", "🎨", "📅", "📌", "🔒", "⚠️"];
const COLORS = ["#000000", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef"];
const BG_COLORS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#e9d5ff", "#fed7aa", "#cbd5e1"];

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false, isGuest = true 
}) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aiStep, setAiStep] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);

  // Project Engineering States
  const [projectGoals, setProjectGoals] = useState('');
  const [projectObjectives, setProjectObjectives] = useState('');
  const [projectDeliverables, setProjectDeliverables] = useState('');
  const [projectProgress, setProjectProgress] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Enable object resizing in the contentEditable areas
    document.execCommand('enableObjectResizing', false, 'true');
  }, []);

  const execCommand = (command: string, value: string = '') => {
    if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result;
                execCommand('insertImage', base64 as string);
            };
            if (blob) reader.readAsDataURL(blob);
        }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIngesting(true);
    setAiStep(`Ingesting ${file.name}...`);
    try {
        const text = await parseDocument(file);
        if (editorRef.current) {
            editorRef.current.innerHTML += `<div style="background:rgba(0,0,0,0.05); padding:15px; border-radius:12px; border:1px dashed rgba(0,0,0,0.1); margin-top:10px;"><strong>Document: ${file.name}</strong><br/>${text}</div>`;
        }
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsIngesting(false);
        setAiStep(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAction = async (useAI: boolean) => {
    let content = editorRef.current?.innerHTML || '';
    let code = codeEditorRef.current?.innerText || '';
    
    if (activeType === 'code' && code.trim()) {
        content = `${content}\n\n\`\`\`\n${code}\n\`\`\``;
    }

    if (!content.trim() && !title.trim() && !projectGoals) return;
    
    if (useAI) setAiStep("Neural Synthesis...");

    const extraProjectData = activeType === 'project' ? {
        manualProgress: projectProgress,
        manualObjectives: projectObjectives.split('\n').filter(o => o.trim()).map(o => ({ label: o, status: 'pending' })),
        manualDeliverables: projectDeliverables.split('\n').filter(d => d.trim()).map(d => ({ label: d, status: 'pending' })),
        isCompleted: projectProgress === 100
    } : undefined;
    
    await onAddNote(content, activeType, [], tags, useAI, title, extraProjectData, setAiStep);
    
    // Reset Workspace
    if (editorRef.current) editorRef.current.innerHTML = '';
    if (codeEditorRef.current) codeEditorRef.current.innerHTML = '';
    setTitle(''); setTags([]); setAiStep(null);
    setProjectGoals(''); setProjectObjectives(''); setProjectDeliverables(''); setProjectProgress(0);
  };

  return (
    <div className="rounded-2xl shadow-2xl border p-1 mb-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-all duration-300 ring-4 ring-black/5 overflow-visible">
        {/* Workspace Tab Navigator */}
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => (
                <button 
                    key={type} 
                    onClick={() => onTypeChange?.(type)} 
                    className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all min-w-[85px] uppercase tracking-widest ${activeType === type ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                    {type}
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-1">
        <div className="flex items-center justify-between border-b dark:border-slate-700">
            <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder={activeType === 'project' ? "Project Identity Title..." : "Title of this Idea block..."} 
                className="flex-1 px-5 py-4 bg-transparent focus:outline-none font-bold text-lg text-slate-800 dark:text-white" 
            />
        </div>

        {/* WORKSPACE TOOLBAR */}
        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 relative">
            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1">
                <select onChange={(e) => execCommand('fontName', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none max-w-[85px]">
                    <option value="">Font</option>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select onChange={(e) => execCommand('fontSize', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none">
                    <option value="">Size</option>
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1">
                <button onClick={() => execCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded font-black text-xs px-2.5">B</button>
                <button onClick={() => execCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded italic text-xs px-2.5">/</button>
                <button onClick={() => execCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded underline text-xs px-2.5">U</button>
            </div>

            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1">
                <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2 uppercase">Bullet</button>
                <button onClick={() => execCommand('insertText', '- [ ] ')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2 uppercase text-primary-600">Task</button>
            </div>

            <div className="flex gap-1 items-center relative">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md" />
                <button onClick={() => fileInputRef.current?.click()} className={`p-1.5 rounded flex items-center gap-2 px-3 text-[10px] font-black uppercase transition-all ${activeType === 'document' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    {activeType === 'document' && <span>Ingest Document</span>}
                </button>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base">😀</button>
                <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base">🎨</button>

                {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 grid grid-cols-4 gap-1 min-w-[140px]">
                        {EMOJIS.map(e => <button key={e} onClick={() => { execCommand('insertText', e); setShowEmojiPicker(false); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-lg">{e}</button>)}
                    </div>
                )}
                {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[200px]">
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Text Color</div>
                        <div className="flex flex-wrap gap-1 mb-3">
                            {COLORS.map(c => <button key={c} onClick={() => execCommand('foreColor', c)} className="w-5 h-5 rounded-full" style={{backgroundColor: c}} />)}
                        </div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Highlight</div>
                        <div className="flex flex-wrap gap-1">
                            {BG_COLORS.map(c => <button key={c} onClick={() => execCommand('hiliteColor', c)} className="w-5 h-5 rounded" style={{backgroundColor: c}} />)}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Tab-Specific Workspaces */}
        <div className="p-4 space-y-4">
            {activeType === 'project' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border dark:border-slate-700">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Objectives / Goals</label>
                            <textarea value={projectObjectives} onChange={(e) => setProjectObjectives(e.target.value)} placeholder="What are we trying to achieve?" className="w-full h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary-500/20" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key Deliverables</label>
                            <textarea value={projectDeliverables} onChange={(e) => setProjectDeliverables(e.target.value)} placeholder="Specific items to be produced..." className="w-full h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary-500/20" />
                        </div>
                    </div>
                    <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border dark:border-slate-700 flex flex-col justify-center text-center">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Manual Progress Monitor</label>
                        <div className="flex justify-between items-center mb-2 font-black text-xs px-2">
                            <span className="text-slate-500">Milestone %</span>
                            <span className="text-emerald-500 text-lg">{projectProgress}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={projectProgress} onChange={(e) => setProjectProgress(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 shadow-inner" />
                        <p className="text-[9px] text-slate-400 mt-4 italic">Adjust to reflect real-world completion before synthesis.</p>
                    </div>
                </div>
            )}

            <div className={`flex flex-col md:flex-row gap-4 h-[450px]`}>
                <div className="flex-1 flex flex-col min-w-0">
                    {activeType === 'code' && <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Logic Description</label>}
                    <div 
                        ref={editorRef} contentEditable onPaste={handlePaste}
                        className="flex-1 p-6 focus:outline-none text-base whitespace-pre-wrap leading-relaxed empty:before:content-[attr(placeholder)] empty:before:text-slate-400 overflow-y-auto custom-scrollbar border-2 border-transparent focus:border-primary-100 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 resize-y shadow-inner"
                        placeholder={activeType === 'document' ? "Drag document into portal or paste messy logs here... (Screenshot paste supported)" : "Describe your idea... Paste fragments..."}
                    />
                </div>

                {activeType === 'code' && (
                    <div className="flex-1 flex flex-col min-w-0 animate-[fadeIn_0.3s_ease-out]">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Source Snippet (Black Box)</label>
                        <div 
                            ref={codeEditorRef} contentEditable
                            className="flex-1 p-6 focus:outline-none text-sm font-mono whitespace-pre bg-black text-[#39ff14] selection:bg-[#39ff14]/30 overflow-y-auto custom-scrollbar rounded-2xl border border-[#39ff14]/20 shadow-2xl resize-y"
                            placeholder="// Paste raw source code here... High-contrast view active."
                        />
                    </div>
                )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 pb-3">
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700 min-h-[48px] items-center">
                {tags.map(tag => (
                    <span key={tag} style={getTagStyle(tag)} className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        #{tag} <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-500">✕</button>
                    </span>
                ))}
                <input 
                    type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const val = tagInput.trim().toLowerCase().replace('#',''); if (val && !tags.includes(val)) { setTags([...tags, val]); setTagInput(''); } } }}
                    placeholder="Hashtags..." className="bg-transparent outline-none text-[10px] font-bold text-slate-400 min-w-[120px] flex-1"
                />
            </div>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-2xl">
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${aiStep ? 'text-primary-600 animate-pulse' : 'text-slate-400'}`}>
                {aiStep ? `✨ ${aiStep}` : "Engine: Intelligence Idle"}
            </div>
            <div className="flex gap-3">
                <button onClick={() => handleAction(false)} disabled={isProcessing} className="px-6 py-2 rounded-full font-bold text-[10px] bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all active:scale-95">Save Raw</button>
                <button 
                  onClick={() => handleAction(true)} disabled={isProcessing || isGuest} 
                  className={`px-8 py-2 rounded-full font-black text-[10px] transition-all shadow-xl uppercase tracking-widest relative overflow-hidden group ${isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-primary-600 via-indigo-600 to-indigo-800 text-white hover:brightness-110 active:scale-95'}`}
                >
                  {isProcessing ? 'Neural Syncing...' : '✨ Synthesis'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;