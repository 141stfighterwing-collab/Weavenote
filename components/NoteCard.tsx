import React, { useMemo, useState, useRef } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder, ProjectItem } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
  readOnly = false, onToggleCheckbox, onToggleComplete, onMoveToFolder, onChangeColor 
}) => {
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

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

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onExpand(note)}
      className={`relative group p-6 rounded-2xl shadow-lg transition-all ${NOTE_COLORS[note.color]} min-h-[280px] flex flex-col cursor-pointer border border-black/5 hover:shadow-xl hover:-translate-y-1 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isFinished ? 'ring-2 ring-emerald-500/50' : ''} ${isMatrix ? 'font-mono' : ''}`}
    >
      <div className="flex justify-between items-start mb-4 border-b border-black/5 pb-2">
        <h3 className={`text-xl font-black leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
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
           rehypePlugins={[rehypeRaw]}
           components={markdownComponents}
         >
           {note.content}
         </ReactMarkdown>
      </div>

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
            <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }} className={`p-2 rounded-xl shadow-sm hover:scale-110 transition-transform ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/50 text-slate-600'}`}>🎨</button>
            {showColorPicker && (
                <div className="absolute bottom-full right-0 mb-3 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border dark:border-slate-700 flex flex-wrap gap-1.5 w-44 z-50">
                {Object.values(NoteColor).map((c) => (
                    <button key={c} onClick={(e) => { e.stopPropagation(); onChangeColor(note.id, c); setShowColorPicker(false); }} className={`w-7 h-7 rounded-lg border transition-transform hover:scale-110 ${c === 'matrix' ? 'bg-black border-[#39ff14]' : `bg-${c}-200`}`} title={c} />
                ))}
                </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className={`p-2 rounded-xl shadow-sm hover:scale-110 transition-transform ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/50 text-slate-600'}`}>✏️</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-2 bg-rose-500/20 text-rose-700 rounded-xl shadow-sm hover:scale-110 transition-transform">🗑️</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;