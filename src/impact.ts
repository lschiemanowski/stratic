import { changedPaths, files, git, readSource } from './git.ts';
import { inScope, loadProject } from './project.ts';
import type { Project, ReviewInput } from './model.ts';
import { resolvePassage } from './passages.ts';

export function impact(root: string, base: string, tree: string, decisions: ReviewInput['examined'] = []) {
  const before = loadProject(root, base), after = loadProject(root, tree);
  const paths = changedPaths(root, base, tree);
  const required = new Map<string, Set<string>>();
  const add = (id: string, reason: string) => { if (!required.has(id)) required.set(id, new Set()); required.get(id)!.add(reason); };
  let reviewedBase = false;
  for (const path of files(root, base).filter(p => p.startsWith('stratic/reviews/') && p.endsWith('.json'))) {
    try {
      const review = JSON.parse(readSource(root, path, base));
      if (typeof review.contentTree === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(review.contentTree)) {
        const difference = changedPaths(root, review.contentTree, base);
        if (difference.length === 1 && difference[0] === path) reviewedBase = true;
      }
    } catch { /* No usable review binding for this baseline. */ }
  }
  if (!reviewedBase) for (const p of [before, after]) for (const d of p.descriptions) {
    add(d.id, 'The baseline has no review for this exact content; establish its accuracy before relying on bounded impact.');
  }
  const mappings = new Map<string, { project: Project; owner: string; passage: any }[]>();
  for (const p of [before, after]) {
    for (const d of p.descriptions) {
      if (paths.includes(d.path) || paths.includes(d.path.replace(/\.md$/, '.json'))) add(d.id, 'Description or metadata changed.');
      for (const l of d.metadata?.links ?? []) if ('path' in l.to) {
        const list = mappings.get(l.to.path) ?? []; list.push({ project: p, owner: d.id, passage: l.to.passage }); mappings.set(l.to.path, list);
        if (paths.includes(l.to.path)) add(d.id, `Linked resource changed: ${l.to.path}`);
      }
    }
    for (const t of p.tests) {
      const changed = JSON.stringify(before.tests.find(x => x.id === t.id)) !== JSON.stringify(after.tests.find(x => x.id === t.id));
      for (const v of t.verifies) {
        if (changed || t.code.some(c => paths.includes(c.path))) add(v.description, `Test changed: ${t.name}`);
        for (const c of t.code) {
          const list = mappings.get(c.path) ?? []; list.push({ project: p, owner: v.description, passage: c.passage }); mappings.set(c.path, list);
        }
      }
    }
  }
  if (paths.includes('stratic/project.json')) {
    for (const p of [before, after]) for (const d of p.descriptions.filter(d => d.metadata?.parent === null)) add(d.id, 'Managed project scope changed.');
  }
  // Only a recorded semantic change expands this branch. An unchanged abstraction stops it.
  const expanded = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const [id] of required) {
      if (expanded.has(id) || decisions.find(d => d.id === id)?.outcome !== 'revised') continue;
      expanded.add(id); progress = true;
      for (const p of [before, after]) {
        const parent = p.descriptions.find(d => d.id === id)?.metadata?.parent;
        if (parent) add(parent.description, `Child responsibility changed: ${id}`);
        for (const link of p.descriptions.find(d => d.id === id)?.metadata?.links ?? []) {
          if (link.kind === 'depends-on') add(link.to.description, `A changed responsibility relies on this promise: ${id}`);
        }
        for (const d of p.descriptions) if (d.metadata?.links.some(l => l.kind === 'depends-on' && l.to.description === id)) add(d.id, `Relies on changed responsibility: ${id}`);
      }
    }
  }
  const unmapped: { path: string; reason: string }[] = [];
  for (const path of paths.filter(p => inScope(before, p) || inScope(after, p))) {
    const map = mappings.get(path) ?? [];
    const diff = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--unified=0', '--no-renames', base, tree, '--', path]);
    const hunks = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)];
    let covered = map.length > 0 && hunks.length > 0;
    for (const h of hunks) {
      for (const [p, start, count] of [[before, Number(h[1]), Number(h[2] ?? 1)], [after, Number(h[3]), Number(h[4] ?? 1)]] as const) {
        if (!count) continue;
        const ranges = map.filter(m => m.project === p).flatMap(m => {
          try { return [resolvePassage(readSource(root, path, p.revision), m.passage)]; } catch { return []; }
        });
        for (let line = start; line < start + count; line++) if (!ranges.some(r => r.startLine <= line && r.endLine >= line)) covered = false;
      }
    }
    if (!covered) unmapped.push({ path, reason: map.length ? 'Some changed regions are outside resolved links; inspect and explain them.' : 'No description or test links to this changed resource.' });
  }
  return { paths, reviewedBase, frontier: [...required].map(([id, reasons]) => ({ id, reasons: [...reasons], decision: decisions.find(d => d.id === id) })), unmapped };
}
