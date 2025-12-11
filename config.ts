
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
export const API_KEY = getEnvironmentKey('VITE_API_KEY') || "PASTE_YOUR_GEMINI_API_KEY_HERE";

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
