import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    host: '127.0.0.1',
    // Dev-time leaderboard: `npm start` runs the API on :8091. When it isn't
    // running, the game just falls back to its offline (local-times) mode.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8091', changeOrigin: true },
    },
  },
});
