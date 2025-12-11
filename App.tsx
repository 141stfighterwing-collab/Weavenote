
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, NoteColor, NoteType, ViewMode, Theme, Folder, User } from './types';
import { processNoteWithAI, getDailyUsage } from './services/geminiService';
import { 
    loadNotes, saveNote, deleteNote, 
    loadFolders, saveFolder, deleteFolder, 
    exportDataToFile, parseImportFile, syncAllNotes 
} from './services/storageService';
import { getSessionTimeout } from './services/authService';
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
import ContactsTable from './components/ContactsTable';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [contactViewMode, setContactViewMode] = useState<'grid' | 'table'>('grid');
  const [activeTab, setActiveTab] = useState<NoteType>('quick');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [expandedNote, setExpandedNote] = useState<Note | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Mind Map Filters
  const [mmTypeFilter, setMmTypeFilter] = useState<NoteType | 'all'>('all');
  const [mmStartDate, setMmStartDate] = useState('');
  const [mmEndDate, setMmEndDate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Preferences
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ideaweaver_darkmode') !== 'false');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ideaweaver_theme') as Theme) || 'default');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('ideaweaver_reducedmotion') === 'true');
  const [enableImages, setEnableImages] = useState(() => localStorage.getItem('ideaweaver_enableimages') === 'true');
  const [showLinkPreviews, setShowLinkPreviews] = useState(() => localStorage.getItem('ideaweaver_linkpreviews') === 'true');

  const canEdit = currentUser ? currentUser.permission === 'edit' : true; 
  // Determine who owns the data: The logged-in Firebase UID or null (Guest)
  const storageOwner = currentUser ? currentUser.uid : null;

  // ASYNC DATA LOAD
  useEffect(() => {
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const fetchedNotes = await loadNotes(storageOwner);
            const fetchedFolders = await loadFolders(storageOwner);
            setNotes(fetchedNotes);
            setFolders(fetchedFolders);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setIsLoadingData(false);
        }
    };
    fetchData();
    setDailyUsage(getDailyUsage());
  }, [storageOwner]);

  // Handle Login
  const handleLoginSuccess = (user: User) => {
      setCurrentUser(user);
      // Data load triggered by useEffect on storageOwner change
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setNotes([]); 
      setFolders([]);
  };

  // Add Note
  const handleAddNote = async (
    rawText: string, 
    type: NoteType, 
    attachments: string[] = [], 
    forcedTags: string[] = [],
    useAI: boolean = true
  ) => {
    if (!canEdit) return;
    setIsProcessing(true);
    setError(null);

    try {
        let processed;
        let tags = [...forcedTags];

        if (useAI) {
            const username = currentUser?.username || 'Guest';
            processed = await processNoteWithAI(rawText, [], type, username);
            tags = [...processed.tags.map(t => t.toLowerCase().replace('#', '')), ...tags];
        } else {
            processed = {
                title: rawText.split('\n')[0].substring(0, 40) || 'New Note',
                formattedContent: rawText,
                category: 'Manual',
                tags: [...tags]
            };
        }

        const newNote: Note = {
            id: crypto.randomUUID(),
            title: processed.title,
            content: processed.formattedContent,
            rawContent: rawText,
            category: processed.category,
            tags: Array.from(new Set(processed.tags)),
            color: NoteColor.Yellow, 
            createdAt: Date.now(),
            type: type,
            attachments: attachments || [],
            accessCount: 0,
            folderId: activeFolderId || undefined,
            userId: storageOwner || undefined // CRITICAL: Assign ownership
        };

        // Optimistic Update
        setNotes(prev => [newNote, ...prev]);
        setActiveTab(type);
        
        // Async Save to Database
        await saveNote(newNote, storageOwner);
        setDailyUsage(getDailyUsage());

    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsProcessing(false);
    }
  };

  // Update Note
  const handleUpdateNote = async (id: string, title: string, content: string) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === id);
      if (!target) return;

      const updated = { ...target, title, content };
      
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      await saveNote(updated, storageOwner);
  };

  // Move Note to Folder
  const handleMoveNote = async (noteId: string, folderId: string | undefined) => {
      if (!canEdit) return;
      const target = notes.find(n => n.id === noteId);
      if (!target) return;

      const updated = { ...target, folderId };
      // Optimistic update
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      
      // Async Save
      await saveNote(updated, storageOwner);
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
      if (!canEdit) return;
      setNotes(prev => prev.filter(n => n.id !== id));
      if (expandedNote?.id === id) setExpandedNote(null);
      await deleteNote(id, storageOwner);
  };

  const handleCreateFolder = async (name: string) => {
      if (!canEdit) return;
      const newFolder: Folder = {
          id: crypto.randomUUID(),
          name,
          order: folders.length
      };
      setFolders(prev => [...prev, newFolder]);
      await saveFolder(newFolder, storageOwner);
  };

  const handleDeleteFolder = async (id: string) => {
      if (!canEdit) return;
      setFolders(prev => prev.filter(f => f.id !== id));
      const updatedNotes = notes.map(n => n.folderId === id ? { ...n, folderId: undefined } : n);
      setNotes(updatedNotes);
      // We must check if any notes were updated and save them
      const notesToUpdate = notes.filter(n => n.folderId === id);
      for (const note of notesToUpdate) {
          await saveNote({ ...note, folderId: undefined }, storageOwner);
      }
      await deleteFolder(id, storageOwner);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const content = ev.target?.result as string;
              const imported = parseImportFile(content);
              const existingIds = new Set(notes.map(n => n.id));
              const newNotes = imported.filter(n => !existingIds.has(n.id));
              
              setNotes(prev => [...newNotes, ...prev]);
              // If logged in, sync imports to cloud
              if (storageOwner && newNotes.length > 0) {
                  await syncAllNotes(newNotes, storageOwner);
              }
              alert(`Imported ${newNotes.length} notes.`);
          } catch(err) {
              alert("Import failed.");
          }
      };
      reader.readAsText(file);
  };

  const handleSidebarTagClick = (tag: string) => setActiveTagFilter(tag === activeTagFilter ? null : tag);

  // Filters
  const filteredNotes = useMemo(() => {
      let result = notes.filter(n => n.type === activeTab);
      if (activeFolderId) result = result.filter(n => n.folderId === activeFolderId);
      if (activeTagFilter) result = result.filter(n => n.tags.includes(activeTagFilter));
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
      }
      return result;
  }, [notes, activeTab, activeFolderId, activeTagFilter, searchQuery]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
        {/* Style injection for themes */}
        <style>{`body { background-color: var(--color-primary-50); } .dark body { background-color: #0f172a; }`}</style>
        
        {/* HEADER */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Logo className="w-8 h-8 text-primary-600" />
                    <h1 className="text-xl font-bold hidden sm:block">WeaveNote</h1>
                </div>
                
                <div className="flex items-center gap-4 flex-1 justify-end">
                    <button onClick={() => setShowAnalytics(true)} className="flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-primary-600 dark:text-slate-300">
                        <span>📊</span> Analytics
                    </button>
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-sm outline-none focus:ring-2 focus:ring-primary-500 w-full max-w-xs"
                    />
                    <LoginWidget 
                        currentUser={currentUser?.username || null} 
                        onLoginSuccess={handleLoginSuccess}
                        onLogout={handleLogout}
                    />
                    <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                        ⚙️
                    </button>
                </div>
            </div>
        </header>

        {/* TAB NAV */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto">
                {(['quick', 'deep', 'project', 'contact', 'document'] as NoteType[]).map(type => (
                    <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${activeTab === type ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>

        {/* MAIN */}
        <main className="flex-grow max-w-7xl mx-auto px-4 py-6 w-full flex flex-col lg:flex-row gap-6">
            
            {/* LEFT CONTENT */}
            <div className="flex-1 min-w-0">
                {viewMode === 'grid' && (
                    <>
                        <NoteInput 
                            onAddNote={handleAddNote}
                            isProcessing={isProcessing}
                            activeType={activeTab}
                            readOnly={!canEdit}
                            enableImages={enableImages}
                        />
                        {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</div>}
                    </>
                )}

                {isLoadingData ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        <span className="ml-3 text-slate-500">Loading your notes...</span>
                    </div>
                ) : (
                    <div className="mt-4">
                        {viewMode === 'mindmap' ? (
                            <div className="h-[600px] border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
                                <MindMap 
                                    notes={notes} 
                                    onNoteClick={(id) => {
                                        const n = notes.find(n => n.id === id);
                                        if (n) {
                                            setExpandedNote(n);
                                            setViewMode('grid');
                                        }
                                    }} 
                                />
                            </div>
                        ) : (
                            activeTab === 'contact' && contactViewMode === 'table' ? (
                                <ContactsTable 
                                    contacts={filteredNotes} 
                                    onEdit={setEditingNote} 
                                    onDelete={handleDeleteNote}
                                />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                    {filteredNotes.map(note => (
                                        <NoteCard 
                                            key={note.id}
                                            note={note}
                                            folders={folders}
                                            onDelete={handleDeleteNote}
                                            onTagClick={handleSidebarTagClick}
                                            onChangeColor={async (id, c) => {
                                                const n = notes.find(n => n.id === id);
                                                if (n) await saveNote({ ...n, color: c }, storageOwner);
                                                setNotes(prev => prev.map(n => n.id === id ? { ...n, color: c } : n));
                                            }}
                                            onEdit={setEditingNote}
                                            onExpand={setExpandedNote}
                                            readOnly={!canEdit}
                                            showLinkPreviews={showLinkPreviews}
                                            onViewImage={setViewingImage}
                                            onToggleCheckbox={() => {}} 
                                            onAddTag={() => {}}
                                            onRemoveTag={() => {}}
                                            onMoveToFolder={handleMoveNote}
                                        />
                                    ))}
                                    {filteredNotes.length === 0 && (
                                        <p className="col-span-full text-center text-slate-400 py-10">No notes found.</p>
                                    )}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* SIDEBAR */}
            <Sidebar 
                notes={notes}
                folders={folders}
                onTagClick={handleSidebarTagClick}
                activeTag={activeTagFilter}
                onNoteClick={setExpandedNote}
                onFolderClick={setActiveFolderId}
                onCreateFolder={handleCreateFolder}
                onDeleteFolder={handleDeleteFolder}
                onReorderFolders={() => {}}
                onMoveNote={handleMoveNote}
                activeFolderId={activeFolderId}
            />
        </main>
        
        {/* Footer Sync Status */}
        <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-2 px-4 text-xs text-slate-400 flex justify-between">
            <div>
                {storageOwner ? (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                        Cloud Sync Active
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-slate-500">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        Guest Mode (Local Only)
                    </span>
                )}
            </div>
            <div>Daily AI Usage: {dailyUsage}/800</div>
        </footer>

        {/* MODALS */}
        <EditNoteModal 
            note={editingNote} 
            isOpen={!!editingNote} 
            onClose={() => setEditingNote(null)} 
            onSave={handleUpdateNote} 
        />
        <NoteDetailModal 
            note={expandedNote}
            isOpen={!!expandedNote}
            onClose={() => setExpandedNote(null)}
            currentUser={currentUser?.username || 'Guest'}
            onViewImage={setViewingImage}
            onToggleCheckbox={() => {}}
        />
        <ImageViewerModal 
            src={viewingImage} 
            isOpen={!!viewingImage} 
            onClose={() => setViewingImage(null)} 
        />
        <SettingsPanel 
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            currentUser={currentUser?.username || null}
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
        />
        <AnalyticsModal
            isOpen={showAnalytics}
            onClose={() => setShowAnalytics(false)}
            notes={notes}
        />
        
        {/* Hidden Import Input */}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
    </div>
  );
};

export default App;
