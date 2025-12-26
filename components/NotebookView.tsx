import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, Folder } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

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
  const [highlighterColor, setHighlighterColor] = useState<string>('#fef08a'); // yellow-200
  const [showHighlighterToolbar, setShowHighlighterToolbar] = useState(false);
  const [selectionPos, setSelectionPos] = useState({ x: 0, y: 0 });
  
  const namingInputRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Filtered and sorted notes for the sidebar
  const sortedNotes = useMemo(() => {
    return [...notes]
      .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [notes, searchQuery]);

  // Handle selection stability
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

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Focus the naming input when it appears
  useEffect(() => {
    if (isNaming && namingInputRef.current) {
      namingInputRef.current.focus();
    }
  }, [isNaming]);

  const selectedNote = useMemo(() => 
    notes.find(n => n.id === selectedNoteId)
  , [notes, selectedNoteId]);

  // Detection of mouse selection for highlighter
  useEffect(() => {
    const handleMouseUp = () => {
      if (!isFullscreen) return;
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPos({ x: rect.left + rect.width / 2, y: rect.top - 40 });
        setShowHighlighterToolbar(true);
      } else {
        setShowHighlighterToolbar(false);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isFullscreen]);

  const startNaming = () => {
    setIsNaming(true);
    setNewTitle('');
  };

  const cancelNaming = () => {
    setIsNaming(false);
    setNewTitle('');
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = newTitle.trim() || 'Untitled Page';
    
    setIsNaming(false);
    setIsCreating(true);
    try {
      setSearchQuery('');
      const newNote = await onAddNote("", 'notebook', [], [], false, title);
      if (newNote) {
        setSelectedNoteId(newNote.id);
      }
    } catch (error) {
      console.error("Notebook Add Page Error:", error);
    } finally {
      setIsCreating(false);
      setNewTitle('');
    }
  };

  const handleApplyHighlight = async (color: string) => {
    if (!selectedNote || !onUpdateNote) return;
    const selection = window.getSelection();
    if (!selection) return;
    
    const selectedText = selection.toString();
    if (!selectedText) return;

    // We use a simple wrap with <mark> tags
    const highlightTag = `<mark style="background-color: ${color}; color: black; border-radius: 2px; padding: 0 2px;">${selectedText}</mark>`;
    
    // Note: This is a basic replacement and might be brittle if same text exists multiple times.
    // In a production app, we would use an offset-based replacement on the raw Markdown.
    const newContent = selectedNote.content.replace(selectedText, highlightTag);
    
    await onUpdateNote(selectedNote.id, selectedNote.title, newContent);
    setShowHighlighterToolbar(false);
    selection.removeAllRanges();
  };

  const highlighterColors = [
    { name: 'Yellow', value: '#fef08a' }, // yellow-200
    { name: 'Pink', value: '#fbcfe8' },   // pink-200
    { name: 'Blue', value: '#bfdbfe' },   // blue-200
    { name: 'Green', value: '#bbf7d0' },  // green-200
    { name: 'Orange', value: '#fed7aa' }  // orange-200
  ];

  const markdownComponents = {
      input: (props: any) => {
          if (props.type === 'checkbox') {
              return <input type="checkbox" checked={props.checked} readOnly className="mt-1 h-4 w-4 rounded text-primary-600 focus:ring-primary-500" />;
          }
          return <input {...props} />;
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
    <div className={`flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[110] h-screen' : 'h-[calc(100vh-180px)]'}`}>
      
      {/* Selection Highlighter Toolbar */}
      {showHighlighterToolbar && isFullscreen && (
        <div 
          className="fixed z-[120] bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-full p-1.5 flex gap-1 animate-[fadeIn_0.1s_ease-out]"
          style={{ left: selectionPos.x, top: selectionPos.y, transform: 'translateX(-50%)' }}
        >
          {highlighterColors.map(c => (
            <button 
              key={c.value}
              onClick={() => handleApplyHighlight(c.value)}
              className="w-6 h-6 rounded-full border border-black/5 hover:scale-110 transition-transform shadow-inner"
              style={{ backgroundColor: c.value }}
              title={`Highlight ${c.name}`}
            />
          ))}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button 
            onClick={() => handleApplyHighlight('transparent')}
            className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center hover:scale-110 transition-transform"
            title="Remove Highlight"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      {/* Page Navigator */}
      {!isFullscreen && (
        <div className="w-72 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-900/50 animate-[fadeIn_0.2s_ease-out]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
            <button 
              onClick={startNaming}
              disabled={isCreating || isNaming}
              className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isCreating ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              )}
              {isCreating ? 'Creating...' : 'Add Page'}
            </button>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Find pages..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <svg className="absolute left-2.5 top-2 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Titles A-Z</div>
            
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
                    className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-800 border-2 border-primary-500 rounded-lg text-sm outline-none shadow-lg"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-2 text-primary-600 hover:text-primary-800"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
                </form>
                <p className="text-[9px] text-slate-400 mt-1 px-1">Press Enter to save, Esc to cancel</p>
              </div>
            )}

            {sortedNotes.map(note => (
              <button
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 group ${
                  selectedNote?.id === note.id 
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600 font-bold ring-1 ring-slate-200 dark:ring-slate-700' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedNote?.id === note.id ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="truncate flex-1">{note.title}</span>
              </button>
            ))}
            {sortedNotes.length === 0 && !isNaming && (
              <p className="text-center py-10 text-xs text-slate-400 italic">No pages found</p>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas */}
      <div className={`flex-1 ${isFullscreen ? 'bg-slate-200/50 dark:bg-slate-950 p-4 sm:p-12' : 'bg-slate-100 dark:bg-slate-950 p-6'} overflow-y-auto custom-scrollbar flex justify-center transition-all`}>
        {selectedNote ? (
          <div className={`w-full relative group animate-[fadeIn_0.2s_ease-out] mb-20 ${isFullscreen ? 'max-w-5xl' : 'max-w-none'}`}>
             
             {/* Highlighter Palette (Persistent in Fullscreen) */}
             {isFullscreen && (
               <div className="absolute -left-12 top-0 flex flex-col gap-2 p-2 bg-white dark:bg-slate-800 border rounded-2xl shadow-xl animate-[fadeIn_0.3s_ease-out]">
                  <div className="text-[8px] font-black uppercase text-slate-400 text-center mb-1">Pens</div>
                  {highlighterColors.map(c => (
                    <button 
                      key={c.value}
                      onClick={() => setHighlighterColor(c.value)}
                      className={`w-6 h-10 rounded-full border-2 transition-all ${highlighterColor === c.value ? 'scale-110 border-primary-500 shadow-lg' : 'border-black/5'}`}
                      style={{ backgroundColor: c.value }}
                      title={`Select ${c.name} Pen`}
                    >
                      <div className="w-full h-2 bg-black/10 mt-1 rounded-t-full" />
                    </button>
                  ))}
               </div>
             )}

             {/* Spiral Rings */}
             <div className="absolute left-0 top-10 bottom-10 w-10 flex flex-col justify-around items-center z-20 pointer-events-none pr-4">
                {[...Array(isFullscreen ? 20 : 12)].map((_, i) => (
                   <div key={i} className="w-8 h-4 bg-gradient-to-r from-slate-400 to-slate-200 rounded-full shadow-md border border-slate-500 transform -rotate-12" />
                ))}
             </div>

             {/* The Paper */}
             <div 
                ref={paperRef}
                className={`bg-white dark:bg-slate-50 min-h-[1400px] shadow-2xl rounded-sm border border-slate-300 dark:border-slate-200 relative pl-16 pr-12 py-12 w-full transition-all selection:bg-primary-200`}
                style={{
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e2e8f0 31px, #e2e8f0 32px)',
                  backgroundAttachment: 'local',
                  lineHeight: '32px'
                }}
             >
                {/* Red Margin Line */}
                <div className="absolute left-16 top-0 bottom-0 w-px bg-rose-300 shadow-[1px_0_0_white]" />
                
                <div className="relative z-10 font-hand text-slate-800 w-full">
                  <div className="flex justify-between items-start mb-12">
                    <h2 className="text-4xl font-bold border-b-2 border-primary-100 pb-2 flex-1 mr-4">{selectedNote.title}</h2>
                    <div className="flex gap-1">
                       <button 
                        onClick={() => setIsFullscreen(!isFullscreen)} 
                        className={`p-2 rounded-full transition-colors ${isFullscreen ? 'bg-primary-100 text-primary-600' : 'hover:bg-slate-100 text-slate-400'}`}
                        title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
                       >
                          {isFullscreen ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m10 14-7 7"/></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                          )}
                       </button>
                       {!isFullscreen && (
                         <>
                           <button onClick={() => onEdit(selectedNote)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                           </button>
                           <button onClick={() => onDelete(selectedNote.id)} className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                           </button>
                         </>
                       )}
                    </div>
                  </div>

                  {isFullscreen && (
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-4 bg-slate-100 w-fit px-2 rounded">
                      Highlighter Enabled: Select text with mouse to apply color
                    </p>
                  )}

                  <div className={`prose prose-lg max-w-none prose-slate w-full ${isFullscreen ? 'prose-xl' : ''}`}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]} 
                      rehypePlugins={[rehypeRaw]}
                      components={markdownComponents}
                    >
                        {selectedNote.content}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-20 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                    {selectedNote.tags.map(t => (
                      <span key={t} className="text-sm font-bold text-primary-400">#{t}</span>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-30 mt-20">
             <span className="text-9xl mb-4">📓</span>
             <p className="text-xl font-bold">Select or Create a Page</p>
             <button 
              onClick={startNaming} 
              disabled={isCreating || isNaming}
              className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-full font-bold shadow-lg hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50"
             >
               Create First Page
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
