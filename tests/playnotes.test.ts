import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendNote, listNotes, sanitizeNote } from '../tools/playnotes-store.mjs';
import { buildNote, makeNoteId, readQueue, writeQueue } from '../src/game/playnotes';

const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, v); },
  };
}

describe('play notes store', () => {
  it('sanitizes a payload, keeping only known fields', () => {
    const note = sanitizeNote({ id: 'abc123', type: 'bug', text: '  Pan burnt too fast  ', context: { levelId: 'oc1-1-4' }, extra: 1 });
    expect(note).toEqual({ id: 'abc123', createdAt: expect.any(String), type: 'bug', text: 'Pan burnt too fast', context: { levelId: 'oc1-1-4' }, screenshot: undefined });
    expect(sanitizeNote({ text: '   ' })).toBeNull();
    expect(sanitizeNote({ text: 'x', type: 'weird' })?.type).toBe('note');
  });

  it('appends notes to notes.jsonl and writes screenshots next to them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'playnotes-'));
    const a = sanitizeNote({ text: 'first', type: 'idea' });
    const b = sanitizeNote({ text: 'second', type: 'bug', screenshot: TINY_JPEG });
    appendNote(dir, a!);
    const stored = appendNote(dir, b!);
    expect(stored.screenshotFile).toBe(`${b!.id}.jpg`);
    expect(existsSync(join(dir, stored.screenshotFile!))).toBe(true);
    const lines = readFileSync(join(dir, 'notes.jsonl'), 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).not.toContain('base64');
    const notes = listNotes(dir);
    expect(notes.map((n) => n.text)).toEqual(['first', 'second']);
  });

  it('lists nothing from a missing directory', () => {
    expect(listNotes(join(tmpdir(), 'does-not-exist-' + makeNoteId()))).toEqual([]);
  });
});

describe('play notes client helpers', () => {
  it('builds a note with trimmed text and an id', () => {
    const note = buildNote('idea', '  more onions  ', { levelId: 'oc1-1-1' });
    expect(note.text).toBe('more onions');
    expect(note.id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(note.screenshot).toBeUndefined();
  });

  it('round-trips the offline queue and drops junk', () => {
    const storage = fakeStorage();
    expect(readQueue(storage)).toEqual([]);
    const note = buildNote('bug', 'stuck in a counter', {});
    writeQueue(storage, [note]);
    expect(readQueue(storage)).toEqual([note]);
    storage.setItem('local-overcooked.playnotes.v1', '{"not":"an array"}');
    expect(readQueue(storage)).toEqual([]);
    writeQueue(storage, []);
    expect(storage.getItem('local-overcooked.playnotes.v1')).toBeNull();
  });
});
