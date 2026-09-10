import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fixture } from './helpers.ts';
import { git, head, readJson, writeJson, snapshot } from '../src/git.ts';
import { inspect, loadProject } from '../src/project.ts';
import { impact } from '../src/impact.ts';
import { treeLayout } from '../src/desktop/tree-view.ts';
import type { Description, Metadata } from '../src/model.ts';

test('Summary metadata is optional, historical, validated and included in change impact', t => {
  const root = fixture(t), path = join(root, 'stratic/descriptions/engine.json');
  const metadata = readJson<Metadata>(path);
  assert.equal(inspect(loadProject(root), 'engine').description.metadata?.summary, undefined);
  metadata.summary = ['Persists successful operations.', 'Keeps lease ownership consistent.']; writeJson(path, metadata);
  git(root, ['add', 'stratic/descriptions/engine.json']); git(root, ['commit', '-m', 'Add summary']); const base = head(root);
  metadata.summary = ['A revised persistence promise.']; writeJson(path, metadata);
  assert.deepEqual(inspect(loadProject(root, base), 'engine').description.metadata?.summary, ['Persists successful operations.', 'Keeps lease ownership consistent.']);
  assert.deepEqual(inspect(loadProject(root), 'engine').description.metadata?.summary, metadata.summary);
  assert.ok(impact(root, base, snapshot(root, ['stratic/descriptions/engine.json'])).frontier.some(item => item.id === 'engine'));
  for (const summary of [null, 'not bullets', [42], ['  ']]) {
    writeJson(path, { ...metadata, summary }); const p = loadProject(root);
    assert.ok(p.issues.some(i => i.path.endsWith('engine.json')));
    assert.ok(p.descriptions.some(d => d.title === 'Queue engine' && d.body.length > 0));
  }
  writeJson(path, { ...metadata, summary: [] }); assert.deepEqual(loadProject(root).issues, []);
});
test('Tree layout preserves every node and only usable hierarchy edges', () => {
  const description = (id: string, parent: string | null): Description => ({ id, title: id, path: id + '.md', body: id, metadata: { id, parent: parent ? { description: parent, passage: { quote: id } } : null, realization: 'implemented', links: [] } });
  const input = [description('root', null), description('branch', 'root'), ...Array.from({ length: 300 }, (_, i) => description(`leaf-${i}`, 'branch')), description('orphan', 'missing'), description('cycle-a', 'cycle-b'), description('cycle-b', 'cycle-a'), description('dup', null), description('dup', null), description('ambiguous-parent', 'dup')];
  const { nodes } = treeLayout(input); assert.equal(nodes.length, input.length);
  for (let i = 0; i < nodes.length; i++) {
    assert.ok(Number.isFinite(nodes[i].x) && Number.isFinite(nodes[i].y));
    if (nodes[i].parent !== undefined) assert.ok(nodes[i].y > nodes[nodes[i].parent!].y);
    for (let j = 0; j < i; j++) assert.ok(Math.abs(nodes[i].x - nodes[j].x) >= 220 || Math.abs(nodes[i].y - nodes[j].y) >= 52, 'Visible cards must not overlap.');
  }
  for (const name of ['orphan', 'cycle-a', 'cycle-b', 'dup', 'ambiguous-parent']) assert.ok(nodes.filter(n => n.description.id === name).every(n => n.parent === undefined));
});

test('Compact branches and depth limits preserve independent folds and hierarchy', () => {
  const d = (id: string, parent: string | null): Description => ({ id, title: id, path: id, body: id, metadata: { id, parent: parent ? { description: parent, passage: { quote: id } } : null, realization: 'implemented', links: [] } });
  const input = [d('root', null), d('a', 'root'), d('b', 'root'), d('a1', 'a'), d('a2', 'a'), d('a11', 'a1'), d('b1', 'b')];
  const all = treeLayout(input), byId = new Map(all.nodes.map(n => [n.description.id, n]));
  assert.equal(byId.get('a')!.y, byId.get('b')!.y);
  assert.ok(byId.get('a')!.x < byId.get('b')!.x);
  assert.equal(byId.get('a1')!.x, byId.get('a2')!.x);
  assert.ok(byId.get('a11')!.y < byId.get('a2')!.y);
  assert.equal(all.maxDepth, 4);
  const ids = (depth: number, folds = new Set<string>()) => treeLayout(input, depth, folds).nodes.map(n => n.description.id);
  assert.deepEqual(ids(1), ['root']);
  assert.deepEqual(ids(2), ['root', 'a', 'b']);
  assert.deepEqual(ids(3), ['root', 'a', 'b', 'a1', 'a2', 'b1']);
  const folds = new Set(['a']);
  assert.deepEqual(ids(4, folds), ['root', 'a', 'b', 'b1']);
  ids(1, folds); assert.deepEqual(ids(4, folds), ['root', 'a', 'b', 'b1']);
  assert.deepEqual(input.map(n => n.metadata!.parent?.description ?? null), [null, 'root', 'root', 'a', 'a', 'a1', 'b']);
});
