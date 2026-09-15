import { copyFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, lstatSync, fstatSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { changedPaths, files, git, head, localDirectory, pathInside, readJson, readSource, snapshot, workingSnapshot, writeJson } from './git.ts';
import { loadProject } from './project.ts';
import { impact } from './impact.ts';
import type { CheckResult, Ready, Review, ReviewInput } from './model.ts';
import { validCheckResult, validReview } from './review-records.ts';
export { reviewHistory } from './review-records.ts';

type Input = ReviewInput & { unmapped?: { path: string; reason: string }[] };
type Prepared = Ready & { commit?: string; branch?: string; indexBefore?: string; indexAfter?: string };
const nonempty = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const safeId = (v: string) => { if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(v)) throw new Error('Invalid record ID.'); return v; };
export function ready(root: string): Prepared | null {
  const p = join(localDirectory(root), 'ready.json');
  return existsSync(p) ? readJson<Prepared>(p) : null;
}
export function results(root: string): CheckResult[] {
  const p = join(localDirectory(root), 'checks.json');
  return existsSync(p) ? readJson<CheckResult[]>(p) : [];
}
export function recordCheck(root: string, input: Omit<CheckResult, 'id' | 'recordedAt'>): CheckResult {
  const result = { ...input, id: randomUUID(), recordedAt: new Date().toISOString() };
  if (!validCheckResult(result)) throw new Error('A check needs a tree, method, environment, evidence, outcome, and unique nonempty test identities with outcomes (or []).');
  if (git(root, ['cat-file', '-t', result.tree]).trim() !== 'tree') throw new Error('Check input must identify an existing Git tree.');
  writeJson(join(localDirectory(root), 'checks.json'), [...results(root), result]);
  return result;
}
export function validateReview(input: Input): void {
  if (!input || !nonempty(input.reviewer) || !nonempty(input.summary) || !Array.isArray(input.examined) ||
      !input.examined.every(d => nonempty(d.id) && ['revised', 'unchanged'].includes(d.outcome) && nonempty(d.reason)) ||
      !Array.isArray(input.unresolved) || !input.unresolved.every(nonempty) || !Array.isArray(input.resultIds) || !input.resultIds.every(nonempty) ||
      (input.unmapped !== undefined && (!Array.isArray(input.unmapped) || !input.unmapped.every(u => nonempty(u.path) && nonempty(u.reason))))) throw new Error('Review needs reviewer, summary, examined decisions with reasons, unresolved[], resultIds[], and optional unmapped explanations.');
  if (new Set(input.examined.map(d => d.id)).size !== input.examined.length) throw new Error('Each examined description needs one final decision.');
  if (input.unresolved.length) throw new Error('Resolve blocking issues before preparing a ready handoff.');
}
export function prepare(root: string, paths: string[], input: Input): Prepared & { preparationMs: number } {
  const start = performance.now(); validateReview(input);
  if (existsSync(git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index.lock']).trim())) throw new Error('A Git operation is active. Finish it before preparing a review.');
  const prior = ready(root);
  if (prior?.commit) throw new Error('An acceptance is pending recovery; run accept before preparing another change.');
  if (!paths.length) throw new Error('Select the proposed files explicitly.');
  const base = head(root), id = prior?.id ?? randomUUID();
  const reviewPath = `stratic/reviews/${safeId(id)}.json`;
  paths = [...new Set(paths)].filter(p => p !== reviewPath);
  if (paths.some(p => p.startsWith('stratic/reviews/'))) throw new Error('Historical reviews are retained unchanged. Select project files, not review records.');
  if (!prior && existsSync(pathInside(root, reviewPath))) throw new Error('Review path already exists.');
  if (prior && readFileSync(pathInside(root, reviewPath), 'utf8') !== readSource(root, reviewPath, prior.finalTree)) throw new Error('The existing review was edited. Preserve or resolve that edit before replacing it.');
  const contentTree = snapshot(root, paths, base);
  paths = changedPaths(root, base, contentTree);
  if (paths.some(p => p.startsWith('stratic/reviews/'))) throw new Error('Historical reviews are retained unchanged. Select project files, not review records.');
  if (!paths.length) throw new Error('The selected files contain no changes.');
  const project = loadProject(root, contentTree);
  if (project.issues.length) throw new Error(`Repair the project before readiness:\n${project.issues.map(i => `${i.path}: ${i.message}`).join('\n')}`);
  const frontier = impact(root, base, contentTree, input.examined);
  for (const item of frontier.frontier) if (!item.decision) throw new Error(`Review still needs a decision for ${item.id}: ${item.reasons.join(' ')}`);
  const old = loadProject(root, base);
  for (const item of input.examined) {
    const before = old.descriptions.find(d => d.id === item.id), after = project.descriptions.find(d => d.id === item.id);
    if (!before && !after) throw new Error(`Unknown examined description: ${item.id}`);
    if (item.outcome === 'unchanged' && (before?.body !== after?.body || JSON.stringify(before?.metadata) !== JSON.stringify(after?.metadata))) throw new Error(`Description changed but was recorded unchanged: ${item.id}`);
  }
  for (const u of frontier.unmapped) if (!input.unmapped?.some(x => x.path === u.path)) throw new Error(`Explain unmapped changed regions in ${u.path} or repair their links.`);
  const checks = input.resultIds.map(id => {
    const r = results(root).find(r => r.id === id);
    if (!r) throw new Error(`Missing recorded result: ${id}`);
    if (!validCheckResult(r)) throw new Error(`Malformed recorded result: ${id}`);
    if (r.tree !== contentTree) throw new Error(`Result ${id} examined different content. Record checks for this exact snapshot.`);
    if (r.outcome !== 'pass' || r.tests.some(t => t.outcome !== 'pass')) throw new Error(`Result ${id} is not a passing check.`);
    return r;
  });
  if (!checks.length) throw new Error('Record at least one appropriate check, including a manual check when automated tests do not apply.');
  const review: Review & { unmapped: Input['unmapped'] } = {
    id, base, contentTree, reviewer: input.reviewer, summary: input.summary, examined: input.examined,
    unresolved: [], results: checks, recordedAt: new Date().toISOString(), unmapped: input.unmapped ?? [],
  };
  if (!validReview(review)) throw new Error('Malformed review record; repair the review or its results before readiness.');
  writeJson(pathInside(root, reviewPath), review);
  const finalTree = snapshot(root, [...paths, reviewPath], base);
  if (head(root) !== base || snapshot(root, paths, base) !== contentTree) throw new Error('Files or HEAD changed during preparation. Prepare again.');
  const state: Prepared = { id, base, contentTree, finalTree, paths, reviewPath, createdAt: new Date().toISOString() };
  writeJson(join(localDirectory(root), 'ready.json'), state);
  return { ...state, preparationMs: performance.now() - start };
}
function branch(root: string): string {
  try { return git(root, ['symbolic-ref', '--quiet', 'HEAD']).trim(); }
  catch { throw new Error('Acceptance currently requires a checked-out branch.'); }
}
function checkUnchanged(root: string, state: Prepared) {
  if (head(root) !== state.base) throw new Error('HEAD changed after review. Prepare the change again.');
  if (snapshot(root, [...state.paths, state.reviewPath], state.base) !== state.finalTree) throw new Error('The proposed files or review changed after review. Prepare again.');
}
function selectedIndexEntries(root: string, affected: string[], env = {}) {
  const paths = new Set(affected);
  return git(root, ['ls-files', '--stage', '-z', '--', ...affected], undefined, env)
    .split('\0').filter(entry => paths.has(entry.slice(entry.indexOf('\t') + 1))).map(entry => entry + '\0').join('');
}
function reconciledIndex(root: string, state: Prepared, directory: string) {
  const actual = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
  const temporary = join(directory, 'reconciled-index');
  const env = { GIT_INDEX_FILE: temporary };
  if (existsSync(actual)) copyFileSync(actual, temporary); else git(root, ['read-tree', state.base], undefined, env);
  const affected = changedPaths(root, state.base, state.finalTree), paths = new Set(affected);
  const indexed = git(root, ['ls-files', '-z'], undefined, env).split('\0').filter(Boolean);
  const unrelated = indexed.filter(path => !paths.has(path));
  const replacements = git(root, ['ls-tree', '-r', '-z', state.finalTree, '--', ...affected]).split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) (?:blob|commit) ([0-9a-f]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error(`Unsupported staged resource: ${entry}`);
    return { mode: match[1], object: match[2], path: match[3] };
  }).filter(entry => paths.has(entry.path));
  for (const entry of replacements) {
    const conflict = unrelated.find(path => path.startsWith(entry.path + '/') || entry.path.startsWith(path + '/'));
    if (conflict) throw new Error(`Unrelated staged path ${conflict} conflicts with accepted path ${entry.path}. Preserve or unstage it before accepting.`);
  }
  // Pathspecs include descendants; only exact changed paths belong to this acceptance.
  const removed = indexed.filter(path => paths.has(path));
  if (removed.length) git(root, ['update-index', '--force-remove', '--', ...removed], undefined, env);
  for (const entry of replacements) {
    git(root, ['update-index', '--add', '--cacheinfo', entry.mode, entry.object, entry.path], undefined, env);
  }
  return temporary;
}
function publishIndex(root: string, temporary: string, indexLock: string) {
  const actual = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
  copyFileSync(temporary, indexLock);
  renameSync(indexLock, actual);
}
/** Commit only the prepared tree. Test callback models interruption after ref update. */
export function accept(root: string, approvedId: string, options: { afterCommit?: () => void } = {}) {
  const start = performance.now(), directory = localDirectory(root), state = ready(root);
  if (!state || state.id !== approvedId) throw new Error('Provide the exact ready review ID to authorize acceptance.');
  const actualIndex = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
  const indexLock = `${actualIndex}.lock`;
  const ownerPath = join(directory, 'index-lock-owner.json');
  if (existsSync(indexLock) && existsSync(ownerPath)) {
    const owner = readJson<{ pid: number; ino: number }>(ownerPath);
    let dead = false;
    try { process.kill(owner.pid, 0); } catch (e) { dead = (e as NodeJS.ErrnoException).code === 'ESRCH'; }
    if (dead && lstatSync(indexLock).ino === owner.ino) { rmSync(indexLock); rmSync(ownerPath); }
  }
  let inode: number;
  const token = randomUUID();
  try {
    const fd = openSync(indexLock, 'wx'); inode = fstatSync(fd).ino; closeSync(fd);
  } catch { throw new Error('Git index is locked by another operation. Retry when it completes.'); }
  writeJson(ownerPath, { pid: process.pid, ino: inode, token });
  try {
    if (state.commit && head(root) === state.commit) {
      if (branch(root) !== state.branch) throw new Error('Return to the branch where acceptance began before recovering.');
      const entries = selectedIndexEntries(root, changedPaths(root, state.base, state.finalTree));
      if (entries !== state.indexBefore && entries !== state.indexAfter) throw new Error('Selected staged files changed after the interruption. Preserve those edits before recovering the index.');
      publishIndex(root, reconciledIndex(root, state, directory), indexLock);
      rmSync(join(directory, 'ready.json'));
      return { commit: state.commit, recovered: true, acceptanceMs: performance.now() - start };
    }
    checkUnchanged(root, state);
    if (git(root, ['ls-files', '--unmerged']).trim()) throw new Error('Resolve the Git merge before acceptance.');
    for (const p of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
      if (existsSync(git(root, ['rev-parse', '--path-format=absolute', '--git-path', p]).trim())) throw new Error('Finish the ongoing Git operation before acceptance.');
    }
    const issues = loadProject(root, state.finalTree).issues;
    if (issues.length) throw new Error(`Structural validation failed: ${issues[0].message}`);
    const currentBranch = branch(root);
    const tempIndex = join(directory, 'accept-index');
    const env = { GIT_INDEX_FILE: tempIndex };
    git(root, ['read-tree', state.finalTree], undefined, env);
    const affected = changedPaths(root, state.base, state.finalTree);
    state.indexBefore = selectedIndexEntries(root, affected);
    state.indexAfter = selectedIndexEntries(root, affected, env);
    const review = JSON.parse(readSource(root, state.reviewPath, state.finalTree)) as Review;
    const messagePath = join(directory, 'commit-message');
    writeFileSync(messagePath, review.summary + '\n');
    const beforeHooks = workingSnapshot(root);
    git(root, ['hook', 'run', '--ignore-missing', 'pre-commit'], undefined, env);
    git(root, ['hook', 'run', '--ignore-missing', 'prepare-commit-msg', '--', messagePath, 'message'], undefined, env);
    git(root, ['hook', 'run', '--ignore-missing', 'commit-msg', '--', messagePath], undefined, env);
    if (git(root, ['write-tree'], undefined, env).trim() !== state.finalTree || workingSnapshot(root) !== beforeHooks) throw new Error('A commit hook changed project content. Inspect the changes and prepare again.');
    checkUnchanged(root, state);
    if (branch(root) !== currentBranch) throw new Error('The active branch changed during acceptance.');
    // Build the user index before creating a commit: conflicts must leave no partial acceptance.
    const reconciled = reconciledIndex(root, state, directory);
    let sign = false;
    try { sign = git(root, ['config', '--bool', 'commit.gpgsign']).trim() === 'true'; } catch { /* unset */ }
    const commit = git(root, ['commit-tree', state.finalTree, '-p', state.base, ...(sign ? ['-S'] : []), '-F', messagePath], undefined, env).trim();
    state.commit = commit; state.branch = currentBranch;
    writeJson(join(directory, 'ready.json'), state);
    git(root, ['update-ref', '-m', `stratic: ${review.summary.split('\n')[0]}`, currentBranch, commit, state.base]);
    options.afterCommit?.();
    publishIndex(root, reconciled, indexLock);
    rmSync(join(directory, 'ready.json'));
    let hookWarning: string | undefined;
    try { git(root, ['hook', 'run', '--ignore-missing', 'post-commit']); } catch (e) { hookWarning = (e as Error).message; }
    return { commit, recovered: false, acceptanceMs: performance.now() - start, ...(hookWarning ? { hookWarning } : {}) };
  } finally {
    if (existsSync(indexLock) && lstatSync(indexLock).ino === inode) rmSync(indexLock);
    if (existsSync(ownerPath) && readJson<{ token: string }>(ownerPath).token === token) rmSync(ownerPath);
  }
}
export function discard(root: string, approvedId: string) {
  const state = ready(root);
  if (!state || state.id !== approvedId) throw new Error('Provide the exact ready review ID.');
  if (state.commit && head(root) === state.commit) throw new Error('The commit already exists. Run accept to complete recovery.');
  if (existsSync(git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index.lock']).trim())) throw new Error('A Git operation is active.');
  const path = pathInside(root, state.reviewPath);
  let removedReview = false;
  if (existsSync(path) && readFileSync(path, 'utf8') === readSource(root, state.reviewPath, state.finalTree) && !git(root, ['ls-tree', 'HEAD', '--', state.reviewPath]).trim()) { rmSync(path); removedReview = true; }
  rmSync(join(localDirectory(root), 'ready.json'));
  return { discarded: state.id, removedReview, message: 'Project edits and recorded checks are retained.' };
}
