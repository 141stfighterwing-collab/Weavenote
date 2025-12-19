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

const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete, onTagClick, onEdit, onExpand, readOnly = false, onToggleCheckbox, onToggleComplete }) => {
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;

  const calculateProgress = useMemo(() => {
      if (!note.projectData) return 0;
      if (note.projectData.isCompleted) return 100;
      
      // Prefer manualProgress if set (not undefined)
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

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked} onChange={() => onToggleCheckbox(note.id, index)} onClick={(e) => e.stopPropagation()} className="mt-1 h-3 w-3 rounded text-primary-600 focus:ring-primary-500" />;
          }
          return <input {...props} />;
      }
  };

  // If isCompleted is explicitly set, it overrides automatic 100% logic
  const isFinished = note.projectData?.isCompleted === true || (note.projectData?.isCompleted === undefined && calculateProgress === 100);

  return (
    <div
      onClick={() => onExpand(note)}
      className={`relative group p-5 rounded-xl shadow hover:shadow-xl transition-all ${NOTE_COLORS[note.color]} min-h-[220px] flex flex-col cursor-pointer border border-black/5 dark:brightness-95 overflow-hidden ${isFinished ? 'ring-2 ring-emerald-500/50' : ''}`}
    >
      {/* Header Area */}
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
      </div>

      {/* Body Area */}
      {note.type === 'project' && note.projectData ? (
          <div className="space-y-4 mb-4 mt-2">
              <div className="grid grid-cols-2 gap-2">
                  {note.projectData.deliverables.length > 0 && (
                      <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5 flex flex-col">
                          <p className="text-[9px] font-bold uppercase opacity-60 mb-1">📦 Outputs</p>
                          <p className="text-[11px] leading-tight font-medium opacity-90 line-clamp-2">
                            {note.projectData.deliverables.slice(0, 3).join(', ')}
                          </p>
                      </div>
                  )}
                  {note.projectData.estimatedDuration && (
                      <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5 flex flex-col">
                          <p className="text-[9px] font-bold uppercase opacity-60 mb-1">📅 Timeline</p>
                          <p className="text-[11px] leading-tight font-medium opacity-90 truncate">
                            {note.projectData.estimatedDuration}
                          </p>
                      </div>
                  )}
              </div>

              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-black/5">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[9px] font-bold uppercase opacity-60">📊 Progress</p>
                    <span className="text-[10px] font-bold opacity-80">{calculateProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden mb-2">
                      <div className={`h-full transition-all duration-700 ${isFinished ? 'bg-emerald-500' : 'bg-primary-500'}`} style={{ width: `${calculateProgress}%` }} />
                  </div>
                  {note.projectData.milestones.length > 0 && (
                    <div className="space-y-1 mt-2 border-t border-black/5 pt-1.5">
                        {note.projectData.milestones.slice(0, 2).map((m, i) => (
                            <div key={i} className="flex justify-between items-center text-[10px] opacity-80">
                                <span className="truncate pr-2">• {m.label}</span>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.status === 'completed' ? 'bg-green-500' : 'bg-slate-300'}`} />
                            </div>
                        ))}
                    </div>
                  )}
              </div>
          </div>
      ) : (
          <div className="prose prose-sm flex-grow opacity-90 text-sm line-clamp-[8] overflow-hidden mb-4 mt-2">
             <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{note.content}</ReactMarkdown>
          </div>
      )}

      {/* Footer Area with Tags and Controls */}
      <div className="flex items-center justify-between gap-1.5 mt-auto pt-3 border-t border-black/5">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {note.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold shadow-sm" style={{ backgroundColor: getHashColor(tag) }}>
                  #{tag}
              </span>
          ))}
          {note.tags.length > 3 && <span className="text-[10px] opacity-50 font-bold">+{note.tags.length - 3}</span>}
        </div>

        {/* Action Controls */}
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