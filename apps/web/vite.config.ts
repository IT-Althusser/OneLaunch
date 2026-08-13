import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In the development environment, /api is proxied to the backend Express service
// Note: Since local port 3000 is occupied, the backend runs on 3100; once 3000 is freed up, it can be reverted
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
    },
  },
});
