
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
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
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY || ""),
      'process.env.ADMIN_SETUP_PASS': JSON.stringify(env.ADMIN_SETUP_PASS || "")
    }
  };
});
