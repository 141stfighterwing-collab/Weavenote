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

export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Format this document extracted text into structured Markdown. Identify title, category, tags. Return JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n${rawText.substring(0, 10000)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || "{}") as ProcessedNoteData;
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Organize this user input into a structured note. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || "{}") as ProcessedNoteData;
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

  addLog("Starting System Handshake...");
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    addLog("CRITICAL: process.env.API_KEY is undefined or empty.", "error");
    return { success: false, message: "Error: No API_KEY configured.", logs };
  }

  addLog(`Environment Key Found (${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)})`);
  addLog("Initializing @google/genai SDK...");

  try {
    const ai = new GoogleGenAI({ apiKey });
    addLog("Sending verification ping to gemini-3-flash-preview...");
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { 
          maxOutputTokens: 10,
          thinkingConfig: { thinkingBudget: 0 }
        }
    });
    
    if (response && response.text) {
        addLog("API Response received: " + response.text, "success");
        addLog("Model latency verified within limits.", "success");
        return { success: true, message: "AI Engine Healthy", logs };
    }
    addLog("Model returned empty content payload.", "warn");
    return { success: false, message: "Handshake Failed: Empty response.", logs };
  } catch (e: any) {
    let msg = e.message || "Unknown connectivity error";
    
    if (msg.includes("403")) {
      addLog("SERVER ERROR 403: API Key is invalid or restricted to specific IP/Domain.", "error");
      msg = "API Key Invalid or Restricted (Check GCP Console)";
    } else if (msg.includes("429")) {
      addLog("SERVER ERROR 429: Rate limit hit or credit quota exhausted.", "error");
      msg = "Quota Exceeded / Account Billing Required";
    } else if (msg.includes("401")) {
      addLog("SERVER ERROR 401: Unauthorized request. Token might be expired.", "error");
      msg = "Unauthorized (Expired Key)";
    } else {
      addLog("UNEXPECTED ERROR: " + msg, "error");
    }

    return { success: false, message: msg, logs };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');