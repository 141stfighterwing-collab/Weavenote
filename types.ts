export type NoteType = 'quick' | 'deep' | 'code' | 'project' | 'contact' | 'document';

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
  rule?: string; 
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
  manualProgress?: number; // 0 to 100
  isCompleted?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string; 
  rawContent: string; 
  category: string;
  tags: string[];
  color: NoteColor;
  createdAt: number;
  type: NoteType;
  attachments?: string[]; 
  accessCount?: number; 
  folderId?: string; 
  projectData?: ProjectData;
  userId?: string; // Owner ID for Firebase
  isDeleted?: boolean;
  deletedAt?: number;
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

export interface ErrorLogEntry {
    id: string;
    timestamp: number;
    context: string;
    message: string;
    stack?: string;
}

export type Permission = 'read' | 'edit';
export type UserStatus = 'active' | 'suspended' | 'pending';

export interface User {
  uid: string; // Firebase Auth ID
  username: string;
  email: string;
  permission: Permission;
  status: UserStatus;
  role?: 'admin' | 'user'; 
  ipAddress?: string;
  country?: string;
  countryFlag?: string;
  lastLogin?: number;
}

export interface UserUsageStats {
  noteCount: number;
  topCategory: string;
  persona: string;
  personaEmoji: string;
}