export type PublicItem = {
  id: string; round: string; roundTitle: string; label: string; prompt: string; figure: string | null;
  fields: string[]; manual: boolean; wager: boolean; timeLimit: number;
  answerText: string | null; explanation: string | null; answerFigure: string | null;
};

export type StateView = { phase: 'idle' | 'wager' | 'open' | 'closed' | 'revealed'; item: PublicItem | null; closesAt: string | null; serverNow: string; version: string };

export type TeamScore = { id: string; name: string; color: string; total: number; rank: number; byRound: Record<string, number>; members: string[] };

export type MeView = {
  me: { name: string };
  session: { id: string; code: string; title: string; className: string; status: string; practice: boolean };
  team: TeamScore;
  teamsCount: number;
  leader: { name: string; total: number } | null;
  state: StateView;
  mine: { answers: string[] | null; wager: number | null; by: string | null; correct: boolean | null; rank: number | null; points: number | null };
  powerups: { type: string; status: string; item_id: string | null; hint: LifelineHint | null }[];
  feed: { points: number; reason: string; created_at: string }[];
};

export type BoardView = {
  session: { id: string; code: string; title: string; className: string; status: string; practice: boolean };
  state: StateView;
  plays: { team: string; color: string; type: string; at: string }[];
  teams: TeamScore[];
  answered: string[];
  firstCorrect: string | null;
  recent: { team: string; color: string; points: number; reason: string; created_at: string }[];
};

export type LifelineHint = { by: string; draft: string[]; hints: { label: string | null; text: string }[] };
