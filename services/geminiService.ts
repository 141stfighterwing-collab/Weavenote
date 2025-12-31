
import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

// Internal sanitization: Detects valid key structure vs common mistakes
const getKeyStatus = (key: string) => {
    const clean = (key || "").trim().replace(/^["']|["']$/g, "");
    if (!clean) return { valid: false, key: "", error: "EMPTY" };
    if (clean.startsWith("AIza")) return { valid: true, key: clean, error: null };
    if (clean.toUpperCase().startsWith("GEMI")) return { valid: false, key: clean, error: "MODEL_NAME_PASTED" };
    return { valid: false, key: clean, error: "INVALID_PREFIX" };
};

const getCleanApiKey = () => {
    const primary = getKeyStatus(process.env.API_KEY || "");
    const backup = getKeyStatus(process.env.VITE_API_KEY || "");

    // Logic: Use whichever one is actually a valid AIza key
    if (primary.valid) return primary.key;
    if (backup.valid) return backup.key;
    
    // If both are broken, return primary for the error reporter to catch
    return primary.key || backup.key;
};

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
  const apiKey = getCleanApiKey();
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
  const apiKey = getCleanApiKey();
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
    const apiKey = getCleanApiKey();
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
  const primary = getKeyStatus(process.env.API_KEY || "");
  const backup = getKeyStatus(process.env.VITE_API_KEY || "");
  
  let targetKey = "";
  let sourceName = "";

  if (primary.valid) {
      targetKey = primary.key;
      sourceName = "Primary (API_KEY)";
  } else if (backup.valid) {
      targetKey = backup.key;
      sourceName = "Backup (VITE_API_KEY)";
  } else {
      // Both invalid - generate specific error logs
      if (primary.error === "MODEL_NAME_PASTED" || backup.error === "MODEL_NAME_PASTED") {
          return { success: false, message: "Critical Error: It looks like you pasted the Model Name (e.g. 'gemini-1.5-flash') into your API Key field. Please paste the actual 39-character alphanumeric key from Google AI Studio." };
      }
      return { success: false, message: `Key Format Error: Keys must start with 'AIza'. Current primary starts with '${primary.key.substring(0,4)}' and backup starts with '${backup.key.substring(0,4)}'.` };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: targetKey });
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'Ping',
        config: { maxOutputTokens: 5 }
    });
    
    if (response && response.text) {
        return { success: true, message: `Active using ${sourceName}`, steps: ["Handshake complete", "Token verified"] };
    }
    return { success: false, message: "Empty response from Google endpoint" };
  } catch (e: any) {
    console.error("AI CONNECTION DEBUG:", e);
    let msg = e.message || "Unknown connectivity error";
    if (msg.includes("Failed to fetch")) msg = "Network Block: API unreachable. Check Adblockers/VPN.";
    return { success: false, message: `[${sourceName}] ${msg}` };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');
