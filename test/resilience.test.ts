import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fixture, preparedRelease, releaseReview } from './helpers.ts';
import { git, head, readSource, revision, snapshot, workingSnapshot, files } from '../src/git.ts';
import { accept, prepare, recordCheck, reviewHistory } from '../src/review.ts';
import { impact } from '../src/impact.ts';
import { loadProject } from '../src/project.ts';
import { comparison } from '../src/desktop/comparison.ts';
import { requestUI, serveUI } from '../src/ui-channel.ts';

test('Repairing committed malformed metadata can review its draft identity and accept', t => {
  const root = fixture(t), path = join(root, 'stratic/descriptions/storage.json');
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, '{'); git(root, ['add', '-A']); git(root, ['commit', '-qm', 'Committed malformed metadata']);
  const base = head(root);
  const draft = loadProject(root).descriptions.find(d => d.path.endsWith('/storage.md'))!.id;
  assert.equal(draft, 'draft:stratic/descriptions/storage.md');
  writeFileSync(path, original);
  const tree = snapshot(root, ['stratic/descriptions/storage.json']);
  const frontier = impact(root, base, tree);
  assert.ok(frontier.frontier.some(f => f.id === draft));
  const result = recordCheck(root, { tree, method: 'Validate repaired fixture', outcome: 'pass', environment: 'Isolated test repository', evidence: 'Restored original metadata; loader reports zero issues.', tests: [] });
  assert.deepEqual(loadProject(root).issues, []);
  const proposal = prepare(root, ['stratic/descriptions/storage.json'], {
    reviewer: 'regression', summary: 'Repair committed metadata', unresolved: [], resultIds: [result.id],
    examined: frontier.frontier.map(f => ({ id: f.id, outcome: f.id === draft || f.id === 'storage' ? 'revised' : 'unchanged', reason: 'Restored the original stable identity and links; surrounding responsibilities remain accurate.' })),
  });
  assert.equal(reviewHistory(root).length, 1);
  const accepted = accept(root, proposal.id);
  assert.equal(head(root), accepted.commit);
  assert.deepEqual(loadProject(root).issues, []);
  assert.ok(reviewHistory(root)[0].review.examined.some(d => d.id === draft));
});

test('Snapshots capture tracked directories replaced by symlinks as a single replacement', t => {
  const root = fixture(t), directory = join(root, 'unrelated');
  mkdirSync(join(directory, 'nested'), { recursive: true });
  writeFileSync(join(directory, 'nested/old.txt'), 'old contents');
  git(root, ['add', '-A']); git(root, ['commit', '-qm', 'Unrelated tracked directory']);
  const base = head(root), outside = join(root, '..', 'outside');
  mkdirSync(join(outside, 'nested'), { recursive: true });
  writeFileSync(join(outside, 'nested/old.txt'), 'Do not read this target');
  rmSync(directory, { recursive: true });
  for (const target of [outside, 'missing-directory']) {
    symlinkSync(target, directory);
    for (const staged of [false, true]) {
      if (staged) git(root, ['add', '-A', '--', 'unrelated']);
      const index = git(root, ['ls-files', '--stage']);
      assert.deepEqual(loadProject(root).issues, []);
      assert.ok(files(root).includes('unrelated/nested/old.txt'));
      const tree = workingSnapshot(root);
      assert.match(git(root, ['ls-tree', tree, '--', 'unrelated']), /^120000 blob/);
      assert.equal(git(root, ['show', `${tree}:unrelated`]), target);
      assert.equal(git(root, ['ls-tree', '-r', tree, '--', 'unrelated/nested']), '');
      assert.equal(snapshot(root, ['unrelated/nested/old.txt', 'unrelated']), tree);
      assert.throws(() => snapshot(root, ['unrelated/nested/old.txt']), /Symbolic links/);
      assert.throws(() => snapshot(root, ['unrelated', 'unrelated/../escape']), /Invalid repository path/);
      assert.equal(git(root, ['ls-files', '--stage']), index);
    }
    rmSync(directory); git(root, ['read-tree', base]);
  }
});

test('UI navigation waits for cold loading beyond the short connection timeout', async t => {
  const root = fixture(t);
  const selection = { project: root, revision: 'working', description: 'queue' };
  const stop = await serveUI(root, async request => {
    if (request.action === 'open') await new Promise(resolve => setTimeout(resolve, 3500));
    return selection;
  });
  t.after(stop);
  assert.deepEqual(await requestUI(root, { action: 'current' }), selection);
  assert.deepEqual(await requestUI(root, { action: 'open', description: 'queue' }), selection);
});

test('Accepted reviews retain comparison and bounded impact after a transport clone', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  accept(root, proposal.id);
  const clone = join(root, '..', 'clone');
  git(root, ['clone', '--no-local', root, clone]);
  assert.throws(() => git(clone, ['cat-file', '-t', proposal.contentTree]), /not a valid|could not get|bad object/);
  const tree = revision(clone, 'HEAD');
  const index = git(clone, ['ls-files', '--stage']);
  const compare = comparison(clone, loadProject(clone, 'HEAD'), null, reviewHistory(clone, 'HEAD'), tree);
  assert.equal(compare?.base, proposal.base);
  assert.equal(compare?.label, 'Accepted changes');
  assert.ok(compare?.before.commands);
  assert.equal(git(clone, ['ls-files', '--stage']), index);
  git(clone, ['prune', '--expire', 'now']);
  assert.throws(() => git(clone, ['cat-file', '-t', proposal.contentTree]));
  writeFileSync(join(clone, 'src/queue.ts'), readFileSync(join(clone, 'src/queue.ts'), 'utf8') + '\n');
  const changed = workingSnapshot(clone);
  const bounded = impact(clone, head(clone), changed);
  assert.equal(bounded.reviewedBase, true);
  assert.deepEqual(bounded.frontier.map(f => f.id), ['lease-transitions']);
  assert.equal(comparison(clone, loadProject(clone, changed), null, reviewHistory(clone, changed), changed), null, 'Later source changes do not match accepted content.');
});

