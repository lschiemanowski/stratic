import { git } from '../git.ts';
import { loadProject } from '../project.ts';
import type { Project, Ready, Review } from '../model.ts';
export interface Comparison {
  base: string; label: string; before: Record<string, string>;
  removed: { title: string; body: string }[];
}
const bases = new Map<string, Project>();
export function comparison(root: string, project: Project, pending: Ready | null, history: { path: string; review: Review }[], tree: string): Comparison | null {
  let base: string | undefined, label = 'Proposed changes';
  const changed = git(root, ['diff', '--name-only', 'HEAD', tree, '--', 'stratic/descriptions']).trim();
  if (project.revision === 'working' && pending) base = pending.base;
  else if (project.revision === 'working' && changed) base = git(root, ['rev-parse', 'HEAD']).trim();
  else {
    for (const { path, review } of [...history].sort((a, b) => String(b.review.recordedAt).localeCompare(String(a.review.recordedAt)))) {
      if (!/^[a-f0-9]{40,64}$/.test(review.base) || !/^[a-f0-9]{40,64}$/.test(review.contentTree)) continue;
      if (git(root, ['diff', '--name-only', review.contentTree, tree]).trim() === path) { base = review.base; label = 'Accepted changes'; break; }
    }
  }
  if (!base) return null;
  const key = JSON.stringify([root, base]);
  let previous = bases.get(key);
  if (!previous) { previous = loadProject(root, base); if (bases.size >= 4) bases.delete(bases.keys().next().value!); bases.set(key, previous); }
  const before: Record<string, string> = Object.create(null);
  for (const d of project.descriptions) {
    const old = previous.descriptions.find(old => old.id === d.id)?.body ?? '';
    if (old !== d.body) before[d.id] = old;
  }
  return { base, label, before, removed: previous.descriptions.filter(d => !project.descriptions.some(next => next.id === d.id)).map(d => ({ title: d.title, body: d.body })) };
}
