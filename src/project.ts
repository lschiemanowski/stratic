import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { basename, matchesGlob } from 'node:path';
import type { Connection, Description, DescriptionTarget, Link, Metadata, Passage, Project, SourceTarget, TestRecord } from './model.ts';
import { files, readSource, repository, revision } from './git.ts';
import { isPassage, resolvePassage } from './passages.ts';
import { reviewHistory } from './review-records.ts';

const sourceCaches = new WeakMap<Project, Map<string, string>>();
function projectSource(project: Project, path: string): string {
  let cache = sourceCaches.get(project);
  if (!cache) { cache = new Map(); sourceCaches.set(project, cache); }
  if (!cache.has(path)) cache.set(path, readSource(project.root, path, project.revision));
  return cache.get(path)!;
}

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const descriptionTarget = (v: unknown): v is DescriptionTarget => object(v) && !('path' in v) && id(v.description) && (v.passage === undefined || isPassage(v.passage));
const sourceTarget = (v: unknown): v is SourceTarget => object(v) && !('description' in v) && text(v.path) && isPassage(v.passage);
function metadata(v: unknown): v is Metadata {
  return object(v) && id(v.id) && (v.parent === null || (descriptionTarget(v.parent) && isPassage(v.parent.passage))) &&
    ['implemented', 'partial', 'unimplemented'].includes(v.realization) &&
    (v.summary === undefined || (Array.isArray(v.summary) && v.summary.every(text))) &&
    (v.remaining === undefined || typeof v.remaining === 'string') && Array.isArray(v.links) && v.links.every((l: any) =>
      object(l) && (l.from === null || isPassage(l.from)) &&
      (l.kind === 'implementation' ? sourceTarget(l.to) :
        ['depends-on', 'reference'].includes(l.kind) && descriptionTarget(l.to) && (l.kind !== 'depends-on' || text(l.reason))));
}
function testRecord(v: unknown): v is TestRecord {
  return object(v) && id(v.id) && text(v.name) && text(v.description) &&
    Array.isArray(v.code) && v.code.length > 0 && v.code.every(sourceTarget) &&
    Array.isArray(v.verifies) && v.verifies.length > 0 && v.verifies.every(descriptionTarget);
}
export function loadProject(path: string, ref = 'working'): Project {
  const root = repository(path), view = revision(root, ref);
  const project: Project = { root, revision: view, descriptions: [], tests: [], issues: [] };
  const issue = (path: string, message: string, description?: string) => project.issues.push({ path, message, description });
  const read = (path: string) => projectSource(project, path);
  const json = (path: string) => JSON.parse(read(path));
  try {
    const config = json('stratic/project.json');
    if (!object(config) || config.formatVersion !== 1 || !Array.isArray(config.scope) || !config.scope.length || !config.scope.every(text) ||
        (config.exclusions !== undefined && (!Array.isArray(config.exclusions) || !config.exclusions.every((e: any) => object(e) && text(e.pattern) && text(e.reason))))) {
      throw new Error('Expected formatVersion 1, a nonempty scope array, and exclusions with reasons.');
    }
    project.config = { formatVersion: 1, scope: config.scope, exclusions: config.exclusions ?? [] };
  } catch (e) { issue('stratic/project.json', (e as Error).message); }
  const paths = files(root, view).filter(path => view !== 'working' || existsSync(join(root, path)));
  for (const path of paths.filter(p => p.startsWith('stratic/descriptions/') && p.endsWith('.md'))) {
    let body: string;
    try { body = read(path); } catch (e) { issue(path, (e as Error).message); continue; }
    const dataPath = path.slice(0, -3) + '.json';
    const entry: Description = { id: `draft:${path}`, title: /^#\s+(.+)$/m.exec(body)?.[1] ?? basename(path, '.md'), body, path };
    try {
      const value = json(dataPath);
      if (!metadata(value)) throw new Error('Metadata needs an id, parent, realization, well-formed links, and optional summary bullets containing nonempty text.');
      entry.id = value.id; entry.metadata = value;
    } catch (e) { issue(dataPath, (e as Error).message, entry.id); }
    project.descriptions.push(entry);
  }
  for (const path of paths.filter(p => p.startsWith('stratic/descriptions/') && p.endsWith('.json'))) {
    if (!paths.includes(path.slice(0, -5) + '.md')) issue(path, 'This metadata has no paired Markdown description.');
  }
  for (const path of paths.filter(p => p.startsWith('stratic/tests/') && p.endsWith('.json'))) {
    try {
      const value = json(path);
      if (!testRecord(value)) throw new Error('A test needs an id, name, description, code locations, and verified passages.');
      if (project.tests.some(t => t.id === value.id)) throw new Error(`Duplicate test identity: ${value.id}`);
      project.tests.push(value);
    } catch (e) { issue(path, (e as Error).message); }
  }
  const counts = new Map<string, number>();
  for (const d of project.descriptions) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
  for (const d of project.descriptions) {
    if (counts.get(d.id)! > 1) {
      const original = d.id; d.id = `draft:${d.path}`; d.metadata = undefined;
      issue(d.path, `Duplicate description identity: ${original}`, d.id);
    }
  }
  const roots = project.descriptions.filter(d => d.metadata?.parent === null);
  if (roots.length !== 1) issue('stratic/descriptions', `Expected one root; found ${roots.length}.`);
  for (const d of project.descriptions) {
    const chain = new Set<string>();
    let current: Description | undefined = d;
    while (current?.metadata?.parent) {
      if (chain.has(current.id)) { issue(d.path, 'The parent chain contains a cycle.', d.id); break; }
      chain.add(current.id);
      try { current = getDescription(project, current.metadata.parent.description); }
      catch (e) { issue(d.path, (e as Error).message, d.id); break; }
    }
    if (d.metadata?.parent) {
      try { targetContent(project, d.metadata.parent); } catch (e) { issue(d.path, `Parent passage: ${(e as Error).message}`, d.id); }
    }
    for (const link of d.metadata?.links ?? []) {
      try { if (link.from) resolvePassage(d.body, link.from); targetContent(project, link.to); }
      catch (e) { issue(d.path, (e as Error).message, d.id); }
    }
  }
  for (const t of project.tests) {
    for (const target of [...t.code, ...t.verifies]) {
      try { targetContent(project, target); } catch (e) { issue(`test:${t.id}`, (e as Error).message); }
    }
  }
  reviewHistory(root, view, project.issues);
  return project;
}
export function getDescription(project: Project, id: string): Description {
  const found = project.descriptions.filter(d => d.id === id);
  if (found.length !== 1) throw new Error(found.length ? `Ambiguous description ID: ${id}` : `Missing description: ${id}`);
  return found[0];
}
export function targetContent(project: Project, target: DescriptionTarget | SourceTarget) {
  const description = 'description' in target ? getDescription(project, target.description) : undefined;
  const body = description ? description.body : projectSource(project, (target as SourceTarget).path);
  return { body, range: target.passage ? resolvePassage(body, target.passage) : undefined, description };
}
export function connections(project: Project, id: string): Connection[] {
  const d = getDescription(project, id);
  const result: Connection[] = (d.metadata?.links ?? []).map(l => ({ ...l, label: 'description' in l.to ? getTitle(project, l.to.description) : l.to.path }));
  for (const child of project.descriptions.filter(c => c.metadata?.parent?.description === id)) {
    result.push({ kind: 'elaboration', from: child.metadata!.parent!.passage, to: { description: child.id }, label: child.title });
  }
  for (const c of result) {
    try { if (c.from) c.range = resolvePassage(d.body, c.from); targetContent(project, c.to); }
    catch (e) { c.problem = (e as Error).message; }
  }
  return result;
}
function getTitle(project: Project, id: string) { return project.descriptions.find(d => d.id === id)?.title ?? id; }
export function inspect(project: Project, id: string) {
  const description = getDescription(project, id);
  return { description, connections: connections(project, id),
    parent: description.metadata?.parent ? project.descriptions.find(d => d.id === description.metadata!.parent!.description) : undefined,
    incoming: project.descriptions.flatMap(d => (d.metadata?.links ?? []).filter(l => 'description' in l.to && l.to.description === id).map(l => ({ description: d.id, title: d.title, kind: l.kind, reason: 'reason' in l ? l.reason : undefined }))),
    tests: project.tests.filter(t => t.verifies.some(v => v.description === id)),
    issues: project.issues.filter(i => i.description === id || i.path === description.path),
  };
}
export function inScope(project: Project, path: string): boolean {
  return !!project.config && project.config.scope.some(p => matchesGlob(path, p)) && !project.config.exclusions.some(e => matchesGlob(path, e.pattern));
}
