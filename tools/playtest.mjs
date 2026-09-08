#!/usr/bin/env node
// Zero-dependency headless playtest harness over the Chrome DevTools Protocol.
// Drives the game in a headless Chromium with REAL key holds (Input.dispatchKeyEvent) and
// captures screenshots, console output, and evaluated expressions.
//
// Usage:
//   node tools/playtest.mjs [--chrome /path/to/chrome] [--url http://localhost:5173/] [--out shots/] \
//        "cmd; cmd; ..."      (or)   --file script.txt (one command per line, # comments)
// Commands:
//   goto <url>              navigate and wait for load
//   wait <ms>
//   tap <Code>              keydown+keyup (e.g. tap Space, tap KeyC, tap Escape)
//   hold <Code[,Code]> <ms> hold one or more keys together (e.g. hold KeyD,ShiftLeft 800)
//   holduntil <Code[,Code]> <maxMs> <js>   hold keys until the JS expression is truthy (polled every 16 ms) or maxMs
//   until <maxMs> <js>      wait until the JS expression is truthy or maxMs
//   shot <name.png>         screenshot of the viewport into --out
//   eval <js>               evaluate in page (await allowed), print the JSON result
//   logs                    print console messages captured so far, then clear
//   errors                  print page exceptions captured so far (exit code 2 at the end if any)
// Env: CHROME (binary path). Default binary search: Playwright cache, brave-browser, google-chrome, chromium.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ─── Config ─────────────────────────────────────────────────────────────────
const VIEW_W = 1280;
const VIEW_H = 800;
const LOAD_SETTLE_MS = 800;
const TAP_MS = 60;
const DEFAULT_URL = 'http://localhost:5173/';

