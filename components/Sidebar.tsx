

import React, { useMemo, useState } from 'react';
import { Note, Folder } from '../types';

interface SidebarProps {
  notes: Note[];
  folders: Folder[];
  onTagClick: (tag: string) => void;
  onNoteClick: (note: Note) => void;
  onFolderClick: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorderFolders: (folders: Folder[]) => void;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
  activeTag: string | null;
  activeFolderId: string | null;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    notes, folders, onTagClick, onNoteClick, onFolderClick, 
    onCreateFolder, onDeleteFolder, onReorderFolders, onMoveNote,
    activeTag, activeFolderId, className = "" 
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  
  // Drag State (for folder reordering)
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);

  // 1. Calculate Trending Tags
  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => n.tags.forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency desc
      .slice(0, 15); // Top 15
  }, [notes]);

  // 2. Get Recent Notes
  const recentNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);
  }, [notes]);

  // Helper for consistent color generation
  const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`; 
  };

  const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (isToday) return `Today, ${timeStr}`;
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  const handleFolderSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(newFolderName.trim()) {
          onCreateFolder(newFolderName.trim());
          setNewFolderName('');
          setIsCreatingFolder(false);
      }
  };

  const toggleFolder = (folderId: string) => {
      setExpandedFolders(prev => {
          const next = new Set(prev);
          if (next.has(folderId)) {
              next.delete(folderId);
          } else {
              next.add(folderId);
          }
          return next;
      });
  };

  // Drag Handlers for Folder Reordering
  const handleFolderDragStart = (e: React.DragEvent, index: number) => {
      setDraggedFolderIndex(index);
      e.dataTransfer.setData('type', 'folder');
      e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      // Only reorder if dragging a folder
      if (e.dataTransfer.types.includes('type') && draggedFolderIndex !== null && draggedFolderIndex !== index) {
        const newFolders = [...folders];
        const [removed] = newFolders.splice(draggedFolderIndex, 1);
        newFolders.splice(index, 0, removed);
        
        onReorderFolders(newFolders);
        setDraggedFolderIndex(index);
      }
  };

  // Drag Handlers for Dropping Notes into Folders
  const handleNoteDragOver = (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      // Visual feedback
      if (!dragOverFolderId) setDragOverFolderId(folderId);
  };
  
  const handleNoteDragLeave = () => {
      setDragOverFolderId(null);
  };

  const handleNoteDrop = (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      setDragOverFolderId(null);
      
      // Check if it's a note being dragged
      const noteId = e.dataTransfer.getData('noteId');
      if (noteId) {
          onMoveNote(noteId, folderId);
          // Auto expand the folder dropped into
          setExpandedFolders(prev => new Set(prev).add(folderId));
      }
  };

  return (
    <aside className={`w-full lg:w-80 flex-shrink-0 space-y-6 ${className}`}>
      
      {/* Folders Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
                <span className="text-lg">🗂️</span> Folders
            </h3>
            <button 
                onClick={() => setIsCreatingFolder(true)}
                className="text-xs p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                title="Create Folder"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

          <div className="space-y-1 mb-2">
               <button
                  onClick={() => onFolderClick(null)}
                  onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFolderId('unfiled');
                  }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(null);
                      const noteId = e.dataTransfer.getData('noteId');
                      if (noteId) onMoveNote(noteId, undefined);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeFolderId === null ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${dragOverFolderId === 'unfiled' ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/40' : ''}`}
               >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   All Notes
               </button>
               
               {folders.map((folder, idx) => {
                   const folderNotes = notes.filter(n => n.folderId === folder.id);
                   const isExpanded = expandedFolders.has(folder.id);
                   
                   return (
                   <div key={folder.id} className="group flex flex-col">
                        <div 
                            className={`flex items-center justify-between rounded-lg transition-colors ${activeFolderId === folder.id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'} ${dragOverFolderId === folder.id ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/40' : ''}`}
                            draggable
                            onDragStart={(e) => handleFolderDragStart(e, idx)}
                            onDragOver={(e) => {
                                // We handle both reordering and dropping notes here
                                if (e.dataTransfer.types.includes('type')) {
                                    handleFolderDragOver(e, idx);
                                } else {
                                    handleNoteDragOver(e, folder.id);
                                }
                            }}
                            onDragLeave={handleNoteDragLeave}
                            onDrop={(e) => handleNoteDrop(e, folder.id)}
                        >
                            <div className="flex-grow flex items-center">
                                {/* Toggle Collapse Button */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFolder(folder.id);
                                    }}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                </button>
                                
                                <button
                                    onClick={() => onFolderClick(folder.id)}
                                    className="flex-grow text-left py-2 text-sm font-medium flex items-center gap-2"
                                >
                                    <svg className="text-yellow-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
                                    <span className="truncate">{folder.name}</span>
                                    <span className="ml-auto text-xs opacity-50 px-2">{folderNotes.length}</span>
                                </button>
                            </div>
                            
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(confirm('Delete folder and move notes to Unfiled?')) onDeleteFolder(folder.id);
                                }}
                                className="px-2 py-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"
                                title="Delete Folder"
                            >
                                ×
                            </button>
                        </div>
                        
                        {/* Nested Notes List */}
                        {isExpanded && (
                            <div className="pl-9 pr-2 pb-1 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-700 ml-4 mb-2 mt-1">
                                {folderNotes.length > 0 ? folderNotes.map(note => (
                                    <button
                                        key={note.id}
                                        onClick={() => onNoteClick(note)}
                                        className="w-full text-left text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 py-1 truncate flex items-center gap-2 group/item"
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 bg-${note.color.split('-')[0]}-400`}></span>
                                        <span className="truncate">{note.title}</span>
                                    </button>
                                )) : (
                                    <p className="text-[10px] text-slate-400 italic py-1">Empty folder</p>
                                )}
                            </div>
                        )}
                   </div>
               )})}
          </div>

          {isCreatingFolder && (
              <form onSubmit={handleFolderSubmit} className="mt-2">
                  <input 
                    type="text" 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder Name"
                    className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    autoFocus
                    onBlur={() => !newFolderName && setIsCreatingFolder(false)}
                  />
              </form>
          )}
      </div>

      {/* Trending Tags Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span className="text-lg">🔥</span> Common Tags
        </h3>
        {topTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => (
                <button
                    key={tag}
                    onClick={() => onTagClick(tag === activeTag ? '' : tag)} // Toggle
                    className={`text-xs font-bold px-2 py-1 rounded-md transition-all border flex items-center gap-1.5 ${
                        activeTag === tag 
                            ? 'ring-2 ring-primary-400 ring-offset-1 dark:ring-offset-slate-800' 
                            : 'hover:opacity-80'
                    }`}
                    style={{ 
                        backgroundColor: activeTag === tag ? getHashColor(tag) : 'transparent',
                        color: activeTag === tag ? 'white' : 'inherit',
                        borderColor: activeTag === tag ? 'transparent' : 'rgba(148, 163, 184, 0.4)'
                    }}
                >
                    <span 
                        className={activeTag === tag ? 'text-white' : ''}
                        style={{ color: activeTag === tag ? 'white' : getHashColor(tag) }}
                    >
                        #{tag}
                    </span>
                    <span className={`text-[10px] px-1 rounded-full ${activeTag === tag ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                        {count}
                    </span>
                </button>
            ))}
            </div>
        ) : (
            <p className="text-xs text-slate-400 italic">Add notes to see trending tags.</p>
        )}
      </div>

      {/* Recent Activity Widget */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span className="text-lg">🕒</span> Recently Added
        </h3>
        <div className="space-y-4">
            {recentNotes.map(note => (
                <div 
                    key={note.id} 
                    onClick={() => onNoteClick(note)}
                    className="group cursor-pointer flex gap-3 items-start"
                >
                    <div className={`w-1 self-stretch rounded-full flex-shrink-0 mt-1 mb-1 bg-slate-200 dark:bg-slate-700 group-hover:bg-primary-400 transition-colors`}></div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                            {note.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                            {formatTime(note.createdAt)}
                        </p>
                        {/* Tiny preview of tags */}
                        <div className="flex gap-1 mt-1.5 opacity-60">
                            {note.tags.slice(0, 3).map(t => (
                                <span key={t} className="text-[9px] text-slate-500 dark:text-slate-400">#{t}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            {recentNotes.length === 0 && (
                <p className="text-xs text-slate-400 italic">No notes yet.</p>
            )}
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;