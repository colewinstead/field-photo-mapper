import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: resolve(import.meta.dirname, 'standalone'),
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'release'),
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'standalone/field-photo-mapper.html')
    }
  },
  worker: {
    format: 'es'
  }
});
