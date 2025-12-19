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
        alert("Deep dive failed.");
    } finally {
        setIsExpanding(false);
    }
  };

  const processedContent = useMemo(() => note ? processContent(note.content) : "", [note]);
  const colorClass = note ? NOTE_COLORS[note.color] : "";

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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} font-hand dark:brightness-95`}
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
                {onSaveExpanded && (
                  <button onClick={handleDeepDive} disabled={isExpanding} className="px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50">
                    {isExpanding ? '✨ Diving...' : '✨ Deep Dive'}
                  </button>
                )}
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

        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-white/20 dark:bg-black/20">
             {note.type === 'project' && note.projectData && (
                <div className="mb-8 font-sans">
                    <div className="bg-white/50 dark:bg-black/20 p-4 rounded-lg border border-black/10 mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-2 opacity-70">📅 Project Timeline</h3>
                        <GanttChart data={note.projectData} width={containerWidth} />
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

            <div className="mt-8 pt-6 border-t border-black/5 flex flex-wrap gap-2">
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