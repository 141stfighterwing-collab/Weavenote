import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, Folder } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cleanMarkdownText } from '../utils/markdownUtils';

interface NotebookViewProps {
  notes: Note[];
  folders: Folder[];
  onAddNote: (text: string, type: 'notebook', attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string) => Promise<Note | undefined>;
  onEdit: (note: Note) => void;
  onUpdateNote?: (id: string, title: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onToggleCheckbox: (noteId: string, index: number) => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({ 
  notes, onAddNote, onEdit, onUpdateNote, onDelete, onToggleCheckbox 
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Highlighting states
  const [activePenColor, setActivePenColor] = useState<string | null>(null);
  const [showHighlighterToolbar, setShowHighlighterToolbar] = useState(false);
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const namingInputRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const sortedNotes = useMemo(() => {
    return [...notes]
      .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [notes, searchQuery]);

  useEffect(() => {
    if (notes.length > 0) {
      const selectionExists = notes.some(n => n.id === selectedNoteId);
      if (!selectedNoteId || !selectionExists) {
        if (!isCreating && !isNaming && sortedNotes.length > 0) {
          setSelectedNoteId(sortedNotes[0].id);
        }
      }
    } else {
      setSelectedNoteId(null);
    }
  }, [notes, sortedNotes, selectedNoteId, isCreating, isNaming]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        if (activePenColor) setActivePenColor(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isFullscreen) {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, activePenColor, hasPendingChanges, selectedNoteId]);

  useEffect(() => {
    if (isNaming && namingInputRef.current) {
      namingInputRef.current.focus();
    }
  }, [isNaming]);

  const selectedNote = useMemo(() => 
    notes.find(n => n.id === selectedNoteId)
  , [notes, selectedNoteId]);

  const handleMouseUp = () => {
    if (!isFullscreen || !selectedNote) return;
    
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      if (activePenColor) {
        applyHighlightToSelection(activePenColor);
      } else {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 45 });
        setShowHighlighterToolbar(true);
      }
    } else {
      setShowHighlighterToolbar(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isFullscreen, selectedNote, activePenColor]);

  const startNaming = () => {
    setNewTitle('');
    setIsNaming(true);
  };

  const cancelNaming = () => {
    setIsNaming(false);
    setNewTitle('');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isCreating) return;
    
    setIsCreating(true);
    setIsNaming(false);
    
    try {
      const newNote = await onAddNote('', 'notebook', [], [], false, newTitle.trim());
      if (newNote) {
        setSelectedNoteId(newNote.id);
        showFeedback('success', 'Page Created');
      }
    } catch (err) {
      showFeedback('error', 'Failed to create page');
    } finally {
      setIsCreating(false);
      setNewTitle('');
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleManualSave = async () => {
    if (!selectedNote || !onUpdateNote || isSaving) return;
    setIsSaving(true);
    try {
      await onUpdateNote(selectedNote.id, selectedNote.title, selectedNote.content);
      setHasPendingChanges(false);
      showFeedback('success', 'Changes Saved');
    } catch (e) {
      showFeedback('error', 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const applyHighlightToSelection = async (color: string) => {
    if (!selectedNote || !onUpdateNote) return;
    const selection = window.getSelection();
    if (!selection) return;
    
    const selectedText = selection.toString();
    if (!selectedText || selectedText.trim().length === 0) return;
    
    let newContent = selectedNote.content;
    
    if (color === 'transparent') {
      const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const eraserRegex = new RegExp(`<mark[^>]*>(${escaped})</mark>`, 'g');
      newContent = selectedNote.content.replace(eraserRegex, '$1');
    } else {
      const highlightTag = `<mark style="background-color: ${color}; color: black; border-radius: 2px; padding: 0 2px;">${selectedText}</mark>`;
      if (selectedNote.content.includes(highlightTag)) {
        showFeedback('error', 'Already highlighted');
        return;
      }
      newContent = selectedNote.content.replace(selectedText, highlightTag);
    }
    
    if (newContent !== selectedNote.content) {
      setHasPendingChanges(true);
      await onUpdateNote(selectedNote.id, selectedNote.title, newContent);
      showFeedback('success', color === 'transparent' ? 'Eraser Applied' : 'Pen Applied');
    } else {
      showFeedback('error', 'Could not apply to existing tags');
    }
    
    setShowHighlighterToolbar(false);
    selection.removeAllRanges(); 
  };

  const highlighterColors = [
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Orange', value: '#fed7aa' }
  ];

  const markdownComponents = {
      div: ({ node, "aria-c": ariaC, ...props }: any) => <div {...props} />,
      td: ({ node, vAlign, ...props }: any) => <td valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      th: ({ node, vAlign, ...props }: any) => <th valign={vAlign ? String(vAlign).toLowerCase() : undefined} {...props} />,
      policyid: ({ node, ...props }: any) => <span {...props} />,
      input: (props: any) => {
          if (props.type === 'checkbox') {
              return <input type="checkbox" checked={props.checked} readOnly className="mt-1 h-4 w-4 rounded text-primary-600 focus:ring-primary-500" />;
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
                  <div className="my-6">
                      <img src={href} alt="Preview" className="max-w-full h-auto rounded-lg border shadow-lg" />
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block text-[10px] opacity-40 mt-1 hover:underline">{href}</a>
                  </div>
              );
          }
          if (ytId) {
              return (
                  <div className="my-6 aspect-video w-full rounded-lg overflow-hidden shadow-lg border">
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} frameBorder="0" allowFullScreen></iframe>
                  </div>
              );
          }
          if (isVideoUrl) {
              return (
                  <div className="my-6 w-full">
                      <video controls className="w-full rounded-lg shadow-lg border">
                          <source src={href} />
                      </video>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block text-[10px] opacity-40 mt-1 hover:underline">{href}</a>
                  </div>
              );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 font-bold hover:underline">{children}</a>;
      },
      code: ({node, inline, className, children, ...props}: any) => {
          return !inline ? (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 my-4 overflow-x-auto shadow-lg relative group">
              <code className="text-indigo-200 text-sm font-mono leading-normal whitespace-pre">
                {children}
              </code>
            </div>
          ) : (
            <code className="bg-black/10 px-1.5 py-0.5 rounded text-primary-700 font-mono text-xs">
              {children}
            </code>
          )
      }
  };

  return (
    <div className={`flex bg-surface-container rounded-2xl border border-outline-variant overflow-hidden shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[110] h-screen' : 'h-[calc(100vh-180px)]'}`}>
      
      {/* Dynamic Feedback Toast */}
      {feedback && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-[badgePop_0.3s_ease-out] border ${feedback.type === 'success' ? 'bg-secondary-container text-on-secondary-container border-secondary' : 'bg-error-container text-on-error-container border-error'}`}>
          {feedback.type === 'success' ? '✓' : '⚠️'} {feedback.message}
        </div>
      )}

      {/* Floating Quick Action Toolbar (Appears on Selection) */}
      {showHighlighterToolbar && isFullscreen && !activePenColor && (
        <div 
          className="fixed z-[125] bg-surface-container-highest border border-outline flex shadow-2xl rounded-full p-1.5 gap-1 animate-[fadeIn_0.1s_ease-out] ring-4 ring-black/5"
          style={{ left: selectionPos.x, top: selectionPos.y, transform: 'translateX(-50%)' }}
        >
          {highlighterColors.map(c => (
            <button 
              key={c.value}
              onClick={() => applyHighlightToSelection(c.value)}
              className="w-7 h-7 rounded-full border border-black/5 hover:scale-125 transition-transform shadow-inner"
              style={{ backgroundColor: c.value }}
            />
          ))}
          <div className="w-px h-6 bg-outline-variant mx-1" />
          <button 
            onClick={() => applyHighlightToSelection('transparent')}
            className="w-7 h-7 rounded-full bg-surface-variant flex items-center justify-center hover:scale-110 transition-transform text-outline"
            title="Erase Highlight"
          >
            <span className="material-symbols-outlined text-[16px]">ink_eraser</span>
          </button>
        </div>
      )}

      {/* Page Navigator Sidebar */}
      {!isFullscreen && (
        <div className="w-72 border-r border-outline-variant flex flex-col bg-surface-container-low animate-[fadeIn_0.2s_ease-out]">
          <div className="p-4 border-b border-outline-variant space-y-3">
            <button 
              onClick={startNaming}
              disabled={isCreating || isNaming}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-container disabled:bg-primary/50 text-on-primary rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isCreating ? (
                <svg className="animate-spin h-4 w-4 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <span className="material-symbols-outlined text-[16px]">add</span>
              )}
              {isCreating ? 'Creating...' : 'Add Page'}
            </button>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Find pages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-surface-dim border border-outline rounded-md text-xs outline-none focus:border-primary text-on-surface"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1.5 text-outline text-[16px]">search</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-black text-outline uppercase tracking-widest mb-1">Titles A-Z</div>
            
            {isNaming && (
              <div className="px-2 py-1 animate-[fadeIn_0.1s_ease-out]">
                <form onSubmit={handleCreateSubmit} className="relative">
                  <input 
                    ref={namingInputRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && cancelNaming()}
                    placeholder="Page title..."
                    className="w-full pl-3 pr-8 py-2 bg-surface-dim border-2 border-primary rounded-lg text-sm outline-none shadow-lg text-on-surface"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1.5 text-primary hover:text-primary-container"
                  >
                    <span className="material-symbols-outlined text-[18px]">done</span>
                  </button>
                </form>
                <p className="text-[9px] text-outline mt-1 px-1">Press Enter to save, Esc to cancel</p>
              </div>
            )}

            {sortedNotes.map(note => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 group ${
                  selectedNote?.id === note.id 
                  ? 'bg-surface-container-highest shadow-sm text-primary font-bold ring-1 ring-primary/50' 
                  : 'text-on-surface-variant hover:bg-surface-dim'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedNote?.id === note.id ? 'bg-primary' : 'bg-outline'}`} />
                <span className="truncate flex-1">{note.title}</span>
              </button>
            ))}
            {sortedNotes.length === 0 && !isNaming && (
              <p className="text-center py-10 text-xs text-outline italic">No pages found</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 ${isFullscreen ? 'bg-surface-dim p-4 sm:p-12' : 'bg-surface-dim p-6'} overflow-y-auto custom-scrollbar flex justify-center transition-all ${activePenColor ? 'cursor-crosshair' : ''}`}>
        {selectedNote ? (
          <div className={`w-full relative group animate-[fadeIn_0.2s_ease-out] mb-20 ${isFullscreen ? 'max-w-5xl' : 'max-w-none'}`}>
             
             {/* Pen Palette (Persistent Sidebar in Fullscreen) */}
             {isFullscreen && (
               <div className="absolute -left-14 top-0 flex flex-col gap-3 p-2.5 bg-surface-container-low border border-outline rounded-2xl shadow-xl animate-[fadeIn_0.3s_ease-out] z-30">
                  <div className="text-[8px] font-black uppercase text-outline text-center mb-1 leading-none">Tool<br/>Belt</div>
                  {highlighterColors.map(c => (
                    <button 
                      key={c.value}
                      onClick={() => setActivePenColor(activePenColor === c.value ? null : c.value)}
                      className={`w-8 h-12 rounded-xl border-2 transition-all group flex flex-col items-center justify-between py-1.5 ${activePenColor === c.value ? 'scale-110 border-primary shadow-lg -translate-x-1 bg-surface-dim' : 'border-outline-variant hover:bg-surface-variant'}`}
                      style={{ backgroundColor: activePenColor === c.value ? c.value + '20' : 'transparent' }}
                      title={`Toggle ${c.name} Pen (armed mode)`}
                    >
                      <div className="w-4 h-4 rounded-full shadow-inner border border-black/5" style={{ backgroundColor: c.value }} />
                      <div className={`w-5 h-2 bg-black/10 rounded-full transition-all ${activePenColor === c.value ? 'bg-primary scale-110' : ''}`} />
                    </button>
                  ))}
                  <div className="h-px bg-outline-variant mx-1" />
                  <button 
                    onClick={() => setActivePenColor(activePenColor === 'transparent' ? null : 'transparent')}
                    className={`w-8 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${activePenColor === 'transparent' ? 'border-error bg-error-container/20 text-error' : 'border-outline-variant hover:bg-surface-variant text-outline'}`}
                    title="Eraser Tool"
                  >
                    <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
                  </button>
                  
                  <div className="mt-4 pt-4 border-t border-outline-variant flex flex-col gap-2">
                    <button 
                      onClick={handleManualSave}
                      disabled={isSaving || !hasPendingChanges}
                      className={`w-8 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${hasPendingChanges ? 'border-secondary bg-secondary-container/20 text-secondary' : 'border-outline-variant text-outline cursor-not-allowed opacity-40'}`}
                      title="Commit Highlights (Ctrl+S)"
                    >
                      {isSaving ? (
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">save</span>
                      )}
                    </button>
                  </div>
               </div>
             )}

             {/* Spiral Rings Visual */}
             <div className="absolute left-0 top-10 bottom-10 w-10 flex flex-col justify-around items-center z-20 pointer-events-none pr-4">
                {[...Array(isFullscreen ? 20 : 12)].map((_, i) => (
                   <div key={i} className="w-8 h-4 bg-gradient-to-r from-surface-variant to-surface rounded-full shadow-md border border-outline transform -rotate-12" />
                ))}
             </div>

             {/* The Paper Sheet */}
             <div 
                ref={paperRef}
                className={`bg-surface-container-highest min-h-[1400px] shadow-2xl rounded-sm border border-outline relative pl-16 pr-12 py-12 w-full transition-all selection:bg-primary/50`}
                style={{
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(144, 143, 160, 0.2) 31px, rgba(144, 143, 160, 0.2) 32px)',
                  backgroundAttachment: 'local',
                  lineHeight: '32px'
                }}
             >
                {/* Margin Line */}
                <div className="absolute left-16 top-0 bottom-0 w-px bg-error/50 shadow-[1px_0_0_rgba(130,130,130,0.2)]" />
                
                <div className="relative z-10 font-hand text-on-surface w-full">
                  <div className="flex justify-between items-start mb-12">
                    <h2 className="text-4xl font-bold border-b-2 border-primary/30 pb-2 flex-1 mr-4">{selectedNote.title}</h2>
                    <div className="flex gap-1">
                       <button 
                        onClick={() => setIsFullscreen(!isFullscreen)} 
                        className={`p-2 rounded-full transition-colors ${isFullscreen ? 'bg-primary/20 text-primary shadow-inner' : 'hover:bg-surface-variant text-outline'}`}
                        title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
                       >
                          <span className="material-symbols-outlined text-[20px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                       </button>
                       {!isFullscreen && (
                         <>
                           <button onClick={() => onEdit(selectedNote)} className="p-2 hover:bg-surface-variant rounded-full text-outline transition-colors">
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                           </button>
                           <button onClick={() => onDelete(selectedNote.id)} className="p-2 hover:bg-error-container rounded-full text-outline hover:text-error transition-colors">
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                           </button>
                         </>
                       )}
                    </div>
                  </div>

                  {isFullscreen && (
                    <div className="flex items-center gap-3 mb-6">
                       <p className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border shadow-sm transition-all ${activePenColor ? 'bg-primary text-on-primary border-primary scale-105' : 'bg-surface-dim text-outline border-outline-variant opacity-60'}`}>
                         {activePenColor === 'transparent' ? 'Eraser Active' : activePenColor ? 'Armed Pen Active' : 'Pen Holstered'}
                       </p>
                       {hasPendingChanges && <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20 animate-pulse">Unsaved Highlighting</span>}
                       {!activePenColor && !hasPendingChanges && <span className="text-[9px] text-outline italic">Select a pen from the left for rapid multi-line highlighting</span>}
                       {activePenColor && <button onClick={() => setActivePenColor(null)} className="text-[9px] font-black text-primary hover:underline uppercase tracking-widest">Put Pen Away</button>}
                    </div>
                  )}

                  <div className={`prose prose-lg max-w-none prose-invert w-full ${isFullscreen ? 'prose-xl' : ''}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      rehypePlugins={[rehypeRaw]}
                      components={markdownComponents}
                    >
                        {cleanMarkdownText(selectedNote.content)}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-24 flex flex-wrap gap-2 pt-4 border-t border-outline/30 opacity-40">
                    {selectedNote.tags.map(t => (
                      <span key={t} className="text-sm font-bold text-primary">#{t}</span>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-30 mt-20">
             <span className="material-symbols-outlined text-9xl mb-4">book</span>
             <p className="text-xl font-bold text-on-surface">Select or Create a Page</p>
             <button 
              onClick={startNaming} 
              disabled={isCreating || isNaming}
              className="mt-4 px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-lg hover:bg-primary-container transition-all active:scale-95 disabled:opacity-50"
             >
               Create First Page
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookView;