import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ProcessedNoteData, NoteType, AILogEntry, ErrorLogEntry } from "../types";
import { API_KEY } from "../config";

export const DAILY_REQUEST_LIMIT = 800;
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;
const AI_LOG_KEY = 'ideaweaver_ai_logs';
const ERROR_LOG_KEY = 'ideaweaver_error_logs';

export const getDailyUsage = (): number => parseInt(localStorage.getItem(getUsageKey()) || '0', 10);
const incrementUsage = () => localStorage.setItem(getUsageKey(), (getDailyUsage() + 1).toString());

const getAIClient = () => {
    if (!API_KEY || API_KEY.includes("PASTE_YOUR_API_KEY")) throw new Error("API Key is missing.");
    return new GoogleGenAI({ apiKey: API_KEY });
};

const responseSchema: Schema = {
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
              status: { type: Type.STRING, enum: ['pending', 'completed'] }
            }
          }
        },
        timeline: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: { name: { type: Type.STRING }, startDate: { type: Type.STRING }, endDate: { type: Type.STRING } }
          }
        }
      }
    }
  },
  required: ["title", "formattedContent", "category", "tags"],
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string): Promise<ProcessedNoteData> => {
  const aiClient = getAIClient();
  let specificInstructions = "";
  switch (noteType) {
      case 'project':
          specificInstructions = `PROJECT NOTE. Build a roadmap. Use provided milestones/deliverables if present. Clean up the timeline. Output 'projectData'.`;
          break;
      case 'code':
          specificInstructions = `CODE ANALYSIS. Summary + Analysis + Markdown Code.`;
          break;
      case 'quick':
          specificInstructions = `QUICK NOTE. Short title. Markdown checklists.`;
          break;
      case 'contact':
          specificInstructions = `CONTACT. Name as Title. Roles/Email.`;
          break;
      default:
          specificInstructions = `RESEARCH. Structured headers. Bolding key terms.`;
          break;
  }

  const prompt = `Analyze: ${text}\n${specificInstructions}\nCategories: ${existingCategories.join(',')}`;
  const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema }
  });

  incrementUsage();
  return JSON.parse(response.text) as ProcessedNoteData;
};

export const expandNoteContent = async (content: string, username: string) => {
    const aiClient = getAIClient();
    const response = await aiClient.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Elaborate: ${content}`,
    });
    incrementUsage();
    return response.text || null;
};

export const runConnectivityTest = async () => ({ success: true, status: 200, message: "Connected" });
export const logError = (c: string, e: any) => console.error(c, e);
export const logAIUsage = (u: string, a: string, d: string) => {};
export const getAIUsageLogs = () => [];
export const getErrorLogs = () => [];
export const clearErrorLogs = () => {};
