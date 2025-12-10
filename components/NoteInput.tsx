import React, { useState, useRef } from 'react';
import { NoteType } from '../types';
import { parseDocument } from '../services/documentParser';

interface NoteInputProps {
  onAddNote: (text: string, type: NoteType, attachments?: string[], forcedTags?: string[], useAI?: boolean) => Promise<void>;
  isProcessing: boolean;
  activeType: NoteType;
  readOnly?: boolean;
  enableImages?: boolean;
}

const POPULAR_EMOJIS = [
  "😀", "😂", "🥰", "🤔", "😎", "👍", "👎", "🔥", "✨", "💡", 
  "🧠", "⚡", "📝", "✅", "❌", "⚠️", "🚩", "🎉", "📅", "📍", 
  "📎", "💻", "🚀", "🎨"
];

const NoteInput: React.FC<NoteInputProps> = ({ onAddNote, isProcessing, activeType: initialActiveType, readOnly = false, enableImages = false }) => {
  const [text, setText] = useState('');
  const [selectedType, setSelectedType] = useState<NoteType>(initialActiveType);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  
  // Bulk Import State
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [importProgress, setImportProgress] = useState<{current: number, total: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync internal type state with prop when prop changes (e.g. navigation click)
  React.useEffect(() => {
      setSelectedType(initialActiveType);
  }, [initialActiveType]);

  if (readOnly) {
      return (
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 mb-8 border-dashed">
             <span className="text-xl block mb-2">🔒</span>
             <p className="font-medium">Read Only Mode</p>
             <p className="text-xs mt-1">You have permission to view these notes, but not edit or create new ones.</p>
          </div>
      );
  }

  const applyFormat = (format: 'bold' | 'italic' | 'checkbox' | 'link' | 'list') => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = text.substring(start, end);
      
      let newText = '';
      let newCursorPos = end;

      switch(format) {
          case 'bold':
              newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
              newCursorPos = end + 4; // Add 2 * 2 chars
              break;
          case 'italic':
              newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end);
              newCursorPos = end + 2;
              break;
          case 'checkbox':
              // If selection spans multiple lines, prefix each line
              if (selectedText.includes('\n') || start === end) {
                  // Find start of line
                  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                  const prefix = "- [ ] ";
                  // Logic to check if already checkbox exists could be added here
                  newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
                  newCursorPos = start + prefix.length;
              } else {
                  newText = text.substring(0, start) + `- [ ] ${selectedText}` + text.substring(end);
                  newCursorPos = end + 6;
              }
              break;
          case 'list':
               // Handle Bullet Points
               if (selectedText.includes('\n')) {
                   // Multi-line selection
                   const lines = selectedText.split('\n');
                   const formattedLines = lines.map(line => line.trim().startsWith('- ') ? line : `- ${line}`);
                   newText = text.substring(0, start) + formattedLines.join('\n') + text.substring(end);
                   newCursorPos = start + formattedLines.join('\n').length;
               } else if (start === end) {
                   // No selection, insert at start of line
                   const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                   const prefix = "- ";
                   newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
                   newCursorPos = start + prefix.length;
               } else {
                   // Single line selection
                   newText = text.substring(0, start) + `- ${selectedText}` + text.substring(end);
                   newCursorPos = end + 2;
               }
               break;
          case 'link':
              newText = text.substring(0, start) + `[${selectedText || 'Link Text'}](url)` + text.substring(end);
              newCursorPos = start + (selectedText ? selectedText.length + 3 : 11); // Position inside ()
              break;
      }

      setText(newText);
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
  };

  const handleAction = async (useAI: boolean) => {
    // Handle Bulk Import
    if (bulkFiles.length > 0) {
        setIsParsing(true);
        const batchTag = `batch-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
        const manualContextTags = text.match(/#[\w-]+/g)?.map(t => t.substring(1)) || [];
        const forcedTags = [batchTag, ...manualContextTags];
        
        let processedCount = 0;
        setImportProgress({ current: 0, total: bulkFiles.length });

        for (let i = 0; i < bulkFiles.length; i++) {
            const file = bulkFiles[i];
            try {
                const content = await parseDocument(file);
                // Prepend filename context to content
                const fullContent = `**Source: ${file.name}**\n\n${content}`;
                await onAddNote(fullContent, selectedType, [], forcedTags, useAI);
            } catch (err) {
                console.error(`Failed to import ${file.name}`, err);
            }
            processedCount++;
            setImportProgress({ current: processedCount, total: bulkFiles.length });
        }
        
        // Reset state
        setBulkFiles([]);
        setImportProgress(null);
        setIsParsing(false);
        setText('');
        return;
    }

    if (!text.trim() && attachments.length === 0) return;
    await onAddNote(text, selectedType, attachments, [], useAI);
    setText('');
    setAttachments([]);
  };

  const addEmoji = (emoji: string) => {
      const textarea = textareaRef.current;
      if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = text.substring(0, start) + emoji + text.substring(end);
          setText(newText);
          
          // Restore focus and move cursor after the inserted emoji
          setTimeout(() => {
              textarea.focus();
              const newCursorPos = start + emoji.length;
              textarea.setSelectionRange(newCursorPos, newCursorPos);
          }, 0);
      } else {
          setText(prev => prev + emoji);
      }
      setShowEmojiPicker(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 300 * 1024) {
          alert("Image too large. Please upload an image smaller than 300KB for browser storage safety.");
          return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
          if (reader.result) {
              setAttachments(prev => [...prev, reader.result as string]);
          }
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (files.length > 1) {
          // Bulk Mode
          setBulkFiles(files);
          setText(''); // Clear text or set initial placeholder
      } else {
          // Single File Mode (Original Behavior)
          const file = files[0];
          setIsParsing(true);
          try {
              const content = await parseDocument(file);
              setText(prev => {
                  const prefix = prev ? prev + "\n\n" : "";
                  return prefix + `**Document Import: ${file.name}**\n\n` + content;
              });
              setBulkFiles([]); // Ensure bulk mode is off
          } catch (err: any) {
              alert(err.message);
          } finally {
              setIsParsing(false);
          }
      }
      
      if (docInputRef.current) docInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getBackgroundColor = () => {
      switch (selectedType) {
          case 'quick': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900/50';
          case 'deep': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/50';
          case 'project': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50';
          case 'contact': return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-900/50';
          case 'document': return 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
          default: return 'bg-slate-50 border-slate-200';
      }
  };

  const getButtonClass = (type: NoteType, activeColorClass: string) => {
      const isActive = selectedType === type;
      return `flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 md:gap-2 ${
          isActive 
          ? `bg-white dark:bg-slate-800 ${activeColorClass} shadow-sm ring-1 ring-inset ring-black/5` 
          : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
      }`;
  };

  const isDisabled = (!text.trim() && attachments.length === 0 && bulkFiles.length === 0) || isProcessing || isParsing;
  
  const getPlaceholder = () => {
      if (bulkFiles.length > 0) {
          return "Add optional context or manual tags (e.g., #meeting-notes) to apply to all imported files...";
      }
      switch(selectedType) {
          case 'quick': return "Grocery list, meeting agenda, quick reminders...";
          case 'deep': return "Paste research notes, article drafts, or complex study topics here...";
          case 'project': return "Project name, key objectives, milestones, and tasks...";
          case 'contact': return "Name, email, phone number, and context about this person...";
          case 'document': return "Paste text manually, or Drop a PDF/Text file above to ingest content...";
          default: return "Type your note here...";
      }
  };

  return (
    <div className={`rounded-xl shadow-lg border p-1 mb-8 transition-colors duration-300 ${getBackgroundColor()}`}>
        {/* Type Toggles */}
        <div className="grid grid-cols-5 gap-1 p-1 mb-1">
            <button
                type="button"
                onClick={() => setSelectedType('quick')}
                className={getButtonClass('quick', 'text-yellow-700 dark:text-yellow-400')}
            >
                <span className="text-lg">⚡</span> <span className="hidden sm:inline">Quick</span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedType('deep')}
                className={getButtonClass('deep', 'text-blue-700 dark:text-blue-400')}
            >
                <span className="text-lg">🧠</span> <span className="hidden sm:inline">Deep</span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedType('project')}
                className={getButtonClass('project', 'text-green-700 dark:text-green-400')}
            >
                <span className="text-lg">🚀</span> <span className="hidden sm:inline">Project</span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedType('contact')}
                className={getButtonClass('contact', 'text-orange-700 dark:text-orange-400')}
            >
                <span className="text-lg">👤</span> <span className="hidden sm:inline">Contact</span>
            </button>
            <button
                type="button"
                onClick={() => setSelectedType('document')}
                className={getButtonClass('document', 'text-slate-700 dark:text-slate-400')}
            >
                <span className="text-lg">📄</span> <span className="hidden sm:inline">Doc</span>
            </button>
        </div>

      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors">
        
        {/* Special Dropzone for Document Type */}
        {selectedType === 'document' && (
            <div className="px-4 pt-4 pb-2">
                <div 
                    onClick={() => docInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${isParsing ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                    <input 
                        type="file" 
                        multiple
                        ref={docInputRef} 
                        onChange={handleDocUpload} 
                        accept=".pdf,.txt,.md,.json,.csv"
                        className="hidden" 
                    />
                    {isParsing && importProgress ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-primary-600 dark:text-primary-400">
                             <div className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-sm font-bold">Importing Batch...</span>
                             </div>
                             <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}></div>
                             </div>
                             <span className="text-xs">{importProgress.current} / {importProgress.total} notes processed</span>
                        </div>
                    ) : isParsing ? (
                         <div className="flex items-center justify-center gap-2 text-primary-600 dark:text-primary-400 animate-pulse">
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span className="text-sm font-bold">Ingesting...</span>
                         </div>
                    ) : bulkFiles.length > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl text-primary-500">📚</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                {bulkFiles.length} files selected for Batch Import
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 max-w-sm truncate">
                                {bulkFiles.map(f => f.name).join(', ')}
                            </span>
                            <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setBulkFiles([]); }}
                                className="text-xs text-red-500 hover:underline mt-1"
                            >
                                Cancel Batch
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl">📥</span>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                Click to Ingest Document(s)
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                Drag & Drop multiple PDF (Max 20 pages), TXT, or MD files
                            </span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-lg overflow-x-auto">
            <button onClick={() => applyFormat('bold')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Bold">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>
            </button>
            <button onClick={() => applyFormat('italic')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Italic">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="22"></line><line x1="14" y1="4" x2="5" y2="22"></line></svg>
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => applyFormat('list')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Bullet Points">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
            <button onClick={() => applyFormat('checkbox')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Checklist">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button onClick={() => applyFormat('link')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Link">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full h-32 p-4 bg-transparent border-0 focus:ring-0 transition-all resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 leading-relaxed font-sans"
          disabled={isProcessing || isParsing}
        />
        
        {/* Attachments Preview */}
        {attachments.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
                {attachments.map((src, i) => (
                    <div key={i} className="relative group shrink-0">
                        <img src={src} alt="attachment" className="w-16 h-16 object-cover rounded-md border border-slate-200" />
                        <button 
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
                {/* Emoji Picker Trigger */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                        title="Add Emoji"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                    </button>
                    {showEmojiPicker && (
                        <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-slate-100 dark:border-slate-700 z-10 grid grid-cols-6 gap-1 w-48 animate-[fadeIn_0.1s_ease-out]">
                            <div className="fixed inset-0 z-[-1]" onClick={() => setShowEmojiPicker(false)}></div>
                            {POPULAR_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => addEmoji(emoji)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-xl"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Image Upload Trigger */}
                {enableImages && (
                    <>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                            title="Add Image"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            className="hidden"
                        />
                    </>
                )}
            </div>

            <div className="flex items-center gap-2">
                {isProcessing && (
                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium animate-pulse">
                        {bulkFiles.length > 0 ? 'Batch Processing...' : 'Processing...'}
                    </span>
                )}
                
                {/* Manual Add Button - Hidden when in Batch Mode to enforce AI processing */}
                {bulkFiles.length === 0 && (
                    <button
                        type="button"
                        onClick={() => handleAction(false)}
                        disabled={isDisabled}
                        className="px-4 py-2 rounded-full font-semibold text-sm transition-all bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Note
                    </button>
                )}

                {/* AI Organize Button */}
                <button
                    type="button"
                    onClick={() => handleAction(true)}
                    disabled={isDisabled}
                    className="flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:shadow-lg hover:from-primary-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                    )}
                    {bulkFiles.length > 0 ? 'AI Process Batch' : 'AI Organize'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default NoteInput;