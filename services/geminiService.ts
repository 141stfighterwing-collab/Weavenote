import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

// Factory to prevent stale SDK instances
const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "") {
        throw new Error("API_KEY_MISSING");
    }
    return new GoogleGenAI({ apiKey });
};

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
  try {
    const ai = getAI();
    const prompt = `Format this document extracted text into structured Markdown. Identify title, category, tags. Return JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n${rawText.substring(0, 10000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // High intelligence model for documents
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        temperature: 0.1 
      }
    });

    const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
    incrementUsage(userId);
    logAIUsage(username, 'DOCUMENT_INGEST', `Processed ${filename}`);
    logTraffic('POST', 'gemini-3-pro/ingest', 200, rawText.length);
    return parsed;
  } catch (error: any) {
    logError('CLEAN_TEXT', error);
    logTraffic('POST', 'gemini-3-pro/ingest', 500, rawText.length);
    throw error;
  }
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string): Promise<ProcessedNoteData> => {
  try {
    const ai = getAI();
    const prompt = `Organize this user input into a structured note. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash is better for quick notes
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
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', // Pro for deep reasoning
          contents: `Deep dive expand on this: ${content}`,
          config: {
            thinkingConfig: { thinkingBudget: 4000 } // Enable chain of thought
          }
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
  
  addLog("--- ENGINE DIAGNOSTICS ---");
  addLog(`Environment: ${isVercel ? 'Vercel Preview/Prod' : 'Development'}`);
  
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "" || apiKey === "undefined") {
    addLog("CRITICAL: API_KEY is physically missing from the JS bundle.", "error");
    addLog("RESOLUTION: You must REDEPLOY on Vercel for new Env Vars to take effect.", "warn");
    return { success: false, message: "Stale Build / Missing Key", logs };
  }

  addLog(`Key Verification: Signature ${apiKey.substring(0, 6)}... detected.`);

  try {
    const ai = getAI();
    addLog("Initiating Google Edge Handshake...");
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { maxOutputTokens: 2 }
    });
    
    if (response && response.text) {
        addLog("SUCCESS: AI Core Online and Responsive.", "success");
        return { success: true, message: "Engine Online", logs };
    }
    return { success: false, message: "Null response", logs };
  } catch (e: any) {
    const msg = e.message || String(e);
    
    if (msg.includes("API_KEY_MISSING")) {
        addLog("ERROR: Code attempted to call AI without a key string.", "error");
        return { success: false, message: "Empty Key String", logs };
    }

    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("protocol_error")) {
        addLog("ERROR: net::ERR_HTTP2_PROTOCOL_ERROR", "error");
        addLog("REASON: Google rejected the stream. Check if 'Generative Language API' is ENABLED in Cloud Console.", "warn");
        addLog(`ACTION: Add '${origin}/*' to your API Key restrictions.`, "info");
        
        if (isVercel) {
            addLog("VERCEL NOTE: Turn OFF 'Deployment Protection' in Vercel Settings -> Security.", "info");
        }
        return { success: false, message: "Network Reset", logs };
    }

    addLog(`UNHANDLED: ${msg}`, "error");
    return { success: false, message: "Handshake Failed", logs };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');