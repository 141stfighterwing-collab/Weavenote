import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cleanMarkdownText } from '../utils/markdownUtils';
import { Note, NOTE_COLORS, ProjectData, Folder } from '../types';
import { getTagStyle } from './NoteCard';
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
    onToggleCheckbox, onUpdateProjectData, currentUser 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkboxCounter = useRef(0);
  const [activeTab, setActiveTab] = useState<'content' | 'infrastructure'>('content');

  const folderName = useMemo(() => {
    if (!note?.folderId || !folders) return null;
    return folders.find(f => f.id === note.folderId)?.name;
  }, [note, folders]);

  if (!isOpen || !note) return null;
  
  const colorClass = NOTE_COLORS[note.color];
  const isMatrix = note.color === 'matrix' || note.type === 'code';
  const isCompleted = note.projectData?.isCompleted;

  const modalStyle: React.CSSProperties = {
    backgroundColor: note.backgroundColor || undefined,
    color: note.textColor || undefined,
  };

  const markdownComponents = {
      p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
      div: ({ node, "aria-c": ariaC, ...props }: any) => <div {...props} />,
      td: ({ node, vAlign, ...props }: any) => <td valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      th: ({ node, vAlign, ...props }: any) => <th valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      policyid: ({ node, ...props }: any) => <span {...props} />,
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return (
                <button 
                  onClick={(e) => { e.stopPropagation(); if (note) onToggleCheckbox(note.id, index); }}
                  className="inline-flex items-center justify-center mr-2 transform active:scale-75 transition-transform text-lg align-middle"
                >
                  {props.checked ? '✅' : '⬜'}
                </button>
              );
          }
          return <input {...props} />;
      },
      a: ({ href, children }: any) => {
          if (!href) return <span>{children}</span>;
          const isImageUrl = /\.(jpeg|jpg|gif|png|webp|svg|avif|bmp|tiff)(\?.*)?$/i.test(href);
          if (isImageUrl) return <img src={href} alt="Preview" className="max-w-full h-auto rounded-xl border border-black/10 shadow-lg cursor-pointer" onClick={() => onViewImage(href)} />;
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        style={modalStyle}
        className={`relative w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${isMatrix ? 'bg-black text-[#39ff14] font-mono' : (!note.backgroundColor ? colorClass : '') + ' font-sans'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-start p-6 pb-4 border-b border-outline/30 ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-surface-container-low'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-primary-container text-on-primary-container'}`}>{note.type}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{note.category}</span>
                    {folderName && (
                        <>
                            <span className="text-outline">/</span>
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-70">
                                <span className="material-symbols-outlined text-[12px]">folder</span>
                                {folderName}
                            </span>
                        </>
                    )}
                </div>
                <h2 className={`text-2xl font-black mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isMatrix ? 'hover:bg-[#39ff14]/10 text-[#39ff14]' : 'hover:bg-surface-variant'}`}><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>

        {note.type === 'project' && (
            <div className={`flex px-6 border-b border-outline/30 ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-surface-container-low'}`}>
                <button onClick={() => setActiveTab('content')} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'content' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface'}`}>Description</button>
                <button onClick={() => setActiveTab('infrastructure')} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'infrastructure' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface'}`}>Infrastructure</button>
            </div>
        )}

        <div className={`p-8 overflow-y-auto custom-scrollbar flex-grow ${isMatrix ? 'bg-black' : 'bg-surface-dim'}`}>
            {activeTab === 'content' ? (
                <>
                    <div className={`prose prose-lg max-w-none opacity-95 ${isMatrix ? 'text-[#39ff14] prose-invert' : 'prose-invert'} w-full`}>
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeRaw]} 
                            components={markdownComponents}
                        >
                            {cleanMarkdownText(processContent(note.content))}
                        </ReactMarkdown>
                    </div>
                </>
            ) : (
                <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
                    <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 text-outline">Timeline Visualization</h3>
                        {note.projectData && <GanttChart data={note.projectData} />}
                    </div>
                    
                    <div className="p-6 bg-surface-container-low rounded-2xl border border-outline-variant">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 text-outline">Architectural Workflow</h3>
                        {note.projectData?.workflow && onUpdateProjectData && (
                            <WorkflowEditor 
                                nodes={note.projectData.workflow.nodes} 
                                edges={note.projectData.workflow.edges} 
                                onUpdate={(n, e) => onUpdateProjectData(note.id, { ...note.projectData!, workflow: { nodes: n, edges: e } })}
                            />
                        )}
                    </div>
                </div>
            )}
            
            <div className={`mt-12 pt-6 border-t border-black/5 ${note.tags.length === 0 ? 'hidden' : ''}`}>
                <div className="flex flex-wrap gap-2">
                    {note.tags.map(tag => {
                        const style = getTagStyle(tag);
                        return (
                          <span 
                            key={tag} 
                            style={isMatrix ? {} : style}
                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${isMatrix ? 'bg-[#39ff14]/10 text-[#39ff14] border-[#39ff14]/30' : ''}`}
                          >
                              #{tag}
                          </span>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;