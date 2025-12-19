/**
 * Application Configuration
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

// Note: Gemini API Key is now handled directly via process.env.API_KEY in services

// FIREBASE CONFIGURATION
export const FIREBASE_CONFIG = {
  apiKey: getEnvironmentKey('VITE_FIREBASE_API_KEY') || "AIzaSyDXMMFw_NfQr9fcrq6-38BNPcwrvQVCklo",
  authDomain: getEnvironmentKey('VITE_FIREBASE_AUTH_DOMAIN') || "weavernote-eeaff.firebaseapp.com",
  projectId: getEnvironmentKey('VITE_FIREBASE_PROJECT_ID') || "weavernote-eeaff",
  storageBucket: getEnvironmentKey('VITE_FIREBASE_STORAGE_BUCKET') || "weavernote-eeaff.firebasestorage.app",
  messagingSenderId: getEnvironmentKey('VITE_FIREBASE_MESSAGING_SENDER_ID') || "217757941342",
  appId: getEnvironmentKey('VITE_FIREBASE_APP_ID') || "1:217757941342:web:7921402a35a582af3dfecf",
  measurementId: getEnvironmentKey('VITE_FIREBASE_MEASUREMENT_ID') || "G-ZX4TYZENSM" 
};
