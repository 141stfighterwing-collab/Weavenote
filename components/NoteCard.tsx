import React, { useMemo, useState, useRef } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder, ProjectItem } from '../types';
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

  const folder = useMemo(() => folders.find(f => f.id === note.folderId), [folders, note.folderId]);

  const calculateProgress = useMemo(() => {
      if (!note.projectData) return 0;
      if (note.projectData.isCompleted) return 100;
      if (typeof note.projectData.manualProgress === 'number' && note.projectData.manualProgress > 0) return note.projectData.manualProgress;
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

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked} onChange={() => onToggleCheckbox(note.id, index)} onClick={(e) => e.stopPropagation()} className={`mt-1 h-3 w-3 rounded focus:ring-primary-500 ${note.color === 'matrix' ? 'accent-[#39ff14]' : 'text-primary-600'}`} />;
          }
          return <input {...props} />;
      },
      a: ({ href, children }: any) => {
          if (!href) return <span>{children}</span>;
          const isImageUrl = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(href);
          const isVideoUrl = /\.(mp4|webm|ogg)$/i.test(href);
          const getYouTubeId = (url: string) => {
              const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
              const match = url.match(regExp);
              return (match && match[2].length === 11) ? match[2] : null;
          };
          const ytId = getYouTubeId(href);

          if (isImageUrl) {
              return (
                  <div className="my-2" onClick={(e) => e.stopPropagation()}>
                      <img src={href} alt="Preview" className="max-w-full h-auto rounded-lg border border-black/5 shadow-sm max-h-48 object-cover" />
                  </div>
              );
          }
          if (ytId) {
              return (
                  <div className="my-2 aspect-video w-full rounded-lg overflow-hidden shadow-sm" onClick={(e) => e.stopPropagation()}>
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen></iframe>
                  </div>
              );
          }
          if (isVideoUrl) {
              return (
                  <div className="my-2 w-full" onClick={(e) => e.stopPropagation()}>
                      <video controls className="w-full rounded-lg shadow-sm max-h-48">
                          <source src={href} />
                      </video>
                  </div>
              );
          }
          return <span className="text-primary-600 dark:text-primary-400 underline">{children}</span>;
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
      className={`relative group p-5 rounded-xl shadow transition-all ${NOTE_COLORS[note.color]} min-h-[260px] flex flex-col cursor-pointer border border-black/5 ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${isFinished ? 'ring-2 ring-emerald-500/50' : ''} ${isMatrix ? 'font-mono' : ''}`}
    >
      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-2">
        <div className="flex-grow min-w-0 pr-2">
           <div className="flex items-center gap-2 mb-1 flex-wrap">
             <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
             {folder && (
               <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${isMatrix ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'}`}>
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                 {folder.name}
               </span>
             )}
             <span className={`text-[10px] uppercase font-bold opacity-50 tracking-wider truncate`}>{note.category}</span>
           </div>
           <h3 className={`text-xl font-bold leading-tight line-clamp-2 ${isFinished ? 'opacity-60 line-through' : ''}`}>{note.title}</h3>
        </div>
      </div>

      {/* Project-specific Metadata Section */}
      {note.type === 'project' && note.projectData && (
        <div className="mb-4 space-y-3 animate-[fadeIn_0.3s_ease-out] bg-black/5 rounded-lg p-3 border border-black/5">
            {/* Progress Bar */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest opacity-60">
                    <span>Current Progress</span>
                    <span>{calculateProgress}%</span>
                </div>
                <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden shadow-inner">
                    <div 
                        className={`h-full transition-all duration-1000 ease-out ${isMatrix ? 'bg-[#39ff14]' : 'bg-emerald-500'}`} 
                        style={{ width: `${calculateProgress}%` }}
                    />
                </div>
            </div>

            {/* Deliverables Preview */}
            {note.projectData.deliverables && note.projectData.deliverables.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Deliverables</p>
                    <ul className="text-[10px] space-y-0.5 opacity-80">
                        {note.projectData.deliverables.slice(0, 2).map((d, i) => {
                            const label = typeof d === 'string' ? d : d.label;
                            const checked = typeof d === 'string' ? false : d.status === 'completed';
                            return (
                                <li key={i} className={`truncate flex items-center gap-1.5 ${checked ? 'line-through opacity-50' : ''}`}>
                                    <span className={isMatrix ? 'text-[#39ff14]' : 'text-emerald-600'}>{checked ? '✓' : '→'}</span> {label}
                                </li>
                            );
                        })}
                        {note.projectData.deliverables.length > 2 && (
                            <li className="text-[8px] italic opacity-50">+{note.projectData.deliverables.length - 2} more...</li>
                        )}
                    </ul>
                </div>
            )}

            {/* Milestones Preview */}
            {note.projectData.milestones && note.projectData.milestones.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Next Milestones</p>
                    <div className="flex flex-wrap gap-1">
                        {note.projectData.milestones.slice(0, 2).map((m, i) => (
                            <span key={i} className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border transition-colors ${m.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-black/5 border-black/5 text-slate-500'}`}>
                                {m.status === 'completed' ? '✓ ' : '○ '}{m.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      <div className={`prose prose-sm max-w-none flex-grow text-sm ${note.type === 'project' ? 'line-clamp-3' : 'line-clamp-[6]'} overflow-hidden mb-4 mt-1 ${isMatrix ? 'text-[#39ff14]' : 'opacity-80'} whitespace-pre-wrap`}>
         <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{note.content}</ReactMarkdown>
      </div>

      <div className="flex items-center justify-between gap-1.5 mt-auto pt-3 border-t border-black/5">
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {note.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full text-white font-bold" style={{ backgroundColor: isMatrix ? '#39ff1433' : getHashColor(tag), color: isMatrix ? '#39ff14' : 'white' }}>#{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          <button onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }} className={`p-1.5 rounded-lg shadow-sm ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/40 text-slate-600'}`}>🎨</button>
          {showColorPicker && (
            <div className="absolute bottom-full right-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border flex flex-wrap gap-1 w-36 z-50">
              {Object.values(NoteColor).map((c) => (
                <button key={c} onClick={(e) => { e.stopPropagation(); onChangeColor(note.id, c); setShowColorPicker(false); }} className={`w-6 h-6 rounded border transition-transform hover:scale-110 ${c === 'matrix' ? 'bg-black border-[#39ff14]' : `bg-${c}-200`}`} />
              ))}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className={`p-1.5 rounded-lg shadow-sm ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14]' : 'bg-white/40 text-slate-600'}`}>✏️</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-1.5 bg-red-500/10 text-red-700 rounded-lg shadow-sm">🗑️</button>
        </div>
      </div>
    </div>
  );
};

export default NoteCard;