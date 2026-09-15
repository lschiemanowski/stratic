import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fixture, preparedRelease, selected } from './helpers.ts';
import { addRelease } from '../scripts/queue-example.ts';
import { files, git, head, localDirectory, writeJson } from '../src/git.ts';
import type { Connection, Description, Ready, ReviewInput, CheckResult } from '../src/model.ts';

const executable = resolve('src/cli.ts');
function command(root: string, args: string[], status = 0) {
  const result = spawnSync(process.execPath, [executable, '--project', root, ...args], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error);
  assert.equal(result.status, status, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  if (status === 0) { assert.equal(result.stderr, ''); return JSON.parse(result.stdout); }
  if (args[0] === 'validate') {
    assert.equal(result.stderr, ''); const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false); assert.ok(report.issues.length); return report;
  }
  assert.equal(result.stdout, '', 'Rejected commands must not also print a successful response.');
  const error = JSON.parse(result.stderr); assert.equal(typeof error.error, 'string'); assert.ok(error.error.length); return error;
}
function durableState(root: string) {
  const hash = (path: string) => existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
  const local = localDirectory(root);
  return {
    head: head(root), history: git(root, ['log', '--format=%H']),
    status: git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
    index: hash(git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim()),
    files: files(root).map(path => [path, hash(join(root, path))]),
    local: readdirSync(local).sort().map(path => [path, hash(join(local, path))]),
  };
}

test('CLI reads working and historical descriptions, source, and structural problems', t => {
  const root = fixture(t), base = head(root);
  const oldSource = readFileSync(join(root, 'src/queue.ts'), 'utf8');
  addRelease(root);
  const listing = command(root, ['list']);
  assert.equal(listing.project, realpathSync(root)); assert.equal(listing.revision, 'working'); assert.deepEqual(listing.issues, []);
  assert.ok(listing.descriptions.some((d: Description) => d.id === 'lease-transitions'));
  assert.ok(listing.descriptions.every((d: Description) => !('body' in d)));
  const detail = command(root, ['show', 'lease-transitions']);
  assert.equal(detail.description.id, 'lease-transitions'); assert.equal(detail.parent.id, 'job-lifecycle');
  assert.match(detail.description.body, /Release locates/);
  const link: Connection = detail.connections.find((c: Connection) => 'path' in c.to && c.to.passage.quote.startsWith('export function release'));
  assert.ok(link.range); assert.equal(detail.description.body.slice(link.range.start, link.range.end), link.from!.quote);
  assert.ok('path' in link.to);
  const source = command(root, ['source', link.to.path]);
  assert.equal(source.content, readFileSync(join(root, link.to.path), 'utf8')); assert.ok(source.content.includes(link.to.passage.quote));
  assert.equal(source.path, link.to.path); assert.equal(source.revision, 'working');
  const lifecycle = command(root, ['show', 'job-lifecycle']);
  assert.equal(lifecycle.tests.length, 4); assert.ok(lifecycle.incoming.some((c: { description: string }) => c.description === 'commands'));
  assert.ok(lifecycle.connections.some((c: Connection) => c.kind === 'elaboration' && 'description' in c.to && c.to.description === 'lease-transitions'));
  assert.deepEqual(command(root, ['validate']), { valid: true, issues: [] });
  assert.equal(command(root, ['source', 'src/queue.ts', '--revision', base]).content, oldSource);
  assert.doesNotMatch(command(root, ['show', 'lease-transitions', '--revision', base]).description.body, /Release locates/);
  assert.equal(command(root, ['list', '--revision', base]).revision, git(root, ['rev-parse', `${base}^{tree}`]).trim());
  for (const args of [['show', 'absent'], ['show'], ['source', 'missing.ts'], ['source'], ['source', '../secret'], ['show', 'queue', '--revision', 'missing-ref']]) command(root, args, 1);
  const metadataPath = join(root, 'stratic/descriptions/lease-transitions.json'), metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  metadata.links[0].to.passage.quote = 'This source passage does not exist.'; writeJson(metadataPath, metadata);
  assert.match(command(root, ['show', 'lease-transitions']).connections[0].problem, /no longer exists/);
  const invalid = command(root, ['validate'], 1); // Validation failures are structured results, checked below.
  assert.equal(invalid.valid, false);
  writeFileSync(metadataPath, '{ broken');
  const draft = command(root, ['list']);
  assert.ok(draft.issues.length); assert.ok(draft.descriptions.some((d: Description) => d.title === 'Lease transitions'));
  assert.deepEqual(command(root, ['validate', '--revision', base]), { valid: true, issues: [] });
});

