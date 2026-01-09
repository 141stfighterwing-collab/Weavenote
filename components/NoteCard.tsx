import React, { useMemo, useState, useRef } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const getHashColor = (str: string) => {
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 70%, 45%)`; 
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
      if (typeof note.projectData.manualProgress === 'number') return note.projectData.manualProgress;
      const { milestones, workflow } = note.projectData;
      let completed = 0, total = 0;
      if (workflow && workflow.nodes.length > 0) {
          total += workflow.nodes.length;
          completed += workflow.nodes.filter(n => n.status === 'done').length;
      } else if (milestones && milestones.length > 0) {
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

  const handleRemoveFromFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMoveToFolder) onMoveToFolder(note.id, undefined);
  };

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked} onChange={() => onToggleCheckbox(note.id, index)} onClick={(e) => e.stopPropagation()} className={`mt-1 h-3 w-3 rounded focus:ring-primary-500 ${note.color === 'matrix' ? 'accent-[#39ff14]' : 'text-primary-600'}`} />;
          }
          return <input {...props} />;
      },
      code: ({node, inline, className, children, ...props}: any) => {
        return !inline ? (
          <div className={`${note.color === 'matrix' ? 'bg-black border-[#39ff14]/30' : 'bg-slate-800'} p-4 rounded-xl border my-3 overflow-x-auto shadow-lg group/code relative`}>
            <code className={`${className} ${note.color === 'matrix' ? 'text-[#39ff14]' : 'text-indigo-200'} text-[11px] font-mono leading-normal whitespace-pre`} {...props}>
              {children}
            </code>
          </div>
        ) : (
          <code className={`${note.color === 'matrix' ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/10 text-primary-700'} px-1.5 py-0.5 rounded font-mono text-[11px]`} {...props}>
            {children}
          </code>
        )
      }
  };

  const isFinished = note.projectData?.isCompleted === true || (note.projectData?.isCompleted === undefined && calculateProgress === 100);
  const isMatrix = note.color === 'matrix';

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onExpand(note)}
      className={`relative group p-5 rounded-xl shadow transition-all ${NOTE_COLORS[note.color]} min-h-[220px] flex flex-col cursor-pointer border border-black/5 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isFinished ? 'ring-2 ring-emerald-500/50' : ''} ${isMatrix ? 'font-mono' : ''}`}
    >
      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-2">
        <div className="flex-grow min-w-0 pr-2">
           <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
             <span className={`text-[10px] uppercase font-bold opacity-50 tracking-wider truncate`}>{note.category}</span>
           </div>
           <h3 className={`text-xl font-bold leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
        </div>
        
        {folderName && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-colors border border-black/5 ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-black/5 text-black/60'}`}>
            📂 {folderName}
            <button onClick={handleRemoveFromFolder} className="ml-1 opacity-40 hover:text-red-500 transition-colors">✕</button>
          </div>
        )}
      </div>

      <div className={`prose prose-sm max-w-none flex-grow text-sm line-clamp-[10] overflow-hidden mb-4 mt-2 ${isMatrix ? 'text-[#39ff14]' : 'opacity-90'} whitespace-pre-wrap`}>
         <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{note.content}</ReactMarkdown>
      </div>

      <div className="flex items-center justify-between gap-1.5 mt-auto pt-3 border-t border-black/5">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: isMatrix ? '#39ff1433' : getHashColor(tag), color: isMatrix ? '#39ff14' : 'white' }}>#{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }} 
            className={`p-1.5 rounded-lg shadow-sm ${isMatrix ? 'bg-[#39ff14]/10 hover:bg-[#39ff14]/20 text-[#39ff14]' : 'bg-white/40 hover:bg-white text-slate-600'}`}
            title="Change Color"
          >
            🎨
          </button>
          {showColorPicker && (
            <div className="absolute bottom-full right-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border flex flex-wrap gap-1 w-36 z-50">
              {Object.values(NoteColor).map((c) => (
                <button 
                    key={c} 
                    onClick={(e) => { e.stopPropagation(); onChangeColor(note.id, c); setShowColorPicker(false); }}
                    className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${c === 'matrix' ? 'bg-black border-[#39ff14]' : `bg-${c}-200`}`}
                    title={c}
                />
              ))}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className={`p-1.5 rounded-lg shadow-sm ${isMatrix ? 'bg-[#39ff14]/10 hover:bg-[#39ff14]/20 text-[#39ff14]' : 'bg-white/40 hover:bg-white text-slate-600'}`} title="Edit">✏️</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className={`p-1.5 bg-red-500/10 text-red-700 hover:bg-red-500 hover:text-white rounded-lg shadow-sm`} title="Delete">🗑️</button>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;