import React, { useState, useEffect, useRef } from 'react';
import { Note, ProjectData, ProjectPhase, ProjectMilestone, ProjectItem } from '../types';
import { processNoteWithAI } from '../services/geminiService';
import { getTagStyle } from '../utils/styleUtils';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string, category?: string, tags?: string[], projectData?: ProjectData) => void;
  currentUser: string;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSave, currentUser }) => {
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Project Engine State
  const [objectives, setObjectives] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [manualProgress, setManualProgress] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState('');
  
  const editorRef = useRef<HTMLDivElement>(null);
  const isGuest = currentUser === 'Guest';

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

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setTags(note.tags);
      if (editorRef.current) editorRef.current.innerHTML = note.content;
      if (note.type === 'project' && note.projectData) {
          setObjectives(note.projectData.objectives.map(o => typeof o === 'string' ? o : o.label).join('\n'));
          setDeliverables(note.projectData.deliverables.map(d => typeof d === 'string' ? d : d.label).join('\n'));
          setManualProgress(note.projectData.manualProgress || 0);
      }
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
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

  const handleAIOrganize = async () => {
      if (isGuest) return;
      setIsProcessing(true);
      try {
          const content = editorRef.current?.innerHTML || '';
          const processed = await processNoteWithAI(content, [], note.type, currentUser);
          setTitle(processed.title);
          setTags(prev => Array.from(new Set([...prev, ...processed.tags.map(t => t.toLowerCase().replace('#', ''))])));
          if (editorRef.current) editorRef.current.innerHTML = processed.formattedContent;
      } catch (err: any) {
          console.error(err);
      } finally {
          setIsProcessing(false);
      }
  };

  const addTag = () => {
      const val = tagInput.trim().toLowerCase().replace('#', '');
      if (val && !tags.includes(val)) {
          setTags([...tags, val]);
          setTagInput('');
      }
  };

  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = editorRef.current?.innerHTML || '';
    onSave(note.id, title, content, undefined, tags, note.type === 'project' ? {
        ...note.projectData,
        objectives: objectives.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        deliverables: deliverables.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        manualProgress,
        isCompleted: manualProgress === 100
    } as any : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] animate-[fadeIn_0.2s_ease-out]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <span className={`p-1.5 ${note.type === 'project' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white rounded-lg shadow-sm`}>
                {note.type === 'project' ? '🚀' : '✏️'}
            </span> 
            Edit {note.type === 'project' ? 'Project' : 'Note'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-6 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Project Data Left Column */}
            <div className={`lg:col-span-4 space-y-6 ${note.type !== 'project' ? 'hidden' : ''}`}>
                <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Project Dashboard</label>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] font-bold text-slate-500">Progress</span>
                                <span className="text-[10px] font-black text-emerald-600">{manualProgress}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={manualProgress} onChange={(e) => setManualProgress(parseInt(e.target.value))} className="w-full accent-emerald-500" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Objectives</label>
                        <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} className="w-full h-32 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Deliverables</label>
                        <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className="w-full h-32 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white" />
                    </div>
                </div>
            </div>

            {/* Description Right Column */}
            <div className={`${note.type === 'project' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6 flex flex-col`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Entry Title</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-5 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-lg dark:bg-slate-900 text-slate-900 dark:text-white outline-none" required />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Manage Hashtags</label>
                        <div className="flex flex-wrap gap-1.5 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 min-h-[50px]">
                            {tags.map(tag => (
                                <span key={tag} style={getTagStyle(tag)} className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 group/tag">
                                    #{tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">✕</button>
                                </span>
                            ))}
                            <input 
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                placeholder="Add tag..."
                                className="bg-transparent outline-none text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[80px] flex-1"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-grow flex flex-col min-h-[400px]">
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100 dark:bg-slate-900 rounded-t-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
                        <select onChange={(e) => execCommand('fontName', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none max-w-[90px] text-slate-900 dark:text-slate-100">
                            <option value="">Font</option>
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select onChange={(e) => execCommand('fontSize', e.target.value)} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-1.5 py-1 text-[10px] font-bold outline-none text-slate-900 dark:text-slate-100">
                            <option value="">Size</option>
                            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <button type="button" onClick={() => execCommand('bold')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs font-black text-slate-600 dark:text-slate-300">B</button>
                        <button type="button" onClick={() => execCommand('italic')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs italic text-slate-600 dark:text-slate-300">I</button>
                        <button type="button" onClick={() => execCommand('underline')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs underline text-slate-600 dark:text-slate-300">U</button>
                        <button type="button" onClick={() => execCommand('strikeThrough')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs line-through text-slate-600 dark:text-slate-300">S</button>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <button type="button" onClick={() => { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) { const range = sel.getRangeAt(0); const sup = document.createElement('sup'); sup.textContent = sel.toString(); range.deleteContents(); range.insertNode(sup); } }} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-[10px] font-black text-slate-600 dark:text-slate-300" title="Superscript">X²</button>
                        <button type="button" onClick={() => { const sel = window.getSelection(); if (sel && sel.rangeCount > 0) { const range = sel.getRangeAt(0); const sub = document.createElement('sub'); sub.textContent = sel.toString(); range.deleteContents(); range.insertNode(sub); } }} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-[10px] font-black text-slate-600 dark:text-slate-300" title="Subscript">X₂</button>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <div className="relative">
                            <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300">🎨</button>
                            {showColorPicker && (
                                <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[240px]">
                                    <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Text Color</div>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {COLORS.map(c => (
                                          <button 
                                            key={c} 
                                            type="button" 
                                            onClick={() => { execCommand('foreColor', c); }} 
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
                                            type="button" 
                                            onClick={() => { execCommand('hiliteColor', c); }} 
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
                        </div>
                        <button type="button" onClick={() => setShowGifPicker(!showGifPicker)} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300" title="Insert GIF">🎬</button>
                        <button type="button" onClick={() => setShowImageDialog(!showImageDialog)} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300" title="Insert Image URL">🖼️</button>
                        
                        {showGifPicker && (
                            <div className="absolute top-full left-0 mt-1 p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-50 min-w-[280px]">
                                <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Popular GIFs</div>
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    {POPULAR_GIFS.map(gif => (
                                        <button
                                            key={gif.name}
                                            type="button"
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
                                        type="button"
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
                                            type="button"
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
                    <div
                      ref={editorRef}
                      contentEditable
                      className="w-full flex-grow px-8 py-8 border-x border-b border-slate-200 dark:border-slate-700 rounded-b-2xl font-sans text-base dark:bg-slate-900 text-slate-900 dark:text-white outline-none leading-relaxed shadow-inner"
                    />
                </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={handleAIOrganize} disabled={isProcessing || isGuest} className={`px-8 py-3 font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg transition-all transform hover:-translate-y-1 ${isGuest ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white'}`}>
              {isProcessing ? '⌛ Neural Sync...' : '✨ Optimize & Tag'}
            </button>
            <div className="flex gap-4">
                <button type="button" onClick={onClose} className="px-6 py-3 font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
                <button type="submit" className="px-10 py-3 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-xl hover:brightness-110 transition-all transform hover:-translate-y-1">Commit Entry</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;