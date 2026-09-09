import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createQueue, addRelease } from './queue-example.ts';
import { checkQueue } from './queue-workflow.ts';
import { requestUI } from '../src/ui-channel.ts';
import { repository, head } from '../src/git.ts';

const directory = mkdtempSync(join(tmpdir(), 'stratic-desktop-'));
const project = join(directory, 'queue'); createQueue(project); const root = repository(project), base = head(root);
addRelease(root); checkQueue(root);
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [resolve('.'), '--project', root], env: { ...process.env, STRATIC_USER_DATA: join(directory, 'user-data') }, timeout: 30000 });
try {
  const page = await app.firstWindow();
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
  const menu = page.getByRole('listbox', { name: 'Descriptions at this level' });
  await menu.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Command interface', exact: true }).waitFor();
  assert.equal(await menu.getByRole('option').count(), 2);
  await page.keyboard.press('ArrowDown');
  await page.getByRole('heading', { name: 'Queue engine', exact: true }).waitFor();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.match(await page.getByRole('navigation', { name: 'Menu location' }).innerText(), /Queue engine/);
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  assert.match(await page.locator('.changed-text').innerText(), /Release locates/);
  assert.equal(await page.locator('.menu-controls').count(), 0);
  assert.match(await page.getByRole('region', { name: 'Parent description', exact: true }).innerText(), /Job lifecycle/);
  assert.match(await page.getByRole('region', { name: 'Child descriptions', exact: true }).innerText(), /No children/);
  assert.equal((await requestUI(root, { action: 'current' })).description, 'lease-transitions');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.match(await page.getByRole('region', { name: 'Parent description', exact: true }).innerText(), /Queue engine/);
  assert.match(await page.getByRole('region', { name: 'Child descriptions', exact: true }).innerText(), /Lease transitions/);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop-navigation.png' });
  await page.keyboard.press('ArrowDown');
  await page.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await menu.count(), 0);
  await page.getByRole('button', { name: '▴ Descriptions', exact: true }).click();
  const navigationMs: number[] = [];
  for (const [id, title] of [['lease-transitions', 'Lease transitions'], ['storage', 'Persistent storage'], ['lease-transitions', 'Lease transitions']]) {
    const began = performance.now();
    await page.evaluate(id => window.stratic.navigate({ action: 'open', description: id }), id);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    navigationMs.push(performance.now() - began);
  }
  assert.match(await page.locator('.changed-text').innerText(), /Release locates/);
  await page.getByRole('button', { name: 'Proposed changes', exact: true }).click();
  assert.equal(await page.locator('.changed-text').count(), 0);
  await page.getByRole('button', { name: 'Proposed changes', exact: true }).click();
  assert.match(await page.locator('.changed-text').innerText(), /Release locates/);

  await requestUI(root, { action: 'open', description: 'queue', revision: 'working' });
  await page.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
  await page.getByRole('button', { name: 'The command interface exposes the queue operations.', exact: true }).click();
  await page.getByRole('heading', { name: 'Command interface', exact: true }).waitFor();
  assert.equal((await requestUI(root, { action: 'current' })).description, 'commands');
  assert.equal(await page.locator('.connection-target').count(), 0, 'A single description link should open without a chooser.');
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: 'working' });
  await page.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  const clipboardBefore = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    await page.getByRole('button', { name: 'Copy ID', exact: true }).click();
    let copied = false;
    for (let attempt = 0; attempt < 20 && !copied; attempt++) {
      copied = await app.evaluate(({ clipboard }) => clipboard.readText() === 'lease-transitions');
      if (!copied) await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(copied, 'Copy ID should write the selected stable identity.');
  } finally { await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), clipboardBefore); }
  const releasePassage = page.locator('.passage').filter({ hasText: 'Release locates the job and checks the worker and strictly future expiry.' }).first();
  await releasePassage.click();
  await page.locator('.highlighted').first().waitFor();
  assert.match(await page.locator('.detail').innerText(), /export function release/);
  assert.ok(await page.locator('.source-code .hljs-keyword').count(), 'Source keywords should be colored.');
  const displayedSource = await page.locator('.code-line code').allTextContents();
  assert.equal(displayedSource.join('\n'), readFileSync(join(root, 'src/queue.ts'), 'utf8'));
  assert.ok(await page.locator('.highlighted .hljs-keyword').count(), 'Passage backgrounds and syntax colors should coexist.');

  assert.equal(await page.evaluate(() => typeof (window as any).require), 'undefined');
  assert.deepEqual(await page.evaluate(() => Object.keys((window as any).stratic).sort()), ['chooseProject', 'copyId', 'navigate', 'onSelection', 'source', 'view']);
  const escaped = await page.evaluate(async () => { try { await (window as any).stratic.source('../secret'); return false; } catch { return true; } });
  assert.equal(escaped, true);
  await page.getByRole('button', { name: 'Tests · 4', exact: true }).click();
  await page.getByRole('heading', { name: 'Tests', exact: true }).waitFor();
  assert.equal(await page.locator('.test-card .badge.pass').count(), 4);
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: base });
  await page.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  assert.doesNotMatch(await page.locator('.prose').innerText(), /Release locates the job/);
  const metadataPath = join(root, 'stratic/descriptions/job-lifecycle.json'), metadata = readFileSync(metadataPath, 'utf8');
  writeFileSync(metadataPath, '{ broken');
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await page.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await page.getByRole('button', { name: /^Problems · [1-9]/ }).click();
  assert.match(await page.locator('.reading').innerText(), /job-lifecycle/);
  writeFileSync(metadataPath, metadata);
  const prosePath = join(root, 'stratic/descriptions/storage.md'), prose = readFileSync(prosePath, 'utf8');
  writeFileSync(prosePath, prose + '\n<img src=x onerror="window.injected=true">\n');
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await page.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await page.locator('.reading img').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).injected), undefined);
  writeFileSync(prosePath, prose);
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: 'working' });
  await page.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  await page.locator('.passage').filter({ hasText: 'Release locates the job and checks the worker and strictly future expiry.' }).first().click();
  await page.locator('.highlighted').first().waitFor();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop.png' });
  // Hundreds of leaves stay local to their parent and within the drawer viewport.
  for (let i = 0; i < 300; i++) {
    const id = `scale-${String(i).padStart(3, '0')}`;
    writeFileSync(join(root, `stratic/descriptions/${id}.md`), `# Operation ${i}\n\nA sample responsibility for navigation.\n`);
    writeFileSync(join(root, `stratic/descriptions/${id}.json`), JSON.stringify({ id, parent: { description: 'storage', passage: { quote: 'Persistent storage preserves the queue between short-lived commands.' } }, realization: 'unimplemented', links: [] }));
  }
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await page.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await menu.getByRole('option').count(), 2, 'Unrelated leaves should not appear at this level.');
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Child descriptions"] button').length === 300);
  assert.equal(await page.getByRole('region', { name: 'Child descriptions', exact: true }).getByRole('button').count(), 300);
  await page.getByRole('button', { name: 'Persistent storage preserves the queue between short-lived commands.', exact: true }).click();
  assert.equal(await page.locator('.connection-target').count(), 301, 'The chooser should retain the existing source link and all 300 added descriptions.');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'storage');
  await page.getByRole('button', { name: 'Operation 0 →', exact: true }).click();
  await page.getByRole('heading', { name: 'Operation 0', exact: true }).waitFor();
  await menu.focus();
  assert.equal(await menu.getByRole('option').count(), 300);
  await page.keyboard.press('End');
  await page.getByRole('heading', { name: 'Operation 299', exact: true }).waitFor();
  assert.match(await menu.getByRole('option', { selected: true }).innerText(), /Operation 299/);
  const fits = await menu.evaluate(e => {
    const selected = e.querySelector('[aria-selected="true"]')!.getBoundingClientRect(), bounds = e.getBoundingClientRect();
    return selected.top >= bounds.top && selected.bottom <= bounds.bottom && bounds.bottom <= window.innerHeight;
  });
  assert.ok(fits, 'The selected leaf stays visible inside the bounded menu.');
  await page.getByRole('heading', { name: 'Operation 299', exact: true }).waitFor();
  assert.match(await page.locator('.changed-text').allTextContents().then(v => v.join(' ')), /Operation 299/);
  await page.screenshot({ path: 'artifacts/desktop-scale.png' });
  await page.getByRole('region', { name: 'Parent description', exact: true }).getByRole('button', { name: 'Persistent storage', exact: true }).click();
  await page.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await menu.getByRole('option').count(), 2);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 550));
  const controlsFit = await page.locator('.menu-body').evaluate(e => {
    const bounds = e.getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
  });
  assert.ok(controlsFit, 'The navigation panel fits the minimum supported window.');
  await page.screenshot({ path: 'artifacts/desktop-small.png' });

  const sample = '/* first line\r\nsecond line */\r\nconst markup = `<img src=x onerror="window.injected=true">`;\r\n\r\n';
  writeFileSync(join(root, 'src/syntax-fixture.ts'), sample);
  writeFileSync(join(root, 'src/syntax-fixture.unknown'), sample);
  const storageMetadataPath = join(root, 'stratic/descriptions/storage.json');
  const storageMetadata = JSON.parse(readFileSync(storageMetadataPath, 'utf8'));
  for (const path of ['src/syntax-fixture.ts', 'src/syntax-fixture.unknown']) storageMetadata.links.push({ kind: 'implementation', from: null, to: { path, passage: { quote: sample } } });
  writeFileSync(storageMetadataPath, JSON.stringify(storageMetadata));
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await page.getByRole('button', { name: 'src/syntax-fixture.ts', exact: true }).click();
  await page.getByRole('heading', { name: 'src/syntax-fixture.ts', exact: true }).waitFor();
  assert.equal((await page.locator('.code-line code').allTextContents()).join('\n'), sample);
  assert.equal(await page.locator('.source-code img, .source-code script').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).injected), undefined);
  assert.equal(await page.locator('.code-line:nth-child(2) .hljs-comment').count(), 1);
  await page.getByRole('button', { name: 'src/syntax-fixture.unknown', exact: true }).click();
  await page.getByRole('heading', { name: 'src/syntax-fixture.unknown', exact: true }).waitFor();
  assert.equal((await page.locator('.code-line code').allTextContents()).join('\n'), sample);
  assert.equal(await page.locator('.source-code code span').count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, navigationMs, checked: ['keyboard navigation and clickable parent/children', 'folding and agent navigation synchronization', '300 leaves in a bounded menu', 'direct single-destination links and multiple-destination chooser', 'syntax colors, multiline tokens, exact source text, and safe plain-text fallback', 'copyable identity', 'agent current/open', 'individual test results', 'historical content', 'broken draft browsing', 'inert repository HTML', 'sandboxed renderer API'], screenshot: resolve('artifacts/desktop.png') }, null, 2));
} finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
