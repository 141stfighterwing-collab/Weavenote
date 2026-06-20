/**
 * Application Configuration
 */

// Helper to safely check environment variables
export const getEnvironmentKey = (key: string): string | undefined => {
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

// Note: Gemini API Key is now handled directly via process.env.API_KEY in services

// FIREBASE CONFIGURATION
// All keys must be provided via environment variables for security.
export const FIREBASE_CONFIG = {
  apiKey: getEnvironmentKey('VITE_FIREBASE_API_KEY') || "",
  authDomain: getEnvironmentKey('VITE_FIREBASE_AUTH_DOMAIN') || "",
  projectId: getEnvironmentKey('VITE_FIREBASE_PROJECT_ID') || "",
  storageBucket: getEnvironmentKey('VITE_FIREBASE_STORAGE_BUCKET') || "",
  messagingSenderId: getEnvironmentKey('VITE_FIREBASE_MESSAGING_SENDER_ID') || "",
  appId: getEnvironmentKey('VITE_FIREBASE_APP_ID') || "",
  measurementId: getEnvironmentKey('VITE_FIREBASE_MEASUREMENT_ID') || ""
};
