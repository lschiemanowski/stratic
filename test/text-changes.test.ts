import test from 'node:test';
import assert from 'node:assert/strict';
import { textChanges } from '../src/desktop/text-changes.ts';
test('Description changes distinguish insertion, replacement, deletion, and repeated paragraphs', () => {
  const old = '# Title\n\nKeep.\n\nReplace.\n\nRepeat.\n\nRepeat.\n';
  const next = '# Title\n\nKeep.\n\nNew.\n\nRepeat.\n';
  const change = textChanges(old, next);
  assert.deepEqual(change.additions.map(r => next.slice(r.start, r.end)), ['New.']);
  assert.deepEqual(change.removed, ['Replace.', 'Repeat.']);
  assert.deepEqual(textChanges(old, old), { additions: [], removed: [] });
  assert.deepEqual(textChanges(old, '').removed, ['# Title', 'Keep.', 'Replace.', 'Repeat.', 'Repeat.']);
  assert.equal(textChanges('', next).additions.length, 4);
});
test('Large fragmented descriptions have bounded comparison memory', () => {
  const old = 'old\n\n'.repeat(1100), next = 'new\n\n'.repeat(1100);
  assert.deepEqual(textChanges(old, next), { additions: [{ start: 0, end: next.length }], removed: [old] });
});
