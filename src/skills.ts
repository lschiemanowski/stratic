import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bundled = fileURLToPath(new URL('../skills/', import.meta.url));
const names = ['stratic', 'stratic-tdd'] as const;
type Name = typeof names[number];
type Record = Partial<{ [name in Name]: string }>;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

function kind(path: string) {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Skill installation cannot follow a symbolic link: ${path}`);
    return stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other';
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
function file(path: string): string | undefined {
  const type = kind(path);
  if (type && type !== 'file') throw new Error(`Expected a skill file: ${path}`);
  return type ? readFileSync(path, 'utf8') : undefined;
}
function installation(root: string) {
  const directory = join(root, '.agents', 'skills');
  for (const path of [join(root, '.agents'), directory, ...names.map(name => join(directory, name))]) {
    const type = kind(path);
    if (type && type !== 'directory') throw new Error(`Expected a skill directory: ${path}`);
  }
  const manifest = join(directory, '.stratic.json');
  const text = file(manifest);
  const record: Record = text === undefined ? {} : JSON.parse(text);
  if (!record || Array.isArray(record) || typeof record !== 'object' || Object.entries(record).some(([name, value]) => !names.includes(name as Name) || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid Stratic skill installation record.');
  return { directory, manifest, record };
}

export function skillStatus(root: string) {
  const { directory, record } = installation(root);
  return names.map(name => {
    const current = file(join(directory, name, 'SKILL.md'));
    const expected = readFileSync(join(bundled, name, 'SKILL.md'), 'utf8');
    const status = current === undefined ? (record[name] ? 'missing' : 'not-installed') :
      current === expected ? 'current' : !record[name] ? 'unmanaged' :
      hash(current) === record[name] ? 'outdated' : 'modified';
    return { name, status, path: `.agents/skills/${name}/SKILL.md` };
  });
}

export function installSkills(root: string, action: 'install' | 'update', withTdd = false) {
  const { directory, manifest, record } = installation(root);
  // Validate the status response for unselected workflows before any installation writes.
  skillStatus(root);
  const selected: Name[] = action === 'install' ? ['stratic', ...(withTdd ? ['stratic-tdd' as const] : [])] : names.filter(name => record[name]);
  if (!selected.length) throw new Error('No recorded skills to update. Use skill install first.');
  const planned = selected.map(name => {
    const path = join(directory, name, 'SKILL.md');
    const current = file(path), content = readFileSync(join(bundled, name, 'SKILL.md'), 'utf8');
    const conflict = current !== content && (action === 'install' ? current !== undefined || record[name] !== undefined : current === undefined || hash(current) !== record[name]);
    return { name, path, current, content, conflict };
  });
  const conflicts = planned.filter(item => item.conflict);
  if (conflicts.length) throw new Error(`Skills were not changed. Inspect and merge these files manually: ${conflicts.map(item => item.path).join(', ')}. Bundled versions are in ${bundled}. Installation preserves existing files; update replaces only files unchanged since installation.`);
  // Inspect every selected file before writing, so a local edit cannot cause a partial update.
  const written: string[] = [];
  for (const item of planned) {
    if (item.current !== item.content) {
      mkdirSync(dirname(item.path), { recursive: true });
      writeFileSync(item.path, item.content, { flag: item.current === undefined ? 'wx' : 'w' });
      written.push(`.agents/skills/${item.name}/SKILL.md`);
    }
    record[item.name] = hash(item.content);
  }
  const content = JSON.stringify(record, null, 2) + '\n';
  if (file(manifest) !== content) { mkdirSync(directory, { recursive: true }); writeFileSync(manifest, content); }
  return { action, written, skills: skillStatus(root) };
}
