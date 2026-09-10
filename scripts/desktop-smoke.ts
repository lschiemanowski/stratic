import { _electron } from 'playwright-core';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createQueue, addRelease } from './queue-example.ts';
import { checkQueue } from './queue-workflow.ts';
import { requestUI } from '../src/ui-channel.ts';
import { recordCheck } from '../src/review.ts';
import { repository, head, workingSnapshot } from '../src/git.ts';

const directory = mkdtempSync(join(tmpdir(), 'stratic-desktop-'));
const project = join(directory, 'queue'); createQueue(project); const root = repository(project), base = head(root);
addRelease(root);
for (const [id, summary] of [['queue', ['Local jobs persist between commands.', '<img src=x onerror="window.injected=true">']], ['engine', ['Successful queue changes persist.', 'Lease ownership constrains worker operations.']]] as [string, string[]][]) {
  const path = join(root, `stratic/descriptions/${id}.json`), metadata = JSON.parse(readFileSync(path, 'utf8'));
  metadata.summary = summary; writeFileSync(path, JSON.stringify(metadata));
}
// Tests attach directly to a description, independently of implementation links.
const releaseTestPath = join(root, 'stratic/tests/release-by-owner.json');
const releaseTest = JSON.parse(readFileSync(releaseTestPath, 'utf8'));
releaseTest.verifies.push({ description: 'lease-transitions', passage: { quote: 'Release locates the job and checks the worker and strictly future expiry.' } });
writeFileSync(releaseTestPath, JSON.stringify(releaseTest));
writeFileSync(join(root, 'stratic/tests/not-run.json'), JSON.stringify({ ...releaseTest, id: 'not-run', name: 'Unrecorded fixture', description: 'A catalog entry without individual execution evidence.', verifies: [releaseTest.verifies[1]] }));
checkQueue(root);
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [resolve('.'), '--project', root], env: { ...process.env, STRATIC_USER_DATA: join(directory, 'user-data') }, timeout: 30000 });
try {
  const page = await app.firstWindow();
  async function waitForDescription(id: string) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const found = await page.evaluate(async id => (await window.stratic.view()).project?.descriptions.some(d => d.id === id), id);
      if (found) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Fixture description did not load: ' + id);
  }
  const edgeChecks = await build({ entryPoints: ['scripts/reader-edge-checks.ts'], bundle: true, write: false, format: 'iife', globalName: 'readerEdgeChecks', platform: 'browser' });
  await page.evaluate(edgeChecks.outputFiles[0].text + '\nreaderEdgeChecks.checkSourceSizeBoundary(); readerEdgeChecks.checkDetachedTestReads();');
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
  await page.waitForFunction(() => document.querySelector('#project-panel')?.getAttribute('aria-busy') === 'false');
  await page.getByRole('button', { name: 'Hide projects', exact: true }).click();
  assert.equal(await projectPanel.count(), 0);
  assert.equal(await page.locator('.detail').count(), 0, 'A root has no empty detail placeholder.');
  const menu = page.getByRole('listbox', { name: 'Descriptions at this level' });
  const viewAction = async (name: string) => { await page.getByRole('button', { name: 'View', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click(); };
  await active.getByRole('button', { name: 'Summary', exact: true }).click();
  assert.equal(await active.locator('.summary-button').getAttribute('aria-pressed'), 'true');
  assert.equal(await active.locator('.summary-button .icon-summary').count(), 1);
  assert.equal(await active.locator('.description-summary li').count(), 2);
  assert.equal(await active.locator('.description-summary .changed-text').count(), 2);
  assert.equal(await page.locator('.description-summary img').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).injected), undefined);
  await page.keyboard.press('ArrowRight');
  await active.getByRole('heading', { name: 'Command interface', exact: true }).waitFor();
  assert.equal(await active.locator('.description-summary').count(), 0, 'A missing summary falls back to full text.');
  assert.equal(await active.getByRole('button', { name: 'Summary', exact: true }).count(), 0, 'No summary control without a summary.');
  assert.equal(await parentPane.locator('.description-summary').count(), 0, 'The other pane retains its independent choice.');
  await parentPane.getByRole('button', { name: 'Summary', exact: true }).click();
  assert.equal(await parentPane.locator('.description-summary li').count(), 2);
  await page.keyboard.press('ArrowDown');
  await active.getByRole('heading', { name: 'Queue engine', exact: true }).waitFor();
  assert.equal(await page.locator('.description-summary').count(), 2, 'Independent pane preferences survive navigation.');
  await page.screenshot({ path: 'artifacts/desktop-summaries.png' });
  await viewAction('Tree overview');
  await page.locator('.tree-node').first().waitFor();
  assert.equal(await page.locator('.tree-node[aria-current]').getAttribute('data-description'), 'engine');
  assert.equal(await page.locator('#menu-body').count(), 0);
  const levels = page.getByRole('slider', { name: 'Visible tree levels' });
  const setLevels = async (value: number) => { await levels.fill(String(value)); await levels.dispatchEvent('input'); };
  await page.getByRole('button', { name: 'Fold Queue engine', exact: true }).click();
  assert.equal(await page.locator('.tree-node[data-description="storage"]').count(), 0);
  assert.equal((await requestUI(root, { action: 'current' })).description, 'engine');
  await setLevels(1); assert.equal(await page.locator('.tree-node').count(), 1);
  await levels.focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await levels.inputValue(), '2', 'Slider arrows change depth, not the active description.');
  assert.equal((await requestUI(root, { action: 'current' })).description, 'engine');
  await setLevels(Number(await levels.getAttribute('max')));
  assert.equal(await page.locator('.tree-node[data-description="storage"]').count(), 0, 'Individual folds survive global depth changes.');
  await page.getByRole('button', { name: 'Expand Queue engine', exact: true }).click();
  assert.equal(await page.locator('.tree-node[data-description="storage"]').count(), 1);
  await page.getByRole('button', { name: 'Fold Local work queue', exact: true }).click();
  await page.getByRole('button', { name: 'Current description', exact: true }).click();
  assert.equal(await page.locator('.tree-node[aria-current]').getAttribute('data-description'), 'engine');
  await page.getByRole('button', { name: 'Fit tree', exact: true }).click();
  await page.screenshot({ path: 'artifacts/desktop-tree-compact.png' });
  await page.getByRole('button', { name: 'Back to reading', exact: true }).click();
  assert.equal(await page.locator('.description-summary').count(), 2);
  assert.equal(await page.locator('#menu-body').count(), 1);
  await active.getByRole('button', { name: 'Summary', exact: true }).click();
  assert.equal(await parentPane.locator('.description-summary').count(), 1, 'Toggling the active pane leaves the parent summary visible.');
  await parentPane.getByRole('button', { name: 'Summary', exact: true }).click();
  assert.equal(await page.locator('.description-summary').count(), 0);
  await requestUI(root, { action: 'open', description: 'queue' });
  await active.getByRole('heading', { name: 'Local work queue', exact: true }).waitFor();

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
  assert.deepEqual(await page.evaluate(() => Object.keys((window as any).stratic).sort()), ['chooseProject', 'copyId', 'image', 'navigate', 'onSelection', 'source', 'view']);
  const escaped = await page.evaluate(async () => { try { await (window as any).stratic.source('../secret'); return false; } catch { return true; } });
  assert.equal(escaped, true);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Tests', exact: true }).count(), 0, 'There is no separate Tests view.');
  await page.keyboard.press('Escape');
  assert.equal(await parentPane.locator('.result-disk.pass').count(), 4);
  assert.equal(await active.locator('.test-row').count(), 2, 'Only directly associated tests appear, without inheriting all parent tests.');
  assert.equal(await active.locator('.result-disk.unrecorded').count(), 1, 'Aggregate pass never supplies an unnamed individual result.');
  await releasePassage.click();
  const testRow = page.locator('.detail .test-row[data-test="release-by-owner"]');
  await testRow.locator(':scope > summary').click();
  await testRow.locator('.source-code .highlighted').first().waitFor();
  assert.match(await testRow.innerText(), /Release keeps the job/);
  assert.ok(await testRow.locator('.source-code').evaluate(code => {
    const selected = code.querySelector('.highlighted')!.getBoundingClientRect(), viewport = code.getBoundingClientRect();
    return selected.top >= viewport.top && selected.top < viewport.bottom;
  }), 'Expanded code is positioned at the linked test, retaining original line numbers.');
  assert.equal(await page.locator('.detail > .source-code').count(), 1, 'Expanding test code retains the implementation.');
  assert.equal(await page.locator('.detail .test-row').count(), 2);
  assert.equal(await active.getAttribute('data-description'), 'lease-transitions');
  await page.screenshot({ path: resolve('artifacts/desktop-context-tests.png') });
  // Synthetic evidence exercises presentation states; this is not a claim that queue execution failed.
  const evidenceTree = workingSnapshot(root);
  recordCheck(root, { tree: evidenceTree, method: 'Synthetic desktop status fixture', outcome: 'fail', environment: 'UI test fixture', evidence: 'Exercise a current individual failure and inconclusive result.', tests: [{ id: 'release-by-owner', outcome: 'fail' }, { id: 'release-invalid', outcome: 'inconclusive' }] });
  await testRow.locator('.result-disk.fail').waitFor();
  await testRow.locator('.source-code').waitFor();
  assert.equal(await testRow.getAttribute('open'), '', 'Result refresh preserves the expanded test.');
  const changedDescription = join(root, 'stratic/descriptions/lease-transitions.md');
  const beforeEvidenceEdit = readFileSync(changedDescription, 'utf8');
  writeFileSync(changedDescription, beforeEvidenceEdit + '\n');
  await testRow.locator('.result-disk.earlier').waitFor();
  assert.match(await testRow.locator(':scope > summary').innerText(), /Earlier fail/);
  assert.equal(await page.locator('.detail .result-disk.pass, .detail .result-disk.fail').count(), 0, 'Changed content cannot retain solid current pass/fail disks.');
  recordCheck(root, { tree: workingSnapshot(root), method: 'Newer synthetic desktop result', outcome: 'pass', environment: 'UI test fixture', evidence: 'A newer record for different content must not obscure a matching failure.', tests: [{ id: 'release-by-owner', outcome: 'pass' }] });
  await testRow.locator('.result-disk.pass').waitFor();
  writeFileSync(changedDescription, beforeEvidenceEdit);
  await testRow.locator('.result-disk.fail').waitFor();
  assert.equal(await testRow.locator('.result-disk').getAttribute('aria-label'), 'Current fail', 'An older matching failure wins over a newer stale pass.');
  assert.equal(await testRow.getAttribute('open'), '', 'Content refresh preserves the expanded test.');
  await testRow.locator('.source-code').waitFor();
  assert.match(await testRow.locator('.test-evidence').first().textContent() ?? '', /Synthetic desktop status fixture/);
  const testSourcePath = join(root, releaseTest.code[0].path), beforeTestEdit = readFileSync(testSourcePath, 'utf8');
  const refreshMarker = '// Source refreshed while the test stays open.';
  writeFileSync(testSourcePath, beforeTestEdit + '\n' + refreshMarker + '\n');
  await testRow.locator('.result-disk.earlier').waitFor();
  assert.equal(await testRow.getAttribute('open'), '', 'Content refresh preserves the expanded test.');
  await testRow.locator('.source-code').getByText(refreshMarker, { exact: true }).waitFor();
  assert.equal(await page.locator('.detail > .source-code').count(), 1, 'Refreshing test code retains the implementation.');
  writeFileSync(testSourcePath, beforeTestEdit);
  await testRow.locator('.result-disk.fail').waitFor();
  await page.waitForFunction(marker => !document.querySelector('.detail .test-row[data-test="release-by-owner"] .source-code')?.textContent?.includes(marker), refreshMarker);
  assert.equal(await testRow.getAttribute('open'), '', 'Restoring source also keeps the test expanded.');
  writeFileSync(testSourcePath, beforeTestEdit.replace(releaseTest.code[0].passage.quote, '// Linked test moved in this fixture.'));
  await testRow.locator('.problem').waitFor();
  assert.equal(await testRow.getAttribute('open'), '', 'A broken test link remains open for inspection.');
  assert.equal(await testRow.locator('.source-code').count(), 0, 'A missing passage reports a problem instead of retaining old test code.');
  writeFileSync(testSourcePath, beforeTestEdit);
  await testRow.locator('.source-code .highlighted').first().waitFor();
  await testRow.locator('.result-disk.fail').waitFor();
  await page.getByRole('button', { name: 'Close source', exact: true }).click();
  await parentPane.locator('.result-disk.inconclusive').waitFor();
  assert.match(await parentPane.innerText(), /Current inconclusive/);
  await requestUI(root, { action: 'open', description: 'lease-transitions', revision: base });
  await active.getByRole('heading', { name: 'Lease transitions', exact: true }).waitFor();
  assert.doesNotMatch(await active.locator('.prose').innerText(), /Release locates the job/);
  assert.equal(await page.locator('.summary-button').count(), 0, 'Historical descriptions do not borrow current summary controls.');
  assert.equal(await page.locator('.description-summary').count(), 0, 'Historical descriptions must not borrow summaries from working files.');
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
  await viewAction('Tree overview');
  const nodeCount = (await page.evaluate(() => window.stratic.view())).project!.descriptions.length;
  assert.equal(await page.locator('.tree-node').count(), nodeCount);
  assert.equal(await page.locator('.tree-canvas path').count(), nodeCount - 1);
  await page.waitForFunction(() => document.querySelector<HTMLElement>('.tree-canvas')?.style.transform.includes('scale('));
  const transform = await page.locator('.tree-canvas').getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.notEqual(await page.locator('.tree-canvas').getAttribute('style'), transform);
  const zoomed = await page.locator('.tree-canvas').getAttribute('style');
  await page.locator('.tree-viewport').hover(); await page.mouse.wheel(100, 80);
  await page.waitForFunction(before => document.querySelector('.tree-canvas')?.getAttribute('style') !== before, zoomed);
  assert.equal((await requestUI(root, { action: 'current' })).description, 'storage');
  await page.getByRole('button', { name: 'Current description', exact: true }).click();
  await page.screenshot({ path: 'artifacts/desktop-tree.png' });
  await page.locator('.tree-node[data-description="storage"]').click();
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  assert.equal(await parentPane.getAttribute('data-description'), 'engine');

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
  await waitForDescription('pair-a');
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
  await viewAction('Tree overview');
  assert.equal(await page.locator('.tree-node[data-description="pair-a"]').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await active.getAttribute('data-description'), 'pair-a');

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
  // Formatted prose keeps source links and never turns repository HTML into active DOM.
  const network: string[] = []; page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  mkdirSync(join(root, 'stratic/assets'), { recursive: true });
  const drawing = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="70"><rect width="240" height="70" rx="10" fill="seagreen"/><script>parent.injected=true</script><text x="20" y="42" fill="white">Project image</text></svg>';
  writeFileSync(join(root, 'stratic/assets/diagram.svg'), drawing);
  const rich = '# Formatted description\n\nA **bold** claim with *emphasis*, ~~old text~~ and &amp;.\n\n- First item\n- Second item\n\n> A quoted responsibility.\n\n| Promise | State |\n| --- | --- |\n| Persists | Yes |\n\nInline $x^2$ and a displayed equation:\n\n$$\n\\frac{a}{b} = \\sum_{i=1}^{n} x_i\n$$\n\n![Project diagram](../assets/diagram.svg)\n\n```ts\nconst value = "<img src=x>";\n```\n\n- [x] Completed condition\n\nBad equation $\\notacommand{x}$.\n\n$\\href{javascript:alert(1)}{bad}$\n\n![Remote image](https://example.invalid/image.png)\n\n![Missing image](missing.png)\n\n<img src=x onerror="window.injected=true">\n\n[Unsafe](javascript:alert(1))\n';
  writeFileSync(join(root, 'stratic/descriptions/rich.md'), rich);
  writeFileSync(join(root, 'stratic/descriptions/rich.json'), JSON.stringify({ id: 'rich', parent: { description: 'queue', passage: { quote: 'A local work queue keeps jobs between command-line invocations.' } }, realization: 'implemented', links: [
    { kind: 'reference', from: { quote: 'A **bold** claim' }, to: { description: 'engine' } },
    { kind: 'reference', from: { quote: '&amp;' }, to: { description: 'storage' } },
    { kind: 'reference', from: { quote: '\\frac{a}{b}' }, to: { description: 'engine' } },
  ] }));
  await waitForDescription('rich');
  await requestUI(root, { action: 'open', description: 'rich' });
  await active.getByRole('heading', { name: 'Formatted description', exact: true }).waitFor();
  assert.equal(await active.locator('strong').innerText(), 'bold');
  assert.equal(await active.locator('table tbody td').count(), 2);
  assert.equal(await active.locator('blockquote').innerText(), 'A quoted responsibility.');
  assert.equal(await active.locator('.task-item input:checked:disabled').count(), 1);
  assert.ok(await active.locator('.katex').count() >= 2);
  assert.equal(await active.locator('.display-equation .katex').count(), 1);
  assert.ok(await active.locator('.math-error').count() >= 1);
  await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('.active-description .description-image img'); return image?.complete && image.naturalWidth === 240; });
  assert.equal(await active.locator('.image-error').count(), 2);
  assert.equal(await active.locator('a, script, img[onerror]').count(), 0);
  assert.equal(await page.evaluate(() => (window as any).injected), undefined);
  assert.deepEqual(network, []);
  assert.equal(await active.locator('.markdown-code .hljs-keyword').innerText(), 'const');
  assert.ok(await active.locator('table.changed-text').count() > 0);
  await active.getByRole('button', { name: 'bold', exact: true }).click();
  await active.getByRole('heading', { name: 'Queue engine', exact: true }).waitFor();
  await requestUI(root, { action: 'open', description: 'rich', passage: { quote: '**bold**' } });
  await active.locator('strong .selected').waitFor();
  await active.getByRole('button', { name: '&', exact: true }).click();
  await active.getByRole('heading', { name: 'Persistent storage', exact: true }).waitFor();
  await requestUI(root, { action: 'open', description: 'rich' });
  await active.locator('.display-equation[role="button"]').click();
  await active.getByRole('heading', { name: 'Queue engine', exact: true }).waitFor();
  await requestUI(root, { action: 'open', description: 'rich' });
  await active.getByRole('heading', { name: 'Formatted description', exact: true }).waitFor();
  const imageBefore = await active.locator('.description-image img').getAttribute('src');
  writeFileSync(join(root, 'stratic/assets/diagram.svg'), drawing.replace('seagreen', 'navy'));
  await page.waitForFunction(before => { const image = document.querySelector<HTMLImageElement>('.active-description .description-image img'); return image?.complete && image.naturalWidth === 240 && image.src !== before; }, imageBefore);
  await active.evaluate(e => { e.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/desktop-markdown.png' });
  assert.deepEqual(network, []);
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

  console.log(JSON.stringify({ passed: true, navigationMs, checked: ['formatted Markdown, equations, local image refresh, source-position links, and inert hostile content', 'optional summaries in both panes, safe bullets, change highlights, navigation persistence, and historical fallback', 'compact spatial overview, individual folds, depth slider, current-node reveal, 300 leaves, zoom/pan, selection return and broken drafts', 'global arrows from prose, toolbar and source, folded menu, hierarchy boundaries, and form-control exceptions', 'quiet title-bar controls, exceptional status, and project switching with remembered folders', 'paired descriptions, sibling/depth navigation, independent scroll, and source from either pane', 'folding and agent navigation synchronization', '300 leaves in a bounded menu', 'direct single-destination links and multiple-destination chooser', 'syntax colors, multiline tokens, exact source text, and plain-text fallback across the 200,000-character boundary', 'copyable identity', 'agent current/open', 'contextual tests, expanded source refresh, late response isolation, current-result precedence, and current/earlier/pass/fail/inconclusive/unrecorded evidence', 'historical content', 'broken draft browsing', 'inert repository HTML', 'sandboxed renderer API'], screenshot: resolve('artifacts/desktop.png') }, null, 2));
} catch (error) {
  const page = app.windows()[0];
  if (page) { await page.screenshot({ path: 'artifacts/desktop-failure.png' }); console.error(await page.locator('body').innerText()); }
  throw error;
} finally { await app.close(); rmSync(directory, { recursive: true, force: true }); }
