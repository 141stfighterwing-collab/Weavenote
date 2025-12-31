
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, NoteColor, NoteType, ViewMode, Theme, Folder, User, ProjectData, ProjectMilestone } from './types';
import { processNoteWithAI, getDailyUsage } from './services/geminiService';
// Removed non-existent parseImportFile from imports
import { 
    loadNotes, saveNote, deleteNote, 
    loadFolders, saveFolder, deleteFolder, 
    syncAllNotes 
} from './services/storageService';
import { subscribeToAuthChanges } from './services/authService';
import NoteCard from './components/NoteCard';
import NoteInput from './components/NoteInput';
import MindMap from './components/MindMap';
import EditNoteModal from './components/EditNoteModal';
import NoteDetailModal from './components/NoteDetailModal';
import LoginWidget from './components/LoginWidget';
import SettingsPanel from './components/SettingsPanel';
import ImageViewerModal from './components/ImageViewerModal';
import AnalyticsModal from './components/AnalyticsModal';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import TrashModal from './components/TrashModal';
import { NotebookView } from './components/NotebookView';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<NoteType>('quick');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeDateFilter, setActiveDateFilter] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [expandedNote, setExpandedNote] = useState<Note | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ideaweaver_darkmode') !== 'false');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ideaweaver_theme') as Theme) || 'default');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('ideaweaver_reducedmotion') === 'true');
  const [enableImages, setEnableImages] = useState(() => localStorage.getItem('ideaweaver_enableimages') === 'true');
  const [showLinkPreviews, setShowLinkPreviews] = useState(() => localStorage.getItem('ideaweaver_linkpreviews') === 'true');

  const extractHashtags = (text: string): string[] => {
    const matches = text.match(/#(\w+)/g);
    return matches ? matches.map(m => m.substring(1).toLowerCase()) : [];
  };

  useEffect(() => {
    const body = document.body;
    const themeClasses = [
      'theme-ocean', 'theme-forest', 'theme-sunset', 'theme-rose', 
      'theme-midnight', 'theme-coffee', 'theme-neon', 'theme-cyberpunk', 
      'theme-nord', 'theme-dracula', 'theme-lavender', 'theme-earth',
      'theme-yellow', 'theme-hyperblue'
    ];
    body.classList.remove(...themeClasses);
    if (theme !== 'default') {
        body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('ideaweaver_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ideaweaver_darkmode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
      const unsubscribe = subscribeToAuthChanges((user) => {
          setCurrentUser(user);
          setIsAuthChecking(false);
      });
      return () => unsubscribe();
  }, []);

  const canEdit = currentUser ? currentUser.permission === 'edit' : true; 
  const storageOwner = currentUser ? currentUser.uid : null;

  useEffect(() => {
    if (isAuthChecking) return;
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const fetchedNotes = await loadNotes(storageOwner);
            const fetchedFolders = await loadFolders(storageOwner);
            
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const validNotes = [];
            for (const n of fetchedNotes) {
                if (n.isDeleted && (n.deletedAt || 0) < thirtyDaysAgo) {
                    await deleteNote(n.id, storageOwner);
                } else {
                    validNotes.push(n);
                }
            }
            
            setNotes(validNotes);
            setFolders(fetchedFolders);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setIsLoadingData(false);
        }
    };
    fetchData();
    setDailyUsage(getDailyUsage());
  }, [storageOwner, isAuthChecking]);

  const handleLoginSuccess = (user: User) => setCurrentUser(user);
  const handleLogout = () => { setCurrentUser(null); setNotes([]); setFolders([]); };

  const handleTabChange = (type: NoteType) => {
      setActiveTab(type);
      setActiveTagFilter(null);
      setActiveFolderId(null);
      setActiveDateFilter(null);
      setSearchQuery('');
  };

  const handleExpandNote = async (note: Note) => {
    setExpandedNote(note);
    const updatedNote = { ...note, accessCount: (note.accessCount || 0) + 1 };
    setNotes(prev => prev.map(n => n.id === note.id ? updatedNote : n));
    await saveNote(updatedNote, storageOwner);
  };

  const handleAddNote = async (rawText: string, type: NoteType, attachments: string[] = [], forcedTags: string[] = [], useAI: boolean = true, manualTitle: string = '', extraProjectData?: { 
    manualProgress?: number, 
    isCompleted?: boolean,
    manualObjectives?: string[],
    manualDeliverables?: string[],
    manualMilestones?: ProjectMilestone[]
  }): Promise<Note | undefined> => {
    if (!canEdit) return;
    
    // Explicit Guard: Guests cannot use AI
    if (useAI && !currentUser) {
      useAI = false;
    }

    setIsProcessing(true);
    try {
        let processed;
        let tags = [...forcedTags, ...extractHashtags(rawText), ...extractHashtags(manualTitle)];
        
        if (type === 'quick') {
            const today = new Date().toISOString().split('T')[0]; 
            if (!tags.includes(today)) tags.push(today);
        }

        if (useAI) {
            const username = currentUser?.username || 'Guest';
            processed = await processNoteWithAI(rawText, [], type, username, currentUser?.uid);
            tags = [...processed.tags.map(t => t.toLowerCase().replace('#', '')), ...tags];
            if (manualTitle.trim()) processed.title = manualTitle.trim();
        } else {
            processed = {
                title: manualTitle.trim() || rawText.split('\n')[0].substring(0, 40) || 'New Note',
                formattedContent: rawText,
                category: type.toUpperCase(),
                tags: [...tags]
            };
        }

        if (type === 'project') {
            if (!processed.projectData) processed.projectData = { deliverables: [], milestones: [], timeline: [], objectives: [] };
            if (extraProjectData) {
              processed.projectData.manualProgress = extraProjectData.manualProgress;
              processed.projectData.isCompleted = extraProjectData.isCompleted;
              if (extraProjectData.manualObjectives) processed.projectData.objectives = extraProjectData.manualObjectives;
              if (extraProjectData.manualDeliverables) processed.projectData.deliverables = extraProjectData.manualDeliverables;
              if (extraProjectData.manualMilestones) processed.projectData.milestones = extraProjectData.manualMilestones;
            }
        }

        const newNote: Note = {
            id: crypto.randomUUID(),
            title: processed.title,
            content: processed.formattedContent,
            rawContent: rawText,
            category: processed.category,
            tags: Array.from(new Set(tags.filter(t => t.trim().length > 0))), 
            color: type === 'notebook' ? NoteColor.Slate : NoteColor.Yellow, 
            createdAt: Date.now(),
            type: type,
            attachments: attachments || [],
            accessCount: 0,
            folderId: activeFolderId || undefined,
            projectData: processed.projectData,
            userId: storageOwner || undefined,
            isDeleted: false
        };

        setNotes(prev => [newNote, ...prev]);
        await saveNote(newNote, storageOwner);
        setDailyUsage(getDailyUsage());
        return newNote;
    } catch (err: any) {
        console.error("Failed to add note:", err);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUpdateNote = async (id: string, title: string, content: string, category?: string, tags?: string[]) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === id);
      if (!target) return;
      
      const contentTags = extractHashtags(content);
      const titleTags = extractHashtags(title);
      const mergedTags = Array.from(new Set([...(tags || target.tags), ...contentTags, ...titleTags]));

      const updated = { 
        ...target, 
        title, 
        content, 
        ...(category ? { category } : {}), 
        tags: mergedTags 
      };
      
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      await saveNote(updated, storageOwner);
  };

  const handleUpdateProjectData = async (id: string, data: ProjectData) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === id);
      if (!target) return;
      
      const updated = { ...target, projectData: data };
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      if (expandedNote?.id === id) setExpandedNote(updated);
      await saveNote(updated, storageOwner);
  };

  const handleToggleCheckbox = async (noteId: string, checkboxIndex: number) => {
      if (!canEdit) return;
      const targetNote = notes.find(n => n.id === noteId);
      if (!targetNote) return;
      const regex = /\[([ xX]?)\]/g;
      let currentIdx = 0;
      let newContent = targetNote.content;
      let found = false;
      let match;
      while ((match = regex.exec(targetNote.content)) !== null) {
          if (currentIdx === checkboxIndex) {
              const isChecked = match[1].trim().length > 0;
              const newStatus = isChecked ? '[ ]' : '[x]';
              newContent = targetNote.content.substring(0, match.index) + newStatus + targetNote.content.substring(match.index + match[0].length);
              found = true; break;
          }
          currentIdx++;
      }
      if (found && newContent !== targetNote.content) {
          const updatedNote = { ...targetNote, content: newContent };
          setNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
          if (expandedNote?.id === noteId) setExpandedNote(updatedNote);
          await saveNote(updatedNote, storageOwner);
      }
  };

  const handleAddTag = async (noteId: string, tag: string) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === noteId);
      if (!target) return;
      const cleanTag = tag.toLowerCase().replace('#', '').trim();
      if (!cleanTag || target.tags.includes(cleanTag)) return;
      const updated = { ...target, tags: [...target.tags, cleanTag] };
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      await saveNote(updated, storageOwner);
  };

  const handleRemoveTag = async (noteId: string, tag: string) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === noteId);
      if (!target) return;
      const updated = { ...target, tags: target.tags.filter(t => t !== tag) };
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      await saveNote(updated, storageOwner);
  };

  const handleMoveNote = async (noteId: string, folderId: string | undefined) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === noteId);
      if (!target) return;
      const updated = { ...target, folderId };
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      await saveNote(updated, storageOwner);
  };

  const handleDeleteNote = async (id: string) => {
      if (!canEdit) return;
      const updatedNotes = notes.map(n => n.id === id ? { ...n, isDeleted: true, deletedAt: Date.now() } : n);
      setNotes(updatedNotes);
      if (expandedNote?.id === id) setExpandedNote(null);
      const target = updatedNotes.find(n => n.id === id);
      if (target) await saveNote(target, storageOwner);
  };

  const handleRestoreNote = async (id: string) => {
      if (!canEdit) return;
      const updatedNotes = notes.map(n => n.id === id ? { ...n, isDeleted: false, deletedAt: undefined } : n);
      setNotes(updatedNotes);
      const target = updatedNotes.find(n => n.id === id);
      if (target) await saveNote(target, storageOwner);
  };

  const handlePermanentDelete = async (id: string) => {
      if (!canEdit) return;
      setNotes(prev => prev.filter(n => n.id !== id));
      await deleteNote(id, storageOwner);
  };

  const handleEmptyTrash = async () => {
      if (!canEdit) return;
      const trashedIds = notes.filter(n => n.isDeleted).map(n => n.id);
      setNotes(prev => prev.filter(n => !n.isDeleted));
      for (const id of trashedIds) {
          await deleteNote(id, storageOwner);
      }
  };

  const handleCreateFolder = async (name: string) => {
      if (!canEdit) return;
      const newFolder: Folder = { id: crypto.randomUUID(), name, order: folders.length };
      setFolders(prev => [...prev, newFolder]);
      await saveFolder(newFolder, storageOwner);
  };

  const handleDeleteFolder = async (id: string) => {
      if (!canEdit) return;
      setFolders(prev => prev.filter(f => f.id !== id));
      const updatedNotes = notes.map(n => n.folderId === id ? { ...n, folderId: undefined } : n);
      setNotes(updatedNotes);
      await deleteFolder(id, storageOwner);
  };

  const handleToggleProjectCompletion = async (noteId: string) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === noteId);
      if (!target || target.type !== 'project') return;
      const projectData = target.projectData || { deliverables: [], milestones: [], timeline: [], objectives: [] };
      const isFinishing = !projectData.isCompleted;
      const newManualProgress = isFinishing ? 100 : (projectData.manualProgress === 100 ? 99 : projectData.manualProgress || 0);
      const updated = { ...target, projectData: { ...projectData, isCompleted: isFinishing, manualProgress: newManualProgress } };
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      if (expandedNote?.id === noteId) setExpandedNote(updated);
      await saveNote(updated, storageOwner);
  };

  const activeNotes = useMemo(() => notes.filter(n => !n.isDeleted), [notes]);
  const trashedNotes = useMemo(() => notes.filter(n => n.isDeleted), [notes]);

  const filteredNotes = useMemo(() => {
      let result = activeNotes.filter(n => n.type === activeTab);
      if (activeFolderId) result = result.filter(n => n.folderId === activeFolderId);
      if (activeTagFilter) result = result.filter(n => n.tags.includes(activeTagFilter));
      if (activeDateFilter) {
          const filterStr = activeDateFilter.toDateString();
          result = result.filter(n => new Date(n.createdAt).toDateString() === filterStr);
      }
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      }
      return result;
  }, [activeNotes, activeTab, activeFolderId, activeTagFilter, activeDateFilter, searchQuery]);

  const clearFilters = () => {
    setActiveFolderId(null);
    setActiveTagFilter(null);
    setActiveDateFilter(null);
    setSearchQuery('');
  };

  const isFiltered = activeFolderId || activeTagFilter || activeDateFilter || searchQuery;

  if (isAuthChecking) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          </div>
      );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300`}>
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Logo className="w-8 h-8 text-primary-600" />
                    <h1 className="text-xl font-bold hidden sm:block text-slate-800 dark:text-white">WeaveNote</h1>
                </div>
                <div className="flex items-center gap-4 flex-1 justify-end">
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 mr-2">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600' : 'text-slate-400'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></button>
                        <button onClick={() => setViewMode('mindmap')} className={`p-1.5 rounded-md transition-all ${viewMode === 'mindmap' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600' : 'text-slate-400'}`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 9V3"></path><path d="M12 21v-6"></path><path d="M9 12H3"></path><path d="M21 12h-6"></path></svg></button>
                    </div>
                    <button onClick={() => setShowAnalytics(true)} className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-primary-600 dark:text-slate-300">📊 Analytics</button>
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-sm outline-none w-full max-w-xs dark:text-white border border-transparent focus:border-primary-400 transition-all" />
                    <LoginWidget currentUser={currentUser?.username || null} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />
                    <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">⚙️</button>
                </div>
            </div>
        </header>

        <main className="flex-grow max-w-[1600px] mx-auto px-4 py-6 w-full flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-0 order-2 lg:order-2">
                {viewMode === 'grid' && (
                    <NoteInput 
                        onAddNote={handleAddNote} 
                        onTypeChange={handleTabChange}
                        isProcessing={isProcessing} 
                        activeType={activeTab} 
                        readOnly={!canEdit} 
                        isGuest={!currentUser}
                        enableImages={enableImages} 
                    />
                )}

                {activeTab === 'notebook' ? (
                  <NotebookView 
                    notes={activeNotes.filter(n => n.type === 'notebook')} 
                    folders={folders}
                    onAddNote={handleAddNote}
                    onUpdateNote={handleUpdateNote}
                    onEdit={setEditingNote}
                    onDelete={handleDeleteNote}
                    onToggleCheckbox={handleToggleCheckbox}
                  />
                ) : (
                  <>
                    <div className="mb-4 overflow-x-auto no-scrollbar pb-2">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <button 
                                onClick={() => setActiveFolderId(null)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFolderId === null ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                            >
                                All Folders
                            </button>
                            {folders.map(folder => (
                                <button 
                                    key={folder.id}
                                    onClick={() => setActiveFolderId(folder.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFolderId === folder.id ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary-400'}`}
                                >
                                    📂 {folder.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isFiltered && (
                        <div className="mb-4 p-2 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-lg flex items-center justify-between text-xs animate-[fadeIn_0.2s_ease-out]">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-primary-700 dark:text-primary-400 uppercase tracking-tighter">Active Filters:</span>
                                {activeFolderId && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-sm flex items-center gap-1">Folder: {folders.find(f => f.id === activeFolderId)?.name} <button onClick={() => setActiveFolderId(null)}>✕</button></span>}
                                {activeTagFilter && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-sm flex items-center gap-1">Tag: #{activeTagFilter} <button onClick={() => setActiveTagFilter(null)}>✕</button></span>}
                                {activeDateFilter && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-sm flex items-center gap-1">Date: {activeDateFilter.toLocaleDateString()} <button onClick={() => setActiveDateFilter(null)}>✕</button></span>}
                                {searchQuery && <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-sm flex items-center gap-1">Search: "{searchQuery}" <button onClick={() => setSearchQuery('')}>✕</button></span>}
                            </div>
                            <button onClick={clearFilters} className="text-primary-600 hover:text-primary-800 font-bold underline">Clear All</button>
                        </div>
                    )}

                    <div className="mt-4">
                        {viewMode === 'mindmap' ? (
                            <div className="h-[600px] border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                                <MindMap notes={activeNotes} onNoteClick={(id) => { const n = activeNotes.find(n => n.id === id); if (n) { handleExpandNote(n); setViewMode('grid'); } }} />
                            </div>
                        ) : (
                            <>
                                {activeTab === 'deep' ? (
                                    <div className="space-y-3">
                                        {filteredNotes.map(note => (
                                            <div 
                                                key={note.id} 
                                                onClick={() => handleExpandNote(note)}
                                                className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center hover:shadow-lg hover:border-primary-400 dark:hover:border-primary-500 cursor-pointer transition-all animate-[fadeIn_0.2s_ease-out]"
                                            >
                                                <div className="min-w-0 pr-4">
                                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white truncate">{note.title}</h3>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{note.content.substring(0, 180)}</p>
                                                    <div className="flex gap-2 mt-2">
                                                        {note.tags.slice(0, 3).map(tag => (
                                                            <span key={tag} className="text-[10px] text-primary-600 dark:text-primary-400 font-bold">#{tag}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(note.createdAt).toLocaleDateString()}</span>
                                                    <div className="p-2 rounded-full bg-slate-50 dark:bg-slate-700 text-slate-400">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                                        {filteredNotes.map(note => (
                                            <NoteCard 
                                                key={note.id} 
                                                note={note} 
                                                folders={folders} 
                                                onDelete={handleDeleteNote} 
                                                onTagClick={(t) => setActiveTagFilter(t)} 
                                                onChangeColor={async (id, c) => { setNotes(prev => prev.map(n => n.id === id ? { ...n, color: c } : n)); if (storageOwner) await saveNote({ ...notes.find(n => n.id === id)!, color: c }, storageOwner); }}
                                                onEdit={setEditingNote} 
                                                onExpand={handleExpandNote} 
                                                readOnly={!canEdit} 
                                                onViewImage={setViewingImage} 
                                                onToggleCheckbox={handleToggleCheckbox} 
                                                onAddTag={handleAddTag} 
                                                onRemoveTag={handleRemoveTag} 
                                                onMoveToFolder={handleMoveNote} 
                                                onToggleComplete={handleToggleProjectCompletion}
                                            />
                                        ))}
                                    </div>
                                )}
                                
                                {filteredNotes.length === 0 && (
                                    <div className="col-span-full text-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-slate-400 text-lg font-bold">No results found.</p>
                                        <p className="text-slate-400 text-sm mt-1">Try switching categories in the input area above.</p>
                                        {isFiltered && <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-full font-bold shadow-md">Clear all filters</button>}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                  </>
                )}
            </div>

            <Sidebar 
                className="order-1 lg:order-1" 
                notes={activeNotes} 
                folders={folders} 
                onTagClick={(t) => setActiveTagFilter(t === activeTagFilter ? null : t)} 
                activeTag={activeTagFilter} 
                onNoteClick={handleExpandNote} 
                onFolderClick={setActiveFolderId} 
                onCreateFolder={handleCreateFolder} 
                onDateClick={(d) => setActiveDateFilter(d)}
                onDeleteFolder={handleDeleteFolder} 
                onReorderFolders={() => {}} 
                onMoveNote={handleMoveNote} 
                activeFolderId={activeFolderId}
                activeDate={activeDateFilter}
            />

            <RightSidebar 
                className="hidden xl:block order-3 lg:order-3" 
                notes={activeNotes} 
                onNoteClick={handleExpandNote} 
            />
        </main>
        
        <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-3 px-6 text-xs text-slate-400 flex justify-between items-center shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${storageOwner ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    {storageOwner ? <span className="text-slate-600 dark:text-slate-300 font-bold">Cloud Sync Active</span> : <span className="text-slate-500">Guest Mode (Local Only)</span>}
                </div>
                <button 
                  onClick={() => setShowTrash(true)}
                  className="flex items-center gap-1.5 hover:text-red-500 transition-colors font-bold px-3 py-1 rounded-md bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  <span>Trash</span>
                  {trashedNotes.length > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{trashedNotes.length}</span>}
                </button>
            </div>
            <div className="font-medium">Daily AI Usage: {dailyUsage}/800</div>
        </footer>

        <EditNoteModal note={editingNote} isOpen={!!editingNote} onClose={() => setEditingNote(null)} onSave={handleUpdateNote} currentUser={currentUser?.username || 'Guest'} />
        <NoteDetailModal 
            note={expandedNote} 
            isOpen={!!expandedNote} 
            onClose={() => setExpandedNote(null)} 
            currentUser={currentUser?.username || 'Guest'} 
            onViewImage={setViewingImage} 
            onToggleCheckbox={handleToggleCheckbox} 
            onSaveExpanded={(id, content) => handleUpdateNote(id, expandedNote?.title || '', content)} 
            onToggleComplete={handleToggleProjectCompletion}
            onUpdateProjectData={handleUpdateProjectData}
        />
        <TrashModal 
          isOpen={showTrash} 
          onClose={() => setShowTrash(false)} 
          trashedNotes={trashedNotes}
          onRestore={handleRestoreNote}
          onPermanentlyDelete={handlePermanentDelete}
          onEmptyTrash={handleEmptyTrash}
        />
        <ImageViewerModal src={viewingImage} isOpen={!!viewingImage} onClose={() => setViewingImage(null)} />
        <SettingsPanel 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
            currentUser={currentUser} 
            darkMode={darkMode} 
            toggleDarkMode={() => setDarkMode(!darkMode)} 
            theme={theme} 
            setTheme={setTheme} 
            reducedMotion={reducedMotion} 
            toggleReducedMotion={() => setReducedMotion(!reducedMotion)} 
            enableImages={enableImages} 
            toggleEnableImages={() => setEnableImages(!enableImages)} 
            showLinkPreviews={showLinkPreviews} 
            toggleShowLinkPreviews={() => setShowLinkPreviews(!showLinkPreviews)} 
            notes={activeNotes}
        />
        <AnalyticsModal isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} notes={activeNotes} />
    </div>
  );
};

export default App;
