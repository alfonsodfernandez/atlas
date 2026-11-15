import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const base = process.env.ATLAS_BASE_PATH ?? '/atlas/';
const cesiumBuild = fileURLToPath(
  new URL('../../node_modules/cesium/Build/Cesium', import.meta.url),
);

export default defineConfig({
  base,
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  define: { CESIUM_BASE_URL: JSON.stringify(`${base}cesium/`) },
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map(
        (directory) => ({
          src: `${cesiumBuild}/${directory}`,
          dest: 'cesium',
          // v4 preserves the matched path; omit node_modules/cesium/Build/Cesium.
          rename: { stripBase: 4 },
        }),
      ),
    }),
  ],
  publicDir: fileURLToPath(new URL('../../public', import.meta.url)),
  server: { strictPort: true },
  preview: { strictPort: true },
});
