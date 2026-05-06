import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, NoteColor, NoteType, ViewMode, Theme, Folder, User, ProjectData, ProjectMilestone, ProjectItem } from './types';
import { processNoteWithAI, getDailyUsage } from './services/geminiService';
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
import { DashboardView } from './components/DashboardView';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);

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
    const themeClasses = ['theme-default', 'theme-ocean', 'theme-forest', 'theme-sunset', 'theme-rose', 'theme-midnight', 'theme-coffee', 'theme-neon', 'theme-cyberpunk', 'theme-nord', 'theme-dracula', 'theme-lavender', 'theme-earth', 'theme-yellow', 'theme-hyperblue'];
    body.classList.remove(...themeClasses);
    body.classList.add(`theme-${theme}`);
    localStorage.setItem('ideaweaver_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
        setCloudError(null);
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
        } catch (e: any) {
            console.error("Failed to load data", e);
            if (e.code === 'permission-denied') {
                setCloudError("Access Blocked: Your database is likely in 'Locked Mode'. Go to Settings (gear icon) -> Cloud Setup to copy the required rules.");
            }
        } finally {
            setIsLoadingData(false);
        }
    };
    fetchData();
    setDailyUsage(getDailyUsage());
  }, [storageOwner, isAuthChecking]);

  const handleLoginSuccess = (user: User) => setCurrentUser(user);
  const handleLogout = () => { setCurrentUser(null); setNotes([]); setFolders([]); setCloudError(null); };

  const handleTabChange = (type: NoteType) => {
      setActiveTab(type);
      setViewMode('grid');
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
    manualObjectives?: ProjectItem[],
    manualDeliverables?: ProjectItem[],
    manualMilestones?: ProjectMilestone[]
  }, onStepUpdate?: (step: string) => void): Promise<Note | undefined> => {
    if (!canEdit) return;
    if (useAI && !currentUser) useAI = false;

    setIsProcessing(true);
    try {
        let processed;
        let tags = [...forcedTags, ...extractHashtags(rawText), ...extractHashtags(manualTitle)];
        if (type === 'quick') {
            const today = new Date().toISOString().split('T')[0]; 
            if (!tags.includes(today)) tags.push(today);
        }

        let targetFolderId = activeFolderId || undefined;

        if (useAI) {
            const username = currentUser?.username || 'Guest';
            processed = await processNoteWithAI(rawText, [], type, username, currentUser?.uid, onStepUpdate);
            tags = [...processed.tags.map(t => t.toLowerCase().replace('#', '')), ...tags];
            if (manualTitle.trim()) processed.title = manualTitle.trim();
            
            // Automatic Folder Management logic removed to satisfy user request
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
            id: crypto.randomUUID(), title: processed.title, content: processed.formattedContent, rawContent: rawText,
            category: processed.category, tags: Array.from(new Set(tags.filter(t => t.trim().length > 0))), 
            color: type === 'notebook' ? NoteColor.Slate : NoteColor.Yellow, createdAt: Date.now(), type: type,
            attachments: attachments || [], accessCount: 0, folderId: targetFolderId,
            projectData: processed.projectData, userId: storageOwner || undefined, isDeleted: false,
            isSynthesized: useAI
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

  const handleUpdateNote = async (id: string, title: string, content: string, category?: string, tags?: string[], projectData?: ProjectData) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === id);
      if (!target) return;
      const mergedTags = Array.from(new Set([...(tags || target.tags), ...extractHashtags(content), ...extractHashtags(title)]));
      const updated = { 
          ...target, 
          title, 
          content, 
          ...(category ? { category } : {}), 
          tags: mergedTags,
          ...(projectData ? { projectData } : {})
      };
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      if (expandedNote?.id === id) setExpandedNote(updated);
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
      let match;
      while ((match = regex.exec(targetNote.content)) !== null) {
          if (currentIdx === checkboxIndex) {
              const isChecked = match[1].trim().length > 0;
              const newStatus = isChecked ? '[ ]' : '[x]';
              newContent = targetNote.content.substring(0, match.index) + newStatus + targetNote.content.substring(match.index + match[0].length);
              break;
          }
          currentIdx++;
      }
      if (newContent !== targetNote.content) {
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
      for (const id of trashedIds) await deleteNote(id, storageOwner);
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
      setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: undefined } : n));
      await deleteFolder(id, storageOwner);
  };

  const handleUpdateColors = async (id: string, textColor: string | undefined, backgroundColor: string | undefined) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === id);
      if (!target) return;
      const updated = { ...target, textColor, backgroundColor };
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      if (expandedNote?.id === id) setExpandedNote(updated);
      await saveNote(updated, storageOwner);
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
    setActiveFolderId(null); setActiveTagFilter(null); setActiveDateFilter(null); setSearchQuery('');
  };

  const isFiltered = activeFolderId || activeTagFilter || activeDateFilter || searchQuery;

  if (isAuthChecking) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div></div>;
  }

  return (
    <div className={`min-h-screen flex flex-col font-body-md bg-background text-on-surface selection:bg-primary/30 overflow-hidden`}>
        <header className="fixed top-0 w-full z-50 bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center h-16 px-md">
            <div className="flex items-center gap-xl">
                <span className="font-h2 text-h2 font-bold text-primary flex items-center gap-2"><Logo className="w-8 h-8"/>WeaveNote</span>
                <div className="hidden md:flex items-center bg-surface-container rounded-lg px-md py-sm border border-outline-variant w-96 group focus-within:border-primary transition-all">
                    <span className="material-symbols-outlined text-outline mr-sm">search</span>
                    <input type="text" placeholder="Search workspace..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none text-body-md focus:ring-0 w-full placeholder-outline outline-none" />
                </div>
            </div>
            <div className="flex items-center gap-md">
                <button onClick={() => setShowAnalytics(true)} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:opacity-80" title="Analytics">
                    <span className="material-symbols-outlined">analytics</span>
                </button>
                <button onClick={() => setShowSettings(true)} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:opacity-80" title="Settings">
                    <span className="material-symbols-outlined">settings</span>
                </button>
                <LoginWidget currentUser={currentUser?.username || null} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} />
            </div>
        </header>

        {cloudError && (
            <div className="fixed top-16 left-0 right-0 z-40 bg-error-container text-on-error-container px-4 py-3 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined">cloud_off</span>
                    <div>
                        <p className="font-bold text-sm uppercase tracking-widest leading-none">Cloud Permission Required</p>
                        <p className="text-[10px] opacity-90 mt-1">{cloudError}</p>
                    </div>
                </div>
                <button onClick={() => { setShowSettings(true); setCloudError(null); }} className="px-4 py-1.5 bg-on-error-container text-error-container rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Fix Rules Now</button>
            </div>
        )}

        <div className="flex pt-16 h-screen w-full">
            <Sidebar className="fixed left-0 top-16 h-[calc(100vh-64px)] w-sidebar-width bg-surface-container-low border-r border-outline-variant flex flex-col py-md gap-sm overflow-y-auto z-20" notes={activeNotes} folders={folders} onTagClick={(t) => setActiveTagFilter(t === activeTagFilter ? null : t)} activeTag={activeTagFilter} onNoteClick={handleExpandNote} onFolderClick={setActiveFolderId} onCreateFolder={handleCreateFolder} onDateClick={(d) => setActiveDateFilter(d)} onDeleteFolder={handleDeleteFolder} onReorderFolders={() => {}} onMoveNote={handleMoveNote} activeFolderId={activeFolderId} activeDate={activeDateFilter} />
            
            <main className="ml-sidebar-width flex-1 flex flex-col bg-surface-dim relative mr-80 z-10 h-[calc(100vh-64px)] overflow-hidden">
                <nav className="flex items-center gap-md px-lg bg-surface-container/30 border-b border-outline-variant overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0">
                    <button onClick={() => handleTabChange('quick')} className={`font-medium py-4 px-2 transition-colors ${activeTab === 'quick' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>QUICK</button>
                    <button onClick={() => handleTabChange('notebook')} className={`font-medium py-4 px-2 transition-colors ${activeTab === 'notebook' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>NOTEBOOK</button>
                    <button onClick={() => handleTabChange('deep')} className={`font-medium py-4 px-2 transition-colors ${activeTab === 'deep' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>DEEP</button>
                    <button onClick={() => handleTabChange('code')} className={`font-medium py-4 px-2 transition-colors ${activeTab === 'code' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>CODE</button>
                    <button onClick={() => handleTabChange('project')} className={`font-medium py-4 px-2 transition-colors ${activeTab === 'project' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>PROJECT</button>
                    <button onClick={() => setViewMode('dashboard')} className={`font-medium py-4 px-2 transition-colors ${viewMode === 'dashboard' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>DASHBOARD</button>
                    <button onClick={() => setViewMode('mindmap')} className={`font-medium py-4 px-2 transition-colors ${viewMode === 'mindmap' ? 'text-primary font-bold border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary'}`}>MIND MAP</button>
                </nav>

                <div className="flex-1 p-lg overflow-y-auto">
                    {viewMode === 'dashboard' ? (
                        <DashboardView notes={activeNotes} />
                    ) : (
                        <>
                            {viewMode === 'grid' && (
                                <NoteInput 
                                    onAddNote={handleAddNote} onTypeChange={handleTabChange} isProcessing={isProcessing} 
                                    activeType={activeTab} readOnly={!canEdit} isGuest={!currentUser}
                                />
                            )}

                            {activeTab === 'notebook' ? (
                              <NotebookView notes={activeNotes.filter(n => n.type === 'notebook')} folders={folders} onAddNote={handleAddNote} onUpdateNote={handleUpdateNote} onEdit={setEditingNote} onDelete={handleDeleteNote} onToggleCheckbox={handleToggleCheckbox} />
                            ) : (
                              <>
                                <div className="mb-4 overflow-x-auto no-scrollbar pb-2">
                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                        <button onClick={() => setActiveFolderId(null)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFolderId === null ? 'bg-primary-container text-on-primary-container border-primary shadow-md' : 'bg-surface text-on-surface border-outline-variant hover:border-primary'}`}>All Folders</button>
                                        {folders.map(folder => (<button key={folder.id} onClick={() => setActiveFolderId(folder.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${activeFolderId === folder.id ? 'bg-primary-container text-on-primary-container border-primary shadow-md' : 'bg-surface text-on-surface border-outline-variant hover:border-primary'}`}>📂 {folder.name}</button>))}
                                    </div>
                                </div>

                                {isFiltered && (
                                    <div className="mb-4 p-2 bg-surface-container-high border border-outline-variant rounded-lg flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-on-surface"><span className="font-bold uppercase tracking-tighter">Active Filters:</span>{activeFolderId && <span className="px-2 py-0.5 bg-surface rounded border border-outline shadow-sm flex items-center gap-1">Folder: {folders.find(f => f.id === activeFolderId)?.name} <button onClick={() => setActiveFolderId(null)}>✕</button></span>}{activeTagFilter && <span className="px-2 py-0.5 bg-surface rounded border border-outline shadow-sm flex items-center gap-1">Tag: #{activeTagFilter} <button onClick={() => setActiveTagFilter(null)}>✕</button></span>}{activeDateFilter && <span className="px-2 py-0.5 bg-surface rounded border border-outline shadow-sm flex items-center gap-1">Date: {activeDateFilter.toLocaleDateString()} <button onClick={() => setActiveDateFilter(null)}>✕</button></span>}{searchQuery && <span className="px-2 py-0.5 bg-surface rounded border border-outline shadow-sm flex items-center gap-1">Search: "{searchQuery}" <button onClick={() => setSearchQuery('')}>✕</button></span>}</div>
                                        <button onClick={clearFilters} className="text-primary hover:text-primary-fixed font-bold underline">Clear All</button>
                                    </div>
                                )}

                                <div className="mt-4">
                                    {viewMode === 'mindmap' ? (<div className="h-[600px] border border-outline-variant rounded-xl overflow-hidden bg-surface-container/50"><MindMap notes={activeNotes} onNoteClick={(id) => { const n = activeNotes.find(n => n.id === id); if (n) { handleExpandNote(n); setViewMode('grid'); } }} /></div>) : (
                                        <>
                                            {activeTab === 'deep' ? (<div className="space-y-3">{filteredNotes.map(note => (<div key={note.id} onClick={() => handleExpandNote(note)} className="bg-surface-container-low p-5 rounded-xl border border-outline flex justify-between items-center hover:shadow-lg hover:border-primary cursor-pointer transition-all animate-[fadeIn_0.2s_ease-out]"><div className="min-w-0 pr-4"><div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-lg text-on-surface truncate">{note.title}</h3>{note.isSynthesized && <span className="px-1.5 py-0.5 bg-primary-container text-on-primary-container text-[8px] font-black uppercase rounded">Synthesized</span>}</div><p className="text-sm text-outline line-clamp-1 mt-1">{note.content.substring(0, 180)}</p><div className="flex gap-2 mt-2">{note.tags.slice(0, 3).map(tag => (<span key={tag} className="text-[10px] text-primary font-bold">#{tag}</span>))}</div></div><div className="flex flex-col items-end gap-2 shrink-0"><span className="text-[10px] font-bold text-outline-variant uppercase tracking-widest">{new Date(note.createdAt).toLocaleDateString()}</span><div className="p-2 rounded-full bg-surface-container text-outline"><span className="material-symbols-outlined text-[18px]">keyboard_arrow_right</span></div></div></div>))}</div>) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">{filteredNotes.map(note => (
                                                  <NoteCard 
                                                    key={note.id} 
                                                    note={note} 
                                                    folders={folders} 
                                                    onDelete={handleDeleteNote} 
                                                    onTagClick={(t) => setActiveTagFilter(t)} 
                                                    onChangeColor={async (id, c) => { 
                                                      setNotes(prev => prev.map(n => n.id === id ? { ...n, color: c } : n)); 
                                                      if (storageOwner) await saveNote({ ...notes.find(n => n.id === id)!, color: c }, storageOwner); 
                                                    }} 
                                                    onUpdateColors={handleUpdateColors}
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
                                                ))}</div>
                                            )}
                                            {filteredNotes.length === 0 && (<div className="col-span-full text-center py-20 bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant"><p className="text-outline text-lg font-bold">No results found.</p><p className="text-outline-variant text-sm mt-1">Try switching categories or clearing filters.</p>{isFiltered && <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-primary text-on-primary rounded-full font-bold shadow-md">Clear all filters</button>}</div>)}
                                        </>
                                    )}
                                </div>
                              </>
                            )}
                        </>
                    )}
                </div>
            </main>

            <RightSidebar className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 bg-surface-container-low border-l border-outline-variant p-md flex flex-col gap-lg overflow-y-auto z-20" notes={activeNotes} onNoteClick={handleExpandNote} />
        </div>

        <EditNoteModal note={editingNote} isOpen={!!editingNote} onClose={() => setEditingNote(null)} onSave={handleUpdateNote} currentUser={currentUser?.username || 'Guest'} />
        <NoteDetailModal 
          note={expandedNote} 
          folders={folders}
          isOpen={!!expandedNote} 
          onClose={() => setExpandedNote(null)} 
          currentUser={currentUser?.username || 'Guest'} 
          onViewImage={setViewingImage} 
          onToggleCheckbox={handleToggleCheckbox} 
          onSaveExpanded={(id, content) => handleUpdateNote(id, expandedNote?.title || '', content)} 
          onToggleComplete={handleToggleProjectCompletion} 
          onUpdateProjectData={handleUpdateProjectData} 
        />
        <TrashModal isOpen={showTrash} onClose={() => setShowTrash(false)} trashedNotes={trashedNotes} onRestore={handleRestoreNote} onPermanentlyDelete={handlePermanentDelete} onEmptyTrash={handleEmptyTrash} />
        <ImageViewerModal src={viewingImage} isOpen={!!viewingImage} onClose={() => setViewingImage(null)} />
        <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} currentUser={currentUser} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} theme={theme} setTheme={setTheme} notes={activeNotes} />
        <AnalyticsModal isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} notes={activeNotes} />
    </div>
  );
};

export default App;