import { parentPort } from 'node:worker_threads';
import { workingSnapshot, git } from '../git.ts';
import { loadProject } from '../project.ts';
import { ready, results, reviewHistory } from '../review.ts';
import type { CheckResult } from '../model.ts';
import { comparison } from './comparison.ts';

function view(root: string, revision: string) {
  const project = loadProject(root, revision);
  const pending = ready(root);
  const tree = revision === 'working' ? workingSnapshot(root) : project.revision;
  const history = reviewHistory(root, project.revision);
  const equivalents = new Set([tree]);
  // Compare actual content, excluding only each review's own newly-added record.
  for (const { path, review } of history) {
    try {
      if (typeof review.base !== 'string' || typeof review.contentTree !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(review.base) || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(review.contentTree)) continue;
      if (git(root, ['diff', '--name-only', review.contentTree, tree]).trim() === path) equivalents.add(review.contentTree);
    } catch { /* An unavailable historical review is not current evidence. */ }
  }
  const checks = new Map<string, CheckResult>();
  for (const result of [...(revision === 'working' ? results(root) : []), ...history.flatMap(h => Array.isArray(h.review.results) ? h.review.results : [])]) {
    if (result && typeof result.id === 'string' && Array.isArray(result.tests)) checks.set(result.id, result);
  }
  const branches = git(root, ['log', '-12', '--format=%H%x09%s']).trim().split('\n').map(line => { const [id, ...title] = line.split('\t'); return { id, title: title.join('\t') }; });
  return { tree, project, comparison: comparison(root, project, pending, history, tree), ready: pending, history: branches,
    dirty: !!git(root, ['status', '--porcelain']).trim(),
    checks: [...checks.values()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).map(r => ({ ...r, current: equivalents.has(r.tree) })) };
}
parentPort!.on('message', ({ id, root, revision }) => {
  try { parentPort!.postMessage({ id, value: view(root, revision) }); }
  catch (e) { parentPort!.postMessage({ id, error: (e as Error).message }); }
});
