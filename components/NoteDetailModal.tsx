import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
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

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ note, isOpen, onClose, showLinkPreviews = false, onViewImage, onToggleCheckbox, onSaveExpanded, onToggleComplete, currentUser }) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowEdges, setWorkflowEdges] = useState<WorkflowEdge[]>([]);

  // Track checkboxes
  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;

  useEffect(() => {
    if (isOpen && containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 64);
    }
    if (note?.projectData?.workflow) {
        setWorkflowNodes(note.projectData.workflow.nodes || []);
        setWorkflowEdges(note.projectData.workflow.edges || []);
    } else {
        setWorkflowNodes([]);
        setWorkflowEdges([]);
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
        alert("Deep dive failed. Please check your connection or daily limit.");
    } finally {
        setIsExpanding(false);
    }
  };

  const processedContent = useMemo(() => note ? processContent(note.content) : "", [note]);
  const colorClass = note ? NOTE_COLORS[note.color] : "";

  // Custom Components
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
                      <div className="text-center mt-1">
                        <a href={props.href} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-primary-600 underline">{props.children || 'Open Image Link'}</a>
                      </div>
                  </div>
              );
          }
          if (showLinkPreviews) {
              try {
                  const url = new URL(props.href);
                  return (
                      <a href={props.href} target="_blank" rel="noopener noreferrer" className="block my-3 no-underline group/link select-none" onClick={(e) => e.stopPropagation()}>
                          <div className="bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/10 rounded-lg overflow-hidden hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-sm transition-all flex h-16">
                              <div className="w-14 bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 border-r border-black/5 dark:border-white/5">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                              </div>
                              <div className="px-4 py-2 flex-grow min-w-0 flex flex-col justify-center">
                                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{props.children || url.hostname}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1"><span className="opacity-75">{url.hostname}</span></div>
                              </div>
                          </div>
                      </a>
                  );
              } catch(e) {}
          }
          return (
            <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium" onClick={(e) => e.stopPropagation()}>
                {props.children}
            </a>
          );
      },
      li: (props: any) => {
          return (
              <li className="flex items-start gap-2 my-1">
                  {props.children}
              </li>
          );
      },
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return (
                  <input
                    type="checkbox"
                    checked={props.checked || false}
                    onChange={() => {
                        if (note) onToggleCheckbox(note.id, index);
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
              );
          }
          return <input {...props} />;
      }
  };

  if (!isOpen || !note) return null;

  const isCompleted = note.projectData?.isCompleted;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} font-hand dark:brightness-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 pb-2 border-b border-black/5 bg-black/5">
            <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 font-sans">{note.category}</span>
                <h2 className="text-3xl font-bold leading-tight mt-1">{note.title}</h2>
                <div className="text-xs opacity-50 font-sans mt-1">
                    {new Date(note.createdAt).toLocaleDateString()} • {new Date(note.createdAt).toLocaleTimeString()}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {note.type === 'project' && onToggleComplete && (
                    <button 
                        onClick={() => onToggleComplete(note.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}
                    >
                        {isCompleted ? '✓ Completed' : 'Mark Complete'}
                    </button>
                )}
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
             {note.type === 'project' && note.projectData && (
                <div className="mb-8 font-sans">
                    {note.projectData.deliverables && note.projectData.deliverables.length > 0 && (
                        <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-black/10 mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-70">📦 Deliverables</h3>
                            <ul className="list-disc list-inside space-y-1">
                                {note.projectData.deliverables.map((item, idx) => (
                                    <li key={idx} className="text-sm">{item}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-black/10 mb-4">
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-sm font-bold uppercase tracking-wider opacity-70">📅 Project Timeline</h3>
                             {note.projectData.estimatedDuration && <span className="text-xs px-2 py-0.5 bg-black/5 rounded-full font-medium">Est: {note.projectData.estimatedDuration}</span>}
                        </div>
                        <GanttChart data={note.projectData} width={containerWidth} />
                    </div>
                    {(workflowNodes.length > 0 || workflowEdges.length > 0) && (
                        <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-black/10">
                            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-70">⚡ Workflow Map</h3>
                            <WorkflowEditor 
                                nodes={workflowNodes}
                                edges={workflowEdges}
                                onUpdate={(updatedNodes, updatedEdges) => {
                                    setWorkflowNodes(updatedNodes);
                                }}
                            />
                        </div>
                    )}
                </div>
             )}

             {note.type === 'deep' && onSaveExpanded && (
                <div className="mb-6 flex justify-end">
                    <button
                        onClick={handleDeepDive}
                        disabled={isExpanding}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {isExpanding ? (
                            <>Researching...</>
                         ) : (
                            <><span>✨</span> AI Deep Dive & Audio Script</>
                         )}
                    </button>
                </div>
             )}

             {note.attachments && note.attachments.length > 0 && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {note.attachments.map((src, idx) => (
                        <img 
                            key={idx} 
                            src={src} 
                            alt={`Attachment ${idx + 1}`} 
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewImage(src);
                            }}
                            className="w-full h-auto max-h-64 object-cover rounded-lg border border-black/10 shadow-sm cursor-zoom-in hover:opacity-95 transition-opacity bg-white/50" 
                        />
                    ))}
                </div>
            )}

            <div className="prose prose-lg max-w-none font-sans opacity-90 prose-headings:font-hand prose-headings:font-bold prose-p:my-2 prose-li:my-1 break-words">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {processedContent}
                </ReactMarkdown>
            </div>

            <div className="mt-8 pt-6 border-t border-black/5 flex flex-wrap gap-2">
                {note.tags.map(tag => (
                     <span key={tag} className="text-xs font-bold font-sans px-3 py-1 rounded-full bg-white/50 border border-black/5 shadow-sm text-slate-700">
                        #{tag}
                     </span>
                ))}
            </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NoteDetailModal;
