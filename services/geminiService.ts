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
  const promptText = `Format this document extracted text into structured Markdown. Identify title, category, tags. Return JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n${rawText.substring(0, 10000)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: { parts: [{ text: promptText }] },
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
  const promptText = `Organize this user input into a structured note. Return strictly JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: promptText }] },
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
          contents: { parts: [{ text: `Deep dive expand on this: ${content}` }] },
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
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    return { 
      success: false, 
      message: "Error: API_KEY is empty or undefined. Verify Vercel Environment Variables." 
    };
  }

  // Diagnostic info (obfuscated key for safety)
  const keySnippet = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  console.debug(`Diagnostic: Attempting handshake with key snippet: ${keySnippet}`);

  try {
    // Fix: Use process.env.API_KEY directly when initializing GoogleGenAI to comply with coding guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: { parts: [{ text: 'ping' }] },
        config: { 
          maxOutputTokens: 10,
          thinkingConfig: { thinkingBudget: 0 }
        }
    });
    
    if (response && response.text) {
        return { 
          success: true, 
          message: "Handshake Successful", 
          steps: ["SDK Initialized", `Key Loaded (${keySnippet})`, "Model Response Verified"] 
        };
    }
    return { success: false, message: "Handshake Failed: Received empty text response from model." };
  } catch (e: any) {
    console.error("AI CONNECTION DEBUG:", e);
    let msg = e.message || "Unknown connectivity error";
    
    // Check for common browser fetch failure reasons
    if (msg.includes("Failed to fetch")) {
      msg = "Network request blocked. Check for Adblockers, VPNs, or browser extensions interfering with Google API domains.";
    } else if (msg.includes("403")) {
      msg = "Permission Denied: Your API Key may be restricted by project/region, or the Gemini 3 preview models are not enabled for this key.";
    } else if (msg.includes("429")) {
      msg = "Quota Exceeded: Too many requests for this key.";
    } else if (msg.includes("API_KEY_INVALID")) {
      msg = "API Key Invalid: The provided string is not a valid Google Cloud API key.";
    }
    
    return { success: false, message: `Service Error: ${msg}` };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');