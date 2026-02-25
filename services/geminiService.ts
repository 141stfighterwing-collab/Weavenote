import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ProcessedNoteData, NoteType } from "../types";
import { incrementUserAIUsage } from "./authService";
import { logTraffic } from "./trafficService";

export const DAILY_REQUEST_LIMIT = 800;

/**
 * Factory for the AI instance. 
 * Ensure process.env.GEMINI_API_KEY is the plain string (AIza...), not a JSON object.
 */
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "" || apiKey === "undefined") {
        throw new Error("GEMINI_API_KEY_MISSING");
    }
    // Validation for common mistake: pasting Service Account JSON
    if (apiKey.trim().startsWith("{")) {
        throw new Error("GEMINI_API_KEY_FORMAT_ERROR: Detected JSON object instead of API Key string.");
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
    let fullTextError: any = null;

    // If it starts with '{', it's likely pure JSON, which is the fastest case for JSON.parse.
    if (text.startsWith('{')) {
        try {
            return JSON.parse(text);
        } catch (e) {
            // If it failed, it might have trailing non-JSON text; fall through to extraction.
            fullTextError = e;
        }
    }

    // Try to extract JSON from the text, handling markdown blocks or preamble/postamble.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = text.substring(start, end + 1);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            // Fall through to the final attempt.
        }
    }

    // Final attempt: throw the original error if we have it, otherwise parse again to throw.
    if (fullTextError) throw fullTextError;
    return JSON.parse(text);
};

export const processNoteWithAI = async (text: string, existingCategories: string[], noteType: NoteType, username: string, userId?: string, onStepUpdate?: (step: string) => void): Promise<ProcessedNoteData> => {
  const models = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const ai = getAI();
      onStepUpdate?.(`Neural Synthesis (${modelName})...`);
      
      const prompt = `Act as an Expert Knowledge Architect.
The input below is a messy copy-paste (possibly containing web artifacts, chat fragments, or technical logs).

Your Job:
1. DISTILL: Extract the core ideas and remove noise (nav-text, ad-text, timestamps, etc).
2. STRUCTURE: Re-format into beautiful, logical Markdown. Use headings, lists, and code blocks as appropriate.
3. TITLE: Create a punchy, accurate title for the distilled content.
4. TAXONOMY: Suggest a logical 'category' and 'tags' (3-5) for organization.
5. ENRICH: If the input contains fragmented action items, structure them as a checklist.

Return a STRICT JSON object with these keys: "title", "formattedContent", "category", "tags".

Input Content:
${text}`;
      
      const response = await ai.models.generateContent({
        model: modelName, 
        contents: prompt,
        config: { 
          responseMimeType: 'application/json'
        }
      });

      const parsed = extractJsonResponse(response.text || "{}") as ProcessedNoteData;
      incrementUsage(userId);
      logTraffic('POST', `gemini/${modelName}`, 200, text.length);
      return parsed;
    } catch (error: any) {
      lastError = error;
      console.warn(`Model ${modelName} failed:`, error);
      logTraffic('POST', `gemini/${modelName}`, 500, text.length);
      // If it's a network error, don't bother retrying with another model
      if (error.message?.includes("PROTOCOL_ERROR") || error.message?.toLowerCase().includes("failed to fetch")) {
          break;
      }
    }
  }

  logError('PROCESS_NOTE', lastError);
  throw lastError;
};

export interface DiagnosticLog {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

export const runConnectivityTest = async () => {
  const logs: DiagnosticLog[] = [];
  const addLog = (message: string, type: DiagnosticLog['type'] = 'info') => logs.push({ timestamp: Date.now(), message, type });

  const apiKey = process.env.GEMINI_API_KEY || "";
  
  addLog("--- NEURAL ENGINE DIAGNOSTICS ---");
  
  if (!apiKey) {
      addLog("CRITICAL: No API Key detected in environment.", "error");
      return { success: false, message: "Key Missing", logs };
  }

  addLog(`Key detected: ${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`, "info");

  if (apiKey.trim().startsWith("{")) {
      addLog("CRITICAL: Detected Service Account JSON instead of API Key string.", "error");
      return { success: false, message: "Credential Type Mismatch", logs };
  }

  try {
    const ai = getAI();
    addLog("Testing handshake with gemini-3-flash-preview...");
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
    addLog(`ENGINE ERROR: ${msg}`, "error");
    
    if (msg.includes("PROTOCOL_ERROR") || msg.toLowerCase().includes("failed to fetch")) {
        addLog("Network Error: The request was blocked or reset by the browser/network layer.", "warn");
        addLog("Check for: Ad-blockers, VPNs, or Firewall settings that might intercept Google API traffic.", "info");
    }
  }

  return { success: false, message: "Handshake Failed", logs };
};

export const getAIUsageLogs = () => JSON.parse(localStorage.getItem('ideaweaver_ai_logs') || '[]');
export const getErrorLogs = () => JSON.parse(localStorage.getItem('ideaweaver_error_logs') || '[]');