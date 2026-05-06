import React, { useState, useEffect, useRef } from 'react';
import { Note, ProjectData, ProjectPhase, ProjectMilestone, ProjectItem } from '../types';
import { processNoteWithAI } from '../services/geminiService';
import { getTagStyle } from './NoteCard';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string, category?: string, tags?: string[], projectData?: ProjectData) => void;
  currentUser: string;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSave, currentUser }) => {
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // Project Engine State
  const [objectives, setObjectives] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [manualProgress, setManualProgress] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const isGuest = currentUser === 'Guest';

  const COLORS = ["#000000", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef"];
  const BG_COLORS = ["#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#e9d5ff", "#fed7aa", "#cbd5e1"];

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setTags(note.tags);
      if (editorRef.current) editorRef.current.innerHTML = note.content;
      if (note.type === 'project' && note.projectData) {
          setObjectives(note.projectData.objectives.map(o => typeof o === 'string' ? o : o.label).join('\n'));
          setDeliverables(note.projectData.deliverables.map(d => typeof d === 'string' ? d : d.label).join('\n'));
          setManualProgress(note.projectData.manualProgress || 0);
      }
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  const handleAIOrganize = async () => {
      if (isGuest) return;
      setIsProcessing(true);
      try {
          const content = editorRef.current?.innerHTML || '';
          const processed = await processNoteWithAI(content, [], note.type, currentUser);
          setTitle(processed.title);
          setTags(prev => Array.from(new Set([...prev, ...processed.tags.map(t => t.toLowerCase().replace('#', ''))])));
          if (editorRef.current) editorRef.current.innerHTML = processed.formattedContent;
      } catch (err: any) {
          console.error(err);
      } finally {
          setIsProcessing(false);
      }
  };

  const addTag = () => {
      const val = tagInput.trim().toLowerCase().replace('#', '');
      if (val && !tags.includes(val)) {
          setTags([...tags, val]);
          setTagInput('');
      }
  };

  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = editorRef.current?.innerHTML || '';
    onSave(note.id, title, content, undefined, tags, note.type === 'project' ? {
        ...note.projectData,
        objectives: objectives.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        deliverables: deliverables.split('\n').filter(l => l.trim()).map(l => ({ label: l, status: 'pending' as const })),
        manualProgress,
        isCompleted: manualProgress === 100
    } as any : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-container-high rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] animate-[fadeIn_0.2s_ease-out] border border-outline-variant">
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2 uppercase tracking-tight">
            <span className={`p-1.5 ${note.type === 'project' ? 'bg-secondary-container' : 'bg-primary-container'} text-white rounded-lg shadow-sm material-symbols-outlined text-[16px]`}>
                {note.type === 'project' ? 'rocket_launch' : 'edit'}
            </span> 
            Edit {note.type === 'project' ? 'Project' : 'Note'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-outline hover:text-on-surface hover:bg-surface-variant transition-colors material-symbols-outlined text-[20px]">close</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-6 overflow-y-auto custom-scrollbar bg-surface-container-high">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Project Data Left Column */}
            <div className={`lg:col-span-4 space-y-6 ${note.type !== 'project' ? 'hidden' : ''}`}>
                <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant">
                    <label className="block text-xs font-black uppercase tracking-widest text-outline mb-4">Project Dashboard</label>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between mb-1">
                                <span className="text-[10px] font-bold text-outline">Progress</span>
                                <span className="text-[10px] font-black text-secondary">{manualProgress}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={manualProgress} onChange={(e) => setManualProgress(parseInt(e.target.value))} className="w-full accent-secondary" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Objectives</label>
                        <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} className="w-full h-32 p-4 bg-surface-dim border border-outline-variant rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-2">Deliverables</label>
                        <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} className="w-full h-32 p-4 bg-surface-dim border border-outline-variant rounded-xl text-xs font-bold text-on-surface outline-none focus:border-primary" />
                    </div>
                </div>
            </div>

            {/* Description Right Column */}
            <div className={`${note.type === 'project' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6 flex flex-col`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-outline mb-2">Entry Title</label>
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-5 py-3 border border-outline-variant rounded-xl font-black text-lg bg-surface-dim text-on-surface outline-none focus:border-primary" required />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-outline mb-2">Manage Hashtags</label>
                        <div className="flex flex-wrap gap-1.5 p-2.5 border border-outline-variant rounded-xl bg-surface-dim min-h-[50px] focus-within:border-primary">
                            {tags.map(tag => (
                                <span key={tag} style={getTagStyle(tag)} className="px-2.5 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-widest flex items-center gap-1 group/tag">
                                    #{tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-error transition-colors material-symbols-outlined text-[12px]">close</button>
                                </span>
                            ))}
                            <input 
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                placeholder="Add tag..."
                                className="bg-transparent outline-none text-xs font-bold text-outline focus:text-on-surface min-w-[80px] flex-1"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-grow flex flex-col min-h-[400px]">
                    <div className="flex flex-wrap items-center gap-1 p-2 bg-surface-container-low rounded-t-2xl border border-outline-variant overflow-x-auto no-scrollbar">
                        <select onChange={(e) => execCommand('fontName', e.target.value)} className="bg-surface-dim border border-outline-variant rounded px-1.5 py-1 text-[10px] font-bold outline-none max-w-[90px] text-on-surface">
                            <option value="">Font</option>
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <select onChange={(e) => execCommand('fontSize', e.target.value)} className="bg-surface-dim border border-outline-variant rounded px-1.5 py-1 text-[10px] font-bold outline-none text-on-surface">
                            <option value="">Size</option>
                            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="w-px h-4 bg-outline-variant mx-1" />
                        <button type="button" onClick={() => execCommand('bold')} className="px-2 py-1 hover:bg-surface-dim rounded text-xs font-black text-on-surface">B</button>
                        <button type="button" onClick={() => execCommand('italic')} className="px-2 py-1 hover:bg-surface-dim rounded text-xs italic text-on-surface">I</button>
                        <button type="button" onClick={() => execCommand('underline')} className="px-2 py-1 hover:bg-surface-dim rounded text-xs underline text-on-surface">U</button>
                        <div className="w-px h-4 bg-outline-variant mx-1" />
                        <div className="relative">
                            <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} className="px-2 py-1 hover:bg-surface-dim rounded text-xs text-on-surface">🎨</button>
                            {showColorPicker && (
                                <div className="absolute top-full left-0 mt-1 p-3 bg-surface-container-highest border border-outline-variant rounded-xl shadow-2xl z-50 min-w-[200px]">
                                    <div className="text-[9px] font-black uppercase text-outline mb-2">Text Color</div>
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {COLORS.map(c => <button key={c} type="button" onClick={() => { execCommand('foreColor', c); setShowColorPicker(false); }} className="w-5 h-5 rounded-full" style={{backgroundColor: c}} />)}
                                    </div>
                                    <div className="text-[9px] font-black uppercase text-outline mb-2">Highlight</div>
                                    <div className="flex flex-wrap gap-1">
                                        {BG_COLORS.map(c => <button key={c} type="button" onClick={() => { execCommand('hiliteColor', c); setShowColorPicker(false); }} className="w-5 h-5 rounded-[4px]" style={{backgroundColor: c}} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      className="w-full flex-grow px-8 py-8 border-x border-b border-outline-variant rounded-b-2xl font-body-lg bg-surface-dim text-on-surface outline-none leading-relaxed shadow-inner"
                    />
                </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-outline-variant">
            <button type="button" onClick={handleAIOrganize} disabled={isProcessing || isGuest} className={`px-8 py-3 font-bold text-[12px] rounded-lg shadow-md transition-all flex items-center gap-2 ${isGuest ? 'bg-surface-variant text-outline' : 'bg-primary-container text-on-primary-container hover:brightness-110'}`}>
              <span className="material-symbols-outlined text-[16px]">magic_button</span> {isProcessing ? 'Optimizing...' : 'Optimize & Tag'}
            </button>
            <div className="flex gap-4">
                <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-[12px] text-outline hover:text-on-surface transition-colors">Discard</button>
                <button type="submit" className="px-10 py-3 bg-primary text-on-primary font-bold text-[12px] rounded-lg shadow-md hover:bg-primary-container transition-all flex items-center gap-2">
                   <span className="material-symbols-outlined text-[16px]">save</span> Commit Entry
                </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;