import { describe, expect, it } from 'vitest';
import { partHint, suggestHint } from '../lib/hints';
import { scoreItem } from '../lib/scoring';
import { ITEMS } from '../lib/seed';
import type { ItemRow, SubmissionRow } from '../lib/types';

const item = (label: string): ItemRow => {
  const s = ITEMS.find((i) => i.label === label)!;
  return { id: label, sort: 0, active: true, figure_url: null, answer_figure_url: null, explanation: null, answer_type: s.answer_key.type, ...s } as ItemRow;
};
const sub = (team: string, answer: string[] | null, t: number, wager: number | null = null): SubmissionRow =>
  ({ id: team, team_id: team, answer_raw: answer, wager, is_correct: null, override: false, submitted_at: new Date(1000 + t) });
const total = (r: ReturnType<typeof scoreItem>, team: string) => r.events.filter((e) => e.team_id === team).reduce((a, e) => a + e.points, 0);

describe('lifeline hints', () => {
  const key = { type: 'sequence' as const, value: 'A B D E G C F' };
  it('confirms a correct draft', () => expect(partHint(key, 'abdegcf')).toMatch(/looks right/));
  it('points at the first wrong position', () => expect(partHint(key, 'A B D G E C F')).toMatch(/right items.*wrong order.*first 3 items are right; the 4th/s));
  it('flags items that do not belong and wrong length', () => {
    const h = partHint(key, 'A B X');
    expect(h).toMatch(/"X" isn't in the answer/);
    expect(h).toMatch(/7 items; you have 3/);
  });
  it('never prints answer items the team does not have', () => {
    const h = partHint(key, 'A B');
    for (const missing of ['D', 'E', 'G', 'C', 'F']) expect(h).not.toContain(`"${missing}"`);
  });
  it('says too high / too low for numbers', () => {
    expect(partHint({ type: 'number', value: 28 }, '40')).toMatch(/too high/);
    expect(partHint({ type: 'number', value: 28 }, '27')).toMatch(/too low, but you are close/);
  });
  it('counts right roads for edge sets', () => {
    expect(partHint({ type: 'edge_set', value: ['A-B', 'C-D'] }, 'A-B, C-E')).toMatch(/1 of your 2 roads are right; the answer uses 2\. C-E is not/);
  });
  it('gives one hint per part on multi items', () => {
    const it2 = item('M5');
    const h = suggestHint(it2.answer_key, ['yes', 'B C X']);
    expect(h).toHaveLength(2);
    expect(h[1].text).toMatch(/"X" is not on the cycle/);
  });
});

describe('power-up scoring', () => {
  it('Shield cancels a wrong-answer penalty', () => {
    const r = scoreItem(item('#1'), [sub('a', ['nope'], 1)], { shield: new Set(['a']) });
    expect(total(r, 'a')).toBe(0);
  });
  it('Shield cancels a lost High Roller wager', () => {
    const it3 = item('M5');
    const r = scoreItem(it3, [sub('a', ['no', 'x'], 1, 9)], { highRoller: new Set(['a']), shield: new Set(['a']) });
    expect(total(r, 'a')).toBe(0);
  });
  it('High Roller raises the wager cap to 10', () => {
    const r = scoreItem(item('M5'), [sub('a', ['yes', 'B C D'], 1, 9), sub('b', ['yes', 'B C D'], 2, 9)], { highRoller: new Set(['a']) });
    expect(total(r, 'a')).toBe(9);
    expect(total(r, 'b')).toBe(5);
  });
  it('Fast Pass gives first-place points to a slower correct team, and Double Down doubles it', () => {
    const subs = [sub('a', ['A B D E G C F'], 1), sub('b', ['A B D E G C F'], 2)];
    expect(total(scoreItem(item('#1'), subs, { fast: new Set(['b']) }), 'b')).toBe(3);
    expect(total(scoreItem(item('#1'), subs, { fast: new Set(['b']), double: new Set(['b']) }), 'b')).toBe(6);
  });
  it('still accepts the old Set argument for Double Down', () => {
    expect(total(scoreItem(item('#1'), [sub('a', ['A B D E G C F'], 1)], new Set(['a'])), 'a')).toBe(6);
  });
});