test('Preparation rejects review changes selected through an ancestor directory', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  accept(root, proposal.id);
  const path = join(root, proposal.reviewPath), original = readFileSync(path, 'utf8');
  const input = releaseReview(root);
  const committed = head(root);
  const attempt = (directory: string) => {
    const result = recordCheck(root, { tree: snapshot(root, [directory]), method: 'Inspect changed fixture', outcome: 'pass', environment: 'Isolated test repository', evidence: 'Fixture changes only a historical review.', tests: [] });
    assert.throws(() => prepare(root, [directory], { ...input, resultIds: [result.id] }), /Historical reviews/);
  };
  for (const directory of ['stratic', 'stratic/reviews']) {
    writeFileSync(path, original.replace('Allow a worker', 'Altered: allow a worker'));
    attempt(directory);
    rmSync(path);
    attempt(directory);
    writeFileSync(path, original);
  }
  assert.equal(head(root), committed);
});

test('Malformed reviews become problems without hiding readable descriptions', t => {
  const root = fixture(t), proposal = preparedRelease(root);
  const path = join(root, proposal.reviewPath), original = JSON.parse(readFileSync(path, 'utf8'));
  const malformed = [null, [], {}, { ...original, examined: [null] }, { ...original, results: [null] },
    { ...original, recordedAt: null }, { ...original, id: 'wrong-name' },
    { ...original, results: [{ ...original.results[0], tests: [null] }] },
    { ...original, results: [{ ...original.results[0], tree: '0'.repeat(40) }] }];
  for (const value of malformed) {
    writeFileSync(path, JSON.stringify(value));
    assert.deepEqual(reviewHistory(root), []);
    const project = loadProject(root);
    assert.equal(project.descriptions.length, 6);
    assert.ok(project.issues.some(i => i.path === proposal.reviewPath && /Malformed review/.test(i.message)));
    assert.doesNotThrow(() => comparison(root, project, null, reviewHistory(root), workingSnapshot(root)));
  }
  writeFileSync(path, '{');
  assert.deepEqual(reviewHistory(root), []);
  assert.ok(loadProject(root).issues.some(i => i.path === proposal.reviewPath));
  writeFileSync(path, JSON.stringify(original));
  assert.equal(reviewHistory(root).length, 1);
  assert.deepEqual(loadProject(root).issues, []);
});

test('Snapshots preserve unrelated symlink entries without following their targets', t => {
  const root = fixture(t), index = git(root, ['ls-files', '--stage']);
  symlinkSync('missing-target', join(root, 'broken-link'));
  symlinkSync('src', join(root, 'directory-link'));
  symlinkSync('/outside-the-project', join(root, 'external-link'));
  const tree = workingSnapshot(root);
  for (const name of ['broken-link', 'directory-link', 'external-link']) assert.match(git(root, ['ls-tree', tree, '--', name]), /^120000 blob/);
  assert.equal(git(root, ['show', `${tree}:external-link`]), '/outside-the-project');
  assert.equal(git(root, ['ls-files', '--stage']), index);
  assert.deepEqual(loadProject(root).issues, []);
  assert.throws(() => snapshot(root, ['directory-link/queue.ts']), /Symbolic links/);
  assert.throws(() => readSource(root, 'broken-link'), /Symbolic links/);
  assert.throws(() => readSource(root, 'external-link', tree), /Not a regular file/);
});

test('Historical reads validate Git entries independently of working symlinks', t => {
  const root = fixture(t), base = head(root), expected = readSource(root, 'src/queue.ts', base);
  renameSync(join(root, 'src/queue.ts'), join(root, 'src/moved.ts'));
  symlinkSync('moved.ts', join(root, 'src/queue.ts'));
  assert.equal(readSource(root, 'src/queue.ts', base), expected);
  assert.throws(() => readSource(root, 'src/queue.ts'), /Symbolic links/);
  renameSync(join(root, 'src'), join(root, 'moved-src'));
  symlinkSync('moved-src', join(root, 'src'));
  assert.equal(readSource(root, 'src/queue.ts', base), expected);
  assert.throws(() => readSource(root, '../outside', base), /Invalid repository path/);
});

test('Working resource reads reject pipes and directories before reading', t => {
  const root = fixture(t);
  execFileSync('mkfifo', [join(root, 'pipe')]);
  const module = new URL('../src/git.ts', import.meta.url).href;
  const script = `import { readSource } from ${JSON.stringify(module)}; try { readSource(process.argv[1], 'pipe'); process.exit(2); } catch(e) { if (!/Not a regular file/.test(e.message)) throw e; }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script, root], { timeout: 2000, stdio: 'pipe' });
  mkdirSync(join(root, 'directory'));
  assert.throws(() => readSource(root, 'directory'), /Not a regular file/);
});