test('CLI snapshots, records evidence, prepares, withdraws, and accepts an exact change', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'unrelated.txt'), 'base\n'); git(root, ['add', 'unrelated.txt']); git(root, ['commit', '-qm', 'Unrelated baseline']);
  const base = head(root); addRelease(root);
  writeFileSync(join(root, 'unrelated.txt'), 'staged\n'); git(root, ['add', 'unrelated.txt']); writeFileSync(join(root, 'unrelated.txt'), 'working\n');
  const paths = selected(root).filter(path => path !== 'unrelated.txt');
  const before = durableState(root), capture = command(root, ['snapshot', '--paths', ...paths]);
  assert.equal(capture.base, base); assert.deepEqual(capture.paths, paths); assert.deepEqual(durableState(root), before);
  assert.equal(git(root, ['show', `${capture.tree}:unrelated.txt`]), 'base\n');
  const all = command(root, ['snapshot']);
  assert.ok(all.paths.includes('unrelated.txt')); assert.equal(git(root, ['show', `${all.tree}:unrelated.txt`]), 'working\n');
  assert.deepEqual(durableState(root), before);
  assert.equal(command(root, ['ready']), null); assert.deepEqual(command(root, ['check', 'list']), []);
  const environment = { ...process.env }; delete environment.NODE_TEST_CONTEXT;
  const evidence = execFileSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/queue.test.ts'], { cwd: root, encoding: 'utf8', env: environment });
  assert.match(evidence, /# pass 4\n# fail 0/);
  assert.equal(command(root, ['snapshot', '--paths', ...paths]).tree, capture.tree);
  const resultPath = join(dirname(root), 'observed.json');
  // This aggregate record deliberately names no individual results; the CLI must not invent them.
  writeJson(resultPath, { tree: capture.tree, method: 'node --test tests/queue.test.ts', outcome: 'pass', environment: `Node ${process.version}`, evidence, tests: [] });
  const result: CheckResult = command(root, ['check', 'record', '--file', resultPath]);
  assert.equal(result.tree, capture.tree); assert.ok(result.id); assert.ok(result.recordedAt); assert.deepEqual(result.tests, []);
  assert.deepEqual(command(root, ['check', 'list']), [result]);
  const reviewPath = join(dirname(root), 'review.json');
  const review: ReviewInput & { unmapped: { path: string; reason: string }[] } = { reviewer: 'CLI test', summary: 'Release a live queue lease', unresolved: [], resultIds: [result.id], unmapped: [], examined: [
    ...['commands', 'job-lifecycle', 'lease-transitions'].map(id => ({ id, outcome: 'revised' as const, reason: 'Adds early release while retaining the job and enforcing lease ownership.' })),
    ...['queue', 'engine', 'storage'].map(id => ({ id, outcome: 'unchanged' as const, reason: 'The local queue purpose and existing nullable lease fields and persistence support release.' })),
  ] };
  writeJson(reviewPath, review);
  const affected = command(root, ['impact', '--base', base, '--review', reviewPath, '--paths', ...paths]);
  assert.equal(affected.reviewedBase, false); assert.ok(affected.frontier.every((f: { decision?: unknown }) => f.decision));
  assert.ok(affected.paths.includes('src/queue.ts'));
  review.unmapped = affected.unmapped.map((u: { path: string }) => ({ path: u.path, reason: 'Inspected example imports and separators with the linked release function and tests.' })); writeJson(reviewPath, review);
  const prepared: Ready = command(root, ['prepare', '--review', reviewPath, '--paths', ...paths]);
  assert.equal(head(root), base); assert.equal(prepared.contentTree, capture.tree);
  assert.equal(command(root, ['ready']).id, prepared.id); assert.ok(existsSync(join(root, prepared.reviewPath)));
  const proposal = JSON.parse(git(root, ['show', `${prepared.finalTree}:${prepared.reviewPath}`]));
  assert.deepEqual(proposal.results, [result]); assert.equal(proposal.contentTree, capture.tree);
  assert.deepEqual(command(root, ['check', 'list']), [result]);
  const withdrawn = command(root, ['discard', '--id', prepared.id]);
  assert.equal(withdrawn.discarded, prepared.id); assert.equal(command(root, ['ready']), null); assert.equal(existsSync(join(root, prepared.reviewPath)), false);
  assert.deepEqual(durableState(root).files, before.files); assert.deepEqual(command(root, ['check', 'list']), [result]);
  const next: Ready = command(root, ['prepare', '--review', reviewPath, '--paths', ...paths]);
  assert.notEqual(next.id, prepared.id);
  const accepted = command(root, ['accept', '--id', next.id]);
  assert.equal(accepted.commit, head(root)); assert.equal(git(root, ['rev-parse', 'HEAD^{tree}']).trim(), next.finalTree);
  assert.equal(git(root, ['rev-list', '--count', `${base}..HEAD`]).trim(), '1');
  assert.equal(command(root, ['ready']), null); assert.deepEqual(command(root, ['check', 'list']), [result]);
  assert.equal(readFileSync(join(root, 'unrelated.txt'), 'utf8'), 'working\n'); assert.equal(git(root, ['show', ':unrelated.txt']), 'staged\n');
  assert.equal(git(root, ['show', 'HEAD:unrelated.txt']), 'base\n');
});

