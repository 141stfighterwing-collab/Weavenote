'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Subscript,
  Superscript,
  Paperclip,
  Smile,
  Palette,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Save,
  Type,
  Loader2,
  ChevronDown,
  FileText,
  Maximize2,
  Hash,
  ListTree,
  Highlighter,
  Indent,
  Outdent,
} from 'lucide-react';
import { useWSHStore, type NoteType } from '@/store/wshStore';
import { sanitizeHTML } from '@/lib/sanitize';
import CodeEditor from './editors/CodeEditor';
import ProjectEditor from './editors/ProjectEditor';
import DocumentManager from './editors/DocumentManager';
import PromptLibrary from './PromptLibrary';
import { buildResizableImageHtml, optimizeImageForNote } from '@/lib/imageUtils';

const NOTE_TYPES: { type: NoteType; label: string }[] = [
  { type: 'quick', label: 'Quick' },
  { type: 'notebook', label: 'Notebook' },
  { type: 'deep', label: 'Deep' },
  { type: 'code', label: 'Code' },
  { type: 'project', label: 'Project' },
  { type: 'document', label: 'Document' },
  { type: 'ai-prompts', label: 'AI Prompts' },
];

type SynthesisMode = 'summarize' | 'expand' | 'improve' | 'tags' | 'outline';

const synthesisModes: { mode: SynthesisMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'summarize', label: 'Summarize', icon: <FileText className="w-3 h-3" /> },
  { mode: 'expand', label: 'Expand', icon: <Maximize2 className="w-3 h-3" /> },
  { mode: 'improve', label: 'Improve', icon: <Sparkles className="w-3 h-3" /> },
  { mode: 'tags', label: 'Generate Tags', icon: <Hash className="w-3 h-3" /> },
  { mode: 'outline', label: 'Create Outline', icon: <ListTree className="w-3 h-3" /> },
];

