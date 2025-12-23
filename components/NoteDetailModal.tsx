import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, NOTE_COLORS, WorkflowNode, WorkflowEdge } from '../types';
import { expandNoteContent } from '../services/geminiService';
import GanttChart from './GanttChart';
import WorkflowEditor from './WorkflowEditor';

interface NoteDetailModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  showLinkPreviews?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, index: number) => void;
  onSaveExpanded?: (id: string, content: string) => void;
  onToggleComplete?: (id: string) => void;
  currentUser: string;
}

const isImageUrl = (url: string) => {
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u.pathname);
    } catch (e) {
        return false;
    }
};

const processContent = (text: string) => {
    if (!text) return "";
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ 
    note, isOpen, onClose, showLinkPreviews = false, onViewImage, 
    onToggleCheckbox, onSaveExpanded, onToggleComplete, currentUser 
}) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;

  useEffect(() => {
    if (isOpen && containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 64);
    }
  }, [isOpen, note]);

  const handleDeepDive = async () => {
    if (!note || !onSaveExpanded) return;
    setIsExpanding(true);
    try {
        const expansion = await expandNoteContent(note.content, currentUser);
        if (expansion) {
            const newContent = note.content + "\n\n" + expansion;
            onSaveExpanded(note.id, newContent);
        }
    } catch (e) {
        alert("Deep dive failed.");
    } finally {
        setIsExpanding(false);
    }
  };

  const processedContent = useMemo(() => note ? processContent(note.content) : "", [note]);
  const colorClass = note ? NOTE_COLORS[note.color] : "";

  const calculateProgress = useMemo(() => {
    if (!note?.projectData) return 0;
    if (note.projectData.isCompleted) return 100;
    if (typeof note.projectData.manualProgress === 'number') return note.projectData.manualProgress;
    
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
  }, [note]);

  const markdownComponents = {
      a: (props: any) => {
          if (!props.href) return <a {...props} />;
          if (isImageUrl(props.href)) {
              return (
                  <div onClick={(e) => e.stopPropagation()} className="my-4 block select-none group/img-link">
                      <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-800 transition-all hover:shadow-lg cursor-zoom-in"
                        onClick={() => onViewImage(props.href)}>
                        <img src={props.href} alt="Link Preview" className="w-full max-h-96 object-contain bg-slate-200 dark:bg-slate-700" loading="lazy" />
                      </div>
                  </div>
              );
          }
          return (
            <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium" onClick={(e) => e.stopPropagation()}>
                {props.children}
            </a>
          );
      },
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return (
                  <input
                    type="checkbox"
                    checked={props.checked || false}
                    onChange={() => { if (note) onToggleCheckbox(note.id, index); }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
              );
          }
          return <input {...props} />;
      },
      code: ({node, inline, className, children, ...props}: any) => {
          return !inline ? (
            <div className="bg-slate-900 dark:bg-black p-6 rounded-2xl border border-slate-700 my-6 overflow-x-auto shadow-2xl group/code relative">
              <div className="absolute top-3 right-5 text-[10px] text-indigo-400 font-bold uppercase tracking-widest opacity-80">Source Script</div>
              <code className={`${className} text-indigo-300 text-sm font-mono leading-relaxed whitespace-pre`} {...props}>
                {children}
              </code>
            </div>
          ) : (
            <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-primary-700 dark:text-primary-300 font-mono text-sm" {...props}>
              {children}
            </code>
          )
      }
  };

  if (!isOpen || !note) return null;
  const isCompleted = note.projectData?.isCompleted;

  // Ensure projectData exists for project notes
  const projectData = note.projectData || { deliverables: [], milestones: [], timeline: [] };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} font-hand dark:brightness-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 pb-4 border-b border-black/5 bg-black/5">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60 font-sans">{note.type}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-40 font-sans">• {note.category}</span>
                </div>
                <h2 className={`text-3xl font-bold leading-tight mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <div className="flex items-center gap-2">
                {note.type === 'project' && onToggleComplete && (
                  <button 
                    onClick={() => onToggleComplete(note.id)} 
                    className={`px-4 py-1.5 rounded-full text-xs font-bold font-sans transition-all shadow-md flex items-center gap-2 ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-white/80 text-slate-700 hover:bg-emerald-50'}`}
                  >
                    {isCompleted ? '✓ Completed' : 'Mark as Done'}
                  </button>
                )}
                <button onClick={handleDeepDive} disabled={isExpanding} className="px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all shadow-sm bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50">
                  {isExpanding ? '✨ Diving...' : '✨ Deep Dive'}
                </button>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-white/20 dark:bg-black/20">
             {/* Progress Bar for Projects */}
             {note.type === 'project' && (
               <div className="mb-8 p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-black/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black uppercase tracking-widest opacity-60 font-sans">Project Progress</span>
                    <span className="text-lg font-black font-sans">{calculateProgress}%</span>
                  </div>
                  <div className="w-full h-3 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${calculateProgress}%` }} />
                  </div>
               </div>
             )}

             <div className="prose prose-lg max-w-none font-sans opacity-95 prose-headings:font-hand prose-headings:font-bold prose-p:my-4 prose-li:my-2 break-words whitespace-pre-wrap">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {processedContent}
                </ReactMarkdown>
            </div>

            {/* PROJECT DASHBOARD SECTION - Force show for project notes */}
            {note.type === 'project' && (
              <div className="mt-12 space-y-10 animate-[fadeIn_0.3s_ease-out] font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white/40 dark:bg-black/20 p-6 rounded-2xl border border-black/5 shadow-sm">
                          <h4 className="text-xs font-black uppercase tracking-widest mb-4 opacity-60">Deliverables</h4>
                          <ul className="space-y-2">
                              {projectData.deliverables && projectData.deliverables.length > 0 ? projectData.deliverables.map((d, i) => (
                                  <li key={i} className="text-sm font-bold flex items-center gap-3">
                                      <span className="text-emerald-500 text-lg">▹</span> {d}
                                  </li>
                              )) : <p className="text-xs text-slate-400 italic">No deliverables extracted yet.</p>}
                          </ul>
                      </div>
                      <div className="bg-white/40 dark:bg-black/20 p-6 rounded-2xl border border-black/5 shadow-sm">
                          <h4 className="text-xs font-black uppercase tracking-widest mb-4 opacity-60">Milestones</h4>
                          <div className="space-y-3">
                              {projectData.milestones && projectData.milestones.length > 0 ? projectData.milestones.map((m, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white/30 dark:bg-black/10 p-3 rounded-xl border border-black/5">
                                      <span className="text-xs font-bold">{m.label}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] opacity-40 font-mono">{m.date}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${m.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                            {m.status.toUpperCase()}
                                        </span>
                                      </div>
                                  </div>
                              )) : <p className="text-xs text-slate-400 italic">No milestones defined yet.</p>}
                          </div>
                      </div>
                  </div>
                  
                  <div className="bg-white/40 dark:bg-black/20 p-6 rounded-2xl border border-black/5 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xs font-black uppercase tracking-widest opacity-60">Project Roadmap</h4>
                        <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Timeline Visualization</span>
                      </div>
                      {projectData.timeline && projectData.timeline.length > 0 ? (
                        <GanttChart data={projectData} width={containerWidth} />
                      ) : (
                        <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                          Timelines are generated by AI during Organization.
                        </div>
                      )}
                  </div>

                  {projectData.workflow && (
                      <div className="bg-white/40 dark:bg-black/20 p-6 rounded-2xl border border-black/5 shadow-sm">
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-xs font-black uppercase tracking-widest opacity-60">Neural Workflow Graph</h4>
                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Interaction Mapping</span>
                          </div>
                          <WorkflowEditor 
                              nodes={projectData.workflow.nodes} 
                              edges={projectData.workflow.edges} 
                              readOnly={true}
                              onUpdate={() => {}} 
                          />
                      </div>
                  )}
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-black/10 flex flex-wrap gap-2">
                {note.tags.map(tag => (
                     <span key={tag} className="text-xs font-bold font-sans px-3 py-1 rounded-full bg-white/50 border border-black/5 shadow-sm text-slate-700">
                        #{tag}
                     </span>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;