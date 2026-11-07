import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// En desarrollo (npm run dev) el sitio corre en :5173 y le pasa las llamadas
// a /api al servidor que está en :3000. Las imágenes vienen de Supabase Storage.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
});
