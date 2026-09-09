import { update } from './store.ts';

export function put(path: string, text: string) {
  return update(path, state => {
    const job = { id: state.nextId++, text, owner: null, until: null };
    state.jobs.push(job);
    return job;
  });
}

export function claim(path: string, worker: string, now = Date.now()) {
  return update(path, state => {
    const job = state.jobs.find(job => job.until === null || job.until <= now);
    if (!job) return null;
    job.owner = worker;
    job.until = now + 30_000;
    return job;
  });
}

export function acknowledge(path: string, id: number, worker: string, now = Date.now()) {
  return update(path, state => {
    const job = state.jobs.find(job => job.id === id);
    if (!job || job.owner !== worker || job.until === null || job.until <= now) throw new Error('A live lease owned by this worker is required.');
    state.jobs = state.jobs.filter(job => job.id !== id);
  });
}
