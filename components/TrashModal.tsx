import React from 'react';
import { Note, NOTE_COLORS } from '../types';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashedNotes: Note[];
  onRestore: (id: string) => void;
  onPermanentlyDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

const TrashModal: React.FC<TrashModalProps> = ({ 
  isOpen, onClose, trashedNotes, onRestore, onPermanentlyDelete, onEmptyTrash 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="text-red-500">🗑️</span> Trash
            </h2>
            <p className="text-xs text-slate-500 mt-1">Notes in trash are deleted permanently after 30 days.</p>
          </div>
          <div className="flex items-center gap-3">
            {trashedNotes.length > 0 && (
                <button 
                    onClick={() => { if(confirm("Empty all items in trash permanently?")) onEmptyTrash(); }}
                    className="px-4 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full text-xs font-bold transition-colors"
                >
                    Empty Trash
                </button>
            )}
            <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
            {trashedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <span className="text-5xl mb-4 opacity-20 text-center block">🗑️</span>
                    <p className="text-lg font-medium">Trash is empty</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {trashedNotes.map(note => {
                        const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - (note.deletedAt || 0)) / (1000 * 60 * 60 * 24)));
                        return (
                            <div key={note.id} className={`p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col ${NOTE_COLORS[note.color]} bg-opacity-30`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-slate-800 dark:text-white truncate pr-2">{note.title || 'Untitled'}</h4>
                                    <span className="text-[10px] font-bold bg-white/50 px-1.5 py-0.5 rounded text-slate-500 shrink-0">{daysLeft}d left</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4 opacity-80">{note.content.substring(0, 100)}...</p>
                                <div className="mt-auto flex justify-end gap-2">
                                    <button 
                                        onClick={() => onRestore(note.id)}
                                        className="p-1.5 bg-white/80 hover:bg-green-100 text-green-600 rounded-lg shadow-sm transition-all flex items-center gap-1 text-[10px] font-bold"
                                        title="Restore"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                                        Restore
                                    </button>
                                    <button 
                                        onClick={() => onPermanentlyDelete(note.id)}
                                        className="p-1.5 bg-white/80 hover:bg-red-100 text-red-600 rounded-lg shadow-sm transition-all flex items-center gap-1 text-[10px] font-bold"
                                        title="Delete Permanently"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TrashModal;