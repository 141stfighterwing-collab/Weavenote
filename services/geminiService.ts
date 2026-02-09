import { GoogleGenAI } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

/**
 * Factory for the AI instance. 
 * IMPORTANT: This SDK requires an API KEY STRING (starts with AIza...).
 * It does NOT accept Service Account JSON or OAuth Client IDs.
 */
const getAI = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "" || apiKey === "undefined") {
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
    const prompt = `Act as a high-end knowledge architect. Synthesize and format this messy document text into highly structured Markdown. 
Extract the core essence, identify a precise title, category, and relevant tags.
Return STRICT JSON with keys: "title", "formattedContent", "category", "tags".

Source Text:
${rawText.substring(0, 12000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 4000 }
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
    // Specific instruction for messy copy-pastes - Deep Synthesis mode
    const prompt = `Act as an expert knowledge organizer. The user is providing potentially messy, raw, or copy-pasted input fragments. 
Your task: 
1. Analyze the input fragments and understand the context (Deep Reasoning).
2. Clean up formatting, remove irrelevant noise, and fix typos.
3. Synthesize the content into a high-quality, readable, and professional Note.
4. If it looks like a list of tasks, format it as a checklist. If it's conceptual, use proper headings.
5. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".

Input: 
${text}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Pro for better synthesis of fragmented text
      contents: prompt,
      config: { 
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 4000 } // Give it a budget to think through the messy input
      }
    });

    const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
    incrementUsage(userId);
    logAIUsage(username, 'SYNTHESIS_ORGANIZE', `Synthesized messy input into ${noteType}`);
    logTraffic('POST', 'gemini-3-pro/organize', 200, text.length);
    return parsed;
  } catch (error: any) {
    logError('PROCESS_NOTE', error);
    logTraffic('POST', 'gemini-3-pro/organize', 500, text.length);
    throw error;
  }
};

export const expandNoteContent = async (content: string, username: string, userId?: string) => {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: `Deep dive expand on this idea with scholarly rigor and creative insight: ${content}`,
          config: {
            thinkingConfig: { thinkingBudget: 8000 } 
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
  
  addLog("--- SYSTEM IDENTITY FORENSICS ---");
  addLog(`Diagnostic build: ${new Date().toLocaleString()}`);
  addLog(`App Host: ${origin}`);
  
  const apiKey = process.env.API_KEY || "";

  if (apiKey === "" || apiKey === "undefined") {
    addLog("CRITICAL: API Key is missing from the environment.", "error");
    addLog("RESOLUTION: You must add 'API_KEY' to Vercel and then REDEPLOY the project.", "warn");
    return { success: false, message: "Missing Env Var", logs };
  }

  // FORENSIC DETECTION OF WRONG CREDENTIAL TYPES
  // This addresses the user providing a JSON Service Account
  if (apiKey.trim().startsWith("{") && apiKey.includes("private_key")) {
      addLog("DETECTION: You have pasted a SERVICE ACCOUNT JSON into the API_KEY field.", "error");
      addLog("FIX: Browser SDKs require a standard 'API Key' string (starts with 'AIza...').", "success");
      addLog("ACTION: Go to Google Cloud Console -> Credentials -> Create Credentials -> API Key. Copy that string into Vercel.", "warn");
      return { success: false, message: "Wrong Credential Format", logs };
  }

  if (apiKey.includes("apps.googleusercontent.com")) {
      addLog("DETECTION: You are using an OAuth 2.0 Client ID.", "error");
      addLog("FIX: Gemini API requires a standard 'API Key', not an OAuth Client ID.", "success");
      addLog("ACTION: Go to Google Cloud Console -> Credentials -> Create Credentials -> API Key.", "warn");
      return { success: false, message: "Wrong Credential Type", logs };
  }

  if (!apiKey.startsWith("AIza")) {
      addLog("DETECTION: Invalid key signature. Standard keys start with 'AIza'.", "error");
      return { success: false, message: "Invalid Format", logs };
  }

  addLog(`Key Signature: ${apiKey.substring(0, 6)}... verified.`, "info");

  try {
    const ai = getAI();
    addLog("Attempting Handshake with Google Edge Network...");
    
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'ping',
        config: { maxOutputTokens: 2 }
    });
    
    if (response && response.text) {
        addLog("SUCCESS: AI Core is alive and authorized.", "success");
        return { success: true, message: "Engine Online", logs };
    }
    return { success: false, message: "Empty Response", logs };
  } catch (e: any) {
    const msg = e.message || String(e);
    
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("protocol_error")) {
        addLog("PROTOCOL ERROR (net::ERR_HTTP2_PROTOCOL_ERROR): The connection was reset.", "error");
        addLog("CAUSE 1: Your API Key is restricted to the wrong domain.", "warn");
        addLog(`RESOLUTION: Add '${origin}/*' to 'HTTP Referrers' in Google Cloud Console -> API Key Settings.`, "info");
        
        if (isVercel) {
            addLog("CAUSE 2: Vercel 'Deployment Protection' is active.", "warn");
            addLog("RESOLUTION: Go to Vercel Project Settings -> Security -> Turn OFF 'Deployment Protection'.", "info");
        }
        return { success: false, message: "Network Handshake Blocked", logs };
    }

    if (msg.includes("403")) {
        addLog("FORBIDDEN (403): Unauthorized domain or API not enabled.", "error");
        addLog(`FIX: Enable 'Generative Language API' in your Google Cloud Project.`, "info");
        return { success: false, message: "Permission Denied", logs };
    }

    addLog(`UNHANDLED ENGINE ERROR: ${msg}`, "error");
    return { success: false, message: "Handshake Failed", logs };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');