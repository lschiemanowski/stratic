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
  const active = page.locator('.active-description');
  const parentPane = page.locator('.parent-description');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await active.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
  assert.equal(await parentPane.count(), 0);
  assert.equal(await page.locator('.description-meta, .description-pane > .eyebrow, .hint, .menu-path, .brand, .menu-bar').count(), 0);
  assert.equal(await page.getByText('implemented', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Committed', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Problems · 0' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Copy ID' }).count(), 0);
  assert.equal(await page.getByRole('combobox', { name: 'Revision' }).count(), 0);
  assert.equal(await page.locator('.titlebar').evaluate(e => getComputedStyle(e).getPropertyValue('-webkit-app-region')), 'drag');
  assert.equal(await page.getByRole('button', { name: 'Projects', exact: true }).evaluate(e => getComputedStyle(e).getPropertyValue('-webkit-app-region')), 'no-drag');
  // The collapsible project panel opens folders through the picker and remembers them.
  assert.equal(await page.getByRole('complementary', { name: 'Projects' }).count(), 0);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const projectPanel = page.getByRole('complementary', { name: 'Projects' });
  await projectPanel.waitFor();
  assert.match(await projectPanel.innerText(), /queue/);
  const secondProject = join(directory, 'second-queue'); createQueue(secondProject);
  await app.evaluate(({ dialog }, path) => { (globalThis as any).originalPicker = dialog.showOpenDialog; (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, secondProject);
  await projectPanel.getByRole('button', { name: 'Open project…', exact: true }).click();
  await page.waitForFunction(path => document.querySelector('.project-option[aria-current="true"]')?.getAttribute('title') === path, repository(secondProject));
  await projectPanel.getByRole('button', { name: `queue ${root}`, exact: true }).click();
  await page.waitForFunction(path => document.querySelector('.project-option[aria-current="true"]')?.getAttribute('title') === path, root);
  assert.equal((await requestUI(root, { action: 'current' })).description, 'queue');
  // Cancellation and an invalid new folder preserve the existing project.
  await app.evaluate(({ dialog }) => { (dialog as any).showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
  await projectPanel.getByRole('button', { name: 'Open project…', exact: true }).click();
  assert.equal((await requestUI(root, { action: 'current' })).description, 'queue');
  const plainRepository = join(directory, 'plain-repository'); createQueue(plainRepository); rmSync(join(plainRepository, 'stratic'), { recursive: true });
  for (const invalid of [join(directory, 'missing'), plainRepository]) {
    await app.evaluate(({ dialog }, path) => { (dialog as any).showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, invalid);
    await projectPanel.getByRole('button', { name: 'Open project…', exact: true }).click();
    await page.locator('#error').waitFor();
    assert.equal((await requestUI(root, { action: 'current' })).description, 'queue');
    assert.equal((await page.evaluate(() => window.stratic.view())).project?.root, root);
  }
  await app.evaluate(({ dialog }) => { dialog.showOpenDialog = (globalThis as any).originalPicker; });
  const unknownProject = await page.evaluate(async () => { try { await window.stratic.chooseProject('/unknown'); return false; } catch { return true; } });
  assert.equal(unknownProject, true);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, 'user-data/projects.json'), 'utf8')), [root, repository(secondProject)]);
  await projectPanel.getByRole('button', { name: `queue ${root}`, exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#error'));
  await page.screenshot({ path: 'artifacts/desktop-projects.png' });
  await page.getByRole('button', { name: 'Hide projects', exact: true }).click();
  assert.equal(await projectPanel.count(), 0);
  assert.equal(await page.locator('.detail').count(), 0, 'A root has no empty detail placeholder.');
  const menu = page.getByRole('listbox', { name: 'Descriptions at this level' });
  // A plain click in prose must not require a subsequent click in the tree menu.
  await active.getByRole('heading').click();
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'description-options');
  await page.keyboard.press('ArrowLeft');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'queue', 'The root has no parent.');
  await page.keyboard.press('ArrowRight');
  await active.getByRole('heading', { name: 'Command interface', exact: true }).waitFor();
  assert.equal(await menu.getByRole('option').count(), 2);
  assert.equal(await parentPane.getAttribute('data-description'), 'queue');
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'description-options', 'Global navigation should not move focus into the menu.');
  await page.getByRole('button', { name: 'Projects', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await active.getByRole('heading', { name: 'Queue engine', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'queue');
  await page.keyboard.press('ArrowRight');
  await active.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'engine');
  assert.match(await page.getByRole('navigation', { name: 'Location' }).innerText(), /Queue engine/);
  await page.keyboard.press('ArrowRight');
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'job-lifecycle');
  assert.match(await active.locator('.changed-text').innerText(), /Release locates/);
  assert.equal(await page.locator('.menu-controls').count(), 0);
  assert.match(await page.getByRole('region', { name: 'Parent description', exact: true }).innerText(), /Job lifecycle/);
  assert.equal(await page.getByRole('region', { name: 'Child descriptions', exact: true }).getByRole('button').count(), 0);
  assert.equal((await requestUI(root, { action: 'current' })).description, 'lease-transitions');
  await page.keyboard.press('ArrowLeft');
  await active.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.match(await page.getByRole('region', { name: 'Parent description', exact: true }).innerText(), /Queue engine/);
  assert.match(await page.getByRole('region', { name: 'Child descriptions', exact: true }).innerText(), /Lease transitions/);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/desktop-navigation.png' });
  await page.keyboard.press('ArrowDown');
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await menu.focus();
  await page.keyboard.press('Escape');
  assert.equal(await menu.count(), 0);
  await page.keyboard.press('ArrowUp');
  await active.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  await page.keyboard.press('ArrowRight');
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  await page.keyboard.press('ArrowRight');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'lease-transitions', 'A leaf has no child.');
  await page.keyboard.press('ArrowLeft');
  await active.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.equal(await menu.count(), 0, 'Navigation keeps the folded menu folded.');
  await page.keyboard.press('Shift+ArrowDown');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'job-lifecycle');
  await page.getByRole('button', { name: 'Descriptions', exact: true }).click();
  const navigationMs: number[] = [];
  for (const [id, title] of [['lease-transitions', 'Lease transitions'], ['storage', 'Persistent storage'], ['lease-transitions', 'Lease transitions']]) {
    const began = performance.now();
    await page.evaluate(id => window.stratic.navigate({ action: 'open', description: id }), id);
    await active.getByRole('heading', { name: title, exact: true }).waitFor();
    navigationMs.push(performance.now() - began);
  }
  assert.match(await active.locator('.changed-text').innerText(), /Release locates/);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Proposed changes', exact: true }).click();
  assert.equal(await page.locator('.changed-text').count(), 0);
  await page.getByRole('button', { name: 'Proposed changes', exact: true }).click();
  assert.match(await active.locator('.changed-text').innerText(), /Release locates/);
  for (let i = 0; i < 8; i++) {
    await page.getByRole('button', { name: 'Proposed changes', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Proposed changes', exact: true }).getAttribute('aria-pressed'), String(i % 2 === 1));
    assert.equal(await page.getByRole('region', { name: 'View options' }).count(), 1, 'A toggle must not be mistaken for an outside click after rebuilding the view.');
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('region', { name: 'View options' }).count(), 0);

  await requestUI(root, { action: 'open', description: 'queue', revision: 'working' });
  await active.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
  await page.getByRole('button', { name: 'The command interface exposes the queue operations.', exact: true }).click();
  await active.getByRole('heading', { name: 'Command interface', exact: true }).waitFor();
  assert.equal((await requestUI(root, { action: 'current' })).description, 'commands');
  assert.equal(await page.locator('.connection-target').count(), 0, 'A single description link should open without a chooser.');
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: 'working' });
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  const clipboardBefore = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('button', { name: 'Copy ID', exact: true }).click();
    let copied = false;
    for (let attempt = 0; attempt < 20 && !copied; attempt++) {
      copied = await app.evaluate(({ clipboard }) => clipboard.readText() === 'lease-transitions');
      if (!copied) await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(copied, 'Copy ID should write the selected stable identity.');
  } finally { await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), clipboardBefore); }
  await page.keyboard.press('Escape');
  const releasePassage = page.locator('.passage').filter({ hasText: 'Release locates the job and checks the worker and strictly future expiry.' }).first();
  await releasePassage.click();
  await page.locator('.highlighted').first().waitFor();
  assert.match(await page.locator('.detail').innerText(), /export function release/);
  assert.ok(await page.locator('.source-code .hljs-keyword').count(), 'Source keywords should be colored.');
  const displayedSource = await page.locator('.code-line code').allTextContents();
  assert.equal(displayedSource.join('\n'), readFileSync(join(root, 'src/queue.ts'), 'utf8'));
  assert.ok(await page.locator('.highlighted .hljs-keyword').count(), 'Passage backgrounds and syntax colors should coexist.');
  assert.equal(await active.getAttribute('data-description'), 'lease-transitions');
  assert.equal(await parentPane.count(), 0);
  await page.getByRole('button', { name: 'Close source', exact: true }).click();
  assert.equal(await parentPane.getAttribute('data-description'), 'job-lifecycle');
  assert.equal(await active.getAttribute('data-description'), 'lease-transitions');
  await releasePassage.click();
  await page.locator('.highlighted').first().waitFor();
  await page.locator('.source-code').click();
  await page.keyboard.press('ArrowLeft');
  await active.getByRole('heading', { name: 'Job lifecycle', exact: true }).waitFor();
  assert.equal(await page.locator('.detail').count(), 0, 'Arrow navigation from source returns to the selected description pair.');
  await requestUI(root, { action: 'open', description: 'lease-transitions' });
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();

  // Form controls keep their own key behavior; exercise the real revision selector.
  await page.getByRole('button', { name: 'View', exact: true }).click();
  const revisionControl = page.getByRole('combobox', { name: 'Revision' });
  await revisionControl.focus();
  const intercepted = await revisionControl.evaluate(e => !e.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
  assert.equal(intercepted, false, 'Description navigation must not cancel the revision selector arrow.');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'lease-transitions');
  await page.keyboard.press('Escape');
  // Editable text receives ordinary arrows without changing the reader selection.
  await page.evaluate(() => { const field = document.createElement('textarea'); field.id = 'editing-fixture'; field.value = 'one\ntwo'; document.body.append(field); field.focus(); });
  await page.keyboard.press('ArrowLeft');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'lease-transitions');
  await page.locator('#editing-fixture').evaluate(e => e.remove());

  assert.equal(await page.evaluate(() => typeof (window as any).require), 'undefined');
  assert.deepEqual(await page.evaluate(() => Object.keys((window as any).stratic).sort()), ['chooseProject', 'copyId', 'navigate', 'onSelection', 'source', 'view']);
  const escaped = await page.evaluate(async () => { try { await (window as any).stratic.source('../secret'); return false; } catch { return true; } });
  assert.equal(escaped, true);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'Tests', exact: true }).click();
  await page.getByRole('heading', { name: 'Tests', exact: true }).waitFor();
  assert.equal(await page.locator('.test-card .badge.pass').count(), 4);
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: base });
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  assert.doesNotMatch(await active.locator('.prose').innerText(), /Release locates the job/);
  assert.match(await page.locator('.titlebar').innerText(), /History/);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('combobox', { name: 'Revision' }).selectOption('working');
  await page.waitForFunction(() => !document.querySelector('.titlebar')?.textContent?.includes('History'));
  const metadataPath = join(root, 'stratic/descriptions/job-lifecycle.json'), metadata = readFileSync(metadataPath, 'utf8');
  writeFileSync(metadataPath, '{ broken');
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await page.getByRole('button', { name: /^Problems · [1-9]/ }).click();
  assert.match(await page.locator('.reading').innerText(), /job-lifecycle/);
  writeFileSync(metadataPath, metadata);
  const prosePath = join(root, 'stratic/descriptions/storage.md'), prose = readFileSync(prosePath, 'utf8');
  writeFileSync(prosePath, prose + '\n<img src=x onerror="window.injected=true">\n');
  await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await page.locator('.reading img').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).injected), undefined);
  writeFileSync(prosePath, prose);
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: 'working' });
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
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
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Child descriptions"] button').length === 300);
  assert.equal(await menu.getByRole('option').count(), 2, 'Unrelated leaves should not appear at this level.');
  assert.equal(await page.getByRole('region', { name: 'Child descriptions', exact: true }).getByRole('button').count(), 300);
  await page.getByRole('button', { name: 'Persistent storage preserves the queue between short-lived commands.', exact: true }).click();
  assert.equal(await page.locator('.connection-target').count(), 301, 'The chooser should retain the existing source link and all 300 added descriptions.');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'storage');
  await page.getByRole('button', { name: 'Operation 0 →', exact: true }).click();
  await active.getByRole('heading', { name: 'Operation 0', exact: true }).waitFor();
  assert.equal(await active.getByText('Unimplemented', { exact: true }).count(), 1);
  await menu.focus();
  assert.equal(await menu.getByRole('option').count(), 300);
  await page.keyboard.press('End');
  await active.getByRole('heading', { name: 'Operation 299', exact: true }).waitFor();
  assert.match(await menu.getByRole('option', { selected: true }).innerText(), /Operation 299/);
  const fits = await menu.evaluate(e => {
    const selected = e.querySelector('[aria-selected="true"]')!.getBoundingClientRect(), bounds = e.getBoundingClientRect();
    return selected.top >= bounds.top && selected.bottom <= bounds.bottom && bounds.bottom <= window.innerHeight;
  });
  assert.ok(fits, 'The selected leaf stays visible inside the bounded menu.');
  await active.getByRole('heading', { name: 'Operation 299', exact: true }).waitFor();
  assert.match(await page.locator('.changed-text').allTextContents().then(v => v.join(' ')), /Operation 299/);
  await page.screenshot({ path: 'artifacts/desktop-scale.png' });
  await page.getByRole('region', { name: 'Parent description', exact: true }).getByRole('button', { name: 'Persistent storage', exact: true }).click();
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await menu.getByRole('option').count(), 2);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 550));
  const controlsFit = await page.locator('.menu-body').evaluate(e => {
    const bounds = e.getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
  });
  assert.ok(controlsFit, 'The navigation panel fits the minimum supported window.');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  assert.ok(await page.locator('.view-popover').evaluate(e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }));
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'artifacts/desktop-small.png' });

  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 850));
  const notes = 'Context '.repeat(120);
  writeFileSync(join(root, 'stratic/descriptions/pair-parent.md'), '# Pair parent\n\nThe first detail elaborates this parent.\n\nThe second detail also elaborates this parent.\n\n' + Array.from({ length: 12 }, (_, i) => `Context ${i}: ${notes}`).join('\n\n') + '\n');
  writeFileSync(join(root, 'stratic/descriptions/pair-parent.json'), JSON.stringify({ id: 'pair-parent', parent: { description: 'queue', passage: { quote: 'The command interface exposes the queue operations.' } }, realization: 'implemented', links: [{ kind: 'implementation', from: { quote: 'The first detail elaborates this parent.' }, to: { path: 'src/queue.ts', passage: { quote: 'export function release' } } }] }));
  for (const [id, title, quote] of [['pair-a', 'First detail', 'The first detail elaborates this parent.'], ['pair-b', 'Second detail', 'The second detail also elaborates this parent.']]) {
    writeFileSync(join(root, `stratic/descriptions/${id}.md`), `# ${title}\n\n${notes}\n`);
    writeFileSync(join(root, `stratic/descriptions/${id}.json`), JSON.stringify({ id, parent: { description: 'pair-parent', passage: { quote } }, realization: 'implemented', links: id === 'pair-b' ? [{ kind: 'reference', from: null, to: { description: 'storage' } }] : [] }));
  }
  await requestUI(root, { action: 'open', description: 'pair-a', revision: 'working' });
  await active.getByRole('heading', { name: 'First detail', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'pair-parent');
  await parentPane.evaluate(e => { e.scrollTop = 300; });
  const parentScroll = await parentPane.evaluate(e => e.scrollTop);
  assert.ok(parentScroll > 200);
  await menu.focus();
  await page.keyboard.press('ArrowDown');
  await active.getByRole('heading', { name: 'Second detail', exact: true }).waitFor();
  assert.equal(await parentPane.evaluate(e => e.scrollTop), parentScroll, 'Sibling navigation preserves the visible parent position.');
  await active.evaluate(e => { e.scrollTop = 150; });
  assert.equal(await parentPane.evaluate(e => e.scrollTop), parentScroll, 'Each pane scrolls independently.');
  // A link clicked in the visible parent offers destinations beside that parent.
  await parentPane.getByRole('button', { name: 'The first detail elaborates this parent.', exact: true }).click();
  assert.equal(await page.locator('.connection-target').count(), 2);
  assert.equal(await page.locator('.description-pane').getAttribute('data-description'), 'pair-parent');
  await page.getByRole('button', { name: 'src/queue.ts →', exact: true }).click();
  await page.getByRole('heading', { name: 'src/queue.ts', exact: true }).waitFor();
  assert.equal(await active.getAttribute('data-description'), 'pair-parent');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'pair-parent');
  await page.getByRole('button', { name: 'Close source', exact: true }).click();
  assert.equal(await parentPane.getAttribute('data-description'), 'queue');
  assert.equal(await active.getAttribute('data-description'), 'pair-parent');
  // A cross-relationship uses the destination's hierarchy, never the previous page as a parent.
  await requestUI(root, { action: 'open', description: 'pair-b', revision: 'working' });
  await active.getByRole('heading', { name: 'Second detail', exact: true }).waitFor();
  await active.getByRole('button', { name: 'Persistent storage', exact: true }).click();
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'engine');
  await requestUI(root, { action: 'open', description: 'pair-a', revision: 'working' });
  await active.getByRole('heading', { name: 'First detail', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'pair-parent');
  // Invalid ancestry is still readable as a single pane.
  writeFileSync(join(root, 'stratic/descriptions/pair-a.json'), JSON.stringify({ id: 'pair-a', parent: { description: 'missing-parent', passage: { quote: 'Missing.' } }, realization: 'implemented', links: [] }));
  await page.waitForFunction(() => !document.querySelector('.parent-description'));
  assert.equal(await active.getAttribute('data-description'), 'pair-a');
  assert.equal(await page.locator('.layout.single-pane').count(), 1);

  writeFileSync(join(root, 'stratic/descriptions/pair-a.json'), JSON.stringify({ id: 'pair-a', parent: { description: 'pair-parent', passage: { quote: 'The first detail elaborates this parent.' } }, realization: 'partial', remaining: 'One detail is still missing.', links: [] }));
  await active.getByText('Partly implemented', { exact: true }).waitFor();
  assert.equal(await active.getByText('One detail is still missing.', { exact: true }).count(), 1);

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
  await app.close();
  const reopened = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [resolve('.')], env: { ...process.env, STRATIC_USER_DATA: join(directory, 'user-data') }, timeout: 30000 });
  try {
    const restored = await reopened.firstWindow();
    await restored.getByRole('complementary', { name: 'Projects' }).waitFor();
    assert.equal(await restored.locator('.project-option').count(), 2);
    await restored.locator('.project-option').first().click();
    await restored.locator('.active-description').getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();
  } finally { await reopened.close(); }

  console.log(JSON.stringify({ passed: true, navigationMs, checked: ['global arrows from prose, toolbar and source, folded menu, hierarchy boundaries, and form-control exceptions', 'quiet title-bar controls, exceptional status, and project switching with remembered folders', 'paired descriptions, sibling/depth navigation, independent scroll, and source from either pane', 'folding and agent navigation synchronization', '300 leaves in a bounded menu', 'direct single-destination links and multiple-destination chooser', 'syntax colors, multiline tokens, exact source text, and safe plain-text fallback', 'copyable identity', 'agent current/open', 'individual test results', 'historical content', 'broken draft browsing', 'inert repository HTML', 'sandboxed renderer API'], screenshot: resolve('artifacts/desktop.png') }, null, 2));
} catch (error) {
  const page = app.windows()[0];
  if (page) { await page.screenshot({ path: 'artifacts/desktop-failure.png' }); console.error(await page.locator('body').innerText()); }
  throw error;
} finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
