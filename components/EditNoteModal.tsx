import React, { useState, useEffect } from 'react';
import { Note } from '../types';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => void;
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const hasUnsavedChanges = title !== note.title || content !== note.content;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(note.id, title, content);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-out]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="text-indigo-500">✏️</span> Edit Note
            {hasUnsavedChanges && (
                <span className="ml-2 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" title="Unsaved changes"></span>
            )}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-6 overflow-hidden bg-white">
          <div className="mb-4">
            <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-lg text-slate-800 bg-slate-50 focus:bg-white"
              placeholder="Note Title"
              required
            />
          </div>
          
          <div className="mb-4 flex-grow flex flex-col min-h-0">
            <label htmlFor="content" className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Content (Markdown)</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full flex-grow px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-sm text-slate-700 bg-slate-50 focus:bg-white resize-none leading-relaxed"
              placeholder="# Markdown supported..."
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasUnsavedChanges}
              className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-md transform ${hasUnsavedChanges ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5' : 'bg-indigo-300 cursor-not-allowed'}`}
            >
              Save Changes
            </button>
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