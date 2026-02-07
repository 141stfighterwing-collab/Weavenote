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

/**
 * Robust JSON extractor to handle cases where the model appends text after the JSON object
 * or wraps the JSON in markdown code blocks.
 */
const extractJsonResponse = (text: string): any => {
    try {
        // Direct parse attempt first
        return JSON.parse(text);
    } catch (e) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        
        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = text.substring(start, end + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (innerError) {
                console.error("Failed to parse extracted JSON block:", jsonStr);
                throw innerError;
            }
        }
        throw new Error("No valid JSON object found in response");
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

  addLog("System Diagnostics: Initiating AI Handshake...");
  addLog(`Current Origin: ${window.location.origin}`, "info");
  
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    addLog("CRITICAL: API_KEY is missing from environment variables.", "error");
    addLog("REMEDY: Check your .env file or deployment settings (Vercel/Vite/Docker).", "warn");
    return { success: false, message: "Missing API Key", logs };
  }

  if (!apiKey.startsWith("AIza")) {
    addLog("WARNING: API Key format is invalid (missing 'AIza' prefix).", "warn");
  }

  addLog(`Auth Context: Key detected (${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)})`);

  try {
    const ai = new GoogleGenAI({ apiKey });
    addLog("Pinging Google Generative Language API...");
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { 
          maxOutputTokens: 5,
          thinkingConfig: { thinkingBudget: 0 }
        }
    });
    
    if (response && response.text) {
        addLog(`SUCCESS: API responded correctly.`, "success");
        return { success: true, message: "Active & Healthy", logs };
    }
    
    return { success: false, message: "Unexpected empty response", logs };
  } catch (e: any) {
    const msg = e.message || String(e);
    
    // Explicit 'Failed to fetch' check
    if (msg.toLowerCase().includes("failed to fetch")) {
        addLog("NETWORK BLOCKED: Browser aborted the request.", "error");
        addLog("REMEDY 1: Ad-Blockers/VPNs. Ensure 'generativelanguage.googleapis.com' is whitelisted.", "warn");
        addLog("REMEDY 2: CORS/CSP. If you self-host, ensure your Content Security Policy allows this domain.", "warn");
        addLog(`REMEDY 3: Domain Restrictions. Visit console.cloud.google.com -> APIs & Services -> Credentials. Verify if this key is restricted to specific 'HTTP referrers' and add '${window.location.origin}/*'.`, "warn");
        return { success: false, message: "Network/Security Block", logs };
    }

    if (msg.includes("403")) {
        addLog("PERMISSION DENIED (403): Unauthorized access.", "error");
        addLog(`REMEDY: Most likely 'API Key Restrictions'. Your key is configured to only work on specific websites. Add '${window.location.origin}' to your key's allowed referrers in Google Cloud Console.`, "warn");
        return { success: false, message: "Forbidden (403)", logs };
    }

    if (msg.includes("400")) {
        addLog("BAD REQUEST (400): Parameter mismatch.", "error");
        addLog("REMEDY: Ensure the 'Gemini API' is ENABLED for your project in Google Cloud Console.", "warn");
        return { success: false, message: "Bad Request (400)", logs };
    }

    if (msg.includes("429")) {
        addLog("RATE LIMIT (429): Quota exceeded.", "error");
        addLog("REMEDY: Free tier limits hit. Wait 60s or enable billing.", "warn");
        return { success: false, message: "Rate Limited (429)", logs };
    }

    addLog(`ENGINE ERROR: ${msg}`, "error");
    return { success: false, message: `Error: ${msg.substring(0, 40)}`, logs };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');