/**
 * Application Configuration
 * 
 * HOW TO USE:
 * 1. Get a free Gemini API Key from https://aistudio.google.com/
 * 2. Get Firebase Config from https://console.firebase.google.com/
 * 
 * PASTE YOUR KEYS BELOW.
 */

// Helper to safely check environment variables
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

export const API_KEY = getEnvironmentKey('VITE_API_KEY') || "PASTE_YOUR_GEMINI_API_KEY_HERE";

export const FIREBASE_CONFIG = {
  apiKey: getEnvironmentKey('VITE_FIREBASE_API_KEY') || "PASTE_FIREBASE_API_KEY",
  authDomain: getEnvironmentKey('VITE_FIREBASE_AUTH_DOMAIN') || "your-app.firebaseapp.com",
  projectId: getEnvironmentKey('VITE_FIREBASE_PROJECT_ID') || "your-app-id",
  storageBucket: getEnvironmentKey('VITE_FIREBASE_STORAGE_BUCKET') || "your-app.appspot.com",
  messagingSenderId: getEnvironmentKey('VITE_FIREBASE_MESSAGING_SENDER_ID') || "123456789",
  appId: getEnvironmentKey('VITE_FIREBASE_APP_ID') || "1:123456789:web:abcdef"
};