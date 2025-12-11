import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { ProcessedNoteData, NoteType, AILogEntry, ErrorLogEntry } from "../types";
import { API_KEY } from "../config";

// Initialize Gemini Client with key from config
let ai: GoogleGenAI | null = null;

const initAI = () => {
    // Check if key is the placeholder
    if (!API_KEY || API_KEY.includes("PASTE_YOUR_API_KEY_HERE") || API_KEY.includes("your_key_here")) {
        throw new Error("API Key is missing or invalid. Please check your Vercel/Cloud Run Environment Variables.");
    }
    
    // Validate Key Format (Basic check for accidental spaces or short keys)
    if (API_KEY.length < 30 || API_KEY.includes(" ")) {
         throw new Error("API Key seems invalid (contains spaces or too short). Please check for whitespace.");
    }

    if (!ai) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    return ai;
}

// SAFEGUARD: Self-imposed limit to prevent overuse
export const DAILY_REQUEST_LIMIT = 800;

// Helper to manage local usage tracking
const getUsageKey = () => `ideaweaver_usage_${new Date().toISOString().split('T')[0]}`;
const AI_LOG_KEY = 'ideaweaver_ai_logs';
const ERROR_LOG_KEY = 'ideaweaver_error_logs';

export const getDailyUsage = (): number => {
  const key = getUsageKey();
  return parseInt(localStorage.getItem(key) || '0', 10);
};

const incrementUsage = () => {
  const key = getUsageKey();
  const current = getDailyUsage();
  localStorage.setItem(key, (current + 1).toString());
  
  // Cleanup old keys (optional simple cleanup)
  for(let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    if(k && k.startsWith('ideaweaver_usage_') && k !== key) {
        localStorage.removeItem(k);
    }
  }
};

export const logAIUsage = (username: string, action: string, details: string) => {
    try {
        const logsStr = localStorage.getItem(AI_LOG_KEY);
        const logs: AILogEntry[] = logsStr ? JSON.parse(logsStr) : [];
        
        const newEntry: AILogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            username,
            action,
            details
        };

        // Keep last 200 logs
        const updatedLogs = [newEntry, ...logs].slice(0, 200);
        localStorage.setItem(AI_LOG_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
        console.error("Failed to log AI usage", e);
    }
};

export const logError = (context: string, error: any) => {
    try {
        const logsStr = localStorage.getItem(ERROR_LOG_KEY);
        const logs: ErrorLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
        
        const newEntry: ErrorLogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            context,
            message: error?.message || String(error),
            stack: error?.stack
        };

        // Keep last 50 errors
        const updatedLogs = [newEntry, ...logs].slice(0, 50);
        localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
        console.error(`[WeaveNote Error - ${context}]`, error);
    } catch (e) {
        console.error("Failed to log error", e);
    }
};

export const getAIUsageLogs = (): AILogEntry[] => {
    const logsStr = localStorage.getItem(AI_LOG_KEY);
    return logsStr ? JSON.parse(logsStr) : [];
};

export const getErrorLogs = (): ErrorLogEntry[] => {
    const logsStr = localStorage.getItem(ERROR_LOG_KEY);
    return logsStr ? JSON.parse(logsStr) : [];
};

export const clearAIUsageLogs = () => {
    localStorage.removeItem(AI_LOG_KEY);
};

export const clearErrorLogs = () => {
    localStorage.removeItem(ERROR_LOG_KEY);
};

/**
 * DIAGNOSTIC TOOL
 * Runs a raw fetch connection test to debug 403/400 errors without using the SDK.
 */
