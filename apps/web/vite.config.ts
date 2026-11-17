import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const base = process.env.ATLAS_BASE_PATH ?? '/atlas/';

export default defineConfig({
  base,
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  server: { strictPort: true },
  preview: { strictPort: true },
});
