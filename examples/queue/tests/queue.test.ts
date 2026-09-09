import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { put, claim, acknowledge } from '../src/queue.ts';

function queue(t: test.TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'queue-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'jobs.json');
}

test('Claims follow insertion order and expired jobs become available', t => {
  const path = queue(t);
  const a = put(path, 'first'); put(path, 'second');
  assert.equal(claim(path, 'a', 0)?.id, a.id);
  assert.equal(claim(path, 'b', 1)?.text, 'second');
  assert.equal(claim(path, 'c', 2), null);
  assert.equal(claim(path, 'c', 30_000)?.id, a.id);
});

test('Only the owner of a live lease can acknowledge a job', t => {
  const path = queue(t); const job = put(path, 'work');
  claim(path, 'a', 0);
  const before = readFileSync(path, 'utf8');
  assert.throws(() => acknowledge(path, job.id, 'b', 1));
  assert.throws(() => acknowledge(path, job.id, 'a', 30_000));
  assert.throws(() => acknowledge(path, 999, 'a', 1));
  assert.equal(readFileSync(path, 'utf8'), before);
  acknowledge(path, job.id, 'a', 1);
  assert.equal(claim(path, 'b', 2), null);
});
