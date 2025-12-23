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
  if (!rawText || rawText.trim().length === 0) {
      throw new Error("The document appears to be empty or unreadable.");
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `System: You are an expert Document Reconstruction Engine. 
Your goal is to transform messy, raw extracted text into a professionally formatted document WITHOUT losing details.

TASK:
1. ARTIFACT REMOVAL: Strip all random square boxes like "[]", "[][ ]", "☐", or broken line artifacts. 
2. MAXIMUM RETENTION: Keep every single meaningful detail, fact, date, and description. DO NOT summarize. DO NOT delete paragraphs.
3. HASHTAG PRESERVATION: If you find words starting with # (hashtags), YOU MUST PRESERVE THEM in the text.
4. STRUCTURE: Reconstruct the logical flow using proper Markdown headers (##, ###) and bullet points.
5. FORMATTING: Use ACTUAL newlines for line breaks. DO NOT use the literal string "\\n" or "\\r" in your text content.

INPUT DATA (Raw Extraction):
${rawText.substring(0, 30000)}

Output must be strictly JSON following the schema. Ensure all identified hashtags are also included in the 'tags' array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
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

    let parsed = JSON.parse(resultText) as ProcessedNoteData;
    
    // HEURISTIC: Sometimes the model accidentally escapes newlines as literal strings "\n"
    if (parsed.formattedContent) {
        parsed.formattedContent = parsed.formattedContent
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r');
    }

    incrementUsage(userId);
    return parsed;
  } catch (error: any) {
    console.error("AI Document Cleanup Error:", error);
    if (error.message?.includes('fetch') || error.stack?.includes('fetch')) {
        throw new Error("Network request blocked. Please disable ad-blockers and check your connection.");
    }
    throw error;
  }
};

/**
 * AI Organize handles messy copy-pastes by looking for hidden structure.
 */
export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string): Promise<ProcessedNoteData> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  let specificInstructions = "";
  switch (noteType) {
      case 'project':
          specificInstructions = `Generate a highly structured project plan. Extract clear high-level objectives, specific deliverables, key milestones, and a logical timeline. PRESERVE all #hashtags found in the input.`;
          break;
      case 'notebook':
          specificInstructions = `Organize as a cohesive journal or professional log entry. Unify the voice and use clear headers. PRESERVE all #hashtags found in the input.`;
          break;
      case 'code':
          specificInstructions = `Analyze the script. Place actual code blocks strictly in triple backticks. Keep any #comments or hashtags.`;
          break;
      default:
          specificInstructions = `Cleanup messy unstructured input. Extract core ideas and use Markdown formatting. CRITICAL: Do not remove any hashtags (words starting with #).`;
          break;
  }

  const prompt = `System: You are an expert note organizer for ${username}. 
Instruction: ${specificInstructions}
Task: Categorize and format the following input text into a clean JSON structure. Use real newlines, not \\n strings. 
CRITICAL: If the user has manual hashtags in their text (e.g. #important), DO NOT REMOVE THEM from the content and ensure they are also in the 'tags' array.
Input: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { 
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
                }
              }
            }
          },
          required: ["title", "formattedContent", "category", "tags"],
        } 
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("AI failed to return text.");
    
    let parsed = JSON.parse(resultText) as ProcessedNoteData;
    if (parsed.formattedContent) {
        parsed.formattedContent = parsed.formattedContent.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }

    incrementUsage(userId);
    return parsed;
  } catch (error: any) {
    console.error("Gemini AI Processing Error:", error);
    throw new Error(error.message || "AI was unable to process this note.");
  }
};

export const expandNoteContent = async (content: string, username: string, userId?: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Expand on this note, providing more depth and context: ${content}. Use standard Markdown and real newlines. Preserve all hashtags.`,
      });
      let result = response.text || null;
      if (result) {
          result = result.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      }
      incrementUsage(userId);
      return result;
    } catch (error) {
      return null;
    }
};

export const runConnectivityTest = async () => {
  const steps = [];
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");
    steps.push({ name: "API Credentials Found", status: "success" });

    const ai = new GoogleGenAI({ apiKey });
    const start = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Respond with "Ready"',
    });
    const latency = Date.now() - start;
    
    if (response.text) {
      steps.push({ name: "Gemini Handshake", status: "success", detail: `${latency}ms` });
    } else {
      throw new Error("Handshake failed.");
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