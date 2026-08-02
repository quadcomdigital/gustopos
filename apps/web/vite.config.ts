import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// SECURITY: never inline API keys into the client bundle via define() — they
// ship to every visitor and end up in the built JS. If a server-side key is
// ever needed, proxy it through the API instead.
const apiTarget = process.env.VITE_API_URL || 'http://127.0.0.1:11901';
const webPort = Number(process.env.VITE_WEB_PORT || 11900);
const hmrPort = Number(process.env.VITE_HMR_PORT || webPort);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@gustopos/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['motion'],
          'vendor-charts': ['recharts'],
          'vendor-utils': ['date-fns', 'zod'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : {
              clientPort: hmrPort,
            },
      watch: {
        usePolling: process.env.VITE_USE_POLLING === 'true',
      },
    proxy: {
      '/api': apiTarget,
      '/socket.io': {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
