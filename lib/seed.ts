import type { AnswerKey, Points, RoundId } from './types';

// Question bank seeded from the "Algorithm Arena: Trees & Graphs Tournament"
// activity doc. Every answer here was verified by script before seeding.

export const ROUNDS: { id: RoundId; title: string; scoring_mode: 'auto' | 'manual'; sort: number }[] = [
  { id: 'R1', title: 'Trace Race', scoring_mode: 'auto', sort: 1 },
  { id: 'R2', title: 'Human Tree', scoring_mode: 'auto', sort: 2 },
  { id: 'R3', title: 'Map Heist', scoring_mode: 'auto', sort: 3 },
  { id: 'R4', title: 'Code Sprint', scoring_mode: 'manual', sort: 4 },
  { id: 'R5', title: 'Bug Hunt', scoring_mode: 'manual', sort: 5 },
];

export interface SeedItem {
  round_id: RoundId;
  label: string;
  prompt: string;
  figure_url?: string;
  answer_figure_url?: string;
  answer_key: AnswerKey;
  answer_text: string;
  explanation?: string;
  points: Points;
  time_limit_s: number;
}

const R1: Points = { first: 3, correct: 1, wrong: -1 };
const R2: Points = { first: 4, correct: 2, wrong: 0 };
const R3: Points = { wager: true };

const seq = (value: string, label = 'Answer'): AnswerKey => ({ type: 'sequence', value, label });

