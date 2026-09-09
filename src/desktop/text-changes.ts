// Compare paragraphs so highlighting follows the description, not its selected passage.
export function textChanges(before: string, after: string) {
  const chunks = (s: string) => [...s.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)].map(m => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
  const a = chunks(before), b = chunks(after);
  const additions: { start: number; end: number }[] = [], removed: string[] = [];
  // Bound memory for unusually fragmented files; a whole-text change is still accurate.
  if (a.length * b.length > 1_000_000) return { additions: before === after ? [] : [{ start: 0, end: after.length }], removed: before === after || !before ? [] : [before] };
  const width = b.length + 1, lengths = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    lengths[i * width + j] = a[i].text === b[j].text ? 1 + lengths[(i + 1) * width + j + 1] : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
  }
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].text === b[j].text) { i++; j++; }
    else if (j < b.length && (i === a.length || lengths[i * width + j + 1] >= lengths[(i + 1) * width + j])) { additions.push({ start: b[j].start, end: b[j].end }); j++; }
    else { removed.push(a[i].text); i++; }
  }
  return { additions, removed };
}
