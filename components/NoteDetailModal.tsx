import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Note, NOTE_COLORS, ProjectData, ProjectMilestone, ProjectPhase, Folder, ProjectItem } from '../types';

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
    onToggleCheckbox, currentUser 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkboxCounter = useRef(0);

  if (!isOpen || !note) return null;
  
  const colorClass = NOTE_COLORS[note.color];
  const isMatrix = note.color === 'matrix';
  const isCompleted = note.projectData?.isCompleted;

  const markdownComponents = {
      p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked || false} onChange={() => { if (note) onToggleCheckbox(note.id, index); }} className={`mt-1 h-4 w-4 rounded ${isMatrix ? 'accent-[#39ff14]' : ''}`} />;
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
        className={`relative w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} ${isMatrix ? 'font-mono' : 'font-sans'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-start p-6 pb-4 border-b border-black/5 ${isMatrix ? 'bg-black' : 'bg-black/5'}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{note.category}</span>
                </div>
                <h2 className={`text-2xl font-black mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isMatrix ? 'hover:bg-[#39ff14]/10 text-[#39ff14]' : 'hover:bg-black/10'}`}>✕</button>
        </div>

        <div className={`p-8 overflow-y-auto custom-scrollbar flex-grow ${isMatrix ? 'bg-black' : 'bg-white/10'}`}>
             <div className={`prose prose-lg max-w-none opacity-95 ${isMatrix ? 'text-[#39ff14] prose-invert' : ''}`}>
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw]} 
                    components={markdownComponents}
                >
                    {processContent(note.content)}
                </ReactMarkdown>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;