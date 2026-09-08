#!/usr/bin/env node
// Prints the play notes left from the in-game reporter (F8).
//   npm run notes            readable list from ./playnotes and the desktop launcher's copy
//   npm run notes -- --json  raw JSON array
//   npm run notes -- --dir <path>
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { listNotes } from './playnotes-store.mjs';

const DEFAULT_DIRS = [resolve('playnotes'), join(homedir(), '.local', 'share', 'local-overcooked', 'playnotes')];

const args = process.argv.slice(2);
const json = args.includes('--json');
const dirIndex = args.indexOf('--dir');
const dirs = dirIndex >= 0 ? [resolve(args[dirIndex + 1])] : DEFAULT_DIRS;

const notes = [];
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const note of listNotes(dir)) notes.push({ ...note, dir });
}
notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

if (json) {
  console.log(JSON.stringify(notes, null, 2));
} else if (notes.length === 0) {
  console.log(`No play notes yet (looked in ${dirs.join(', ')}). Press F8 in the game to leave one.`);
} else {
  notes.forEach((n, i) => {
    const c = n.context || {};
    const where = [c.levelId ?? (Array.isArray(c.scenes) ? c.scenes.join('+') : ''), c.seed !== undefined ? `seed ${c.seed}` : '', c.preset ?? '', c.players ? `${c.players}P` : '', c.elapsed !== undefined ? `t=${c.elapsed}s` : '', c.score !== undefined ? `score ${c.score}` : ''].filter(Boolean).join(' · ');
    console.log(`${i + 1}. [${n.type}] ${n.createdAt.replace('T', ' ').slice(0, 16)}  ${where}`);
    console.log(`   ${n.text.replace(/\n/g, '\n   ')}`);
    if (n.screenshotFile) console.log(`   screenshot: ${join(n.dir, n.screenshotFile)}`);
  });
}
