import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, NOTE_COLORS, ProjectData, ProjectMilestone, ProjectPhase } from '../types';
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
  onUpdateProjectData?: (id: string, data: ProjectData) => void;
  currentUser: string;
}

const processContent = (text: string) => {
    if (!text) return "";
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ 
    note, isOpen, onClose, onViewImage, 
    onToggleCheckbox, onSaveExpanded, onToggleComplete, onUpdateProjectData, currentUser 
}) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const isGuest = currentUser === 'Guest';
  const checkboxCounter = useRef(0);

  useEffect(() => {
    if (isOpen && containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 64);
    }
  }, [isOpen]);

  if (!isOpen || !note) return null;
  
  const colorClass = NOTE_COLORS[note.color];
  const isMatrix = note.color === 'matrix';
  const isCompleted = note.projectData?.isCompleted;

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return <input type="checkbox" checked={props.checked || false} onChange={() => { if (note) onToggleCheckbox(note.id, index); }} className={`mt-1 h-4 w-4 rounded cursor-pointer ${isMatrix ? 'accent-[#39ff14]' : ''}`} />;
          }
          return <input {...props} />;
      },
      code: ({node, inline, className, children, ...props}: any) => {
        return !inline ? (
          <div className={`${isMatrix ? 'bg-black border-[#39ff14]/30' : 'bg-slate-900'} p-6 rounded-2xl border my-6 overflow-x-auto shadow-2xl relative`}>
            <code className={`${className} ${isMatrix ? 'text-[#39ff14]' : 'text-indigo-300'} text-sm font-mono leading-relaxed whitespace-pre`} {...props}>
              {children}
            </code>
          </div>
        ) : (
          <code className={`${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/10 text-primary-700'} px-1.5 py-0.5 rounded font-mono text-sm`} {...props}>
            {children}
          </code>
        )
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} ${isMatrix ? 'font-mono' : 'font-hand'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-start p-6 pb-4 border-b border-black/5 ${isMatrix ? 'bg-black' : 'bg-black/5'}`}>
            <div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${isMatrix ? 'bg-[#39ff14]/20 text-[#39ff14]' : 'bg-black/40 text-white'}`}>{note.type}</span>
                </div>
                <h2 className={`text-3xl font-black mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isMatrix ? 'hover:bg-[#39ff14]/10 text-[#39ff14]' : 'hover:bg-black/10'}`}>✕</button>
        </div>

        <div className={`p-8 overflow-y-auto custom-scrollbar flex-grow ${isMatrix ? 'bg-black' : 'bg-white/10'}`}>
             <div className={`prose prose-lg max-w-none opacity-95 ${isMatrix ? 'text-[#39ff14] prose-invert' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{processContent(note.content)}</ReactMarkdown>
            </div>
            <div className="mt-12 pt-6 border-t border-black/10 flex flex-wrap gap-2">
                {note.tags.map(tag => (
                     <span key={tag} className={`text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${isMatrix ? 'bg-[#39ff14]/10 border-[#39ff14]/30 text-[#39ff14]' : 'bg-white/50 border-black/5 text-slate-700'}`}>
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