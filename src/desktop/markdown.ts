import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import katex from 'katex';
import { decodeString } from 'micromark-util-decode-string';
import type { Connection, Range } from '../model.ts';
import { sourceView } from './source-view.ts';

type Md = { type: string; position?: { start: { offset?: number }; end: { offset?: number } }; children?: Md[]; value?: string; depth?: number; ordered?: boolean; start?: number | null; checked?: boolean | null; lang?: string | null; url?: string; title?: string | null; alt?: string | null; identifier?: string; align?: (string | null)[] };
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const parsed = new Map<string, Md>();
export function parseMarkdown(body: string): Md {
  let tree = parsed.get(body);
  if (!tree) { tree = parser.parse(body) as Md; if (parsed.size >= 8) parsed.delete(parsed.keys().next().value!); parsed.set(body, tree); }
  return tree;
}
/** Map decoded text characters back to their Markdown spans, including entities and escapes. */
export function textPositions(body: string, node: Md): { start: number; end: number }[] {
  const start = node.position?.start.offset ?? 0, end = node.position?.end.offset ?? start;
  const raw = body.slice(start, end), value = node.value ?? '';
  const decoded: { char: string; start: number; end: number }[] = [];
  for (let i = 0; i < raw.length;) {
    const token = /^(?:\\[!-/:-@\[-`{-~]|&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z\d]*);|\r\n)/.exec(raw.slice(i))?.[0] ?? raw[i];
    const text = token === '\r\n' ? '\n' : decodeString(token);
    for (let j = 0; j < text.length; j++) decoded.push({ char: text[j], start: start + i, end: start + i + token.length });
    i += token.length;
  }
  let cursor = 0;
  const positions: { start: number; end: number }[] = [];
  for (let i = 0; i < value.length; i++) {
    // Multiline list/quote indentation occurs in source spans but not the text value.
    while (cursor < decoded.length && decoded[cursor].char !== value[i]) cursor++;
    if (cursor === decoded.length) return Array.from({ length: value.length }, () => ({ start, end }));
    positions.push(decoded[cursor++]);
  }
  return positions;
}
export function markdownView(body: string, options: {
  connections?: Connection[]; selected?: Range; changes?: { start: number; end: number }[];
  follow: (connections: Connection[]) => void; image: (url: string) => Promise<string>;
}): HTMLElement {
  const tree = parseMarkdown(body), container = document.createElement('div'); container.className = 'prose';
  const definitions = new Map<string, Md>();
  const collect = (node: Md) => { if (node.type === 'definition') definitions.set(node.identifier!, node); node.children?.forEach(collect); }; collect(tree);
  const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && a.end > b.start;
  const range = (node: Md) => ({ start: node.position?.start.offset ?? 0, end: node.position?.end.offset ?? 0 });
  const connections = options.connections?.filter(c => c.range && !c.problem) ?? [];
  const decorate = (element: HTMLElement, span: { start: number; end: number }) => {
    const targets = connections.filter(c => overlap(c.range!, span));
    if (targets.length) {
      element.classList.add('passage'); element.setAttribute('role', 'button'); element.tabIndex = 0;
      element.onclick = event => { event.stopPropagation(); options.follow(targets); };
      element.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); options.follow(targets); } };
    }
    if (options.selected && overlap(options.selected, span)) element.classList.add('selected');
  };
  const text = (node: Md): DocumentFragment => {
    const fragment = document.createDocumentFragment(), value = node.value ?? '', spans = textPositions(body, node);
    let start = 0;
    const identity = (i: number) => JSON.stringify([connections.map((c, j) => overlap(c.range!, spans[i]) ? j : -1).filter(j => j >= 0), !!options.selected && overlap(options.selected, spans[i])]);
    while (start < value.length) {
      let end = start + 1; const key = identity(start);
      while (end < value.length && identity(end) === key) end++;
      const part = document.createElement('span'); part.textContent = value.slice(start, end); decorate(part, { start: spans[start].start, end: spans[end - 1].end }); fragment.append(part); start = end;
    }
    return fragment;
  };
  const render = (node: Md): Node => {
    if (node.type === 'text') return text(node);
    if (node.type === 'definition') return document.createDocumentFragment();
    let element: HTMLElement;
    const tags: Record<string, string> = { root: 'div', paragraph: 'p', emphasis: 'em', strong: 'strong', delete: 'del', blockquote: 'blockquote', listItem: 'li', break: 'br', thematicBreak: 'hr', tableRow: 'tr', tableCell: 'td' };
    if (node.type === 'heading') element = document.createElement(`h${node.depth}`);
    else if (node.type === 'list') { element = document.createElement(node.ordered ? 'ol' : 'ul'); if (node.ordered && node.start) element.setAttribute('start', String(node.start)); }
    else if (node.type === 'table') {
      element = document.createElement('table');
      const head = document.createElement('thead'), body = document.createElement('tbody');
      node.children?.forEach((row, i) => { const tr = document.createElement('tr'); row.children?.forEach((cell, j) => { const td = document.createElement(i ? 'td' : 'th'); if (node.align?.[j]) td.style.textAlign = node.align[j]!; cell.children?.forEach(child => td.append(render(child))); tr.append(td); }); (i ? body : head).append(tr); });
      element.append(head, body);
    } else if (node.type === 'inlineMath' || node.type === 'math') {
      element = document.createElement(node.type === 'math' ? 'div' : 'span'); element.className = node.type === 'math' ? 'equation display-equation' : 'equation';
      try { katex.render(node.value ?? '', element, { displayMode: node.type === 'math', trust: false, throwOnError: true, maxExpand: 500, maxSize: 20, strict: 'error' }); }
      catch (error) { element.classList.add('math-error'); element.textContent = node.value ?? ''; element.title = `Equation could not be rendered: ${(error as Error).message}`; }
      decorate(element, range(node));
    } else if (node.type === 'image' || node.type === 'imageReference') {
      const destination = node.type === 'image' ? node : definitions.get(node.identifier!);
      element = document.createElement('span'); element.className = 'description-image';
      const image = document.createElement('img'); image.alt = node.alt ?? ''; if (destination?.title) image.title = destination.title; image.decoding = 'async';
      const missing = (reason: string) => { element.classList.add('image-error'); element.title = reason; element.replaceChildren(document.createTextNode(`${node.alt || 'Image'} — Image unavailable.`)); };
      image.onerror = () => missing('Image could not be displayed.');
      element.append(image); decorate(element, range(node));
      if (!destination?.url) missing('Image reference is missing.');
      else options.image(destination.url).then(url => { image.src = url; }).catch(error => missing((error as Error).message));
    } else if (node.type === 'inlineCode' || node.type === 'code') {
      if (node.type === 'code') { const language = ({ typescript: 'ts', javascript: 'js', python: 'py', scheme: 'scm' } as Record<string, string>)[node.lang ?? ''] ?? node.lang ?? 'txt'; element = sourceView(`snippet.${language}`, node.value ?? ''); element.classList.add('markdown-code'); }
      else { element = document.createElement('code'); element.textContent = node.value ?? ''; }
      decorate(element, range(node));
    } else if (node.type === 'link' || node.type === 'linkReference') {
      element = document.createElement('span'); element.className = 'markdown-link'; const destination = node.type === 'link' ? node : definitions.get(node.identifier!); element.title = destination?.url ?? '';
    } else if (tags[node.type]) element = document.createElement(tags[node.type]);
    else { element = document.createElement('span'); element.textContent = node.value ?? body.slice(range(node).start, range(node).end); decorate(element, range(node)); }
    if (node.type !== 'table') node.children?.forEach(child => element.append(render(child)));
    if (node.type === 'listItem' && typeof node.checked === 'boolean') { const box = document.createElement('input'); box.type = 'checkbox'; box.checked = node.checked; box.disabled = true; box.setAttribute('aria-label', node.checked ? 'Completed' : 'Not completed'); element.prepend(box); element.classList.add('task-item'); }
    if (['paragraph', 'heading', 'blockquote', 'list', 'table', 'code', 'math', 'html'].includes(node.type) && options.changes?.some(c => overlap(c, range(node)))) {
      element.classList.add('changed-text');
      element.querySelectorAll('.changed-text').forEach(child => child.classList.remove('changed-text'));
    }
    return element;
  };
  for (const child of tree.children ?? []) container.append(render(child));
  return container;
}
