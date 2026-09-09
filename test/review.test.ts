import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fixture, preparedRelease, selected, releaseReview, checkQueue } from './helpers.ts';
import { git, head, snapshot, writeJson, localDirectory, readJson } from '../src/git.ts';
import { accept, prepare, ready, results } from '../src/review.ts';
import { impact } from '../src/impact.ts';
import { addRelease } from '../scripts/queue-example.ts';

function hook(root: string, name: string, text: string) {
  const dir = join(root, '.git/hooks'); mkdirSync(dir, { recursive: true });
  const path = join(dir, name); writeFileSync(path, '#!/bin/sh\n' + text + '\n'); chmodSync(path, 0o755);
}
test('Checks can be recorded before review, and individual outcomes come from execution', t => {
  const root = fixture(t), check = checkQueue(root);
  assert.equal(ready(root), null);
  assert.equal(results(root).length, 1);
  assert.equal(check.tests.length, 2);
  assert.ok(check.evidence.includes('# fail 0'));
});
test('Reviewed baselines support bounded impact; unreviewed baselines require initial examination', t => {
  const root = fixture(t); addRelease(root);
  const initial = impact(root, head(root), snapshot(root, selected(root)));
  assert.equal(initial.reviewedBase, false);
  assert.ok(initial.frontier.some(f => f.id === 'queue'));
  const proposal = prepare(root, selected(root), releaseReview(root)); accept(root, proposal.id);
  const code = join(root, 'src/queue.ts'); writeFileSync(code, readFileSync(code, 'utf8') + '\n');
  const tree = snapshot(root, selected(root));
  const bounded = impact(root, head(root), tree);
  assert.equal(bounded.reviewedBase, true);
  assert.deepEqual(bounded.frontier.map(f => f.id), ['lease-transitions']);
  const expanded = impact(root, head(root), tree, [{ id: 'lease-transitions', outcome: 'revised', reason: 'A transition guarantee changes.' }]);
  assert.ok(expanded.frontier.some(f => f.id === 'job-lifecycle'));
  assert.ok(expanded.frontier.some(f => f.id === 'storage'));
});
test('Preparation rejects missing decisions, false unchanged decisions, and old results', t => {
  const root = fixture(t); addRelease(root);
  const input = releaseReview(root);
  assert.throws(() => prepare(root, selected(root), { ...input, examined: [] }), /decision/);
  assert.throws(() => prepare(root, selected(root), { ...input, examined: input.examined.map(d => d.id === 'commands' ? { ...d, outcome: 'unchanged' } : d) }), /changed but/);
  writeFileSync(join(root, 'src/queue.ts'), readFileSync(join(root, 'src/queue.ts'), 'utf8') + '\n');
  assert.throws(() => prepare(root, selected(root), input), /different content/);
});
test('Acceptance is exact, preserves unrelated staged/unstaged edits, and does not rerun tests', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'unrelated.txt'), 'base\n'); git(root, ['add', 'unrelated.txt']); git(root, ['commit', '-qm', 'Unrelated baseline']);
  const proposal = preparedRelease(root);
  writeFileSync(join(root, 'unrelated.txt'), 'staged\n'); git(root, ['add', 'unrelated.txt']);
  writeFileSync(join(root, 'unrelated.txt'), 'unstaged\n');
  const count = results(root).length;
  const done = accept(root, proposal.id);
  assert.equal(git(root, ['rev-parse', 'HEAD^{tree}']).trim(), proposal.finalTree);
  assert.equal(readFileSync(join(root, 'unrelated.txt'), 'utf8'), 'unstaged\n');
  assert.equal(git(root, ['show', ':unrelated.txt']), 'staged\n');
  assert.equal(git(root, ['show', 'HEAD:unrelated.txt']), 'base\n');
  assert.equal(results(root).length, count);
  assert.equal(ready(root), null);
  assert.equal(git(root, ['diff', '--name-only', '--cached']).trim(), 'unrelated.txt');
  assert.ok(done.acceptanceMs < 5000, `Acceptance took ${done.acceptanceMs} ms`);
});
test('Changed proposals, changed review records, and moved HEAD cannot be accepted', t => {
  const root = fixture(t), proposal = preparedRelease(root), before = head(root);
  const file = join(root, 'src/queue.ts'), content = readFileSync(file, 'utf8');
  writeFileSync(file, content + '\n'); assert.throws(() => accept(root, proposal.id), /changed after review/); assert.equal(head(root), before);
  writeFileSync(file, content);
  const reviewPath = join(root, proposal.reviewPath), review = readFileSync(reviewPath, 'utf8');
  writeFileSync(reviewPath, review + '\n'); assert.throws(() => accept(root, proposal.id), /changed after review/); writeFileSync(reviewPath, review);
  git(root, ['commit', '--allow-empty', '-qm', 'Moved HEAD']); assert.throws(() => accept(root, proposal.id), /HEAD changed/);
});
test('Commit hooks run; failure or hook edits leave the proposal uncommitted', t => {
  const root = fixture(t), proposal = preparedRelease(root), base = head(root);
  hook(root, 'pre-commit', 'exit 1'); assert.throws(() => accept(root, proposal.id)); assert.equal(head(root), base);
  hook(root, 'pre-commit', 'printf "\\n" >> src/queue.ts\ngit add src/queue.ts');
  assert.throws(() => accept(root, proposal.id), /hook changed/); assert.equal(head(root), base);
  assert.ok(ready(root));
});
test('Normal hooks can inspect the proposal and amend only its commit message', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  hook(root, 'pre-commit', 'git diff --cached --name-only | grep src/queue.ts >/dev/null');
  hook(root, 'commit-msg', 'printf "\\nReviewed queue change\\n" >> "$1"');
  const accepted = accept(root, proposal.id);
  assert.equal(head(root), accepted.commit);
  assert.match(git(root, ['log', '-1', '--format=%B']), /Reviewed queue change/);
});
test('An interrupted acceptance recovers without creating another commit', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  assert.throws(() => accept(root, proposal.id, { afterCommit: () => { throw new Error('simulated interruption'); } }), /simulated interruption/);
  const committed = head(root);
  assert.ok(ready(root)?.commit);
  const resumed = accept(root, proposal.id);
  assert.equal(resumed.recovered, true); assert.equal(resumed.commit, committed);
  assert.equal(git(root, ['status', '--porcelain']).trim(), '');
});
test('CLI enforces explicit review identity for commit authorization', t => {
  const root = fixture(t); preparedRelease(root);
  const cli = join(process.cwd(), 'src/cli.ts');
  assert.throws(() => execFileSync(process.execPath, [cli, '--project', root, 'accept'], { stdio: 'pipe' }));
  const state = JSON.parse(execFileSync(process.execPath, [cli, '--project', root, 'ready'], { encoding: 'utf8' }));
  const result = JSON.parse(execFileSync(process.execPath, [cli, '--project', root, 'accept', '--id', state.id], { encoding: 'utf8' }));
  assert.equal(result.commit, head(root));
});

