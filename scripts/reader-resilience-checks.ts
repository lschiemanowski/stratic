import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { git, head, repository, workingSnapshot } from '../src/git.ts';
import { requestUI } from '../src/ui-channel.ts';
import { accept, prepare } from '../src/review.ts';
import { createQueue, addRelease } from './queue-example.ts';
import { releaseReview, selected } from './queue-workflow.ts';

export async function checkReaderResilience(page: Page, root: string) {
  console.log('Checking deleted and renamed source refresh.');
  const active = page.locator('.active-description');
  const sourcePath = join(root, 'src/syntax-fixture.ts'), originalSource = readFileSync(sourcePath, 'utf8');
  const descriptionPath = join(root, 'stratic/descriptions/storage.md'), originalDescription = readFileSync(descriptionPath, 'utf8');
  for (const action of ['delete', 'rename']) {
    await requestUI(root, { action: 'open', description: 'storage', revision: 'working' });
    await page.getByRole('button', { name: 'src/syntax-fixture.ts', exact: true }).click();
    await page.getByRole('heading', { name: 'src/syntax-fixture.ts', exact: true }).waitFor();
    if (action === 'delete') rmSync(sourcePath); else renameSync(sourcePath, sourcePath + '.moved');
    await page.locator('.detail .problem').filter({ hasText: 'Source unavailable:' }).waitFor();
    assert.equal((await page.locator('.detail > .source-code code').allTextContents()).join(''), '', 'The previous source body is cleared.');
    const marker = `The description refreshes after source ${action}.`;
    writeFileSync(descriptionPath, originalDescription + '\n' + marker + '\n');
    await active.getByText(marker, { exact: true }).waitFor();
    writeFileSync(sourcePath, originalSource);
    if (action === 'rename') rmSync(sourcePath + '.moved');
    await page.waitForFunction(() => !document.querySelector('.detail > .problem'));
    assert.ok((await page.locator('.detail > .source-code').innerText()).includes('const'));
    writeFileSync(descriptionPath, originalDescription);
  }
  // Commit the image fixture, then alter working bytes: history must read the old image.
  console.log('Checking historical image identity.');
  mkdirSync(join(root, 'unrelated-directory/nested'), { recursive: true });
  writeFileSync(join(root, 'unrelated-directory/nested/old.txt'), 'Original tracked content');
  git(root, ['add', '-A']); git(root, ['commit', '-qm', 'Historical image fixture']);
  const historical = head(root);
  const imagePath = join(root, 'stratic/assets/diagram.svg');
  const oldImage = readFileSync(imagePath, 'utf8');
  writeFileSync(imagePath, oldImage.replace('width="240"', 'width="320"'));
  await requestUI(root, { action: 'open', description: 'rich', revision: historical });
  await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.active-description .description-image img')?.naturalWidth === 240);
  const staleRequest = await page.evaluate(async () => {
    const view = await window.stratic.view();
    return { project: view.project!.root, revision: view.project!.revision, tree: view.tree, description: 'rich', url: '../assets/diagram.svg' };
  });
  await requestUI(root, { action: 'open', description: 'rich', revision: 'working' });
  await page.waitForFunction(() => document.querySelector<HTMLImageElement>('.active-description .description-image img')?.naturalWidth === 320);
  assert.equal(await page.evaluate(async request => { try { await window.stratic.image(request); return false; } catch { return true; } }, staleRequest), true);
  symlinkSync('/missing-outside-target', join(root, 'unrelated-symlink'));
  rmSync(join(root, 'unrelated-directory'), { recursive: true });
  symlinkSync('/missing-outside-directory', join(root, 'unrelated-directory'));
  const malformedPath = join(root, 'stratic/reviews/malformed.json');
  mkdirSync(join(root, 'stratic/reviews'), { recursive: true }); writeFileSync(malformedPath, 'null');
  await page.waitForFunction(async () => (await window.stratic.view()).project?.issues.some(i => i.path === 'stratic/reviews/malformed.json'));
  assert.equal(await active.getByRole('heading', { name: 'Formatted description', exact: true }).count(), 1);
  rmSync(malformedPath);
}

export function reviewedClone(directory: string): { root: string; contentTree: string } {
  const original = join(directory, 'reviewed-original'); createQueue(original); addRelease(original);
  const proposal = prepare(original, selected(original), releaseReview(original)); accept(original, proposal.id);
  const clone = join(directory, 'reviewed-clone'); git(original, ['clone', '--no-local', original, clone]);
  assert.throws(() => git(clone, ['cat-file', '-t', proposal.contentTree]));
  workingSnapshot(clone);
  return { root: repository(clone), contentTree: proposal.contentTree };
}
