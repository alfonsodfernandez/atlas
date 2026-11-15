import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.ATLAS_BASE_PATH ?? '/atlas/',
  plugins: [react(), tailwindcss()],
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  server: { strictPort: true },
  preview: { strictPort: true },
});
