import React, { useMemo, useState, useCallback } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder } from '../types';
import ReactMarkdown from 'react-markdown';
import { downloadNoteAsMarkdown } from '../services/storageService';

interface NoteCardProps {
  note: Note;
  folders?: Folder[];
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onChangeColor: (id: string, color: NoteColor) => void;
  onEdit: (note: Note) => void;
  onExpand: (note: Note) => void;
  readOnly?: boolean;
  showLinkPreviews?: boolean;
  onViewImage: (src: string) => void;
  onToggleCheckbox: (noteId: string, lineIndex: number, checked: boolean) => void;
  onAddTag: (noteId: string, tag: string) => void;
  onRemoveTag: (noteId: string, tag: string) => void;
  onMoveToFolder?: (noteId: string, folderId: string | undefined) => void;
}

// Helper to detect image URLs
const isImageUrl = (url: string) => {
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u.pathname);
    } catch (e) {
        return false;
    }
};

// Helper for Color Coded Hashtags
const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate color from hash
    const hue = Math.abs(hash % 360);
    // Use HSL to span the full spectrum.
    // Saturation 70% and Lightness 45% ensures the white text is readable.
    return `hsl(${hue}, 70%, 45%)`; 
  };

// Helper to auto-link raw URLs that aren't already in markdown link format
const processContent = (text: string) => {
    if (!text) return "";
    // Regex matches: (Start or whitespace) (http/s URL) (End or whitespace)
    // It avoids matching URLs that are likely part of an existing markdown structure like ](http...
    return text.replace(/([^\S]|^)(https?:\/\/[^\s]+)(?=[^\S]|$)/g, '$1[$2]($2)');
};

