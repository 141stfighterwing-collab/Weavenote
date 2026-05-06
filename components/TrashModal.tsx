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
      <div className="bg-surface-container-high rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-outline-variant" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <span className="text-error material-symbols-outlined text-[20px]">delete</span> Trash
            </h2>
            <p className="text-xs text-outline mt-1">Notes in trash are deleted permanently after 30 days.</p>
          </div>
          <div className="flex items-center gap-3">
            {trashedNotes.length > 0 && (
                <button 
                    onClick={() => { if(confirm("Empty all items in trash permanently?")) onEmptyTrash(); }}
                    className="px-4 py-1.5 bg-error-container text-on-error-container hover:bg-error hover:text-on-error rounded-full text-xs font-bold transition-colors"
                >
                    Empty Trash
                </button>
            )}
            <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-surface-variant text-outline transition-colors"
            >
                <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
            {trashedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-outline">
                    <span className="material-symbols-outlined text-5xl mb-4 opacity-20 text-center block">delete</span>
                    <p className="text-lg font-medium">Trash is empty</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {trashedNotes.map(note => {
                        const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - (note.deletedAt || 0)) / (1000 * 60 * 60 * 24)));
                        return (
                            <div key={note.id} className={`p-4 rounded-xl border border-outline-variant shadow-sm flex flex-col bg-surface-dim`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-on-surface truncate pr-2">{note.title || 'Untitled'}</h4>
                                    <span className="text-[10px] font-bold bg-surface-container-highest px-1.5 py-0.5 rounded text-outline shrink-0">{daysLeft}d left</span>
                                </div>
                                <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 opacity-80">{note.content.substring(0, 100)}...</p>
                                <div className="mt-auto flex justify-end gap-2">
                                    <button 
                                        onClick={() => onRestore(note.id)}
                                        className="p-1.5 bg-surface-container hover:bg-primary-container text-primary rounded-lg shadow-sm transition-all flex items-center gap-1 text-[10px] font-bold"
                                        title="Restore"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">restore</span>
                                        Restore
                                    </button>
                                    <button 
                                        onClick={() => onPermanentlyDelete(note.id)}
                                        className="p-1.5 bg-surface-container hover:bg-error-container text-error rounded-lg shadow-sm transition-all flex items-center gap-1 text-[10px] font-bold"
                                        title="Delete Permanently"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">delete_forever</span>
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