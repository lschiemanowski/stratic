import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './helpers.ts';
import { git, head, localDirectory, readJson, snapshot, writeJson } from '../src/git.ts';
import { accept, prepare, ready, recordCheck, results, reviewHistory } from '../src/review.ts';
import { impact } from '../src/impact.ts';
import { loadProject } from '../src/project.ts';

function proposal(root: string, paths: string[], tests = [{ id: 'replacement', outcome: 'pass' as const }]) {
  const tree = snapshot(root, paths), frontier = impact(root, head(root), tree);
  const result = recordCheck(root, { tree, method: 'Inspect replacement fixture', outcome: 'pass', environment: 'Disposable Git repository', evidence: 'Only the selected resource changes; descriptions and links remain valid.', tests });
  const input = { reviewer: 'regression', summary: 'Accept selected replacement', unresolved: [], resultIds: [result.id],
    examined: frontier.frontier.map(f => ({ id: f.id, outcome: 'unchanged' as const, reason: 'Only an unrelated fixture resource changes; the description remains accurate.' })),
    unmapped: frontier.unmapped.map(u => ({ path: u.path, reason: 'Inspected fixture replacement.' })) };
  return { result, input };
}
function replacement(root: string, from: 'directory' | 'symlink' | 'file', to: 'directory' | 'symlink' | 'file') {
  const path = join(root, 'resource');
  const create = (kind: typeof from) => {
    if (kind === 'directory') { mkdirSync(join(path, 'nested'), { recursive: true }); writeFileSync(join(path, 'nested/item'), 'nested content'); }
    else if (kind === 'symlink') symlinkSync('missing-target', path);
    else writeFileSync(path, 'regular content');
  };
  create(from); writeFileSync(join(root, 'unrelated'), 'original');
  git(root, ['add', '-A']); git(root, ['commit', '-qm', 'Replacement baseline']);
  writeFileSync(join(root, 'unrelated'), 'staged'); git(root, ['add', 'unrelated']);
  writeFileSync(join(root, 'unrelated'), 'working');
  rmSync(path, { recursive: true, force: true }); create(to);
}
function completed(root: string, finalTree: string) {
  assert.equal(git(root, ['rev-parse', 'HEAD^{tree}']).trim(), finalTree);
  assert.equal(ready(root), null);
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'unrelated');
  assert.equal(git(root, ['show', ':unrelated']), 'staged');
  assert.equal(readFileSync(join(root, 'unrelated'), 'utf8'), 'working');
  assert.equal(git(root, ['diff', '--name-only']).trim(), 'unrelated');
}
test('Acceptance reconciles directory, symlink and regular-file replacements while preserving unrelated staging', t => {
  for (const [from, to] of [['directory', 'symlink'], ['symlink', 'directory'], ['directory', 'file'], ['file', 'directory']] as const) {
    const root = fixture(t); replacement(root, from, to);
    const { input } = proposal(root, ['resource']);
    const prepared = prepare(root, ['resource'], input);
    accept(root, prepared.id);
    completed(root, prepared.finalTree);
  }
});
test('Recovery finishes directory replacement index reconciliation without another commit', t => {
  const root = fixture(t); replacement(root, 'directory', 'symlink');
  const { input } = proposal(root, ['resource']);
  const prepared = prepare(root, ['resource'], input);
  assert.throws(() => accept(root, prepared.id, { afterCommit: () => { throw new Error('Interrupted after commit'); } }), /Interrupted/);
  const commit = head(root);
  const recovered = accept(root, prepared.id);
  assert.equal(recovered.recovered, true); assert.equal(head(root), commit);
  completed(root, prepared.finalTree);
});
test('Runner test identities remain valid through recording, readiness and acceptance', t => {
  const root = fixture(t); writeFileSync(join(root, 'resource'), 'new content');
  const { input } = proposal(root, ['resource'], [{ id: 'suite/test-case', outcome: 'pass' }]);
  const prepared = prepare(root, ['resource'], input);
  accept(root, prepared.id);
  assert.equal(ready(root), null);
  assert.deepEqual(loadProject(root).issues, []);
  assert.equal(reviewHistory(root)[0].review.results[0].tests[0].id, 'suite/test-case');
});
test('Malformed results cannot be recorded or generate readiness', t => {
  const root = fixture(t); writeFileSync(join(root, 'resource'), 'new content');
  const { input, result } = proposal(root, ['resource']);
  const original = results(root);
  for (const tests of [[{ id: '', outcome: 'pass' }], [{ id: '   ', outcome: 'pass' }], [null], [{ id: 'same', outcome: 'pass' }, { id: 'same', outcome: 'pass' }]]) {
    assert.throws(() => recordCheck(root, { ...result, tests } as any));
    assert.deepEqual(results(root), original);
  }
  // Local check storage may be damaged after recording: validate again before readiness.
  writeJson(join(localDirectory(root), 'checks.json'), [{ ...result, recordedAt: null }]);
  assert.throws(() => prepare(root, ['resource'], input), /Malformed|Invalid/);
  assert.equal(ready(root), null);
  assert.equal(reviewHistory(root).length, 0);
});

