import React, { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, NOTE_COLORS, WorkflowNode, WorkflowEdge, ProjectData, ProjectMilestone, ProjectPhase } from '../types';
import { expandNoteContent } from '../services/geminiService';
import GanttChart from './GanttChart';
import WorkflowEditor from './WorkflowEditor';

interface NoteDetailModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  showLinkPreviews?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, index: number) => void;
  onSaveExpanded?: (id: string, content: string) => void;
  onToggleComplete?: (id: string) => void;
  onUpdateProjectData?: (id: string, data: ProjectData) => void;
  currentUser: string;
}

const isImageUrl = (url: string) => {
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u.pathname);
    } catch (e) {
        return false;
    }
};

const processContent = (text: string) => {
    if (!text) return "";
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteDetailModal: React.FC<NoteDetailModalProps> = ({ 
    note, isOpen, onClose, showLinkPreviews = false, onViewImage, 
    onToggleCheckbox, onSaveExpanded, onToggleComplete, onUpdateProjectData, currentUser 
}) => {
  const [isExpanding, setIsExpanding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  
  // Edit states for project dashboard
  const [editSection, setEditSection] = useState<'objectives' | 'milestones' | 'timeline' | 'progress' | null>(null);
  const [editedObjectives, setEditedObjectives] = useState<string[]>([]);
  const [editedMilestones, setEditedMilestones] = useState<ProjectMilestone[]>([]);
  const [editedTimeline, setEditedTimeline] = useState<ProjectPhase[]>([]);
  const [editedProgress, setEditedProgress] = useState<number>(0);
  const [editedIsCompleted, setEditedIsCompleted] = useState<boolean>(false);

  const checkboxCounter = useRef(0);
  checkboxCounter.current = 0;
  const isGuest = currentUser === 'Guest';

  useEffect(() => {
    if (isOpen && containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 64);
    }
    // Reset edit states when note changes or modal opens
    if (note && note.projectData) {
      setEditedObjectives(note.projectData.objectives || note.projectData.deliverables || []);
      setEditedMilestones(note.projectData.milestones || []);
      setEditedTimeline(note.projectData.timeline || []);
      setEditedProgress(note.projectData.manualProgress || 0);
      setEditedIsCompleted(note.projectData.isCompleted || false);
    }
    setEditSection(null);
  }, [isOpen, note]);

  const handleDeepDive = async () => {
    if (!note || !onSaveExpanded || isGuest) return;
    setIsExpanding(true);
    try {
        const expansion = await expandNoteContent(note.content, currentUser);
        if (expansion) {
            const newContent = note.content + "\n\n" + expansion;
            onSaveExpanded(note.id, newContent);
        }
    } catch (e) {
        alert("Deep dive failed.");
    } finally {
        setIsExpanding(false);
    }
  };

  const saveProjectChanges = () => {
    if (!note || !onUpdateProjectData) return;
    const newData: ProjectData = {
      ...(note.projectData || { deliverables: [], milestones: [], timeline: [], objectives: [] }),
      objectives: editedObjectives,
      milestones: editedMilestones,
      timeline: editedTimeline,
      manualProgress: editedProgress,
      isCompleted: editedIsCompleted
    };
    onUpdateProjectData(note.id, newData);
    setEditSection(null);
  };

  const currentDisplayProgress = useMemo(() => {
    if (!note?.projectData) return 0;
    if (note.projectData.isCompleted) return 100;
    if (typeof note.projectData.manualProgress === 'number') return note.projectData.manualProgress;
    
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
  }, [note]);

  const processedContent = useMemo(() => note ? processContent(note.content) : "", [note]);
  const colorClass = note ? NOTE_COLORS[note.color] : "";

  const markdownComponents = {
      a: (props: any) => {
          if (!props.href) return <a {...props} />;
          if (isImageUrl(props.href)) {
              return (
                  <div onClick={(e) => e.stopPropagation()} className="my-4 block select-none group/img-link">
                      <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-800 transition-all hover:shadow-lg cursor-zoom-in"
                        onClick={() => onViewImage(props.href)}>
                        <img src={props.href} alt="Link Preview" className="w-full max-h-96 object-contain bg-slate-200 dark:bg-slate-700" loading="lazy" />
                      </div>
                  </div>
              );
          }
          return (
            <a href={props.href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium" onClick={(e) => e.stopPropagation()}>
                {props.children}
            </a>
          );
      },
      input: (props: any) => {
          if (props.type === 'checkbox') {
              const index = checkboxCounter.current++;
              return (
                  <input
                    type="checkbox"
                    checked={props.checked || false}
                    onChange={() => { if (note) onToggleCheckbox(note.id, index); }}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
              );
          }
          return <input {...props} />;
      },
      code: ({node, inline, className, children, ...props}: any) => {
          return !inline ? (
            <div className="bg-slate-900 dark:bg-black p-6 rounded-2xl border border-slate-700 my-6 overflow-x-auto shadow-2xl group/code relative">
              <div className="absolute top-3 right-5 text-[10px] text-indigo-400 font-bold uppercase tracking-widest opacity-80">Source Script</div>
              <code className={`${className} text-indigo-300 text-sm font-mono leading-relaxed whitespace-pre`} {...props}>
                {children}
              </code>
            </div>
          ) : (
            <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-primary-700 dark:text-primary-300 font-mono text-sm" {...props}>
              {children}
            </code>
          )
      }
  };

  if (!isOpen || !note) return null;
  const isCompleted = note.projectData?.isCompleted;

  // Ensure projectData exists for project notes
  const projectData = note.projectData || { deliverables: [], milestones: [], timeline: [], objectives: [] };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden ${colorClass} font-hand dark:brightness-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 pb-4 border-b border-black/5 bg-black/5">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-60 font-sans">{note.type}</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-40 font-sans">• {note.category}</span>
                </div>
                <h2 className={`text-3xl font-bold leading-tight mt-1 ${isCompleted ? 'line-through opacity-60' : ''}`}>{note.title}</h2>
            </div>
            <div className="flex items-center gap-2">
                {note.type === 'project' && onToggleComplete && (
                  <button 
                    onClick={() => onToggleComplete(note.id)} 
                    className={`px-4 py-1.5 rounded-full text-xs font-bold font-sans transition-all shadow-md flex items-center gap-2 ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-white/80 text-slate-700 hover:bg-emerald-50'}`}
                  >
                    {isCompleted ? '✓ Completed' : 'Mark as Done'}
                  </button>
                )}
                <button 
                  onClick={handleDeepDive} 
                  disabled={isExpanding || isGuest} 
                  className={`px-3 py-1.5 rounded-full text-xs font-bold font-sans transition-all shadow-sm flex items-center gap-1 disabled:opacity-50 ${isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  title={isGuest ? "Login required for AI features" : "Deep Dive"}
                >
                  {isExpanding ? '✨ Diving...' : isGuest ? '✨ AI (Login)' : '✨ Deep Dive'}
                </button>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-black/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-white/20 dark:bg-black/20">
             {/* Status Bar / Progress Bar for Projects */}
             {note.type === 'project' && (
               <div className="mb-8 p-6 bg-white/40 dark:bg-black/20 rounded-2xl border border-black/5 shadow-inner relative group/progress">
                  {editSection === 'progress' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black uppercase tracking-widest opacity-60">Adjust Progress</span>
                         <span className="text-xl font-black">{editedProgress}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={editedProgress} 
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setEditedProgress(val);
                          if (val === 100) setEditedIsCompleted(true);
                          else if (val < 100) setEditedIsCompleted(false);
                        }}
                        className="w-full h-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between items-center gap-4">
                        <button 
                          onClick={() => setEditedIsCompleted(!editedIsCompleted)}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${editedIsCompleted ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200'}`}
                        >
                          {editedIsCompleted ? '✓ Completed' : 'Mark as Completed'}
                        </button>
                        <div className="flex gap-2">
                           <button onClick={() => setEditSection(null)} className="px-4 py-1.5 text-xs font-bold text-slate-500">Cancel</button>
                           <button onClick={saveProjectChanges} className="px-6 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-bold shadow-md">Save Changes</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-emerald-500 rounded-lg text-white shadow-sm">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            </span>
                            <div>
                                <span className="text-xs font-black uppercase tracking-widest opacity-60 font-sans block">Project Status</span>
                                <span className="text-sm font-bold font-sans text-emerald-700 dark:text-emerald-400">{isCompleted ? 'FINISHED' : 'IN PROGRESS'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-2xl font-black font-sans">{currentDisplayProgress}%</span>
                           <button 
                              onClick={() => setEditSection('progress')}
                              className="opacity-0 group-hover/progress:opacity-100 p-2 bg-white/80 dark:bg-slate-800 rounded-full shadow-sm hover:text-primary-600 transition-all"
                              title="Edit Progress"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                        </div>
                      </div>
                      <div className="w-full h-4 bg-black/5 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" style={{ width: `${currentDisplayProgress}%` }} />
                      </div>
                    </>
                  )}
               </div>
             )}

             <div className="prose prose-lg max-w-none font-sans opacity-95 prose-headings:font-hand prose-headings:font-bold prose-p:my-4 prose-li:my-2 break-words whitespace-pre-wrap">
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {processedContent}
                </ReactMarkdown>
            </div>

            {/* PROJECT DASHBOARD SECTION */}
            {note.type === 'project' && (
              <div className="mt-12 space-y-10 animate-[fadeIn_0.3s_ease-out] font-sans">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Box 1: Objectives */}
                      <div className="bg-white/50 dark:bg-black/30 p-8 rounded-3xl border border-black/5 shadow-xl flex flex-col min-h-[300px] relative group">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">🎯</span>
                              <h4 className="text-sm font-black uppercase tracking-widest opacity-60">Objectives</h4>
                            </div>
                            <button 
                              onClick={() => setEditSection(editSection === 'objectives' ? null : 'objectives')}
                              className="opacity-0 group-hover:opacity-100 p-2 bg-white/80 dark:bg-slate-800 rounded-full shadow-sm hover:text-primary-600 transition-all"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </div>

                          {editSection === 'objectives' ? (
                            <div className="flex flex-col h-full gap-4">
                              <textarea 
                                value={editedObjectives.join('\n')}
                                onChange={(e) => setEditedObjectives(e.target.value.split('\n'))}
                                className="flex-1 w-full bg-white/40 dark:bg-black/20 p-4 rounded-xl border border-primary-200 outline-none text-sm font-bold resize-none"
                                placeholder="Enter one objective per line..."
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditSection(null)} className="px-4 py-1 text-xs font-bold text-slate-500">Cancel</button>
                                <button onClick={saveProjectChanges} className="px-4 py-1 bg-primary-600 text-white rounded-lg text-xs font-bold">Save</button>
                              </div>
                            </div>
                          ) : (
                            <ul className="space-y-4 flex-1">
                                {editedObjectives.length > 0 ? editedObjectives.map((o, i) => (
                                    <li key={i} className="text-sm font-bold flex items-start gap-3 p-3 rounded-xl bg-white/20 border border-white/10">
                                        <span className="text-emerald-500 text-lg leading-none mt-0.5">▹</span> 
                                        <span className="leading-tight">{o}</span>
                                    </li>
                                )) : <p className="text-xs text-slate-400 italic text-center py-10">No objectives defined.</p>}
                            </ul>
                          )}
                      </div>

                      {/* Box 2: Milestones */}
                      <div className="bg-white/50 dark:bg-black/30 p-8 rounded-3xl border border-black/5 shadow-xl flex flex-col min-h-[300px] relative group">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">🚩</span>
                              <h4 className="text-sm font-black uppercase tracking-widest opacity-60">Milestones</h4>
                            </div>
                            <button 
                              onClick={() => setEditSection(editSection === 'milestones' ? null : 'milestones')}
                              className="opacity-0 group-hover:opacity-100 p-2 bg-white/80 dark:bg-slate-800 rounded-full shadow-sm hover:text-primary-600 transition-all"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                          </div>

                          {editSection === 'milestones' ? (
                            <div className="flex flex-col h-full gap-3 overflow-y-auto max-h-[400px]">
                              {editedMilestones.map((m, i) => (
                                <div key={i} className="flex flex-col gap-2 p-3 bg-white/40 dark:bg-black/20 rounded-xl border border-slate-200">
                                  <input 
                                    value={m.label}
                                    onChange={(e) => {
                                      const newList = [...editedMilestones];
                                      newList[i].label = e.target.value;
                                      setEditedMilestones(newList);
                                    }}
                                    className="bg-transparent border-0 text-sm font-bold outline-none"
                                    placeholder="Milestone Label"
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      type="date"
                                      value={m.date}
                                      onChange={(e) => {
                                        const newList = [...editedMilestones];
                                        newList[i].date = e.target.value;
                                        setEditedMilestones(newList);
                                      }}
                                      className="flex-1 bg-transparent border-0 text-[10px] font-mono outline-none"
                                    />
                                    <select 
                                      value={m.status}
                                      onChange={(e) => {
                                        const newList = [...editedMilestones];
                                        newList[i].status = e.target.value as any;
                                        setEditedMilestones(newList);
                                      }}
                                      className="bg-transparent border-0 text-[10px] font-bold outline-none"
                                    >
                                      <option value="pending">PENDING</option>
                                      <option value="completed">COMPLETED</option>
                                    </select>
                                    <button 
                                      onClick={() => setEditedMilestones(editedMilestones.filter((_, idx) => idx !== i))}
                                      className="text-red-500 text-xs"
                                    >✕</button>
                                  </div>
                                </div>
                              ))}
                              <button 
                                onClick={() => setEditedMilestones([...editedMilestones, { label: 'New Milestone', date: new Date().toISOString().split('T')[0], status: 'pending' }])}
                                className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 text-xs rounded-xl"
                              >+ Add Milestone</button>
                              <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setEditSection(null)} className="px-4 py-1 text-xs font-bold text-slate-500">Cancel</button>
                                <button onClick={saveProjectChanges} className="px-4 py-1 bg-primary-600 text-white rounded-lg text-xs font-bold">Save</button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 flex-1">
                                {editedMilestones.length > 0 ? editedMilestones.map((m, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/30 dark:bg-black/10 p-4 rounded-2xl border border-black/5 hover:border-emerald-200 transition-all">
                                        <div className="flex flex-col">
                                          <span className="text-sm font-bold leading-tight">{m.label}</span>
                                          <span className="text-[10px] opacity-50 font-mono mt-1">{m.date}</span>
                                        </div>
                                        <div className={`text-[10px] font-black px-3 py-1 rounded-full shadow-sm ${m.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {m.status.toUpperCase()}
                                        </div>
                                    </div>
                                )) : <p className="text-xs text-slate-400 italic text-center py-10">No milestones defined yet.</p>}
                            </div>
                          )}
                      </div>
                  </div>
                  
                  {/* Box 3: Timeline */}
                  <div className="bg-white/50 dark:bg-black/30 p-8 rounded-3xl border border-black/5 shadow-xl relative group">
                      <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">🗓️</span>
                            <h4 className="text-sm font-black uppercase tracking-widest opacity-60">Timeline</h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Roadmap Visualization</span>
                          <button 
                              onClick={() => setEditSection(editSection === 'timeline' ? null : 'timeline')}
                              className="opacity-0 group-hover:opacity-100 p-2 bg-white/80 dark:bg-slate-800 rounded-full shadow-sm hover:text-primary-600 transition-all"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        </div>
                      </div>

                      {editSection === 'timeline' ? (
                        <div className="flex flex-col gap-4">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             {editedTimeline.map((p, i) => (
                               <div key={i} className="p-4 bg-white/40 dark:bg-black/20 rounded-xl border border-slate-200 space-y-3">
                                  <input 
                                    value={p.name}
                                    onChange={(e) => {
                                      const newList = [...editedTimeline];
                                      newList[i].name = e.target.value;
                                      setEditedTimeline(newList);
                                    }}
                                    className="w-full bg-transparent border-0 text-sm font-bold outline-none"
                                    placeholder="Phase Name"
                                  />
                                  <div className="flex items-center gap-2">
                                     <input 
                                        type="date"
                                        value={p.startDate}
                                        onChange={(e) => {
                                          const newList = [...editedTimeline];
                                          newList[i].startDate = e.target.value;
                                          setEditedTimeline(newList);
                                        }}
                                        className="flex-1 bg-transparent border-0 text-[10px] font-mono outline-none"
                                     />
                                     <span className="text-slate-400">→</span>
                                     <input 
                                        type="date"
                                        value={p.endDate}
                                        onChange={(e) => {
                                          const newList = [...editedTimeline];
                                          newList[i].endDate = e.target.value;
                                          setEditedTimeline(newList);
                                        }}
                                        className="flex-1 bg-transparent border-0 text-[10px] font-mono outline-none"
                                     />
                                     <button onClick={() => setEditedTimeline(editedTimeline.filter((_, idx) => idx !== i))} className="text-red-500">✕</button>
                                  </div>
                               </div>
                             ))}
                             <button 
                                onClick={() => setEditedTimeline([...editedTimeline, { name: 'New Phase', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] }])}
                                className="flex items-center justify-center p-4 border-2 border-dashed border-slate-200 text-slate-400 text-xs rounded-xl h-24"
                              >+ Add Phase</button>
                           </div>
                           <div className="flex justify-end gap-2 mt-4">
                              <button onClick={() => setEditSection(null)} className="px-4 py-1 text-xs font-bold text-slate-500">Cancel</button>
                              <button onClick={saveProjectChanges} className="px-4 py-1 bg-primary-600 text-white rounded-lg text-xs font-bold">Save</button>
                           </div>
                        </div>
                      ) : (
                        editedTimeline.length > 0 ? (
                          <div className="bg-white/20 p-4 rounded-2xl border border-white/10">
                              <GanttChart data={{...projectData, timeline: editedTimeline}} width={containerWidth} />
                          </div>
                        ) : (
                          <div className="text-center py-16 text-xs text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                            Timelines are automatically generated by AI or can be added manually.
                          </div>
                        )
                      )}
                  </div>

                  {/* Optional Box 4: Workflow Graph */}
                  {projectData.workflow && (
                      <div className="bg-white/50 dark:bg-black/30 p-8 rounded-3xl border border-black/5 shadow-xl">
                          <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🔗</span>
                                <h4 className="text-sm font-black uppercase tracking-widest opacity-60">Process Workflow</h4>
                            </div>
                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">Neural Graph Mapping</span>
                          </div>
                          <div className="rounded-2xl overflow-hidden border border-black/5">
                            <WorkflowEditor 
                                nodes={projectData.workflow.nodes} 
                                edges={projectData.workflow.edges} 
                                readOnly={true}
                                onUpdate={() => {}} 
                            />
                          </div>
                      </div>
                  )}
              </div>
            )}

            <div className="mt-12 pt-6 border-t border-black/10 flex flex-wrap gap-2">
                {note.tags.map(tag => (
                     <span key={tag} className="text-xs font-bold font-sans px-3 py-1 rounded-full bg-white/50 border border-black/5 shadow-sm text-slate-700 dark:text-slate-300">
                        #{tag}
                     </span>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteDetailModal;