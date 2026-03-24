import React, { useState, useRef, useEffect } from 'react';
import { NoteType, NoteColor, ProjectData, QuickReferenceTemplate } from '../types';
import { parseDocument } from '../services/documentParser';
import { getTagStyle } from '../utils/styleUtils';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: any, onStepUpdate?: (step: string) => void) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  isGuest?: boolean;
  selectedTemplate?: QuickReferenceTemplate | null;
  onTemplateApplied?: () => void;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];
const EMOJIS = ["✨", "🚀", "💡", "📝", "✅", "🔥", "🛠️", "🎯", "📊", "🧠", "💻", "🎨", "📅", "📌", "🔒", "⚠️"];
// All main colors for text (including black and white)
const COLORS = [
  "#000000", // Black
  "#ffffff", // White
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#10b981", // Green
  "#06b6d4", // Teal/Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#d946ef", // Magenta/Pink
  "#6b7280"  // Gray
];
// All main colors for highlight (including black and white)
const BG_COLORS = [
  "#000000", // Black
  "#ffffff", // White
  "#fecaca", // Light Red
  "#fed7aa", // Light Orange
  "#fef08a", // Light Yellow
  "#bbf7d0", // Light Green
  "#bae6fd", // Light Blue
  "#c7d2fe", // Light Indigo
  "#e9d5ff", // Light Purple
  "#fbcfe8", // Light Pink
  "#cbd5e1", // Light Gray
  "#ef4444", // Red (full)
  "#10b981", // Green (full)
  "#3b82f6"  // Blue (full)
];

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false, isGuest = true, selectedTemplate = null, onTemplateApplied 
}) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aiStep, setAiStep] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('');
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

  useEffect(() => {
    if (!selectedTemplate || !editorRef.current) return;
    setTitle(selectedTemplate.title);
    editorRef.current.innerText = selectedTemplate.content;
    const generatedTags = Array.from(new Set(['template', ...selectedTemplate.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 3)]));
    setTags(generatedTags);
    onTemplateApplied?.();
  }, [selectedTemplate, onTemplateApplied]);

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

  // Insert image/GIF from URL with optional width
  const insertImageFromUrl = (url: string, width?: string) => {
    if (!url.trim()) return;
    if (editorRef.current) {
      editorRef.current.focus();
      const widthStyle = width ? ` width="${width}"` : '';
      const imgHtml = `<img src="${url}" alt="Image"${widthStyle} style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" />`;
      document.execCommand('insertHTML', false, imgHtml);
      setShowImageDialog(false);
      setShowGifPicker(false);
      setImageUrl('');
      setImageWidth('');
    }
  };

  // Popular GIF sources for quick access
  const POPULAR_GIFS = [
    { name: 'Thumbs Up', url: 'https://media.giphy.com/media/lexyF1vbzO2iOQ6F8b/giphy.gif' },
    { name: 'Applause', url: 'https://media.giphy.com/media/mCOclR8iGicJ1VYfdT/giphy.gif' },
    { name: 'Thinking', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' },
    { name: 'Party', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
    { name: 'Success', url: 'https://media.giphy.com/media/a0h7sAqON67nO/giphy.gif' },
    { name: 'Fire', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
    { name: 'Celebrate', url: 'https://media.tenor.com/ja4S6wLmYPAAAAAC/celebrate.gif' },
    { name: 'Wow', url: 'https://media.tenor.com/5tNnolqRe1YAAAAd/surprised-shocked.gif' },
  ];

  return (
    <div className="rounded-2xl shadow-2xl border p-1 mb-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-all duration-300 ring-4 ring-black/5 overflow-visible">
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => (
                <button key={type} onClick={() => onTypeChange?.(type)} className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all min-w-[85px] uppercase tracking-widest ${activeType === type ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    {type}
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-1">
        <div className="flex items-center justify-between border-b dark:border-slate-700">
            <input 
              type="text" value={title} onChange={(e) => setTitle(e.target.value)} 
              placeholder={activeType === 'project' ? "Project Identity Title..." : "Title of this Idea block..."} 
              className="flex-1 px-5 py-4 bg-transparent focus:outline-none font-bold text-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" 
            />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 relative">
            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1">
                <select onChange={(e) => execCommand('fontName', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none max-w-[85px] text-slate-900 dark:text-slate-100">
                    <option value="">Font</option>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select onChange={(e) => execCommand('fontSize', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none text-slate-900 dark:text-slate-100">
                    <option value="">Size</option>
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1 text-slate-600 dark:text-slate-300">
                <button onClick={() => execCommand('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded font-black text-xs px-2.5">B</button>
                <button onClick={() => execCommand('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded italic text-xs px-2.5">I</button>
                <button onClick={() => execCommand('underline')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded underline text-xs px-2.5">U</button>
                <button onClick={() => execCommand('strikeThrough')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded line-through text-xs px-2.5">S</button>
            </div>

            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1">
                <button onClick={() => execCommand('insertUnorderedList')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2 uppercase text-slate-600 dark:text-slate-300">Bullet</button>
                <button onClick={() => execCommand('insertText', '- [ ] ')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2 uppercase text-primary-600">Task</button>
            </div>

            <div className="flex gap-0.5 border-r dark:border-slate-700 pr-2 mr-1 text-slate-600 dark:text-slate-300">
                <button onClick={() => { const sel = window.getSelection(); if (sel) { const range = sel.getRangeAt(0); const sup = document.createElement('sup'); sup.textContent = sel.toString(); range.deleteContents(); range.insertNode(sup); } }} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2" title="Superscript">X²</button>
                <button onClick={() => { const sel = window.getSelection(); if (sel) { const range = sel.getRangeAt(0); const sub = document.createElement('sub'); sub.textContent = sel.toString(); range.deleteContents(); range.insertNode(sub); } }} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-[10px] font-black px-2" title="Subscript">X₂</button>
            </div>

            <div className="flex gap-1 items-center relative">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.md" />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isIngesting}
                  className={`p-1.5 rounded flex items-center gap-2 px-3 text-[10px] font-black uppercase transition-all ${isIngesting ? 'bg-indigo-400 text-white cursor-wait animate-pulse' : (activeType === 'document' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500')}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    {isIngesting ? <span>Processing...</span> : (activeType === 'document' && <span>Ingest Document</span>)}
                </button>
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base">😀</button>
                <button onClick={() => setShowColorPicker(!showColorPicker)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base">🎨</button>
                <button onClick={() => setShowGifPicker(!showGifPicker)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base" title="Insert GIF">🎬</button>
                <button onClick={() => setShowImageDialog(!showImageDialog)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded text-base" title="Insert Image URL">🖼️</button>

                {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 grid grid-cols-4 gap-1 min-w-[140px]">
                        {EMOJIS.map(e => <button key={e} onClick={() => { execCommand('insertText', e); setShowEmojiPicker(false); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-lg">{e}</button>)}
                    </div>
                )}
                {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[240px]">
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Text Color</div>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {COLORS.map(c => (
                              <button 
                                key={c} 
                                onClick={() => execCommand('foreColor', c)} 
                                className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform" 
                                style={{backgroundColor: c}} 
                                title={c}
                              />
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                            <input 
                              type="color" 
                              onChange={(e) => execCommand('foreColor', e.target.value)} 
                              className="w-6 h-6 rounded cursor-pointer border-0"
                              title="Custom text color"
                            />
                            <span className="text-[8px] text-slate-400 font-bold">Custom</span>
                        </div>
                        
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Highlight</div>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {BG_COLORS.map(c => (
                              <button 
                                key={c} 
                                onClick={() => execCommand('hiliteColor', c)} 
                                className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform" 
                                style={{backgroundColor: c}} 
                                title={c}
                              />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              onChange={(e) => execCommand('hiliteColor', e.target.value)} 
                              className="w-6 h-6 rounded cursor-pointer border-0"
                              title="Custom highlight color"
                            />
                            <span className="text-[8px] text-slate-400 font-bold">Custom</span>
                        </div>
                    </div>
                )}
                {showGifPicker && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[280px]">
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Popular GIFs</div>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {POPULAR_GIFS.map(gif => (
                                <button
                                    key={gif.name}
                                    onClick={() => insertImageFromUrl(gif.url)}
                                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                    title={gif.name}
                                >
                                    <img src={gif.url} alt={gif.name} className="w-10 h-10 object-cover rounded" />
                                </button>
                            ))}
                        </div>
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">GIF URL</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://media.giphy.com/..."
                                className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded text-[10px] outline-none text-slate-900 dark:text-white"
                            />
                            <input
                                type="text"
                                value={imageWidth}
                                onChange={(e) => setImageWidth(e.target.value)}
                                placeholder="Width"
                                className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded text-[10px] outline-none text-slate-900 dark:text-white"
                            />
                            <button
                                onClick={() => insertImageFromUrl(imageUrl, imageWidth)}
                                className="px-3 py-1.5 bg-primary-600 text-white rounded text-[10px] font-black uppercase"
                            >
                                Add
                            </button>
                        </div>
                        <div className="text-[8px] text-slate-400 mt-2">
                            📌 Try: giphy.com, tenor.com, imgur.com
                        </div>
                    </div>
                )}
                {showImageDialog && (
                    <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[280px]">
                        <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Insert Image from URL</div>
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded text-[10px] outline-none text-slate-900 dark:text-white"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={imageWidth}
                                    onChange={(e) => setImageWidth(e.target.value)}
                                    placeholder="Width (e.g., 300px or 100%)"
                                    className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded text-[10px] outline-none text-slate-900 dark:text-white"
                                />
                                <button
                                    onClick={() => insertImageFromUrl(imageUrl, imageWidth)}
                                    className="px-3 py-1.5 bg-primary-600 text-white rounded text-[10px] font-black uppercase"
                                >
                                    Insert
                                </button>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-400 mt-2">
                            💡 Supports JPG, PNG, GIF, WebP, SVG
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="p-4 space-y-4">
            {activeType === 'project' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className="space-y-4 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border dark:border-slate-700">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Objectives / Goals</label>
                            <textarea value={projectObjectives} onChange={(e) => setProjectObjectives(e.target.value)} placeholder="What are we trying to achieve?" className="w-full h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key Deliverables</label>
                            <textarea value={projectDeliverables} onChange={(e) => setProjectDeliverables(e.target.value)} placeholder="Specific items to be produced..." className="w-full h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-white" />
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
                    <div 
                        ref={editorRef} contentEditable onPaste={handlePaste}
                        className="flex-1 p-6 focus:outline-none text-base whitespace-pre-wrap leading-relaxed empty:before:content-['Describe_your_idea..._Paste_fragments...'] empty:before:text-slate-400 dark:empty:before:text-slate-500 overflow-y-auto custom-scrollbar border-2 border-transparent focus:border-primary-100 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 text-slate-900 dark:text-white resize-y shadow-inner"
                    />
                </div>

                {activeType === 'code' && (
                    <div className="flex-1 flex flex-col min-w-0 animate-[fadeIn_0.3s_ease-out]">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Source Snippet (Black Box)</label>
                        <div 
                            ref={codeEditorRef} contentEditable
                            className="flex-1 p-6 focus:outline-none text-sm font-mono whitespace-pre bg-black text-[#39ff14] selection:bg-[#39ff14]/30 overflow-y-auto custom-scrollbar rounded-2xl border border-[#39ff14]/20 shadow-2xl resize-y empty:before:content-['//_Paste_raw_source_code_here..._High-contrast_view_active.'] empty:before:text-[#39ff14]/50"
                        />
                    </div>
                )}
            </div>
        </div>

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
                    placeholder="Hashtags..." className="bg-transparent outline-none text-[10px] font-bold text-slate-600 dark:text-slate-400 min-w-[120px] flex-1"
                />
            </div>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-2xl">
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${aiStep ? 'text-primary-600 animate-pulse' : 'text-slate-400'}`}>
                {aiStep ? `✨ ${aiStep}` : "Engine: Intelligence Idle"}
            </div>
            <div className="flex gap-3">
                <button onClick={() => handleAction(false)} disabled={isProcessing || isIngesting} className="px-6 py-2 rounded-full font-bold text-[10px] bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all active:scale-95 disabled:opacity-50">Save Raw</button>
                <button 
                  onClick={() => handleAction(true)} disabled={isProcessing || isGuest || isIngesting} 
                  className={`px-8 py-2 rounded-full font-black text-[10px] transition-all shadow-xl uppercase tracking-widest relative overflow-hidden group ${isGuest || isIngesting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-primary-600 via-indigo-600 to-indigo-800 text-white hover:brightness-110 active:scale-95'}`}
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