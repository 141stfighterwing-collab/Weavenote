import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../types';
import { processNoteWithAI } from '../services/geminiService';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string, category?: string, tags?: string[]) => void;
  currentUser: string;
}

const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSave, currentUser }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{category: string, tags: string[]} | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGuest = currentUser === 'Guest';

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setManualTags(note.tags);
      setAiResult(null);
      setError(null);
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g);
    return matches ? matches.map(m => m.substring(1).toLowerCase()) : [];
  };

  const handleAIOrganize = async () => {
      if (isGuest) return;
      setIsProcessing(true);
      setError(null);
      try {
          const processed = await processNoteWithAI(content, [], note.type, currentUser);
          setTitle(processed.title);
          setContent(processed.formattedContent);
          setAiResult({ category: processed.category, tags: processed.tags });
          const currentTextTags = [...extractHashtags(processed.formattedContent), ...extractHashtags(processed.title)];
          setManualTags(prev => Array.from(new Set([...prev, ...processed.tags, ...currentTextTags])));
      } catch (err: any) {
          setError(err.message || "AI Organization failed.");
      } finally {
          setIsProcessing(false);
      }
  };

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace('#', '');
    if (clean && !manualTags.includes(clean)) {
        setManualTags([...manualTags, clean]);
    }
    setNewTagInput('');
  };

  const removeTag = (tag: string) => {
    setManualTags(manualTags.filter(t => t !== tag));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTags = Array.from(new Set([...manualTags, ...extractHashtags(title), ...extractHashtags(content)]));
    onSave(note.id, title, content, aiResult?.category, finalTags);
    onClose();
  };

  const applyFormat = (before: string, after: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.substring(start, end);
      const newText = content.substring(0, start) + before + selected + after + content.substring(end);
      setContent(newText);
      setTimeout(() => { 
          textarea.focus(); 
          textarea.setSelectionRange(end + before.length + after.length, end + before.length + after.length); 
      }, 0);
  };

  const emojis = ['💡', '📌', '✅', '🚀', '🔥', '📚', '✨', '🧠', '📅', '💼'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-[fadeIn_0.2s_ease-out]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">✏️</span> Edit Note
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-8 overflow-hidden bg-white dark:bg-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Note Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-5 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xl dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Context Tags</label>
              <div className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    value={newTagInput} 
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); } }}
                    className="w-full px-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                    placeholder="Press enter to add..."
                  />
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {manualTags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800">
                            #{tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">✕</button>
                        </span>
                    ))}
                  </div>
              </div>
            </div>
          </div>
          
          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-3">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-400">Content Canvas</label>
                <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
                    <button type="button" onClick={() => applyFormat('**', '**')} className="px-3 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all shadow-sm">B</button>
                    <button type="button" onClick={() => applyFormat('*', '*')} className="px-3 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs italic transition-all shadow-sm">I</button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                    <button type="button" onClick={() => applyFormat('# ')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-[10px] font-black transition-all shadow-sm">H1</button>
                    <button type="button" onClick={() => applyFormat('## ')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-[10px] font-black transition-all shadow-sm">H2</button>
                    <button type="button" onClick={() => applyFormat('### ')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-[10px] font-black transition-all shadow-sm">H3</button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                    <button type="button" onClick={() => applyFormat('- [ ] ')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs transition-all shadow-sm">☑️</button>
                    <button type="button" onClick={() => applyFormat('- ')} className="px-2 py-1 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-xs transition-all shadow-sm">•</button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                    {emojis.map(e => (
                        <button key={e} type="button" onClick={() => applyFormat(e)} className="hover:bg-white dark:hover:bg-slate-800 p-1.5 rounded-lg text-lg transition-transform hover:scale-110" title="Emoji">{e}</button>
                    ))}
                </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full flex-grow px-8 py-8 border border-slate-200 dark:border-slate-700 rounded-2xl font-sans text-base dark:bg-slate-900 dark:text-slate-200 resize-none focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all leading-relaxed shadow-inner"
              placeholder="Start weaving your thoughts..."
              required
            />
          </div>
          
          <div className="flex justify-between items-center pt-8 mt-8 border-t border-slate-100 dark:border-slate-700">
            <button 
              type="button" 
              onClick={handleAIOrganize} 
              disabled={isProcessing || isGuest} 
              className={`px-8 py-3 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all transform hover:-translate-y-1 ${isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/20'}`}
              title={isGuest ? "Login required for AI features" : "AI Organize"}
            >
              {isProcessing ? '⌛ Organizing...' : isGuest ? '✨ Login for AI' : '✨ Neural Optimize'}
            </button>
            <div className="flex gap-4">
                <button type="button" onClick={onClose} className="px-8 py-3 font-black uppercase tracking-widest text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Discard</button>
                <button type="submit" className="px-12 py-3 bg-slate-900 dark:bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-xl hover:brightness-110 transition-all transform hover:-translate-y-1">Commit Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;