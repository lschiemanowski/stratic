import type { Project, Description, Connection, CheckResult, Ready, Target, Range, Passage } from '../model.ts';
import type { Selection, UIRequest } from '../ui-channel.ts';
import type { ViewData } from './view-cache.ts';
import { markdownView } from './markdown.ts';
import { testView } from './test-view.ts';
import { sourceView } from './source-view.ts';
import { treeView, type TreeCamera } from './tree-view.ts';
import { textChanges } from './text-changes.ts';
import { resolvePassage } from '../passages.ts';

type View = Omit<ViewData, 'project'> & { project: Project | null; selection: Selection; projects: string[] };
declare global { interface Window { stratic: {
  copyId(): Promise<void>; view(): Promise<View>; navigate(request: UIRequest): Promise<Selection>; source(path: string): Promise<string>;
  image(request: {project: string; revision: string; tree: string; description: string; url: string}): Promise<string>;
  chooseProject(path?: string): Promise<View>; onSelection(callback: () => void): void;
} } }
const app = document.querySelector('#app')!;
let current: View, signature = '', selectedConnections: Connection[] = [], source: { path: string; body: string; passage: Passage; range?: Range; problem?: string } | null = null;
let tab: 'description' | 'issues' | 'tree' = 'description';
let sequence = 0, loadedKey = '';
let menuOpen = true;
let focusMenu = true;
let connectionOwner: string | undefined, detailSequence = 0;
let highlightChanges = true;
const expandedTests = new Set<string>();
const summaryModes = { parent: false, active: false };
let treeKey = '', treeCamera: TreeCamera = { x: 0, y: 0, scale: 1, initialized: false };
let projectsOpen: boolean | undefined;
let optionsOpen = false, choosingProject = false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
}
function button(label: string, action: () => void, className = '') {
  const e = el('button', label, className); e.addEventListener('click', action); return e;
}
function error(e: unknown) {
  let banner = document.querySelector('#error'); if (!banner) { banner = el('div', '', 'error'); banner.id = 'error'; banner.setAttribute('role', 'alert'); document.querySelector('.titlebar')?.after(banner); }
  banner.textContent = (e as Error).message;
}
function clearDetail() {
  detailSequence++; expandedTests.clear(); source = null; selectedConnections = []; connectionOwner = undefined;
}
async function open(target: Target, owner = current.selection.description) {
  if (choosingProject) return;
  try {
    if ('description' in target) {
      tab = 'description'; clearDetail();
      await window.stratic.navigate({ action: 'open', description: target.description, revision: current.selection.revision, passage: target.passage });
    } else {
      // Source belongs beside the description containing the link, including a visible parent.
      if (owner && owner !== current.selection.description) {
        await window.stratic.navigate({ action: 'open', description: owner, revision: current.selection.revision });
        await refresh(true);
        if (current.selection.description !== owner) return;
      }
      const ticket = ++detailSequence;
      const body = await window.stratic.source(target.path);
      if (ticket !== detailSequence) return;
      selectedConnections = []; connectionOwner = undefined;
      source = { path: target.path, body, passage: target.passage, range: resolvePassage(body, target.passage) }; render();
    }
  } catch (e) { error(e); }
}
function follow(connections: Connection[], owner: string) {
  clearDetail();
  if (connections.length === 1 && !connections[0].problem) void open(connections[0].to, owner);
  else { selectedConnections = connections; connectionOwner = owner; render(); }
}
function parentDescription(project: Project, id: string, byId = new Map(project.descriptions.map(d => [d.id, d]))): Description | undefined {
  const parent = byId.get(id)?.metadata?.parent?.description;
  const seen = new Set([id]);
  let cursor = parent;
  while (cursor) {
    if (seen.has(cursor) || !byId.has(cursor)) return undefined;
    seen.add(cursor); cursor = byId.get(cursor)?.metadata?.parent?.description;
  }
  return parent ? byId.get(parent) : undefined;
}
function links(project: Project, id: string): Connection[] {
  const d = project.descriptions.find(d => d.id === id)!;
  const result: Connection[] = (d.metadata?.links ?? []).map(l => ({ ...l, label: 'description' in l.to ? project.descriptions.find(d => d.id === (l.to as any).description)?.title ?? l.to.description : l.to.path }));
  for (const child of project.descriptions.filter(c => c.metadata?.parent?.description === id)) result.push({ kind: 'elaboration', from: child.metadata!.parent!.passage, to: { description: child.id }, label: child.title });
  for (const l of result) if (l.from) { try { l.range = resolvePassage(d.body, l.from); } catch (e) { l.problem = (e as Error).message; } }
  return result;
}
const images = new Map<string, Promise<string>>();
function prose(body: string, connections: Connection[], owner: string, selected?: Range, changes: { start: number; end: number }[] = []) {
  const project = current.project!, tree = current.tree;
  return markdownView(body, { connections, selected, changes, follow: targets => follow(targets, owner), image: url => {
    const request = { project: project.root, revision: project.revision, tree, description: owner, url }, key = JSON.stringify(request);
    let result = images.get(key);
    if (!result) {
      if (images.size >= 32) images.delete(images.keys().next().value!);
      result = window.stratic.image(request); images.set(key, result);
      result.catch(() => images.delete(key));
    }
    return result;
  } });
}
function neighborhood(p: Project, id: string) {
  const byId = new Map(p.descriptions.map(d => [d.id, d]));
  const parentOf = (id: string) => parentDescription(p, id, byId)?.id ?? null;
  const children = (id: string | null) => p.descriptions.filter(d => parentOf(d.id) === id);
  const parent = parentOf(id), rows = children(parent);
  return { byId, children, parent, rows };
}
function moveDescription(action: 'up' | 'down' | 'back' | 'enter') {
  const p = current.project, id = current.selection.description;
  if (!p || !id) return;
  const { parent, rows, children } = neighborhood(p, id);
  const index = rows.findIndex(d => d.id === id);
  const destination = action === 'back' ? parent : action === 'enter' ? children(id)[0]?.id :
    index < 0 ? undefined : rows[index + (action === 'up' ? -1 : 1)]?.id;
  if (destination && destination !== id) { optionsOpen = false; void open({ description: destination }); }
}
function descriptionMenu(p: Project) {
  const menuCursor = current.selection.description ?? '';
  const { byId, children, parent, rows } = neighborhood(p, menuCursor);
  const index = rows.findIndex(d => d.id === menuCursor);
  const dock = el('section', undefined, 'description-menu'); dock.setAttribute('aria-label', 'Description navigation');
  if (!menuOpen) return dock;
  const body = el('div', undefined, 'menu-body'); body.id = 'menu-body';
  const list = el('div', undefined, 'menu-list'); list.id = 'description-options'; list.tabIndex = 0;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Descriptions at this level');
  if (index >= 0) list.setAttribute('aria-activedescendant', `description-option-${index}`);
  rows.forEach((d, i) => {
    const row = el('div', undefined, 'menu-option' + (d.id === menuCursor ? ' cursor' : ''));
    row.id = `description-option-${i}`; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(d.id === menuCursor));
    row.append(el('span', d.title));
    const count = children(d.id).length;
    if (count) row.append(el('span', '›', 'menu-count'));
    row.onclick = () => { focusMenu = true; void open({ description: d.id }); };
    list.append(row);
  });
  list.onkeydown = e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'Enter' && menuCursor) { e.preventDefault(); void open({ description: menuCursor }); }
    else if (e.key === 'Escape') { e.preventDefault(); menuOpen = false; render(); document.querySelector<HTMLButtonElement>('#menu-toggle')?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault(); const target = rows[e.key === 'Home' ? 0 : rows.length - 1];
      if (target) void open({ description: target.id });
    }
  };
  const column = (name: string) => {
    const section = el('section', undefined, 'menu-column'); section.setAttribute('aria-label', name);
    return section;
  };
  const parentColumn = column('Parent description');
  if (parent) parentColumn.append(button(byId.get(parent)!.title, () => void open({ description: parent }), 'menu-neighbor'));

  const currentColumn = column('Current level'); currentColumn.append(list);
  const childColumn = column('Child descriptions');
  const childList = el('div', undefined, 'menu-neighbors');
  for (const child of children(menuCursor)) childList.append(button(child.title, () => void open({ description: child.id }), 'menu-neighbor'));

  childColumn.append(childList);
  body.append(parentColumn, currentColumn, childColumn); dock.append(body); return dock;
}
function descriptionPane(p: Project, d: Description, active: boolean, passage?: Passage) {
  const reading = el('section', undefined, 'reading description-pane' + (active ? ' active-description' : ' parent-description'));
  reading.setAttribute('aria-label', active ? 'Active reading pane' : 'Parent reading pane');
  reading.dataset.description = d.id;
  const mode = active ? 'active' : 'parent', summaries = summaryModes[mode];
  if (d.metadata?.summary?.length && !source && !selectedConnections.length) {
    const toggle = iconButton('Summary', 'summary', () => {
      summaryModes[mode] = !summaryModes[mode]; render();
      document.querySelector<HTMLButtonElement>(`.${active ? 'active' : 'parent'}-description .summary-button`)?.focus();
    });
    toggle.classList.add('summary-button'); toggle.setAttribute('aria-pressed', String(summaries));
    toggle.title = summaries ? 'Show full description' : 'Show summary'; reading.append(toggle);
  }
  reading.dataset.readingKey = JSON.stringify([p.root, p.revision, d.id, summaries]);
  const realization = d.metadata?.realization;
  if (realization !== 'implemented') {
    const notice = el('div', undefined, 'implementation-notice');
    notice.append(el('span', realization === 'partial' ? 'Partly implemented' : realization === 'unimplemented' ? 'Unimplemented' : 'Incomplete metadata', 'badge'));
    if (d.metadata?.remaining) notice.append(el('p', d.metadata.remaining));
    reading.append(notice);
  }
  let selected: Range | undefined;
  try { if (passage) selected = resolvePassage(d.body, passage); } catch { /* Retain the edited description with its problem. */ }
  const outgoing = links(p, d.id);
  const summary = summaries && !source && !selectedConnections.length ? d.metadata?.summary : undefined;
  if (summary?.length) {
    reading.append(el('h1', d.title));
    const list = el('ul', undefined, 'description-summary');
    const previous = current.comparison?.summariesBefore[d.id];
    const changes = highlightChanges && previous ? textChanges(previous.join('\n\n'), summary.join('\n\n')) : { additions: [], removed: [] };
    let offset = 0;
    for (const bullet of summary) {
      list.append(el('li', bullet, changes.additions.some(c => c.start < offset + bullet.length && c.end > offset) ? 'changed-text' : ''));
      offset += bullet.length + 2;
    }
    reading.append(list);
    if (changes.removed.length) { const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed summary text'), el('pre', changes.removed.join('\n\n'))); reading.append(removed); }
  } else {
    const before = current.comparison?.before[d.id];
    const changes = highlightChanges && before !== undefined ? textChanges(before, d.body) : { additions: [], removed: [] };
    reading.append(prose(d.body, outgoing, d.id, selected, changes.additions));
    if (changes.removed.length) { const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed text'), el('pre', changes.removed.join('\n\n'))); reading.append(removed); }
    const removedSummary = current.comparison?.summariesBefore[d.id];
    if (summaries && highlightChanges && !d.metadata?.summary?.length && removedSummary?.length) {
      const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed summary text'), el('pre', removedSummary.join('\n\n'))); reading.append(removed);
    }
  }
  if (highlightChanges && d.metadata?.parent === null) for (const old of current.comparison?.removed ?? []) { const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed description: ' + old.title), el('pre', old.body)); reading.append(removed); }
  const issues = p.issues.filter(i => i.description === d.id);
  if (issues.length) reading.append(button(`${issues.length} connection problem${issues.length === 1 ? '' : 's'} — inspect`, () => { tab = 'issues'; render(); }, 'problem-link'));
  const contextual = outgoing.filter(l => !l.from || l.problem);
  if (contextual.length) {
    reading.append(el('h2', 'Related responsibilities'));
    for (const l of contextual) { const b = button(l.label, () => follow([l], d.id), 'relation'); reading.append(b); }
  }
  if (!source) { const tests = testsFor(d); if (tests) reading.append(tests); }
  return reading;
}
function testsFor(description: Description) {
  return testView(description, current.project!.tests, current.checks, expandedTests, path => window.stratic.source(path), target => void open(target));
}
function iconButton(label: string, icon: string, action: () => void) {
  const control = button('', action, 'subtle icon-button');
  control.setAttribute('aria-label', label); control.title = label;
  const glyph = el('span', undefined, 'icon icon-' + icon); glyph.setAttribute('aria-hidden', 'true'); control.append(glyph);
  return control;
}
async function chooseProject(path?: string) {
  if (choosingProject) return;
  choosingProject = true; render();
  try {
    const v = await window.stratic.chooseProject(path);
    current = v; signature = ''; clearDetail(); tab = 'description'; optionsOpen = false;
    choosingProject = false; render();
  } catch (e) { choosingProject = false; render(); error(e); }
}
function projectPanel() {
  const panel = el('aside', undefined, 'project-panel'); panel.id = 'project-panel'; panel.setAttribute('aria-label', 'Projects'); panel.setAttribute('aria-busy', String(choosingProject));
  const heading = el('div', undefined, 'panel-heading');
  heading.append(el('h2', 'Projects'), iconButton('Hide projects', 'close', () => { projectsOpen = false; render(); document.querySelector<HTMLButtonElement>('#projects-toggle')?.focus(); }));
  panel.append(heading);
  for (const path of current.projects) {
    const item = button('', () => void chooseProject(path), 'project-option'); item.title = path; item.disabled = choosingProject;
    item.setAttribute('aria-current', String(path === current.project?.root));
    item.append(el('span', path.split('/').pop()), el('span', path, 'muted small'));
    panel.append(item);
  }
  const picker = button(choosingProject ? 'Opening project…' : 'Open project…', () => void chooseProject(), 'subtle open-project'); picker.disabled = choosingProject; panel.append(picker);
  return panel;
}
function titleBar(p: Project | null) {
  const header = el('header', undefined, 'titlebar');
  const projects = iconButton('Projects', 'sidebar', () => { projectsOpen = !(projectsOpen ?? !p); optionsOpen = false; render(); document.querySelector<HTMLButtonElement>('#projects-toggle')?.focus(); });
  projects.id = 'projects-toggle'; projects.setAttribute('aria-expanded', String(projectsOpen ?? !p)); projects.setAttribute('aria-controls', 'project-panel'); header.append(projects);
  const path = el('nav', undefined, 'title-path'); path.setAttribute('aria-label', 'Location');
  if (p) {
    const byId = new Map(p.descriptions.map(d => [d.id, d]));
    const ancestors: Description[] = [], seen = new Set<string>(); let d = byId.get(current.selection.description ?? '');
    while (d && !seen.has(d.id)) { ancestors.unshift(d); seen.add(d.id); d = byId.get(d.metadata?.parent?.description ?? ''); }
    for (const [index, item] of ancestors.entries()) {
      if (index) path.append(el('span', '›', 'path-separator'));
      const entry = button(item.title, () => void open({ description: item.id }), 'subtle'); entry.title = item.title;
      if (item.id === current.selection.description) entry.setAttribute('aria-current', 'page'); path.append(entry);
    }
  }
  header.append(path);
  if (!p) return header;
  if (current.selection.revision !== 'working') header.append(el('span', 'History · ' + current.selection.revision.slice(0, 7), 'badge'));
  else if (current.ready) header.append(el('span', 'Review prepared', 'badge'));
  else if (current.dirty) { const changed = el('span', '•', 'working-changes'); changed.title = 'Uncommitted changes'; changed.setAttribute('aria-label', 'Uncommitted changes'); header.append(changed); }
  if (p.issues.length) header.append(button(`Problems · ${p.issues.length}`, () => { optionsOpen = false; tab = 'issues'; render(); }, 'subtle problems-button'));
  const navigation = iconButton('Descriptions', 'navigation', () => { menuOpen = !menuOpen; focusMenu = menuOpen; optionsOpen = false; render(); if (!menuOpen) document.querySelector<HTMLButtonElement>('#menu-toggle')?.focus(); });
  navigation.id = 'menu-toggle'; navigation.setAttribute('aria-expanded', String(menuOpen)); navigation.setAttribute('aria-controls', 'menu-body'); header.append(navigation);
  const options = el('div', undefined, 'view-options');
  const toggle = button('View', () => { optionsOpen = !optionsOpen; render(); document.querySelector<HTMLButtonElement>('#view-toggle')?.focus(); }, 'subtle');
  toggle.id = 'view-toggle'; toggle.setAttribute('aria-expanded', String(optionsOpen)); toggle.setAttribute('aria-controls', 'view-options'); options.append(toggle);
  if (optionsOpen) {
    const panel = el('div', undefined, 'view-popover'); panel.id = 'view-options'; panel.setAttribute('aria-label', 'View options'); panel.setAttribute('role', 'region');
    const label = el('label', 'Revision'); label.htmlFor = 'revision';
    const versions = el('select'); versions.id = 'revision'; versions.setAttribute('aria-label', 'Revision');
    for (const item of [{ id: 'working', title: 'Working files' }, ...current.history]) { const o = el('option', item.id === 'working' ? item.title : `${item.id.slice(0, 7)} · ${item.title}`); o.value = item.id; versions.append(o); }
    versions.value = current.selection.revision;
    versions.onchange = () => { if (current.selection.description) { optionsOpen = false; clearDetail(); void window.stratic.navigate({ action: 'open', description: current.selection.description, revision: versions.value }).then(() => refresh(true)).catch(error); } };
    panel.append(label, versions);
    if (current.comparison) {
      const highlight = button(current.comparison.label, () => { highlightChanges = !highlightChanges; render(); }, 'subtle change-toggle');
      highlight.setAttribute('aria-pressed', String(highlightChanges)); highlight.title = 'Highlight changes compared with ' + current.comparison.base.slice(0, 7); panel.append(highlight);
    }
    panel.append(button('Tree overview', () => { optionsOpen = false; clearDetail(); tab = 'tree'; render(); }, 'subtle'));
    if (current.selection.description) {
      const identity = el('div', undefined, 'identity'); identity.append(el('span', current.selection.description, 'muted small'), button('Copy ID', () => window.stratic.copyId().catch(error), 'subtle')); panel.append(identity);
    }
    options.append(panel);
  }
  header.append(options);
  return header;
}
function render() {
  const p = current.project;
  const menuHadFocus = document.activeElement?.id === 'description-options';
  const scrolls = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-reading-key]'), pane => [pane.dataset.readingKey!, pane.scrollTop]));
  app.replaceChildren();
  app.append(titleBar(p));
  const location = document.querySelector('.title-path'); if (location) location.scrollLeft = location.scrollWidth;
  const workspace = el('div', undefined, 'workspace');
  if (projectsOpen ?? !p) workspace.append(projectPanel());
  const reader = el('div', undefined, 'reader'); workspace.append(reader); app.append(workspace);
  if (!p) { reader.append(el('section', 'Choose a project to start reading.', 'empty')); return; }
  if (tab === 'tree') {
    const key = JSON.stringify([p.root, p.revision]);
    if (treeKey !== key) { treeKey = key; treeCamera = { x: 0, y: 0, scale: 1, initialized: false }; }
    reader.append(treeView(p, current.selection.description, treeCamera, id => void open({ description: id }), () => { tab = 'description'; render(); }));
    return;
  }
  const layout = el('main', undefined, 'layout');
  const reading = el('section', undefined, 'reading');
  reading.dataset.readingKey = JSON.stringify([p.root, p.revision, tab]);
  if (tab === 'issues') {
    reading.append(el('h1', 'Project problems'), el('p', 'Descriptions stay readable while you repair these connections.', 'muted'));
    if (!p.issues.length) reading.append(el('p', 'The hierarchy and passage links resolve. Semantic accuracy is established by review.'));
    for (const issue of p.issues) { const row = el('div', undefined, 'problem'); row.append(el('strong', issue.path), el('p', issue.message)); if (issue.description) row.append(button('Open description', () => void open({ description: issue.description! }))); reading.append(row); }

  } else {
    const d = p.descriptions.find(d => d.id === current.selection.description);
    if (!d) reading.append(el('h1', 'Select a description'));
    else {
      const parent = parentDescription(p, d.id);
      if (source || selectedConnections.length) {
        const owner = p.descriptions.find(item => item.id === connectionOwner) ?? d;
        layout.append(descriptionPane(p, owner, owner.id === d.id, owner.id === d.id ? current.selection.passage : undefined));
      } else {
        if (parent) layout.append(descriptionPane(p, parent, false, d.metadata?.parent?.passage));
        layout.append(descriptionPane(p, d, true, current.selection.passage));
      }
    }
  }
  if (tab !== 'description' || !layout.childElementCount) layout.append(reading);
  const detail = el('aside', undefined, 'detail');
  if (source) {
    const heading = el('div', undefined, 'detail-heading');
    heading.append(el('h2', source.path), iconButton('Close source', 'close', () => { clearDetail(); render(); })); detail.append(heading);
    if (source.problem) detail.append(el('p', source.problem, 'problem'));
    detail.append(sourceView(source.path, source.body, source.range));
    const owner = p.descriptions.find(d => d.id === current.selection.description);
    if (owner) { const tests = testsFor(owner); if (tests) detail.append(tests); }
  } else if (selectedConnections.length) {
    const heading = el('div', undefined, 'detail-heading');
    heading.append(el('h2', 'Follow this passage'), iconButton('Close connections', 'close', () => { clearDetail(); render(); })); detail.append(heading);
    for (const l of selectedConnections) { const card = el('div', undefined, 'connection-card'); card.append(el('span', l.kind, 'badge'), button(l.label + ' →', () => void open(l.to, connectionOwner), 'connection-target')); if (l.reason) card.append(el('p', l.reason)); if (l.problem) card.append(el('p', l.problem, 'error')); detail.append(card); }
  }
  if (source || selectedConnections.length) layout.append(detail);
  layout.classList.toggle('single-pane', layout.childElementCount === 1);
  reader.append(layout, descriptionMenu(p));
  for (const pane of Array.from(layout.querySelectorAll<HTMLElement>('[data-reading-key]'))) pane.scrollTop = scrolls.get(pane.dataset.readingKey!) ?? 0;
  if (focusMenu || menuHadFocus) {
    document.querySelector<HTMLElement>('#description-options')?.focus({ preventScroll: true }); focusMenu = false;
  }
  document.querySelector('.menu-option.cursor')?.scrollIntoView({ block: 'nearest' });
  if (source?.range) {
    const pre = detail.querySelector('pre'), selected = detail.querySelector('.highlighted');
    if (pre && selected) pre.scrollTop += selected.getBoundingClientRect().top - pre.getBoundingClientRect().top - pre.clientHeight / 2;
  }
}
async function refresh(force = false) {
  const ticket = ++sequence;
  try {
    const v = await window.stratic.view(); if (ticket !== sequence) return;
    const next = JSON.stringify(v);
    if (next === signature && !force) return;
    const key = JSON.stringify(v.selection);
    if (current && (v.tree !== current.tree || v.project?.root !== current.project?.root)) expandedTests.clear();
    if (key !== loadedKey) { clearDetail(); tab = 'description'; loadedKey = key; }
    if (source) {
      const openedSource = source;
      const body = await window.stratic.source(openedSource.path);
      if (ticket !== sequence || source !== openedSource) return;
      openedSource.body = body;
      try { openedSource.range = resolvePassage(body, openedSource.passage); openedSource.problem = undefined; }
      catch (e) { openedSource.range = undefined; openedSource.problem = (e as Error).message + ' Select the updated description passage to follow its current link.'; }
    }
    current = v; signature = next; render();
    if (v.selection.passage) document.querySelector('.active-description .selected')?.scrollIntoView({ block: 'center' });
  } catch (e) { error(e); }
}
window.stratic.onSelection(() => { tab = 'description'; clearDetail(); focusMenu = document.activeElement?.id === 'description-options'; void refresh(true); });
void refresh(); setInterval(() => void refresh(), 2000);

document.addEventListener('click', event => {
  // Use the original event path: an action may have rebuilt the controls during this click.
  const inside = event.composedPath().some(node => node instanceof Element && node.classList.contains('view-options'));
  if (optionsOpen && !inside) { optionsOpen = false; render(); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && optionsOpen) { event.preventDefault(); optionsOpen = false; render(); document.querySelector<HTMLButtonElement>('#view-toggle')?.focus(); return; }
  if (event.key === 'Escape' && tab === 'tree') { event.preventDefault(); tab = 'description'; render(); return; }
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
  const action = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'back', ArrowRight: 'enter' } as Record<string, 'up' | 'down' | 'back' | 'enter'>)[event.key];
  if (action && current?.project && current.selection.description) { event.preventDefault(); moveDescription(action); }
});
