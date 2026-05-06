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
      .filter(n => n.type === 'project' && !n.projectData?.isCompleted)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [notes]);

  const calculateProgress = (note: Note) => {
      if (!note.projectData) return 0;
      if (note.projectData.isCompleted) return 100;

      // Prefer manualProgress
      if (typeof note.projectData.manualProgress === 'number') {
          return note.projectData.manualProgress;
      }

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
    <aside className={`${className}`}>
      {/* Today's Section */}
      <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant flex flex-col">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
            <h3 className="font-bold text-on-surface flex items-center gap-sm text-[11px] uppercase tracking-wider"><span className="material-symbols-outlined text-[16px] text-outline">calendar_today</span> TODAY'S THINGS</h3>
            <span className="text-[10px] font-mono text-outline">{todayTag}</span>
          </div>
          <div className="space-y-sm">
             {todayNotes.length > 0 ? todayNotes.map(note => (
                 <div key={note.id} onClick={() => onNoteClick(note)} className="cursor-pointer p-sm rounded-lg border border-outline-variant bg-surface-dim hover:border-primary transition-all">
                    <h4 className="text-sm font-bold text-on-surface line-clamp-1">{note.title}</h4>
                    {note.content.includes('- [ ]') && (
                        <p className="text-[10px] text-on-surface-variant mt-1 truncate italic">Next: {note.content.split('\n').find(l => l.includes('- [ ]'))?.replace('- [ ]', '')}</p>
                    )}
                 </div>
             )) : <p className="text-[10px] italic text-outline py-sm text-center">Nothing for today yet.</p>}
          </div>
      </div>

      {/* Ongoing Projects Section */}
      <div className="bg-surface-container-low rounded-xl p-md border border-outline-variant flex flex-col">
          <div className="flex justify-between items-center mb-md border-b border-outline-variant pb-sm">
            <h3 className="font-bold text-on-surface flex items-center gap-sm text-[11px] uppercase tracking-wider"><span className="material-symbols-outlined text-[16px] text-outline">rocket_launch</span> ONGOING PROJECTS</h3>
          </div>
          <div className="space-y-md">
             {ongoingProjects.length > 0 ? ongoingProjects.map(note => {
                 const progress = calculateProgress(note);
                 return (
                 <div key={note.id} onClick={() => onNoteClick(note)} className="group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate flex-1 pr-2">{note.title}</h4>
                        <span className="text-[10px] font-bold text-outline uppercase">{progress}%</span>
                    </div>
                    <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
                        <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                 </div>
             )}) : <p className="text-[10px] italic text-outline py-sm text-center">No active projects.</p>}
          </div>
      </div>
    </aside>
  );
};

export default RightSidebar;