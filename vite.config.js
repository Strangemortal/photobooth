import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative asset resolution for GitHub Pages deployment
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
