import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { customSanitizeSchema } from '../services/security';
import { Note, NOTE_COLORS, ProjectData, Folder } from '../types';
import { getTagStyle } from '../utils/styleUtils';
import GanttChart from './GanttChart';
import WorkflowEditor from './WorkflowEditor';
import { normalizeNoteContentImages } from '../utils/noteContent';

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
    const withImages = normalizeNoteContentImages(text);
    return withImages.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
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

  checkboxCounter.current = 0;
  
  const colorClass = NOTE_COLORS[note.color];
  const isMatrix = note.color === 'matrix' || note.type === 'code';
  const isCompleted = note.projectData?.isCompleted;

  const modalStyle: React.CSSProperties = {
    backgroundColor: note.backgroundColor || undefined,
    color: note.textColor || undefined,
  };

  const markdownComponents = {
      p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
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
        <div className={`flex justify-between items-start p-6 pb-4 border-b border-black/5 ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-black/5'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{note.category}</span>
                    {folderName && (
                        <>
                            <span className="text-slate-400">/</span>
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-70">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                {folderName}
                            </span>
                        </>
                    )}
                </div>
                <h2 className={`text-2xl font-black mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isMatrix ? 'hover:bg-[#39ff14]/10 text-[#39ff14]' : 'hover:bg-black/10'}`}>✕</button>
        </div>

        {note.type === 'project' && (
            <div className={`flex px-6 border-b border-black/5 ${isMatrix ? 'bg-black border-[#39ff14]/20' : 'bg-black/5'}`}>
                <button onClick={() => setActiveTab('content')} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'content' ? 'border-primary-600 text-primary-600' : 'border-transparent opacity-40 hover:opacity-100'}`}>Description</button>
                <button onClick={() => setActiveTab('infrastructure')} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'infrastructure' ? 'border-primary-600 text-primary-600' : 'border-transparent opacity-40 hover:opacity-100'}`}>Infrastructure</button>
            </div>
        )}

        <div className={`p-8 overflow-y-auto custom-scrollbar flex-grow ${isMatrix ? 'bg-black' : 'bg-white/10'}`}>
            {activeTab === 'content' ? (
                <>
                    <div className={`prose prose-lg max-w-none opacity-95 ${isMatrix ? 'text-[#39ff14] prose-invert' : ''}`}>
                        <ReactMarkdown 
                            remarkPlugins={[remarkGfm]} 
                            rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
                            components={markdownComponents}
                        >
                            {processContent(note.content)}
                        </ReactMarkdown>
                    </div>
                </>
            ) : (
                <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
                    <div className="p-6 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 opacity-60">Timeline Visualization</h3>
                        {note.projectData && <GanttChart data={note.projectData} />}
                    </div>
                    
                    <div className="p-6 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 opacity-60">Architectural Workflow</h3>
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