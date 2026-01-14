import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, NOTE_COLORS, ProjectData, ProjectMilestone, ProjectPhase, Folder, ProjectItem } from '../types';
import GanttChart from './GanttChart';
import WorkflowEditor from './WorkflowEditor';

interface NoteDetailModalProps {
  note: Note | null;
  folders?: Folder[];
  isOpen: boolean;
  onClose: () => void;
  showLinkPreviews?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, index: number) => void;
  onSaveExpanded?: (id: string, content: string) => void;
  onToggleComplete?: (id: string) => void;
  onUpdateProjectData?: (id: string, data: ProjectData) => void;
  currentUser: string;
}

const processContent = (text: string) => {
    if (!text) return "";
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ 
    note, folders = [], isOpen, onClose, onViewImage, 
    onToggleCheckbox, onSaveExpanded, onToggleComplete, onUpdateProjectData, currentUser 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const checkboxCounter = useRef(0);

  useEffect(() => {
    if (isOpen && containerRef.current) setContainerWidth(containerRef.current.clientWidth - 64);
  }, [isOpen]);

  const folder = useMemo(() => folders.find(f => f.id === note?.folderId), [folders, note?.folderId]);

  if (!isOpen || !note) return null;
  
  const colorClass = NOTE_COLORS[note.color];
  const isMatrix = note.color === 'matrix';
  const isCompleted = note.projectData?.isCompleted;

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked || false} onChange={() => { if (note) onToggleCheckbox(note.id, index); }} className={`mt-1 h-4 w-4 rounded ${isMatrix ? 'accent-[#39ff14]' : ''}`} />;
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
                  <div className="my-4">
                      <img src={href} alt="Preview" className="max-w-full h-auto rounded-xl border border-black/10 shadow-lg hover:scale-[1.01] transition-transform cursor-pointer" onClick={() => onViewImage(href)} />
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block text-[10px] opacity-40 mt-2 hover:underline truncate">{href}</a>
                  </div>
              );
          }
          if (ytId) {
              return (
                  <div className="my-4 aspect-video w-full rounded-xl overflow-hidden shadow-xl border border-black/10">
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                  </div>
              );
          }
          if (isVideoUrl) {
              return (
                  <div className="my-4 w-full">
                      <video controls className="w-full rounded-xl shadow-xl border border-black/10">
                          <source src={href} />
                      </video>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block text-[10px] opacity-40 mt-2 hover:underline truncate">{href}</a>
                  </div>
              );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">{children}</a>;
      },
      code: ({node, inline, className, children, ...props}: any) => {
        return !inline ? (
          <div className={`${isMatrix ? 'bg-black border-[#39ff14]/30' : 'bg-slate-900'} p-6 rounded-2xl border my-6 overflow-x-auto shadow-2xl relative`}>
            <code className={`${className} ${isMatrix ? 'text-[#39ff14]' : 'text-indigo-300'} text-sm font-mono whitespace-pre`} {...props}>{children}</code>
          </div>
        ) : (
          <code className={`${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/10 text-primary-700'} px-1.5 py-0.5 rounded font-mono text-sm`} {...props}>{children}</code>
        )
      }
  };

  const handleWorkflowUpdate = (nodes: any[], edges: any[]) => {
      if (!onUpdateProjectData || !note.projectData) return;
      onUpdateProjectData(note.id, { ...note.projectData, workflow: { nodes, edges } });
  };

  const toggleProjectItem = (type: 'objectives' | 'deliverables', index: number) => {
    if (!note || !note.projectData || !onUpdateProjectData) return;
    const items = [...note.projectData[type]];
    const current = items[index];
    
    // Support legacy string items
    const label = typeof current === 'string' ? current : current.label;
    const status = (typeof current === 'string' ? 'pending' : current.status) === 'completed' ? 'pending' : 'completed';
    
    items[index] = { label, status } as ProjectItem;
    onUpdateProjectData(note.id, { ...note.projectData, [type]: items });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} ${isMatrix ? 'font-mono' : 'font-sans'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-start p-6 pb-4 border-b border-black/5 ${isMatrix ? 'bg-black' : 'bg-black/5'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
                    {folder && (
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${isMatrix ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-primary-600 text-white shadow-sm'}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        {folder.name}
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{note.category}</span>
                </div>
                <h2 className={`text-3xl font-black mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <div className="flex items-center gap-3">
                {note.type === 'project' && (
                    <button onClick={() => onToggleComplete?.(note.id)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-white/40 hover:bg-white text-slate-700'}`}>
                        {isCompleted ? '✓ Completed' : 'Mark Complete'}
                    </button>
                )}
                <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isMatrix ? 'hover:bg-[#39ff14]/10 text-[#39ff14]' : 'hover:bg-black/10'}`}>✕</button>
            </div>
        </div>

        <div className={`p-8 overflow-y-auto custom-scrollbar flex-grow ${isMatrix ? 'bg-black' : 'bg-white/10'}`}>
             {note.type === 'project' && note.projectData && (
                <div className="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-[fadeIn_0.3s_ease-out]">
                    <div className="space-y-6">
                        {note.projectData.objectives && note.projectData.objectives.length > 0 && (
                            <div className={`p-5 rounded-2xl border ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-white/40 border-black/5'}`}>
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3 opacity-60">🎯 Objectives</h3>
                                <ul className="space-y-2">
                                  {note.projectData.objectives.map((obj, i) => {
                                    const label = typeof obj === 'string' ? obj : obj.label;
                                    const checked = typeof obj === 'string' ? false : obj.status === 'completed';
                                    return (
                                      <li key={i} className="text-sm flex gap-3 items-center group cursor-pointer" onClick={() => toggleProjectItem('objectives', i)}>
                                        <input type="checkbox" checked={checked} readOnly className={`h-4 w-4 rounded cursor-pointer ${isMatrix ? 'accent-[#39ff14]' : 'text-primary-600'}`} />
                                        <span className={`${checked ? 'line-through opacity-50' : ''}`}>{label}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                            </div>
                        )}
                        {note.projectData.deliverables && note.projectData.deliverables.length > 0 && (
                            <div className={`p-5 rounded-2xl border ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-white/40 border-black/5'}`}>
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3 opacity-60">🎁 Deliverables</h3>
                                <ul className="space-y-2">
                                  {note.projectData.deliverables.map((del, i) => {
                                    const label = typeof del === 'string' ? del : del.label;
                                    const checked = typeof del === 'string' ? false : del.status === 'completed';
                                    return (
                                      <li key={i} className="text-sm flex gap-3 items-center group cursor-pointer" onClick={() => toggleProjectItem('deliverables', i)}>
                                        <input type="checkbox" checked={checked} readOnly className={`h-4 w-4 rounded cursor-pointer ${isMatrix ? 'accent-[#39ff14]' : 'text-primary-600'}`} />
                                        <span className={`${checked ? 'line-through opacity-50' : ''}`}>{label}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                        <div className={`p-5 rounded-2xl border ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-white/40 border-black/5'}`}>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-60">📊 Timeline</h3>
                            <GanttChart data={note.projectData} width={containerWidth / 2 - 40} />
                        </div>
                        {note.projectData.workflow && (
                            <div className={`p-5 rounded-2xl border ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-white/40 border-black/5'}`}>
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-60">🔄 Execution Workflow</h3>
                                <WorkflowEditor nodes={note.projectData.workflow.nodes} edges={note.projectData.workflow.edges} onUpdate={handleWorkflowUpdate} />
                            </div>
                        )}
                    </div>
                </div>
             )}
             <div className={`prose prose-lg max-w-none opacity-95 ${isMatrix ? 'text-[#39ff14] prose-invert' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{processContent(note.content)}</ReactMarkdown>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;