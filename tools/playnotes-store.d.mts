import type { IncomingMessage, ServerResponse } from 'node:http';

export const API_PATH: string;
export const NOTES_FILE: string;

export interface StoredPlayNote {
  id: string;
  createdAt: string;
  type: 'bug' | 'idea' | 'note';
  text: string;
  context: Record<string, unknown>;
  screenshotFile?: string;
}

export function sanitizeNote(raw: unknown): (Omit<StoredPlayNote, 'screenshotFile'> & { screenshot?: string }) | null;
export function appendNote(dir: string, note: ReturnType<typeof sanitizeNote> & object): StoredPlayNote;
export function listNotes(dir: string): StoredPlayNote[];
export function createPlayNotesHandler(dir: string): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
