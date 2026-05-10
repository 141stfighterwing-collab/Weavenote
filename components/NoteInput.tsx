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

  const [projectObjectives, setProjectObjectives] = useState('');
  const [projectDeliverables, setProjectDeliverables] = useState('');
  const [projectProgress, setProjectProgress] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const codeEditorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
    setAiStep(`Parsing ${file.name}...`);
    try {
        const text = await parseDocument(file);
        if (editorRef.current) {
            const docHtml = `
              <div style="margin: 15px 0; border: 2px solid rgba(var(--color-primary-500), 0.3); border-radius: 12px; background: rgba(var(--color-primary-50), 0.1); padding: 15px; font-family: inherit;">
                <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: rgb(var(--color-primary-600));">
                  📄 Source Document: ${file.name}
                </p>
                <div style="font-size: 13px; line-height: 1.6; color: inherit; white-space: pre-wrap;">${text}</div>
                <p style="margin: 10px 0 0 0; font-size: 9px; opacity: 0.5; font-style: italic;">--- END OF INGEST ---</p>
              </div>
            `;
            editorRef.current.innerHTML += docHtml;
            if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
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
    const htmlContent = editorRef.current?.innerHTML || '';
    const code = codeEditorRef.current?.innerText || '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const imgElements = tempDiv.querySelectorAll('img');
    const extractedImages: string[] = [];
    
    imgElements.forEach((img) => {
      if (img.src.startsWith('data:image')) {
        const currentIdx = extractedImages.length;
        extractedImages.push(img.src);
        const mdPlaceholder = `\n\n![Screenshot ${currentIdx + 1}](attachment:${currentIdx})\n\n`;
        const textNode = document.createTextNode(mdPlaceholder);
        img.parentNode?.replaceChild(textNode, img);
      }
    });
    
    let finalContent = htmlContent;
    
    if (activeType === 'code' && code.trim()) {
        finalContent = `${finalContent}\n\n\`\`\`\n${code}\n\`\`\``;
    }

    if (!finalContent.trim() && !title.trim() && extractedImages.length === 0) return;
    
    if (useAI) setAiStep("Neural Synthesis...");

    const extraProjectData = activeType === 'project' ? {
        manualProgress: projectProgress,
        manualObjectives: projectObjectives.split('\n').filter(o => o.trim()).map(o => ({ label: o, status: 'pending' })),
        manualDeliverables: projectDeliverables.split('\n').filter(d => d.trim()).map(d => ({ label: d, status: 'pending' })),
        isCompleted: projectProgress === 100
    } : undefined;
    
    await onAddNote(finalContent, activeType, extractedImages, tags, useAI, title, extraProjectData, setAiStep);
    
    if (editorRef.current) editorRef.current.innerHTML = '';
    if (codeEditorRef.current) codeEditorRef.current.innerHTML = '';
    setTitle(''); setTags([]); setAiStep(null);
    setProjectObjectives(''); setProjectDeliverables(''); setProjectProgress(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isProcessing && !isIngesting) {
            handleAction(false);
        }
    }
  };

  return (
    <div className="max-w-[840px] mx-auto flex flex-col bg-surface-container-low rounded-xl border border-outline-variant shadow-lg overflow-hidden mb-8">
        <div role="tablist" aria-label="Note type" className="flex gap-1 p-1 bg-surface-container-low border-b border-outline-variant overflow-x-auto no-scrollbar">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => (
                <button
                  key={type}
                  role="tab"
                  aria-selected={activeType === type}
                  onClick={() => onTypeChange?.(type)}
                  className={`flex-1 py-1 text-label-caps rounded transition-all min-w-[85px] uppercase tracking-widest ${activeType === type ? 'text-primary font-bold bg-surface-variant' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
                >
                    {type}
                </button>
            ))}
        </div>

      <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
        <div className="p-md border-b border-outline-variant bg-surface-container-high/50">
            <input 
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} 
              placeholder={activeType === 'project' ? "Project Identity Title..." : "Title of this Idea block..."} 
              className="w-full bg-transparent border-none font-h1 text-[24px] font-bold text-on-surface placeholder:text-outline focus:ring-0 outline-none" 
            />
        </div>

        <div className="px-md py-sm border-b border-outline-variant flex items-center justify-between bg-surface-container">
            <div className="flex items-center gap-md">
                <div className="flex gap-sm border-r border-outline-variant pr-md mr-2 text-on-surface-variant">
                    <button onClick={() => execCommand('bold')} className="hover:text-primary transition-colors" aria-label="Bold" title="Bold"><span className="material-symbols-outlined">format_bold</span></button>
                    <button onClick={() => execCommand('italic')} className="hover:text-primary transition-colors" aria-label="Italic" title="Italic"><span className="material-symbols-outlined">format_italic</span></button>
                    <button onClick={() => execCommand('insertUnorderedList')} className="hover:text-primary transition-colors" aria-label="Bullet List" title="Bullet List"><span className="material-symbols-outlined">format_list_bulleted</span></button>
                </div>
                <div className="flex gap-sm text-on-surface-variant relative">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`hover:text-primary transition-colors ${isIngesting ? 'animate-pulse text-primary' : ''}`}
                      disabled={isIngesting}
                      aria-label={activeType === 'document' ? 'Upload Document' : 'Attach File'}
                      title={activeType === 'document' ? 'Upload Document' : 'Attach File'}
                    >
                        <span className="material-symbols-outlined">{activeType === 'document' ? 'upload_file' : 'attach_file'}</span>
                    </button>
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="hover:text-primary transition-colors" aria-label="Insert Emoji" title="Insert Emoji"><span className="material-symbols-outlined">mood</span></button>
                    <button onClick={() => setShowColorPicker(!showColorPicker)} className="hover:text-primary transition-colors" aria-label="Text & Highlight Color" title="Text & Highlight Color"><span className="material-symbols-outlined">palette</span></button>

                    {showEmojiPicker && (
                        <div className="absolute top-full left-0 mt-2 p-2 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 grid grid-cols-4 gap-1 min-w-[140px]">
                            {EMOJIS.map(e => <button key={e} onClick={() => { execCommand('insertText', e); setShowEmojiPicker(false); }} className="p-1.5 hover:bg-surface-variant rounded text-lg">{e}</button>)}
                        </div>
                    )}
                    {showColorPicker && (
                        <div className="absolute top-full left-5 mt-2 p-3 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 min-w-[200px]">
                            <div className="text-[9px] font-black uppercase text-outline mb-2">Text Color</div>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {COLORS.map(c => <button key={c} onClick={() => execCommand('foreColor', c)} className="w-5 h-5 rounded-full" style={{backgroundColor: c}} />)}
                            </div>
                            <div className="text-[9px] font-black uppercase text-outline mb-2">Highlight</div>
                            <div className="flex flex-wrap gap-1">
                                {BG_COLORS.map(c => <button key={c} onClick={() => execCommand('hiliteColor', c)} className="w-5 h-5 rounded" style={{backgroundColor: c}} />)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-label-caps text-outline">INTER FONT • 14PX</div>
        </div>

        <div className="p-4 space-y-4">
            {activeType === 'project' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="space-y-4 bg-surface-container-low p-5 rounded-xl border border-outline-variant">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Primary Objectives / Goals</label>
                            <textarea value={projectObjectives} onChange={(e) => setProjectObjectives(e.target.value)} placeholder="What are we trying to achieve?" className="w-full h-24 bg-surface-dim border border-outline-variant rounded-xl p-3 text-xs outline-none focus:border-primary text-on-surface resize-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Key Deliverables</label>
                            <textarea value={projectDeliverables} onChange={(e) => setProjectDeliverables(e.target.value)} placeholder="Specific items to be produced..." className="w-full h-24 bg-surface-dim border border-outline-variant rounded-xl p-3 text-xs outline-none focus:border-primary text-on-surface resize-none" />
                        </div>
                    </div>
                    <div className="space-y-4 bg-surface-container-low p-5 rounded-xl border border-outline-variant flex flex-col justify-center text-center">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-4">Manual Progress Monitor</label>
                        <div className="flex justify-between items-center mb-2 font-black text-xs px-2">
                            <span className="text-on-surface-variant">Milestone %</span>
                            <span className="text-secondary text-lg">{projectProgress}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={projectProgress} onChange={(e) => setProjectProgress(parseInt(e.target.value))} className="w-full h-3 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-secondary border-none" />
                    </div>
                </div>
            )}

            <div className={`flex flex-col md:flex-row gap-4 min-h-[300px]`}>
                <div className="flex-1 flex flex-col min-w-0 relative">
                    <div 
                        ref={editorRef} contentEditable onPaste={handlePaste}
                        className="flex-1 p-md focus:outline-none text-body-lg whitespace-pre-wrap leading-relaxed empty:before:content-['Start_writing_your_thoughts...'] empty:before:text-outline-variant overflow-y-auto custom-scrollbar bg-transparent text-on-surface resize-y"
                    />
                </div>

                {activeType === 'code' && (
                    <div className="flex-1 flex flex-col min-w-0 animate-[fadeIn_0.3s_ease-out]">
                        <div 
                            ref={codeEditorRef} contentEditable
                            className="flex-1 p-md focus:outline-none text-sm font-mono whitespace-pre bg-surface-dim text-secondary selection:bg-secondary/30 overflow-y-auto custom-scrollbar rounded-xl border border-outline-variant resize-y empty:before:content-['//_Paste_raw_source_code_here...'] empty:before:text-outline"
                        />
                    </div>
                )}
            </div>
        </div>

        <div className="p-md bg-surface-container border-t border-outline-variant flex flex-col gap-md">
            <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-outline">label</span>
                <div className="flex flex-wrap gap-xs flex-1">
                    {tags.map(tag => (
                        <span key={tag} className="bg-primary/10 text-primary px-sm py-unit rounded text-label-caps border border-primary/20 flex items-center gap-1">
                            #{tag.toUpperCase()} <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} aria-label={`Remove tag ${tag}`}>✕</button>
                        </span>
                    ))}
                    <input 
                        type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') return;
                            if (e.key === 'Enter') { e.preventDefault(); const val = tagInput.trim().toLowerCase().replace('#',''); if (val && !tags.includes(val)) { setTags([...tags, val]); setTagInput(''); } }
                        }}
                        placeholder="Add tag..." className="bg-transparent border-none text-[11px] focus:ring-0 p-0 w-24 outline-none placeholder:text-outline-variant"
                        aria-label="Add tag"
                    />
                </div>
            </div>
            
            <div className="flex justify-between items-center">
                <div
                    aria-live="polite"
                    className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${aiStep ? 'text-primary animate-pulse' : 'text-outline'}`}
                >
                    {aiStep ? `✨ ${aiStep}` : ""}
                </div>
                <div className="flex gap-md">
                    <button
                        onClick={() => handleAction(false)}
                        disabled={isProcessing || isIngesting}
                        className="px-lg py-sm rounded-lg border border-outline text-on-surface hover:bg-surface-variant transition-colors font-semibold active:scale-[0.98]"
                        title="Save Note (⌘/Ctrl+Enter)"
                    >
                        SAVE
                    </button>
                    <button 
                      onClick={() => handleAction(true)} disabled={isProcessing || isGuest || isIngesting} 
                      className={`px-lg py-sm rounded-lg bg-secondary text-on-secondary font-bold flex items-center gap-sm shadow-[0_0_20px_rgba(255,185,95,0.2)] hover:opacity-90 active:scale-[0.98] transition-all ${isGuest || isIngesting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isGuest ? "Synthesis (Login required)" : "Neural Synthesis"}
                    >
                      <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                      {isProcessing ? 'SYNTHESIZING' : 'SYNTHESIS'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;