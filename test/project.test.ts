import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './helpers.ts';
import { loadProject, inspect, targetContent } from '../src/project.ts';
import { readJson, writeJson, head, readSource, snapshot } from '../src/git.ts';
import { resolvePassage } from '../src/passages.ts';
import { addRelease } from '../scripts/queue-example.ts';
import type { Metadata } from '../src/model.ts';

test('Exact selectors survive inserted lines, detect overlapping ambiguity, and reject drift', () => {
  assert.equal(resolvePassage('new\nalpha\nbeta', { quote: 'beta' }).startLine, 3);
  assert.throws(() => resolvePassage('aaa', { quote: 'aa' }), /ambiguous/);
  assert.equal(resolvePassage('aaa', { quote: 'aa', prefix: 'a' }).start, 1);
  assert.throws(() => resolvePassage('changed', { quote: 'previous' }), /no longer exists/);
});
test('Queue graph has working passage-to-code links and exact historical content', t => {
  const root = fixture(t), base = head(root), baseline = loadProject(root);
  assert.deepEqual(baseline.issues, []);
  const detail = inspect(baseline, 'lease-transitions');
  const source = targetContent(baseline, detail.connections.find(l => l.kind === 'implementation')!.to);
  assert.match(source.body.slice(source.range!.start, source.range!.end), /export function put/);
  addRelease(root);
  assert.deepEqual(loadProject(root).issues, []);
  assert.doesNotMatch(readSource(root, 'src/queue.ts', base), /export function release/);
  assert.match(readSource(root, 'src/queue.ts'), /export function release/);
});
test('Filename and title changes retain identity and incoming links', t => {
  const root = fixture(t);
  for (const extension of ['md', 'json']) renameSync(join(root, `stratic/descriptions/job-lifecycle.${extension}`), join(root, `stratic/descriptions/different-name.${extension}`));
  const path = join(root, 'stratic/descriptions/different-name.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace('# Job lifecycle', '# Work ownership'));
  const p = loadProject(root);
  assert.deepEqual(p.issues, []);
  assert.equal(inspect(p, 'job-lifecycle').description.title, 'Work ownership');
  assert.equal(inspect(p, 'job-lifecycle').incoming[0].description, 'commands');
});
test('Broken drafts, missing parents, duplicate IDs, and cycles do not hide other prose', t => {
  const root = fixture(t), file = join(root, 'stratic/descriptions/job-lifecycle.json');
  writeFileSync(file, '{ invalid');
  let project = loadProject(root);
  assert.ok(project.issues.length);
  assert.ok(project.descriptions.some(d => d.title === 'Job lifecycle' && d.body.includes('Claiming')));
  assert.equal(inspect(project, 'storage').description.title, 'Persistent storage');
  writeJson(file, { id: 'job-lifecycle', parent: { description: 'missing', passage: { quote: 'nothing' } }, realization: 'implemented', links: [] });
  assert.match(JSON.stringify(loadProject(root).issues), /Missing description/);
  const enginePath = join(root, 'stratic/descriptions/engine.json');
  const engine = readJson<Metadata>(enginePath); engine.parent = { description: 'engine', passage: { quote: 'queue engine' } }; writeJson(enginePath, engine);
  assert.match(JSON.stringify(loadProject(root).issues), /cycle/);
  const storage = readJson<Metadata>(join(root, 'stratic/descriptions/storage.json')); storage.id = 'engine'; writeJson(join(root, 'stratic/descriptions/storage.json'), storage);
  assert.match(JSON.stringify(loadProject(root).issues), /Duplicate description/);
});
test('Repository reads cannot escape through paths or symbolic links', t => {
  const root = fixture(t);
  assert.throws(() => readSource(root, '../secret'), /Invalid repository path/);
  assert.throws(() => readSource(root, '.git/config'), /Invalid repository path/);
  symlinkSync('/etc/passwd', join(root, 'src/outside'));
  assert.throws(() => readSource(root, 'src/outside'), /Symbolic links/);
  assert.throws(() => snapshot(root, ['src/outside']), /Symbolic links/);
});
