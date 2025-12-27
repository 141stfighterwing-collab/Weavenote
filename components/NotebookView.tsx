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

  // Fix: Added missing startNaming function
  const startNaming = () => {
    setNewTitle('');
    setIsNaming(true);
  };

  // Fix: Added missing cancelNaming function
  const cancelNaming = () => {
    setIsNaming(false);
    setNewTitle('');
  };

  // Fix: Added missing handleCreateSubmit function
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

    // To prevent the "stops working" issue, we need to handle existing tags.
    // If the selected text contains <mark> tags, we should probably clean them first.
    // But since selection.toString() is plain text, we need to match it carefully.
    
    let newContent = selectedNote.content;
    
    if (color === 'transparent') {
      // ERASER: Look for existing mark tags that contain this text exactly or partially
      // We use a broader approach for eraser: remove any mark tags within this range if possible.
      // For simplicity, we match the text and strip surrounding mark tags.
      const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const eraserRegex = new RegExp(`<mark[^>]*>(${escaped})</mark>`, 'g');
      newContent = selectedNote.content.replace(eraserRegex, '$1');
    } else {
      // HIGHLIGHTER: Wrap the plain text.
      // PROBLEM: If we highlight "hello" twice, we get <mark><mark>hello</mark></mark>.
      // SOLUTION: Check if the text is already wrapped.
      const highlightTag = `<mark style="background-color: ${color}; color: black; border-radius: 2px; padding: 0 2px;">${selectedText}</mark>`;
      
      // Simple guard against identical nesting
      if (selectedNote.content.includes(highlightTag)) {
        showFeedback('error', 'Already highlighted');
        return;
      }

      // We find the first occurrence that isn't already inside a mark tag.
      // This is a basic heuristic for a complex problem (text with HTML).
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
      
      {/* Dynamic Feedback Toast */}
      {feedback && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-[badgePop_0.3s_ease-out] border ${feedback.type === 'success' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400'}`}>
          {feedback.type === 'success' ? '✓' : '⚠️'} {feedback.message}
        </div>
      )}

      {/* Floating Quick Action Toolbar (Appears on Selection) */}
      {showHighlighterToolbar && isFullscreen && !activePenColor && (
        <div 
          className="fixed z-[125] bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-full p-1.5 flex gap-1 animate-[fadeIn_0.1s_ease-out] ring-4 ring-black/5"
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
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button 
            onClick={() => applyHighlightToSelection('transparent')}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:scale-110 transition-transform text-slate-400"
            title="Erase Highlight"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
          </button>
        </div>
      )}

      {/* Page Navigator Sidebar */}
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

      {/* Main Content Area */}
      <div className={`flex-1 ${isFullscreen ? 'bg-slate-200/50 dark:bg-slate-950 p-4 sm:p-12' : 'bg-slate-100 dark:bg-slate-950 p-6'} overflow-y-auto custom-scrollbar flex justify-center transition-all ${activePenColor ? 'cursor-crosshair' : ''}`}>
        {selectedNote ? (
          <div className={`w-full relative group animate-[fadeIn_0.2s_ease-out] mb-20 ${isFullscreen ? 'max-w-5xl' : 'max-w-none'}`}>
             
             {/* Pen Palette (Persistent Sidebar in Fullscreen) */}
             {isFullscreen && (
               <div className="absolute -left-14 top-0 flex flex-col gap-3 p-2.5 bg-white dark:bg-slate-800 border rounded-2xl shadow-xl animate-[fadeIn_0.3s_ease-out] z-30">
                  <div className="text-[8px] font-black uppercase text-slate-400 text-center mb-1 leading-none">Tool<br/>Belt</div>
                  {highlighterColors.map(c => (
                    <button 
                      key={c.value}
                      onClick={() => setActivePenColor(activePenColor === c.value ? null : c.value)}
                      className={`w-8 h-12 rounded-xl border-2 transition-all group flex flex-col items-center justify-between py-1.5 ${activePenColor === c.value ? 'scale-110 border-primary-500 shadow-lg -translate-x-1 bg-slate-50 dark:bg-slate-700' : 'border-black/5 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      style={{ backgroundColor: activePenColor === c.value ? c.value + '20' : 'transparent' }}
                      title={`Toggle ${c.name} Pen (armed mode)`}
                    >
                      <div className="w-4 h-4 rounded-full shadow-inner border border-black/5" style={{ backgroundColor: c.value }} />
                      <div className={`w-5 h-2 bg-black/10 rounded-full transition-all ${activePenColor === c.value ? 'bg-primary-400 scale-110' : ''}`} />
                    </button>
                  ))}
                  <div className="h-px bg-slate-100 dark:bg-slate-700 mx-1" />
                  <button 
                    onClick={() => setActivePenColor(activePenColor === 'transparent' ? null : 'transparent')}
                    className={`w-8 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${activePenColor === 'transparent' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-black/5 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    title="Eraser Tool"
                  >
                    <svg className={activePenColor === 'transparent' ? 'text-red-500' : 'text-slate-400'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>
                  </button>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                    <button 
                      onClick={handleManualSave}
                      disabled={isSaving || !hasPendingChanges}
                      className={`w-8 h-12 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${hasPendingChanges ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'border-black/5 text-slate-300 cursor-not-allowed opacity-40'}`}
                      title="Commit Highlights (Ctrl+S)"
                    >
                      {isSaving ? (
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      )}
                    </button>
                  </div>
               </div>
             )}

             {/* Spiral Rings Visual */}
             <div className="absolute left-0 top-10 bottom-10 w-10 flex flex-col justify-around items-center z-20 pointer-events-none pr-4">
                {[...Array(isFullscreen ? 20 : 12)].map((_, i) => (
                   <div key={i} className="w-8 h-4 bg-gradient-to-r from-slate-400 to-slate-200 rounded-full shadow-md border border-slate-500 transform -rotate-12" />
                ))}
             </div>

             {/* The Paper Sheet */}
             <div 
                ref={paperRef}
                className={`bg-white dark:bg-slate-50 min-h-[1400px] shadow-2xl rounded-sm border border-slate-300 dark:border-slate-200 relative pl-16 pr-12 py-12 w-full transition-all selection:bg-primary-200/50`}
                style={{
                  backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e2e8f0 31px, #e2e8f0 32px)',
                  backgroundAttachment: 'local',
                  lineHeight: '32px'
                }}
             >
                {/* Red Left Margin Line */}
                <div className="absolute left-16 top-0 bottom-0 w-px bg-rose-300 shadow-[1px_0_0_white]" />
                
                <div className="relative z-10 font-hand text-slate-800 w-full">
                  <div className="flex justify-between items-start mb-12">
                    <h2 className="text-4xl font-bold border-b-2 border-primary-100 pb-2 flex-1 mr-4">{selectedNote.title}</h2>
                    <div className="flex gap-1">
                       <button 
                        onClick={() => setIsFullscreen(!isFullscreen)} 
                        className={`p-2 rounded-full transition-colors ${isFullscreen ? 'bg-primary-100 text-primary-600 shadow-inner' : 'hover:bg-slate-100 text-slate-400'}`}
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
                    <div className="flex items-center gap-3 mb-6">
                       <p className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border shadow-sm transition-all ${activePenColor ? 'bg-primary-600 text-white border-primary-500 scale-105' : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'}`}>
                         {activePenColor === 'transparent' ? 'Eraser Active' : activePenColor ? 'Armed Pen Active' : 'Pen Holstered'}
                       </p>
                       {hasPendingChanges && <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse">Unsaved Highlighting</span>}
                       {!activePenColor && !hasPendingChanges && <span className="text-[9px] text-slate-400 italic">Select a pen from the left for rapid multi-line highlighting</span>}
                       {activePenColor && <button onClick={() => setActivePenColor(null)} className="text-[9px] font-black text-primary-600 hover:underline uppercase tracking-widest">Put Pen Away</button>}
                    </div>
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

                  <div className="mt-24 flex flex-wrap gap-2 pt-4 border-t border-slate-100 opacity-40">
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

export default NotebookView;