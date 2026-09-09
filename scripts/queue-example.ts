import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, writeJson } from '../src/git.ts';
import type { Metadata, TestRecord } from '../src/model.ts';

const source = fileURLToPath(new URL('../examples/queue/', import.meta.url));
const releaseCode = `
export function release(path: string, id: number, worker: string, now = Date.now()) {
  return update(path, state => {
    const job = state.jobs.find(job => job.id === id);
    if (!job || job.owner !== worker || job.until === null || job.until <= now) throw new Error('A live lease owned by this worker is required.');
    job.owner = null;
    job.until = null;
  });
}
`;
const releaseTests = `
test('Release keeps the job and makes it immediately claimable', t => {
  const path = queue(t); const job = put(path, 'work');
  claim(path, 'a', 0); release(path, job.id, 'a', 1);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(saved.jobs[0].owner, null);
  assert.equal(saved.jobs[0].until, null);
  assert.equal(claim(path, 'b', 2)?.id, job.id);
});

test('Missing jobs and invalid release leases leave storage unchanged', t => {
  const path = queue(t); const job = put(path, 'work');
  claim(path, 'a', 0);
  const before = readFileSync(path, 'utf8');
  assert.throws(() => release(path, job.id, 'b', 1));
  assert.throws(() => release(path, job.id, 'a', 30_000));
  assert.throws(() => release(path, 999, 'a', 1));
  assert.equal(readFileSync(path, 'utf8'), before);
});
`;
export function createQueue(root: string) {
  if (existsSync(root)) throw new Error('Example destination must not exist.');
  mkdirSync(root, { recursive: true }); cpSync(source, root, { recursive: true });
  writeJson(join(root, 'package.json'), { type: 'module', scripts: { test: 'node --test tests/queue.test.ts' } });
  writeFileSync(join(root, '.gitignore'), '*.tmp\njobs.json\n');
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.name', 'Stratic example']); git(root, ['config', 'user.email', 'example@stratic.invalid']);
  describeQueue(root, false);
  git(root, ['add', '.']); git(root, ['commit', '-qm', 'Describe the baseline work queue']);
}
export function addRelease(root: string) {
  const code = join(root, 'src/queue.ts');
  if (readFileSync(code, 'utf8').includes('export function release')) throw new Error('Release already exists.');
  writeFileSync(code, readFileSync(code, 'utf8') + releaseCode);
  const cli = join(root, 'src/cli.ts');
  writeFileSync(cli, readFileSync(cli, 'utf8').replace('put, claim, acknowledge', 'put, claim, acknowledge, release')
    .replace("  default:", "  case 'release': release(path, jobId(first), required(second, 'a worker name')); break;\n  default:")
    .replace('or ack JOB_ID WORKER.', 'ack JOB_ID WORKER, or release JOB_ID WORKER.'));
  const tests = join(root, 'tests/queue.test.ts');
  writeFileSync(tests, readFileSync(tests, 'utf8').replace('put, claim, acknowledge', 'put, claim, acknowledge, release') + releaseTests);
  describeQueue(root, true);
}
export function describeQueue(root: string, released: boolean) {
  const put = 'Submitting work appends a job with a monotonically increasing identifier.';
  const claim = 'Claiming selects the oldest available job and grants a 30-second lease; an expired job is available again.';
  const ack = 'Acknowledgement removes a job only when the requesting worker owns its live lease; invalid requests leave state unchanged.';
  const release = 'The worker holding a live lease can release the job. Release makes it immediately available again without deleting it; missing jobs and invalid leases leave state unchanged.';
  const rootBody = 'The local work queue is a command-line application for producers and workers on one machine. Each invocation submits work or performs one worker operation and exits.\n\nThe command interface exposes the queue operations. The queue engine keeps jobs available across invocations and manages temporary ownership.\n\nA producer can submit a report job, and a worker can claim and complete it later. Jobs survive process restarts. This example supports one writer at a time.';
  const engine = 'The queue engine manages work independently of how commands are invoked. It controls when workers may claim or complete jobs. It persists successful operations between invocations.';
  const lifecycleIntro = 'The job lifecycle governs submission and worker operations.';
  const lifecycle = [lifecycleIntro, put, claim, ack, ...(released ? [release] : [])].join('\n\n');
  const putDetail = 'Submission uses the next identifier, advances it, and appends an unleased job to the stored list.';
  const claimDetail = 'Claiming scans the list in insertion order for an unleased job or a lease whose expiry is at or before the supplied time. It records the worker and an expiry 30 seconds later.';
  const ackDetail = 'Acknowledgement locates the job, checks its worker and strictly future expiry, and removes it from the stored list. A failed check throws before storage is written.';
  const releaseDetail = 'Release locates the job and checks the worker and strictly future expiry. It clears the owner and expiry fields, retaining the job and its position in the list. A failed check throws before storage is written.';
  const transitions = ['Queue transitions implement the lifecycle using an ordered list of jobs with nullable lease fields.', putDetail, claimDetail, ackDetail, ...(released ? [releaseDetail] : [])].join('\n\n');
  const storage = 'Persistent storage preserves the queue between short-lived commands. A successful operation writes the complete state to a temporary file and atomically replaces the queue file. An operation that throws does not write the changed state. Concurrent writers are outside this example’s scope.';
  const command = 'The command interface accepts a queue-file path and an operation. Producers submit text with put. Workers claim with a worker name and acknowledge with a job identifier and worker name.' + (released ? ' Workers may also release a live lease with a job identifier and worker name.' : '') + ' Invalid requests report an error.';
  const write = (id: string, title: string, body: string, parent: Metadata['parent'], links: Metadata['links'] = []) => {
    const file = join(root, 'stratic/descriptions', id); mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file + '.md', `# ${title}\n\n${body}\n`);
    writeJson(file + '.json', { id, parent, realization: 'implemented', links });
  };
  const parent = (description: string, quote: string) => ({ description, passage: { quote } });
  const code = readFileSync(join(root, 'src/queue.ts'), 'utf8');
  const functions = (name: string) => code.slice(code.indexOf(`export function ${name}(`)).split('\nexport function ')[0].trimEnd();
  const implementation = (from: string, path: string, quote: string): Metadata['links'][number] => ({ kind: 'implementation', from: { quote: from }, to: { path, passage: { quote } } });
  write('queue', 'Local work queue', rootBody, null);
  write('engine', 'Queue engine', engine, parent('queue', 'The queue engine keeps jobs available across invocations and manages temporary ownership.'));
  write('job-lifecycle', 'Job lifecycle', lifecycle, parent('engine', 'It controls when workers may claim or complete jobs.'));
  write('lease-transitions', 'Lease transitions', transitions, parent('job-lifecycle', lifecycleIntro), [
    implementation(putDetail, 'src/queue.ts', functions('put')), implementation(claimDetail, 'src/queue.ts', functions('claim')),
    implementation(ackDetail, 'src/queue.ts', functions('acknowledge')), ...(released ? [implementation(releaseDetail, 'src/queue.ts', functions('release'))] : []),
    { kind: 'depends-on', from: null, to: { description: 'storage' }, reason: 'Successful transitions must be persisted before another command reads the queue.' },
  ]);
  write('storage', 'Persistent storage', storage, parent('engine', 'It persists successful operations between invocations.'), [implementation(storage, 'src/store.ts', readFileSync(join(root, 'src/store.ts'), 'utf8').trimEnd())]);
  write('commands', 'Command interface', command, parent('queue', 'The command interface exposes the queue operations.'), [
    implementation(command, 'src/cli.ts', readFileSync(join(root, 'src/cli.ts'), 'utf8').trimEnd()),
    { kind: 'depends-on', from: null, to: { description: 'job-lifecycle' }, reason: 'Commands expose the lifecycle operations and their failure behavior.' },
  ]);
  writeJson(join(root, 'stratic/project.json'), { formatVersion: 1, scope: ['src/**', 'tests/**'], exclusions: [] });
  const tests = readFileSync(join(root, 'tests/queue.test.ts'), 'utf8');
  const names = [...tests.matchAll(/test\('([^']+)'/g)].map(m => m[1]);
  const testIds = ['claim-order', 'ack-owner', 'release-by-owner', 'release-invalid'];
  names.forEach((name, index) => {
    const start = tests.indexOf(`test('${name}'`), end = tests.indexOf('\n});', start) + 4;
    const record: TestRecord = { id: testIds[index], name, description: name + '.', code: [{ path: 'tests/queue.test.ts', passage: { quote: tests.slice(start, end) } }], verifies: [{ description: 'job-lifecycle', passage: { quote: index === 0 ? claim : index === 1 ? ack : release } }] };
    writeJson(join(root, 'stratic/tests', testIds[index] + '.json'), record);
  });
}
