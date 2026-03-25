/**
 * Database Adapter for Weavenote
 * 
 * This service provides a unified interface for data persistence,
 * supporting both Firebase (legacy) and the new PostgreSQL API.
 * 
 * Configuration is controlled via VITE_API_URL environment variable:
 * - If set: Uses PostgreSQL API backend
 * - If not set: Falls back to Firebase
 */

import { Note, Folder, UserUsageStats } from '../types';

// Database mode detection
const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '';
const USE_API = !!(API_URL && API_URL.length > 0);

// Token management
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
    authToken = token;
    if (token) {
        localStorage.setItem('weavenote_auth_token', token);
    } else {
        localStorage.removeItem('weavenote_auth_token');
    }
};

export const getAuthToken = (): string | null => {
    if (authToken) return authToken;
    authToken = localStorage.getItem('weavenote_auth_token');
    return authToken;
};

// API request helper
const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> => {
    const token = getAuthToken();
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    let response: Response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });
    } catch (error) {
        throw new Error('Backend API unreachable');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
};

// =============================================================================
// Notes API
// =============================================================================

export const loadNotesFromAPI = async (userId: string | null): Promise<Note[]> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }
    
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    
    return apiRequest<Note[]>(`/notes?${params.toString()}`);
};

export const saveNoteToAPI = async (note: Note, userId: string | null): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest(`/notes`, {
        method: 'POST',
        body: JSON.stringify(note),
    });
};

export const updateNoteToAPI = async (noteId: string, note: Partial<Note>, userId: string | null): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest(`/notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify(note),
    });
};

export const deleteNoteFromAPI = async (noteId: string, userId: string | null, permanent = false): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest(`/notes/${noteId}?permanent=${permanent}`, {
        method: 'DELETE',
    });
};

export const restoreNoteInAPI = async (noteId: string, userId: string | null): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest(`/notes/${noteId}/restore`, {
        method: 'POST',
    });
};

// =============================================================================
// Folders API
// =============================================================================

export const loadFoldersFromAPI = async (userId: string | null): Promise<Folder[]> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    return apiRequest<Folder[]>('/folders');
};

export const saveFolderToAPI = async (folder: Folder, userId: string | null): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest('/folders', {
        method: 'POST',
        body: JSON.stringify(folder),
    });
};

export const deleteFolderFromAPI = async (folderId: string, userId: string | null): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    await apiRequest(`/folders/${folderId}`, {
        method: 'DELETE',
    });
};

// =============================================================================
// Auth API
// =============================================================================

export interface AuthResponse {
    user: {
        id: string;
        uid: string;
        email: string;
        username: string;
        role: string;
        permission: string;
    };
    token: string | null;
}

export const loginWithAPI = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

    if (response.token) {
        setAuthToken(response.token);
    }

    return response;
};

export const registerWithAPI = async (email: string, username: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
    });

    if (response.token) {
        setAuthToken(response.token);
    }

    return response;
};

export const createGuestSession = async (): Promise<AuthResponse> => {
    return apiRequest<AuthResponse>('/auth/guest', {
        method: 'POST',
        body: JSON.stringify({}),
    });
};

export const logoutFromAPI = async (): Promise<void> => {
    try {
        await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
        setAuthToken(null);
    }
};

export const validateToken = async (): Promise<{ valid: boolean; user: any }> => {
    return apiRequest<{ valid: boolean; user: any }>('/auth/validate');
};

// =============================================================================
// Export utilities
// =============================================================================

export const exportFromAPI = async (format: 'json' | 'csv' | 'sql'): Promise<void> => {
    if (!USE_API) {
        throw new Error('API mode not enabled');
    }

    const token = getAuthToken();
    const response = await fetch(`${API_URL}/export/notes/${format}`, {
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
    });

    if (!response.ok) {
        throw new Error('Export failed');
    }

    const content = await response.text();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `WeaveNote_Database_${timestamp}.${format}`;
    
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

// =============================================================================
// Mode Detection
// =============================================================================

export const isApiMode = (): boolean => USE_API;

export const getApiUrl = (): string => API_URL;

export default {
    isApiMode,
    getApiUrl,
    setAuthToken,
    getAuthToken,
    
    // Notes
    loadNotesFromAPI,
    saveNoteToAPI,
    updateNoteToAPI,
    deleteNoteFromAPI,
    restoreNoteInAPI,
    
    // Folders
    loadFoldersFromAPI,
    saveFolderToAPI,
    deleteFolderFromAPI,
    
    // Auth
    loginWithAPI,
    registerWithAPI,
    createGuestSession,
    logoutFromAPI,
    validateToken,
    
    // Export
    exportFromAPI,
};
