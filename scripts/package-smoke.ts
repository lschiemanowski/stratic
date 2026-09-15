import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { _electron } from 'playwright-core';
import { createQueue, addRelease } from './queue-example.ts';

const directory = mkdtempSync(join(tmpdir(), 'stratic-package-'));
const prefix = join(directory, 'installed with spaces'), root = join(directory, 'project with spaces');
const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.ELECTRON_RUN_AS_NODE;
const run = (file: string, args: string[], cwd = directory) => execFileSync(file, args, { cwd, env, encoding: 'utf8', stdio: 'pipe', timeout: 180000 });
try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', directory], resolve('.')));
  assert.equal(packed.name, '@lschiemanowski/stratic');
  const contents = new Set<string>(packed.files.map((f: { path: string }) => f.path));
  for (const path of ['dist/cli.mjs', 'dist/main.cjs', 'dist/view-worker.cjs', 'dist/preload.cjs', 'dist/renderer.js', 'dist/index.html', 'dist/style.css', 'dist/katex.css', 'dist/highlight.css', 'dist/stratic-icon.png', 'skills/stratic/SKILL.md', 'LICENSE']) assert.ok(contents.has(path), path);
  assert.ok([...contents].some(p => p.startsWith('dist/fonts/')));
  assert.ok(![...contents].some(p => /^(test|stratic|\.agents|artifacts|node_modules)\//.test(p)));
  console.log('Packed files checked. Installing into an isolated npm prefix.');
  run('npm', ['install', '--global', '--prefix', prefix, '--no-audit', '--no-fund', join(directory, packed.filename)]);
  const bin = join(prefix, 'bin/stratic');
  const installed = join(prefix, 'lib/node_modules/@lschiemanowski/stratic');
  const cli = (...args: string[]) => JSON.parse(run(bin, args));
  assert.equal(cli('version').product, 'Stratic');
  assert.match(run(bin, ['help']), /open \[DIR\]/);
  assert.ok(!existsSync(join(installed, 'node_modules/esbuild')));
  // Rehearse setup before the user has specified any program behavior.
  const fresh = join(directory, 'new project'); mkdirSync(fresh);
  run('git', ['init', '-q'], fresh);
  cli('--project', fresh, 'skill', 'install');
  mkdirSync(join(fresh, 'stratic/descriptions'), { recursive: true });
  writeFileSync(join(fresh, 'stratic/project.json'), JSON.stringify({ formatVersion: 1, scope: ['**'], exclusions: [] }));
  writeFileSync(join(fresh, 'stratic/descriptions/project.md'), '# Project\n\nThe program has not been specified yet.\n');
  writeFileSync(join(fresh, 'stratic/descriptions/project.json'), JSON.stringify({ id: 'project', parent: null, realization: 'unimplemented', remaining: 'Discuss the intended program.', summary: ['Program requirements are deferred until setup is complete.'], links: [] }));
  run('git', ['add', '.agents', 'stratic'], fresh);
  run('git', ['-c', 'user.name=Package rehearsal', '-c', 'user.email=package@example.test', 'commit', '-qm', 'Initialize Stratic'], fresh);
  assert.equal(cli('--project', fresh, 'validate').valid, true);
  assert.equal(cli('--project', fresh, 'show', 'project').description.id, 'project');
  createQueue(root);
  assert.equal(cli('--project', root, 'validate').valid, true);
  assert.ok(cli('--project', root, 'list').descriptions.length);
  cli('--project', root, 'skill', 'install', '--with', 'tdd');
  assert.ok(cli('--project', root, 'skill', 'status').every((s: { status: string }) => s.status === 'current'));
  assert.match(readFileSync(join(root, '.agents/skills/stratic/SKILL.md'), 'utf8'), /stratic --project/);
  cli('--project', root, 'skill', 'update');
  // Commit installed guidance in the disposable fixture before proposing the example change.
  run('git', ['add', '.agents'], root); run('git', ['commit', '-qm', 'Install skills'], root);
  addRelease(root);
  const capture = cli('--project', root, 'snapshot');
  const evidence = run(process.execPath, ['--test', '--test-reporter=tap', 'tests/queue.test.ts'], root);
  assert.match(evidence, /# pass 4\n# fail 0/);
  assert.equal(cli('--project', root, 'snapshot').tree, capture.tree);
  const checkPath = join(directory, 'check.json');
  writeFileSync(checkPath, JSON.stringify({ tree: capture.tree, method: 'node --test tests/queue.test.ts', outcome: 'pass', environment: process.version, evidence, tests: [] }));
  const check = cli('--project', root, 'check', 'record', '--file', checkPath);
  const review = { reviewer: 'package rehearsal', summary: 'Release a queue lease through the installed CLI', resultIds: [check.id], unresolved: [], unmapped: [] as { path: string; reason: string }[], examined: [
    ...['commands', 'job-lifecycle', 'lease-transitions'].map(id => ({ id, outcome: 'revised', reason: 'Adds ownership-checked early release.' })),
    ...['queue', 'engine', 'storage'].map(id => ({ id, outcome: 'unchanged', reason: 'Existing scope and nullable lease fields support early release.' })),
  ] };
  const reviewPath = join(directory, 'review.json'); writeFileSync(reviewPath, JSON.stringify(review));
  review.unmapped = cli('--project', root, 'impact', '--review', reviewPath).unmapped.map((u: { path: string }) => ({ path: u.path, reason: 'Reviewed the example imports and complete release implementation.' }));
  writeFileSync(reviewPath, JSON.stringify(review));
  const prepared = cli('--project', root, 'prepare', '--all', '--review', reviewPath);
  cli('--project', root, 'accept', '--id', prepared.id);
  assert.equal(run('git', ['rev-parse', 'HEAD^{tree}'], root).trim(), prepared.finalTree);
  assert.equal(cli('--project', root, 'ready'), null);
  assert.equal(cli('--project', root, 'validate').valid, true);
  console.log('Installed CLI, skills and complete acceptance example passed.');
  const child = spawn(bin, ['open', root], { cwd: directory, env: { ...env, STRATIC_USER_DATA: join(directory, 'launcher-data') }, stdio: 'ignore' });
  const stopped = once(child, 'exit');
  try {
    const deadline = Date.now() + 30000;
    let connected = false;
    while (Date.now() < deadline && child.exitCode === null) {
      try { connected = cli('--project', root, 'ui', 'current').description === 'queue'; if (connected) break; } catch { /* Desktop is starting. */ }
      await delay(150);
    }
    assert.ok(connected, 'Installed open command starts the desktop');
    assert.equal(cli('--project', root, 'ui', 'open', 'lease-transitions').description, 'lease-transitions');
  } finally { child.kill('SIGTERM'); await stopped; }
  const electron = createRequire(join(installed, 'package.json'))('electron');
  const app = await _electron.launch({ executablePath: electron, args: [installed, '--project', root], cwd: directory, env: { ...env, STRATIC_USER_DATA: join(directory, 'reader-data') } });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await page.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
    assert.equal(await page.title(), 'Stratic');
    assert.ok(await page.locator('.titlebar').isVisible());
    await app.evaluate(({ app }) => { if (app.getName() !== 'Stratic') throw new Error('Unexpected app name'); });
  } finally { await app.close(); }
  console.log(JSON.stringify({ passed: true, package: packed.name, version: packed.version, packedBytes: packed.size, unpackedBytes: packed.unpackedSize, checks: ['package contents', 'isolated global installation', 'CLI outside repository', 'new repository setup', 'installed skills', 'complete reviewed change', 'CLI desktop launch and shutdown', 'installed desktop rendering'] }, null, 2));
} finally { rmSync(directory, { recursive: true, force: true }); }
