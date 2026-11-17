import { describe, expect, it } from 'vitest';
import { checkAnswer, checkCycle, checkEdgeSet, checkNumber, checkSequence, checkYesNo } from '../lib/checkers';
import { scoreItem } from '../lib/scoring';
import { ITEMS } from '../lib/seed';
import type { ItemRow, SubmissionRow } from '../lib/types';

const item = (label: string): ItemRow => {
  const s = ITEMS.find((i) => i.label === label)!;
  return { id: label, sort: 0, active: true, figure_url: null, answer_figure_url: null, explanation: null, answer_type: s.answer_key.type, ...s } as ItemRow;
};

describe('sequence checker', () => {
  it('accepts many separators and cases', () => {
    for (const a of ['A B D E G C F', 'a,b,d,e,g,c,f', 'A→B→D→E→G→C→F', 'A-B-D-E-G-C-F', ' abdegcf ', 'A, B, D, E, G, C, F.'])
      expect(checkSequence(a, 'A B D E G C F')).toBe(true);
  });
  it('rejects wrong order or missing items', () => {
    expect(checkSequence('A B D G E C F', 'A B D E G C F')).toBe(false);
    expect(checkSequence('A B D E G C', 'A B D E G C F')).toBe(false);
    expect(checkSequence('', 'A B')).toBe(false);
  });
  it('handles numbers and multi-letter tokens', () => {
    expect(checkSequence('8,10,12,15,25,20', '8 10 12 15 25 20')).toBe(true);
    expect(checkSequence('[8, 10, 12, 15, 25, 20]', '8 10 12 15 25 20')).toBe(true);
    expect(checkSequence('810121525 20', '8 10 12 15 25 20')).toBe(false);
    expect(checkSequence('dm, p1, p2, db, ds, al, se', 'DM P1 P2 DB DS AL SE')).toBe(true);
  });
});

describe('other checkers', () => {
  it('numbers', () => {
    expect(checkNumber('28 minutes', 28)).toBe(true);
    expect(checkNumber('29', 28)).toBe(false);
    expect(checkNumber('4 edges', [5, 4])).toBe(true);
    expect(checkNumber('none', 3)).toBe(false);
  });
  it('edge sets ignore order and direction', () => {
    const key = ['F-C', 'I-A', 'A-F', 'T-B', 'B-I', 'M-S', 'A-S'];
    expect(checkEdgeSet('F-C, I-A, A-F, T-B, B-I, M-S, A-S', key)).toBe(true);
    expect(checkEdgeSet('sa ms ib bt fa ai cf', key)).toBe(true);
    expect(checkEdgeSet('F-C 5, I-A 5, A-F 6, T-B 6, B-I 7, M-S 7, A-S 8', key)).toBe(true);
    expect(checkEdgeSet('F-C, I-A, A-F, T-B, B-I, M-S, B-M', key)).toBe(false);
    expect(checkEdgeSet('F-C, I-A, A-F, T-B, B-I, M-S', key)).toBe(false);
  });
  it('cycles in any rotation', () => {
    expect(checkCycle('B C D', 'B C D')).toBe(true);
    expect(checkCycle('C D B', 'B C D')).toBe(true);
    expect(checkCycle('B→C→D→B', 'B C D')).toBe(true);
    expect(checkCycle('B D C', 'B C D')).toBe(false);
  });
  it('yes/no', () => {
    expect(checkYesNo('Yes', true)).toBe(true);
    expect(checkYesNo('oo', true)).toBe(true);
    expect(checkYesNo('no', true)).toBe(false);
  });
});

describe('every seeded key accepts its own answer text', () => {
  const canonical: Record<string, string[]> = {
    H5: ['10 20 30 40 50', '5'],
    M1: ['28', 'T B I F C'],
    M2: ['44', 'F-C, I-A, A-F, T-B, B-I, M-S, A-S'],
    M3: ['T B M A I S F C', '3'],
    M5: ['yes', 'B C D'],
  };
  for (const s of ITEMS.filter((i) => i.answer_key.type !== 'manual')) {
    it(`${s.round_id} ${s.label}`, () => {
      const ans = canonical[s.label] ?? [s.answer_text];
      expect(checkAnswer(s.answer_key, ans)).toBe(true);
    });
  }
  it('M1 rejects the 29-minute trap', () => {
    expect(checkAnswer(item('M1').answer_key, ['29', 'T B I C'])).toBe(false);
    expect(checkAnswer(item('M1').answer_key, ['28', 'T B I C'])).toBe(false);
  });
});

describe('scoring', () => {
  const sub = (id: string, team: string, ans: string[] | null, t: number, wager: number | null = null): SubmissionRow => ({
    id, team_id: team, answer_raw: ans, wager, is_correct: null, override: false, submitted_at: new Date(1_700_000_000_000 + t),
  });

  it('R1: first correct +3, others +1, wrong -1', () => {
    const r = scoreItem(item('#1'), [
      sub('a', 'T1', ['A B D E G C F'], 500),
      sub('b', 'T2', ['A B D E G C F'], 100),
      sub('c', 'T3', ['D B G E A C F'], 50),
    ]);
    const pts = (t: string) => r.events.filter((e) => e.team_id === t).reduce((a, e) => a + e.points, 0);
    expect(pts('T2')).toBe(3);
    expect(pts('T1')).toBe(1);
    expect(pts('T3')).toBe(-1);
    expect(r.submissions.find((s) => s.id === 'b')!.rank).toBe(1);
  });

  it('R2: wrong gives 0 and no event', () => {
    const r = scoreItem(item('H3'), [sub('a', 'T1', ['5 10 20 40 30 25'], 1), sub('b', 'T2', ['5 10 20 30 40 25'], 0)]);
    expect(r.events).toEqual([expect.objectContaining({ team_id: 'T1', points: 4, tag: 'first' })]);
  });

  it('R3: wagers win and lose, no wager defaults to 1, wager without answer loses', () => {
    const r = scoreItem(item('M1'), [
      sub('a', 'T1', ['28', 'T-B-I-F-C'], 1, 5),
      sub('b', 'T2', ['29', 'T B I C'], 2, 3),
      sub('c', 'T3', ['28', 'T B I F C'], 3, null),
      sub('d', 'T4', null, 0, 4),
    ]);
    const pts = (t: string) => r.events.filter((e) => e.team_id === t).reduce((a, e) => a + e.points, 0);
    expect([pts('T1'), pts('T2'), pts('T3'), pts('T4')]).toEqual([5, -3, 1, -4]);
  });

  it('teacher override is respected', () => {
    const s = sub('a', 'T1', ['nonsense'], 1);
    s.override = true;
    s.is_correct = true;
    const r = scoreItem(item('#2'), [s]);
    expect(r.events[0].points).toBe(3);
  });

  it('Double Down doubles gains and losses', () => {
    const r = scoreItem(item('#1'), [sub('a', 'T1', ['A B D E G C F'], 1), sub('b', 'T2', ['wrong'], 2)], new Set(['T1', 'T2']));
    const pts = (t: string) => r.events.filter((e) => e.team_id === t).reduce((a, e) => a + e.points, 0);
    expect(pts('T1')).toBe(6);
    expect(pts('T2')).toBe(-2);
  });
});
