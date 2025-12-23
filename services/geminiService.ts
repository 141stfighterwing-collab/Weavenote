
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";

export const DAILY_REQUEST_LIMIT = 800;
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);
const incrementUsage = () => localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());

/**
 * Accesses the API key directly from process.env as required.
 */
const safeApiKey = () => {
    try {
        // Direct access as per guidelines
        return process.env.API_KEY;
    } catch (e) {
        return undefined;
    }
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string): Promise<ProcessedNoteData> => {
  const apiKey = safeApiKey();
  if (!apiKey) throw new Error("API_KEY environment variable is not accessible in this context.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  let specificInstructions = "";
  switch (noteType) {
      case 'project':
          specificInstructions = `Generate a structured project plan with milestones and timeline.`;
          break;
      case 'notebook':
          specificInstructions = `Organize as a cohesive journal or professional log entry with clear headers.`;
          break;
      case 'code':
          specificInstructions = `Analyze code. Place the actual code strictly in triple backticks.`;
          break;
      default:
          specificInstructions = `Organize thoughts clearly using Markdown. Preserve original structural spacing.`;
          break;
  }

  const prompt = `System: You are an expert note organizer for ${username}. 
Instruction: ${specificInstructions}
Task: Categorize and format the following input text.
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

    incrementUsage();
    logAIUsage(username, "ORGANIZE_NOTE", `Processed ${noteType} note.`);
    return JSON.parse(resultText) as ProcessedNoteData;
  } catch (error: any) {
    console.error("Gemini AI Processing Error:", error);
    logError("AI_PROCESS", error);
    throw new Error(error.message || "AI was unable to process this note.");
  }
};

export const expandNoteContent = async (content: string, username: string) => {
    const apiKey = safeApiKey();
    if (!apiKey) return null;
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Expand on this note: ${content}`,
      });
      incrementUsage();
      return response.text || null;
    } catch (error) {
      logError("AI_EXPAND", error);
      return null;
    }
};

export const runConnectivityTest = async () => {
  const apiKey = safeApiKey();
  const steps = [];
  
  try {
    // Step 1: Env Check
    if (!apiKey) throw new Error("API Key (process.env.API_KEY) is undefined.");
    steps.push({ name: "Environment Discovery", status: "success", detail: "Found Key" });

    // Step 2: Construction
    const ai = new GoogleGenAI({ apiKey });
    steps.push({ name: "SDK Initialization", status: "success" });

    // Step 3: Latency & Handshake
    const start = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with the word "READY"',
    });
    const latency = Date.now() - start;
    
    if (response.text?.toUpperCase().includes("READY")) {
      steps.push({ name: "Gemini Handshake", status: "success", detail: `${latency}ms` });
    } else {
      throw new Error("Handshake failed: Model returned unexpected content.");
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