test('A terminated accepting process leaves a recoverable owned lock and one commit', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  const moduleURL = new URL('../src/review.ts', import.meta.url).href;
  const script = `import { accept } from ${JSON.stringify(moduleURL)}; accept(process.argv[1], process.argv[2], { afterCommit: () => process.exit(23) });`;
  assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e', script, root, proposal.id], { stdio: 'pipe' }));
  const commit = head(root); assert.ok(existsSync(join(root, '.git/index.lock')));
  const recovered = accept(root, proposal.id);
  assert.equal(recovered.commit, commit); assert.equal(recovered.recovered, true);
  assert.equal(git(root, ['status', '--porcelain']).trim(), '');
});

test('Unexpected CLI arguments cannot commit a ready proposal', t => {
  const root = fixture(t), proposal = preparedRelease(root), base = head(root);
  assert.throws(() => execFileSync(process.execPath, [join(process.cwd(), 'src/cli.ts'), '--project', root, 'accept', '--id', proposal.id, '--unexpected'], { stdio: 'pipe' }));
  assert.equal(head(root), base);
});

test('Staged deletions are included and acceptance works in a linked Git worktree', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'obsolete.txt'), 'remove me'); git(root, ['add', 'obsolete.txt']); git(root, ['commit', '-qm', 'Add obsolete file']);
  const linked = join(root, '..', 'linked'); git(root, ['worktree', 'add', '-qb', 'linked', linked]);
  assert.notEqual(localDirectory(root), localDirectory(linked));
  git(linked, ['rm', 'obsolete.txt']); addRelease(linked);
  const input = releaseReview(linked), proposal = prepare(linked, selected(linked), input);
  assert.ok(proposal.paths.includes('obsolete.txt'));
  const originalHead = head(root); accept(linked, proposal.id);
  assert.equal(head(root), originalHead);
  assert.equal(git(linked, ['status', '--porcelain']).trim(), '');
  assert.equal(git(linked, ['ls-tree', 'HEAD', '--', 'obsolete.txt']), '');
});

test('Withdrawing a stale handoff keeps edits and results and allows fresh preparation', async t => {
  const { discard } = await import('../src/review.ts');
  const root = fixture(t), proposal = preparedRelease(root);
  const source = readFileSync(join(root, 'src/queue.ts'), 'utf8');
  const count = results(root).length;
  discard(root, proposal.id);
  assert.equal(ready(root), null);
  assert.equal(readFileSync(join(root, 'src/queue.ts'), 'utf8'), source);
  assert.equal(results(root).length, count);
  const next = prepare(root, selected(root), releaseReview(root));
  assert.notEqual(next.id, proposal.id);
});
