import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 3000
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  }
});
