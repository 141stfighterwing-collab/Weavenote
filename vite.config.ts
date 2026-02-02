import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load env file from current directory with no prefix required to catch standard API_KEY
  // Fix: Explicitly use imported process to ensure 'cwd' is available in the type definition
  const env = loadEnv(mode, process.cwd(), '');
  
  // Explicitly determine the key to use, prioritizing standard names
  const apiKey = env.API_KEY || env.VITE_API_KEY || env.VITE_KEY || "";
  const adminPass = env.ADMIN_SETUP_PASS || "";

  return {
    plugins: [react()],
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 1000
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    define: {
      // We map multiple variations to process.env.API_KEY to satisfy SDK requirements
      // while being resilient to different deployment platform naming conventions
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_KEY': JSON.stringify(apiKey),
      'process.env.ADMIN_SETUP_PASS': JSON.stringify(adminPass)
    }
  };
});