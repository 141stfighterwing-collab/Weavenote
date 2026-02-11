import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

/**
 * Factory for the AI instance. 
 * Ensure process.env.API_KEY is the plain string (AIza...), not a JSON object.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "" || apiKey === "undefined") {
        throw new Error("API_KEY_MISSING");
    }
    // Validation for common mistake: pasting Service Account JSON
    if (apiKey.trim().startsWith("{")) {
        throw new Error("API_KEY_FORMAT_ERROR: Detected JSON object instead of API Key string.");
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

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string, onStepUpdate?: (step: string) => void): Promise<ProcessedNoteData> => {
  try {
    const ai = getAI();
    
    onStepUpdate?.("Initializing Neural Synthesis...");
    
    const prompt = `Act as an Expert Knowledge Architect.
The input below is a messy copy-paste (possibly containing web artifacts, chat fragments, or technical logs).

Your Job:
1. DISTILL: Extract the core ideas and remove noise (nav-text, ad-text, timestamps, etc).
2. STRUCTURE: Re-format into beautiful, logical Markdown. Use headings, lists, and code blocks as appropriate.
3. TITLE: Create a punchy, accurate title for the distilled content.
4. TAXONOMY: Suggest a logical 'category', 'tags' (3-5), and a single-word 'suggestedFolderName' for organization (e.g., 'Work', 'Personal', 'Tech', 'Inspiration').
5. ENRICH: If the input contains fragmented action items, structure them as a checklist.

Return a STRICT JSON object with these keys: "title", "formattedContent", "category", "tags", "suggestedFolderName".

Input Content:
${text}`;
    
    onStepUpdate?.("Scrubbing Fragments & Noise...");
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 4000 } 
      }
    });

    onStepUpdate?.("Architecting Final Structure...");

    const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
    incrementUsage(userId);
    logTraffic('POST', 'gemini-3-pro/organize', 200, text.length);
    return parsed;
  } catch (error: any) {
    logError('PROCESS_NOTE', error);
    logTraffic('POST', 'gemini-3-pro/organize', 500, text.length);
    throw error;
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
  const apiKey = process.env.API_KEY || "";

  addLog("--- SECURITY HANDSHAKE AUDIT ---");
  
  if (apiKey.trim().startsWith("{")) {
      addLog("CRITICAL: Detected Service Account JSON as API_KEY.", "error");
      addLog("ACTION: Delete the JSON and use only the string 'AIza...'", "warn");
      return { success: false, message: "Credential Type Mismatch", logs };
  }

  try {
    const ai = getAI();
    addLog("Testing Edge Handshake with gemini-3-flash...");
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { maxOutputTokens: 2 }
    });
    
    if (response && response.text) {
        addLog("SUCCESS: Neural Engine Online.", "success");
        return { success: true, message: "Connected", logs };
    }
  } catch (e: any) {
    const msg = e.message || String(e);
    if (msg.includes("PROTOCOL_ERROR") || msg.toLowerCase().includes("failed to fetch")) {
        addLog("PROTOCOL ERROR (RESTRICTION BLOCK): The connection was reset by Google Edge.", "error");
        addLog(`RESOLUTION: In Google Cloud -> Credentials, set restrictions to 'None' or add '${origin}/*' to 'HTTP Referrers'.`, "info");
    }
    addLog(`ENGINE ERROR: ${msg}`, "error");
  }

  return { success: false, message: "Handshake Failed", logs };
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');