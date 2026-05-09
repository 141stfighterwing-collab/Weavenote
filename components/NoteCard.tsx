import React, { useMemo, useState, useRef } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder, ProjectItem } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cleanMarkdownText } from '../utils/markdownUtils';

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

// Global helper for neon tag styles
export const getTagStyle = (tag: string, isActive: boolean = false) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    
    // Selection state: High-contrast solid neon with black text
    if (isActive) {
        return {
            backgroundColor: `hsl(${hue}, 100%, 65%)`,
            color: '#000',
            borderColor: `hsl(${hue}, 100%, 80%)`,
            boxShadow: `0 0 20px hsla(${hue}, 100%, 65%, 0.7), inset 0 0 8px rgba(255,255,255,0.6)`,
            fontWeight: '900',
            borderWidth: '2px'
        };
    }
    
    // Standard state: Glowing neon text and border
    return {
        backgroundColor: `hsla(${hue}, 100%, 50%, 0.12)`,
        color: `hsl(${hue}, 100%, 75%)`,
        borderColor: `hsla(${hue}, 100%, 70%, 0.6)`,
        boxShadow: `0 0 12px hsla(${hue}, 100%, 50%, 0.25)`,
        textShadow: `0 0 8px hsla(${hue}, 100%, 75%, 0.5)`,
        borderWidth: '1.5px'
    };
};

