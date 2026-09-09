import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export function git(root: string, args: string[], input?: string | Buffer, env: NodeJS.ProcessEnv = {}): string {
  const inherited = { ...process.env };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete inherited[name];
  try {
    return execFileSync('git', ['--literal-pathspecs', '-C', root, ...args], {
      encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024,
      env: { ...inherited, GIT_OPTIONAL_LOCKS: '0', ...env }, stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    throw new Error(String((error as { stderr?: Buffer }).stderr || (error as Error).message).trim());
  }
}
export function repository(path: string): string {
  return realpathSync(git(resolve(path), ['rev-parse', '--show-toplevel']).trim());
}
export function head(root: string): string { return git(root, ['rev-parse', '--verify', 'HEAD']).trim(); }
export function pathInside(root: string, path: string): string {
  if (!path || isAbsolute(path) || path.includes('\\') || path.includes('\0') || path.split('/').some(p => !p || p === '..' || p === '.' || p.toLowerCase() === '.git')) {
    throw new Error(`Invalid repository path: ${path}`);
  }
  const full = join(root, path);
  let current = root;
  for (const part of path.split('/')) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Symbolic links are not read or edited: ${path}`);
  }
  return full;
}
export function localDirectory(root: string): string {
  const path = git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'stratic-v3']).trim();
  mkdirSync(path, { recursive: true });
  return path;
}
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
}
export function readJson<T>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')) as T; }
export function revision(root: string, ref: string): string {
  if (ref === 'working') return ref;
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{tree}`]).trim();
}
export function readSource(root: string, path: string, view = 'working'): string {
  pathInside(root, path);
  if (view === 'working') {
    const full = pathInside(root, path);
    if (lstatSync(full).size > 2_000_000) throw new Error(`File exceeds the 2 MB display limit: ${path}`);
    return readFileSync(full, 'utf8');
  }
  const tree = /^[0-9a-f]{40,64}$/.test(view) ? view : revision(root, view);
  const entry = git(root, ['ls-tree', tree, '--', path]);
  if (!entry.startsWith('100644 ') && !entry.startsWith('100755 ')) throw new Error(`Not a regular file at this revision: ${path}`);
  const size = Number(git(root, ['cat-file', '-s', `${tree}:${path}`]).trim());
  if (size > 2_000_000) throw new Error(`File exceeds the 2 MB display limit: ${path}`);
  return git(root, ['show', `${tree}:${path}`]);
}
export function files(root: string, view = 'working'): string[] {
  const output = view === 'working'
    ? git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']) + git(root, ['ls-tree', '-r', '--name-only', '-z', 'HEAD'])
    : git(root, ['ls-tree', '-r', '--name-only', '-z', revision(root, view)]);
  return [...new Set(output.split('\0').filter(Boolean))].sort();
}
export function snapshot(root: string, paths: string[], base = head(root)): string {
  const dir = mkdtempSync(join(tmpdir(), 'stratic-index-'));
  const env = { GIT_INDEX_FILE: join(dir, 'index') };
  try {
    git(root, ['read-tree', revision(root, base)], undefined, env);
    for (const path of paths) pathInside(root, path);
    if (paths.length) git(root, ['add', '-A', '--', ...paths], undefined, env);
    return git(root, ['write-tree'], undefined, env).trim();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
export function workingSnapshot(root: string): string {
  return snapshot(root, files(root));
}
export function changedPaths(root: string, base: string, tree: string): string[] {
  return git(root, ['diff', '--name-only', '--no-renames', '-z', base, tree]).split('\0').filter(Boolean);
}
export function relativePath(root: string, path: string): string {
  return relative(root, resolve(path)).split('\\').join('/');
}
