export type PublicItem = {
  id: string; round: string; roundTitle: string; label: string;
  /** True while the item is selected but answering has not opened (or during wagers): prompt and figure are withheld. */
  hidden: boolean; prompt: string | null; figure: string | null;
  fields: string[]; manual: boolean; wager: boolean; timeLimit: number;
  answerText: string | null; explanation: string | null; answerFigure: string | null;
};

export type StateView = { phase: 'idle' | 'wager' | 'ready' | 'open' | 'closed' | 'revealed'; item: PublicItem | null; closesAt: string | null; opensAt: string | null; wagerEndsAt: string | null; nextAt: string | null; serverNow: string; version: string; board: BoardMode };

export type BoardMode = 'auto' | 'question' | 'overall' | 'rounds' | 'hidden';

export type TeamScore = { id: string; name: string; color: string; total: number; rank: number; byRound: Record<string, number>; members: string[] };

export type MeView = {
  me: { name: string };
  session: { id: string; code: string; title: string; className: string; status: string; practice: boolean };
  team: TeamScore;
  teamsCount: number;
  leader: { name: string; total: number } | null;
  ranksHidden: boolean;
  state: StateView;
  mine: { answers: string[] | null; wager: number | null; by: string | null; correct: boolean | null; rank: number | null; points: number | null };
  powerups: { type: string; status: string; item_id: string | null; hint: LifelineHint | null; item: string | null }[];
  feed: { points: number; reason: string; created_at: string }[];
};

export type BoardView = {
  session: { id: string; code: string; title: string; className: string; status: string; practice: boolean };
  state: StateView;
  plays: PowerupPlay[];
  cards: { team_id: string; type: string; status: string; item_id: string | null }[];
  teams: TeamScore[];
  itemPoints: { team_id: string; points: number }[];
  answered: string[];
  firstCorrect: string | null;
  recent: { team: string; color: string; points: number; reason: string; created_at: string }[];
};

export type LifelineHint = { by: string; draft: string[]; hints: { label: string | null; text: string }[] };

export type PowerupPlay = { id: string; team: string; color: string; type: string; status: string; at: string; item: string | null };
