import React, { useMemo, useState } from 'react';
import { Note, Folder } from '../types';

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
                {days.map(day => <div key={day} className="text-[9px] font-bold text-slate-400">{day}</div>)}
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

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => n.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [notes]);

  const getHashColor = (str: string) => {
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 70%, 45%)`; 
  };

  return (
    <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${className}`}>
      
      <Calendar activeDate={activeDate} onDateClick={onDateClick} notes={notes} />

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4 border-b border-slate-50 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">🗂️ Folders</h3>
            <button onClick={() => setIsCreatingFolder(true)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">+</button>
          </div>
          <div className="space-y-1">
               <button onClick={() => onFolderClick(null)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeFolderId === null ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}>All Notes</button>
               {folders.map(folder => (
                   <button key={folder.id} onClick={() => onFolderClick(folder.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeFolderId === folder.id ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                       <span className="truncate">{folder.name}</span>
                       <span className="ml-auto text-xs opacity-40">{notes.filter(n => n.folderId === folder.id).length}</span>
                   </button>
               ))}
          </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 text-xs uppercase tracking-wider">🔥 Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => (
                <button
                    key={tag}
                    onClick={() => onTagClick(tag)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all border ${activeTag === tag ? 'ring-2 ring-primary-400' : ''}`}
                    style={{ backgroundColor: activeTag === tag ? getHashColor(tag) : 'transparent', color: activeTag === tag ? 'white' : getHashColor(tag), borderColor: getHashColor(tag) + '40' }}
                >
                    #{tag}
                </button>
            ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;