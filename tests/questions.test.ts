import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../lib/checkers';
import { ITEMS, RETIRED } from '../lib/seed';
import type { AnswerKey } from '../lib/types';

// Recomputes the question-bank answers with real algorithms, so a typo in an
// answer key fails the tests instead of a team in class.

type T = { v: string | number; l: T | null; r: T | null } | null;
const N = (v: string | number, l: T = null, r: T = null): T => ({ v, l, r });
const pre = (t: T): (string | number)[] => (t ? [t.v, ...pre(t.l), ...pre(t.r)] : []);
const post = (t: T): (string | number)[] => (t ? [...post(t.l), ...post(t.r), t.v] : []);
const level = (t: T) => { const q = [t], o: (string | number)[] = []; while (q.length) { const x = q.shift(); if (!x) continue; o.push(x.v); q.push(x.l, x.r); } return o; };
const height = (t: T): number => (t ? 1 + Math.max(height(t.l), height(t.r)) : -1);
const ins = (t: T, x: number): T => (!t ? N(x) : (x < (t.v as number) ? (t.l = ins(t.l, x)) : (t.r = ins(t.r, x)), t));
const bst = (xs: number[]) => xs.reduce<T>(ins, null);
const del = (t: T, x: number): T => {
  if (!t) return t;
  if (x < (t.v as number)) { t.l = del(t.l, x); return t; }
  if (x > (t.v as number)) { t.r = del(t.r, x); return t; }
  if (!t.l) return t.r; if (!t.r) return t.l;
  let s = t.r; while (s.l) s = s.l; t.v = s.v; t.r = del(t.r, s.v as number); return t;
};
const searchPath = (t: T, x: number) => { const o = []; while (t) { o.push(t.v); if (x === t.v) break; t = x < (t.v as number) ? t.l : t.r; } return o; };
const J = (a: unknown[]) => a.join(' ');

function huffman(freq: Record<string, number>) {
  const nodes = Object.entries(freq).map(([k, f]) => ({ f, syms: [k] }));
  const depth: Record<string, number> = Object.fromEntries(Object.keys(freq).map((k) => [k, 0]));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.f - b.f);
    expect(nodes.length > 2 && nodes[2].f === nodes[1].f).toBe(false); // no ties: code lengths are unique
    const [a, b] = nodes.splice(0, 2);
    for (const s of [...a.syms, ...b.syms]) depth[s]++;
    nodes.push({ f: a.f + b.f, syms: [...a.syms, ...b.syms] });
  }
  return { depth, total: Object.entries(freq).reduce((s, [k, f]) => s + f * depth[k], 0) };
}

type Adj = Record<string, [string, number][]>;
const graph = (es: [string, string, number?][], directed: boolean): Adj => {
  const g: Adj = {};
  for (const [a, b, w = 1] of es) { (g[a] ??= []).push([b, w]); if (directed) g[b] ??= []; else (g[b] ??= []).push([a, w]); }
  for (const k in g) g[k].sort((x, y) => x[0].localeCompare(y[0]));
  return g;
};
const bfs = (g: Adj, s: string) => { const seen = new Set([s]), q = [s], o: string[] = []; while (q.length) { const u = q.shift()!; o.push(u); for (const [v] of g[u]) if (!seen.has(v)) { seen.add(v); q.push(v); } } return o; };
const dfs = (g: Adj, s: string, seen = new Set<string>(), o: string[] = []): string[] => { seen.add(s); o.push(s); for (const [v] of g[s]) if (!seen.has(v)) dfs(g, v, seen, o); return o; };
function dijkstra(g: Adj, s: string, t: string) {
  const d: Record<string, number> = { [s]: 0 }, prev: Record<string, string> = {}, ways: Record<string, number> = { [s]: 1 }, done = new Set<string>();
  for (;;) {
    const u = Object.keys(d).filter((k) => !done.has(k)).sort((a, b) => d[a] - d[b])[0];
    if (!u) break; done.add(u);
    for (const [v, w] of g[u]) {
      if (done.has(v)) continue;
      if (d[v] === undefined || d[u] + w < d[v]) { d[v] = d[u] + w; prev[v] = u; ways[v] = ways[u]; } else if (d[u] + w === d[v]) ways[v] += ways[u];
    }
  }
  const path = [t]; while (path[0] !== s) path.unshift(prev[path[0]]);
  expect(ways[t]).toBe(1); // exactly one shortest route
  return { dist: d[t], path };
}
function kruskal(es: [string, string, number][]) {
  const par: Record<string, string> = {}; const f = (x: string): string => ((par[x] ??= x) === x ? x : (par[x] = f(par[x])));
  const take: string[] = [], skipped: string[] = []; let total = 0;
  for (const [a, b, w] of [...es].sort((x, y) => x[2] - y[2])) {
    if (f(a) !== f(b)) { par[f(a)] = f(b); take.push(`${a}-${b}`); total += w; } else skipped.push(`${a}-${b}`);
  }
  return { take, skipped, total };
}
function prim(g: Adj, s: string) {
  const inT = [s];
  while (inT.length < Object.keys(g).length) {
    const c: [number, string][] = [];
    for (const u of inT) for (const [v, w] of g[u]) if (!inT.includes(v)) c.push([w, v]);
    c.sort((a, b) => a[0] - b[0]);
    expect(c.length > 1 && c[0][0] === c[1][0] && c[0][1] !== c[1][1]).toBe(false); // no ambiguous choice
    inT.push(c[0][1]);
  }
  return inT;
}

