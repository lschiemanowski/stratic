import { put, claim, acknowledge } from './queue.ts';
const [path, command, first, second] = process.argv.slice(2);
function required(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`Provide ${label}.`);
  return value;
}
function jobId(value: string | undefined): number {
  const id = Number(required(value, 'a job identifier'));
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('A job identifier must be a positive integer.');
  return id;
}
required(path, 'a queue file');
switch (command) {
  case 'put': console.log(JSON.stringify(put(path, required(first, 'text')))); break;
  case 'claim': console.log(JSON.stringify(claim(path, required(first, 'a worker name')))); break;
  case 'ack': acknowledge(path, jobId(first), required(second, 'a worker name')); break;
  default: throw new Error('Use put TEXT, claim WORKER, or ack JOB_ID WORKER.');
}
