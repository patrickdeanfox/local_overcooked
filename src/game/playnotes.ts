// ─── Play notes: bug / idea reporter on every screen ────────────────────────
// F8 (or the corner button) opens a small DOM form over the canvas. A note carries free
// text, a type, automatic context from the active scene and a screenshot, and is POSTed to
// /api/playnotes (server.mjs or the Vite dev plugin) which appends it to playnotes/notes.jsonl.
// If the server is unreachable the note waits in localStorage and is sent with the next one.
import type Phaser from 'phaser';
import { log } from '../log';

// ─── Constants ──────────────────────────────────────────────────────────────
const HOTKEY = 'F8';
const ENDPOINT = '/api/playnotes';
const QUEUE_KEY = 'local-overcooked.playnotes.v1';
const SHOT_W = 640;
const SHOT_H = 400;
const SHOT_QUALITY = 0.7;
const TOAST_MS = 2600;
const MAX_TEXT = 4000;
const RECENT_EVENTS = 20;

export type PlayNoteType = 'bug' | 'idea' | 'note';
export interface PlayNote {
  id: string;
  createdAt: string;
  type: PlayNoteType;
  text: string;
  context: Record<string, unknown>;
  screenshot?: string;
}
export type ContextProvider = () => Record<string, unknown>;

// ─── Module state ───────────────────────────────────────────────────────────
let provider: ContextProvider | null = null;
let isOpen = false;
let ui: ReturnType<typeof buildUi> | null = null;
let gameRef: Phaser.Game | null = null;
let pendingShot: string | undefined;

/** Scenes register what to include in a note's context; the disposer clears it. */
export function setPlayNotesContext(fn: ContextProvider): () => void {
  provider = fn;
  return () => { if (provider === fn) provider = null; };
}

/** True while the reporter is open; scenes pause their simulation and ignore input. */
export function isPlayNotesOpen(): boolean { return isOpen; }

// ─── Pure helpers ───────────────────────────────────────────────────────────
export function makeNoteId(now = Date.now(), rand = Math.random()): string {
  return `${now.toString(36)}-${rand.toString(36).slice(2, 8)}`;
}

export function buildNote(type: PlayNoteType, text: string, context: Record<string, unknown>, screenshot?: string): PlayNote {
  const note: PlayNote = { id: makeNoteId(), createdAt: new Date().toISOString(), type, text: text.trim().slice(0, MAX_TEXT), context };
  if (screenshot) note.screenshot = screenshot;
  return note;
}

export function readQueue(storage: Pick<Storage, 'getItem'>): PlayNote[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PlayNote[]).filter((n) => n && typeof n.text === 'string') : [];
  } catch { return []; }
}

export function writeQueue(storage: Pick<Storage, 'setItem' | 'removeItem'>, queue: PlayNote[]): void {
  try {
    if (queue.length === 0) storage.removeItem(QUEUE_KEY);
    else storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) { log.warn('playnotes: could not persist queue', err); }
}

// ─── Network ────────────────────────────────────────────────────────────────
async function post(note: PlayNote): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) });
    return res.ok;
  } catch { return false; }
}

/** Sends queued notes first, then the new one. Returns how many are still queued. */
async function send(note: PlayNote): Promise<{ sent: boolean; queued: number }> {
  const queue = readQueue(localStorage);
  const remaining: PlayNote[] = [];
  for (const old of queue) if (!(await post(old))) remaining.push(old);
  const sent = remaining.length === 0 && (await post(note));
  if (!sent) remaining.push(note);
  writeQueue(localStorage, remaining);
  return { sent, queued: remaining.length };
}

// ─── Context and screenshot ─────────────────────────────────────────────────
function collectContext(): Record<string, unknown> {
  const scenes = gameRef ? gameRef.scene.getScenes(true).map((s) => s.scene.key) : [];
  return {
    scenes,
    ...(provider ? provider() : {}),
    url: location.href,
    viewport: [window.innerWidth, window.innerHeight],
    userAgent: navigator.userAgent,
  };
}

