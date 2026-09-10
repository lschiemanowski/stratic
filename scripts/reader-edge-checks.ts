import { sourceView } from '../src/desktop/source-view.ts';
import { testView } from '../src/desktop/test-view.ts';
import type { Description, TestRecord } from '../src/model.ts';
import { resolvePassage } from '../src/passages.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Run in the smoke test's Chromium renderer, using the real DOM and production renderers.
export function checkSourceSizeBoundary() {
  const sample = '// ' + 'x'.repeat(199_996) + '\n';
  assert(sample.length === 200_000, 'Fixture is exactly at the highlighting limit.');
  for (const body of [sample, sample + '\n', sample]) {
    const view = sourceView('boundary.ts', body, resolvePassage(body, { quote: '// ' }));
    assert(Array.from(view.querySelectorAll('code'), code => code.textContent).join('\n') === body, 'Size fallback preserves every source character.');
    assert(Boolean(view.querySelector('.hljs-comment')) === (body.length === 200_000), 'Highlight at the limit, use plain text above it, and invalidate the same-path cache in both directions.');
    assert(view.querySelectorAll('.highlighted').length === 1, 'Plain text keeps passage highlighting.');
    assert(Array.from(view.querySelectorAll('.line-number'), node => node.textContent).join(',') === (body === sample ? '1,2' : '1,2,3'), 'Line numbers retain trailing empty lines.');
  }
}

export async function checkDetachedTestReads() {
  for (const reject of [false, true]) {
    const host = document.createElement('div'); document.body.append(host);
    try {
      const description: Description = { id: 'old', title: 'Old description', body: 'Old claim', path: 'old.md' };
      const test: TestRecord = { id: 'delayed', name: 'Delayed read', description: 'Old test', code: [{ path: 'old.ts', passage: { quote: 'const old = true;' } }], verifies: [{ description: 'old' }] };
      let resolveRead!: (body: string) => void, rejectRead!: (error: Error) => void, markStarted!: () => void;
      const response = new Promise<string>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
      const started = new Promise<void>(resolve => { markStarted = resolve; });
      const previous = testView(description, [test], [], new Set(['old/delayed']), () => { markStarted(); return response; }, () => {})!;
      host.append(previous);
      await started;
      const nextDescription = { ...description, id: 'new', title: 'New description' };
      const nextTest = { ...test, description: 'New test', code: [{ path: 'new.ts', passage: { quote: 'const fresh = true;' } }], verifies: [{ description: 'new' }] };
      const next = testView(nextDescription, [nextTest], [], new Set(['new/delayed']), async () => 'const fresh = true;', () => {})!;
      // Navigation replaces the old pane while its source request is still pending.
      host.replaceChildren(next);
      if (reject) rejectRead(new Error('Old read failed'));
      else resolveRead('const old = true;');
      await new Promise(resolve => setTimeout(resolve, 0));
      assert(next.querySelector('.source-code code')?.textContent === 'const fresh = true;', 'The newly selected description retains its own test code.');
      assert(!previous.querySelector('.source-code, .problem'), 'A late source response or error cannot populate a detached test row.');
      assert(!host.textContent?.includes('const old') && !host.textContent?.includes('Old read failed'), 'Old responses do not leak into the visible pane.');
    } finally { host.remove(); }
  }
}
