import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  },
  base: "/Sistema-Contable-Nuevo/",
  // ✅ Añade estas líneas para asegurarte de que la carpeta 'public' se copie correctamente
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    copyPublicDir: true,
  }
});