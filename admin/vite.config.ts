import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The dashboard is served by the API at /admin (see server/src/app.mjs), so assets live under /admin/.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared'), '@plan': path.resolve(__dirname, '../src/plan') } },
  server: { fs: { allow: ['..'] }, proxy: { '/v1': 'http://localhost:4000', '/files': 'http://localhost:4000' } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
