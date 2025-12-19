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

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => n.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [notes]);

  const getHashColor = (str: string) => {
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 70%, 45%)`; 
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  return (
    <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${className}`}>
      
      <Calendar activeDate={activeDate} onDateClick={onDateClick} notes={notes} />

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4 border-b border-slate-50 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">🗂️ Folders</h3>
            <button onClick={() => setIsCreatingFolder(true)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
          
          {isCreatingFolder && (
            <form onSubmit={handleCreateSubmit} className="mb-3">
              <input 
                autoFocus
                type="text" 
                value={newFolderName} 
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                onBlur={() => !newFolderName && setIsCreatingFolder(false)}
                className="w-full px-2 py-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500"
              />
            </form>
          )}

          <div className="space-y-1">
               <button 
                  onClick={() => onFolderClick(null)} 
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeFolderId === null ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
               >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                 All Notes
               </button>
               {folders.map(folder => {
                   const isExpanded = expandedFolders.has(folder.id);
                   const folderNotes = notes.filter(n => n.folderId === folder.id);
                   
                   return (
                     <div key={folder.id} className="group/folder space-y-1">
                       <div className={`w-full flex items-center rounded-lg transition-colors ${activeFolderId === folder.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                           <button 
                             onClick={(e) => toggleFolderExpansion(e, folder.id)}
                             className={`p-2 transition-transform duration-200 transform ${isExpanded ? 'rotate-90' : ''}`}
                             title={isExpanded ? "Collapse" : "Expand"}
                           >
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                           </button>
                           
                           <button 
                              onClick={() => onFolderClick(folder.id)} 
                              className="flex-1 text-left py-2 text-sm font-medium truncate"
                           >
                             {folder.name}
                           </button>
                           
                           <div className="flex items-center gap-1.5 pr-2">
                             <span className="text-[10px] opacity-40 font-mono">{folderNotes.length}</span>
                             <button 
                               onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                               className="opacity-0 group-hover/folder:opacity-100 p-1 hover:text-red-500 transition-opacity"
                               title="Delete Folder"
                             >
                               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                             </button>
                           </div>
                       </div>
                       
                       {isExpanded && (
                         <div className="ml-5 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-700 pl-2 animate-[fadeIn_0.1s_ease-out]">
                           {folderNotes.map(note => (
                             <button 
                                key={note.id}
                                onClick={() => onNoteClick(note)}
                                className="w-full text-left px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
                             >
                               • {note.title}
                             </button>
                           ))}
                           {folderNotes.length === 0 && <p className="px-2 py-1 text-[10px] text-slate-300 italic">No notes in folder</p>}
                         </div>
                       )}
                     </div>
                   );
               })}
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