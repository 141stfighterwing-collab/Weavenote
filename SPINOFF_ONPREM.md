# WeaveNote On-Prem Spinoff Profile

This repository now includes an on-prem profile that runs WeaveNote with **local PostgreSQL + API + frontend only** (no Firebase keys, no Gemini key).

## 1) Keep current WeaveNote pointed to your Firebase project

Use these env vars for your current cloud-connected deployment:

```env
VITE_FIREBASE_API_KEY=AIzaSyDXMMFw_NfQr9fcrq6-38BNPcwrvQVCklo
VITE_FIREBASE_AUTH_DOMAIN=weavernote-eeaff.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=weavernote-eeaff
VITE_FIREBASE_STORAGE_BUCKET=weavernote-eeaff.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=217757941342
VITE_FIREBASE_APP_ID=1:217757941342:web:7921402a35a582af3dfecf
VITE_FIREBASE_MEASUREMENT_ID=G-ZX4TYZENSM
# Optional (Realtime Database)
VITE_FIREBASE_DATABASE_URL=
```

## 2) Spin off a 100% on-prem deployment

Use the override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.onprem.yml up -d --build
```

What this profile does:
- Removes external PostgreSQL port exposure.
- Blanks all Firebase frontend build variables.
- Blanks Gemini API key.

Result: local-only deployment with data stored in your on-prem PostgreSQL volume.