const key = (label: string) => ITEMS.find((i) => i.label === label)!.answer_key;
const parts = (label: string) => { const k = key(label); return k.type === 'multi' ? k.parts.map((p) => p.value) : [(k as { value: unknown }).value]; };
/** The computed answer, typed the way a team would, must pass the checker. */
const accepts = (label: string, ...answers: (string | number)[]) => expect(checkAnswer(key(label), answers.map(String))).toBe(true);

const MAP2: [string, string, number][] = [['A', 'D', 4], ['A', 'B', 3], ['B', 'D', 2], ['D', 'E', 5], ['B', 'E', 7], ['B', 'G', 9], ['E', 'G', 2], ['C', 'E', 4], ['C', 'G', 6], ['F', 'G', 6], ['C', 'F', 3]];
const G2: [string, string][] = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'B'], ['C', 'E'], ['D', 'F'], ['E', 'D'], ['E', 'F']];

describe('question bank', () => {
  it('has 20 R1, 15 R2 and 20 R3 questions in play', () => {
    const live = ITEMS.filter((i) => !RETIRED.some(([r, l]) => r === i.round_id && l === i.label));
    expect(live.filter((i) => i.round_id === 'R1')).toHaveLength(20);
    expect(live.filter((i) => i.round_id === 'R2')).toHaveLength(15);
    expect(live.filter((i) => i.round_id === 'R3')).toHaveLength(20);
  });
  it('has unique labels and every figure exists', () => {
    const ids = ITEMS.map((i) => `${i.round_id}|${i.label}`);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ITEMS) for (const f of [i.figure_url, i.answer_figure_url]) if (f) expect(existsSync(join('public', f)), f).toBe(true);
  });
  it('accepts its own answer text for every auto-scored item', () => {
    for (const i of ITEMS) {
      if (i.answer_key.type === 'manual') continue;
      const k = i.answer_key as AnswerKey;
      const typed = k.type === 'multi'
        ? k.parts.map((p) => (Array.isArray(p.value) ? (p.type === 'edge_set' ? p.value.join(', ') : String(p.value[0])) : p.type === 'yesno' ? (p.value ? 'yes' : 'no') : String(p.value)))
        : [Array.isArray((k as { value: unknown }).value) ? ((k as { value: string[] }).value).join(', ') : String((k as { value: unknown }).value)];
      expect(checkAnswer(k, typed), `${i.round_id} ${i.label}`).toBe(true);
    }
  });
});

describe('tree answers', () => {
  const T3 = N('A', N('B', null, N('D', N('G'))), N('C', N('E'), N('F', null, N('H'))));
  it('R1 #11-#13 (tree T3)', () => {
    accepts('#11', 'B G D A E C F H'); // inorder written out by hand: check against the generic version below
    const ino = (t: T): (string | number)[] => (t ? [...ino(t.l), t.v, ...ino(t.r)] : []);
    expect(parts('#11')[0]).toBe(J(ino(T3)));
    expect(parts('#12')[0]).toBe(J(post(T3)));
    expect(parts('#13')).toEqual([3, height(T3)]);
  });
  it('R1 #14-#17 (rebuild, BST insert/search/delete)', () => {
    expect(parts('#14')[0]).toBe(J(pre(N(1, N(2, N(4)), N(3, N(5, N(6)), N(7))))));
    expect(parts('#15')[0]).toBe(J(level(bst([50, 70, 30, 60, 20, 80, 40, 65, 35]))));
    expect(parts('#16')[0]).toBe(J(searchPath(bst([40, 20, 60, 10, 30, 50, 70, 25, 35]), 35)));
    expect(parts('#17')[0]).toBe(J(pre(del(bst([50, 30, 70, 20, 40, 35, 45, 60, 80, 65]), 50))));
  });
  it('Huffman items', () => {
    const a = huffman({ A: 5, B: 9, C: 12, D: 13, E: 16, F: 45 });
    expect(parts('#18')).toEqual([a.total, a.depth.A]);
    const b = huffman({ A: 2, B: 3, C: 7, D: 10, E: 15 });
    expect(parts('H12')).toEqual([J(['A', 'B', 'C', 'D', 'E'].map((k) => b.depth[k])), b.total]);
  });
  it('R2 H6-H15 (build and delete)', () => {
    const t6 = () => bst([60, 40, 80, 20, 50, 70, 90, 45, 55]);
    expect(parts('H6')[0]).toBe(J(post(t6())));
    expect(parts('H7')[0]).toBe(J(pre(del(t6(), 40))));
    expect(parts('H8')[0]).toBe(J(pre(del(bst([30, 10, 50, 5, 20, 40, 60, 15]), 10))));
    expect(parts('H9')[0]).toBe(J(pre(del(del(bst([50, 30, 70, 20, 40, 60, 80, 65]), 20), 60))));
    expect(parts('H10')[0]).toBe(J(pre(del(bst([50, 30, 70, 20, 40, 60, 80, 55, 65]), 50))));
    expect(parts('H11')[0]).toBe(J(post(N('A', N('B', N('D', null, N('G')), N('E')), N('C', null, N('F', N('H')))))));
    expect(parts('H13')[0]).toBe(J(pre(del(del(bst([70, 50, 90, 40, 60, 80, 95, 55, 65]), 50), 70))));
    const gt: Record<string, string[]> = { R: ['A', 'B', 'C'], A: ['D', 'E'], C: ['F', 'G', 'H'] };
    const gpre = (v: string): string[] => [v, ...(gt[v] ?? []).flatMap(gpre)], gpost = (v: string): string[] => [...(gt[v] ?? []).flatMap(gpost), v];
    expect(parts('H14')).toEqual([J(gpre('R')), J(gpost('R'))]);
    const t15 = bst([8, 3, 10, 1, 6, 14, 4, 7, 13]);
    expect(parts('H15')).toEqual([J(post(t15)), height(t15)]);
  });
});

