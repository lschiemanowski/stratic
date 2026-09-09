import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
export interface Job { id: number; text: string; owner: string | null; until: number | null }
interface State { nextId: number; jobs: Job[] }

/** One writer at a time. A successful operation replaces the saved state atomically. */
export function update<T>(path: string, operation: (state: State) => T): T {
  const state: State = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { nextId: 1, jobs: [] };
  const result = operation(state);
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state));
  renameSync(temporary, path);
  return result;
}
