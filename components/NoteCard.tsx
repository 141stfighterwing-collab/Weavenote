import React, { useMemo, useState, useRef } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder, ProjectItem } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { customSanitizeSchema } from '../services/security';
import { getTagStyle } from '../utils/styleUtils';
import { stripImagesFromNoteContent } from '../utils/noteContent';

interface NoteCardProps {
  note: Note;
  folders?: Folder[];
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onChangeColor: (id: string, color: NoteColor) => void;
  onEdit: (note: Note) => void;
  onExpand: (note: Note) => void;
  readOnly?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, index: number) => void;
  onAddTag: (noteId: string, tag: string) => void;
  onRemoveTag: (noteId: string, tag: string) => void;
  onMoveToFolder?: (noteId: string, folderId: string | undefined) => void;
  onToggleComplete?: (id: string) => void;
  onUpdateColors?: (id: string, textColor: string | undefined, backgroundColor: string | undefined) => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ 
  note, folders = [], onDelete, onTagClick, onEdit, onExpand, 
  readOnly = false, onToggleCheckbox, onToggleComplete, onMoveToFolder, onChangeColor, onUpdateColors, onViewImage
}) => {
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);

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
  // All main colors for background/highlight (including black and white)
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

  const folderName = useMemo(() => {
    if (!note.folderId || !folders) return null;
    return folders.find(f => f.id === note.folderId)?.name;
  }, [note.folderId, folders]);

  const calculateProgress = useMemo(() => {
      if (!note.projectData) return 0;
      if (note.projectData.isCompleted) return 100;
      if (typeof note.projectData.manualProgress === 'number' && note.projectData.manualProgress > 0) return note.projectData.manualProgress;
      const { milestones } = note.projectData;
      let completed = 0, total = 0;
      if (milestones && milestones.length > 0) {
          total += milestones.length;
          completed += milestones.filter(m => m.status === 'completed').length;
      }
      return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [note.projectData]);

  // Extract images from note content for thumbnail display
  const extractedImages = useMemo(() => {
    const images: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/gi;
    let match;
    
    // Extract from HTML img tags
    while ((match = imgRegex.exec(note.content)) !== null) {
      if (match[1] && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }
    
    // Extract from markdown image syntax
    while ((match = mdImgRegex.exec(note.content)) !== null) {
      if (match[1] && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }
    
    return images.slice(0, 3); // Limit to 3 thumbnails
  }, [note.content]);

  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return;
    setIsDragging(true);
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const markdownComponents = {
      p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return (
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleCheckbox(note.id, index); }}
                  className="inline-flex items-center justify-center mr-2 transform active:scale-75 transition-transform text-sm"
                  title={props.checked ? "Completed" : "Mark Complete"}
                >
                  {props.checked ? '✅' : '⬜'}
                </button>
              );
          }
          return <input {...props} />;
      }
  };

  const isFinished = note.projectData?.isCompleted === true || calculateProgress === 100;
  const isMatrix = note.color === 'matrix';

  const cardStyle: React.CSSProperties = {
    backgroundColor: note.backgroundColor || undefined,
    color: note.textColor || undefined,
  };

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onExpand(note)}
      style={cardStyle}
      className={`relative group p-6 rounded-2xl shadow-lg transition-all ${!note.backgroundColor ? NOTE_COLORS[note.color] : ''} min-h-[280px] flex flex-col cursor-pointer border border-black/5 hover:shadow-xl hover:-translate-y-1 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isFinished ? 'ring-2 ring-emerald-500/50' : ''} ${isMatrix ? 'font-mono' : ''} ${note.isSynthesized ? 'ring-2 ring-primary-400 ring-offset-2 dark:ring-offset-slate-800' : ''}`}
    >
      <div className="flex justify-between items-start mb-4 border-b border-black/5 pb-2">
        <div className="flex-1 min-w-0 pr-2">
            <h3 className={`text-xl font-black leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
            {note.isSynthesized && <span className="text-[8px] font-black uppercase tracking-[0.2em] text-primary-600 block mt-0.5">✨ Synthesized Idea</span>}
        </div>
        {folderName && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/5 rounded-lg border border-black/5 text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {folderName}
            </div>
        )}
      </div>

      {note.type === 'project' && note.projectData && (
        <div className="mb-4 space-y-3 bg-black/5 rounded-xl p-4 border border-black/5">
            <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>Progress</span>
                    <span>{calculateProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full transition-all duration-1000 ease-out ${isMatrix ? 'bg-[#39ff14]' : 'bg-emerald-500'}`} 
                        style={{ width: `${calculateProgress}%` }}
                    />
                </div>
            </div>
        </div>
      )}

      <div className={`prose prose-sm max-w-none flex-grow text-sm ${note.type === 'project' ? 'line-clamp-4' : 'line-clamp-[8]'} overflow-hidden mb-4 mt-1 ${isMatrix ? 'text-[#39ff14]' : 'opacity-90'} whitespace-pre-wrap`}>
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]} 
           rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
           components={markdownComponents}
         >
           {stripImagesFromNoteContent(note.content)}
         </ReactMarkdown>
      </div>

      {/* Image thumbnails for quick notes */}
      {extractedImages.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {extractedImages.map((imgSrc, idx) => (
            <div 
              key={idx} 
              className="relative group/img"
              onClick={(e) => { e.stopPropagation(); onViewImage(imgSrc); }}
            >
              <img 
                src={imgSrc} 
                alt={`Attachment ${idx + 1}`}
                className="h-16 w-16 object-cover rounded-lg border border-black/10 shadow-sm cursor-pointer hover:shadow-md transition-all"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {imgSrc.includes('.gif') && (
                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[7px] px-1 rounded font-bold">GIF</span>
              )}
            </div>
          ))}
          {extractedImages.length > 0 && (
            <div className="h-16 w-16 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
              <span className="text-[8px] font-bold text-slate-400 uppercase">Click to view</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto">
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {note.tags.map(tag => {
              const style = getTagStyle(tag);
              return (
                <button 
                  key={tag} 
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                  style={isMatrix ? {} : style}
                  className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border transition-all hover:scale-105 active:scale-95 ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14] border-[#39ff14]/30' : ''}`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/5">
            <div className="flex items-center gap-1 shrink-0 relative">
            <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowCustomColorPicker(false); }} className={`p-2 rounded-xl shadow-sm hover:scale-110 transition-transform ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/50 text-slate-600'}`}>🎨</button>
                {showColorPicker && (
                    <div className="absolute bottom-full right-0 mb-3 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border dark:border-slate-700 flex flex-col gap-3 w-44 z-50">
                        <div className="flex flex-wrap gap-1.5">
                            {Object.values(NoteColor).map((c) => (
                                <button key={c} onClick={(e) => { e.stopPropagation(); onChangeColor(note.id, c); onUpdateColors?.(note.id, undefined, undefined); setShowColorPicker(false); }} className={`w-7 h-7 rounded-lg border transition-transform hover:scale-110 ${c === 'matrix' ? 'bg-black border-[#39ff14]' : `bg-${c}-200`}`} title={c} />
                            ))}
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowCustomColorPicker(true); setShowColorPicker(false); }}
                            className="text-[10px] font-black uppercase tracking-widest py-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                            Custom Colors
                        </button>
                    </div>
                )}
                {showCustomColorPicker && (
                    <div className="absolute bottom-full right-0 mb-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border dark:border-slate-700 flex flex-col gap-4 w-60 z-50">
                        <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Text Color</div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, c, note.backgroundColor); }} 
                                        className={`w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform ${note.textColor === c ? 'ring-2 ring-primary-500' : ''}`} 
                                        style={{backgroundColor: c}} 
                                        title={c}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" 
                                    onChange={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, e.target.value, note.backgroundColor); }}
                                    className="w-6 h-6 rounded cursor-pointer border-0"
                                    title="Custom text color"
                                />
                                <span className="text-[8px] text-slate-400 font-bold">Custom</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black uppercase text-slate-400 mb-2">Background Color</div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {BG_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, note.textColor, c); }} 
                                        className={`w-6 h-6 rounded-lg border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform ${note.backgroundColor === c ? 'ring-2 ring-primary-500' : ''}`} 
                                        style={{backgroundColor: c}} 
                                        title={c}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" 
                                    onChange={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, note.textColor, e.target.value); }}
                                    className="w-6 h-6 rounded cursor-pointer border-0"
                                    title="Custom background color"
                                />
                                <span className="text-[8px] text-slate-400 font-bold">Custom</span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, undefined, undefined); setShowCustomColorPicker(false); }}
                            className="text-[9px] font-black uppercase tracking-widest py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                            Reset to Default
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowCustomColorPicker(false); }}
                            className="text-[9px] font-black uppercase tracking-widest py-2 bg-slate-900 text-white rounded-lg"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className={`p-2 rounded-xl shadow-sm hover:scale-110 transition-transform ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/50 text-slate-600'}`}>✏️</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-2 bg-rose-500/20 text-rose-700 rounded-xl shadow-sm hover:scale-110 transition-transform">🗑️</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;