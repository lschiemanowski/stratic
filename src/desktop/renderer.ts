import type { Project, Description, Connection, CheckResult, Ready, Target, Range, Passage } from '../model.ts';
import type { Selection, UIRequest } from '../ui-channel.ts';
import type { ViewData } from './view-cache.ts';
import { sourceView } from './source-view.ts';
import { textChanges } from './text-changes.ts';
import { resolvePassage } from '../passages.ts';

type View = Omit<ViewData, 'project'> & { project: Project | null; selection: Selection };
declare global { interface Window { stratic: {
  copyId(): Promise<void>; view(): Promise<View>; navigate(request: UIRequest): Promise<Selection>; source(path: string): Promise<string>;
  chooseProject(): Promise<View>; onSelection(callback: () => void): void;
} } }
const app = document.querySelector('#app')!;
let current: View, signature = '', selectedConnections: Connection[] = [], source: { path: string; body: string; passage: Passage; range?: Range; problem?: string } | null = null;
let tab: 'description' | 'tests' | 'issues' = 'description';
let sequence = 0, loadedKey = '';
let menuOpen = true, menuParent: string | null = null, menuCursor = '', menuContext = '';
let focusMenu = true;
let connectionOwner: string | undefined, detailSequence = 0;
let highlightChanges = true;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
}
function button(label: string, action: () => void, className = '') {
  const e = el('button', label, className); e.addEventListener('click', action); return e;
}
function error(e: unknown) {
  let banner = document.querySelector('#error'); if (!banner) { banner = el('div', '', 'error'); banner.id = 'error'; app.prepend(banner); }
  banner.textContent = (e as Error).message;
}
function clearDetail() {
  detailSequence++; source = null; selectedConnections = []; connectionOwner = undefined;
}
async function open(target: Target, owner = current.selection.description) {
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
function prose(body: string, connections: Connection[], owner: string, selected?: Range, changes: { start: number; end: number }[] = []) {
  const container = el('div', undefined, 'prose');
  // Render repository text exclusively through text nodes. Raw HTML and URLs are inert.
  const chunks = [...body.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*|\n+/g)];
  for (const chunk of chunks) {
    const raw = chunk[0], at = chunk.index!;
    if (!raw.trim()) continue;
    const heading = /^(#{1,4}) /.exec(raw), skip = heading?.[0].length ?? 0;
    const node = heading ? el(heading[1].length === 1 ? 'h1' : 'h2') : el('p');
    const start = at + skip, end = at + raw.length;
    if (changes.some(c => c.start < end && c.end > start)) node.classList.add('changed-text');
    const relevant = connections.filter(l => l.range && l.range.start < end && l.range.end > start);
    const cuts = [...new Set([start, end, ...relevant.flatMap(l => [Math.max(start, l.range!.start), Math.min(end, l.range!.end)]), ...(selected && selected.start < end && selected.end > start ? [Math.max(start, selected.start), Math.min(end, selected.end)] : [])])].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const targets = relevant.filter(l => l.range!.start <= a && l.range!.end >= b);
      const part = targets.length ? button(body.slice(a, b), () => follow(targets, owner), 'passage') : el('span', body.slice(a, b));
      if (selected && selected.start <= a && selected.end >= b) part.classList.add('selected');
      node.append(part);
    }
    container.append(node);
  }
  return container;
}
function descriptionMenu(p: Project) {
  const byId = new Map(p.descriptions.map(d => [d.id, d]));
  const parentOf = (id: string) => parentDescription(p, id, byId)?.id ?? null;
  const children = (id: string | null) => p.descriptions.filter(d => parentOf(d.id) === id);
  const context = JSON.stringify([p.root, current.selection]);
  if (menuContext !== context) {
    menuContext = context; menuCursor = current.selection.description ?? '';
    menuParent = parentOf(menuCursor);
  }
  if (menuParent && !byId.has(menuParent)) menuParent = null;
  const rows = children(menuParent);
  if (!rows.some(d => d.id === menuCursor)) menuCursor = rows[0]?.id ?? '';
  const index = rows.findIndex(d => d.id === menuCursor);
  const move = (action: string) => {
    if (action === 'up' || action === 'down') menuCursor = rows[Math.max(0, Math.min(rows.length - 1, index + (action === 'up' ? -1 : 1)))]?.id ?? '';
    if (action === 'back' && menuParent) { menuCursor = menuParent; menuParent = parentOf(menuParent); }
    if (action === 'enter' && children(menuCursor).length) { menuParent = menuCursor; menuCursor = children(menuCursor)[0].id; }
    if (menuCursor) { focusMenu = true; void open({ description: menuCursor }); return; }
    focusMenu = true; render();
  };
  const dock = el('section', undefined, 'description-menu'); dock.setAttribute('aria-label', 'Description navigation');
  const bar = el('div', undefined, 'menu-bar');
  const toggle = button(`${menuOpen ? '▾' : '▴'} Descriptions`, () => { menuOpen = !menuOpen; focusMenu = menuOpen; render(); if (!menuOpen) document.querySelector<HTMLButtonElement>('#menu-toggle')?.focus(); }, 'subtle');
  toggle.id = 'menu-toggle'; toggle.setAttribute('aria-expanded', String(menuOpen)); toggle.setAttribute('aria-controls', 'menu-body');
  bar.append(toggle, el('span', byId.get(current.selection.description ?? '')?.title ?? '', 'menu-current muted'));
  bar.append(button(`Tests · ${p.tests.length}`, () => { tab = 'tests'; render(); }, 'subtle'), button(`Problems · ${p.issues.length}`, () => { tab = 'issues'; render(); }, 'subtle'));
  if (current.ready) bar.append(el('span', 'Review prepared', 'badge'));
  dock.append(bar);
  if (!menuOpen) return dock;
  const body = el('div', undefined, 'menu-body'); body.id = 'menu-body';
  const path = el('nav', undefined, 'menu-path'); path.setAttribute('aria-label', 'Menu location');
  path.append(button('Top', () => { menuCursor = children(null)[0]?.id ?? ''; move('open'); }, 'subtle'));
  const ancestors: string[] = []; let ancestor = menuParent;
  while (ancestor) { ancestors.unshift(ancestor); ancestor = parentOf(ancestor); }
  for (const id of ancestors) {
    path.append(el('span', '›', 'muted'), button(byId.get(id)!.title, () => void open({ description: id }), 'subtle'));
  }
  const list = el('div', undefined, 'menu-list'); list.id = 'description-options'; list.tabIndex = 0;
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Descriptions at this level');
  if (index >= 0) list.setAttribute('aria-activedescendant', `description-option-${index}`);
  rows.forEach((d, i) => {
    const row = el('div', undefined, 'menu-option' + (d.id === menuCursor ? ' cursor' : ''));
    row.id = `description-option-${i}`; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(d.id === menuCursor));
    row.append(el('span', d.title));
    const count = children(d.id).length;
    row.append(el('span', [d.id === current.selection.description && tab === 'description' ? 'Open' : '', count ? `${count} ${count === 1 ? 'child' : 'children'}  ›` : ''].filter(Boolean).join(' · '), 'menu-count'));
    row.onclick = () => { menuCursor = d.id; move('open'); };
    list.append(row);
  });
  list.onkeydown = e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const action = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'back', ArrowRight: 'enter', Enter: 'open' } as Record<string, string>)[e.key];
    if (action) { e.preventDefault(); move(action); }
    else if (e.key === 'Escape') { e.preventDefault(); menuOpen = false; render(); document.querySelector<HTMLButtonElement>('#menu-toggle')?.focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); menuCursor = rows[e.key === 'Home' ? 0 : rows.length - 1]?.id ?? ''; move('open'); }
  };
  const column = (label: string, name: string) => {
    const section = el('section', undefined, 'menu-column'); section.setAttribute('aria-label', name);
    section.append(el('div', label, 'eyebrow')); return section;
  };
  const parentColumn = column('PARENT', 'Parent description');
  const parent = parentOf(menuCursor);
  if (parent) parentColumn.append(button(byId.get(parent)!.title, () => void open({ description: parent }), 'menu-neighbor'));
  else parentColumn.append(el('p', 'At the top', 'muted small'));
  const currentColumn = column('THIS LEVEL', 'Current level'); currentColumn.append(list);
  const childColumn = column('CHILDREN', 'Child descriptions');
  const childList = el('div', undefined, 'menu-neighbors');
  for (const child of children(menuCursor)) childList.append(button(child.title, () => void open({ description: child.id }), 'menu-neighbor'));
  if (!childList.childElementCount) childList.append(el('p', 'No children', 'muted small'));
  childColumn.append(childList);
  body.append(path, parentColumn, currentColumn, childColumn); dock.append(body); return dock;
}
function descriptionPane(p: Project, d: Description, active: boolean, passage?: Passage) {
  const reading = el('section', undefined, 'reading description-pane' + (active ? ' active-description' : ' parent-description'));
  reading.setAttribute('aria-label', active ? 'Active reading pane' : 'Parent reading pane');
  reading.dataset.description = d.id;
  reading.dataset.readingKey = JSON.stringify([p.root, p.revision, d.id]);
  reading.append(el('div', active ? 'ACTIVE DESCRIPTION' : 'PARENT', 'eyebrow'));
  const meta = el('div', undefined, 'description-meta'); meta.append(el('span', d.metadata?.realization ?? 'Incomplete metadata', 'badge'), el('span', d.id, 'muted small')); if (active) meta.append(button('Copy ID', () => window.stratic.copyId().catch(error), 'subtle')); reading.append(meta);
  if (d.metadata?.remaining) reading.append(el('p', 'Still to implement: ' + d.metadata.remaining, 'muted small'));
  if (d.metadata?.parent) reading.append(button('↑ ' + (p.descriptions.find(c => c.id === d.metadata!.parent!.description)?.title ?? 'Parent'), () => void open(d.metadata!.parent!), 'parent'));
  let selected: Range | undefined;
  try { if (passage) selected = resolvePassage(d.body, passage); } catch { /* Retain the edited description with its problem. */ }
  const outgoing = links(p, d.id);
  const before = current.comparison?.before[d.id];
  const changes = highlightChanges && before !== undefined ? textChanges(before, d.body) : { additions: [], removed: [] };
  reading.append(prose(d.body, outgoing, d.id, selected, changes.additions));
  if (changes.removed.length) { const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed text'), el('pre', changes.removed.join('\n\n'))); reading.append(removed); }
  if (highlightChanges && d.metadata?.parent === null) for (const old of current.comparison?.removed ?? []) { const removed = el('details', undefined, 'removed-text'); removed.append(el('summary', 'Removed description: ' + old.title), el('pre', old.body)); reading.append(removed); }
  const issues = p.issues.filter(i => i.description === d.id);
  if (issues.length) reading.append(button(`${issues.length} connection problem${issues.length === 1 ? '' : 's'} — inspect`, () => { tab = 'issues'; render(); }, 'problem-link'));
  const contextual = outgoing.filter(l => !l.from || l.problem);
  if (contextual.length) {
    reading.append(el('h2', 'Related responsibilities'));
    for (const l of contextual) { const b = button(l.label, () => follow([l], d.id), 'relation'); reading.append(b); }
  }
  reading.append(el('p', 'Select an underlined passage to follow its explanation or implementation.', 'hint'));
  return reading;
}
function render() {
  const p = current.project;
  const menuHadFocus = document.activeElement?.id === 'description-options';
  const scrolls = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-reading-key]'), pane => [pane.dataset.readingKey!, pane.scrollTop]));
  app.replaceChildren();
  const header = el('header'); const brand = el('div', 'stratic', 'brand'); brand.append(el('span', ' / v3', 'muted')); header.append(brand);
  header.append(button('Open project…', () => window.stratic.chooseProject().then(v => { current = v; signature = ''; clearDetail(); tab = 'description'; render(); }).catch(error), 'subtle'));
  if (p) {
    header.append(el('span', p.root.split('/').pop(), 'project-name'));
    const versions = el('select'); versions.setAttribute('aria-label', 'Revision');
    for (const item of [{ id: 'working', title: 'Working files' }, ...current.history]) { const o = el('option', item.id === 'working' ? item.title : `${item.id.slice(0, 7)} · ${item.title}`); o.value = item.id; versions.append(o); }
    versions.value = current.selection.revision;
    versions.onchange = () => { if (current.selection.description) { clearDetail(); void window.stratic.navigate({ action: 'open', description: current.selection.description, revision: versions.value }).then(() => refresh(true)).catch(error); } };
    header.append(versions, el('span', current.selection.revision !== 'working' ? 'History' : current.dirty ? 'Uncommitted changes' : 'Committed', 'badge'));
  }
  if (current.comparison) {
    const toggle = button(current.comparison.label, () => { highlightChanges = !highlightChanges; render(); }, 'subtle change-toggle');
    toggle.setAttribute('aria-pressed', String(highlightChanges)); toggle.title = 'Highlight changed paragraphs compared with ' + current.comparison.base.slice(0, 7); header.append(toggle);
  }
  app.append(header);
  if (!p) { app.append(el('section', 'Open a Git project containing a stratic folder to explore its descriptions.', 'empty')); return; }
  const layout = el('main', undefined, 'layout');
  const reading = el('section', undefined, 'reading');
  reading.dataset.readingKey = JSON.stringify([p.root, p.revision, tab]);
  if (tab === 'issues') {
    reading.append(el('h1', 'Project problems'), el('p', 'Descriptions stay readable while you repair these connections.', 'muted'));
    if (!p.issues.length) reading.append(el('p', 'The hierarchy and passage links resolve. Semantic accuracy is established by review.'));
    for (const issue of p.issues) { const row = el('div', undefined, 'problem'); row.append(el('strong', issue.path), el('p', issue.message)); if (issue.description) row.append(button('Open description', () => void open({ description: issue.description! }))); reading.append(row); }
  } else if (tab === 'tests') {
    reading.append(el('div', 'VERIFICATION', 'eyebrow'), el('h1', 'Tests'), el('p', 'Registered tests and recorded outcomes. Opening a test does not run it.', 'muted'));
    for (const test of p.tests) {
      const check = current.checks.find(r => r.tests.some(t => t.id === test.id));
      const outcome = check?.tests.find(t => t.id === test.id)?.outcome;
      const card = el('article', undefined, 'test-card'); card.append(el('span', check ? `${outcome} · ${check.current ? 'same content' : 'earlier content'}` : 'No recorded result', 'badge ' + (check?.current ? outcome : 'historical')), el('h2', test.name), el('p', test.description));
      if (check) card.append(el('p', `${check.recordedAt} · ${check.environment}`, 'muted small'));
      for (const c of test.code) card.append(button('Inspect test code', () => void open(c)));
      for (const v of test.verifies) card.append(button('Verified behavior', () => void open(v), 'subtle'));
      reading.append(card);
    }
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
    detail.append(el('div', 'SOURCE', 'eyebrow'), el('h2', source.path), button('Close source', () => { clearDetail(); render(); }, 'subtle'));
    if (source.problem) detail.append(el('p', source.problem, 'problem'));
    detail.append(sourceView(source.path, source.body, source.range));
  } else if (selectedConnections.length) {
    detail.append(el('div', 'THIS PASSAGE', 'eyebrow'), el('h2', 'Follow the connection'), button('Close connections', () => { clearDetail(); render(); }, 'subtle'));
    for (const l of selectedConnections) { const card = el('div', undefined, 'connection-card'); card.append(el('span', l.kind, 'badge'), button(l.label + ' →', () => void open(l.to, connectionOwner), 'connection-target')); if (l.reason) card.append(el('p', l.reason)); if (l.problem) card.append(el('p', l.problem, 'error')); detail.append(card); }
  }
  if (source || selectedConnections.length) layout.append(detail);
  layout.classList.toggle('single-pane', layout.childElementCount === 1);
  app.append(layout, descriptionMenu(p));
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
window.stratic.onSelection(() => { tab = 'description'; clearDetail(); menuContext = ''; focusMenu = menuOpen; void refresh(true); });
void refresh(); setInterval(() => void refresh(), 2000);
