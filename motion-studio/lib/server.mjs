// Minimal static server rooted at motion-studio/ so compositions can load
// /lib, /node_modules (gsap, fonts) and /assets with absolute paths.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found: ' + urlPath); return; }

    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const size = fs.statSync(file).size;
    const range = req.headers.range; // <video> needs byte ranges to seek
    if (range) {
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = parseInt(s, 10), end = e ? parseInt(e, 10) : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// Turn a CLI argument (file or folder, relative to cwd or ROOT) into a URL path.
export function compUrlPath(arg) {
  let abs = path.resolve(arg);
  if (!fs.existsSync(abs)) abs = path.resolve(ROOT, arg);
  if (!fs.existsSync(abs)) throw new Error(`Composition not found: ${arg}`);
  if (fs.statSync(abs).isDirectory()) abs = path.join(abs, 'index.html');
  if (!abs.startsWith(ROOT)) throw new Error(`Composition must live inside ${ROOT}`);
  return { abs, urlPath: '/' + path.relative(ROOT, abs).split(path.sep).join('/') };
}
