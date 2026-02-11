import React, { useState, useRef, useEffect } from 'react';
import { NoteType, ProjectMilestone } from '../types';
import { parseDocument } from '../services/documentParser';
import { getTagStyle } from './NoteCard';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean, manualTitle?: string, extraProjectData?: any, onStepUpdate?: (step: string) => void) => Promise<any>;
  onTypeChange?: (type: NoteType) => void;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  isGuest?: boolean;
  enableImages?: boolean;
}

const FONTS = ["Inter", "System-ui", "Serif", "Fira Code", "Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"];
const SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const NoteInput: React.FC<NoteInputProps> = ({ 
    onAddNote, onTypeChange, isProcessing, activeType, readOnly = false, isGuest = true 
}) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [aiStep, setAiStep] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = (command: string, value: string = '') => {
    if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false, value);
    }
  };

  const handleAction = async (useAI: boolean) => {
    if (useAI && isGuest) return; 

    let content = editorRef.current?.innerText || editorRef.current?.innerHTML || '';
    if (!content.trim() && !title.trim()) return;
    
    if (useAI) setAiStep("Initializing Neural Link...");
    
    await onAddNote(content, activeType, [], tags, useAI, title, undefined, setAiStep);
    
    if (editorRef.current) editorRef.current.innerHTML = '';
    setTitle(''); setTags([]);
    setAiStep(null);
  };

  const addTag = () => {
    const val = tagInput.trim().toLowerCase().replace('#', '');
    if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
    }
  };

  const removeTag = (t: string) => setTags(tags.filter(tag => tag !== t));

  return (
    <div className="rounded-2xl shadow-2xl border p-1 mb-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 transition-all duration-300 ring-4 ring-black/5">
        <div className="flex gap-1 p-1 mb-1 overflow-x-auto no-scrollbar border-b dark:border-slate-700">
            {(['quick', 'notebook', 'deep', 'code', 'project', 'document'] as NoteType[]).map(type => (
                <button 
                  key={type} 
                  onClick={() => onTypeChange?.(type)} 
                  className={`flex-1 py-2 text-[9px] font-black rounded-xl transition-all min-w-[70px] uppercase tracking-widest ${activeType === type ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                    {type}
                </button>
            ))}
        </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg p-1">
        <div className="flex items-center justify-between border-b dark:border-slate-700">
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Give it a name, or let AI name it..." 
              className="flex-1 px-5 py-4 bg-transparent focus:outline-none font-bold text-lg text-slate-800 dark:text-white" 
            />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
            <button onClick={() => execCommand('bold')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg font-black text-xs px-3">B</button>
            <button onClick={() => execCommand('italic')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg italic text-xs px-3">/</button>
            <div className="w-px h-4 bg-slate-300 mx-2" />
            <button onClick={() => execCommand('insertUnorderedList')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-[10px] font-bold px-3 uppercase">Bullet</button>
        </div>

        <div className="min-h-[250px] relative">
            <div 
              ref={editorRef}
              contentEditable
              className="w-full p-6 focus:outline-none text-slate-700 dark:text-slate-200 text-base whitespace-pre-wrap font-sans leading-relaxed empty:before:content-[attr(placeholder)] empty:before:text-slate-400 min-h-[250px] max-h-[500px] overflow-y-auto custom-scrollbar"
              placeholder="Paste your messy idea, logs, or fragments here... ✨ Synthesis will scrub the noise."
            />
        </div>

        <div className="px-5 pb-3">
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700 min-h-[48px] items-center">
                {tags.map(tag => (
                    <span key={tag} style={getTagStyle(tag)} className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">✕</button>
                    </span>
                ))}
                <input 
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Manual tags..."
                    className="bg-transparent outline-none text-[10px] font-bold text-slate-400 min-w-[120px] flex-1"
                />
            </div>
        </div>
        
        <div className="flex items-center justify-between p-4 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <div className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${aiStep ? 'text-primary-600 animate-pulse' : 'text-slate-400'}`}>
                {aiStep ? `✨ ${aiStep}` : "Engine: Idle Ready"}
            </div>
            <div className="flex gap-3">
                <button onClick={() => handleAction(false)} disabled={isProcessing} className="px-6 py-2 rounded-full font-bold text-xs bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all">Save Raw</button>
                <button 
                  onClick={() => handleAction(true)} 
                  disabled={isProcessing || isGuest} 
                  className={`px-8 py-2 rounded-full font-black text-xs transition-all shadow-xl uppercase tracking-widest relative overflow-hidden group ${isGuest ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:brightness-110 active:scale-95'}`}
                >
                  {isProcessing && <div className="absolute inset-0 bg-white/30 animate-pulse" />}
                  {isProcessing ? 'Synthesizing...' : '✨ Synthesis'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;