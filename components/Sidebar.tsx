import React, { useMemo, useState } from 'react';
import { Note, Folder } from '../types';
import { getTagStyle } from './NoteCard';

interface SidebarProps {
  notes: Note[];
  folders: Folder[];
  onTagClick: (tag: string) => void;
  onNoteClick: (note: Note) => void;
  onFolderClick: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorderFolders: (folders: Folder[]) => void;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
  activeTag: string | null;
  activeFolderId: string | null;
  activeDate: Date | null;
  onDateClick: (date: Date | null) => void;
  className?: string;
}

const Calendar: React.FC<{ activeDate: Date | null; onDateClick: (d: Date | null) => void; notes: Note[] }> = ({ activeDate, onDateClick, notes }) => {
    const [viewDate, setViewDate] = useState(new Date());
    
    const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const days = ["S", "M", "T", "W", "T", "F", "S"];

    const noteDates = useMemo(() => {
        const set = new Set<string>();
        notes.forEach(n => set.add(new Date(n.createdAt).toDateString()));
        return set;
    }, [notes]);

    const handlePrev = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNext = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const renderDays = () => {
        const totalDays = daysInMonth(viewDate.getMonth(), viewDate.getFullYear());
        const startOffset = firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());
        const cells = [];

        for (let i = 0; i < startOffset; i++) cells.push(<div key={`empty-${i}`} className="h-7 w-7" />);

        for (let d = 1; d <= totalDays; d++) {
            const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
            const isToday = date.toDateString() === new Date().toDateString();
            const isSelected = activeDate?.toDateString() === date.toDateString();
            const hasNotes = noteDates.has(date.toDateString());

            cells.push(
                <button
                    key={d}
                    onClick={() => onDateClick(isSelected ? null : date)}
                    className={`h-7 w-7 text-[10px] font-bold rounded-full flex items-center justify-center transition-all relative ${
                        isSelected ? 'bg-primary-600 text-white shadow-md' : 
                        isToday ? 'border border-primary-500 text-primary-600' : 
                        'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                >
                    {d}
                    {hasNotes && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-400" />}
                </button>
            );
        }
        return cells;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</h4>
                <div className="flex gap-1">
                    <button onClick={handlePrev} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <button onClick={handleNext} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {days.map((day, i) => <div key={`${day}-${i}`} className="text-[9px] font-bold text-slate-400">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {renderDays()}
            </div>
            {activeDate && (
                <button onClick={() => onDateClick(null)} className="w-full mt-2 text-[10px] text-primary-600 hover:underline font-bold">Clear Date Filter</button>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ 
    notes, folders, onTagClick, onNoteClick, onFolderClick, 
    onCreateFolder, onDeleteFolder, onReorderFolders, onMoveNote,
    activeTag, activeFolderId, activeDate, onDateClick, className = "" 
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const popularTags = useMemo(() => {
    const stats: Record<string, number> = {};
    notes.forEach(note => {
      note.tags.forEach(tag => { stats[tag] = (stats[tag] || 0) + 1; });
    });
    return Object.entries(stats).sort(([, a], [, b]) => b - a).slice(0, 15);
  }, [notes]);

  const toggleFolderExpansion = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string | null) => {
    e.preventDefault();
    setDragOverFolderId(id === null ? 'null' : id);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | undefined) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId && onMoveNote) {
      onMoveNote(noteId, folderId);
    }
  };

  return (
    <aside className={`${className}`}>
      <div className="px-md mb-sm">
        <button onClick={() => onCreateFolder('New Folder')} className="w-full flex items-center gap-sm px-md py-sm bg-primary/10 text-primary rounded-lg font-bold border border-primary/20 hover:bg-primary/20 transition-colors">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Folder
        </button>
      </div>

      <div className="px-md mt-sm flex-1">
        <p className="text-label-caps text-outline mb-sm tracking-widest pl-xs">FOLDERS</p>

        {isCreatingFolder && (
          <form onSubmit={handleCreateSubmit} className="mb-3 px-sm">
            <input 
              autoFocus
              type="text" 
              value={newFolderName} 
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              onBlur={() => !newFolderName && setIsCreatingFolder(false)}
              className="w-full px-2 py-1.5 text-sm bg-surface-dim border border-outline rounded outline-none focus:border-primary text-on-surface"
            />
          </form>
        )}

        <div className="space-y-[2px]">
            <button 
                onClick={() => onFolderClick(null)} 
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, undefined)}
                className={`w-full flex items-center justify-between p-sm rounded-lg transition-colors group text-on-surface relative ${activeFolderId === null ? 'bg-surface-container before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-full' : 'hover:bg-surface-container'} ${dragOverFolderId === 'null' ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
            >
                <div className={`flex items-center gap-sm ${activeFolderId === null ? 'ml-1' : ''}`}>
                    <span className={`material-symbols-outlined text-[18px] ${activeFolderId === null ? 'text-primary' : 'text-outline'}`}>book</span>
                    <span className={`text-sm ${activeFolderId === null ? 'font-bold text-primary' : 'font-medium'}`}>All Notes</span>
                </div>
            </button>

            {folders.map(folder => {
                const folderNotes = notes.filter(n => n.folderId === folder.id);
                const isDragOver = dragOverFolderId === folder.id;
                const isActive = activeFolderId === folder.id;
                
                return (
                    <div 
                        key={folder.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onFolderClick(folder.id)}
                        onDragOver={(e) => handleDragOver(e, folder.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, folder.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onFolderClick(folder.id); }}
                        className={`w-full flex items-center justify-between p-sm rounded-lg transition-colors group text-on-surface relative cursor-pointer ${isActive ? 'bg-surface-container before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-full' : 'hover:bg-surface-container'} ${isDragOver ? 'ring-2 ring-primary ring-inset bg-primary/10 scale-[1.02]' : ''}`}
                    >
                        <div className={`flex items-center gap-sm ${isActive ? 'ml-1' : ''}`}>
                            <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-primary' : 'text-outline'}`}>folder</span>
                            <span className={`text-sm truncate ${isActive ? 'font-bold text-primary' : 'font-medium'}`}>{folder.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-outline font-bold">{folderNotes.length}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                                className="opacity-0 group-hover:opacity-100 hover:text-error transition-opacity text-outline"
                                aria-label="Delete folder"
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      <div className="px-md mt-lg">
          <p className="text-label-caps text-outline mb-sm tracking-widest pl-xs">TAGS</p>
          <div className="flex flex-wrap gap-2 px-xs">
            {popularTags.map(([tag, count]) => {
                const isActive = activeTag === tag;
                return (
                    <button 
                        key={tag} 
                        onClick={() => onTagClick(tag)}
                        className={`px-3 py-1 text-[11px] font-bold uppercase rounded-lg border transition-all flex items-center gap-2 ${isActive ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface text-on-surface border-outline-variant hover:border-outline'}`}
                    >
                        <span>#{tag}</span>
                        <span className="text-[9px] opacity-50">{count}</span>
                    </button>
                );
            })}
            {popularTags.length === 0 && <p className="text-[10px] italic text-outline w-full px-xs">No tags yet</p>}
          </div>
      </div>
    </aside>
  );
};

export default Sidebar;