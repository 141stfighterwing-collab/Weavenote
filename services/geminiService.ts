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

export const runConnectivityTest = async () => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    return { 
      success: false, 
      message: "Error: API_KEY is missing from client bundle. Check Vercel Env Vars." 
    };
  }

  // Diagnostics
  const keySnippet = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  console.debug(`Handshake attempt with key: ${keySnippet}`);

  try {
    // Re-initialize for every test as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Simplest possible call to rule out config issues
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: 'Say "connected"' 
    });
    
    if (response && response.text) {
        return { 
          success: true, 
          message: "Handshake Successful", 
          steps: ["SDK Initialized", "Key Validated", "Model Responded"] 
        };
    }
    return { success: false, message: "Handshake Failed: Empty response received." };
  } catch (e: any) {
    // Log the RAW error to the browser console to help debug protocol level issues
    console.error("DEBUG: RAW Gemini Error:", e);
    
    let msg = e.message || "Unknown error";
    
    // Check for lower-level fetch failures (Protocol error, DNS, etc)
    if (e.name === 'TypeError' && msg.includes('fetch')) {
      msg = `Fetch Failure: The browser failed to establish a secure connection to Google. This often means the API key is restricted to a different origin, or a browser extension/firewall is blocking the request. Raw details: ${msg}`;
    } else if (msg.includes("403")) {
      msg = "Access Forbidden: Check if your API Key is enabled for 'Generative Language API' in Google Cloud Console.";
    } else if (msg.includes("429")) {
      msg = "Quota Limit Reached.";
    } else if (msg.includes("API_KEY_INVALID")) {
      msg = "Invalid Key String.";
    }
    
    return { success: false, message: `Service Error: ${msg}` };
  }
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');