import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './helpers.ts';
import { addRelease } from '../scripts/queue-example.ts';

test('The example command interface validates arguments and exposes early release', t => {
  const root = fixture(t), path = join(root, 'jobs.json');
  const command = (...args: string[]) => execFileSync(process.execPath, ['src/cli.ts', path, ...args], { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.throws(() => command('claim'));
  assert.throws(() => command('put'));
  assert.equal(existsSync(path), false);
  const job = JSON.parse(command('put', 'report'));
  command('claim', 'worker-a');
  const saved = readFileSync(path, 'utf8');
  assert.throws(() => command('ack', 'not-a-number', 'worker-a'));
  assert.throws(() => command('ack', String(job.id)));
  assert.equal(readFileSync(path, 'utf8'), saved);
  addRelease(root);
  assert.throws(() => command('release', String(job.id), 'worker-b'));
  assert.equal(readFileSync(path, 'utf8'), saved);
  command('release', String(job.id), 'worker-a');
  assert.equal(JSON.parse(command('claim', 'worker-b')).id, job.id);
});
