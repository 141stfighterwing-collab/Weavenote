import React, { useMemo } from 'react';
import { Note } from '../types';

interface RightSidebarProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  className?: string;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ notes, onNoteClick, className = "" }) => {
  // Calculate today's tag string (YYYY-MM-DD)
  const todayTag = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const todayNotes = useMemo(() => {
    return notes.filter(n => n.tags.includes(todayTag));
  }, [notes, todayTag]);

  return (
    <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${className}`}>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors h-full max-h-[calc(100vh-140px)] flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
                <span className="text-lg">📅</span> Today's Things
            </h3>
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">
                #{todayTag}
            </span>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3">
             {todayNotes.length > 0 ? (
                 todayNotes.map(note => (
                     <div 
                        key={note.id} 
                        onClick={() => onNoteClick(note)}
                        className={`group cursor-pointer p-3 rounded-lg border transition-all hover:shadow-md bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700`}
                     >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-${note.color.split('-')[0]}-100 text-${note.color.split('-')[0]}-800 dark:bg-${note.color.split('-')[0]}-900 dark:text-${note.color.split('-')[0]}-200`}>
                                {note.category}
                            </span>
                            {note.type === 'quick' && <span className="text-lg leading-none">⚡</span>}
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 transition-colors line-clamp-2 leading-tight">
                            {note.title}
                        </h4>
                        
                        {/* Attempt to show first checkbox if exists */}
                        {note.content.includes('- [ ]') && (
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-500 italic truncate">
                                    {note.content.split('\n').find(l => l.includes('- [ ]'))?.replace('- [ ]', '⬜')}
                                </p>
                            </div>
                        )}
                     </div>
                 ))
             ) : (
                 <div className="text-center py-10 text-slate-400">
                     <p className="text-2xl mb-2">☕</p>
                     <p className="text-xs italic">Nothing tagged for today yet.</p>
                     <p className="text-[10px] opacity-70 mt-1">Add a "Quick" note to auto-tag.</p>
                 </div>
             )}
          </div>
      </div>
    </aside>
  );
};

export default RightSidebar;