import React, { useMemo, useState } from 'react';
import { Note, Folder, NoteType, QuickReferenceTemplate } from '../types';
import { getTagStyle } from '../utils/styleUtils';

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
  onApplyTemplate: (template: QuickReferenceTemplate) => void;
  className?: string;
}

const DEFAULT_TEMPLATES: QuickReferenceTemplate[] = [
  {
    id: 'bec-response-template',
    title: 'BEC Incident Response',
    type: 'quick',
    workflowSteps: [
      'Create incident ticket and assign owner',
      'Grab email headers + original message artifacts',
      'Check spoof indicators (SPF, DKIM, DMARC, lookalike sender)',
      'Block sender/domain + search for related emails in tenant',
      'Contain impacted accounts and reset credentials if needed',
      'Document timeline and notify stakeholders'
    ],
    content: `# BEC Incident Workflow\n\n1. Create incident ticket and assign owner\n2. Grab email headers + original message artifacts\n3. Check spoof indicators (SPF, DKIM, DMARC, lookalike sender)\n4. Block sender/domain + search for related emails in tenant\n5. Contain impacted accounts and reset credentials if needed\n6. Document timeline and notify stakeholders\n\n## Notes\n- Ticket:\n- Impact:\n- IOC / Domains:\n- Next update:`
  }
];

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
    activeTag, activeFolderId, activeDate, onDateClick, onApplyTemplate, className = "" 
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<QuickReferenceTemplate[]>(() => {
    const saved = localStorage.getItem('ideaweaver_quick_templates');
    if (!saved) return DEFAULT_TEMPLATES;
    try {
      const parsed = JSON.parse(saved) as QuickReferenceTemplate[];
      return parsed.length > 0 ? parsed : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set([DEFAULT_TEMPLATES[0].id]));
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateType, setNewTemplateType] = useState<NoteType>('quick');
  const [newTemplateSteps, setNewTemplateSteps] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateTitle, setEditingTemplateTitle] = useState('');
  const [editingTemplateType, setEditingTemplateType] = useState<NoteType>('quick');
  const [editingTemplateSteps, setEditingTemplateSteps] = useState('');

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

  const persistTemplates = (nextTemplates: QuickReferenceTemplate[]) => {
    setTemplates(nextTemplates);
    localStorage.setItem('ideaweaver_quick_templates', JSON.stringify(nextTemplates));
  };

  const toggleTemplateExpansion = (id: string) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = newTemplateTitle.trim();
    const workflowSteps = newTemplateSteps.split('\n').map(step => step.trim()).filter(Boolean);
    if (!trimmedTitle || workflowSteps.length === 0) return;

    const content = `# ${trimmedTitle}\n\n${workflowSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n## Notes\n- Owner:\n- Status:\n- Follow-up:`;
    const template: QuickReferenceTemplate = {
      id: crypto.randomUUID(),
      title: trimmedTitle,
      type: newTemplateType,
      workflowSteps,
      content
    };

    persistTemplates([template, ...templates]);
    setExpandedTemplates(prev => new Set(prev).add(template.id));
    setNewTemplateTitle('');
    setNewTemplateSteps('');
    setNewTemplateType('quick');
    setShowTemplateForm(false);
  };

  const handleStartEditTemplate = (template: QuickReferenceTemplate) => {
    setEditingTemplateId(template.id);
    setEditingTemplateTitle(template.title);
    setEditingTemplateType(template.type);
    setEditingTemplateSteps(template.workflowSteps.join('\n'));
    setExpandedTemplates(prev => new Set(prev).add(template.id));
  };

  const handleCancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setEditingTemplateTitle('');
    setEditingTemplateType('quick');
    setEditingTemplateSteps('');
  };

  const handleSaveTemplateEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateId) return;

    const trimmedTitle = editingTemplateTitle.trim();
    const workflowSteps = editingTemplateSteps.split('\n').map(step => step.trim()).filter(Boolean);
    if (!trimmedTitle || workflowSteps.length === 0) return;

    const content = `# ${trimmedTitle}\n\n${workflowSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\n## Notes\n- Owner:\n- Status:\n- Follow-up:`;

    const nextTemplates = templates.map(template => {
      if (template.id !== editingTemplateId) return template;
      return {
        ...template,
        title: trimmedTitle,
        type: editingTemplateType,
        workflowSteps,
        content
      };
    });

    persistTemplates(nextTemplates);
    handleCancelTemplateEdit();
  };

  return (
    <aside className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${className}`}>
      
      <Calendar activeDate={activeDate} onDateClick={onDateClick} notes={notes} />

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-4 border-b border-slate-50 dark:border-slate-700 pb-2">
          <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">⚡ Quick References</h3>
          <button onClick={() => setShowTemplateForm(prev => !prev)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors" title="Add Template">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>

        {showTemplateForm && (
          <form onSubmit={handleCreateTemplate} className="space-y-2 mb-3">
            <input value={newTemplateTitle} onChange={(e) => setNewTemplateTitle(e.target.value)} placeholder="Template title" className="w-full px-2 py-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500" />
            <select value={newTemplateType} onChange={(e) => setNewTemplateType(e.target.value as NoteType)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500">
              {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <textarea value={newTemplateSteps} onChange={(e) => setNewTemplateSteps(e.target.value)} placeholder="One workflow step per line" className="w-full h-24 px-2 py-1.5 text-xs border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500" />
            <button type="submit" className="w-full px-3 py-1.5 rounded bg-primary-600 text-white text-[11px] font-bold uppercase tracking-widest">Save Template</button>
          </form>
        )}

        <div className="space-y-2">
          {templates.map(template => {
            const isExpanded = expandedTemplates.has(template.id);
            const isEditing = editingTemplateId === template.id;
            return (
              <div key={template.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <button onClick={() => toggleTemplateExpansion(template.id)} className="w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/40 text-slate-700 dark:text-slate-200">
                  <span className="truncate pr-2">{template.title}</span>
                  <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6-6-6"/></svg>
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 bg-slate-50/70 dark:bg-slate-900/40">
                    {isEditing ? (
                      <form onSubmit={handleSaveTemplateEdit} className="space-y-2">
                        <input value={editingTemplateTitle} onChange={(e) => setEditingTemplateTitle(e.target.value)} placeholder="Template title" className="w-full px-2 py-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500" />
                        <select value={editingTemplateType} onChange={(e) => setEditingTemplateType(e.target.value as NoteType)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500">
                          {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => <option key={`${template.id}-${type}`} value={type}>{type}</option>)}
                        </select>
                        <textarea value={editingTemplateSteps} onChange={(e) => setEditingTemplateSteps(e.target.value)} placeholder="One workflow step per line" className="w-full h-24 px-2 py-1.5 text-xs border rounded dark:bg-slate-700 dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={handleCancelTemplateEdit} className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">Cancel</button>
                          <button type="submit" className="px-3 py-1.5 rounded bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest">Save</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <ol className="space-y-1 mb-3">
                          {template.workflowSteps.map((step, index) => <li key={`${template.id}-${index}`} className="text-[11px] text-slate-500 dark:text-slate-300">{index + 1}. {step}</li>)}
                        </ol>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => onApplyTemplate(template)} className="px-3 py-1.5 rounded bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest">Use Template</button>
                          <button onClick={() => handleStartEditTemplate(template)} className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200">Edit</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
                  onDragOver={(e) => handleDragOver(e, null)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, undefined)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all group/all-notes ${activeFolderId === null ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${dragOverFolderId === 'null' ? 'ring-2 ring-primary-500 ring-inset bg-primary-100/50' : ''}`}
               >
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                 All Notes
                 {dragOverFolderId === 'null' && <span className="ml-auto text-[10px] font-bold text-primary-600 animate-pulse text-right">Move</span>}
               </button>
               {folders.map(folder => {
                   const isExpanded = expandedFolders.has(folder.id);
                   const folderNotes = notes.filter(n => n.folderId === folder.id);
                   const isDragOver = dragOverFolderId === folder.id;
                   
                   return (
                     <div key={folder.id} className="group/folder space-y-1">
                       <div 
                         onDragOver={(e) => handleDragOver(e, folder.id)}
                         onDragLeave={handleDragLeave}
                         onDrop={(e) => handleDrop(e, folder.id)}
                         className={`w-full flex items-center rounded-lg transition-all ${activeFolderId === folder.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${isDragOver ? 'ring-2 ring-primary-500 ring-inset bg-primary-100/50 scale-[1.02] shadow-md' : ''}`}
                       >
                           <button 
                             onClick={(e) => toggleFolderExpansion(e, folder.id)}
                             className={`p-2 transition-transform duration-200 transform ${isExpanded ? 'rotate-90' : ''}`}
                             title={isExpanded ? "Collapse" : "Expand"}
                           >
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m9 18 6-6 6-6"/></svg>
                           </button>
                           
                           <button 
                              onClick={() => onFolderClick(folder.id)} 
                              className="flex-1 text-left py-2 text-sm font-medium truncate"
                           >
                             {folder.name}
                           </button>
                           
                           <div className="flex items-center gap-1.5 pr-2">
                             <span className="text-[10px] opacity-40 font-mono text-right min-w-[14px]">{folderNotes.length}</span>
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

      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4 border-b border-slate-50 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">🏷️ Popular Tags</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {popularTags.map(([tag, count]) => {
                const isActive = activeTag === tag;
                const style = getTagStyle(tag, isActive);
                return (
                    <button 
                        key={tag} 
                        onClick={() => onTagClick(tag)}
                        style={style}
                        className={`px-3 py-1 text-[10px] font-black uppercase tracking-tight rounded-full border transition-all flex items-center gap-2 hover:scale-110 active:scale-95`}
                    >
                        <span>#{tag}</span>
                        <span className={`text-[8px] opacity-60 font-mono`}>{count}</span>
                    </button>
                );
            })}
            {popularTags.length === 0 && <p className="text-[10px] italic text-slate-400 py-4 w-full text-center">AI generating tags in background...</p>}
          </div>
      </div>
    </aside>
  );
};

export default Sidebar;
