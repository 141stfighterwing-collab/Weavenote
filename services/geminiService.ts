
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

// Internal error logger for system health
const logError = (context: string, error: any) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), context, message: error.message || String(error) });
    localStorage.setItem('ideaweaver_error_logs', JSON.stringify(logs.slice(0, 50)));
};

// Safeguard: AI Action Logging
const logAIUsage = (username: string, action: string, details: string) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), username, action, details });
    localStorage.setItem('ideaweaver_ai_logs', JSON.stringify(logs.slice(0, 100)));
};

export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Infrastructure missing API Key.");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Format this document extracted text into structured Markdown. Identify title, category, tags. Return JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n${rawText.substring(0, 10000)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text) as ProcessedNoteData;
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
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Infrastructure missing API Key.");
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Organize this user input into a structured note. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text) as ProcessedNoteData;
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
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
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

export const runConnectivityTest = async () => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "") return { success: false, message: "Missing API Key: Verify process.env.API_KEY" };
    
    const ai = new GoogleGenAI({ apiKey });
    // Use a lightweight call for testing
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'Ping',
        config: { maxOutputTokens: 10 }
    });
    
    if (response && response.text) {
        return { success: true, steps: ["Handshake complete", "Token verified"] };
    }
    return { success: false, message: "Empty response from Google endpoint" };
  } catch (e: any) {
    let msg = e.message || "Unknown error";
    if (msg.includes("Failed to fetch")) msg = "Network block or invalid API Key (CORS/Preflight failure)";
    if (msg.includes("API_KEY_INVALID")) msg = "Invalid API Key format";
    return { success: false, message: msg };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');
