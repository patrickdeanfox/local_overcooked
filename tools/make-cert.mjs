#!/usr/bin/env node
// Self-signed certificate for LAN https. Browsers block the Gamepad API on plain http from any
// address other than localhost, so pads on a second device need the https URL.
// Used by server.mjs on startup and by `npm run cert`. Requires the openssl CLI.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CERT_DAYS = 3650;
const KEY_BITS = 2048;
const COMMON_NAME = 'local-overcooked';

export function certPaths(dir) {
  return { key: join(dir, 'server.key'), cert: join(dir, 'server.crt') };
}

export function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

function opensslAvailable() {
  const probe = spawnSync('openssl', ['version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

/** Returns {key, cert} paths, creating the files when missing. Null when openssl is unavailable. */
export function ensureCert(dir = resolve('certs')) {
  const paths = certPaths(dir);
  if (existsSync(paths.key) && existsSync(paths.cert)) return paths;
  if (!opensslAvailable()) return null;
  mkdirSync(dir, { recursive: true });
  const sans = ['DNS:localhost', 'IP:127.0.0.1', ...lanAddresses().map((ip) => `IP:${ip}`)].join(',');
  const config = join(dir, 'openssl.cnf');
  writeFileSync(config, [
    '[req]', 'distinguished_name = dn', 'x509_extensions = ext', 'prompt = no',
    '[dn]', `CN = ${COMMON_NAME}`,
    '[ext]', `subjectAltName = ${sans}`, 'basicConstraints = CA:FALSE',
    '',
  ].join('\n'));
  const result = spawnSync('openssl', [
    'req', '-x509', '-newkey', `rsa:${KEY_BITS}`, '-nodes', '-sha256',
    '-keyout', paths.key, '-out', paths.cert, '-days', String(CERT_DAYS), '-config', config,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.status !== 0) {
    console.error('openssl failed:', result.stderr?.toString() ?? '');
    return null;
  }
  return paths;
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const paths = ensureCert();
  console.log(paths ? `certificate ready: ${paths.cert}` : 'openssl not found: install it, or place server.key and server.crt in certs/');
  process.exit(paths ? 0 : 1);
}