const KEY_INFO = {
  Space: { key: ' ', vk: 32 }, Enter: { key: 'Enter', vk: 13 }, Escape: { key: 'Escape', vk: 27 },
  ShiftLeft: { key: 'Shift', vk: 16 }, ShiftRight: { key: 'Shift', vk: 16 }, ControlLeft: { key: 'Control', vk: 17 }, ControlRight: { key: 'Control', vk: 17 },
  ArrowUp: { key: 'ArrowUp', vk: 38 }, ArrowDown: { key: 'ArrowDown', vk: 40 }, ArrowLeft: { key: 'ArrowLeft', vk: 37 }, ArrowRight: { key: 'ArrowRight', vk: 39 },
  Backspace: { key: 'Backspace', vk: 8 }, Tab: { key: 'Tab', vk: 9 }, Backquote: { key: '`', vk: 192 },
  F3: { key: 'F3', vk: 114 }, F4: { key: 'F4', vk: 115 },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function keyInfo(code) {
  if (KEY_INFO[code]) return KEY_INFO[code];
  if (/^Key[A-Z]$/.test(code)) return { key: code[3].toLowerCase(), vk: code.charCodeAt(3) };
  if (/^Digit[0-9]$/.test(code)) return { key: code[5], vk: code.charCodeAt(5) };
  throw new Error(`unknown key code ${code}`);
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(homedir(), '.cache', 'ms-playwright');
  const candidates = [];
  if (existsSync(pw)) {
    for (const dir of readdirSafe(pw).sort().reverse()) {
      if (dir.startsWith('chromium-')) candidates.push(join(pw, dir, 'chrome-linux', 'chrome'), join(pw, dir, 'chrome-linux64', 'chrome'));
      if (dir.startsWith('chromium_headless_shell-')) candidates.push(join(pw, dir, 'chrome-linux', 'headless_shell'), join(pw, dir, 'chrome-linux64', 'chrome-headless-shell'));
    }
  }
  candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/brave-browser');
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error('no Chrome binary found; set CHROME=/path/to/chrome');
  return found;
}
function readdirSafe(p) { try { return readdirSync(p); } catch { return []; } }

function parseArgs(argv) {
  const opts = { chrome: '', url: DEFAULT_URL, out: 'playtest-shots', file: '', script: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--chrome') opts.chrome = argv[++i];
    else if (a === '--url') opts.url = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--file') opts.file = argv[++i];
    else opts.script += (opts.script ? ';' : '') + a;
  }
  return opts;
}

function parseScript(text) {
  return text.split(/[\n;]/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
}

// ─── CDP client ─────────────────────────────────────────────────────────────
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = []; this.errors = []; this.loaded = null;
    ws.addEventListener('message', (ev) => this.onMessage(JSON.parse(ev.data)));
  }
  onMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') this.logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (msg.method === 'Runtime.exceptionThrown') this.errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Page.loadEventFired' && this.loaded) this.loaded();
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async key(code, type) {
    const info = keyInfo(code);
    const modifiers = code.startsWith('Shift') ? 8 : code.startsWith('Control') ? 2 : 0;
    await this.send('Input.dispatchKeyEvent', { type, code, key: info.key, windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk, modifiers });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(chrome) {
  const args = ['--headless=new', '--remote-debugging-port=0', `--window-size=${VIEW_W},${VIEW_H}`, '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-first-run', 'about:blank'];
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    proc.stderr.on('data', (d) => { buf += d.toString(); const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    proc.on('exit', (code) => reject(new Error(`chrome exited early (${code}): ${buf}`)));
    setTimeout(() => reject(new Error('timeout waiting for DevTools URL: ' + buf)), 15000);
  });
  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 1, mobile: false });
  return { proc, cdp };
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const commands = parseScript(opts.file ? readFileSync(opts.file, 'utf8') : opts.script);
  if (!commands.length) { console.error('no commands'); process.exit(1); }
  mkdirSync(opts.out, { recursive: true });
  const chrome = opts.chrome || findChrome();
  const { proc, cdp } = await launch(chrome);
  let exitCode = 0;
  try {
    await goto(cdp, opts.url);
    for (const line of commands) {
      const [cmd, ...rest] = line.split(/\s+/);
      const arg = rest.join(' ');
      if (cmd === 'goto') await goto(cdp, arg);
      else if (cmd === 'wait') await sleep(Number(arg));
      else if (cmd === 'tap') { await cdp.key(arg, 'keyDown'); await sleep(TAP_MS); await cdp.key(arg, 'keyUp'); }
      else if (cmd === 'hold') { const [codes, ms] = rest; const list = codes.split(','); for (const c of list) await cdp.key(c, 'keyDown'); await sleep(Number(ms)); for (const c of list) await cdp.key(c, 'keyUp'); }
      else if (cmd === 'holduntil') {
        const [codes, maxMs, ...jsParts] = rest; const list = codes.split(','); const js = jsParts.join(' ');
        for (const c of list) await cdp.key(c, 'keyDown');
        const ok = await waitUntil(cdp, js, Number(maxMs));
        for (const c of list) await cdp.key(c, 'keyUp');
        console.log(`holduntil ${codes} → ${ok ? 'condition met' : 'TIMEOUT'} (${js})`);
      }
      else if (cmd === 'until') { const [maxMs, ...jsParts] = rest; const js = jsParts.join(' '); const ok = await waitUntil(cdp, js, Number(maxMs)); console.log(`until → ${ok ? 'condition met' : 'TIMEOUT'} (${js})`); }
      else if (cmd === 'shot') { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); const p = join(opts.out, arg); writeFileSync(p, Buffer.from(r.data, 'base64')); console.log(`shot ${p}`); }
      else if (cmd === 'eval') { const r = await cdp.send('Runtime.evaluate', { expression: `(async () => (${arg}))()`, awaitPromise: true, returnByValue: true }); console.log(`eval ${arg}\n  → ${JSON.stringify(r.result.value ?? r.result.description ?? null)}`); }
      else if (cmd === 'logs') { console.log(cdp.logs.length ? cdp.logs.join('\n') : '(no console output)'); cdp.logs.length = 0; }
      else if (cmd === 'errors') { console.log(cdp.errors.length ? cdp.errors.join('\n') : '(no page errors)'); }
      else throw new Error(`unknown command: ${line}`);
    }
    if (cdp.errors.length) { console.error(`page errors:\n${cdp.errors.join('\n')}`); exitCode = 2; }
  } catch (err) {
    console.error(err); exitCode = 1;
  } finally {
    proc.kill('SIGKILL');
  }
  process.exit(exitCode);
}

async function waitUntil(cdp, js, maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = await cdp.send('Runtime.evaluate', { expression: `!!(${js})`, returnByValue: true });
    if (r.result.value === true) return true;
    await sleep(16);
  }
  return false;
}

async function goto(cdp, url) {
  const loaded = new Promise((r) => { cdp.loaded = r; });
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(10000)]);
  await sleep(LOAD_SETTLE_MS);
}

main();
