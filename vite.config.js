import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'studio',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^mathloop$/, replacement: new URL('./src/index.js', import.meta.url).pathname },
      { find: /^mathloop\//, replacement: new URL('./src/', import.meta.url).pathname },
    ],
  },
  server: { port: 5180, host: '127.0.0.1' },
  build: { outDir: '../dist-studio', emptyOutDir: true },
});
