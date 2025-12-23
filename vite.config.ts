import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  // Fix: Property 'cwd' does not exist on type 'Process' by casting to any to bypass environment-specific type shadowing
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
      // Bridging the environment variable to process.env.API_KEY as required by the Gemini SDK.
      // This replacement happens at build time.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY)
    }
  };
});