import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Point directly at TS source so Vite's esbuild transpiles it as ESM.
      // The shared dist is CJS (needed by NestJS) and can't be imported as ESM.
      '@reading-almanac/shared': path.resolve(__dirname, '../shared/src/index.ts')
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000'
    }
  }
});