describe('graph answers', () => {
  const g = graph(MAP2, false), d2 = graph(G2, true);
  it('Map 2: MST, Prim, Dijkstra, BFS/DFS', () => {
    const k = kruskal(MAP2);
    expect(parts('M6')[0]).toBe(k.total);
    accepts('M6', k.total, k.take.join(', '));
    expect(parts('M20')[0]).toEqual([k.skipped[0]]);
    expect(parts('M7')[0]).toBe(J(prim(g, 'A')));
    expect(parts('M9')[0]).toBe(J(prim(g, 'F')));
    const f = dijkstra(g, 'A', 'F'); expect(parts('M8')).toEqual([f.dist, J(f.path)]);
    const closed = graph(MAP2.filter(([a, b]) => !(a === 'E' && b === 'G')), false);
    const c = dijkstra(closed, 'A', 'G'); expect(parts('M19')).toEqual([c.dist, J(c.path)]);
    expect(parts('M10')[0]).toBe(J(bfs(g, 'A')));
    expect(parts('M11')[0]).toBe(J(dfs(g, 'A')));
    expect(parts('M12')).toEqual([MAP2.length, J(g.E.map((x) => x[0]))]);
  });
  it('Directed graph G2', () => {
    expect(parts('#19')).toEqual([d2.C.length, G2.filter((e) => e[1] === 'D').length]);
    expect(parts('#20')[0]).toBe(J('ABCDEF'.split('').map((v) => (d2.C.some((x) => x[0] === v) ? 1 : 0))));
    expect(parts('M21')).toEqual([J(bfs(d2, 'A')), J(dfs(d2, 'A'))]);
    const fromC = dfs(d2, 'C');
    expect(parts('M22')).toEqual([J(fromC), J(Object.keys(d2).filter((v) => !fromC.includes(v)))]);
  });
  it('Adjacency matrix M', () => {
    const M = [[0, 1, 1, 0, 0, 0], [0, 0, 0, 1, 0, 0], [0, 1, 0, 0, 1, 0], [0, 0, 0, 0, 0, 1], [0, 0, 0, 1, 0, 1], [0, 0, 0, 0, 0, 0]];
    const gm: Adj = Object.fromEntries(M.map((r, i) => [String(i), r.flatMap((x, j) => (x ? [[String(j), 1] as [string, number]] : []))]));
    expect(parts('M13')).toEqual([!M.every((r, i) => r.every((x, j) => x === M[j][i])), M.flat().filter(Boolean).length]);
    expect(parts('M14')).toEqual([J(bfs(gm, '2')), J(dfs(gm, '0'))]);
  });
  it('Floyd-Warshall and Warshall', () => {
    const E: [number, number, number][] = [[1, 2, 3], [1, 4, 7], [2, 1, 8], [2, 3, 2], [3, 1, 5], [3, 4, 1], [4, 1, 2]];
    const D = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 0 : Infinity)));
    for (const [a, b, w] of E) D[a - 1][b - 1] = w;
    let afterFirst: number[][] = [];
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) D[i][j] = Math.min(D[i][j], D[i][k] + D[k][j]);
      if (k === 0) afterFirst = D.map((r) => [...r]);
    }
    expect(parts('M15')).toEqual([J(D[0]), J(D[3])]);
    expect(parts('M16')).toEqual([afterFirst[1][3], afterFirst[3][1]]);
    const V = 'ABCDE'.split(''), G6 = [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'D'], ['E', 'D']];
    const R = V.map((i) => V.map((j) => (G6.some((e) => e[0] === i && e[1] === j) ? 1 : 0)));
    for (let k = 0; k < 5; k++) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (R[i][k] && R[k][j]) R[i][j] = 1;
    expect(parts('M17')[0]).toBe(J(R[1]));
    expect(parts('M18')).toEqual([R.flat().filter(Boolean).length, R[4][0] === 1]);
  });
});