export default function NoteEditor() {
  const {
    activeNoteType,
    setActiveNoteType,
    editorTitle,
    setEditorTitle,
    editorContent,
    setEditorContent,
    editorTags,
    setEditorTags,
    addEditorTag,
    removeEditorTag,
    activeNoteId,
    setActiveNoteId,
    addNote,
    updateNote,
    setEditorRawContent,
    saveToLocalStorage,
    setAiUsageCount,
  } = useWSHStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const synthesisMenuRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [engineStatus, setEngineStatus] = useState('Intelligence Idle');
  const [saveStatus, setSaveStatus] = useState('');
  const [synthesisMode, setSynthesisMode] = useState<SynthesisMode>('summarize');
  const [showSynthesisMenu, setShowSynthesisMenu] = useState(false);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidthPercent, setImageWidthPercent] = useState(100);
  const attachFileRef = useRef<HTMLInputElement>(null);

  // Sync content from active note (sanitized)
  useEffect(() => {
    if (editorRef.current) {
      const sanitized = sanitizeHTML(editorContent);
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
      }
    }
  }, [activeNoteId]);

  // Close synthesis menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (synthesisMenuRef.current && !synthesisMenuRef.current.contains(e.target as Node)) {
        setShowSynthesisMenu(false);
      }
    };
    if (showSynthesisMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showSynthesisMenu]);

  const handleContentInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorContent(html);
      setEditorRawContent(editorRef.current.innerText);
    }
  }, [setEditorContent, setEditorRawContent]);

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleContentInput();
  };

  const closeAllPopups = () => {
    setShowEmojiPicker(false);
    setShowColorPicker(false);
    setShowHighlightPicker(false);
    setShowFontSizePicker(false);
    setShowImageDialog(false);
  };

  const EMOJI_LIST = [
    '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊',
    '😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗',
    '🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥',
    '😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝',
    '🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁','😖',
    '😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯',
    '😬','😰','😱','🥵','🥶','😳','🤪','😵','🥴','😠',
    '😡','🤬','😷','🤒','🤕','🤢','🤮','🥺','🥹','😇',
    '🤠','🤡','🥳','🥸','😈','👿','👹','👺','💀','☠️',
    '👻','👽','👾','🤖','💩','😺','😸','😹','😻','😼',
    '😽','🙀','😿','😾','❤️','🧡','💛','💚','💙','💜',
    '🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '💘','💝','👍','👎','👊','✊','🤛','🤜','👏','🙌',
    '👐','🤲','🤝','🙏','✍️','💪','🦾','🦿','🦵','🦶',
    '👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️',
    '👅','👄','🔥','⭐','🌟','✨','💫','🌈','☀️','🌤️',
    '⛅','🌥️','☁️','🌧️','⛈️','🌩️','❄️','🌊','💧','💦',
    '🎉','🎊','🎈','🎁','✅','❌','❗','❓','⚠️','💯',
    '📌','📎','🔗','💡','📝','📋','📅','🎯','🏆','🥇',
  ];

  const COLOR_OPTIONS = [
    { label: 'Red', value: '#ef4444' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Yellow', value: '#eab308' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'Pink', value: '#ec4899' },
    { label: 'Black', value: '#000000' },
    { label: 'White', value: '#ffffff' },
    { label: 'Gray', value: '#6b7280' },
  ];

  const HIGHLIGHT_OPTIONS = [
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bfdbfe' },
    { label: 'Pink', value: '#fbcfe8' },
    { label: 'Orange', value: '#fed7aa' },
    { label: 'Purple', value: '#e9d5ff' },
    { label: 'Red', value: '#fecaca' },
    { label: 'Clear', value: 'transparent' },
  ];

  const FONT_SIZES = [
    { label: 'Tiny', value: '1' },
    { label: 'Small', value: '2' },
    { label: 'Normal', value: '3' },
    { label: 'Medium', value: '4' },
    { label: 'Large', value: '5' },
    { label: 'X-Large', value: '6' },
    { label: 'Huge', value: '7' },
  ];

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
    handleContentInput();
    setShowEmojiPicker(false);
  };

  const applyFontColor = (color: string) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const applyHighlight = (color: string) => {
    if (color === 'transparent') {
      execCommand('removeFormat');
    } else {
      execCommand('hiliteColor', color);
    }
    setShowHighlightPicker(false);
  };

  const applyFontSize = (size: string) => {
    execCommand('fontSize', size);
    setShowFontSizePicker(false);
  };

  const insertImage = () => {
    if (imageUrl.trim()) {
      editorRef.current?.focus();
      const safeUrl = imageUrl.trim();
      document.execCommand('insertHTML', false, `<img src="${safeUrl}" alt="image" data-wsh-image="true" style="max-width:100%;width:${imageWidthPercent}%;height:auto;resize:both;overflow:auto;display:block;border-radius:8px;margin:8px 0" />`);
      handleContentInput();
      setImageUrl('');
      setImageWidthPercent(100);
      setShowImageDialog(false);
    }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (file.type.startsWith('image/')) {
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0" />`);
        handleContentInput();
      } else {
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, `<a href="${dataUrl}" download="${file.name}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#334155;text-decoration:none;margin:4px 0">📎 ${file.name}</a>`);
        handleContentInput();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Close popups on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.toolbar-popup') && !target.closest('.toolbar-popup-trigger')) {
        closeAllPopups();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addEditorTag(tagInput.trim().replace(/^#/, ''));
      setTagInput('');
    }
    if (e.key === 'Backspace' && !tagInput && editorTags.length > 0) {
      removeEditorTag(editorTags[editorTags.length - 1]);
    }
  };

  const handleSave = async () => {
    // Clear any pending timers to prevent stale status
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

    setSaveStatus('Saving...');

    try {
      if (activeNoteId) {
        // Updating an EXISTING note (user clicked Edit on a note)
        const ok = await updateNote(activeNoteId, {
          title: editorTitle,
          content: editorContent,
          rawContent: editorRef.current?.innerText || '',
          type: activeNoteType,
          tags: editorTags,
        });
        if (!ok) {
          setSaveStatus('Save Failed');
          clearTimerRef.current = setTimeout(() => setSaveStatus(''), 3000);
          return;
        }
        // After updating existing note, clear editor for new note entry
        clearEditor();
      } else {
        // Creating a BRAND NEW note on server
        const newNote = {
          id: '',
          title: editorTitle || 'Untitled Note',
          content: editorContent,
          rawContent: editorRef.current?.innerText || '',
          type: activeNoteType,
          tags: editorTags,
          color: 'yellow',
          folderId: useWSHStore.getState().activeFolderId || null,
          userId: useWSHStore.getState().user.username || '',
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const serverId = await addNote(newNote);
        if (serverId) {
          // NOTE: Do NOT set activeNoteId — clear the editor so user can
          // immediately write a NEW note. The saved note is in the notes list.
          clearEditor();
        } else {
          setSaveStatus('Save Failed');
          clearTimerRef.current = setTimeout(() => setSaveStatus(''), 3000);
          return;
        }
      }
      setSaveStatus('Saved ✓');
      clearTimerRef.current = setTimeout(() => setSaveStatus(''), 1500);
    } catch {
      setSaveStatus('Save Failed');
      clearTimerRef.current = setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  /** Clear the editor to prepare for a new note */
  const clearEditor = () => {
    setActiveNoteId(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorRawContent('');
    setActiveNoteType('quick');
    setEditorTags([]);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  const handleSynthesis = async () => {
    const rawContent = editorRef.current?.innerText || '';
    if (!rawContent.trim()) {
      setEngineStatus('No content to process');
      setTimeout(() => setEngineStatus('Intelligence Idle'), 2000);
      return;
    }

    setSynthesisLoading(true);
    setEngineStatus(`Processing ${synthesisMode}...`);

    // Read AI provider/model from localStorage
    let aiProvider = '';
    let aiModel = '';
    try {
      const stored = localStorage.getItem('wsh-ai-settings');
      if (stored) {
        const data = JSON.parse(stored);
        aiProvider = data.provider || '';
        aiModel = data.model || '';
      }
    } catch { /* ignore */ }

    try {
      const token = useWSHStore.getState().user.token;
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: rawContent,
          action: synthesisMode,
          provider: aiProvider,
          model: aiModel,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        let msg = errData.error || `HTTP ${res.status}`;
        if (res.status === 401) msg = 'Session expired — please log out and log back in';
        else if (res.status === 400) msg = 'No AI provider configured — set an API key in Settings > AI Engine';
        else if (res.status === 429) msg = 'Daily AI usage limit reached';
        setEngineStatus(`Error: ${msg}`);
        setTimeout(() => setEngineStatus('Intelligence Idle'), 5000);
        setSynthesisLoading(false);
        return;
      }

      const data = await res.json();

      if (data.error) {
        setEngineStatus(`Error: ${data.error}`);
        setTimeout(() => setEngineStatus('Intelligence Idle'), 5000);
        setSynthesisLoading(false);
        return;
      }

      if (synthesisMode === 'tags') {
        try {
          const tags = JSON.parse(data.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          if (Array.isArray(tags)) {
            tags.forEach((tag: string) => addEditorTag(tag.trim()));
          }
        } catch {
          const fallbackTags = data.result
            .replace(/[[\]"]/g, '')
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
          fallbackTags.forEach((tag: string) => addEditorTag(tag));
        }
        setEngineStatus('Tags Generated');
      } else if (synthesisMode === 'outline') {
        const outlineHtml = data.result
          .replace(/```markdown\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
          .split('\n')
          .map((line: string) => {
            if (line.startsWith('## ')) return `<h2 style="font-size:16px;font-weight:700;margin:8px 0 4px">${line.slice(3)}</h2>`;
            if (line.startsWith('### ')) return `<h3 style="font-size:14px;font-weight:600;margin:6px 0 3px">${line.slice(4)}</h3>`;
            if (line.startsWith('- ')) return `<div style="padding-left:16px">• ${line.slice(2)}</div>`;
            if (line.match(/^\d+\. /)) return `<div style="padding-left:16px">${line}</div>`;
            return `<p>${line}</p>`;
          })
          .join('');
        if (editorRef.current) {
          const safeOutline = sanitizeHTML(outlineHtml);
          editorRef.current.innerHTML = safeOutline;
          setEditorContent(safeOutline);
          setEditorRawContent(data.result);
        }
        setEngineStatus('Outline Created');
      } else {
        const resultHtml = data.result
          .replace(/```markdown\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
          .split('\n')
          .map((line: string) => `<p>${line}</p>`)
          .join('');
        if (editorRef.current) {
          const safeResult = sanitizeHTML(resultHtml);
          editorRef.current.innerHTML = safeResult;
          setEditorContent(safeResult);
          setEditorRawContent(data.result);
        }
        setEngineStatus(`${synthesisMode.charAt(0).toUpperCase() + synthesisMode.slice(1)} Complete`);
      }

      if (data.tokensUsed) {
        const currentCount = useWSHStore.getState().aiUsageCount;
        setAiUsageCount(currentCount + (data.tokensUsed || 0));
      }

      setShowSynthesisMenu(false);
      setTimeout(() => setEngineStatus('Intelligence Idle'), 3000);
    } catch {
      setEngineStatus('Synthesis Failed');
      setTimeout(() => setEngineStatus('Intelligence Idle'), 3000);
    }

    setSynthesisLoading(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-2xl ring-4 ring-black/5 overflow-hidden transition-theme">
      {/* Note Type Tabs */}
      <div className="flex gap-1 p-2 bg-secondary/30 overflow-x-auto">
        {NOTE_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setActiveNoteType(type)}
            className={`py-2 px-3 text-[10px] font-black rounded-xl min-w-[85px] uppercase tracking-widest whitespace-nowrap transition-all duration-200 active:scale-95 ${
              activeNoteType === type
                ? 'bg-pri-600 text-white shadow-lg'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="px-3 pt-2">
        <input
          type="text"
          value={editorTitle}
          onChange={(e) => setEditorTitle(e.target.value)}
          placeholder="Title of this Idea block..."
          className="w-full bg-transparent font-bold text-lg text-foreground placeholder:text-muted-foreground/40 focus:outline-none border-b border-transparent focus:border-pri-500/30 pb-2 transition-colors"
        />
      </div>

      {/* Toolbar — hidden for AI Prompts tab */}
      {activeNoteType !== 'ai-prompts' && (
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/50 overflow-x-auto">
        {/* Font selector */}
        <select
          value="inter"
          className="bg-transparent text-xs text-muted-foreground px-1.5 py-1 rounded-md hover:bg-secondary focus:outline-none cursor-pointer"
          disabled
          title="Font selection coming soon"
        >
          <option value="inter">Inter</option>
          <option value="mono">Fira Code</option>
          <option value="kalam">Kalam</option>
        </select>

        <div className="w-px h-4 bg-border/50 mx-1" />

        <button
          onClick={() => execCommand('bold')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('italic')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('underline')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('strikeThrough')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/50 mx-1" />

        <button
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/50 mx-1" />

        <button
          onClick={() => execCommand('subscript')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Subscript"
        >
          <Subscript className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('superscript')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Superscript"
        >
          <Superscript className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/50 mx-1" />

        <button
          onClick={() => execCommand('justifyLeft')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('justifyCenter')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('justifyRight')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Attach File */}
        <button
          onClick={() => attachFileRef.current?.click()}
          className="toolbar-popup-trigger p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Attach File"
        >
          <Paperclip className="w-3.5 h-3.5" />
        </button>
        <input
          ref={attachFileRef}
          type="file"
          className="hidden"
          onChange={handleAttachFile}
          accept="image/*,.pdf,.txt,.md,.docx,.doc,.csv,.json,.xml,.yaml,.yml,.py,.js,.ts,.html,.css"
        />

        {/* Indent */}
        <button
          onClick={() => execCommand('indent')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Indent"
        >
          <Indent className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('outdent')}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95"
          title="Outdent"
        >
          <Outdent className="w-3.5 h-3.5" />
        </button>

        {/* Emoji Picker */}
        <div className="relative">
          <button
            onClick={() => { closeAllPopups(); setShowEmojiPicker(!showEmojiPicker); }}
            className={`toolbar-popup-trigger p-1.5 rounded-md transition-all active:scale-95 ${showEmojiPicker ? 'text-pri-400 bg-pri-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Emoji"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          {showEmojiPicker && (
            <div className="toolbar-popup absolute top-full left-0 mt-1 w-72 max-h-56 bg-card border border-border rounded-xl shadow-2xl p-2 overflow-y-auto z-50 animate-fadeIn">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Emojis</p>
              <div className="grid grid-cols-10 gap-0.5">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="w-7 h-7 flex items-center justify-center text-base hover:bg-secondary rounded-md transition-all active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Color */}
        <div className="relative">
          <button
            onClick={() => { closeAllPopups(); setShowColorPicker(!showColorPicker); }}
            className={`toolbar-popup-trigger p-1.5 rounded-md transition-all active:scale-95 ${showColorPicker ? 'text-pri-400 bg-pri-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          {showColorPicker && (
            <div className="toolbar-popup absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 animate-fadeIn">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Text Color</p>
              <div className="grid grid-cols-5 gap-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => applyFontColor(c.value)}
                    className="w-7 h-7 rounded-lg border border-border/50 hover:scale-110 transition-all active:scale-95"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="relative">
          <button
            onClick={() => { closeAllPopups(); setShowHighlightPicker(!showHighlightPicker); }}
            className={`toolbar-popup-trigger p-1.5 rounded-md transition-all active:scale-95 ${showHighlightPicker ? 'text-pri-400 bg-pri-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Highlight Color"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          {showHighlightPicker && (
            <div className="toolbar-popup absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 animate-fadeIn">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Highlight</p>
              <div className="grid grid-cols-4 gap-1">
                {HIGHLIGHT_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => applyHighlight(c.value)}
                    className="h-7 rounded-lg border border-border/50 hover:scale-110 transition-all active:scale-95 text-[9px] font-bold px-1"
                    style={c.value === 'transparent' ? {} : { backgroundColor: c.value }}
                    title={c.label}
                  >
                    {c.value === 'transparent' ? '✕' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Font Size */}
        <div className="relative">
          <button
            onClick={() => { closeAllPopups(); setShowFontSizePicker(!showFontSizePicker); }}
            className={`toolbar-popup-trigger p-1.5 rounded-md transition-all active:scale-95 ${showFontSizePicker ? 'text-pri-400 bg-pri-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Font Size"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          {showFontSizePicker && (
            <div className="toolbar-popup absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 animate-fadeIn">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">Font Size</p>
              <div className="flex flex-col gap-0.5">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => applyFontSize(s.value)}
                    className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95 text-left"
                  >
                    <span style={{ fontSize: `${parseInt(s.value) * 4 + 8}px` }}>{s.label}</span>
                    <span className="text-[9px] text-muted-foreground/40 ml-2">({s.value})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insert Image */}
        <div className="relative">
          <button
            onClick={() => { closeAllPopups(); setShowImageDialog(!showImageDialog); }}
            className={`toolbar-popup-trigger p-1.5 rounded-md transition-all active:scale-95 ${showImageDialog ? 'text-pri-400 bg-pri-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Insert Image"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          {showImageDialog && (
            <div className="toolbar-popup absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-2xl p-3 z-50 animate-fadeIn">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Insert Image from URL</p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') insertImage(); }}
                  placeholder="https://example.com/image.png"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-secondary border border-transparent focus:border-pri-500 focus:outline-none"
                />
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="min-w-20">Initial width</span>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={imageWidthPercent}
                    onChange={(e) => setImageWidthPercent(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right">{imageWidthPercent}%</span>
                </label>
                <button
                  onClick={insertImage}
                  className="self-end px-3 py-1.5 rounded-lg text-[10px] font-bold bg-pri-600 text-white hover:bg-pri-700 transition-all active:scale-95"
                >
                  Insert
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Content Editor — Specialized per note type */}
      {activeNoteType === 'ai-prompts' ? (
        <div className="h-[500px] overflow-hidden">
          <PromptLibrary />
        </div>
      ) : activeNoteType === 'code' ? (
        <CodeEditor
          title={editorTitle}
          setTitle={setEditorTitle}
          content={editorContent}
          setContent={(v) => { setEditorContent(v); setEditorRawContent(v); }}
        />
      ) : activeNoteType === 'project' ? (
        <ProjectEditor
          title={editorTitle}
          setTitle={setEditorTitle}
          content={editorContent}
          setContent={(v) => { setEditorContent(v); setEditorRawContent(v); }}
        />
      ) : activeNoteType === 'document' ? (
        <DocumentManager />
      ) : (
        <div className="px-3 py-2">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentInput}
            data-placeholder="Start writing your thoughts..."
            className="min-h-[450px] h-[450px] max-h-[600px] overflow-y-auto bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-4 text-sm text-foreground leading-relaxed editor-inner focus:ring-2 focus:ring-pri-500/20 transition-all duration-200 resize-y"
            style={{ minHeight: '300px' }}
          />
        </div>
      )}

      {/* Hashtags — hidden for AI Prompts tab */}
      {activeNoteType !== 'ai-prompts' && (
      <div className="px-3 pb-2">
        <div
          onClick={() => tagInputRef.current?.focus()}
          className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl px-3 py-2 min-h-[48px] border border-transparent focus-within:border-pri-500/30 transition-colors cursor-text"
        >
          {editorTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pri-500/15 text-pri-400 border border-pri-500/20"
            >
              #{tag}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeEditorTag(tag);
                }}
                className="hover:text-destructive transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={editorTags.length === 0 ? 'Add tags (press Enter)...' : ''}
            className="flex-1 min-w-[100px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>
      </div>
      )}

      {/* Status Bar — hidden for AI Prompts tab */}
      {activeNoteType !== 'ai-prompts' && (
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-t border-border/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground">
            Engine: {engineStatus}
          </span>
          {engineStatus !== 'Intelligence Idle' && (
            <span className="w-1.5 h-1.5 rounded-full bg-pri-500 animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground border border-border hover:bg-secondary transition-all active:scale-95"
          >
            <Save className={`w-3 h-3 ${saveStatus === 'Saved ✓' ? 'text-green-400' : ''}`} />
            {saveStatus === 'Saving...' && <span className="text-pri-400">Saving...</span>}
            {saveStatus === 'Saved ✓' && <span className="text-green-400">Saved ✓</span>}
            {!saveStatus && 'Save'}
          </button>

          {/* Synthesis Button with Dropdown */}
          <div className="relative" ref={synthesisMenuRef}>
            <button
              onClick={() => setShowSynthesisMenu(!showSynthesisMenu)}
              disabled={synthesisLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-pri-600 text-white hover:bg-pri-700 transition-all active:scale-95 shadow-lg disabled:opacity-50"
            >
              {synthesisLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Synthesis
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {showSynthesisMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-2xl p-1.5 animate-fadeIn z-50">
                {synthesisModes.map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSynthesisMode(mode);
                      setShowSynthesisMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all active:scale-95 ${
                      synthesisMode === mode
                        ? 'bg-pri-600/15 text-pri-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                    {synthesisMode === mode && (
                      <span className="ml-auto text-[9px] font-bold">Active</span>
                    )}
                  </button>
                ))}
                <div className="border-t border-border/50 my-1" />
                <button
                  onClick={handleSynthesis}
                  disabled={synthesisLoading}
                  className="w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-pri-600 text-white hover:bg-pri-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {synthesisLoading ? (
                    <span className="flex items-center justify-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                    </span>
                  ) : (
                    `Run ${synthesisModes.find((m) => m.mode === synthesisMode)?.label}`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
