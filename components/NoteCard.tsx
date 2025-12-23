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
  readOnly = false, onToggleCheckbox, onToggleComplete, onMoveToFolder 
}) => {
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;
  const [isDragging, setIsDragging] = useState(false);

  const folderName = useMemo(() => {
    if (!note.folderId || !folders) return null;
    return folders.find(f => f.id === note.folderId)?.name;
  }, [note.folderId, folders]);

  const calculateProgress = useMemo(() => {
      if (!note.projectData) return 0;
      if (note.projectData.isCompleted) return 100;
      
      if (typeof note.projectData.manualProgress === 'number') {
          return note.projectData.manualProgress;
      }

      const { milestones, workflow } = note.projectData;
      let completed = 0;
      let total = 0;

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
    if (onMoveToFolder) {
      onMoveToFolder(note.id, undefined);
    }
  };

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked} onChange={() => onToggleCheckbox(note.id, index)} onClick={(e) => e.stopPropagation()} className="mt-1 h-3 w-3 rounded text-primary-600 focus:ring-primary-500" />;
          }
          return <input {...props} />;
      },
      code: ({node, inline, className, children, ...props}: any) => {
          return !inline ? (
            <div className="bg-slate-800 dark:bg-black/60 p-4 rounded-xl border border-slate-700 my-3 overflow-x-auto shadow-lg group/code relative">
              <div className="absolute top-2 right-4 text-[9px] text-indigo-400 font-bold uppercase tracking-widest opacity-60">Source Block</div>
              <code className={`${className} text-indigo-200 text-[11px] font-mono leading-normal whitespace-pre`} {...props}>
                {children}
              </code>
            </div>
          ) : (
            <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-primary-700 dark:text-primary-300 font-mono text-[11px]" {...props}>
              {children}
            </code>
          )
      }
  };

  const isFinished = note.projectData?.isCompleted === true || (note.projectData?.isCompleted === undefined && calculateProgress === 100);
  const isNotebook = note.type === 'notebook';

  const commonProps = {
    draggable: !readOnly,
    onDragStart: handleDragStart,
    onDragEnd: () => setIsDragging(false),
    className: `transition-all duration-200 ${isDragging ? 'opacity-40 scale-95 rotate-1' : 'opacity-100 scale-100 rotate-0'}`
  };

  // Notebook specific UI
  if (isNotebook) {
    return (
      <div
        {...commonProps}
        onClick={() => onExpand(note)}
        className={`${commonProps.className} relative group p-6 pl-10 rounded-xl shadow-md hover:shadow-2xl transition-all bg-white border border-slate-200 cursor-pointer overflow-hidden min-h-[260px] flex flex-col`}
        style={{
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, #e2e8f0 27px, #e2e8f0 28px)',
          backgroundAttachment: 'local'
        }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-100 border-r border-slate-300 flex flex-col items-center py-4 gap-6 select-none shadow-inner">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-slate-50 border border-slate-300 shadow-inner" />
            ))}
        </div>
        
        <div className="absolute left-[38px] top-0 bottom-0 w-px bg-rose-300 shadow-[1px_0_0_white]" />

        <div className="relative z-10 flex flex-col h-full flex-1">
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col">
              {folderName && (
                <div className="flex items-center gap-1 mb-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold w-fit border border-slate-200 uppercase tracking-tighter">
                  📂 {folderName}
                  <button onClick={handleRemoveFromFolder} className="hover:text-red-500 ml-1">✕</button>
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-800 line-clamp-1 underline decoration-primary-200 underline-offset-8">
                {note.title}
              </h3>
            </div>
            <div className="flex gap-1 shrink-0">
               <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className="p-1 hover:bg-slate-100 rounded text-slate-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
               </button>
            </div>
          </div>

          <div className="prose prose-sm max-w-none flex-grow text-slate-600 line-clamp-[10] overflow-hidden whitespace-pre-wrap leading-[28px]">
             <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{note.content}</ReactMarkdown>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 pt-2">
            {note.tags.map(tag => (
              <span key={tag} className="text-[10px] font-bold text-slate-400 hover:text-primary-500 transition-colors">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Standard Card UI
  return (
    <div
      {...commonProps}
      onClick={() => onExpand(note)}
      className={`${commonProps.className} relative group p-5 rounded-xl shadow hover:shadow-xl transition-all ${NOTE_COLORS[note.color]} min-h-[220px] flex flex-col cursor-pointer border border-black/5 dark:brightness-95 overflow-hidden ${isFinished ? 'ring-2 ring-emerald-500/50' : ''}`}
    >
      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-2">
        <div className="flex-grow min-w-0 pr-2">
           <div className="flex items-center gap-2 mb-1">
             <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isFinished ? 'bg-emerald-500 text-white' : 'bg-black/40 text-white'}`}>
                {isFinished ? '✓ Finished' : note.type}
             </span>
             <span className="text-[10px] uppercase font-bold opacity-50 tracking-wider truncate">{note.category}</span>
           </div>
           <h3 className={`text-xl font-bold leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
        </div>
        
        {folderName && (
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter text-black/60 dark:text-white/60 hover:bg-black/10 transition-colors group/folder-tag border border-black/5">
            📂 {folderName}
            <button 
              onClick={handleRemoveFromFolder}
              className="ml-1 text-black/40 hover:text-red-500 transition-colors"
              title="Remove from folder"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {note.type === 'project' ? (
          <div className="space-y-4 mb-4 mt-2">
              <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5 flex flex-col">
                      <p className="text-[9px] font-bold uppercase opacity-60 mb-1">📦 Status</p>
                      <p className="text-[11px] leading-tight font-black opacity-90 truncate">
                        {isFinished ? 'COMPLETED' : 'IN PROGRESS'}
                      </p>
                  </div>
                  <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5 flex flex-col">
                      <p className="text-[9px] font-bold uppercase opacity-60 mb-1">📅 Milestone</p>
                      <p className="text-[11px] leading-tight font-medium opacity-90 truncate">
                        {note.projectData?.milestones?.[0]?.label || 'Initial Phase'}
                      </p>
                  </div>
              </div>
              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[9px] font-bold uppercase opacity-60">📊 Progress</p>
                    <span className="text-[10px] font-bold opacity-80">{calculateProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mb-2">
                      <div className={`h-full transition-all duration-700 ${isFinished ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${calculateProgress}%` }} />
                  </div>
              </div>
          </div>
      ) : (
          <div className={`prose prose-sm max-w-none flex-grow opacity-95 text-sm line-clamp-[10] overflow-hidden mb-4 mt-2 ${note.type === 'code' ? 'font-mono bg-white/40 dark:bg-black/10 p-3 rounded-lg border border-black/5 shadow-inner' : ''} whitespace-pre-wrap`}>
             <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{note.content}</ReactMarkdown>
          </div>
      )}

      <div className="flex items-center justify-between gap-1.5 mt-auto pt-3 border-t border-black/5">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold shadow-sm" style={{ backgroundColor: getHashColor(tag) }}>
                  #{tag}
              </span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {note.type === 'project' && !readOnly && (
              <button 
                  onClick={(e) => { e.stopPropagation(); onToggleComplete?.(note.id); }}
                  className={`p-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center ${isFinished ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300'}`}
                  title={isFinished ? "Undo Complete" : "Mark Complete"}
              >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17L4 12"/></svg>
              </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className="p-1.5 bg-white/80 dark:bg-black/30 hover:bg-white rounded-lg shadow-sm" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-1.5 bg-red-500/10 text-red-700 hover:bg-red-500 hover:text-white rounded-lg shadow-sm" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;