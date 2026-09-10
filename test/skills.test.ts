import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fixture } from './helpers.ts';

const executable = resolve('src/cli.ts');
const bundled = (name: string) => readFileSync(resolve('skills', name, 'SKILL.md'), 'utf8');
function command(root: string, args: string[], status = 0) {
  const result = spawnSync(process.execPath, [executable, '--project', root, 'skill', ...args], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(result.error); assert.equal(result.status, status, result.stdout + result.stderr);
  assert.equal(status === 0 ? result.stderr : result.stdout, '');
  return JSON.parse(status === 0 ? result.stdout : result.stderr);
}

test('skill CLI installs core and optional TDD without changing project conventions or local additions', t => {
  const root = fixture(t), directory = join(root, '.agents/skills');
  writeFileSync(join(root, 'AGENTS.md'), 'Use the project workflow chosen for this task.');
  assert.ok(command(root, ['status']).every((item: { status: string }) => item.status === 'not-installed'));
  assert.equal(existsSync(directory), false, 'Status must not create installation state.');
  assert.deepEqual(command(root, ['install']).written, ['.agents/skills/stratic-v3/SKILL.md']);
  assert.equal(existsSync(join(directory, 'stratic-v3-tdd')), false);
  assert.equal(readFileSync(join(directory, 'stratic-v3/SKILL.md'), 'utf8'), bundled('stratic-v3'));
  writeFileSync(join(directory, 'stratic-v3/project-notes.md'), 'Local workflow notes');
  assert.deepEqual(command(root, ['install', '--with', 'tdd']).written, ['.agents/skills/stratic-v3-tdd/SKILL.md']);
  const record = readFileSync(join(directory, '.stratic-v3.json'), 'utf8');
  assert.deepEqual(command(root, ['install', '--with', 'tdd']).written, []);
  assert.deepEqual(command(root, ['update']).written, []);
  assert.equal(readFileSync(join(directory, '.stratic-v3.json'), 'utf8'), record);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), 'Use the project workflow chosen for this task.');
  assert.equal(readFileSync(join(directory, 'stratic-v3/project-notes.md'), 'utf8'), 'Local workflow notes');
  assert.equal(readFileSync(join(directory, 'stratic-v3-tdd/SKILL.md'), 'utf8'), bundled('stratic-v3-tdd'));
});

test('skill updates distinguish upstream changes from local edits and preflight all selected files', t => {
  const root = fixture(t), directory = join(root, '.agents/skills');
  command(root, ['install', '--with', 'tdd']);
  const core = join(directory, 'stratic-v3/SKILL.md'), tdd = join(directory, 'stratic-v3-tdd/SKILL.md'), manifest = join(directory, '.stratic-v3.json');
  // An installed older bundle remains unmodified; the other installed skill has a local edit.
  const record = JSON.parse(readFileSync(manifest, 'utf8'));
  writeFileSync(core, 'Earlier core release'); record['stratic-v3'] = createHash('sha256').update('Earlier core release').digest('hex');
  writeFileSync(manifest, JSON.stringify(record)); writeFileSync(tdd, bundled('stratic-v3-tdd') + '\nLocal TDD convention\n');
  const before = [core, tdd, manifest].map(path => readFileSync(path, 'utf8'));
  assert.deepEqual(command(root, ['status']).map((item: { status: string }) => item.status), ['outdated', 'modified']);
  assert.match(command(root, ['update'], 1).error, /Skills were not changed/);
  assert.deepEqual([core, tdd, manifest].map(path => readFileSync(path, 'utf8')), before, 'A conflict must not partially update other skills or the record.');
  command(root, ['install'], 1);
  writeFileSync(tdd, bundled('stratic-v3-tdd'));
  assert.deepEqual(command(root, ['update']).written, ['.agents/skills/stratic-v3/SKILL.md']);
  assert.equal(readFileSync(core, 'utf8'), bundled('stratic-v3'));
  assert.ok(command(root, ['status']).every((item: { status: string }) => item.status === 'current'));
  rmSync(tdd); command(root, ['update'], 1); command(root, ['install', '--with', 'tdd'], 1);
  assert.equal(existsSync(tdd), false, 'A locally deleted skill must not be silently restored.');
});

test('skill CLI rejects invalid requests and unsafe installation boundaries without overwriting files', t => {
  const root = fixture(t), directory = join(root, '.agents/skills');
  for (const args of [[], ['bogus'], ['install', '--with', 'unknown'], ['install', '--with'], ['install', 'extra'], ['install', '--with', 'tdd', '--with', 'tdd'], ['install', '--revision', 'HEAD'], ['update', '--with', 'tdd'], ['update'], ['status', 'extra']]) {
    command(root, args, 1); assert.equal(existsSync(join(root, '.agents')), false);
  }
  const outside = join(root, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'sentinel'), 'Keep');
  symlinkSync(outside, join(root, '.agents'));
  command(root, ['install'], 1); command(root, ['status'], 1); rmSync(join(root, '.agents'));
  mkdirSync(join(directory, 'stratic-v3'), { recursive: true });
  mkdirSync(join(directory, 'stratic-v3-tdd'));
  symlinkSync(join(outside, 'sentinel'), join(directory, 'stratic-v3-tdd/SKILL.md'));
  command(root, ['install'], 1);
  assert.equal(existsSync(join(directory, 'stratic-v3/SKILL.md')), false, 'Even an unselected workflow must not cause the final status read to fail after core installation.');
  assert.equal(existsSync(join(directory, '.stratic-v3.json')), false);
  rmSync(join(directory, 'stratic-v3-tdd'), { recursive: true });

  symlinkSync(join(outside, 'sentinel'), join(directory, 'stratic-v3/SKILL.md'));
  command(root, ['install'], 1); assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'Keep');
  rmSync(join(directory, 'stratic-v3/SKILL.md')); writeFileSync(join(directory, 'stratic-v3/SKILL.md'), 'Existing custom skill');
  command(root, ['install', '--with', 'tdd'], 1); assert.equal(existsSync(join(directory, 'stratic-v3-tdd')), false);
  assert.equal(readFileSync(join(directory, 'stratic-v3/SKILL.md'), 'utf8'), 'Existing custom skill');
  assert.equal(command(root, ['status'])[0].status, 'unmanaged');
  writeFileSync(join(directory, '.stratic-v3.json'), JSON.stringify({ '../outside': 'f'.repeat(64) }));
  command(root, ['install'], 1); command(root, ['status'], 1);
  rmSync(join(directory, '.stratic-v3.json')); symlinkSync(join(outside, 'sentinel'), join(directory, '.stratic-v3.json'));
  command(root, ['install'], 1); assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'Keep');
});
