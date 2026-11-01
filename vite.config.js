import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api calls to the Java backend so the browser sees a single origin (no CORS setup needed in dev).
    proxy: { '/api': 'http://localhost:8080' },
    watch: { ignored: ['**/backend/**'] },
  },
});
