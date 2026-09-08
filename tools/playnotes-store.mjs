// Play notes store: bug reports, ideas and notes sent from the in-game reporter (F8).
// Zero dependencies. Used by server.mjs (production) and the Vite dev server plugin.
// Notes append to <dir>/notes.jsonl; screenshots are written next to it as <id>.jpg.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const API_PATH = '/api/playnotes';
export const NOTES_FILE = 'notes.jsonl';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 4000;
const NOTE_TYPES = new Set(['bug', 'idea', 'note']);
const DATA_URL_PREFIX = 'data:image/jpeg;base64,';

/** Validates a client payload and returns a clean note, or null. */
export function sanitizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim().slice(0, MAX_TEXT_CHARS) : '';
  if (!text) return null;
  const type = NOTE_TYPES.has(raw.type) ? raw.type : 'note';
  const id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(raw.id) ? raw.id : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString();
  const context = raw.context && typeof raw.context === 'object' ? raw.context : {};
  const screenshot = typeof raw.screenshot === 'string' && raw.screenshot.startsWith(DATA_URL_PREFIX) ? raw.screenshot : undefined;
  return { id, createdAt, type, text, context, screenshot };
}

/** Appends a sanitized note; writes the screenshot to disk and stores its file name instead. */
export function appendNote(dir, note) {
  mkdirSync(dir, { recursive: true });
  const stored = { id: note.id, createdAt: note.createdAt, type: note.type, text: note.text, context: note.context };
  if (note.screenshot) {
    const file = `${note.id}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(note.screenshot.slice(DATA_URL_PREFIX.length), 'base64'));
    stored.screenshotFile = file;
  }
  appendFileSync(join(dir, NOTES_FILE), JSON.stringify(stored) + '\n');
  return stored;
}

export function listNotes(dir) {
  const file = join(dir, NOTES_FILE);
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

/** Node http handler for GET/POST /api/playnotes. Returns false when the request is not for it. */
export function createPlayNotesHandler(dir) {
  return async function handlePlayNotes(req, res) {
    const path = (req.url || '').split('?')[0];
    if (path !== API_PATH) return false;
    try {
      if (req.method === 'GET') { sendJson(res, 200, listNotes(dir)); return true; }
      if (req.method === 'POST') {
        const note = sanitizeNote(JSON.parse(await readBody(req, MAX_BODY_BYTES)));
        if (!note) { sendJson(res, 400, { error: 'a note needs text' }); return true; }
        const stored = appendNote(dir, note);
        sendJson(res, 201, { id: stored.id, screenshotFile: stored.screenshotFile ?? null });
        return true;
      }
      res.writeHead(405, { Allow: 'GET, POST' }); res.end(); return true;
    } catch (err) {
      sendJson(res, 400, { error: String(err && err.message ? err.message : err) });
      return true;
    }
  };
}
