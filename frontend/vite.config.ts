import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Move Vite cache out of OneDrive-synced folder to avoid EPERM on Windows
  cacheDir: path.resolve(os.tmpdir(), 'vite-cache-rcm-frontend'),
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
  '/api': 'http://localhost:5000',
    },
  },
});
