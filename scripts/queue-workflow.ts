import { execFileSync } from 'node:child_process';
import { files, snapshot, head } from '../src/git.ts';
import { impact } from '../src/impact.ts';
import { recordCheck } from '../src/review.ts';
import type { ReviewInput } from '../src/model.ts';

export function selected(root: string) { return files(root).filter(p => !p.startsWith('stratic/reviews/')); }
export function checkQueue(root: string) {
  const tree = snapshot(root, selected(root));
  const environment = { ...process.env }; delete environment.NODE_TEST_CONTEXT;
  const tap = execFileSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/queue.test.ts'], { cwd: root, encoding: 'utf8', env: environment });
  if (snapshot(root, selected(root)) !== tree) throw new Error('Content changed during test execution.');
  return recordCheck(root, { tree, method: 'node --test --test-reporter=tap tests/queue.test.ts', outcome: 'pass', environment: `Node ${process.version}; ${process.platform}/${process.arch}`, evidence: tap,
    tests: [
      ['claim-order', 'Claims follow insertion order and expired jobs become available'],
      ['ack-owner', 'Only the owner of a live lease can acknowledge a job'],
      ['release-by-owner', 'Release keeps the job and makes it immediately claimable'],
      ['release-invalid', 'Missing jobs and invalid release leases leave storage unchanged'],
    ].filter(([, name]) => tap.split('\n').some(line => /^ok \d+ - /.test(line) && line.endsWith(name))).map(([id]) => ({ id, outcome: 'pass' })) });
}
export function releaseReview(root: string) {
  const check = checkQueue(root);
  const examined: ReviewInput['examined'] = [
    { id: 'commands', outcome: 'revised', reason: 'Expose release with the job and worker identifiers.' },
    { id: 'job-lifecycle', outcome: 'revised', reason: 'Specify release and unchanged failure behavior.' },
    { id: 'lease-transitions', outcome: 'revised', reason: 'Clear lease fields while retaining the job after ownership checks.' },
    { id: 'storage', outcome: 'unchanged', reason: 'Existing nullable fields and atomic writes already support release.' },
    { id: 'engine', outcome: 'unchanged', reason: 'Lifecycle management and persistence responsibilities remain accurate.' },
    { id: 'queue', outcome: 'unchanged', reason: 'The same local producer/worker purpose and single-writer scope apply.' },
  ];
  const unmapped = impact(root, head(root), check.tree, examined).unmapped.map(u => ({ path: u.path, reason: 'Inspected changed imports and separators alongside the linked operation and complete test blocks; no additional responsibility is introduced.' }));
  return { reviewer: 'queue-example', summary: 'Allow a worker to release a live job lease', examined, unresolved: [], resultIds: [check.id], unmapped };
}
