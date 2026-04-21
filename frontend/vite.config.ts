import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Critical: prevent duplicate React copies in monorepo workspace builds.
    // Without this, hooks fail with "Cannot read properties of null (reading 'useState')".
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: true,
  },
});
