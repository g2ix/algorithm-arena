import { checkCycle, checkEdgeSet, checkNumber, checkPart, checkSequence, edgeSet, tokens } from './checkers';
import type { AnswerKey, PartKey } from './types';

// Lifeline hints: compare a team's draft answer with the key and point at
// what to fix, without ever printing the missing pieces of the answer.

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function count<T>(list: T[]) {
  const m = new Map<T, number>();
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

function splitLike(got: string[], want: string[]) {
  // Mirror the checker: "ABDEG" typed without separators means single letters.
  if (got.length === 1 && want.length > 1 && want.every((t) => /^[A-Z]$/.test(t))) return got[0].split('');
  return got;
}

function sequenceHint(input: string, expected: string): string {
  const want = tokens(expected);
  const got = splitLike(tokens(input), want);
  if (checkSequence(input, expected)) return 'This looks right. Lock it in!';

  const wantCount = count(want);
  const extra = [...new Set(got.filter((t) => !wantCount.has(t)))];
  const hints: string[] = [];
  if (extra.length) {
    hints.push(`${extra.slice(0, 2).map((t) => `"${t}"`).join(' and ')} ${extra.length === 1 ? "isn't" : "aren't"} in the answer at all.`);
  }
  if (got.length !== want.length) {
    hints.push(`The answer has ${want.length} items; you have ${got.length}.`);
  }
  let prefix = 0;
  while (prefix < Math.min(got.length, want.length) && got[prefix] === want[prefix]) prefix++;
  const gotCount = count(got);
  const sameItems = got.length === want.length && [...wantCount].every(([k, n]) => gotCount.get(k) === n);
  if (sameItems) {
    hints.push(`You have exactly the right items, just in the wrong order.`);
  } else {
    const dupes = [...gotCount].filter(([k, n]) => n > (wantCount.get(k) ?? 0) && wantCount.has(k)).map(([k]) => k);
    if (dupes.length) hints.push(`"${dupes[0]}" appears more times than it should.`);
  }
  if (prefix > 0 && prefix < want.length) {
    hints.push(`Your first ${prefix === 1 ? 'item is' : `${prefix} items are`} right; the ${ordinal(prefix + 1)} is where it goes wrong.`);
  } else if (prefix === 0 && got.length) {
    hints.push(`Check your very first item: it should not be "${got[0]}".`);
  }
  return hints.slice(0, 3).join(' ');
}

function numberHint(input: string, expected: number | number[]): string {
  const m = (input ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return 'Type a number for this one.';
  if (checkNumber(input, expected)) return 'This looks right. Lock it in!';
  const n = Number(m[0]);
  const list = Array.isArray(expected) ? expected : [expected];
  const target = list.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
  const off = Math.abs(target - n);
  const close = off <= Math.max(1, Math.abs(target) * 0.15);
  return `${n} is too ${n > target ? 'high' : 'low'}${close ? ', but you are close' : ''}.`;
}

function edgeHint(input: string, expected: string[]): string {
  if (checkEdgeSet(input, expected)) return 'This looks right. Lock it in!';
  const got = edgeSet(input);
  const want = new Set(expected.map((e) => tokens(e.replace(/[-–—]/g, ' ')).sort().join('-')));
  if (!got.size) return 'List roads as pairs, e.g. A-B, C-D.';
  const right = [...got].filter((e) => want.has(e)).length;
  const wrong = [...got].filter((e) => !want.has(e));
  const hints = [`${right} of your ${got.size} road${got.size === 1 ? ' is' : 's are'} right; the answer uses ${want.size}.`];
  if (wrong.length) hints.push(`${wrong[0]} is not one of them.`);
  return hints.join(' ');
}

function cycleHint(input: string, expected: string): string {
  if (checkCycle(input, expected)) return 'This looks right. Lock it in!';
  const want = tokens(expected);
  let got = tokens(input);
  if (got.length === 1 && want.length > 1) got = got[0].split('');
  if (got.length === want.length + 1 && got[0] === got[got.length - 1]) got = got.slice(0, -1);
  const off = [...new Set(got.filter((t) => !want.includes(t)))];
  const hints: string[] = [];
  if (off.length) hints.push(`"${off[0]}" is not on the cycle.`);
  if (got.length !== want.length) hints.push(`The cycle has ${want.length} vertices; you have ${got.length}.`);
  if (!hints.length) hints.push('Right vertices, but follow the arrows: the order is off.');
  return hints.join(' ');
}

export function partHint(key: PartKey, input: string): string {
  if (!(input ?? '').trim()) return 'You left this blank. Make a guess so the lifeline can check it.';
  switch (key.type) {
    case 'sequence':
    case 'array':
      return sequenceHint(input, key.value);
    case 'number':
      return numberHint(input, key.value);
    case 'edge_set':
      return edgeHint(input, key.value);
    case 'cycle':
      return cycleHint(input, key.value);
    case 'yesno':
      return checkPart(key, input) ? 'This looks right.' : 'Look at the figure again: flip this one.';
  }
}

/** One hint per answer box, labelled for multi-part items. */
export function suggestHint(key: AnswerKey, answers: string[]): { label: string | null; text: string }[] {
  if (key.type === 'manual') return [];
  if (key.type === 'multi') return key.parts.map((p, i) => ({ label: p.label, text: partHint(p, answers[i] ?? '') }));
  return [{ label: null, text: partHint(key, answers[0] ?? '') }];
}
