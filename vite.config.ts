import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all env variables from the environment and .env files
  const env = loadEnv(mode, (process as any).cwd(), '');
  
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
      // Direct replacement of process.env.API_KEY string
      // Using an empty string fallback to prevent 'undefined' string literal issues
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || "")
    }
  };
});