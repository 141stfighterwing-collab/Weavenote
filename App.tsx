

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Note, NoteColor, NoteType, ViewMode, Theme, Folder } from './types';
import { processNoteWithAI, getDailyUsage, DAILY_REQUEST_LIMIT } from './services/geminiService';
import { loadNotes, saveNotes, performAutoBackup, getLastBackupTime, exportDataToFile, parseImportFile, loadFolders, saveFolders } from './services/storageService';
import { User, login as authLogin, isAdmin, getSessionTimeout } from './services/authService';
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
  
  // Initialize from Storage based on current user (starts null/guest)
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Mind Map Filters
  const [mmTypeFilter, setMmTypeFilter] = useState<NoteType | 'all'>('all');
  const [mmStartDate, setMmStartDate] = useState('');
  const [mmEndDate, setMmEndDate] = useState('');
  
  // Personalization State
  const [darkMode, setDarkMode] = useState(() => {
    const val = localStorage.getItem('ideaweaver_darkmode');
    return val === null ? true : val === 'true';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('ideaweaver_theme') as Theme) || 'default';
  });

  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem('ideaweaver_reducedmotion') === 'true';
  });
  const [enableImages, setEnableImages] = useState(() => {
    return localStorage.getItem('ideaweaver_enableimages') === 'true';
  });
  const [showLinkPreviews, setShowLinkPreviews] = useState(() => {
    const val = localStorage.getItem('ideaweaver_linkpreviews');
    return val === null ? true : val === 'true';
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inactivity Timer Refs
  const inactivityTimeoutRef = useRef<number | null>(null);
  const sessionLengthRef = useRef<number>(30); // minutes

  // Handle Logout Logic
  const handleLogout = () => {
    setCurrentUser(null);
    setShowSettings(false);
    if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
    }
  };

  // Inactivity Logic
  useEffect(() => {
      if (!currentUser) return;

      // Update session length from storage on login
      sessionLengthRef.current = getSessionTimeout();

      const resetTimer = () => {
          if (inactivityTimeoutRef.current) {
              clearTimeout(inactivityTimeoutRef.current);
          }
          const ms = sessionLengthRef.current * 60 * 1000;
          inactivityTimeoutRef.current = window.setTimeout(() => {
              alert("Session Expired due to inactivity.");
              handleLogout();
          }, ms);
      };

      const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      const handleActivity = () => resetTimer();

      // Attach listeners
      events.forEach(event => window.addEventListener(event, handleActivity));
      
      // Start timer
      resetTimer();

      return () => {
          events.forEach(event => window.removeEventListener(event, handleActivity));
          if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
      };
  }, [currentUser]);

  // Apply Theme Effects
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ideaweaver_darkmode', darkMode.toString());
  }, [darkMode]);

  // Apply Color Theme
  useEffect(() => {
    document.body.className = ''; // Reset classes
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('ideaweaver_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (reducedMotion) {
        document.documentElement.classList.add('motion-reduce');
    } else {
        document.documentElement.classList.remove('motion-reduce');
    }
    localStorage.setItem('ideaweaver_reducedmotion', reducedMotion.toString());
  }, [reducedMotion]);

  useEffect(() => {
      localStorage.setItem('ideaweaver_enableimages', enableImages.toString());
  }, [enableImages]);

  useEffect(() => {
      localStorage.setItem('ideaweaver_linkpreviews', showLinkPreviews.toString());
  }, [showLinkPreviews]);

  // Determine permissions
  const canEdit = useMemo(() => {
    if (!currentUser) return true; // Guests can edit their session notes
    return currentUser.permission === 'edit';
  }, [currentUser]);

  // Determine Storage Key Owner
  const storageOwner = useMemo(() => {
    if (!currentUser) return null;
    return currentUser.parentUser || currentUser.username;
  }, [currentUser]);

  // Load user-specific data whenever storageOwner changes
  useEffect(() => {
    const savedNotes = loadNotes(storageOwner);
    const savedFolders = loadFolders(storageOwner);

    if (!savedNotes && !storageOwner) {
        // First time load - Start fresh, no fake data.
        setNotes([]); 
    } else {
        const migratedNotes = (savedNotes || []).map(n => ({
            ...n,
            accessCount: n.accessCount || 0
        }));
        setNotes(migratedNotes);
    }
    
    setFolders(savedFolders);

    setIsLoaded(true);
    setDailyUsage(getDailyUsage());
    setLastBackup(getLastBackupTime());
  }, [storageOwner]);

  // PERSISTENCE EFFECT
  useEffect(() => {
    if (!isLoaded) return;
    if (canEdit) {
        saveNotes(notes, storageOwner);
        saveFolders(folders, storageOwner);
        if (currentUser && performAutoBackup(notes, storageOwner)) {
            setLastBackup(Date.now());
        }
    }
  }, [notes, folders, currentUser, storageOwner, isLoaded, canEdit]);

  // Derive unique categories for AI prompt context
  const existingCategories = useMemo(() => {
    return Array.from(new Set(notes.map(n => n.category)));
  }, [notes]);

  const handleLogin = (username: string) => {
    const allUsers = JSON.parse(localStorage.getItem('ideaweaver_users') || '[]');
    let userObj = allUsers.find((u: any) => u.username === username);
    
    // Check hardcoded admin if not in local users
    if (!userObj && username === 'admin') {
         userObj = { username: 'admin', passwordHash: '...', permission: 'edit' };
    }

    if (userObj) {
        setCurrentUser(userObj);
    }
  };

  const incrementAccessCount = (noteId: string) => {
      setNotes(prev => prev.map(n => {
          if (n.id === noteId) {
              return { ...n, accessCount: (n.accessCount || 0) + 1 };
          }
          return n;
      }));
  };

  const extractTagsFromContent = (content: string): string[] => {
      const matches = content.match(/#[\w-]+/g);
      return matches ? matches.map(t => t.substring(1).toLowerCase()) : [];
  };

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
        const actingUser = currentUser?.username || 'Guest';
        processed = await processNoteWithAI(rawText, existingCategories, type, actingUser);
        tags = [...processed.tags.map(t => t.toLowerCase().replace('#', '')), ...tags];
      } else {
        // Manual creation without AI
        const manualTags = extractTagsFromContent(rawText);
        processed = {
            title: rawText.split('\n')[0].substring(0, 40) + (rawText.length > 40 ? '...' : '') || 'New Note',
            formattedContent: rawText,
            category: 'Manual',
            tags: [...manualTags, ...tags]
        };
      }

      const newNote: Note = {
        id: crypto.randomUUID(),
        title: processed.title,
        content: processed.formattedContent,
        rawContent: rawText,
        category: processed.category,
        tags: Array.from(new Set(processed.tags)), // Unique tags
        color: getRandomColor(type),
        createdAt: Date.now(),
        type: type,
        attachments: attachments || [],
        accessCount: 0,
        folderId: activeFolderId || undefined // Auto-assign to active folder
      };

      setNotes(prev => [newNote, ...prev]);
      setActiveTab(type);
      setDailyUsage(getDailyUsage()); // Update usage counter (even if no AI call, checking ensures sync)
    } catch (err: any) {
      console.error(err);
      if (err.message.includes("Safeguard") || err.message.includes("API Key")) {
         setError(err.message);
      } else {
        const fallbackNote: Note = {
             id: crypto.randomUUID(),
             title: type === 'quick' ? 'Quick Note (Manual)' : 'Research Note (Manual)',
             content: rawText,
             rawContent: rawText,
             category: 'Uncategorized',
             tags: ['manual', ...forcedTags],
             color: getRandomColor(type),
             createdAt: Date.now(),
             type: type,
             attachments: attachments || [],
             accessCount: 0,
             folderId: activeFolderId || undefined
        };
        setNotes(prev => [fallbackNote, ...prev]);
        if (forcedTags.length === 0) {
            setError("Failed to process note using AI. Saved as manual note.");
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteNote = (id: string) => {
    if (!canEdit) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    if (expandedNote?.id === id) setExpandedNote(null);
  };

  const handleChangeColor = (id: string, color: NoteColor) => {
    if (!canEdit) return;
    const updatedNotes = notes.map(n => n.id === id ? { ...n, color } : n);
    setNotes(updatedNotes);
    if (expandedNote?.id === id) {
        setExpandedNote(updatedNotes.find(n => n.id === id) || null);
    }
  };

  const handleEditNote = (note: Note) => {
    if (!canEdit) return;
    setEditingNote(note);
    incrementAccessCount(note.id); // Counting edit as access
    setExpandedNote(null);
  };

  const handleUpdateNote = (id: string, title: string, content: string) => {
    if (!canEdit) return;
    setNotes(prev => prev.map(n => {
        if (n.id === id) {
             const contentTags = extractTagsFromContent(content);
             const mergedTags = Array.from(new Set([...n.tags, ...contentTags]));
             return { ...n, title, content, tags: mergedTags };
        }
        return n;
    }));
  };

  const handleAddTag = (id: string, tag: string) => {
    if (!canEdit) return;
    const cleanTag = tag.replace(/^#/, '').trim().toLowerCase();
    if (!cleanTag) return;
    setNotes(prev => prev.map(n => {
        if (n.id === id && !n.tags.includes(cleanTag)) {
            return { ...n, tags: [...n.tags, cleanTag] };
        }
        return n;
    }));
  };

  const handleRemoveTag = (id: string, tag: string) => {
    if (!canEdit) return;
    setNotes(prev => prev.map(n => {
        if (n.id === id) {
            return { ...n, tags: n.tags.filter(t => t !== tag) };
        }
        return n;
    }));
  };

  const handleExpandNote = (note: Note) => {
      setExpandedNote(note);
      incrementAccessCount(note.id);
  };

  const handleToggleCheckbox = (noteId: string, _lineIndex: number, checked: boolean) => {
      if (!canEdit) return;

      setNotes(prev => prev.map(note => {
          if (note.id !== noteId) return note;

          let newContent = note.content;
          if (checked) {
              newContent = newContent.replace(/\[ \]/, '[x]');
          } else {
               newContent = newContent.replace(/\[x\]/, '[ ]');
          }

          if (newContent === note.content) return note;

          if (expandedNote?.id === noteId) {
             setExpandedNote({ ...note, content: newContent });
          }

          return { ...note, content: newContent };
      }));
  };

  // Folder Actions
  const handleCreateFolder = (name: string) => {
      if (!canEdit) return;
      const newFolder: Folder = {
          id: crypto.randomUUID(),
          name,
          order: folders.length
      };
      setFolders(prev => [...prev, newFolder]);
  };

  const handleDeleteFolder = (id: string) => {
      if (!canEdit) return;
      // Also reset folderId for notes in this folder
      setNotes(prev => prev.map(n => n.folderId === id ? { ...n, folderId: undefined } : n));
      setFolders(prev => prev.filter(f => f.id !== id));
      if (activeFolderId === id) setActiveFolderId(null);
  };

  const handleReorderFolders = (reordered: Folder[]) => {
      if (!canEdit) return;
      setFolders(reordered);
  };

  const handleMoveNoteToFolder = (noteId: string, folderId: string | undefined) => {
      if (!canEdit) return;
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folderId } : n));
  };

  const handleExport = () => {
    exportDataToFile(notes);
  };

  const handleImportClick = () => {
    if (!canEdit) {
        alert("You do not have permission to import notes.");
        return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            const importedNotes = parseImportFile(content);
            setNotes(prev => {
                const existingIds = new Set(prev.map(n => n.id));
                const newNotes = importedNotes.filter(n => !existingIds.has(n.id));
                return [...newNotes, ...prev];
            });
            alert(`Successfully imported ${importedNotes.length} notes!`);
        } catch (err) {
            alert("Failed to import file. Invalid format.");
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const getRandomColor = (type: NoteType): NoteColor => {
    let palette;
    switch(type) {
        case 'quick':
            palette = [NoteColor.Yellow, NoteColor.Orange, NoteColor.Pink, NoteColor.Rose];
            break;
        case 'deep':
            palette = [NoteColor.Blue, NoteColor.Purple, NoteColor.Sky, NoteColor.Indigo];
            break;
        case 'project':
            palette = [NoteColor.Green, NoteColor.Teal, NoteColor.Lime, NoteColor.Fuchsia];
            break;
        case 'contact':
            palette = [NoteColor.Orange, NoteColor.Red, NoteColor.Yellow, NoteColor.Rose];
            break;
        case 'document':
            palette = [NoteColor.Slate, NoteColor.Cyan, NoteColor.Violet, NoteColor.Blue];
            break;
        default:
             palette = [NoteColor.Yellow];
    }
    return palette[Math.floor(Math.random() * palette.length)];
  };

  const filteredNotes = useMemo(() => {
    let result = notes.filter(n => n.type === activeTab);
    
    // Folder Logic
    if (activeFolderId) {
        result = result.filter(n => n.folderId === activeFolderId);
    }

    if (activeTagFilter) {
      result = result.filter(n => n.tags.includes(activeTagFilter));
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(n => 
            n.title.toLowerCase().includes(q) || 
            n.content.toLowerCase().includes(q) ||
            n.tags.some(t => t.toLowerCase().includes(q))
        );
    }
    
    return result;
  }, [notes, activeTab, activeTagFilter, activeFolderId, searchQuery]);

  // Mind Map Specific Filtering
  const mindMapNotes = useMemo(() => {
    let result = notes;
    
    // Existing global search
    if (activeTagFilter) {
        result = result.filter(n => n.tags.includes(activeTagFilter));
    }
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(n => 
            n.title.toLowerCase().includes(q) || 
            n.content.toLowerCase().includes(q) ||
            n.tags.some(t => t.toLowerCase().includes(q))
        );
    }

    // New Mind Map specific filters
    if (viewMode === 'mindmap') {
        if (mmTypeFilter !== 'all') {
            result = result.filter(n => n.type === mmTypeFilter);
        }
        if (mmStartDate) {
            const start = new Date(mmStartDate).getTime();
            result = result.filter(n => n.createdAt >= start);
        }
        if (mmEndDate) {
            // End of the day
            const end = new Date(mmEndDate).setHours(23, 59, 59, 999);
            result = result.filter(n => n.createdAt <= end);
        }
    }

    return result;
  }, [notes, activeTagFilter, searchQuery, viewMode, mmTypeFilter, mmStartDate, mmEndDate]);

  const handleSidebarTagClick = (tag: string) => {
      if (!tag || tag === activeTagFilter) {
          setActiveTagFilter(null);
      } else {
          setActiveTagFilter(tag);
      }
  };

  const getEmptyStateMessage = () => {
      if (searchQuery) return 'No matching notes found.';
      if (activeFolderId) return 'This folder is empty.';
      switch(activeTab) {
          case 'quick': return 'No quick notes yet.';
          case 'deep': return 'No research notes yet.';
          case 'project': return 'No active projects yet.';
          case 'contact': return 'No contacts added.';
          case 'document': return 'No documents saved.';
          default: return 'No notes found.';
      }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      {/* Navbar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="flex-shrink-0 transition-transform hover:rotate-12 duration-500">
                <Logo className="w-10 h-10 text-primary-600 dark:text-primary-400" />
             </div>
             <div className="hidden sm:block">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">WeaveNote</h1>
                {!currentUser && <span className="text-[10px] text-slate-400 font-medium">Guest Mode</span>}
                {currentUser && (
                    <span className="text-[10px] text-slate-400 font-medium">
                        {canEdit ? 'Editor Access' : 'Read Only Access'}
                    </span>
                )}
             </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6 flex-1 justify-end">
             {/* Search Bar */}
             <div className="relative flex-1 max-w-md min-w-[120px]">
                <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white placeholder-slate-400 transition-all"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <span className="sr-only">Clear</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
             </div>
             
             {/* Analytics Button */}
             <button
                onClick={() => setShowAnalytics(true)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors flex-shrink-0"
                title="Analytics Dashboard"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
             </button>

             {/* Settings Button */}
             <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors flex-shrink-0"
                title="Settings"
             >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
             </button>

             {/* Filter Badge */}
             {(activeTagFilter || activeFolderId) && (
                <div className="flex gap-2">
                    {activeFolderId && (
                         <button
                            onClick={() => setActiveFolderId(null)}
                            className="flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition hidden lg:flex flex-shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                            {folders.find(f => f.id === activeFolderId)?.name || 'Folder'}
                            <span className="text-slate-400 ml-1">×</span>
                        </button>
                    )}
                    {activeTagFilter && (
                        <button
                            onClick={() => setActiveTagFilter(null)}
                            className="flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200 rounded-full text-xs font-semibold hover:bg-primary-200 dark:hover:bg-primary-800 transition hidden lg:flex flex-shrink-0"
                        >
                            #{activeTagFilter}
                            <span className="text-primary-400 ml-1">×</span>
                        </button>
                    )}
                </div>
             )}

             {/* View Toggles */}
             <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600 flex-shrink-0">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                </button>
                <button
                    onClick={() => setViewMode('mindmap')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'mindmap' ? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                    {/* Updated Spider Web / Mind Map Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 9V3"></path>
                        <path d="M12 21v-6"></path>
                        <path d="M9 12H3"></path>
                        <path d="M21 12h-6"></path>
                        <path d="M19.8 19.8l-4.2-4.2"></path>
                        <path d="M8.4 8.4L4.2 4.2"></path>
                        <path d="M15.6 8.4l4.2-4.2"></path>
                        <path d="M8.4 15.6l-4.2 4.2"></path>
                    </svg>
                </button>
             </div>
             
             {/* Divider */}
             <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

             {/* Login Widget */}
             <LoginWidget 
                currentUser={currentUser ? currentUser.username : null} 
                onLogin={handleLogin} 
                onLogout={handleLogout} 
             />
          </div>
        </div>
      </header>

      {/* Tab Navigation (Only show in Grid Mode) */}
      {viewMode === 'grid' && (
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-colors duration-300">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <nav className="-mb-px flex space-x-6 sm:space-x-8 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab('quick')}
                      className={`${
                        activeTab === 'quick'
                          ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    >
                      <span className="text-lg">⚡</span> Quick Notes
                    </button>
                    <button
                      onClick={() => setActiveTab('deep')}
                      className={`${
                        activeTab === 'deep'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    >
                       <span className="text-lg">🧠</span> Deep Study
                    </button>
                    <button
                      onClick={() => setActiveTab('project')}
                      className={`${
                        activeTab === 'project'
                          ? 'border-green-500 text-green-600 dark:text-green-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    >
                       <span className="text-lg">🚀</span> Projects
                    </button>
                    <button
                      onClick={() => setActiveTab('contact')}
                      className={`${
                        activeTab === 'contact'
                          ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    >
                       <span className="text-lg">👤</span> Contacts
                    </button>
                    <button
                      onClick={() => setActiveTab('document')}
                      className={`${
                        activeTab === 'document'
                          ? 'border-slate-500 text-slate-600 dark:text-slate-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                    >
                       <span className="text-lg">📄</span> Documents
                    </button>
                  </nav>
              </div>
          </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Input + Grid/MindMap */}
        <div className="flex-1 min-w-0">
            {viewMode === 'grid' && (
                <div className="max-w-3xl mx-auto w-full">
                    <NoteInput 
                        onAddNote={handleAddNote} 
                        isProcessing={isProcessing} 
                        activeType={activeTab}
                        readOnly={!canEdit}
                        enableImages={enableImages}
                    />
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2 shadow-sm">
                            <span className="text-lg">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-grow mt-4">
                {viewMode === 'mindmap' ? (
                    <div className="h-[calc(100vh-16rem)] w-full flex flex-col">
                        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm items-center animate-[fadeIn_0.2s_ease-out]">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Filter:</span>
                                <select 
                                    value={mmTypeFilter}
                                    onChange={(e) => setMmTypeFilter(e.target.value as any)}
                                    className="px-2 py-1 text-sm border rounded bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500"
                                >
                                    <option value="all">All Types</option>
                                    <option value="quick">Quick Notes</option>
                                    <option value="deep">Deep Study</option>
                                    <option value="project">Projects</option>
                                    <option value="contact">Contacts</option>
                                    <option value="document">Documents</option>
                                </select>
                            </div>
                            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block"></div>
                            <div className="flex items-center gap-2">
                                 <span className="text-xs font-medium text-slate-500 dark:text-slate-400">From:</span>
                                 <input 
                                    type="date" 
                                    value={mmStartDate}
                                    onChange={(e) => setMmStartDate(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500"
                                 />
                                 <span className="text-xs font-medium text-slate-500 dark:text-slate-400">To:</span>
                                 <input 
                                    type="date" 
                                    value={mmEndDate}
                                    onChange={(e) => setMmEndDate(e.target.value)}
                                    className="px-2 py-1 text-sm border rounded bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 outline-none focus:ring-1 focus:ring-primary-500"
                                 />
                            </div>
                            {(mmTypeFilter !== 'all' || mmStartDate || mmEndDate) && (
                                 <button 
                                    onClick={() => { setMmTypeFilter('all'); setMmStartDate(''); setMmEndDate(''); }}
                                    className="ml-auto text-xs text-red-500 hover:underline font-medium"
                                 >
                                    Clear Filters
                                 </button>
                            )}
                        </div>
                        <div className="flex-grow border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden relative">
                            {mindMapNotes.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                    <div className="text-center p-4 bg-white/80 dark:bg-slate-800/80 rounded-lg backdrop-blur-sm shadow-sm border border-slate-200 dark:border-slate-700">
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">No notes match filters</p>
                                    </div>
                                </div>
                            )}
                            <MindMap 
                                notes={mindMapNotes} 
                                onNoteClick={(id) => {
                                    const note = notes.find(n => n.id === id);
                                    if (note) {
                                        setActiveTab(note.type);
                                        setViewMode('grid');
                                        setExpandedNote(note);
                                        incrementAccessCount(note.id);
                                    }
                                }} 
                            />
                        </div>
                    </div>
                ) : (
                    <>
                    {/* Contacts specific view toggle */}
                    {activeTab === 'contact' && filteredNotes.length > 0 && (
                        <div className="flex justify-end mb-4">
                            <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 flex gap-1">
                                <button 
                                    onClick={() => setContactViewMode('grid')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${contactViewMode === 'grid' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                                >
                                    Grid
                                </button>
                                <button 
                                    onClick={() => setContactViewMode('table')}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${contactViewMode === 'table' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
                                >
                                    Table
                                </button>
                            </div>
                        </div>
                    )}

                    {filteredNotes.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                                <div className="mx-auto h-24 w-24 text-slate-300 dark:text-slate-600 mb-4">
                                    {searchQuery ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    ) : activeTab === 'quick' 
                                        ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        : activeTab === 'project'
                                            ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            : activeTab === 'contact'
                                                ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                : activeTab === 'document'
                                                    ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    : <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                    }
                                </div>
                            <p className="text-xl font-medium text-slate-400 dark:text-slate-500">
                                {getEmptyStateMessage()}
                            </p>
                            {canEdit && !searchQuery && <p className="text-slate-400 dark:text-slate-500">Add one above!</p>}
                        </div>
                    ) : (
                        activeTab === 'contact' && contactViewMode === 'table' ? (
                            <ContactsTable 
                                contacts={filteredNotes} 
                                onEdit={handleEditNote} 
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
                                        onTagClick={(tag) => handleSidebarTagClick(tag)}
                                        onChangeColor={handleChangeColor}
                                        onEdit={handleEditNote}
                                        onExpand={handleExpandNote}
                                        readOnly={!canEdit}
                                        showLinkPreviews={showLinkPreviews}
                                        onViewImage={(src) => setViewingImage(src)}
                                        onToggleCheckbox={handleToggleCheckbox}
                                        onAddTag={handleAddTag}
                                        onRemoveTag={handleRemoveTag}
                                        onMoveToFolder={handleMoveNoteToFolder}
                                    />
                                ))}
                            </div>
                        )
                    )}
                    </>
                )}
            </div>
        </div>

        {/* Right Sidebar - Hidden on small, shown on lg */}
        <Sidebar 
            notes={notes}
            folders={folders}
            onTagClick={handleSidebarTagClick}
            activeTag={activeTagFilter}
            onNoteClick={(note) => {
                setActiveTab(note.type);
                setViewMode('grid');
                setExpandedNote(note);
                incrementAccessCount(note.id);
            }}
            onFolderClick={setActiveFolderId}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onReorderFolders={handleReorderFolders}
            activeFolderId={activeFolderId}
            onMoveNote={handleMoveNoteToFolder}
        />

      </main>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-3 px-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 dark:text-slate-400 gap-3">
           
           <div className="flex items-center gap-4">
               <span>WeaveNote AI</span>
               <span className="hidden md:inline text-slate-300 dark:text-slate-600">|</span>
               {lastBackup ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Backed up: {new Date(lastBackup).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
               ) : (
                   <span className="text-slate-400 dark:text-slate-500">
                     {currentUser ? "Waiting for backup..." : "Guest session (not backed up)"}
                   </span>
               )}
               <button 
                onClick={handleExport}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 underline decoration-primary-200 dark:decoration-primary-900 underline-offset-2 ml-2"
               >
                   Export
               </button>
               {canEdit && (
                <button 
                    onClick={handleImportClick}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline decoration-slate-300 dark:decoration-slate-600 underline-offset-2"
                >
                    Import
                </button>
               )}
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".json" 
                  className="hidden" 
               />
           </div>

           <div className="flex items-center gap-2" title="Daily AI Usage Safeguard">
              <span>Usage Today:</span>
              <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                 <div 
                    className={`h-full rounded-full transition-all duration-500 ${dailyUsage > DAILY_REQUEST_LIMIT * 0.8 ? 'bg-red-400' : 'bg-green-400'}`}
                    style={{ width: `${Math.min((dailyUsage / DAILY_REQUEST_LIMIT) * 100, 100)}%` }}
                 ></div>
              </div>
              <span className="font-mono">{dailyUsage}/{DAILY_REQUEST_LIMIT}</span>
           </div>
        </div>
      </footer>

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
        showLinkPreviews={showLinkPreviews}
        onViewImage={(src) => setViewingImage(src)}
        onToggleCheckbox={handleToggleCheckbox}
        onSaveExpanded={(id, content) => {
            handleUpdateNote(id, expandedNote!.title, content);
            setExpandedNote(prev => prev ? {...prev, content} : null);
        }}
        currentUser={currentUser?.username || 'Guest'}
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
        notes={notes}
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />
    </div>
  );
};

export default App;