function takeScreenshot(): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!gameRef) { resolve(undefined); return; }
    try {
      gameRef.renderer.snapshot((image) => {
        try {
          if (!(image instanceof HTMLImageElement)) { resolve(undefined); return; }
          const canvas = document.createElement('canvas');
          canvas.width = SHOT_W;
          canvas.height = SHOT_H;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(undefined); return; }
          ctx.drawImage(image, 0, 0, SHOT_W, SHOT_H);
          resolve(canvas.toDataURL('image/jpeg', SHOT_QUALITY));
        } catch (err) { log.warn('playnotes: screenshot failed', err); resolve(undefined); }
      });
    } catch (err) { log.warn('playnotes: snapshot unavailable', err); resolve(undefined); }
  });
}

// ─── DOM ────────────────────────────────────────────────────────────────────
const STYLE = `
#pn-button{position:fixed;right:12px;bottom:12px;z-index:50;font:13px system-ui,sans-serif;color:#f2e8dc;background:#3a2f28cc;border:1px solid #6b5a4c;border-radius:8px;padding:6px 10px;cursor:pointer;opacity:.75}
#pn-button:hover{opacity:1}
#pn-overlay{position:fixed;inset:0;z-index:60;background:#000a;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#f2e8dc}
#pn-overlay[hidden]{display:none}
#pn-panel{width:min(560px,92vw);background:#241d1a;border:2px solid #6b5a4c;border-radius:12px;padding:16px 18px;box-shadow:0 12px 40px #000c}
#pn-panel h2{margin:0 0 10px;font-size:18px;color:#ffb347}
#pn-types{display:flex;gap:14px;margin-bottom:8px}
#pn-types label{cursor:pointer}
#pn-text{width:100%;box-sizing:border-box;height:120px;resize:vertical;background:#1a1210;color:#f2e8dc;border:1px solid #6b5a4c;border-radius:8px;padding:8px;font:14px system-ui,sans-serif}
#pn-context{margin:8px 0;font:11px/1.4 monospace;color:#9c8f82;white-space:pre-wrap;max-height:88px;overflow:auto}
#pn-row{display:flex;align-items:center;gap:10px;margin-top:8px}
#pn-row .spacer{flex:1}
#pn-panel button{font:14px system-ui,sans-serif;border-radius:8px;padding:7px 14px;border:1px solid #6b5a4c;background:#3a2f28;color:#f2e8dc;cursor:pointer}
#pn-panel button.primary{background:#ffb347;color:#241d1a;border-color:#ffb347}
#pn-status{min-height:18px;margin-top:8px;font-size:12px;color:#9c8f82}
#pn-toast{position:fixed;left:50%;bottom:52px;transform:translateX(-50%);z-index:55;background:#241d1a;color:#f2e8dc;border:1px solid #6b5a4c;border-radius:8px;padding:8px 14px;font:13px system-ui,sans-serif}
#pn-toast[hidden]{display:none}
`;

