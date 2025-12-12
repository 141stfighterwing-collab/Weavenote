
/**
 * Application Configuration
 */

// Helper to safely check environment variables (for Vercel/Cloud Run)
const getEnvironmentKey = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
    if (typeof process !== 'undefined' && process.env?.[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return undefined;
};

// 1. GEMINI API KEY
// We check multiple common names to make setup easier and trim whitespace
const findApiKey = () => {
    // Strict requirement: Check process.env.API_KEY first as per Google GenAI SDK guidelines
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
        const envKey = process.env.API_KEY;
        // Basic sanity check to ensure we don't return a stringified 'undefined' or empty string
        if (envKey && envKey.trim() !== '' && envKey !== 'undefined') {
            return envKey;
        }
    }

    const candidates = [
        'API_KEY', // Common container env var
        'VITE_API_KEY',
        'GOOGLE_API_KEY',
        'GEMINI_API_KEY',
        'VITE_GOOGLE_API_KEY',
        'VITE_GEMINI_API_KEY',
        'CLIENT_KEY', 
        'NEXT_PUBLIC_API_KEY'
    ];
    
    for (const key of candidates) {
        const val = getEnvironmentKey(key);
        // Ensure we don't return undefined or a placeholder if a better key exists
        if (val && !val.includes("PASTE_") && !val.includes("your_key") && val !== 'undefined') {
            return val;
        }
    }
    
    // Fallback if nothing found
    return getEnvironmentKey('VITE_API_KEY') || "PASTE_YOUR_GEMINI_API_KEY_HERE";
};

// Sanitize key: remove quotes if user included them, and trim whitespace
let rawKey = findApiKey();
// Ensure rawKey is a string before manipulation
if (!rawKey) rawKey = "";

if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    rawKey = rawKey.slice(1, -1);
}
if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
    rawKey = rawKey.slice(1, -1);
}

export const API_KEY = rawKey.trim();

// 2. FIREBASE CONFIGURATION
// Updated with your provided keys
export const FIREBASE_CONFIG = {
  apiKey: getEnvironmentKey('VITE_FIREBASE_API_KEY') || "AIzaSyDXMMFw_NfQr9fcrq6-38BNPcwrvQVCklo",
  authDomain: getEnvironmentKey('VITE_FIREBASE_AUTH_DOMAIN') || "weavernote-eeaff.firebaseapp.com",
  projectId: getEnvironmentKey('VITE_FIREBASE_PROJECT_ID') || "weavernote-eeaff",
  storageBucket: getEnvironmentKey('VITE_FIREBASE_STORAGE_BUCKET') || "weavernote-eeaff.firebasestorage.app",
  messagingSenderId: getEnvironmentKey('VITE_FIREBASE_MESSAGING_SENDER_ID') || "217757941342",
  appId: getEnvironmentKey('VITE_FIREBASE_APP_ID') || "1:217757941342:web:7921402a35a582af3dfecf",
  measurementId: getEnvironmentKey('VITE_FIREBASE_MEASUREMENT_ID') || "G-ZX4TYZENSM" 
};
