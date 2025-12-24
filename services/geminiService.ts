
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);

const incrementUsage = (userId?: string) => {
    localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());
    if (userId) {
        incrementUserAIUsage(userId).catch(console.error);
    }
};

export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  if (!rawText || rawText.trim().length === 0) {
      throw new Error("The document appears to be empty or unreadable.");
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `System: You are an expert Document Reconstruction Engine. Please clean up the following text extracted from a document. Format it nicely in Markdown. Identify a suitable title, category, and tags. Return strictly valid JSON with keys: "title", "formattedContent", "category", "tags".\n\nText:\n`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt + rawText.substring(0, 10000),
      config: { responseMimeType: 'application/json' }
    });

    logTraffic('POST', 'gemini-3-flash-preview/document', 200, rawText.length, { filename });
    
    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI engine.");
    let parsed = JSON.parse(resultText) as ProcessedNoteData;
    incrementUsage(userId);
    return parsed;
  } catch (error: any) {
    logTraffic('POST', 'gemini-3-flash-preview/document', 500, rawText.length, { error: error.message });
    throw error;
  }
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `System: You are an expert note organizer. Analyze the following user input and organize it into a structured note. Return strictly valid JSON with keys: "title", "formattedContent", "category", "tags".\n\nInput: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    logTraffic('POST', `gemini-3-flash-preview/organize/${noteType}`, 200, text.length);

    const resultText = response.text;
    if (!resultText) throw new Error("AI failed to return text.");
    let parsed = JSON.parse(resultText) as ProcessedNoteData;
    incrementUsage(userId);
    return parsed;
  } catch (error: any) {
    logTraffic('POST', `gemini-3-flash-preview/organize/${noteType}`, 500, text.length, { error: error.message });
    throw new Error(error.message || "AI was unable to process this note.");
  }
};

export const expandNoteContent = async (content: string, username: string, userId?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Expand on this note: ${content}`,
      });
      logTraffic('POST', 'gemini-3-flash-preview/expand', 200, content.length);
      incrementUsage(userId);
      return response.text || null;
    } catch (error) {
      logTraffic('POST', 'gemini-3-flash-preview/expand', 500, content.length);
      return null;
    }
};

export const runConnectivityTest = async () => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'Ready' });
    logTraffic('POST', 'gemini-3-flash-preview/test', 200, 5);
    return { success: true, steps: [] };
  } catch (e: any) {
    logTraffic('POST', 'gemini-3-flash-preview/test', 500, 0);
    return { success: false, message: e.message };
  }
};

// Fix: Implemented logError to properly store error events in local storage
export const logError = (c: string, e: any) => {
  const logs = getErrorLogs();
  logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), context: c, message: e.message || String(e) });
  localStorage.setItem('ideaweaver_error_logs', JSON.stringify(logs.slice(0, 50)));
};

// Fix: Implemented logAIUsage to record AI processing history
export const logAIUsage = (u: string, a: string, d: string) => {
  const logs = getAIUsageLogs();
  logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), username: u, action: a, details: d });
  localStorage.setItem('ideaweaver_ai_logs', JSON.stringify(logs.slice(0, 100)));
};

// Fix: Added return statement to getAIUsageLogs to resolve TS error at line 108
export const getAIUsageLogs = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
  } catch {
    return [];
  }
};

// Fix: Added return statement to getErrorLogs to resolve TS error at line 109
export const getErrorLogs = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
  } catch {
    return [];
  }
};

export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');
