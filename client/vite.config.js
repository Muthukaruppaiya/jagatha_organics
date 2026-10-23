import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:4000';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function inside(dir, file) {
  const rel = path.relative(dir, file);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function sendFile(res, file) {
  res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  fs.createReadStream(file).pipe(res);
}

function serveFolders(mounts) {
  function attach(server) {
    for (const [route, dir] of mounts) {
      if (!fs.existsSync(dir)) continue;
      server.middlewares.use(route, (req, res, next) => {
        const relative = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '');
        if (!relative) return next();
        const file = path.resolve(dir, relative);
        if (!inside(dir, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        sendFile(res, file);
      });
    }
  }
  return {
    name: 'serve-reference-media',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [
    react(),
    serveFolders([
      ['/media', path.join(root, 'reference/product-images')],
      ['/banner-images', path.join(root, 'reference/banners')],
      ['/videos', path.join(root, 'reference/videos')],
    ]),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
    },
  },
});
