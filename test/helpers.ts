import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TestContext } from 'node:test';
import { createQueue, addRelease } from '../scripts/queue-example.ts';
import { prepare } from '../src/review.ts';
import { selected, releaseReview } from '../scripts/queue-workflow.ts';
export { selected, checkQueue, releaseReview } from '../scripts/queue-workflow.ts';

export function fixture(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), 'stratic-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = join(directory, 'project'); createQueue(root); return root;
}
export function preparedRelease(root: string) { addRelease(root); return prepare(root, selected(root), releaseReview(root)); }
