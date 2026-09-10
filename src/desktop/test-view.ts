import type { CheckResult, Description, TestRecord, DescriptionTarget } from '../model.ts';
import { resolvePassage } from '../passages.ts';
import { sourceView } from './source-view.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}

export function testView(description: Description, tests: TestRecord[], checks: (CheckResult & { current: boolean })[],
  expanded: Set<string>, read: (path: string) => Promise<string>, open: (target: DescriptionTarget) => void) {
  const relevant = tests.filter(test => test.verifies.some(target => target.description === description.id));
  if (!relevant.length) return null;
  const section = element('section', '', 'description-tests'); section.setAttribute('aria-label', 'Tests for ' + description.title);
  section.append(element('h2', 'Tests'));
  for (const test of relevant) {
    const candidates = checks.filter(check => check.tests.some(item => item.id === test.id));
    const check = candidates.find(item => item.current) ?? candidates[0];
    const outcome = check?.tests.find(item => item.id === test.id)?.outcome;
    const label = !check ? 'No recorded result' : `${check.current ? 'Current' : 'Earlier'} ${outcome}`;
    const row = element('details', '', 'test-row'); row.dataset.test = test.id;
    const key = description.id + '/' + test.id;
    row.open = expanded.has(key);
    const summary = element('summary'); summary.title = test.name;
    const disk = element('span', '', 'result-disk ' + (check?.current ? outcome : check ? 'earlier' : 'unrecorded'));
    disk.setAttribute('role', 'img'); disk.setAttribute('aria-label', label); disk.title = label;
    summary.append(disk, element('span', test.description || test.name, 'test-description'));
    if (!check || !check.current || outcome === 'inconclusive') summary.append(element('span', label, 'test-result-note'));
    row.append(summary);
    const content = element('div', '', 'test-content'); row.append(content);
    let loaded = false;
    const load = async () => {
      if (loaded || !row.open) return;
      loaded = true;
      for (const target of test.code) {
        const file = element('div', '', 'test-source'); file.append(element('p', target.path, 'muted small')); content.append(file);
        try {
          const body = await read(target.path);
          if (!row.isConnected) return;
          const range = resolvePassage(body, target.passage);
          const code = sourceView(target.path, body, range); file.append(code);
          // Keep original line numbers and surrounding source, positioned at the test.
          const selected = code.querySelector('.highlighted');
          if (selected) code.scrollTop += selected.getBoundingClientRect().top - code.getBoundingClientRect().top - 30;
        } catch (error) {
          if (row.isConnected) file.append(element('p', (error as Error).message, 'problem'));
        }
      }
      if (check) {
        const evidence = element('details', '', 'test-evidence');
        evidence.append(element('summary', label + ' · ' + check.recordedAt), element('p', check.environment), element('p', check.method), element('p', check.evidence));
        content.append(evidence);
      }
      const claims = element('details', '', 'test-evidence'); claims.append(element('summary', 'Checked descriptions'));
      for (const target of test.verifies) {
        const claim = element('button', target.passage?.quote ?? target.description, 'test-claim subtle');
        claim.title = 'Read the checked description passage'; claim.onclick = () => open(target); claims.append(claim);
      }
      content.append(claims);
    };
    row.addEventListener('toggle', () => { if (row.open) { expanded.add(key); void load(); } else expanded.delete(key); });
    section.append(row);
    // A rebuilt open row may be attached after this function returns.
    if (row.open) queueMicrotask(() => { if (row.isConnected) void load(); });
  }
  return section;
}