function buildUi() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'pn-button';
  button.type = 'button';
  button.textContent = `Note (${HOTKEY})`;
  button.title = 'Leave a bug report, idea or play note';

  const overlay = document.createElement('div');
  overlay.id = 'pn-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div id="pn-panel" role="dialog" aria-label="Play note">
      <h2>Play note</h2>
      <div id="pn-types">
        <label><input type="radio" name="pn-type" value="bug" checked> Bug</label>
        <label><input type="radio" name="pn-type" value="idea"> Idea</label>
        <label><input type="radio" name="pn-type" value="note"> Note</label>
      </div>
      <textarea id="pn-text" placeholder="What happened, or what you want. Ctrl+Enter sends, Esc cancels."></textarea>
      <div id="pn-context"></div>
      <div id="pn-row">
        <label><input type="checkbox" id="pn-shot" checked> Include screenshot</label>
        <span class="spacer"></span>
        <button type="button" id="pn-cancel">Cancel</button>
        <button type="button" id="pn-send" class="primary">Send</button>
      </div>
      <div id="pn-status"></div>
    </div>`;

  const toast = document.createElement('div');
  toast.id = 'pn-toast';
  toast.hidden = true;

  document.body.append(button, overlay, toast);
  const q = <T extends Element>(sel: string): T => overlay.querySelector(sel) as T;
  return {
    button, overlay, toast,
    text: q<HTMLTextAreaElement>('#pn-text'),
    context: q<HTMLDivElement>('#pn-context'),
    shot: q<HTMLInputElement>('#pn-shot'),
    send: q<HTMLButtonElement>('#pn-send'),
    cancel: q<HTMLButtonElement>('#pn-cancel'),
    status: q<HTMLDivElement>('#pn-status'),
    type: (): PlayNoteType => (overlay.querySelector<HTMLInputElement>('input[name="pn-type"]:checked')?.value ?? 'note') as PlayNoteType,
  };
}

function showToast(message: string): void {
  if (!ui) return;
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  window.setTimeout(() => { if (ui) ui.toast.hidden = true; }, TOAST_MS);
}

function summarizeContext(context: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ['scenes', 'levelId', 'seed', 'preset', 'players', 'phase', 'elapsed', 'timeLeft', 'score']) {
    if (context[key] !== undefined) parts.push(`${key}: ${JSON.stringify(context[key])}`);
  }
  return parts.join('  ·  ');
}

async function open(): Promise<void> {
  if (!ui || isOpen) return;
  isOpen = true;
  pendingShot = await takeScreenshot();
  const context = collectContext();
  ui.context.textContent = summarizeContext(context);
  ui.status.textContent = readQueue(localStorage).length ? `${readQueue(localStorage).length} earlier note(s) waiting for the server` : '';
  ui.overlay.hidden = false;
  ui.text.value = '';
  ui.text.focus();
}

function close(): void {
  if (!ui) return;
  ui.overlay.hidden = true;
  isOpen = false;
  pendingShot = undefined;
  (document.activeElement as HTMLElement | null)?.blur?.();
}

async function submit(): Promise<void> {
  if (!ui) return;
  const text = ui.text.value.trim();
  if (!text) { ui.status.textContent = 'Write something first.'; return; }
  ui.send.disabled = true;
  const note = buildNote(ui.type(), text, collectContext(), ui.shot.checked ? pendingShot : undefined);
  const result = await send(note);
  ui.send.disabled = false;
  close();
  showToast(result.sent ? 'Note saved. Thanks!' : `Server unreachable: kept in this browser (${result.queued} waiting)`);
  log.info('playnotes:', result.sent ? 'sent' : 'queued', note.id);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === HOTKEY) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (isOpen) close(); else void open();
    return;
  }
  if (!isOpen) return;
  // The form has the keyboard: nothing reaches the game or Phaser while it is open.
  e.stopImmediatePropagation();
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
}

/** Installs the reporter once for the whole game. Call after creating the Phaser.Game. */
export function installPlayNotes(game: Phaser.Game): void {
  if (ui || typeof document === 'undefined') return;
  gameRef = game;
  ui = buildUi();
  ui.button.addEventListener('click', () => { if (isOpen) close(); else void open(); });
  ui.cancel.addEventListener('click', close);
  ui.send.addEventListener('click', () => { void submit(); });
  ui.overlay.addEventListener('click', (e) => { if (e.target === ui?.overlay) close(); });
  // Capture phase so the game's window listeners never see keys typed into the form.
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keypress', (e) => { if (isOpen) e.stopImmediatePropagation(); }, true);
  const queued = readQueue(localStorage).length;
  if (queued) log.info(`playnotes: ${queued} note(s) waiting for the server`);
}

/** Keeps the last few simulation event names for note context. */
export function createEventRing(): { push(type: string): void; list(): string[] } {
  const ring: string[] = [];
  return {
    push(type: string): void { ring.push(type); if (ring.length > RECENT_EVENTS) ring.shift(); },
    list(): string[] { return ring.slice(); },
  };
}
