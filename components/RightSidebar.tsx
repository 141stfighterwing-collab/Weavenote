import React, { useMemo } from 'react';
import { Note } from '../types';

interface RightSidebarProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  className?: string;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ notes, onNoteClick, className = "" }) => {
  const todayTag = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayNotes = useMemo(() => notes.filter(n => n.tags.includes(todayTag)), [notes, todayTag]);

  const ongoingProjects = useMemo(() => {
    return notes
      .filter(n => n.type === 'project')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [notes]);

  const calculateProgress = (note: Note) => {
      if (!note.projectData) return 0;
      const { milestones, workflow } = note.projectData;
      let completed = 0;
      let total = 0;

      if (workflow && workflow.nodes.length > 0) {
          total += workflow.nodes.length;
          completed += workflow.nodes.filter(n => n.status === 'done').length;
      } else if (milestones && milestones.length > 0) {
          total += milestones.length;
          completed += milestones.filter(m => m.status === 'completed').length;
      }
      
      return total === 0 ? 0 : Math.round((completed / total) * 100);
  };

  return (
    <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${className}`}>
      {/* Today's Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">📅 Today's Things</h3>
            <span className="text-[10px] font-mono opacity-50">{todayTag}</span>
          </div>
          <div className="space-y-3">
             {todayNotes.length > 0 ? todayNotes.map(note => (
                 <div key={note.id} onClick={() => onNoteClick(note)} className="cursor-pointer p-3 rounded-lg border border-slate-50 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20 hover:border-primary-300">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{note.title}</h4>
                    {note.content.includes('- [ ]') && (
                        <p className="text-[10px] text-slate-500 mt-1 truncate italic">Next: {note.content.split('\n').find(l => l.includes('- [ ]'))?.replace('- [ ]', '')}</p>
                    )}
                 </div>
             )) : <p className="text-[10px] italic text-slate-400 py-4 text-center">Nothing for today yet.</p>}
          </div>
      </div>

      {/* Ongoing Projects Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">🚀 Ongoing Projects</h3>
          </div>
          <div className="space-y-4">
             {ongoingProjects.length > 0 ? ongoingProjects.map(note => {
                 const progress = calculateProgress(note);
                 return (
                 <div key={note.id} onClick={() => onNoteClick(note)} className="group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 transition-colors truncate flex-1 pr-2">{note.title}</h4>
                        <span className="text-[10px] font-bold text-slate-400">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                 </div>
             )}) : <p className="text-[10px] italic text-slate-400 py-4 text-center">No active projects.</p>}
          </div>
      </div>
    </aside>
  );
};

export default RightSidebar;