function stagedDescendant(root: string) {
  replacement(root, 'file', 'directory');
  const extra = join(root, 'resource/extra');
  writeFileSync(extra, 'staged-only content');
  git(root, ['add', 'resource/extra']);
  rmSync(extra);
  const { input } = proposal(root, ['resource']);
  return prepare(root, ['resource'], input);
}
function descendantPreserved(root: string, finalTree: string) {
  assert.equal(git(root, ['rev-parse', 'HEAD^{tree}']).trim(), finalTree);
  assert.equal(ready(root), null);
  assert.equal(git(root, ['show', ':resource/extra']), 'staged-only content');
  assert.equal(git(root, ['ls-tree', 'HEAD', '--', 'resource/extra']), '');
  assert.equal(git(root, ['diff', '--cached', '--name-only']).trim(), 'resource/extra\nunrelated');
  assert.equal(git(root, ['show', ':unrelated']), 'staged');
  assert.equal(readFileSync(join(root, 'unrelated'), 'utf8'), 'working');
  assert.equal(git(root, ['diff', '--name-only']).trim(), 'resource/extra\nunrelated');
}
test('Acceptance preserves staged-only descendants excluded from a file-to-directory proposal', t => {
  const root = fixture(t), prepared = stagedDescendant(root);
  accept(root, prepared.id);
  descendantPreserved(root, prepared.finalTree);
});
test('Recovery preserves unrelated descendants before and after index reconciliation', t => {
  for (const reconciled of [false, true]) {
    const root = fixture(t), prepared = stagedDescendant(root);
    assert.throws(() => accept(root, prepared.id, { afterCommit: () => {
      if (reconciled) {
        // Model termination after publishing the reconciled index but before clearing readiness.
        const temporary = join(localDirectory(root), 'test-reconciled-index');
        const env = { GIT_INDEX_FILE: temporary };
        const extra = git(root, ['rev-parse', ':resource/extra']).trim();
        const unrelated = git(root, ['rev-parse', ':unrelated']).trim();
        git(root, ['read-tree', prepared.finalTree], undefined, env);
        git(root, ['update-index', '--add', '--cacheinfo', '100644', extra, 'resource/extra'], undefined, env);
        git(root, ['update-index', '--add', '--cacheinfo', '100644', unrelated, 'unrelated'], undefined, env);
        copyFileSync(temporary, git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim());
      }
      throw new Error('Interrupted');
    } }), /Interrupted/);
    const committed = head(root);
    assert.equal(accept(root, prepared.id).recovered, true);
    assert.equal(head(root), committed);
    descendantPreserved(root, prepared.finalTree);
  }
});
test('Acceptance rejects unrelated staged path conflicts before creating a commit', t => {
  for (const ancestor of [false, true]) {
    const root = fixture(t);
    if (ancestor) {
      writeFileSync(join(root, 'resource'), 'staged ancestor');
      git(root, ['add', 'resource']);
      rmSync(join(root, 'resource'));
      mkdirSync(join(root, 'resource'));
      writeFileSync(join(root, 'resource/included'), 'accepted child');
    } else {
      replacement(root, 'directory', 'directory');
      writeFileSync(join(root, 'resource/extra'), 'staged descendant');
      git(root, ['add', 'resource/extra']);
      rmSync(join(root, 'resource'), { recursive: true });
      symlinkSync('missing-target', join(root, 'resource'));
    }
    const paths = ancestor ? ['resource/included'] : ['resource'];
    const { input } = proposal(root, paths), prepared = prepare(root, paths, input);
    const base = head(root), index = readFileSync(join(root, '.git/index'));
    const commits = git(root, ['cat-file', '--batch-all-objects', '--batch-check=%(objecttype) %(objectname)']).split('\n').filter(s => s.startsWith('commit '));
    assert.throws(() => accept(root, prepared.id), /[Ss]taged.*conflict|conflict.*staged/);
    assert.equal(head(root), base);
    assert.deepEqual(readFileSync(join(root, '.git/index')), index);
    assert.equal(ready(root)?.commit, undefined);
    assert.deepEqual(git(root, ['cat-file', '--batch-all-objects', '--batch-check=%(objecttype) %(objectname)']).split('\n').filter(s => s.startsWith('commit ')), commits);
  }
});