test('CLI rejects invalid mutation requests without changing files, staging, evidence, readiness, or history', t => {
  const root = fixture(t), prepared = preparedRelease(root);
  const valid = join(dirname(root), 'valid-result.json'), malformed = join(dirname(root), 'malformed.json'), wrong = join(dirname(root), 'wrong.json'), duplicate = join(dirname(root), 'duplicate.json');
  const input = { tree: prepared.contentTree, method: 'Synthetic rejection fixture', outcome: 'pass', environment: 'CLI test', evidence: 'Must not be imported.', tests: [] };
  writeJson(valid, input); writeFileSync(malformed, '{broken'); writeJson(wrong, {});
  writeJson(duplicate, { ...input, tests: [{ id: 'same', outcome: 'pass' }, { id: 'same', outcome: 'pass' }] });
  const review = join(dirname(root), 'valid-review.json');
  writeJson(review, { ...JSON.parse(readFileSync(join(root, prepared.reviewPath), 'utf8')), resultIds: command(root, ['check', 'list']).map((r: CheckResult) => r.id) });
  const cases: string[][] = [
    ['check', 'record'], ['check', 'record', '--file'], ['check', 'record', '--file', malformed], ['check', 'record', '--file', wrong], ['check', 'record', '--file', duplicate], ['check', 'record', '--file', valid, '--unexpected'],
    ['prepare', '--all'], ['prepare', '--review'], ['prepare', '--review', malformed, '--all'], ['prepare', '--review', wrong, '--all'], ['prepare', '--review', review], ['prepare', '--review', review, '--paths'], ['prepare', '--review', review, '--all', '--unexpected'],
    ...['accept', 'discard'].flatMap(action => [[action], [action, '--id'], [action, '--id', 'wrong-review'], [action, '--id', prepared.id, '--unexpected'], [action, '--id', prepared.id, 'extra'], [action, '--id', prepared.id, '--id', prepared.id]]),
  ];
  const before = durableState(root);
  for (const args of cases) {
    command(root, args, 1);
    assert.deepEqual(durableState(root), before, `Rejected command changed durable state: ${args.join(' ')}`);
  }
});


test('CLI identity and help work outside Git and reject invalid launch arguments before starting the desktop', t => {
  const outside = dirname(fixture(t));
  const invoke = (args: string[]) => spawnSync(process.execPath, [executable, ...args], { cwd: outside, encoding: 'utf8', timeout: 10000 });
  const version = invoke(['version']);
  assert.equal(version.status, 0); assert.equal(version.stderr, '');
  assert.deepEqual(JSON.parse(version.stdout), { product: 'Stratic', version: '0.1.0', formatVersion: 1 });
  assert.match(invoke(['help']).stdout, /open \[DIR\]/);
  for (const args of [['version', 'extra'], ['open', '--revision', 'HEAD'], ['open', 'one', 'two'], ['--project', outside, 'open', outside]]) {
    const rejected = invoke(args);
    assert.equal(rejected.status, 1); assert.equal(rejected.stdout, ''); assert.ok(JSON.parse(rejected.stderr).error);
  }
});
