
import React, { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Note, NOTE_COLORS } from '../types';
import { expandNoteContent } from '../services/geminiService';

interface NoteDetailModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  showLinkPreviews?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, lineIndex: number, checked: boolean) => void;
  onSaveExpanded?: (id: string, content: string) => void;
  currentUser: string;
}

// Helper to detect image URLs
const isImageUrl = (url: string) => {
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u.pathname);
    } catch (e) {
        return false;
    }
};

// Helper to auto-link raw URLs
const processContent = (text: string) => {
    if (!text) return "";
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ note, isOpen, onClose, showLinkPreviews = false, onViewImage, onToggleCheckbox, onSaveExpanded, currentUser }) => {
  const [isExpanding, setIsExpanding] = useState(false);

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

  // Custom Renderer for List Items (Same as NoteCard to keep consistent behavior)
  const LiRenderer = useCallback(({children}: any) => {
      const childrenArray = React.Children.toArray(children);
      const firstChild = childrenArray[0];

      if (typeof firstChild === 'string' && (firstChild.startsWith('[ ]') || firstChild.startsWith('[x]'))) {
          const isChecked = firstChild.startsWith('[x]');
          const textContent = firstChild.substring(3).trim(); 
          
          return (
              <li className="flex items-start gap-2 my-1 list-none">
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={(e) => {
                        // Pass -1 and toggle state to let App handle the regex replacement logic
                        if (note) onToggleCheckbox(note.id, -1, !isChecked);
                    }}
                    className="mt-1.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                  />
                  <span className={`${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''} flex-grow`}>
                      {textContent} {childrenArray.slice(1)}
                  </span>
              </li>
          );
      }
      return <li>{children}</li>;
  }, [note, onToggleCheckbox]);

  // Custom Link Renderer for "Previews"
  const LinkRenderer = useCallback((props: any) => {
      if (!props.href) return <a {...props} />;

      // 1. Always render Image Previews if URL is an image
      if (isImageUrl(props.href)) {
          return (
              <div 
                onClick={(e) => e.stopPropagation()} 
                className="my-4 block select-none group/img-link"
              >
                  <div 
                    className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-800 transition-all hover:shadow-lg cursor-zoom-in"
                    onClick={() => onViewImage(props.href)}
                  >
                    <img 
                        src={props.href} 
                        alt="Link Preview" 
                        className="w-full max-h-96 object-contain bg-slate-200 dark:bg-slate-700" 
                        loading="lazy"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5 pointer-events-none rounded-lg"></div>
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm opacity-0 group-hover/img-link:opacity-100 transition-opacity">
                        Click to Enlarge
                    </div>
                  </div>
                  <div className="text-center mt-1">
                    <a href={props.href} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-primary-600 underline">
                        {props.children || 'Open Image Link'}
                    </a>
                  </div>
              </div>
          );
      }

      // 2. Standard Web Link Preview (Only if enabled)
      if (showLinkPreviews) {
          try {
              const url = new URL(props.href);
              return (
                  <a 
                    href={props.href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block my-3 no-underline group/link select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                      <div className="bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/10 rounded-lg overflow-hidden hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-sm transition-all flex h-16">
                          {/* Icon Section */}
                          <div className="w-14 bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 border-r border-black/5 dark:border-white/5">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </div>
                          
                          {/* Text Content */}
                          <div className="px-4 py-2 flex-grow min-w-0 flex flex-col justify-center">
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {props.children || url.hostname}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                  <span className="opacity-75">{url.hostname}</span>
                                  <span className="opacity-50">•</span>
                                  <span className="uppercase tracking-wider opacity-70 text-[10px]">External Resource</span>
                              </div>
                          </div>

                          {/* Arrow Icon */}
                          <div className="pr-4 flex items-center justify-center text-slate-400 opacity-0 group-hover/link:opacity-100 transition-opacity">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </div>
                      </div>
                  </a>
              );
          } catch(e) {
              // Fallback
          }
      }

      // 3. Fallback Link
      return (
        <a 
          href={props.href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium"
          onClick={(e) => e.stopPropagation()}
        >
            {props.children}
        </a>
      );
  }, [showLinkPreviews, onViewImage]);

  const markdownComponents = useMemo(() => ({
      a: LinkRenderer,
      li: LiRenderer
  }), [LinkRenderer, LiRenderer]);

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        className={`relative w-full max-w-3xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} font-hand dark:brightness-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-2 border-b border-black/5 bg-black/5">
            <div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-60 font-sans">{note.category}</span>
                <h2 className="text-3xl font-bold leading-tight mt-1">{note.title}</h2>
                <div className="text-xs opacity-50 font-sans mt-1">
                    {new Date(note.createdAt).toLocaleDateString()} • {new Date(note.createdAt).toLocaleTimeString()}
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-black/10 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
             {/* Deep Study - Deep Dive Button */}
             {note.type === 'deep' && onSaveExpanded && (
                <div className="mb-6 flex justify-end">
                    <button
                        onClick={handleDeepDive}
                        disabled={isExpanding}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         {isExpanding ? (
                            <>
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Researching...
                            </>
                         ) : (
                            <>
                                <span>✨</span> AI Deep Dive & Audio Script
                            </>
                         )}
                    </button>
                </div>
             )}

             {/* Images */}
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

            {/* Markdown Content */}
            <div className="prose prose-lg max-w-none font-sans opacity-90 prose-headings:font-hand prose-headings:font-bold prose-p:my-2 prose-li:my-1 break-words">
                <ReactMarkdown components={markdownComponents}>
                    {processedContent}
                </ReactMarkdown>
            </div>

            {/* Tags */}
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
