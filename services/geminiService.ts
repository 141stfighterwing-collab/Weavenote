
import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

/**
 * Key Discovery Engine
 * Scans all possible environment variable names to find a valid Gemini Key.
 */
const getBestApiKey = () => {
    const candidates = [
        { name: 'API_KEY', val: process.env.API_KEY },
        { name: 'VITE_API_KEY', val: process.env.VITE_API_KEY },
        { name: 'VITE_KEY', val: (process.env as any).VITE_KEY }
    ];

    // 1. Clean and filter candidates
    const processed = candidates.map(c => {
        const raw = (c.val || "").trim().replace(/^["']|["']$/g, "");
        return {
            name: c.name,
            value: raw,
            isPlaceholder: raw.toUpperCase().includes("GEMI") || raw.length < 10,
            isValid: raw.startsWith("AIza")
        };
    });

    // 2. Return the first valid 'AIza' key found
    const winner = processed.find(p => p.isValid);
    if (winner) return winner.value;

    // 3. Fallback: if no valid key, return the best looking one for error reporting
    return (processed.find(p => p.value !== "") || { value: "" }).value;
};

const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);

const incrementUsage = (userId?: string) => {
    localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());
    if (userId) incrementUserAIUsage(userId).catch(console.error);
};

// Internal error logger
const logError = (context: string, error: any) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), context, message: error.message || String(error) });
    localStorage.setItem('ideaweaver_error_logs', JSON.stringify(logs.slice(0, 50)));
};

// AI usage log
const logAIUsage = (username: string, action: string, details: string) => {
    const logs = JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
    logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), username, action, details });
    localStorage.setItem('ideaweaver_ai_logs', JSON.stringify(logs.slice(0, 100)));
};

export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const apiKey = getBestApiKey();
  if (!apiKey || !apiKey.startsWith("AIza")) throw new Error("Infrastructure missing valid Gemini API Key.");

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
  const apiKey = getBestApiKey();
  if (!apiKey || !apiKey.startsWith("AIza")) throw new Error("Infrastructure missing valid Gemini API Key.");
  
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
    const apiKey = getBestApiKey();
    if (!apiKey || !apiKey.startsWith("AIza")) return null;
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
  const apiKey = getBestApiKey();
  
  if (!apiKey) return { success: false, message: "Error: No API keys found in environment variables (Checked: API_KEY, VITE_API_KEY, VITE_KEY)." };
  
  if (!apiKey.startsWith("AIza")) {
      if (apiKey.toUpperCase().includes("GEMI")) {
          return { success: false, message: "Critical: You have a placeholder string like 'GEMINI_API_KEY' in your environment variables. Replace it with the actual alphanumeric key from Google AI Studio." };
      }
      return { success: false, message: `Invalid Key Format: Key starts with '${apiKey.substring(0,4)}' but must start with 'AIza'. Check for leading spaces or quotes.` };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { maxOutputTokens: 5 }
    });
    
    if (response && response.text) {
        return { success: true, message: "Handshake Successful", steps: ["Validated AIza prefix", "Connection established", "Tokens verified"] };
    }
    return { success: false, message: "Handshake Failed: Received empty response from Google." };
  } catch (e: any) {
    console.error("AI CONNECTION DEBUG:", e);
    let msg = e.message || "Unknown connectivity error";
    if (msg.includes("Failed to fetch")) msg = "Network Block: The request was blocked. Check browser extensions (AdBlock/uBlock) or VPN.";
    return { success: false, message: `Service Error: ${msg}` };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');
