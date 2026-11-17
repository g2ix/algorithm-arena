// Answer keys -------------------------------------------------------------

export type PartKey =
  | { type: 'sequence'; value: string }
  | { type: 'array'; value: string }
  | { type: 'number'; value: number | number[] }
  | { type: 'edge_set'; value: string[] }
  | { type: 'cycle'; value: string }
  | { type: 'yesno'; value: boolean };

export type AnswerKey =
  | (PartKey & { label?: string })
  | { type: 'multi'; parts: (PartKey & { label: string })[] }
  | { type: 'manual' };

export type Points = {
  first?: number;
  correct?: number;
  wrong?: number;
  wager?: boolean;
  solve?: number;
  win?: number;
};

export type RoundId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type Phase = 'idle' | 'wager' | 'open' | 'closed' | 'revealed';

export interface ItemRow {
  id: string;
  round_id: RoundId;
  label: string;
  sort: number;
  prompt: string;
  figure_url: string | null;
  answer_figure_url: string | null;
  answer_type: string;
  answer_key: AnswerKey;
  answer_text: string | null;
  explanation: string | null;
  points: Points;
  time_limit_s: number;
  active: boolean;
}

export interface SubmissionRow {
  id: string;
  team_id: string;
  answer_raw: string[] | null;
  wager: number | null;
  is_correct: boolean | null;
  override: boolean;
  submitted_at: string | Date | null;
}

export interface NewScoreEvent {
  team_id: string;
  source: 'auto' | 'manual' | 'powerup';
  tag: string;
  points: number;
  reason: string;
}

/** Labels for the answer boxes a team sees for an item. */
export function answerFields(key: AnswerKey): string[] {
  if (key.type === 'manual') return [];
  if (key.type === 'multi') return key.parts.map((p) => p.label);
  return [key.label ?? 'Answer'];
}
