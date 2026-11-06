/**
 * Servidor estático mínimo para servir dist/ en las pruebas (similar a Render:
 * /ruta/ → /ruta/index.html y 404.html para lo que no existe).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

export function startStaticServer(dir, port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, path);
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      const body = await readFile(join(dir, '404.html')).catch(() => 'Not found');
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(body);
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// Uso directo: node tests/e2e/static-server.mjs [puerto]
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 4330);
  await startStaticServer(new URL('../../dist/', import.meta.url).pathname, port);
  console.log(`Sirviendo dist/ en http://127.0.0.1:${port}`);
}