export const ITEMS: SeedItem[] = [
  // ---------------- R1 Trace Race ----------------
  { round_id: 'R1', label: '#1', prompt: 'Tree T1: give the PREORDER traversal.', figure_url: '/figures/t1.png',
    answer_key: seq('A B D E G C F'), answer_text: 'A B D E G C F',
    explanation: 'Root, then the whole left subtree, then the right.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#2', prompt: 'Tree T1: give the INORDER traversal.', figure_url: '/figures/t1.png',
    answer_key: seq('D B G E A C F'), answer_text: 'D B G E A C F',
    explanation: "Left subtree, root, right subtree. G comes before E because G is E's left child.", points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#3', prompt: 'Tree T1: give the POSTORDER traversal.', figure_url: '/figures/t1.png',
    answer_key: seq('D G E B F C A'), answer_text: 'D G E B F C A',
    explanation: 'Children before parent, so the root A is always last.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#4', prompt: 'Tree T1: give the LEVEL-ORDER traversal.', figure_url: '/figures/t1.png',
    answer_key: seq('A B C D E F G'), answer_text: 'A B C D E F G',
    explanation: 'Level by level, left to right, using a queue.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#5', prompt: 'Tree T2 (a BST): give the INORDER traversal.', figure_url: '/figures/bst1.png',
    answer_key: seq('20 30 35 40 45 50 60 65 70 80'), answer_text: '20 30 35 40 45 50 60 65 70 80',
    explanation: 'Inorder of any BST is sorted, with no tracing needed.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#6', prompt: 'Tree T2 (a BST): give the POSTORDER traversal.', figure_url: '/figures/bst1.png',
    answer_key: seq('20 35 45 40 30 65 60 80 70 50'), answer_text: '20 35 45 40 30 65 60 80 70 50',
    explanation: 'Left subtree (20 35 45 40 30), right subtree (65 60 80 70), then 50.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#7', prompt: 'Graph G1: BFS from A (visit neighbors in alphabetical order).', figure_url: '/figures/g1.png',
    answer_key: seq('A B C D E F'), answer_text: 'A B C D E F',
    explanation: 'Queue: A → B, C → D (from B) → E (from C) → F (from D).', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#8', prompt: 'Graph G1: DFS from A (visit neighbors in alphabetical order).', figure_url: '/figures/g1.png',
    answer_key: seq('A B D C E F'), answer_text: 'A B D C E F',
    explanation: "Go deep: A→B→D, then D's first unvisited neighbor is C, then C→E→F.", points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#9', prompt: 'A binary tree has preorder 1 2 4 5 3 6 7 and inorder 4 2 5 1 6 3 7. Give its POSTORDER.',
    answer_key: seq('4 5 2 6 7 3 1'), answer_text: '4 5 2 6 7 3 1',
    explanation: "Preorder's first item (1) is the root. Inorder splits into left {4 2 5} and right {6 3 7}; repeat on each side.", points: R1, time_limit_s: 60 },
  { round_id: 'R1', label: '#10', prompt: 'Insert 15, 10, 20, 8, 25, 12 into an empty MIN-HEAP. Give the final array.',
    answer_figure_url: '/figures/q10.png',
    answer_key: { type: 'array', value: '8 10 12 15 25 20', label: 'Array' }, answer_text: '8 10 12 15 25 20',
    explanation: '8 bubbles up past 15 and 10 to the root; 12 swaps with 20.', points: R1, time_limit_s: 60 },

  // ---------------- R2 Human Tree ----------------
  { round_id: 'R2', label: 'H1', prompt: 'Build the BST from inserting 50, 30, 70, 20, 40, 60, 80. Type its PREORDER.',
    answer_figure_url: '/figures/h1.png',
    answer_key: seq('50 30 20 40 70 60 80', 'Preorder of your tree'), answer_text: '50 30 20 40 70 60 80',
    explanation: 'A perfect tree: 50 at the root, 30 and 70 below it, then 20, 40, 60, 80.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H2', prompt: 'Insert 40, 20, 60, 10, 30, 50, 70, 25 into a BST, then DELETE 20 (use the inorder successor). Type the PREORDER of the result.',
    answer_figure_url: '/figures/h2b.png',
    answer_key: seq('40 25 10 30 60 50 70', 'Preorder after deleting 20'), answer_text: '40 25 10 30 60 50 70',
    explanation: "20 has two children, so it is replaced by its inorder successor 25 (go right to 30, then left as far as possible).", points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H3', prompt: 'Insert 30, 20, 10, 40, 5, 25 into an empty MIN-HEAP one at a time. Type the final ARRAY.',
    answer_figure_url: '/figures/h3.png',
    answer_key: { type: 'array', value: '5 10 20 40 30 25', label: 'Heap array' }, answer_text: '5 10 20 40 30 25',
    explanation: '5 bubbles up past 30 and then 10 to become the root; 25 stays under 20.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H4', prompt: 'Take your H3 heap and perform DELETE-MIN once. Type the final ARRAY.',
    answer_figure_url: '/figures/h4.png',
    answer_key: { type: 'array', value: '10 25 20 40 30', label: 'Heap array' }, answer_text: '10 25 20 40 30',
    explanation: 'Move the last item (25) to the root, swap with the smaller child 10, then stop since 40 and 30 are larger.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H5', prompt: 'Insert 10, 20, 30, 40, 50 into an empty BST. Type its PREORDER and its HEIGHT. (Be ready to say why it is a bad BST.)',
    answer_figure_url: '/figures/h5.png',
    answer_key: { type: 'multi', parts: [
      { label: 'Preorder', type: 'sequence', value: '10 20 30 40 50' },
      { label: 'Height', type: 'number', value: [5, 4] },
    ] },
    answer_text: 'Preorder 10 20 30 40 50; height 5 nodes (or 4 edges)',
    explanation: 'Every node goes right, so it is a straight line and search becomes O(n) instead of O(log n).', points: R2, time_limit_s: 120 },

  // ---------------- R3 Map Heist ----------------
  { round_id: 'R3', label: 'M1', prompt: "You're in Talamban (T) and need to reach Colon (C) fastest. What is the shortest time, and which route?", figure_url: '/figures/map.png',
    answer_key: { type: 'multi', parts: [
      { label: 'Shortest time (minutes)', type: 'number', value: 28 },
      { label: 'Route, e.g. T B ... C', type: 'sequence', value: 'T B I F C' },
    ] },
    answer_text: '28 minutes: T → B → I → F → C',
    explanation: 'Dijkstra finalizes T0, B6, I13, M15, A18, S22, F23, C28. Traps: T-B-I-C = 29, T-M-S-C = 31.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M2', prompt: 'Connect all 8 places with fiber along the roads using the least total cable. Which roads, and what is the total?', figure_url: '/figures/map.png',
    answer_key: { type: 'multi', parts: [
      { label: 'Total minutes of cable', type: 'number', value: 44 },
      { label: 'Roads used, e.g. F-C, I-A, ...', type: 'edge_set', value: ['F-C', 'I-A', 'A-F', 'T-B', 'B-I', 'M-S', 'A-S'] },
    ] },
    answer_text: 'Total 44: F-C, I-A, A-F, T-B, B-I, M-S, A-S',
    explanation: 'Kruskal takes 5, 5, 6, 6, 7, 7, 8 and stops at 7 roads for 8 places. Prim from T picks the same set.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M3', prompt: 'Ignore the minutes. Give the BFS order from T (alphabetical ties), and the fewest roads from T to C.', figure_url: '/figures/map.png',
    answer_key: { type: 'multi', parts: [
      { label: 'BFS order from T', type: 'sequence', value: 'T B M A I S F C' },
      { label: 'Fewest roads from T to C', type: 'number', value: 3 },
    ] },
    answer_text: 'T B M A I S F C; 3 roads',
    explanation: 'T adds B, M. B adds A, I. M adds S. A adds F. I adds C, first reached at level 3.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M4', prompt: "Give the order to take these courses using Kahn's algorithm with alphabetical ties.", figure_url: '/figures/prereq.png',
    answer_key: seq('DM P1 P2 DB DS AL SE', 'Course order'), answer_text: 'DM, P1, P2, DB, DS, AL, SE',
    explanation: 'Start with DM and P1 (no prerequisites), DM first. P1 frees P2; P2 frees DB and DS; DB before DS; then AL, then SE.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M5', prompt: 'Does directed graph H have a cycle? If yes, name it.', figure_url: '/figures/cyc.png',
    answer_key: { type: 'multi', parts: [
      { label: 'Cycle? (yes/no)', type: 'yesno', value: true },
      { label: 'The cycle, e.g. X Y Z', type: 'cycle', value: 'B C D' },
    ] },
    answer_text: 'Yes: B → C → D → B',
    explanation: 'DFS from A reaches D, and D has an edge back to B, which is still on the current path.', points: R3, time_limit_s: 180 },

  // ---------------- R4 Code Sprint (encoded by the teacher) ----------------
  ...([
    ['B1', 'Leaf Counter', 'Bronze', 5],
    ['B2', 'Search Trail', 'Bronze', 5],
    ['S1', 'How Tall Is It?', 'Silver', 10],
    ['S2', 'Level by Level', 'Silver', 10],
    ['G1', 'Fewest Jeepney Rides', 'Gold', 15],
    ['G2', 'Island Count', 'Gold', 15],
    ['P1', 'Fastest Route', 'Platinum', 20],
    ['P2', 'Prerequisite Loop', 'Platinum', 20],
  ] as const).map(([label, title, tier, pts]): SeedItem => ({
    round_id: 'R4', label, prompt: `${title} (${tier})`, answer_key: { type: 'manual' }, answer_text: 'Solved on CodeChum',
    points: { solve: pts, first: 3 }, time_limit_s: 2700,
  })),

  // ---------------- R5 Bug Hunt (encoded by the teacher) ----------------
  { round_id: 'R5', label: 'Bug 1', prompt: 'The vanishing nodes: a BST insert that only ever keeps the root.',
    answer_key: { type: 'manual' }, answer_text: 'Assign the recursive result: root->left = insert(root->left, x); (same for right)', points: { win: 5 }, time_limit_s: 120 },
  { round_id: 'R5', label: 'Bug 2', prompt: 'The wrong order: "inorder" prints 50 30 20 40 70.',
    answer_key: { type: 'manual' }, answer_text: 'Move the printf between the two recursive calls', points: { win: 5 }, time_limit_s: 120 },
  { round_id: 'R5', label: 'Bug 3', prompt: 'The endless walk: DFS prints 0 1 0 1 0 1 ... and crashes.',
    answer_key: { type: 'manual' }, answer_text: 'Set visited[u] = 1 at the start of dfs', points: { win: 5 }, time_limit_s: 120 },
  { round_id: 'R5', label: 'Bug 4', prompt: 'Tie-breaker. The broken heap: deleteMin leaves 3 5 2 6 7.',
    answer_key: { type: 'manual' }, answer_text: 'Swap with the smaller child: if (child+1 < size && heap[child+1] < heap[child]) child++;', points: { win: 5 }, time_limit_s: 120 },
];

export const TEAM_COLORS = [
  '#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#eab308',
];