const NoteCard: React.FC<NoteCardProps> = ({ 
    note, folders = [], onDelete, onTagClick, onChangeColor, onEdit, onExpand, 
    readOnly = false, showLinkPreviews = false, onViewImage, onToggleCheckbox,
    onAddTag, onRemoveTag, onMoveToFolder
}) => {
  const colorClass = NOTE_COLORS[note.color];
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Auto-process content to make raw links clickable/previewable
  const processedContent = useMemo(() => processContent(note.content), [note.content]);

  // Format timestamp for display
  const dateStr = useMemo(() => {
    const d = new Date(note.createdAt);
    const now = new Date();
    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if(isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }, [note.createdAt]);

  const handleTagSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (newTag.trim()) {
          onAddTag(note.id, newTag.trim());
          setNewTag('');
          setIsAddingTag(false);
      }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (readOnly) return;
    // Set data for drag operation
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Custom Renderer for List Items to handle Checkboxes
  const LiRenderer = useCallback((props: any) => {
      const { children, node } = props;
      const childrenArray = React.Children.toArray(children);
      const firstChild = childrenArray[0];

      // Check if it's a string starting with [ ] or [x]
      if (typeof firstChild === 'string' && (firstChild.startsWith('[ ]') || firstChild.startsWith('[x]'))) {
          const isChecked = firstChild.startsWith('[x]');
          const textContent = firstChild.substring(3).trim(); // Remove the checkbox markup
          
          return (
              <li className="flex items-start gap-2 my-1 -ml-4 list-none">
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    onChange={(e) => {
                        e.stopPropagation(); 
                        if (node && node.position) {
                            // node.position.start.line is 1-based index in the original source
                            const lineIndex = node.position.start.line - 1;
                            onToggleCheckbox(note.id, lineIndex, !isChecked); 
                        }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer flex-shrink-0"
                    disabled={readOnly}
                  />
                  <span className={`${isChecked ? 'line-through text-slate-400 dark:text-slate-500' : ''} flex-grow`}>
                      {textContent} {childrenArray.slice(1)}
                  </span>
              </li>
          );
      }
      return <li>{children}</li>;
  }, [note.id, readOnly, onToggleCheckbox]);

  // Custom Link Renderer for "Previews"
  const LinkRenderer = useCallback((props: any) => {
      if (!props.href) return <a {...props} />;

      // 1. Always render Image Previews if URL is an image
      if (isImageUrl(props.href)) {
          return (
            <div 
                onClick={(e) => e.stopPropagation()} 
                className="my-3 block select-none group/img-link"
            >
                <div 
                    className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-800 transition-all hover:shadow-md cursor-zoom-in"
                    onClick={() => onViewImage(props.href)}
                >
                    <img 
                        src={props.href} 
                        alt="Link Preview" 
                        className="w-full h-32 object-cover bg-slate-200 dark:bg-slate-700" 
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5 pointer-events-none rounded-lg"></div>
                    
                    {/* Overlay with Link Text/Icon */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 flex items-end justify-between">
                            <span className="text-[10px] text-white font-medium truncate max-w-[80%]">
                                {props.children || 'Image Link'}
                            </span>
                            <span className="text-white opacity-0 group-hover/img-link:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                            </span>
                    </div>
                </div>
            </div>
          );
      }

      // 2. Standard Web Link Preview (Only if enabled)
      if (showLinkPreviews) {
          try {
              const url = new URL(props.href);
              return (
                  <a 
                    href={props.href} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block my-3 no-underline group/link select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                      <div className="bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/10 rounded-lg overflow-hidden hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-sm transition-all flex h-14">
                          {/* Icon Section */}
                          <div className="w-12 bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 border-r border-black/5 dark:border-white/5">
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                          </div>
                          
                          {/* Text Content */}
                          <div className="px-3 py-2 flex-grow min-w-0 flex flex-col justify-center">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                  {props.children || url.hostname}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                  <span className="opacity-75">{url.hostname}</span>
                                  <span className="opacity-50">•</span>
                                  <span className="uppercase tracking-wider opacity-70 text-[9px]">External Resource</span>
                              </div>
                          </div>

                          {/* Arrow Icon */}
                          <div className="pr-3 flex items-center justify-center text-slate-400 opacity-0 group-hover/link:opacity-100 transition-opacity">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </div>
                      </div>
                  </a>
              );
          } catch(e) {
              // Fallback if URL parsing fails
          }
      }
      
      // 3. Fallback Link
      return (
        <a 
          href={props.href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium"
          onClick={(e) => e.stopPropagation()}
        >
            {props.children}
        </a>
      );
  }, [showLinkPreviews, onViewImage]);

  const markdownComponents = useMemo(() => ({
      a: LinkRenderer,
      li: LiRenderer
  }), [LinkRenderer, LiRenderer]);

  return (
    <div
      draggable={!readOnly}
      onDragStart={handleDragStart}
      onClick={() => onExpand(note)}
      className={`relative group p-6 rounded-sm shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:-rotate-1 ${colorClass} min-h-[250px] flex flex-col font-hand dark:brightness-90 cursor-pointer ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
         boxShadow: "2px 4px 12px rgba(0,0,0,0.1), 0 0 40px rgba(0,0,0,0.02) inset"
      }}
    >
      {/* Tape effect on top */}
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm rotate-1 shadow-sm border border-white/20"></div>

      {/* Header */}
      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-2">
        <div className="w-full">
           <div className="flex justify-between items-center opacity-70 mb-1">
             <span className="text-[10px] uppercase tracking-wider font-sans font-bold">{note.category}</span>
             <span className="text-[10px] font-sans font-medium">{dateStr}</span>
           </div>
           <h3 className="text-xl font-bold leading-tight">{note.title}</h3>
        </div>
      </div>

      {/* Images (Attachments) */}
      {note.attachments && note.attachments.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
              {note.attachments.map((src, idx) => (
                  <img 
                    key={idx} 
                    src={src} 
                    alt="attachment" 
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewImage(src);
                    }}
                    className="w-full h-24 object-cover rounded border border-black/10 hover:opacity-90 transition-opacity cursor-zoom-in bg-white/50" 
                  />
              ))}
          </div>
      )}

      {/* Content */}
      <div className="prose prose-sm prose-p:my-1 prose-headings:my-2 prose-ul:my-1 flex-grow opacity-90 font-sans text-sm break-words line-clamp-[12] overflow-hidden">
         <ReactMarkdown 
            components={markdownComponents}
         >
             {processedContent}
         </ReactMarkdown>
      </div>
      
      {/* Fade out effect for long content */}
      <div className="absolute bottom-16 left-0 w-full h-12 bg-gradient-to-t from-black/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

      {/* Tags - Rainbow Spectrum */}
      <div className="mt-4 flex flex-wrap gap-1.5 relative z-20">
        {note.tags.map(tag => {
          const color = getHashColor(tag);
          return (
            <div
                key={tag}
                className="group/tag relative inline-flex items-center"
            >
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTagClick(tag);
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-full transition-transform hover:scale-105 font-sans font-bold text-white shadow-sm flex items-center gap-1"
                    style={{ backgroundColor: color }}
                >
                    #{tag}
                </button>
                {/* Remove Tag Button */}
                {!readOnly && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTag(note.id, tag);
                        }}
                        className="absolute -top-1.5 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] opacity-0 group-hover/tag:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title="Remove tag"
                    >
                        ×
                    </button>
                )}
            </div>
          );
        })}

        {/* Add Tag Button */}
        {!readOnly && (
            isAddingTag ? (
                <form onSubmit={handleTagSubmit} className="inline-flex">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Tag..."
                        className="text-[10px] w-16 px-1.5 py-0.5 rounded-full border border-black/20 bg-white/80 focus:outline-none focus:ring-1 focus:ring-black/30 text-black placeholder-black/50"
                        autoFocus
                        onBlur={() => {
                            // Small delay to allow submit if clicking enter/button
                            setTimeout(() => {
                                if (!newTag.trim()) setIsAddingTag(false);
                            }, 100);
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />
                </form>
            ) : (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsAddingTag(true);
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-black/10 bg-black/5 text-black/50 hover:bg-black/10 transition-colors font-bold"
                    title="Add Tag"
                >
                    +
                </button>
            )
        )}
      </div>
      
      {/* Folder Name (if active) */}
      {note.folderId && folders.length > 0 && (
          <div className="absolute top-2 left-6 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded text-[10px] font-bold text-black/50 dark:text-white/70 flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
             {folders.find(f => f.id === note.folderId)?.name}
          </div>
      )}

      {/* Actions (Hidden by default, shown on hover, hidden if readOnly) */}
      {!readOnly && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/* Download MD */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    downloadNoteAsMarkdown(note);
                }}
                className="p-1.5 hover:bg-black/10 hover:text-primary-800 rounded-full transition-colors"
                title="Download as Markdown"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>

            {/* Move to Folder Button */}
            {onMoveToFolder && (
                 <div className="relative group/folder" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 hover:bg-black/10 hover:text-blue-700 rounded-full transition-colors" title="Move to Folder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                    {/* Folder List Popover */}
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 shadow-xl rounded-lg p-1 w-32 hidden group-hover/folder:block border border-slate-100 dark:border-slate-700 z-30">
                        <button 
                            onClick={() => onMoveToFolder(note.id, undefined)}
                            className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 italic"
                        >
                            Remove from Folder
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        {folders.length > 0 ? folders.map(f => (
                            <button
                                key={f.id}
                                onClick={() => onMoveToFolder(note.id, f.id)}
                                className={`w-full text-left px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded ${note.folderId === f.id ? 'font-bold text-primary-600' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                                {f.name}
                            </button>
                        )) : (
                            <div className="px-2 py-1 text-[10px] text-slate-400">No folders</div>
                        )}
                    </div>
                 </div>
            )}

            <div className="relative group/color" onClick={(e) => e.stopPropagation()}>
                <button className="p-1.5 hover:bg-black/10 rounded-full transition-colors" title="Change Color">
                <div className="w-3 h-3 rounded-full bg-current border border-black/20"></div>
                </button>
                {/* Color Picker Popover */}
                <div className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg p-2 flex gap-1 z-20 hidden group-hover/color:flex border border-slate-100 flex-wrap w-32">
                    {(Object.keys(NOTE_COLORS) as NoteColor[]).map(c => (
                        <button
                            key={c}
                            onClick={() => onChangeColor(note.id, c)}
                            className={`w-4 h-4 rounded-full border border-gray-300 ${NOTE_COLORS[c].split(' ')[0]}`}
                        />
                    ))}
                </div>
            </div>
            
            <button
            onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
            }}
            className="p-1.5 hover:bg-black/10 hover:text-primary-800 rounded-full transition-colors"
            title="Edit Note"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>

            <button
            onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
            }}
            className="p-1.5 hover:bg-red-500/20 hover:text-red-700 rounded-full transition-colors"
            title="Delete Note"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
      )}
    </div>
  );
};

export default NoteCard;