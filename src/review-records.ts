import { files, git, readSource, revision, treeWithoutPath } from './git.ts';
import type { CheckResult, Issue, Review } from './model.ts';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const hash = (v: unknown): v is string => typeof v === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v);
const descriptionId = (v: unknown): v is string => id(v) || (typeof v === 'string' &&
  v.startsWith('draft:stratic/descriptions/') && v.endsWith('.md') && !/[\\\0]/.test(v) &&
  v.slice('draft:'.length).split('/').every(part => !!part && part !== '.' && part !== '..' && part.toLowerCase() !== '.git'));
const outcome = (v: unknown) => ['pass', 'fail', 'inconclusive'].includes(v as string);
const date = (v: unknown) => text(v) && Number.isFinite(Date.parse(v));
export function validCheckResult(v: unknown): v is CheckResult {
  return object(v) && id(v.id) && hash(v.tree) && text(v.method) && outcome(v.outcome) && date(v.recordedAt) &&
    text(v.environment) && text(v.evidence) && Array.isArray(v.tests) &&
    v.tests.every((t: unknown) => object(t) && text(t.id) && outcome(t.outcome)) &&
    new Set(v.tests.map((t: { id: string }) => t.id)).size === v.tests.length;
}
export function validReview(v: unknown): v is Review {
  return object(v) && id(v.id) && hash(v.base) && hash(v.contentTree) && date(v.recordedAt) &&
    text(v.reviewer) && text(v.summary) && Array.isArray(v.examined) &&
    v.examined.every((d: unknown) => object(d) && descriptionId(d.id) && ['revised', 'unchanged'].includes(d.outcome) && text(d.reason)) &&
    new Set(v.examined.map((d: { id: string }) => d.id)).size === v.examined.length &&
    Array.isArray(v.unresolved) && v.unresolved.length === 0 && Array.isArray(v.results) && v.results.length > 0 &&
    v.results.every((r: unknown) => validCheckResult(r) && r.tree === v.contentTree && r.outcome === 'pass' && r.tests.every(t => t.outcome === 'pass')) &&
    (v.unmapped === undefined || (Array.isArray(v.unmapped) && v.unmapped.every((u: unknown) => object(u) && text(u.path) && text(u.reason))));
}
export function reviewHistory(root: string, view = 'working', issues: Issue[] = []) {
  return files(root, view).filter(p => p.startsWith('stratic/reviews/') && p.endsWith('.json')).flatMap(path => {
    try {
      const review: unknown = JSON.parse(readSource(root, path, view));
      if (!validReview(review) || path !== `stratic/reviews/${review.id}.json`) throw new Error('Malformed review record: expected a review identity, content hashes, examined decisions, and matching passing results.');
      return [{ path, review }];
    } catch (error) { issues.push({ path, message: (error as Error).message }); return []; }
  });
}

const bindings = new Map<string, boolean>();
/** The final tree differs from reviewed content only by its newly added review. */
export function matchesReviewContent(root: string, tree: string, path: string, review: Review): boolean {
  try { if (!hash(tree)) tree = revision(root, tree); } catch { return false; }
  const key = JSON.stringify([root, tree, path, review.base, review.contentTree]);
  const cached = bindings.get(key);
  if (cached !== undefined) return cached;
  try {
    const added = !git(root, ['ls-tree', review.base, '--', path]).trim() && !!git(root, ['ls-tree', tree, '--', path]).trim();
    const matches = added && treeWithoutPath(root, tree, path) === review.contentTree;
    if (bindings.size >= 256) bindings.delete(bindings.keys().next().value!);
    bindings.set(key, matches);
    return matches;
  } catch { return false; }
}
