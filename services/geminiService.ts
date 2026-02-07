import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);

const incrementUsage = (userId?: string) => {
    localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());
    if (userId) incrementUserAIUsage(userId).catch(console.error);
};

const logError = (context: string, error: any) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), context, message: error.message || String(error) });
    localStorage.setItem('ideaweaver_error_logs', JSON.stringify(logs.slice(0, 50)));
};

const logAIUsage = (username: string, action: string, details: string) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), username, action, details });
    localStorage.setItem('ideaweaver_ai_logs', JSON.stringify(logs.slice(0, 100)));
};

const extractJsonResponse = (text: string): any => {
    try {
        return JSON.parse(text);
    } catch (e) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.substring(start, end + 1);
            try { return JSON.parse(jsonStr); } catch { throw e; }
        }
        throw e;
    }
};

export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const prompt = `Format this document extracted text into structured Markdown. Identify title, category, tags. Return JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n${rawText.substring(0, 10000)}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
    incrementUsage(userId);
    logAIUsage(username, 'DOCUMENT_INGEST', `Processed ${filename}`);
    logTraffic('POST', 'gemini-3-flash/ingest', 200, rawText.length);
    return parsed;
  } catch (error: any) {
    logError('CLEAN_TEXT', error);
    logTraffic('POST', 'gemini-3-flash/ingest', 500, rawText.length);
    throw error;
  }
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const prompt = `Organize this user input into a structured note. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
    incrementUsage(userId);
    logAIUsage(username, 'NOTE_ORGANIZE', `Organized ${noteType} entry`);
    logTraffic('POST', 'gemini-3-flash/organize', 200, text.length);
    return parsed;
  } catch (error: any) {
    logError('PROCESS_NOTE', error);
    logTraffic('POST', 'gemini-3-flash/organize', 500, text.length);
    throw error;
  }
};

export const expandNoteContent = async (content: string, username: string, userId?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: `Deep dive expand on this: ${content}`,
      });
      incrementUsage(userId);
      logAIUsage(username, 'DEEP_DIVE', `Expanded content block`);
      return response.text || null;
    } catch (error) {
      logError('EXPAND_NOTE', error);
      return null;
    }
};

export interface DiagnosticLog {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

export const runConnectivityTest = async () => {
  const logs: DiagnosticLog[] = [];
  const addLog = (message: string, type: DiagnosticLog['type'] = 'info') => logs.push({ timestamp: Date.now(), message, type });

  const origin = window.location.origin;
  const isVercel = window.location.hostname.includes('vercel.app');
  
  addLog("--- VERCEL FORENSIC DIAGNOSTICS ---");
  addLog(`Current URL: ${origin}`, "info");
  
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "" || apiKey === "undefined") {
    addLog("CRITICAL: API_KEY is MISSING from the current build.", "error");
    if (isVercel) {
        addLog("CAUSE: You added the variable to Vercel, but did not REDEPLOY. Environment variables are baked into the code at build time.", "warn");
        addLog("FIX: Go to Vercel -> Deployments -> Click '...' on your latest build -> Redeploy.", "success");
    }
    return { success: false, message: "Key Missing in Build", logs };
  }

  addLog(`Key Signature: ${apiKey.substring(0, 6)}... Detected.`, "info");
  addLog("Attempting Handshake with Google Edge...");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ 
        model: 'gemini-flash-lite-latest', // Use stable model for health check
        contents: 'hi',
        config: { maxOutputTokens: 2 }
    });
    
    if (response && response.text) {
        addLog("SUCCESS: Handshake verified.", "success");
        return { success: true, message: "Engine Online", logs };
    }
    return { success: false, message: "Null response received", logs };
  } catch (e: any) {
    const msg = e.message || String(e);
    
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("protocol_error")) {
        addLog("ERROR: net::ERR_HTTP2_PROTOCOL_ERROR", "error");
        addLog("This usually means Google rejected the request before even looking at the key.", "warn");
        addLog(`1. GOOGLE CLOUD: Ensure 'Generative Language API' is ENABLED.`, "info");
        addLog(`2. RESTRICTIONS: Add '${origin}/*' to 'HTTP Referrers' in Google Cloud Console.`, "info");
        addLog(`3. STALE BUILD: If you just updated your Key/Settings, you MUST trigger a NEW DEPLOYMENT on Vercel.`, "warn");
        return { success: false, message: "Network/Security Block", logs };
    }

    if (msg.includes("403")) {
        addLog("FORBIDDEN (403): Unauthorized domain.", "error");
        addLog(`FIX: Whitelist '${origin}' in your API Key settings.`, "warn");
        return { success: false, message: "403 Forbidden", logs };
    }

    addLog(`ENGINE ERROR: ${msg}`, "error");
    return { success: false, message: "API Handshake Failed", logs };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');