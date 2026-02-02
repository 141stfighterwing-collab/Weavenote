import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load env file from current directory with no prefix required to catch standard API_KEY
  const env = loadEnv(mode, process.cwd(), '');
  
  // Explicitly determine the key to use, prioritizing standard names and trimming any whitespace
  const apiKey = (env.API_KEY || env.VITE_API_KEY || env.VITE_KEY || "").trim();
  const adminPass = (env.ADMIN_SETUP_PASS || "").trim();

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
      // Direct replacement of process.env.API_KEY with the string value
      'process.env.API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_API_KEY': JSON.stringify(apiKey),
      'process.env.VITE_KEY': JSON.stringify(apiKey),
      'process.env.ADMIN_SETUP_PASS': JSON.stringify(adminPass)
    }
  };
});