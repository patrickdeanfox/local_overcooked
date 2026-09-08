// Minimal Node typings for the few filesystem helpers the tests use. The project keeps
// @types/node out of its dependencies; add declarations here when a test needs more.
declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function existsSync(path: string): boolean;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
