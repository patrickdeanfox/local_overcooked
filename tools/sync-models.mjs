#!/usr/bin/env node
// Copies every model that src/art/models.json references from assets/ into public/, with the
// buffers and textures the glTF points at, so dist/ only ships what the game loads.
// Run after editing the manifest or updating a kit:  npm run models
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
const PUBLIC = join(ROOT, 'public');
const MANIFEST = join(ROOT, 'src', 'art', 'models.json');
const GLB_MAGIC = 0x46546c67; // 'glTF'

/** The JSON document of a .gltf or the JSON chunk of a .glb. */
function readGltfJson(path) {
  const bytes = readFileSync(path);
  if (bytes.length >= 12 && bytes.readUInt32LE(0) === GLB_MAGIC) {
    const chunkLength = bytes.readUInt32LE(12);
    return JSON.parse(bytes.subarray(20, 20 + chunkLength).toString('utf8'));
  }
  return JSON.parse(bytes.toString('utf8'));
}

/** Relative file URIs the document references (buffers and images); data URIs are skipped. */
function sidecars(doc) {
  const uris = [];
  for (const entry of [...(doc.buffers ?? []), ...(doc.images ?? [])]) {
    if (entry.uri && !entry.uri.startsWith('data:')) uris.push(decodeURIComponent(entry.uri));
  }
  return uris;
}

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  let files = 0;
  const missing = [];
  for (const [role, spec] of Object.entries(manifest)) {
    if (!spec.src) continue; // generated in place (chef.glb, skins)
    const from = join(ASSETS, spec.src);
    const to = join(PUBLIC, spec.url);
    if (!existsSync(from)) {
      missing.push(`${role}: ${from}`);
      continue;
    }
    copy(from, to);
    files += 1;
    for (const uri of sidecars(readGltfJson(from))) {
      const sideFrom = join(dirname(from), uri);
      const sideTo = join(dirname(to), uri);
      if (!existsSync(sideFrom)) {
        missing.push(`${role}: ${sideFrom}`);
        continue;
      }
      copy(sideFrom, sideTo);
      files += 1;
    }
  }
  console.log(`sync-models: copied ${files} files into ${PUBLIC}`);
  if (missing.length > 0) {
    console.error('sync-models: missing sources:\n  ' + missing.join('\n  '));
    process.exitCode = 1;
  }
}

main();
