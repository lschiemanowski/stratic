import hljs from 'highlight.js/lib/common';
import scheme from 'highlight.js/lib/languages/scheme';
import type { Range } from '../model.ts';
hljs.registerLanguage('scheme', scheme);

const extensions: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', css: 'css', html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml',
  py: 'python', pyw: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp',
  sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', markdown: 'markdown', ini: 'ini', toml: 'ini', php: 'php',
  swift: 'swift', kt: 'kotlin', kts: 'kotlin', sc: 'scala', scala: 'scala',
  scm: 'scheme', ss: 'scheme', rkt: 'scheme', diff: 'diff', patch: 'diff',
};
let cached: { path: string; body: string; lines: HTMLElement[] } | undefined;
function lines(path: string, body: string): HTMLElement[] {
  if (cached?.path === path && cached.body === body) return cached.lines;
  const filename = path.split('/').pop()!.toLowerCase();
  const language = filename === 'makefile' ? 'makefile' : filename === 'dockerfile' ? 'dockerfile' : extensions[filename.split('.').pop()!];
  const result: HTMLElement[] = [document.createElement('code')];
  const append = (text: string, classes: string[]) => {
    text.split('\n').forEach((part, i) => {
      if (i) result.push(document.createElement('code'));
      if (!part) return;
      const node = classes.length ? document.createElement('span') : document.createTextNode(part);
      if (node instanceof HTMLElement) { node.className = classes.join(' '); node.textContent = part; }
      result[result.length - 1].append(node);
    });
  };
  if (language && hljs.getLanguage(language) && body.length <= 200_000) {
    // Parse only library-generated markup, then retain text and token classes.
    // No repository-provided element, URL, or event attribute enters the live DOM.
    const template = document.createElement('template');
    template.innerHTML = hljs.highlight(body, { language, ignoreIllegals: true }).value.replace(/\r/g, '&#13;');
    const visit = (node: Node, classes: string[]) => {
      if (node.nodeType === Node.TEXT_NODE) append(node.textContent ?? '', classes);
      else {
        const tokenClasses = node instanceof HTMLSpanElement ? Array.from(node.classList).filter(c => /^[a-zA-Z_][\w-]*$/.test(c)) : [];
        for (const child of Array.from(node.childNodes)) visit(child, [...classes, ...tokenClasses]);
      }
    };
    visit(template.content, []);
  } else append(body, []);
  cached = { path, body, lines: result }; return result;
}
export function sourceView(path: string, body: string, range?: Range): HTMLPreElement {
  const pre = document.createElement('pre'); pre.className = 'hljs source-code';
  for (const [index, code] of lines(path, body).entries()) {
    const row = document.createElement('div'); row.className = 'code-line';
    if (range && index + 1 >= range.startLine && index + 1 <= range.endLine) row.classList.add('highlighted');
    const number = document.createElement('span'); number.className = 'line-number'; number.textContent = String(index + 1); number.setAttribute('aria-hidden', 'true');
    row.append(number, code.cloneNode(true)); pre.append(row);
  }
  return pre;
}
