

export type NoteType = 'quick' | 'deep' | 'project' | 'contact' | 'document';

export type Theme = 'default' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'midnight' | 'coffee' | 'neon';

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export interface ProjectMilestone {
  date: string; // ISO string YYYY-MM-DD
  label: string;
  status: 'pending' | 'completed';
}

export interface ProjectPhase {
  name: string;
  startDate: string;
  endDate: string;
}

export interface WorkflowNode {
  id: string;
  label: string;
  rule?: string; // Workflow rule or criteria for this step
  status: 'pending' | 'in_progress' | 'done';
}

export interface WorkflowEdge {
  source: string;
  target: string;
}

export interface ProjectData {
  deliverables: string[];
  milestones: ProjectMilestone[];
  timeline: ProjectPhase[];
  workflow?: {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
  };
  estimatedDuration?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Formatted markdown content
  rawContent: string; // Original input
  category: string;
  tags: string[];
  color: NoteColor;
  createdAt: number;
  type: NoteType;
  attachments?: string[]; // Array of Base64 image strings
  accessCount?: number; // Number of times accessed/viewed
  folderId?: string; // ID of the folder this note belongs to
  projectData?: ProjectData; // Optional specific data for Project notes
}

export enum NoteColor {
  Yellow = 'yellow',
  Blue = 'blue',
  Green = 'green',
  Pink = 'pink',
  Purple = 'purple',
  Orange = 'orange',
  Teal = 'teal',
  Rose = 'rose',
  Indigo = 'indigo',
  Lime = 'lime',
  Sky = 'sky',
  Fuchsia = 'fuchsia',
  Slate = 'slate',
  Red = 'red',
  Cyan = 'cyan',
  Violet = 'violet'
}

export const NOTE_COLORS: Record<NoteColor, string> = {
  [NoteColor.Yellow]: 'bg-yellow-100 border-yellow-200 text-yellow-900',
  [NoteColor.Blue]: 'bg-blue-100 border-blue-200 text-blue-900',
  [NoteColor.Green]: 'bg-green-100 border-green-200 text-green-900',
  [NoteColor.Pink]: 'bg-pink-100 border-pink-200 text-pink-900',
  [NoteColor.Purple]: 'bg-purple-100 border-purple-200 text-purple-900',
  [NoteColor.Orange]: 'bg-orange-100 border-orange-200 text-orange-900',
  [NoteColor.Teal]: 'bg-teal-100 border-teal-200 text-teal-900',
  [NoteColor.Rose]: 'bg-rose-100 border-rose-200 text-rose-900',
  [NoteColor.Indigo]: 'bg-indigo-100 border-indigo-200 text-indigo-900',
  [NoteColor.Lime]: 'bg-lime-100 border-lime-200 text-lime-900',
  [NoteColor.Sky]: 'bg-sky-100 border-sky-200 text-sky-900',
  [NoteColor.Fuchsia]: 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-900',
  [NoteColor.Slate]: 'bg-slate-100 border-slate-200 text-slate-900',
  [NoteColor.Red]: 'bg-red-100 border-red-200 text-red-900',
  [NoteColor.Cyan]: 'bg-cyan-100 border-cyan-200 text-cyan-900',
  [NoteColor.Violet]: 'bg-violet-100 border-violet-200 text-violet-900',
};

export type ViewMode = 'grid' | 'mindmap';

export interface ProcessedNoteData {
  title: string;
  formattedContent: string;
  category: string;
  tags: string[];
  projectData?: ProjectData;
}

export interface AILogEntry {
    id: string;
    timestamp: number;
    username: string;
    action: string;
    details: string;
}