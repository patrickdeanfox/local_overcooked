// Zero-dependency static server for the built game (dist/).
// Usage: npm run build && npm start   → prints LAN URLs to open on any device on the network.
//
// Serves http on PORT (8080) and, when a certificate exists or can be created with openssl,
// https on HTTPS_PORT (8443). Browsers block the Gamepad API on plain http from any address
// other than localhost, so gamepads on another device need the https URL. Set NO_HTTPS=1 to
// skip https; set CERT_DIR to use your own server.key / server.crt.
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { ensureCert, lanAddresses } from './tools/make-cert.mjs';

const PORT = Number(process.env.PORT) || 8080;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 8443;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = resolve(process.env.ROOT || 'dist');
const CERT_DIR = resolve(process.env.CERT_DIR || 'certs');
const NO_HTTPS = process.env.NO_HTTPS === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function handle(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500); res.end('Server error');
    console.error(err);
  }
}

function banner(scheme, port) {
  console.log(`${scheme}:`);
  console.log(`  Local:   ${scheme}://localhost:${port}/`);
  for (const ip of lanAddresses()) console.log(`  Network: ${scheme}://${ip}:${port}/`);
}

console.log(`Serving ${ROOT}`);
createServer(handle).listen(PORT, HOST, () => banner('http', PORT));

const certs = NO_HTTPS ? null : ensureCert(CERT_DIR);
if (certs) {
  const options = { key: readFileSync(certs.key), cert: readFileSync(certs.cert) };
  createHttpsServer(options, handle).listen(HTTPS_PORT, HOST, () => {
    banner('https', HTTPS_PORT);
    console.log('Gamepads on another device need the https address (accept the certificate warning once per device).');
  });
} else if (!NO_HTTPS) {
  console.log('No https: install openssl, or place server.key and server.crt in certs/. Plain http from another device is keyboard only (browsers block gamepads there).');
}
