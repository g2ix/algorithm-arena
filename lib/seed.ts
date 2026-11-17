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

  { round_id: 'R1', label: '#11', prompt: 'Tree T3: give the INORDER traversal.', figure_url: '/figures/t3.svg',
    answer_key: seq('B G D A E C F H'), answer_text: 'B G D A E C F H',
    explanation: 'B has no left child, so B comes first; then its right subtree D, where G (left of D) comes before D.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#12', prompt: 'Tree T3: give the POSTORDER traversal.', figure_url: '/figures/t3.svg',
    answer_key: seq('G D B E H F C A'), answer_text: 'G D B E H F C A',
    explanation: 'Children before parent: finish the left subtree (G D B), then the right (E H F C), then A.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#13', prompt: 'Tree T3: how many LEAVES does it have, and what is its HEIGHT (count edges on the longest root-to-leaf path)?', figure_url: '/figures/t3.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Number of leaves', type: 'number', value: 3 },
      { label: 'Height (edges)', type: 'number', value: 3 },
    ] },
    answer_text: '3 leaves (G, E, H); height 3',
    explanation: 'Leaves have no children: G, E and H. Longest paths A-B-D-G and A-C-F-H have 3 edges.', points: R1, time_limit_s: 60 },
  { round_id: 'R1', label: '#14', prompt: 'A binary tree has postorder 4 2 6 5 7 3 1 and inorder 4 2 1 6 5 3 7. Give its PREORDER.',
    answer_key: seq('1 2 4 3 5 6 7'), answer_text: '1 2 4 3 5 6 7',
    explanation: "Postorder's LAST item (1) is the root. Inorder splits into left {4 2} and right {6 5 3 7}; repeat on each side.", points: R1, time_limit_s: 60 },
  { round_id: 'R1', label: '#15', prompt: 'Insert 50, 70, 30, 60, 20, 80, 40, 65, 35 into an empty BST. Give its LEVEL-ORDER traversal.',
    answer_key: seq('50 30 70 20 40 60 80 35 65'), answer_text: '50 30 70 20 40 60 80 35 65',
    explanation: '50 is the root with 30 and 70 under it; 20, 40, 60, 80 on level 2; 35 (left of 40) and 65 (right of 60) on level 3.', points: R1, time_limit_s: 60 },
  { round_id: 'R1', label: '#16', prompt: 'Insert 40, 20, 60, 10, 30, 50, 70, 25, 35 into an empty BST. Which nodes are visited, in order, when SEARCHING for 35?',
    answer_key: seq('40 20 30 35', 'Nodes visited'), answer_text: '40 20 30 35',
    explanation: '35 < 40 go left to 20; 35 > 20 go right to 30; 35 > 30 go right and find 35.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#17', prompt: 'Tree T2 (a BST): DELETE the root 50 using the inorder successor. Give the PREORDER of the result.', figure_url: '/figures/bst1.png',
    answer_key: seq('60 30 20 40 35 45 70 65 80'), answer_text: '60 30 20 40 35 45 70 65 80',
    explanation: "The successor is the smallest node in 50's right subtree: go to 70, then left to 60. 60 replaces 50 and its child 65 moves up under 70.", points: R1, time_limit_s: 60 },
  { round_id: 'R1', label: '#18', prompt: 'Huffman coding. Letter counts: A 5, B 9, C 12, D 13, E 16, F 45. How many bits does the whole message take, and how many bits is the code for A?',
    answer_key: { type: 'multi', parts: [
      { label: 'Total bits', type: 'number', value: 224 },
      { label: 'Bits in the code for A', type: 'number', value: 4 },
    ] },
    answer_text: '224 bits in total; A gets a 4-bit code',
    explanation: 'Merge the two smallest each time: 5+9=14, 12+13=25, 14+16=30, 25+30=55, 45+55=100. Code lengths: F 1, C/D/E 3, A/B 4.', points: R1, time_limit_s: 90 },
  { round_id: 'R1', label: '#19', prompt: 'Directed graph G2: what is the OUT-DEGREE of C and the IN-DEGREE of D?', figure_url: '/figures/g2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Out-degree of C', type: 'number', value: 2 },
      { label: 'In-degree of D', type: 'number', value: 2 },
    ] },
    answer_text: 'Out-degree of C = 2 (to B, E); in-degree of D = 2 (from B, E)',
    explanation: 'Out-degree counts arrows leaving a vertex; in-degree counts arrows arriving.', points: R1, time_limit_s: 45 },
  { round_id: 'R1', label: '#20', prompt: 'Directed graph G2: write row C of its ADJACENCY MATRIX (columns A B C D E F, 1 = edge from C).', figure_url: '/figures/g2.svg',
    answer_key: { type: 'array', value: '0 1 0 0 1 0', label: 'Row C' }, answer_text: '0 1 0 0 1 0',
    explanation: 'C has arrows only to B and E, so those two columns are 1.', points: R1, time_limit_s: 45 },

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

  { round_id: 'R2', label: 'H6', prompt: 'Build the BST from inserting 60, 40, 80, 20, 50, 70, 90, 45, 55. Type its POSTORDER.',
    answer_key: seq('20 45 55 50 40 70 90 80 60', 'Postorder of your tree'), answer_text: '20 45 55 50 40 70 90 80 60',
    explanation: '45 and 55 hang under 50 (left and right). Postorder visits children before parents, so 60 is last.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H7', prompt: 'Take your H6 tree and DELETE 40 (use the inorder successor). Type the PREORDER of the result.',
    answer_key: seq('60 45 20 50 55 80 70 90', 'Preorder after deleting 40'), answer_text: '60 45 20 50 55 80 70 90',
    explanation: '40 has two children. Its successor is 45 (go right to 50, then left as far as possible). 45 is a leaf, so it simply moves up.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H8', prompt: 'Insert 30, 10, 50, 5, 20, 40, 60, 15 into a BST, then DELETE 10 (inorder successor). Type the PREORDER.',
    answer_key: seq('30 15 5 20 50 40 60', 'Preorder after deleting 10'), answer_text: '30 15 5 20 50 40 60',
    explanation: "10's successor is 15: go right to 20, then left to 15. 15 takes 10's place.", points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H9', prompt: 'Insert 50, 30, 70, 20, 40, 60, 80, 65 into a BST. DELETE 20, then DELETE 60. Type the PREORDER.',
    answer_key: seq('50 30 40 70 65 80', 'Preorder after both deletes'), answer_text: '50 30 40 70 65 80',
    explanation: '20 is a leaf, so it just leaves. 60 has one child (65), so 65 moves up into its place.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H10', prompt: 'Insert 50, 30, 70, 20, 40, 60, 80, 55, 65 into a BST, then DELETE the root 50 (inorder successor). Type the PREORDER.',
    answer_key: seq('55 30 20 40 70 60 65 80', 'Preorder after deleting 50'), answer_text: '55 30 20 40 70 60 65 80',
    explanation: 'Successor of 50: right to 70, left to 60, left to 55. 55 becomes the new root.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H11', prompt: 'Build the binary tree whose PREORDER is A B D G E C F H and INORDER is D G B E A C H F. Type its POSTORDER.',
    answer_key: seq('G D E B H F C A', 'Postorder of your tree'), answer_text: 'G D E B H F C A',
    explanation: 'A is the root (first in preorder). Inorder puts D G B E on the left and C H F on the right. G is the right child of D; H is the left child of F.', points: R2, time_limit_s: 150 },
  { round_id: 'R2', label: 'H12', prompt: 'Build the HUFFMAN TREE for letter counts A 2, B 3, C 7, D 10, E 15. Type the code LENGTH of A, B, C, D, E (in that order) and the total bits.',
    answer_key: { type: 'multi', parts: [
      { label: 'Code lengths for A B C D E', type: 'array', value: '4 4 3 2 1' },
      { label: 'Total bits', type: 'number', value: 76 },
    ] },
    answer_text: 'Lengths 4 4 3 2 1; total 76 bits',
    explanation: 'Merges: 2+3=5, 5+7=12, 10+12=22, 15+22=37. Total = 2x4 + 3x4 + 7x3 + 10x2 + 15x1 = 76.', points: R2, time_limit_s: 150 },
  { round_id: 'R2', label: 'H13', prompt: 'Insert 70, 50, 90, 40, 60, 80, 95, 55, 65 into a BST. DELETE 50, then DELETE 70 (inorder successor both times). Type the PREORDER.',
    answer_key: seq('80 55 40 60 65 90 95', 'Preorder after both deletes'), answer_text: '80 55 40 60 65 90 95',
    explanation: '50 is replaced by 55 (right to 60, left to 55). Then the root 70 is replaced by 80 (right to 90, left to 80).', points: R2, time_limit_s: 150 },
  { round_id: 'R2', label: 'H14', prompt: 'Form this GENERAL tree: R has children A, B, C (left to right); A has children D, E; C has children F, G, H. Type its PREORDER and POSTORDER.',
    answer_key: { type: 'multi', parts: [
      { label: 'Preorder', type: 'sequence', value: 'R A D E B C F G H' },
      { label: 'Postorder', type: 'sequence', value: 'D E A B F G H C R' },
    ] },
    answer_text: 'Preorder R A D E B C F G H; postorder D E A B F G H C R',
    explanation: 'A general tree is traversed like a binary tree, but visiting ALL children left to right instead of just two.', points: R2, time_limit_s: 120 },
  { round_id: 'R2', label: 'H15', prompt: 'Build the BST from inserting 8, 3, 10, 1, 6, 14, 4, 7, 13. Type its POSTORDER and its HEIGHT (edges).',
    answer_key: { type: 'multi', parts: [
      { label: 'Postorder', type: 'sequence', value: '1 4 7 6 3 13 14 10 8' },
      { label: 'Height (edges)', type: 'number', value: 3 },
    ] },
    answer_text: 'Postorder 1 4 7 6 3 13 14 10 8; height 3',
    explanation: 'The longest paths are 8-3-6-4, 8-3-6-7 and 8-10-14-13, each with 3 edges.', points: R2, time_limit_s: 120 },

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

  { round_id: 'R3', label: 'M6', prompt: "Map 2: use KRUSKAL'S algorithm to connect all 7 places with the least total road time. What is the total, and which roads?", figure_url: '/figures/map2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Total minutes', type: 'number', value: 19 },
      { label: 'Roads used, e.g. A-B, ...', type: 'edge_set', value: ['B-D', 'E-G', 'A-B', 'C-F', 'C-E', 'D-E'] },
    ] },
    answer_text: 'Total 19: B-D, E-G, A-B, C-F, C-E, D-E',
    explanation: 'Sorted: 2, 2, 3, 3, 4 (A-D makes a cycle, skip), 4, 5. Six roads connect seven places.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M7', prompt: "Map 2: run PRIM'S algorithm starting at A. In what order are the places added to the tree?", figure_url: '/figures/map2.svg',
    answer_key: seq('A B D E G C F', 'Order added'), answer_text: 'A B D E G C F',
    explanation: 'Always take the cheapest road leaving the tree: A-B 3, B-D 2, D-E 5, E-G 2, E-C 4, C-F 3.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M8', prompt: "Map 2: using DIJKSTRA'S algorithm from A, what is the shortest time to F, and which route?", figure_url: '/figures/map2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Shortest time to F', type: 'number', value: 16 },
      { label: 'Route, e.g. A ... F', type: 'sequence', value: 'A D E C F' },
    ] },
    answer_text: '16 minutes: A → D → E → C → F',
    explanation: 'Finalized: A0, B3, D4, E9, G11, C13, F16. Trap: going through G costs 11 + 6 = 17.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M9', prompt: "Map 2: run PRIM'S algorithm starting at F. In what order are the places added?", figure_url: '/figures/map2.svg',
    answer_key: seq('F C E G D B A', 'Order added'), answer_text: 'F C E G D B A',
    explanation: 'F-C 3, C-E 4, E-G 2, D-E 5, B-D 2, A-B 3. Same total (19) as Kruskal, as it must be.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M10', prompt: 'Map 2: ignore the minutes. Give the BFS order from A (alphabetical ties).', figure_url: '/figures/map2.svg',
    answer_key: seq('A B D E G C F', 'BFS order'), answer_text: 'A B D E G C F',
    explanation: 'Queue: A → B, D → E, G (from B) → C (from E) → F (from G).', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M11', prompt: 'Map 2: ignore the minutes. Give the DFS order from A (alphabetical ties).', figure_url: '/figures/map2.svg',
    answer_key: seq('A B D E C F G', 'DFS order'), answer_text: 'A B D E C F G',
    explanation: 'Go deep, always taking the alphabetically first unvisited neighbor: A→B→D→E→C→F→G.', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M12', prompt: 'Map 2 as an undirected graph: how many EDGES does it have, and what is the ADJACENCY LIST of E (alphabetical)?', figure_url: '/figures/map2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Number of edges', type: 'number', value: 11 },
      { label: 'Neighbors of E', type: 'sequence', value: 'B C D G' },
    ] },
    answer_text: '11 edges; E: B, C, D, G',
    explanation: 'Each road is one undirected edge. In an adjacency list, E stores every place it shares a road with.', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M13', prompt: 'Adjacency matrix M (row = from, column = to): is the graph DIRECTED, and how many EDGES does it have?', figure_url: '/figures/mat1.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Directed? (yes/no)', type: 'yesno', value: true },
      { label: 'Number of edges', type: 'number', value: 8 },
    ] },
    answer_text: 'Yes, directed; 8 edges',
    explanation: 'The matrix is not symmetric (M[0][1] = 1 but M[1][0] = 0), so it is directed. Count the 1s: 8.', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M14', prompt: 'Adjacency matrix M: give the BFS order from 2 and the DFS order from 0 (smaller numbers first).', figure_url: '/figures/mat1.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'BFS from 2', type: 'sequence', value: '2 1 4 3 5' },
      { label: 'DFS from 0', type: 'sequence', value: '0 1 3 5 2 4' },
    ] },
    answer_text: 'BFS from 2: 2 1 4 3 5; DFS from 0: 0 1 3 5 2 4',
    explanation: 'Read neighbors from each row. Vertex 0 has no incoming edges, so BFS from 2 never reaches it.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M15', prompt: 'Graph G5: run FLOYD-WARSHALL. Give the final shortest-distance ROW for vertex 1 and for vertex 4 (columns 1 2 3 4).', figure_url: '/figures/g5.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Row 1', type: 'array', value: '0 3 5 6' },
      { label: 'Row 4', type: 'array', value: '2 5 7 0' },
    ] },
    answer_text: 'Row 1: 0 3 5 6; Row 4: 2 5 7 0',
    explanation: '1→3 = 1→2→3 = 5; 1→4 = 1→2→3→4 = 6 (beats the direct 7). 4→2 = 4→1→2 = 5; 4→3 = 4→1→2→3 = 7.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M16', prompt: 'Graph G5, Floyd-Warshall: after the FIRST pass (only vertex 1 allowed in the middle), what are D[2][4] and D[4][2]?', figure_url: '/figures/g5.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'D[2][4]', type: 'number', value: 15 },
      { label: 'D[4][2]', type: 'number', value: 5 },
    ] },
    answer_text: 'D[2][4] = 15 (2→1→4); D[4][2] = 5 (4→1→2)',
    explanation: 'Both started at infinity. Through 1: 8 + 7 = 15 and 2 + 3 = 5. Later passes improve D[2][4] to 3.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M17', prompt: "Graph G6: run WARSHALL'S algorithm (transitive closure). Write row B of the reachability matrix (columns A B C D E; 1 = there is a path).", figure_url: '/figures/g6.svg',
    answer_key: { type: 'array', value: '1 1 1 1 0', label: 'Row B' }, answer_text: '1 1 1 1 0',
    explanation: 'B→C→A→B is a loop, so B reaches A, itself and C, and D through C. Nothing leads to E.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M18', prompt: 'Graph G6, Warshall: how many 1s are in the final reachability matrix? Can E reach A?', figure_url: '/figures/g6.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Number of 1s', type: 'number', value: 13 },
      { label: 'Can E reach A? (yes/no)', type: 'yesno', value: false },
    ] },
    answer_text: '13 ones; no, E cannot reach A',
    explanation: 'Rows A, B, C are each 1 1 1 1 0 (12 ones), row D is all 0, row E has only D (1 one). E only points to D, and D points nowhere.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M19', prompt: 'Map 2: the E-G road is CLOSED for repairs. What is the shortest time from A to G now, and which route?', figure_url: '/figures/map2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'Shortest time to G', type: 'number', value: 12 },
      { label: 'Route, e.g. A ... G', type: 'sequence', value: 'A B G' },
    ] },
    answer_text: '12 minutes: A → B → G',
    explanation: 'Without E-G, the old route A-D-E-G is gone. A-B-G = 3 + 9 = 12 beats A-D-E-C-G = 4 + 5 + 4 + 6 = 19.', points: R3, time_limit_s: 180 },
  { round_id: 'R3', label: 'M20', prompt: "Map 2, Kruskal's algorithm: which road is the FIRST one skipped because it would make a cycle?", figure_url: '/figures/map2.svg',
    answer_key: { type: 'edge_set', value: ['A-D'], label: 'Skipped road, e.g. X-Y' }, answer_text: 'A-D',
    explanation: 'After B-D, E-G, A-B and C-F, the road A-D (4) would connect A and D, which are already joined through B.', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M21', prompt: 'Directed graph G2: give the BFS order and the DFS order from A (follow arrows, alphabetical ties).', figure_url: '/figures/g2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'BFS from A', type: 'sequence', value: 'A B C D E F' },
      { label: 'DFS from A', type: 'sequence', value: 'A B D F C E' },
    ] },
    answer_text: 'BFS: A B C D E F; DFS: A B D F C E',
    explanation: 'DFS goes A→B→D→F, backs up to A, then C→E (B and D are already visited).', points: R3, time_limit_s: 150 },
  { round_id: 'R3', label: 'M22', prompt: 'Directed graph G2: give the DFS order starting at C. Which vertex is NEVER reached?', figure_url: '/figures/g2.svg',
    answer_key: { type: 'multi', parts: [
      { label: 'DFS from C', type: 'sequence', value: 'C B D F E' },
      { label: 'Never reached', type: 'sequence', value: 'A' },
    ] },
    answer_text: 'C B D F E; A is never reached',
    explanation: 'No arrow points into A, so a traversal that starts anywhere else can never visit it.', points: R3, time_limit_s: 150 },

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

/** Old items that are outside the course topics. They are hidden from games but kept so past results stay intact. */
export const RETIRED: [RoundId, string][] = [
  ['R3', 'M4'], // topological sort
  ['R3', 'M5'], // cycle detection
];

export const TEAM_COLORS = [
  '#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#6366f1', '#eab308',
];
