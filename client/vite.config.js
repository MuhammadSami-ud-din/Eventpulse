import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin proxy: the browser only talks to :5173, so cookies stay
    // first-party and SameSite=Strict works in development.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
