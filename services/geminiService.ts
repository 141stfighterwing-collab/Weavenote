import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";

export const DAILY_REQUEST_LIMIT = 800;
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);
const incrementUsage = () => localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());

const getAIClient = () => {
  // Use process.env.API_KEY directly as required by the guidelines
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { 
      type: Type.STRING,
      description: "A concise and catchy title for the note."
    },
    formattedContent: { 
      type: Type.STRING,
      description: "The note content formatted with clean Markdown, headers, and bullet points."
    },
    category: { 
      type: Type.STRING,
      description: "A single word category for the note (e.g., RESEARCH, TASK, IDEA)."
    },
    tags: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "A list of relevant tags without hashes."
    },
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
              status: { type: Type.STRING } // 'pending' | 'completed'
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
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string): Promise<ProcessedNoteData> => {
  const ai = getAIClient();
  let specificInstructions = "";
  
  switch (noteType) {
      case 'project':
          specificInstructions = `Generate a structured project plan. Identify clear deliverables, milestones, and a rough timeline if dates are mentioned or implied.`;
          break;
      case 'code':
          specificInstructions = `Analyze the code. Provide a summary of what it does, a technical analysis, and the code itself in a formatted Markdown block.`;
          break;
      case 'quick':
          specificInstructions = `Keep the title short. Format as a clean checklist if tasks are detected.`;
          break;
      case 'contact':
          specificInstructions = `Extract contact information. Use the person's name as the title. Highlight emails and roles.`;
          break;
      default:
          specificInstructions = `Organize thoughts into research headers. Bold key concepts.`;
          break;
  }

  const prompt = `System: User is ${username}. 
Context: ${specificInstructions}
Task: Clean up and organize the following input text.
Input: ${text}
Categories available: ${existingCategories.join(', ')}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
        responseMimeType: 'application/json', 
        responseSchema 
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) {
      throw new Error("AI returned an empty response. It might be blocked by safety filters.");
    }

    incrementUsage();
    return JSON.parse(jsonStr) as ProcessedNoteData;
  } catch (error) {
    console.error("Gemini AI Processing Error:", error);
    throw error;
  }
};

export const expandNoteContent = async (content: string, username: string) => {
    const ai = getAIClient();
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `User ${username} wants a deeper analysis/expansion of the following note content: ${content}`,
      });
      incrementUsage();
      return response.text || null;
    } catch (error) {
      console.error("Gemini AI Expansion Error:", error);
      return null;
    }
};

export const runConnectivityTest = async () => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'echo test',
    });
    return { success: !!response.text, status: 200, message: "Connected to Gemini API" };
  } catch (e: any) {
    return { success: false, status: 500, message: e.message || "Failed to connect" };
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
  try {
    return JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
  } catch { return []; }
};

export const getErrorLogs = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');
  } catch { return []; }
};

export const clearErrorLogs = () => localStorage.removeItem('ideaweaver_error_logs');
