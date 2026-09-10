#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { repository, files, head, snapshot, readSource } from './git.ts';
import { loadProject, inspect } from './project.ts';
import { impact } from './impact.ts';
import { accept, prepare, ready, recordCheck, results, discard } from './review.ts';
import { requestUI } from './ui-channel.ts';
import { installSkills, skillStatus } from './skills.ts';

const help = `Stratic — descriptions, links, and reviewed changes

  version                           Identify the v3 executable and file format
  list                              List descriptions
  show ID [--revision COMMIT]        Read one description and its neighborhood
  source PATH [--revision COMMIT]    Read exact project source
  validate                          Check structure and links (exit 1 on problems)
  snapshot [--paths FILE ...]        Snapshot selected files; default: all project files
  impact [--base COMMIT] [--review FILE] [--paths FILE ...]
                                    Find affected descriptions; decisions expand branches
  check record --file FILE          Import a check result with its actual tree and evidence
  check list                        Read recorded results (does not run tests)
  prepare --review FILE (--paths FILE ... | --all)
                                    Validate completed review and pin the proposed change
  ready                             Inspect the current handoff
  discard --id REVIEW_ID            Withdraw readiness; keep project edits and checks
  accept --id REVIEW_ID              Authorize and commit exactly that ready proposal
  skill install [--with tdd]        Install repository-local core and optional TDD skills
  skill status                      Compare installed skills with bundled versions
  skill update                      Update recorded skills, preserving local edits
  ui current                        Read the desktop's current semantic selection
  ui open ID [--revision COMMIT] [--quote TEXT]
                                    Open a description, optionally at a passage

Use --project DIR on every command to select a repository; defaults to cwd.
All output is JSON. --paths selects whole files, including deletions. Put review
and result input files outside the worktree (for example in /tmp). Tests and
semantic investigation are performed by your tools and agent before prepare.
`;
async function main() {
  const args = process.argv.slice(2);
  const option = (name: string, fallback?: string) => {
    const at = args.indexOf(`--${name}`);
    if (at < 0) return fallback;
    if (!args[at + 1] || args[at + 1].startsWith('--')) throw new Error(`--${name} needs a value.`);
    const value = args[at + 1]; args.splice(at, 2); return value;
  };
  const projectPath = option('project', process.cwd())!;
  if (!args.length || args[0] === 'help' || args.includes('--help')) { console.log(help); return; }
  const root = repository(projectPath), ref = option('revision', 'working')!;
  const jsonFile = (name: string) => {
    const path = option(name); if (!path) throw new Error(`--${name} FILE is required.`);
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  const paths = () => {
    const at = args.indexOf('--paths');
    const selected = at < 0 ? files(root) : args.splice(at + 1);
    if (at >= 0) args.splice(at, 1);
    const pending = ready(root)?.reviewPath;
    return selected.filter(p => !p.startsWith('stratic/reviews/') || p === pending).filter(p => p !== pending);
  };
  const done = () => { if (args.length) throw new Error(`Unexpected arguments: ${args.join(' ')}`); };
  const command = args.shift();
  let output: unknown;
  switch (command) {
    case 'version': output = { product: 'Stratic v3', version: '0.1.0', formatVersion: 1 }; break;
    case 'list': {
      const p = loadProject(root, ref);
      output = { project: root, revision: p.revision, descriptions: p.descriptions.map(d => ({ id: d.id, title: d.title, parent: d.metadata?.parent?.description, realization: d.metadata?.realization })), issues: p.issues }; break;
    }
    case 'show': output = inspect(loadProject(root, ref), args.shift()!); break;
    case 'source': output = { path: args[0], revision: ref, content: readSource(root, args.shift()!, ref) }; break;
    case 'validate': {
      const p = loadProject(root, ref); output = { valid: p.issues.length === 0, issues: p.issues }; if (p.issues.length) process.exitCode = 1; break;
    }
    case 'snapshot': { const selected = paths(); output = { tree: snapshot(root, selected), base: head(root), paths: selected }; break; }
    case 'impact': {
      const base = option('base', 'HEAD')!;
      const file = option('review'); const decisions = file ? JSON.parse(readFileSync(file, 'utf8')).examined : [];
      output = impact(root, base, snapshot(root, paths()), decisions); break;
    }
    case 'check': {
      const action = args.shift();
      if (action === 'record') { const input = jsonFile('file'); done(); output = recordCheck(root, input); }
      else if (action === 'list') output = results(root);
      else throw new Error('Use check record or check list.'); break;
    }
    case 'prepare': { const input = jsonFile('review'); if (!args.includes('--paths') && !args.includes('--all')) throw new Error('Select --paths FILE ... or explicitly use --all.'); const all = args.indexOf('--all'); if (all >= 0) args.splice(all, 1); const selected = paths(); done(); output = prepare(root, selected, input); break; }
    case 'ready': output = ready(root); break;
    case 'discard': { const id = option('id'); if (!id) throw new Error('Provide --id REVIEW_ID.'); done(); output = discard(root, id); break; }
    case 'accept': { const id = option('id'); if (!id) throw new Error('Acceptance needs --id REVIEW_ID.'); done(); output = accept(root, id); break; }
    case 'skill': {
      const action = args.shift();
      if (ref !== 'working') throw new Error('Skills are installed in working files; omit --revision.');
      if (action === 'status') { done(); output = skillStatus(root); }
      else if (action === 'install') {
        const workflow = option('with');
        if (workflow !== undefined && workflow !== 'tdd') throw new Error('The optional bundled workflow is tdd.');
        done(); output = installSkills(root, 'install', workflow === 'tdd');
      } else if (action === 'update') { done(); output = installSkills(root, 'update'); }
      else throw new Error('Use skill install, skill status, or skill update.');
      break;
    }
    case 'ui': {
      const action = args.shift();
      if (action === 'current') output = await requestUI(root, { action: 'current' });
      else if (action === 'open') {
        const quote = option('quote'); const description = args.shift()!; done(); output = await requestUI(root, { action: 'open', description, revision: ref, ...(quote ? { passage: { quote } } : {}) });
      } else throw new Error('Use ui current or ui open.'); break;
    }
    default: throw new Error(`Unknown command: ${command}. Run stratic help.`);
  }
  if (args.length) throw new Error(`Unexpected arguments: ${args.join(' ')}`);
  console.log(JSON.stringify(output, null, 2));
}
main().catch(e => { console.error(JSON.stringify({ error: (e as Error).message })); process.exitCode = 1; });
