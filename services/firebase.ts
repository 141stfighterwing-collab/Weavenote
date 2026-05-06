import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../config';

// Check if config is set before initializing to avoid crash loop on fresh clone
const isConfigured = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes("PASTE_FIREBASE");

const app = isConfigured ? initializeApp(FIREBASE_CONFIG) : undefined;

export const auth = app ? getAuth(app) : undefined;
export const db = app ? getFirestore(app) : undefined;

export const isFirebaseReady = !!app;