const NoteCard: React.FC<NoteCardProps> = ({ 
  note, folders = [], onDelete, onTagClick, onEdit, onExpand, 
  readOnly = false, onToggleCheckbox, onToggleComplete, onMoveToFolder, onChangeColor, onUpdateColors
}) => {
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);

  const COLORS = ["#000000", "#ffffff", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef"];
  const BG_COLORS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#e9d5ff", "#fed7aa", "#cbd5e1", "#ffffff", "#000000"];

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

  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return;
    setIsDragging(true);
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const markdownComponents = {
      p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      div: ({ node, "aria-c": ariaC, ...props }: any) => <div {...props} />,
      td: ({ node, vAlign, ...props }: any) => <td valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      th: ({ node, vAlign, ...props }: any) => <th valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      policyid: ({ node, ...props }: any) => <span {...props} />,
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
      className={`relative group p-md rounded-xl shadow-lg transition-all min-h-[280px] flex flex-col cursor-pointer hover:shadow-xl hover:-translate-y-1 ${!note.backgroundColor ? NOTE_COLORS[note.color] || 'bg-surface-container-low text-on-surface border border-outline-variant' : 'border border-outline-variant'} ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isFinished ? 'ring-2 ring-secondary/50' : ''} ${isMatrix ? 'font-mono' : ''} ${note.isSynthesized ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
    >
      <div className="flex justify-between items-start mb-md border-b border-outline-variant pb-sm">
        <div className="flex-1 min-w-0 pr-sm">
            <h3 className={`text-h3 font-h3 font-bold leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
            {note.isSynthesized && <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary block mt-1">✨ Synthesized Idea</span>}
        </div>
        {folderName && (
            <div className="flex items-center gap-1 px-2 py-1 bg-surface-variant rounded border border-outline text-label-caps text-on-surface-variant shrink-0">
                <span className="material-symbols-outlined text-[12px]">folder</span>
                {folderName}
            </div>
        )}
      </div>

      {note.type === 'project' && note.projectData && (
        <div className="mb-md space-y-sm bg-surface-dim rounded-lg p-sm border border-outline">
            <div className="space-y-1">
                <div className="flex justify-between items-center text-label-caps text-on-surface-variant">
                    <span>Progress</span>
                    <span>{calculateProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full transition-all duration-1000 ease-out ${isMatrix ? 'bg-primary' : 'bg-secondary'}`} 
                        style={{ width: `${calculateProgress}%` }}
                    />
                </div>
            </div>
        </div>
      )}

      <div className={`prose prose-sm max-w-none flex-grow text-body-md ${note.type === 'project' ? 'line-clamp-4' : 'line-clamp-[8]'} overflow-hidden mb-4 mt-1 ${isMatrix ? 'text-[#39ff14]' : 'text-on-surface'} whitespace-pre-wrap`}>
         <ReactMarkdown 
           remarkPlugins={[remarkGfm]} 
           rehypePlugins={[rehypeRaw]}
           components={markdownComponents}
         >
           {cleanMarkdownText(note.content)}
         </ReactMarkdown>
      </div>

      <div className="mt-auto">
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-xs mb-md">
            {note.tags.map(tag => {
              const style = getTagStyle(tag);
              return (
                <button 
                  key={tag} 
                  onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                  style={isMatrix ? {} : style}
                  className={`text-label-caps px-2 py-0.5 rounded border transition-all hover:scale-105 active:scale-95 ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14] border-[#39ff14]/30' : ''}`}
                >
                  #{tag.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-sm border-t border-outline-variant">
            <div className="text-[10px] text-outline font-bold uppercase tracking-widest">{new Date(note.createdAt).toLocaleDateString()}</div>
            <div className="flex items-center gap-1 shrink-0 relative">
            <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowCustomColorPicker(false); }} className={`p-1.5 flex items-center justify-center rounded hover:bg-surface-variant transition-colors text-on-surface-variant`} aria-label="Change Color" title="Change Color"><span className="material-symbols-outlined text-[18px]">palette</span></button>
                {showColorPicker && (
                    <div className="absolute bottom-full right-0 mb-3 p-3 bg-surface-container-highest rounded-xl shadow-2xl border border-outline-variant flex flex-col gap-3 w-44 z-50">
                        <div className="flex flex-wrap gap-1.5">
                            {Object.values(NoteColor).map((c) => (
                                <button key={c} onClick={(e) => { e.stopPropagation(); onChangeColor(note.id, c); onUpdateColors?.(note.id, undefined, undefined); setShowColorPicker(false); }} className={`w-7 h-7 rounded border border-outline transition-transform hover:scale-110 ${c === 'matrix' ? 'bg-black border-[#39ff14]' : `bg-${c}-200`}`} title={c} />
                            ))}
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowCustomColorPicker(true); setShowColorPicker(false); }}
                            className="text-label-caps py-2 bg-surface hover:bg-surface-variant rounded border border-outline transition-colors text-on-surface"
                        >
                            Custom Colors
                        </button>
                    </div>
                )}
                {showCustomColorPicker && (
                    <div className="absolute bottom-full right-0 mb-3 p-4 bg-surface-container-highest rounded-xl shadow-2xl border border-outline-variant flex flex-col gap-4 w-56 z-50">
                        <div>
                            <div className="text-[9px] font-black uppercase text-outline mb-2">Text Color</div>
                            <div className="flex flex-wrap gap-1.5">
                                {COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, c, note.backgroundColor); }} 
                                        className={`w-6 h-6 rounded-full border border-black/10 ${note.textColor === c ? 'ring-2 ring-primary' : ''}`} 
                                        style={{backgroundColor: c}} 
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black uppercase text-outline mb-2">Background Color</div>
                            <div className="flex flex-wrap gap-1.5">
                                {BG_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, note.textColor, c); }} 
                                        className={`w-6 h-6 rounded border border-black/10 ${note.backgroundColor === c ? 'ring-2 ring-primary' : ''}`} 
                                        style={{backgroundColor: c}} 
                                    />
                                ))}
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUpdateColors?.(note.id, undefined, undefined); setShowCustomColorPicker(false); }}
                            className="text-[9px] font-black uppercase tracking-widest py-2 text-error hover:bg-error-container rounded transition-colors border border-error-container"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className={`p-1.5 flex items-center justify-center rounded hover:bg-surface-variant transition-colors text-on-surface-variant`} aria-label="Edit Note" title="Edit Note"><span className="material-symbols-outlined text-[18px]">edit</span></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-1.5 flex items-center justify-center rounded hover:bg-error-container hover:text-on-error-container transition-colors text-error" aria-label="Delete Note" title="Delete Note"><span className="material-symbols-outlined text-[18px]">delete</span></button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;