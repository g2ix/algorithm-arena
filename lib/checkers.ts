import type { AnswerKey, PartKey } from './types';

/** Uppercase and turn every separator (commas, arrows, dashes, etc.) into one space. */
export function tokens(input: string): string[] {
  return (input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Compare a typed sequence with the key. "A,B,D", "a b d", "A→B→D" and "ABD" all match "A B D". */
export function checkSequence(input: string, expected: string): boolean {
  const want = tokens(expected);
  let got = tokens(input);
  // "ABDEGCF" typed without separators: split into letters when the key is single letters.
  if (got.length === 1 && want.length > 1 && want.every((t) => /^[A-Z]$/.test(t))) {
    got = got[0].split('');
  }
  return sameList(got, want);
}

export function checkNumber(input: string, expected: number | number[]): boolean {
  const m = (input ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return false;
  const n = Number(m[0]);
  return (Array.isArray(expected) ? expected : [expected]).some((e) => e === n);
}

/** Edges are pairs of single-letter vertex names: "F-C, I-A", "FC IA", "c–f" all work. Order does not matter. */
export function edgeSet(input: string): Set<string> {
  const s = (input ?? '').toUpperCase().replace(/[0-9]/g, ' ');
  const out = new Set<string>();
  const re = /([A-Z])\s*[-–—_>→=]*\s*([A-Z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.add([m[1], m[2]].sort().join('-'));
  }
  return out;
}

export function checkEdgeSet(input: string, expected: string[]): boolean {
  const got = edgeSet(input);
  const want = new Set(expected.map((e) => tokens(e.replace(/[-–—]/g, ' ')).sort().join('-')));
  if (got.size !== want.size) return false;
  for (const e of want) if (!got.has(e)) return false;
  return true;
}

/** A cycle matches in any rotation, with or without the start repeated at the end: "C D B" and "B C D B" match "B C D". */
export function checkCycle(input: string, expected: string): boolean {
  const want = tokens(expected);
  let got = tokens(input);
  if (got.length === 1 && want.length > 1) got = got[0].split('');
  if (got.length === want.length + 1 && got[0] === got[got.length - 1]) got = got.slice(0, -1);
  if (got.length !== want.length) return false;
  for (let r = 0; r < want.length; r++) {
    if (want.every((w, i) => got[(i + r) % got.length] === w)) return true;
  }
  return false;
}

export function checkYesNo(input: string, expected: boolean): boolean {
  const t = (input ?? '').trim().toUpperCase();
  const yes = /^(Y|YES|OO|TRUE|MERON|MAYROON)\b/.test(t);
  const no = /^(N|NO|WALA|HINDI|FALSE|NONE)\b/.test(t);
  return expected ? yes : no;
}

export function checkPart(key: PartKey, input: string): boolean {
  switch (key.type) {
    case 'sequence':
    case 'array':
      return checkSequence(input, key.value);
    case 'number':
      return checkNumber(input, key.value);
    case 'edge_set':
      return checkEdgeSet(input, key.value);
    case 'cycle':
      return checkCycle(input, key.value);
    case 'yesno':
      return checkYesNo(input, key.value);
  }
}

/** True when every answer part is right. `answers` holds one string per answer box. */
export function checkAnswer(key: AnswerKey, answers: string[] | null | undefined): boolean {
  if (!answers || key.type === 'manual') return false;
  if (key.type === 'multi') {
    return key.parts.every((p, i) => checkPart(p, answers[i] ?? ''));
  }
  return checkPart(key, answers[0] ?? '');
}
