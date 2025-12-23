import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";

export const DAILY_REQUEST_LIMIT = 800;
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);

const incrementUsage = (userId?: string) => {
    localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());
    if (userId) {
        incrementUserAIUsage(userId).catch(console.error);
    }
};

/**
 * Specifically cleans up raw text extracted from documents.
 * Focuses on removing OCR artifacts and square boxes while PRESERVING almost all content.
 */
export const cleanAndFormatIngestedText = async (rawText: string, filename: string, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const prompt = `System: You are an expert Document Reconstruction Engine. 
Your goal is to transform messy, raw extracted text into a professionally formatted document WITHOUT losing details.

TASK:
1. ARTIFACT REMOVAL: Strip all random square boxes like "[]", "[][ ]", "☐", or broken line artifacts. 
2. MAXIMUM RETENTION: Keep every single meaningful detail, fact, date, and description. DO NOT summarize. DO NOT delete paragraphs unless they are purely empty artifacts.
3. STRUCTURE: Reconstruct the logical flow. Use proper Markdown headers (##, ###), bullet points, and tables if the raw text implies a grid.
4. METADATA: Generate a precise, professional title based on the content (filename was: ${filename}).

INPUT DATA (Raw Extraction):
${rawText.substring(0, 32000)}

Output must be strictly JSON following the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Pro is required for high-fidelity reconstruction
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            formattedContent: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "formattedContent", "category", "tags"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI engine.");

    incrementUsage(userId);
    return JSON.parse(resultText) as ProcessedNoteData;
  } catch (error: any) {
    console.error("AI Document Cleanup Error:", error);
    throw error;
  }
};

/**
 * AI Organize handles messy copy-pastes by looking for hidden structure.
 */
export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  let specificInstructions = "";
  switch (noteType) {
      case 'project':
          specificInstructions = `Generate a highly structured project plan. If the input is messy or unstructured text, extract clear high-level objectives, specific deliverables, key milestones, and a logical timeline from the context. Look for implicit dates and goals.`;
          break;
      case 'notebook':
          specificInstructions = `Organize as a cohesive journal or professional log entry. If the input is a brain-dump or copy-paste from various sources, unify the voice and use clear, meaningful headers to separate ideas.`;
          break;
      case 'code':
          specificInstructions = `Analyze the script provided. Even if it's just fragments, identify the language and purpose. Place actual code blocks strictly in triple backticks.`;
          break;
      default:
          specificInstructions = `Cleanup messy unstructured input. Extract the core ideas, group related points, and use Markdown for professional formatting. Preserve important data points while removing fluff.`;
          break;
  }

  const prompt = `System: You are an expert note organizer for ${username}. 
Your specialty is taking messy, unstructured copy-pasted text and transforming it into high-quality organized notes.
Instruction: ${specificInstructions}
Task: Categorize and format the following input text into a clean JSON structure.
Input: ${text}
Categories available: ${existingCategories.join(', ')}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        thinkingConfig: { thinkingBudget: 4000 },
        responseMimeType: 'application/json', 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            formattedContent: { type: Type.STRING },
            category: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            projectData: {
              type: Type.OBJECT,
              properties: {
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                milestones: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      date: { type: Type.STRING },
                      label: { type: Type.STRING },
                      status: { type: Type.STRING }
                    }
                  }
                },
                timeline: {
                  type: Type.ARRAY,
                  items: {
                     type: Type.OBJECT,
                     properties: { 
                       name: { type: Type.STRING }, 
                       startDate: { type: Type.STRING }, 
                       endDate: { type: Type.STRING } 
                     }
                  }
                }
              }
            }
          },
          required: ["title", "formattedContent", "category", "tags"],
        } 
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Model returned an empty response.");

    incrementUsage(userId);
    logAIUsage(username, "ORGANIZE_NOTE", `Processed ${noteType} note.`);
    return JSON.parse(resultText) as ProcessedNoteData;
  } catch (error: any) {
    console.error("Gemini AI Processing Error:", error);
    logError("AI_PROCESS", error);
    throw new Error(error.message || "AI was unable to process this note.");
  }
};

export const expandNoteContent = async (content: string, username: string, userId?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Expand on this note, providing more depth and context: ${content}`,
      });
      incrementUsage(userId);
      return response.text || null;
    } catch (error) {
      logError("AI_EXPAND", error);
      return null;
    }
};

/**
 * Detailed connectivity test suite for the diagnostics panel
 */
export const runConnectivityTest = async () => {
  const steps = [];
  
  try {
    // Step 1: Logic check
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') throw new Error("API Key is missing or undefined in environment (process.env.API_KEY).");
    steps.push({ name: "API Credentials Found", status: "success" });

    // Step 2: Connection
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const start = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "Ready"',
    });
    const latency = Date.now() - start;
    
    if (response.text) {
      steps.push({ name: "Gemini Handshake", status: "success", detail: `${latency}ms` });
    } else {
      throw new Error("Handshake failed: Empty response.");
    }

    return { success: true, steps };
  } catch (e: any) {
    return { success: false, steps, message: e.message };
  }
};

export const logError = (c: string, e: any) => {
  const logs = getErrorLogs();
  logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), context: c, message: e.message || String(e) });
  localStorage.setItem('ideaweaver_error_logs', JSON.stringify(logs.slice(0, 50)));
};

export const logAIUsage = (u: string, a: string, d: string) => {
  const logs = getAIUsageLogs();
  logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), username: u, action: a, details: d });
  localStorage.setItem('ideaweaver_ai_logs', JSON.stringify(logs.slice(0, 50)));
};

export const getAIUsageLogs = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]'); } catch { return []; }
};

export const getErrorLogs = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]'); } catch { return []; }
};

export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');