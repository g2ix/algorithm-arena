// Draws the SVG figures used by the newer question-bank items.
// Run: node scripts/make-figures.mjs   (writes into public/figures/)
import { writeFileSync } from 'node:fs';

const R = 22;
const FONT = 'font-family="Arial, Helvetica, sans-serif"';
const INK = '#1f2937', NODE = '#dcfce7', STROKE = '#3f6212';

function svg(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${STROKE}"/></marker></defs>
<rect width="${w}" height="${h}" fill="#fff"/>
<text x="${w / 2}" y="30" text-anchor="middle" ${FONT} font-size="22" font-weight="bold" fill="${INK}">${title}</text>
${body}
</svg>
`;
}

/** nodes: {id: [x, y]}, edges: [from, to, weight?] */
function graph(title, w, h, nodes, edges, { directed = false, weightOffset = 14 } = {}) {
  let body = '';
  for (const [a, b, wt] of edges) {
    const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    // Two-way pairs (a->b and b->a) are drawn side by side instead of on top of each other.
    const two = directed && edges.some(([p, q]) => p === b && q === a);
    const ox = two ? -uy * 8 : 0, oy = two ? ux * 8 : 0;
    const sx = x1 + ux * R + ox, sy = y1 + uy * R + oy, ex = x2 - ux * (R + 2) + ox, ey = y2 - uy * (R + 2) + oy;
    body += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${STROKE}" stroke-width="2.5"${directed ? ' marker-end="url(#arr)"' : ''}/>\n`;
    if (wt !== undefined) {
      const off = two ? weightOffset + 10 : weightOffset;
      const mx = (x1 + x2) / 2 - uy * off, my = (y1 + y2) / 2 + ux * off;
      body += `<rect x="${(mx - 13).toFixed(1)}" y="${(my - 12).toFixed(1)}" width="26" height="22" rx="5" fill="#fef3c7" stroke="#d97706"/>`;
      body += `<text x="${mx.toFixed(1)}" y="${(my + 5).toFixed(1)}" text-anchor="middle" ${FONT} font-size="15" font-weight="bold" fill="#92400e">${wt}</text>\n`;
    }
  }
  for (const [id, [x, y]] of Object.entries(nodes)) {
    body += `<circle cx="${x}" cy="${y}" r="${R}" fill="${NODE}" stroke="${STROKE}" stroke-width="2.5"/>`;
    body += `<text x="${x}" y="${y + 7}" text-anchor="middle" ${FONT} font-size="20" fill="${INK}">${id}</text>\n`;
  }
  return svg(w, h, title, body);
}

function matrix(title, labels, rows) {
  const c = 46, x0 = 70, y0 = 70, w = x0 + c * labels.length + 30, h = y0 + c * (labels.length + 1) + 20;
  let body = '';
  labels.forEach((l, j) => { body += `<text x="${x0 + c * j + c / 2}" y="${y0 + 30}" text-anchor="middle" ${FONT} font-size="18" font-weight="bold" fill="${INK}">${l}</text>`; });
  rows.forEach((r, i) => {
    const y = y0 + c * (i + 1);
    body += `<text x="${x0 - 18}" y="${y + 30}" text-anchor="middle" ${FONT} font-size="18" font-weight="bold" fill="${INK}">${labels[i]}</text>`;
    r.forEach((v, j) => {
      body += `<rect x="${x0 + c * j}" y="${y}" width="${c}" height="${c}" fill="${v ? '#dcfce7' : '#fff'}" stroke="#9ca3af"/>`;
      body += `<text x="${x0 + c * j + c / 2}" y="${y + 30}" text-anchor="middle" ${FONT} font-size="18" fill="${INK}">${v}</text>`;
    });
  });
  return svg(w, h, title, body);
}

const out = (name, s) => writeFileSync(new URL(`../public/figures/${name}`, import.meta.url), s);

// T3: binary tree for R1 #11-#13
out('t3.svg', graph('Tree T3', 520, 330,
  { A: [260, 75], B: [150, 150], C: [370, 150], D: [210, 225], E: [320, 225], F: [430, 225], G: [170, 300], H: [470, 300] },
  [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'E'], ['C', 'F'], ['D', 'G'], ['F', 'H']]));

// G2: directed, unweighted (R1 #19-#20, R3 M21-M22)
out('g2.svg', graph('Graph G2 (directed)', 560, 320,
  { A: [70, 170], B: [210, 80], C: [210, 260], D: [360, 80], E: [360, 260], F: [500, 170] },
  [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'B'], ['C', 'E'], ['D', 'F'], ['E', 'D'], ['E', 'F']], { directed: true }));

// Map 2: undirected, weighted (R3 M6-M12, M19-M20)
out('map2.svg', graph('Map 2 (minutes per road)', 640, 380,
  { A: [70, 200], B: [200, 300], D: [200, 100], E: [350, 170], G: [400, 320], C: [500, 90], F: [580, 250] },
  [['A', 'D', 4], ['A', 'B', 3], ['B', 'D', 2], ['D', 'E', 5], ['B', 'E', 7], ['B', 'G', 9], ['E', 'G', 2], ['C', 'E', 4], ['C', 'G', 6], ['F', 'G', 6], ['C', 'F', 3]]));

// MAT1: adjacency matrix (R3 M13-M14)
out('mat1.svg', matrix('Adjacency matrix M', ['0', '1', '2', '3', '4', '5'], [
  [0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 0, 0],
]));

// G5: directed, weighted, for Floyd-Warshall (R3 M15-M16)
out('g5.svg', graph('Graph G5 (directed, weighted)', 480, 380,
  { 1: [100, 100], 2: [380, 100], 3: [380, 300], 4: [100, 300] },
  [['1', '2', 3], ['2', '1', 8], ['1', '4', 7], ['2', '3', 2], ['3', '1', 5], ['3', '4', 1], ['4', '1', 2]], { directed: true, weightOffset: 16 }));

// G6: directed, for Warshall (R3 M17-M18)
out('g6.svg', graph('Graph G6 (directed)', 520, 320,
  { A: [90, 110], B: [250, 70], C: [250, 230], D: [420, 230], E: [420, 80] },
  [['A', 'B'], ['B', 'C'], ['C', 'A'], ['C', 'D'], ['E', 'D']], { directed: true }));

console.log('figures written');
