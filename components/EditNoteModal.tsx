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
          
          // Merge AI tags with current manual tags and any newly found hashtags in the text
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
    // Final sync of tags from text content before saving
    const finalTags = Array.from(new Set([...manualTags, ...extractHashtags(title), ...extractHashtags(content)]));
    onSave(note.id, title, content, aiResult?.category, finalTags);
    onClose();
  };

  const applyFormat = (format: 'bold' | 'italic' | 'checkbox' | 'list' | 'header') => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      let newText = '';
      let newCursorPos = end;
      switch(format) {
          case 'bold': newText = content.substring(0, start) + `**${selectedText}**` + content.substring(end); newCursorPos = end + 4; break;
          case 'italic': newText = content.substring(0, start) + `*${selectedText}*` + content.substring(end); newCursorPos = end + 2; break;
          case 'header': newText = content.substring(0, start) + `### ${selectedText}` + content.substring(end); newCursorPos = start + selectedText.length + 4; break;
          case 'checkbox': newText = content.substring(0, start) + `- [ ] ${selectedText}` + content.substring(end); newCursorPos = end + 6; break;
          case 'list': newText = content.substring(0, start) + `- ${selectedText}` + content.substring(end); newCursorPos = end + 2; break;
      }
      setContent(newText);
      setTimeout(() => { textarea.focus(); textarea.setSelectionRange(newCursorPos, newCursorPos); }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-[fadeIn_0.2s_ease-out]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-indigo-500">✏️</span> Edit Note
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col p-6 overflow-hidden bg-white dark:bg-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border rounded-lg font-bold text-lg dark:bg-slate-700 dark:text-white" required />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Tags (Press Enter)</label>
              <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={newTagInput} 
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(newTagInput); } }}
                        className="flex-1 px-3 py-1.5 text-sm border rounded dark:bg-slate-700 dark:text-white outline-none focus:ring-1 focus:ring-primary-500" 
                        placeholder="Add #tag..."
                      />
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {manualTags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded text-[10px] font-bold flex items-center gap-1 border border-primary-100">
                            #{tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">✕</button>
                        </span>
                    ))}
                  </div>
              </div>
            </div>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Content Canvas</label>
                <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg shadow-inner">
                    <button type="button" onClick={() => applyFormat('bold')} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded">B</button>
                    <button type="button" onClick={() => applyFormat('italic')} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded">I</button>
                    <button type="button" onClick={() => applyFormat('checkbox')} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded">[/]</button>
                    <button type="button" onClick={() => applyFormat('header')} className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded text-[10px] font-bold">H3</button>
                </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full flex-grow px-6 py-6 border rounded-xl font-mono text-sm dark:bg-slate-700 dark:text-slate-200 resize-none min-h-[500px]"
              required
            />
          </div>
          <div className="flex justify-between items-center pt-6 mt-6 border-t dark:border-slate-700">
            <button 
              type="button" 
              onClick={handleAIOrganize} 
              disabled={isProcessing || isGuest} 
              className={`px-6 py-3 font-bold rounded-xl shadow transition-all transform hover:-translate-y-0.5 ${isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg'}`}
              title={isGuest ? "Login required for AI features" : "AI Organize"}
            >
              {isProcessing ? '✨ Organizing...' : isGuest ? '✨ AI (Login)' : '✨ AI Organize'}
            </button>
            <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" className="px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all">Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditNoteModal;