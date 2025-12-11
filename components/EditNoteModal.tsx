import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { processNoteWithAI } from '../services/geminiService';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string, category?: string, tags?: string[]) => void;
  currentUser: string;
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSave, currentUser }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{category: string, tags: string[]} | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setAiResult(null);
      setError(null);
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const hasUnsavedChanges = title !== note.title || content !== note.content || aiResult !== null;

  const handleAIOrganize = async () => {
      setIsProcessing(true);
      setError(null);
      try {
          const processed = await processNoteWithAI(content, [], note.type, currentUser);
          setTitle(processed.title);
          setContent(processed.formattedContent);
          setAiResult({ category: processed.category, tags: processed.tags });
      } catch (err: any) {
          setError(err.message || "AI Organization failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
        note.id, 
        title, 
        content,
        aiResult?.category,
        aiResult?.tags
    );
    onClose();
  };

  const applyFormat = (format: 'bold' | 'italic' | 'checkbox' | 'list' | 'header') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      
      let newText = '';
      let newCursorPos = end;

      switch(format) {
          case 'bold':
              newText = content.substring(0, start) + `**${selectedText}**` + content.substring(end);
              newCursorPos = end + 4; 
              break;
          case 'italic':
              newText = content.substring(0, start) + `*${selectedText}*` + content.substring(end);
              newCursorPos = end + 2;
              break;
          case 'header':
              newText = content.substring(0, start) + `### ${selectedText}` + content.substring(end);
              newCursorPos = start + selectedText.length + 4;
              break;
          case 'checkbox':
              if (selectedText.includes('\n') || start === end) {
                  const lineStart = content.lastIndexOf('\n', start - 1) + 1;
                  const prefix = "- [ ] ";
                  newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
                  newCursorPos = start + prefix.length;
              } else {
                  newText = content.substring(0, start) + `- [ ] ${selectedText}` + content.substring(end);
                  newCursorPos = end + 6;
              }
              break;
          case 'list':
               if (selectedText.includes('\n')) {
                   const lines = selectedText.split('\n');
                   const formattedLines = lines.map(line => line.trim().startsWith('- ') ? line : `- ${line}`);
                   newText = content.substring(0, start) + formattedLines.join('\n') + content.substring(end);
                   newCursorPos = start + formattedLines.join('\n').length;
               } else if (start === end) {
                   const lineStart = content.lastIndexOf('\n', start - 1) + 1;
                   const prefix = "- ";
                   newText = content.substring(0, lineStart) + prefix + content.substring(lineStart);
                   newCursorPos = start + prefix.length;
               } else {
                   newText = content.substring(0, start) + `- ${selectedText}` + content.substring(end);
                   newCursorPos = end + 2;
               }
               break;
      }

      setContent(newText);
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-out]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-indigo-500">✏️</span> Edit Note
            {hasUnsavedChanges && (
                <span className="ml-2 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" title="Unsaved changes"></span>
            )}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 m-4 mb-0">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                    </div>
                    <div className="ml-auto pl-3">
                        <div className="-mx-1.5 -my-1.5">
                            <button onClick={() => setError(null)} className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none">
                                <span className="sr-only">Dismiss</span>
                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-6 overflow-hidden bg-white dark:bg-slate-800">
          <div className="mb-4">
            <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              disabled={isProcessing}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-lg text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 disabled:opacity-50"
              placeholder="Note Title"
              required
            />
          </div>
          
          <div className="mb-4 flex-grow flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="content" className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Content</label>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button type="button" onClick={() => applyFormat('bold')} disabled={isProcessing} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-50" title="Bold">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
                    </button>
                    <button type="button" onClick={() => applyFormat('italic')} disabled={isProcessing} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-50" title="Italic">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="22"></line><line x1="14" y1="4" x2="5" y2="22"></line></svg>
                    </button>
                    <button type="button" onClick={() => applyFormat('header')} disabled={isProcessing} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 font-serif font-bold text-xs w-6 disabled:opacity-50" title="Header">
                        H3
                    </button>
                    <div className="w-px h-3 bg-slate-300 dark:bg-slate-500 mx-1"></div>
                    <button type="button" onClick={() => applyFormat('list')} disabled={isProcessing} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-50" title="Bullet List">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                    </button>
                    <button type="button" onClick={() => applyFormat('checkbox')} disabled={isProcessing} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 disabled:opacity-50" title="Checkbox">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                    </button>
                </div>
            </div>
            <textarea
              ref={textareaRef}
              id="content"
              value={content}
              disabled={isProcessing}
              onChange={(e) => setContent(e.target.value)}
              className="w-full flex-grow px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 focus:bg-white dark:focus:bg-slate-600 resize-none leading-relaxed disabled:opacity-50"
              placeholder="# Markdown supported..."
              required
            />
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700 mt-2">
            <button
                type="button"
                onClick={handleAIOrganize}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Organizing...</span>
                    </>
                ) : (
                    <>
                        <span>✨</span> AI Organize
                    </>
                )}
            </button>
            <div className="flex gap-3">
                <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                Cancel
                </button>
                <button
                type="submit"
                disabled={!hasUnsavedChanges || isProcessing}
                className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-md transform ${hasUnsavedChanges && !isProcessing ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5' : 'bg-indigo-300 dark:bg-indigo-900 cursor-not-allowed'}`}
                >
                Save Changes
                </button>
            </div>
          </div>
        </form>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default EditNoteModal;