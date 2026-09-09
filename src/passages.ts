import type { Passage, Range } from './model.ts';

export function isPassage(value: unknown): value is Passage {
  if (!value || typeof value !== 'object') return false;
  const p = value as Passage;
  return typeof p.quote === 'string' && p.quote.length > 0 &&
    (p.prefix === undefined || typeof p.prefix === 'string') &&
    (p.suffix === undefined || typeof p.suffix === 'string');
}

/** Offsets refer to the exact source string (UTF-16), including Markdown syntax. */
export function resolvePassage(text: string, passage: Passage): Range {
  if (!isPassage(passage)) throw new Error('A passage needs a nonempty quote.');
  const matches: number[] = [];
  for (let at = text.indexOf(passage.quote); at !== -1; at = text.indexOf(passage.quote, at + 1)) {
    const end = at + passage.quote.length;
    if ((passage.prefix === undefined || text.slice(0, at).endsWith(passage.prefix)) &&
        (passage.suffix === undefined || text.slice(end).startsWith(passage.suffix))) matches.push(at);
  }
  if (matches.length === 0) throw new Error('The quoted passage no longer exists.');
  if (matches.length > 1) throw new Error('The quoted passage is ambiguous; add surrounding context.');
  const start = matches[0], end = start + passage.quote.length;
  return { start, end, startLine: text.slice(0, start).split('\n').length,
    endLine: text.slice(0, Math.max(start, end - 1)).split('\n').length };
}
