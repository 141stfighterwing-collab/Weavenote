import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  define: {
    // This allows process.env.API_KEY to be replaced with the actual environment variable 
    // during the build process, satisfying the @google/genai requirement for client-side code.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || process.env.VITE_API_KEY)
  }
});