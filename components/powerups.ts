export type PowerupInfo = { name: string; icon: string; text: string; when: string; color: string };

/** Display order and copy for every power-up card. */
export const POWERUP_INFO: Record<string, PowerupInfo> = {
  lifeline: { name: 'Lifeline', icon: '🛟', color: '#22d3ee', text: 'Instant hint on your current draft',
    when: 'Type your best guess first, then tap. The system checks it and tells you what to fix.' },
  retry: { name: 'Second Chance', icon: '🔁', color: '#34d399', text: 'Erase your submitted answer and try again',
    when: 'Use after submitting, while answering is still open. Your new answer gets a new time.' },
  fast: { name: 'Fast Pass', icon: '⚡', color: '#facc15', text: 'Correct = first-place points, even if you were slower',
    when: 'Applies to the next R1/R2 item revealed.' },
  double: { name: 'Double Down', icon: '2×', color: '#a78bfa', text: 'Doubles your next R1/R2 result, win or lose',
    when: 'Needs teacher OK. Applies to the next R1/R2 item revealed.' },
  shield: { name: 'Shield', icon: '🛡️', color: '#60a5fa', text: 'Cancels any points you would lose on the next item',
    when: 'Applies to the next R1/R2/R3 item revealed, including lost wagers.' },
  highroller: { name: 'High Roller', icon: '🎰', color: '#f472b6', text: 'Bet up to 10 on the next Map Heist wager',
    when: 'Applies to the next R3 wager. Win big, or lose big.' },
  steal: { name: 'Steal', icon: '🦝', color: '#fb923c', text: 'Try an item another team got wrong',
    when: 'Needs teacher OK. The teacher runs the steal in class.' },
};

export const POWERUP_ORDER = Object.keys(POWERUP_INFO);
