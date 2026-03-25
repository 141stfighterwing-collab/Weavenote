#!/bin/sh
# Docker entrypoint script to inject runtime environment variables into the SPA
# This allows dynamic configuration without rebuilding the image

# Create runtime config
cat > /usr/share/nginx/html/runtime-config.js << EOF
// Runtime configuration injected at container startup
window.__RUNTIME_CONFIG__ = {
  apiUrl: "${VITE_API_URL:-/api}",
  geminiApiKey: "${GEMINI_API_KEY:-}",
  firebase: {
    apiKey: "${VITE_FIREBASE_API_KEY:-}",
    authDomain: "${VITE_FIREBASE_AUTH_DOMAIN:-}",
    projectId: "${VITE_FIREBASE_PROJECT_ID:-}",
    storageBucket: "${VITE_FIREBASE_STORAGE_BUCKET:-}",
    messagingSenderId: "${VITE_FIREBASE_MESSAGING_SENDER_ID:-}",
    appId: "${VITE_FIREBASE_APP_ID:-}",
    measurementId: "${VITE_FIREBASE_MEASUREMENT_ID:-}",
    databaseURL: "${VITE_FIREBASE_DATABASE_URL:-}"
  }
};
EOF

echo "Runtime configuration injected successfully"
