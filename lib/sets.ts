// Ready-made question sets. Loading one replaces a game's question list.
// Tournament sets: 6 R1 + 4 R2 + 5 R3, plus every R4 (CodeChum) and R5 (Bug Hunt) item.
// Practice sets: 2 R1 + 1 R2 + 1 R3 warm-ups. Their questions are never used
// in a tournament set, so teams can't see a final-round question early.

export type QuestionSet = {
  id: string;
  name: string;
  kind: 'tournament' | 'practice';
  blurb: string;
  R1: string[];
  R2: string[];
  R3: string[];
};

export const QUESTION_SETS: QuestionSet[] = [
  // ---------------- practice
  { id: 'practice-1', name: 'Practice A: Warm-up', kind: 'practice', blurb: 'Level order, degrees, a lopsided BST and BFS on a map.',
    R1: ['#4', '#19'], R2: ['H5'], R3: ['M3'] },
  { id: 'practice-2', name: 'Practice B: Warm-up', kind: 'practice', blurb: 'BST inorder, an adjacency-matrix row, BST height and adjacency lists.',
    R1: ['#5', '#20'], R2: ['H15'], R3: ['M12'] },

  // ---------------- tournament
  { id: 'set-01', name: 'Set 1: Classic Mix', kind: 'tournament', blurb: 'A bit of everything: traversals, BST, Huffman, heap, Dijkstra, MST, Floyd-Warshall.',
    R1: ['#1', '#2', '#7', '#8', '#16', '#18'], R2: ['H1', 'H2', 'H3', 'H11'], R3: ['M1', 'M2', 'M10', 'M13', 'M15'] },
  { id: 'set-02', name: 'Set 2: Traversal Titans', kind: 'tournament', blurb: 'Preorder, inorder, postorder, rebuilding trees, BFS and DFS everywhere.',
    R1: ['#1', '#3', '#9', '#11', '#12', '#14'], R2: ['H1', 'H6', 'H11', 'H14'], R3: ['M10', 'M11', 'M14', 'M21', 'M22'] },
  { id: 'set-03', name: 'Set 3: BST Builders', kind: 'tournament', blurb: 'Insert, search and delete in BSTs, with Kruskal, Dijkstra and Warshall.',
    R1: ['#2', '#6', '#7', '#15', '#16', '#17'], R2: ['H1', 'H2', 'H6', 'H10'], R3: ['M6', 'M8', 'M13', 'M17', 'M19'] },
  { id: 'set-04', name: 'Set 4: Shortest Path Sprint', kind: 'tournament', blurb: 'Dijkstra and Floyd-Warshall in R3, with traversal and BST warm-ups.',
    R1: ['#1', '#8', '#12', '#13', '#16', '#18'], R2: ['H3', 'H6', 'H8', 'H12'], R3: ['M1', 'M8', 'M15', 'M16', 'M19'] },
  { id: 'set-05', name: 'Set 5: Spanning Tree Showdown', kind: 'tournament', blurb: "Prim's and Kruskal's from every angle, plus BST deletes.",
    R1: ['#2', '#3', '#7', '#10', '#14', '#17'], R2: ['H3', 'H9', 'H13', 'H14'], R3: ['M2', 'M6', 'M7', 'M9', 'M20'] },
  { id: 'set-06', name: 'Set 6: Graph Explorer', kind: 'tournament', blurb: 'Directed and undirected traversal, adjacency matrices and reachability.',
    R1: ['#6', '#7', '#8', '#9', '#11', '#15'], R2: ['H1', 'H6', 'H11', 'H12'], R3: ['M11', 'M13', 'M14', 'M18', 'M21'] },
  { id: 'set-07', name: 'Set 7: Huffman & Heaps', kind: 'tournament', blurb: 'Huffman coding and a little heap work, with Prim, Dijkstra and Floyd-Warshall.',
    R1: ['#1', '#8', '#10', '#13', '#16', '#18'], R2: ['H2', 'H3', 'H4', 'H12'], R3: ['M1', 'M7', 'M10', 'M15', 'M22'] },
  { id: 'set-08', name: 'Set 8: Delete Day', kind: 'tournament', blurb: 'Every kind of BST delete (leaf, one child, two children, root).',
    R1: ['#2', '#6', '#7', '#12', '#14', '#17'], R2: ['H2', 'H8', 'H9', 'H13'], R3: ['M6', 'M8', 'M17', 'M19', 'M21'] },
  { id: 'set-09', name: 'Set 9: Matrix Masters', kind: 'tournament', blurb: 'Adjacency matrices, Floyd-Warshall passes and Warshall closure.',
    R1: ['#3', '#8', '#9', '#11', '#15', '#18'], R2: ['H3', 'H6', 'H10', 'H14'], R3: ['M13', 'M14', 'M15', 'M16', 'M17'] },
  { id: 'set-10', name: 'Set 10: Grand Tour', kind: 'tournament', blurb: 'A balanced final: one of each major topic.',
    R1: ['#1', '#6', '#8', '#10', '#13', '#18'], R2: ['H1', 'H6', 'H7', 'H12'], R3: ['M1', 'M2', 'M11', 'M16', 'M18'] },
  { id: 'set-11', name: "Set 11: Champion's Challenge", kind: 'tournament', blurb: 'The hardest items: rebuilding trees, double deletes, Floyd-Warshall, road closures.',
    R1: ['#9', '#12', '#14', '#16', '#17', '#18'], R2: ['H10', 'H11', 'H12', 'H13'], R3: ['M9', 'M15', 'M16', 'M19', 'M20'] },
];

/** Item ids a set selects, given the question bank (id + round + label). */
export function setItemIds(set: QuestionSet, items: { id: string; round: string; label: string }[]): string[] {
  const want = new Set([...set.R1.map((l) => `R1|${l}`), ...set.R2.map((l) => `R2|${l}`), ...set.R3.map((l) => `R3|${l}`)]);
  return items
    .filter((i) => want.has(`${i.round}|${i.label}`) || (set.kind === 'tournament' && (i.round === 'R4' || i.round === 'R5')))
    .map((i) => i.id);
}
