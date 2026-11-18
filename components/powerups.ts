export type PowerupInfo = { name: string; icon: string; text: string; when: string; color: string };

/** Display order and copy for every power-up card. */
export const POWERUP_INFO: Record<string, PowerupInfo> = {
  lifeline: { name: 'Lifeline', icon: '🛟', color: '#22d3ee', text: 'Instant hint on your current draft',
    when: 'Type your best guess first, then tap. The system checks it and tells you what to fix.' },
  retry: { name: 'Second Chance', icon: '🔁', color: '#34d399', text: 'Erase your submitted answer and try again',
    when: 'Use after submitting, while answering is still open. Your new answer gets a new time.' },
  fast: { name: 'Fast Pass', icon: '⚡', color: '#facc15', text: 'Correct = first-place points, even if you were slower',
    when: 'Takes effect on the R1/R2 question on screen right away (or the next one if none is up).' },
  double: { name: 'Double Down', icon: '2×', color: '#a78bfa', text: 'Doubles your R1/R2 result on this question, win or lose',
    when: 'Needs teacher OK. Once approved it applies to the R1/R2 question on screen (or the next one).' },
  shield: { name: 'Shield', icon: '🛡️', color: '#60a5fa', text: 'Cancels any points you would lose on this question',
    when: 'Takes effect on the question on screen right away (or the next one), including lost wagers.' },
  highroller: { name: 'High Roller', icon: '🎰', color: '#f472b6', text: 'Bet up to 10 on this Map Heist wager',
    when: 'Play it before your team locks a Map Heist wager (or it waits for the next one). Win big, or lose big.' },
  steal: { name: 'Steal', icon: '🦝', color: '#fb923c', text: 'Try an item another team got wrong',
    when: 'Needs teacher OK. The teacher runs the steal in class.' },
};

export const POWERUP_ORDER = Object.keys(POWERUP_INFO);

type NowItem = { manual: boolean; wager: boolean } | null | undefined;

/**
 * Can this card be played on the question on screen right now (mirrors the server's rules)?
 * `team` narrows it to one team's situation; without it the answer is for "a team".
 */
export function playableNow(type: string, item: NowItem, phase: string, team?: { submitted: boolean; wagerLocked: boolean }) {
  if (!item || item.manual) return false;
  switch (type) {
    case 'lifeline': return phase === 'open' && !team?.submitted;
    case 'retry': return phase === 'open' && (team ? team.submitted : true);
    case 'fast':
    case 'double': return !item.wager && phase !== 'revealed';
    case 'shield': return phase !== 'revealed';
    case 'highroller': return item.wager && (phase === 'idle' || phase === 'wager') && !team?.wagerLocked;
    case 'steal': return phase === 'revealed';
    default: return false;
  }
}
