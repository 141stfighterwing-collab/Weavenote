import React, { useMemo, useState } from 'react';
import { Note, NOTE_COLORS, NoteColor, Folder } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  onToggleCheckbox: (noteId: string, lineIndex: number) => void;
  onAddTag: (noteId: string, tag: string) => void;
  onRemoveTag: (noteId: string, tag: string) => void;
  onMoveToFolder?: (noteId: string, folderId: string | undefined) => void;
}

const isImageUrl = (url: string) => {
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u.pathname);
    } catch (e) {
        return false;
    }
};

const getHashColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`; 
  };

const processContent = (text: string) => {
    if (!text) return "";
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

  const processedContent = useMemo(() => processContent(note.content), [note.content]);

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
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Custom Components for Markdown
  const markdownComponents = useMemo(() => ({
      // Custom Link Renderer
      a: (props: any) => {
          if (!props.href) return <a {...props} />;
          if (isImageUrl(props.href)) {
              return (
                <div onClick={(e) => e.stopPropagation()} className="my-3 block select-none group/img-link">
                    <div className="relative rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-800 transition-all hover:shadow-md cursor-zoom-in"
                        onClick={() => onViewImage(props.href)}>
                        <img src={props.href} alt="Link Preview" className="w-full h-32 object-cover bg-slate-200 dark:bg-slate-700" loading="lazy" />
                    </div>
                </div>
              );
          }
          return (
            <a href={props.href} target="_blank" rel="noopener noreferrer" 
               className="text-primary-700 underline decoration-primary-300 dark:text-primary-300 hover:text-primary-900 transition-colors font-medium"
               onClick={(e) => e.stopPropagation()}>
                {props.children}
            </a>
          );
      },
      // Custom List Item Renderer (Optional Strikethrough)
      li: (props: any) => {
        return (
            <li className="flex items-start gap-2 my-1">
                {props.children}
            </li>
        );
      },
      // SIMPLE NATIVE CHECKBOX RENDERER
      input: (props: any) => {
          if (props.type === 'checkbox') {
              return (
                  <input
                    type="checkbox"
                    checked={props.checked || false}
                    onChange={() => {
                        // Rely on parser position (1-based index) -> convert to 0-based
                        if (!readOnly && props.node?.position) {
                            onToggleCheckbox(note.id, props.node.position.start.line - 1);
                        }
                    }}
                    className={`mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={(e) => e.stopPropagation()} // Stop note expansion on click
                  />
              );
          }
          return <input {...props} />;
      }
  }), [note.id, onToggleCheckbox, readOnly, onViewImage]);

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
      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-24 h-8 bg-white/30 backdrop-blur-sm rotate-1 shadow-sm border border-white/20"></div>

      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-2">
        <div className="w-full">
           <div className="flex justify-between items-center opacity-70 mb-1">
             <span className="text-[10px] uppercase tracking-wider font-sans font-bold">{note.category}</span>
             <span className="text-[10px] font-sans font-medium">{dateStr}</span>
           </div>
           <h3 className="text-xl font-bold leading-tight">{note.title}</h3>
        </div>
      </div>

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

      {/* Content Area */}
      <div className="prose prose-sm prose-p:my-1 prose-headings:my-2 prose-ul:my-1 flex-grow opacity-90 font-sans text-sm break-words line-clamp-[12] overflow-hidden list-none">
         <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
         >
             {processedContent}
         </ReactMarkdown>
      </div>
      
      <div className="absolute bottom-16 left-0 w-full h-12 bg-gradient-to-t from-black/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="mt-4 flex flex-wrap gap-1.5 relative z-20">
        {note.tags.map(tag => {
          const color = getHashColor(tag);
          return (
            <div key={tag} className="group/tag relative inline-flex items-center">
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
                {!readOnly && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTag(note.id, tag);
                        }}
                        className="absolute -top-1.5 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[10px] opacity-0 group-hover/tag:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                    >
                        ×
                    </button>
                )}
            </div>
          );
        })}

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
                            setTimeout(() => { if (!newTag.trim()) setIsAddingTag(false); }, 100);
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
                >
                    +
                </button>
            )
        )}
      </div>
      
      {note.folderId && folders.length > 0 && (
          <div className="absolute top-2 left-6 px-2 py-0.5 bg-white/60 dark:bg-black/20 rounded text-[10px] font-bold text-black/50 dark:text-white/70 flex items-center gap-1">
             <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>
             {folders.find(f => f.id === note.folderId)?.name}
          </div>
      )}

      {!readOnly && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button onClick={(e) => { e.stopPropagation(); downloadNoteAsMarkdown(note); }} className="p-1.5 hover:bg-black/10 hover:text-primary-800 rounded-full transition-colors" title="Download as Markdown">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>

            {onMoveToFolder && (
                 <div className="relative group/folder" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 hover:bg-black/10 hover:text-blue-700 rounded-full transition-colors" title="Move to Folder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 shadow-xl rounded-lg p-1 w-32 hidden group-hover/folder:block border border-slate-100 dark:border-slate-700 z-30">
                        <button onClick={() => onMoveToFolder(note.id, undefined)} className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 italic">Remove from Folder</button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        {folders.length > 0 ? folders.map(f => (
                            <button key={f.id} onClick={() => onMoveToFolder(note.id, f.id)} className={`w-full text-left px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded ${note.folderId === f.id ? 'font-bold text-primary-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                {f.name}
                            </button>
                        )) : (<div className="px-2 py-1 text-[10px] text-slate-400">No folders</div>)}
                    </div>
                 </div>
            )}

            <div className="relative group/color" onClick={(e) => e.stopPropagation()}>
                <button className="p-1.5 hover:bg-black/10 rounded-full transition-colors" title="Change Color">
                <div className="w-3 h-3 rounded-full bg-current border border-black/20"></div>
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg p-2 flex gap-1 z-20 hidden group-hover/color:flex border border-slate-100 flex-wrap w-32">
                    {(Object.keys(NOTE_COLORS) as NoteColor[]).map(c => (
                        <button key={c} onClick={() => onChangeColor(note.id, c)} className={`w-4 h-4 rounded-full border border-gray-300 ${NOTE_COLORS[c].split(' ')[0]}`}/>
                    ))}
                </div>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); onEdit(note); }} className="p-1.5 hover:bg-black/10 hover:text-primary-800 rounded-full transition-colors" title="Edit Note">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="p-1.5 hover:bg-red-500/20 hover:text-red-700 rounded-full transition-colors" title="Delete Note">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
        </div>
      )}
    </div>
  );
};

export default NoteCard;