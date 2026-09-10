import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { Project, CheckResult, Ready } from '../model.ts';
import type { Comparison } from './comparison.ts';
export interface ViewData {
  tree: string; project: Project; checks: (CheckResult & { current: boolean })[]; ready: Ready | null;
  history: { id: string; title: string }[]; dirty: boolean; comparison: Comparison | null;
}
let worker: Worker | undefined, nextId = 0;
const pending = new Map<number, { resolve: (v: ViewData) => void; reject: (e: Error) => void }>();
const cache = new Map<string, { value?: ViewData; loading?: Promise<ViewData>; updated: number; error?: Error }>();
function request(root: string, revision: string): Promise<ViewData> {
  if (!worker) {
    worker = new Worker(join(__dirname, 'view-worker.cjs'));
    worker.on('message', ({ id, value, error }) => {
      const promise = pending.get(id); pending.delete(id);
      if (error) promise?.reject(new Error(error)); else promise?.resolve(value);
    });
    worker.on('error', error => { for (const promise of pending.values()) promise.reject(error); pending.clear(); worker = undefined; cache.clear(); });
  }
  return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); worker!.postMessage({ id, root, revision }); });
}
export async function viewData(root: string, revision: string, fresh = false): Promise<ViewData> {
  const key = JSON.stringify([root, revision]);
  let entry = cache.get(key);
  if (!entry) {
    if (cache.size >= 4) { const oldest = [...cache].find(([, value]) => !value.loading); if (oldest) cache.delete(oldest[0]); }
    entry = { updated: 0 }; cache.set(key, entry);
  }
  if (!entry.loading && (fresh || !entry.value || Date.now() - entry.updated > 2000)) {
    const saved = entry;
    saved.loading = request(root, revision).then(value => { saved.value = value; saved.error = undefined; saved.updated = Date.now(); return value; }).catch(error => { saved.error = error; throw error; }).finally(() => { saved.loading = undefined; });
    // A background failure is surfaced by a fresh request; it must not crash the desktop.
    saved.loading.catch(() => {});
  }
  if (fresh || !entry.value) return entry.loading!;
  if (entry.error) throw new Error('Project refresh failed: ' + entry.error.message);
  return entry.value;
}
export function stopViewWorker() { void worker?.terminate(); worker = undefined; }
