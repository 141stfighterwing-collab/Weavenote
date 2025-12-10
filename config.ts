/**
 * Application Configuration
 * 
 * HOW TO USE:
 * 1. Get a free Gemini API Key from https://aistudio.google.com/
 * 2. Paste it below where it says "PASTE_YOUR_API_KEY_HERE" inside the quotes.
 * 
 * Alternatively, if your environment supports .env files, the app will try to read 
 * process.env.API_KEY or VITE_API_KEY first.
 */

// Helper to safely check environment variables in different bundlers (Vite/Webpack)
const getEnvironmentKey = (): string | undefined => {
  try {
    // Check for standard node process.env (Webpack/CRA)
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      return process.env.API_KEY;
    }
    // Check for Vite specific env vars
    // @ts-ignore - import.meta is a Vite/ESM feature
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore errors if environment objects aren't available
  }
  return undefined;
};

export const API_KEY = getEnvironmentKey() || "AIzaSyCokxb-31h3lirC6M4fRdxMUdBtyDx_9-E";