import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 para o caso de rodar o dev server dentro de container.
    host: true,
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
