import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';
    return {
      base: '/',
      build: {
        target: 'esnext',
        // Drop console.log in production builds (keeps console.error/console.warn)
        minify: 'esbuild',
        rollupOptions: {
          output: {
            manualChunks: {
              // Vendor chunk splitting for better caching
              react: ['react', 'react-dom', 'react-router-dom'],
              supabase: ['@supabase/supabase-js'],
              recharts: ['recharts'],
              pdf: ['jspdf', 'jspdf-autotable'],
            }
          }
        }
      },
      optimizeDeps: {
        esbuildOptions: {
          target: 'esnext',
        },
      },
      esbuild: {
        target: 'esnext',
        // Drop console.log in production; keep error/warn for monitoring
        ...(isProd ? { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'] } : {}),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