export const runConnectivityTest = async (): Promise<{ success: boolean; status: number; message: string; details?: any }> => {
    try {
        if (!API_KEY || API_KEY.includes("PASTE")) {
            return { success: false, status: 0, message: "API Key is missing or default placeholder." };
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${API_KEY}`);
        const data = await response.json();

        if (response.ok) {
            return { success: true, status: 200, message: "Connection Successful! API Key is valid and active." };
        } else {
            const errorMsg = data.error?.message || response.statusText;
            let friendlyMessage = `API Error: ${errorMsg}`;

            if (response.status === 403) {
                friendlyMessage = "403 FORBIDDEN: Your API Key is restricted. Check Google AI Studio > API Key > Restrictions.";
            } else if (response.status === 400) {
                friendlyMessage = "400 BAD REQUEST: The API Key format might be invalid.";
            }

            return { 
                success: false, 
                status: response.status, 
                message: friendlyMessage,
                details: data
            };
        }
    } catch (e: any) {
         if (e.name === 'TypeError' && e.message.includes('fetch')) {
             return { success: false, status: 0, message: "Network Blocked. Check Ad Blockers or Firewall.", details: e.message };
         }
        return { success: false, status: 0, message: "Network Error: Could not reach Google servers.", details: e.message };
    }
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A short, catchy title for the note based on the content.",
    },
    formattedContent: {
      type: Type.STRING,
      description: "The main content formatted with Markdown. Bold key terms or headers.",
    },
    category: {
      type: Type.STRING,
      description: "A single general category for this note.",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of 1 to 6 relevant hashtags (strings without the # symbol).",
    },
    projectData: {
      type: Type.OBJECT,
      description: "Specific data for Project type notes. Only populate this if the intent is clearly a project plan.",
      properties: {
        deliverables: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of tangible outputs or deliverables."
        },
        milestones: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "YYYY-MM-DD format if date found, else estimate" },
              label: { type: Type.STRING },
              status: { type: Type.STRING, enum: ['pending', 'completed'] }
            }
          }
        },
        timeline: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                name: { type: Type.STRING, description: "Phase Name" },
                startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
                endDate: { type: Type.STRING, description: "YYYY-MM-DD" }
             }
          },
          description: "High level phases with estimated dates if inferable."
        },
        workflow: {
            type: Type.OBJECT,
            description: "A generated workflow chart nodes and connections.",
            properties: {
                nodes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            label: { type: Type.STRING, description: "Step name" },
                            rule: { type: Type.STRING, description: "Rule or criteria for this step (e.g. 'Approval required')" },
                            status: { type: Type.STRING, enum: ['pending', 'in_progress', 'done'] }
                        }
                    }
                },
                edges: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            source: { type: Type.STRING, description: "Source Node ID" },
                            target: { type: Type.STRING, description: "Target Node ID" }
                        }
                    }
                }
            }
        },
        estimatedDuration: { type: Type.STRING, description: "e.g. '3 weeks' or '2 months'" }
      }
    }
  },
  required: ["title", "formattedContent", "category", "tags"],
};

export const processNoteWithAI = async (
  text: string,
  existingCategories: string[],
  noteType: NoteType,
  username: string
): Promise<ProcessedNoteData> => {
  try {
    const aiClient = initAI();
    const currentUsage = getDailyUsage();
    if (currentUsage >= DAILY_REQUEST_LIMIT) {
        throw new Error(`Daily safeguard limit reached (${DAILY_REQUEST_LIMIT} requests).`);
    }

    let specificInstructions = "";

    switch (noteType) {
        case 'quick':
            specificInstructions = `QUICK NOTE. Short title. Markdown checklists. Broad category.`;
            break;
        case 'project':
            specificInstructions = `PROJECT NOTE. Action Title. Structure content. Extract 'projectData' (deliverables, milestones, timeline, workflow).`;
            break;
        case 'contact':
            specificInstructions = `CONTACT CARD. Name as Title. Extract Role, Email, Phone, Context.`;
            break;
        case 'document':
             specificInstructions = `DOCUMENT SUMMARY. Clean title from filename. Executive Summary. Key Takeaways. Bold Headers. Fix spacing.`;
            break;
        case 'deep':
        default:
            specificInstructions = `DEEP RESEARCH. Descriptive title. Structured sections. Bold key concepts. Specific category.`;
            break;
    }

    const prompt = `
      Analyze the following raw text note.
      ${specificInstructions}
      Important: Bold key terms. Format URLs as [Link](URL).
      
      Raw Content:
      ${text}
      
      Existing Categories: ${existingCategories.join(', ')}
    `;

    if (!aiClient) throw new Error("AI Client not initialized");

    const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
        }
    });

    incrementUsage();
    logAIUsage(username, 'Process Note', noteType);

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response from AI");

    return JSON.parse(resultText) as ProcessedNoteData;

  } catch (error: any) {
    // --- DEEP ERROR ANALYSIS START ---
    let detailedErrorMessage = error.message || String(error);
    const errorString = detailedErrorMessage.toString();

    // Check for "Failed to fetch" (Network/CORS/Blocker)
    if (errorString.includes("Failed to fetch") || errorString.includes("NetworkError") || errorString.includes("TypeError")) {
        console.warn("Primary Request Failed. Running Diagnostic Probe...");
        
        // Probe Google API directly to diagnose the layer of failure
        try {
            const diagUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${API_KEY}`;
            const diagRes = await fetch(diagUrl);
            
            if (diagRes.ok) {
                // Case A: Probe Succeeded, but POST failed. 
                // This usually means the Payload was too large (Timeout) or the specific endpoint had an issue.
                detailedErrorMessage = `Connection Established, but Processing Failed. \n\nPOSSIBLE CAUSES:\n1. The document is too large (Timeout).\n2. The content was flagged by safety filters.\n\nTry splitting the document into smaller parts.`;
            } else {
                 // Case B: Probe Failed with HTTP Status
                 if (diagRes.status === 403) {
                     detailedErrorMessage = `API Key 403 Forbidden. \n\nYOUR KEY IS RESTRICTED.\nYou have set 'HTTP Referrer' restrictions on your API Key in Google AI Studio, but they don't match this website's URL (${window.location.origin}).\n\nFIX: Go to Google AI Studio > API Key > Edit > Set Restrictions to 'None' or add this URL.`;
                 } else if (diagRes.status === 400) {
                     detailedErrorMessage = `API Key 400 Bad Request.\n\nYour API Key format is invalid. Check for extra spaces or missing characters in 'config.ts' or Environment Variables.`;
                 } else if (diagRes.status === 429) {
                     detailedErrorMessage = `API Key 429 Quota Exceeded.\n\nYou have used your free tier allowance for the minute/day.`;
                 } else {
                     detailedErrorMessage = `API Error ${diagRes.status}: ${diagRes.statusText}`;
                 }
            }
        } catch (pingErr) {
            // Case C: Probe Failed Completely (No Network Access)
            detailedErrorMessage = `CRITICAL NETWORK BLOCK.\n\nYour browser refused to connect to Google AI.\n\nCOMMON CAUSES:\n1. Ad Blockers (e.g. uBlock Origin) blocking 'googleapis.com'.\n2. Privacy Extensions (e.g. Privacy Badger).\n3. Corporate Firewall/VPN.\n\nFIX: Disable extensions for this site.`;
        }
    }
    // --- DEEP ERROR ANALYSIS END ---

    logError('processNoteWithAI', { original: error.message, analysis: detailedErrorMessage });

    // Fallback logic for UI consistency, but throw specific error for user feedback
    throw new Error(detailedErrorMessage);
  }
};

export const expandNoteContent = async (content: string, username: string): Promise<string | null> => {
    try {
        const aiClient = initAI();
        if (getDailyUsage() >= DAILY_REQUEST_LIMIT) throw new Error(`Daily limit reached.`);

        const prompt = `Deep Dive Expansion. Elaborate on concepts. Add context. Markdown headers. Key Takeaways list.\n\nContent:\n${content}`;
        if (!aiClient) throw new Error("AI Client not initialized");

        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        incrementUsage();
        logAIUsage(username, 'Deep Dive', 'Content Expansion');
        return response.text || null;
    } catch (error: any) {
        logError('expandNoteContent', error);
        return null;
    }
};
