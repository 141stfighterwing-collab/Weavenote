

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProcessedNoteData, NoteType, AILogEntry, ErrorLogEntry } from "../types";
import { API_KEY } from "../config";

// Initialize Gemini Client with key from config
// Note: We move initialization inside the function or use a lazy init to safely handle missing keys
let ai: GoogleGenAI | null = null;

const initAI = () => {
    if (!API_KEY || API_KEY.includes("PASTE_YOUR_API_KEY_HERE") || API_KEY.includes("your_key_here")) {
        throw new Error("Missing or Invalid API Key. The app is using the placeholder key. Please check your Vercel/Cloud Run Environment Variables (VITE_API_KEY).");
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
    // 1. Init AI & Validate Key
    const aiClient = initAI();

    // 2. Check Safeguard Limit
    const currentUsage = getDailyUsage();
    if (currentUsage >= DAILY_REQUEST_LIMIT) {
        throw new Error(`Daily safeguard limit reached (${DAILY_REQUEST_LIMIT} requests). This is a safety feature to prevent billing/overuse.`);
    }

    let specificInstructions = "";

    switch (noteType) {
        case 'quick':
            specificInstructions = `
                This is a QUICK NOTE (e.g., Grocery list, Meeting Agenda, Quick Idea).
                1. Keep the title short and functional.
                2. Format the content using Markdown checklists (- [ ] Item) for action items or lists.
                3. Keep it brief.
                4. Categorize broadly (e.g., Personal, Work, To-Do).
            `;
            break;
        case 'project':
            specificInstructions = `
                This is a PROJECT NOTE or INGESTED FILE.
                1. Create a clear, Action-Oriented Title.
                2. Structure the 'formattedContent' logically with sections for context.
                3. **CRITICAL**: Extract structured data into the 'projectData' JSON object:
                   - Identify 'deliverables' (tangible results).
                   - Identify 'milestones' with dates (if no year is given, assume current year).
                   - Identify 'timeline' phases. If exact dates aren't in text, estimate reasonable durations.
                   - **GENERATE WORKFLOW**: Create a logical flowchart (nodes and edges) for the project execution. 
                     - Create 3-6 Nodes representing key steps (e.g., "Drafting", "Review", "Approval", "Launch").
                     - Include specific 'rules' for each node (e.g., "Must pass QA", "Budget < $5k").
                     - Connect them logically in 'edges'.
                4. Categorize by Project Name or Department.
            `;
            break;
        case 'contact':
            specificInstructions = `
                This is a CONTACT CARD.
                1. Title should be the Name of the person or entity.
                2. Structure the content:
                   - **Role/Title**
                   - **Contact Info**: Email, Phone, Socials (use bold labels).
                   - **Context**: Where did we meet? Notes?
                3. Categorize by Organization or Relationship type (e.g., 'Client', 'Friend', 'Vendor').
                4. Tags should include company name, role, etc.
            `;
            break;
        case 'document':
             specificInstructions = `
                This is a DOCUMENT INGESTION (PDF/Text File) or REFERENCE.
                1. **Title**: Derive a clean title from the source filename or main subject (remove extensions like .pdf).
                2. **Clean & Format**: The input text may be raw extraction from a file. 
                   - Fix broken line breaks.
                   - Remove page numbers, headers, or footers that interrupt the flow.
                   - Fix spacing issues.
                3. **Structure**:
                   - **Executive Summary**: A concise 2-3 sentence overview.
                   - **Key Takeaways**: Bulleted list of the most critical points.
                   - **Detailed Content**: Organize the rest of the text with clear **Bold Headers** and paragraphs.
                4. If raw text contains links, format as [Link Text](URL).
                5. Categorize by topic (e.g., 'Finance', 'Legal', 'Technical Specs').
            `;
            break;
        case 'deep':
        default:
            specificInstructions = `
                This is a DEEP RESEARCH/STUDY NOTE.
                1. Create a descriptive title.
                2. Format the content for learning and retention: Use clear bold headers, structured sections, and bold key concepts.
                3. Summarize complex points but keep the depth.
                4. Categorize specifically (e.g., Research, Project X, React Certification).
            `;
            break;
    }

    const prompt = `
      Analyze the following raw text note.
      ${specificInstructions}
      
      Important:
      - If you find any URLs (especially image URLs ending in .jpg, .png, etc), please format them as Markdown links: [Link Text](URL) or just [Image](URL).
      - Bold key terms.
      
      Also generate 1 to 6 short, relevant tags (hashtags) that connect key concepts.
      Try to use one of these existing categories if it fits perfectly: [${existingCategories.join(', ')}]. Otherwise, create a new suitable one.

      Raw Text:
      """
      ${text}
      """
    `;

    const response = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an expert personal knowledge assistant. Your goal is to organize messy thoughts and raw file dumps into structured, colorful digital post-it notes.",
      },
    });

    // 3. Increment Usage & Log
    incrementUsage();
    logAIUsage(username, `Organize: ${noteType}`, `Input length: ${text.length} chars`);

    if (!response.text) {
      throw new Error("No response from AI");
    }

    const data = JSON.parse(response.text) as ProcessedNoteData;
    
    // Fallback ID generation for workflow nodes if AI missed them
    if (data.projectData?.workflow?.nodes) {
        data.projectData.workflow.nodes.forEach((node, idx) => {
            if(!node.id) node.id = `node-${idx}`;
            if(!node.status) node.status = 'pending';
        });
    }

    return data;
  } catch (error: any) {
    // LOG THE ERROR so it can be viewed in settings
    logError("processNoteWithAI", error);
    console.error("Error processing note with AI:", error);
    throw error; // Re-throw to be handled by UI
  }
};

export const expandNoteContent = async (originalContent: string, username: string): Promise<string> => {
    try {
        const aiClient = initAI();
        const prompt = `
            Act as an expert researcher and educational content creator.
            I have a research note with the following content:
            """
            ${originalContent}
            """

            Please perform a "Deep Dive" expansion on this topic. 
            Return the output in Markdown format to be appended to the existing note.
            
            The output must include:
            1. **Deep Dive Analysis**: A deeper explanation of the core concepts found in the note.
            2. **Key Resources**: A list of 3-5 recommended articles, books, or documentation links (you can simulate relevant links if you don't have internet access, label them clearly).
            3. **Audio Overview Script (NotebookLLM Style)**: Write a dialogue script between two hosts (Host A and Host B) summarizing this topic in a podcast style. Make it conversational, engaging, and about 200-300 words.

            Format the output with a horizontal rule (---) at the start to separate it from original content.
        `;

        const response = await aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        incrementUsage();
        logAIUsage(username, "Deep Dive", `Content length: ${originalContent.length} chars`);
        
        return response.text || "";
    } catch (error: any) {
        logError("expandNoteContent", error);
        console.error("Error expanding note:", error);
        throw new Error("Failed to perform Deep Dive.");
    }
}
