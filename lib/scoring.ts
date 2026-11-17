import { checkAnswer } from './checkers';
import type { ItemRow, NewScoreEvent, SubmissionRow } from './types';

export interface ScoredSubmission {
  id: string;
  team_id: string;
  is_correct: boolean;
  rank: number | null;
}

export interface ItemResult {
  submissions: ScoredSubmission[];
  events: NewScoreEvent[];
}

function time(t: SubmissionRow['submitted_at']) {
  return t ? new Date(t).getTime() : Number.MAX_SAFE_INTEGER;
}

/**
 * Score one auto-scored item (R1, R2, R3).
 * - Submissions with `override` keep the teacher's is_correct.
 * - R1/R2: correct answers ranked by submission time; rank 1 gets `first`, others `correct`; wrong answers get `wrong`.
 * - R3: correct = +wager, wrong or missing answer after a locked wager = -wager. No wager defaults to 1.
 * - Teams in `doubleTeams` get their points for this item doubled (not in wager rounds).
 */
export function scoreItem(item: ItemRow, subs: SubmissionRow[], doubleTeams: Set<string> = new Set()): ItemResult {
  const pts = item.points;
  const scored: ScoredSubmission[] = subs.map((s) => ({
    id: s.id,
    team_id: s.team_id,
    is_correct: s.override ? !!s.is_correct : s.answer_raw ? checkAnswer(item.answer_key, s.answer_raw) : false,
    rank: null,
  }));

  const events: NewScoreEvent[] = [];
  const label = `${item.round_id} ${item.label}`;

  if (pts.wager) {
    for (const s of subs) {
      const r = scored.find((x) => x.id === s.id)!;
      const answered = !!s.answer_raw;
      if (!answered && s.wager == null) continue;
      const w = Math.min(5, Math.max(1, s.wager ?? 1));
      if (r.is_correct) events.push({ team_id: s.team_id, source: 'auto', tag: 'wager', points: w, reason: `${label}: correct, won wager ${w}` });
      else events.push({ team_id: s.team_id, source: 'auto', tag: 'wager', points: -w, reason: `${label}: ${answered ? 'wrong' : 'no answer'}, lost wager ${w}` });
    }
    return { submissions: scored, events };
  }

  const correct = subs
    .filter((s) => scored.find((x) => x.id === s.id)!.is_correct)
    .sort((a, b) => time(a.submitted_at) - time(b.submitted_at));
  correct.forEach((s, i) => {
    const r = scored.find((x) => x.id === s.id)!;
    r.rank = i + 1;
    const first = i === 0;
    const p = first ? (pts.first ?? pts.correct ?? 0) : (pts.correct ?? 0);
    events.push({ team_id: s.team_id, source: 'auto', tag: first ? 'first' : 'correct', points: p, reason: `${label}: ${first ? 'first correct' : 'correct'}` });
  });
  for (const s of subs) {
    const r = scored.find((x) => x.id === s.id)!;
    if (!r.is_correct && s.answer_raw && (pts.wrong ?? 0) !== 0) {
      events.push({ team_id: s.team_id, source: 'auto', tag: 'wrong', points: pts.wrong!, reason: `${label}: wrong` });
    }
  }

  for (const team of doubleTeams) {
    const base = events.filter((e) => e.team_id === team && e.source === 'auto').reduce((a, e) => a + e.points, 0);
    if (base !== 0) events.push({ team_id: team, source: 'powerup', tag: 'double', points: base, reason: `${label}: Double Down` });
  }
  return { submissions: scored, events };
}
