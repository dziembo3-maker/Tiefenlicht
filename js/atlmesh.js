// atlmesh.js – macht aus dem Felsfeld des Atlantis-Bioms die Oberfläche einer 64-m-Kachel (Surface Nets).
// Läuft im Worker (atlworker.js), zur Not auch im Hauptprogramm. Liefert Ecken, Normalen, Verschattung (aAO),
// Stellen für Bewuchs auf Köpfen und Absätzen und die Verschattung des Sandbodens am Fuß der Felsen.
import { localSet, sdfL, h3 } from './atlantis.js';
import { floorH } from './terrain.js';

const CS = 64, NC = 46, HS = CS / NC, NQ = 40, STEP = CS / NQ, BLK = 4;

export function meshTile(ix, iz) {
  const x0 = ix * CS, z0 = iz * CS, out = { ix, iz, P: [], N: [], A: [], I: [], spots: [], occ: null };
  const L = localSet(x0 - HS * 3, z0 - HS * 3, x0 + CS + HS * 3, z0 + CS + HS * 3);
  if (!L.B.length) return pack(out);
  const NP = NC + 2, gx = (p) => x0 + (p - 1) * HS;   // Punkt p = 0..NP-1 liegt bei Gitterkoordinate p-1
  // senkrechter Bereich: von knapp unter dem tiefsten Fuß bis über den höchsten Kopf, auf ein festes Raster (gleich in allen Kacheln)
  const j0 = Math.floor((L.minY - 2) / HS) - 1, j1 = Math.ceil((L.maxTop + 1) / HS) + 1, NY = j1 - j0 + 1, gy = (j) => (j0 + j) * HS;
  const GR = new Float32Array(NP * NP);
  for (let q = 0; q < NP; q++) for (let p = 0; p < NP; p++) GR[q * NP + p] = floorH(gx(p), gx(q) - x0 + z0);
  const cut = (p, q, y) => GR[q * NP + p] - 3 - y;   // unter dem Sand: abgeschnitten
  const ev = (p, j, q) => { const y = gy(j), c = cut(p, q, y); if (c > 1.5) return c; const d = sdfL(L, gx(p), y, gx(q) - x0 + z0); return d > c ? d : c; };
  // Feld: grob in Blöcken vorrechnen, weit weg von jeder Fläche nur noch mischen
  const F = new Float32Array(NP * NP * NY), id = (p, j, q) => (q * NY + j) * NP + p;
  const bx = Math.ceil((NP - 1) / BLK), by = Math.ceil((NY - 1) / BLK), cpi = (b, n) => Math.min(b * BLK, n - 1);
  const Cv = new Float32Array((bx + 1) * (by + 1) * (bx + 1)), cid = (a, b, c) => (c * (by + 1) + b) * (bx + 1) + a;
  for (let c = 0; c <= bx; c++) for (let b = 0; b <= by; b++) for (let a = 0; a <= bx; a++) Cv[cid(a, b, c)] = ev(cpi(a, NP), cpi(b, NY), cpi(c, NP));
  const thr = BLK * HS * 1.6; let neg = 0;
  for (let c = 0; c < bx; c++) for (let b = 0; b < by; b++) for (let a = 0; a < bx; a++) {
    const v = [Cv[cid(a, b, c)], Cv[cid(a + 1, b, c)], Cv[cid(a, b + 1, c)], Cv[cid(a + 1, b + 1, c)], Cv[cid(a, b, c + 1)], Cv[cid(a + 1, b, c + 1)], Cv[cid(a, b + 1, c + 1)], Cv[cid(a + 1, b + 1, c + 1)]];
    let mn = 1e9, mx = -1e9; for (const w of v) { if (w < mn) mn = w; if (w > mx) mx = w; }
    const far = (mn > thr) || (mx < -thr), p0 = a * BLK, p1 = Math.min((a + 1) * BLK, NP - 1), j0b = b * BLK, j1b = Math.min((b + 1) * BLK, NY - 1), q0 = c * BLK, q1 = Math.min((c + 1) * BLK, NP - 1);
    for (let q = q0; q <= q1; q++) for (let j = j0b; j <= j1b; j++) for (let p = p0; p <= p1; p++) {
      const k = id(p, j, q); if (F[k] !== 0) continue;
      let val;
      if (far) { const u = (p - p0) / Math.max(1, p1 - p0), s = (j - j0b) / Math.max(1, j1b - j0b), t = (q - q0) / Math.max(1, q1 - q0);
        val = ((v[0] * (1 - u) + v[1] * u) * (1 - s) + (v[2] * (1 - u) + v[3] * u) * s) * (1 - t) + ((v[4] * (1 - u) + v[5] * u) * (1 - s) + (v[6] * (1 - u) + v[7] * u) * s) * t; }
      else val = ev(p, j, q);
      F[k] = val === 0 ? 1e-4 : val; if (val < 0) neg++;
    }
  }
  if (!neg) return pack(out);
  const sample = (x, y, z) => { const fi = (x - x0) / HS + 1, fj = y / HS - j0, fk = (z - z0) / HS + 1;
    if (fi < 0 || fj < 0 || fk < 0 || fi >= NP - 1 || fj >= NY - 1 || fk >= NP - 1) return sdfL(L, x, y, z);
    const i = Math.floor(fi), j = Math.floor(fj), k = Math.floor(fk), a = fi - i, b = fj - j, c = fk - k, f = (ii, jj, kk) => F[id(i + ii, j + jj, k + kk)];
    return ((f(0, 0, 0) * (1 - a) + f(1, 0, 0) * a) * (1 - b) + (f(0, 1, 0) * (1 - a) + f(1, 1, 0) * a) * b) * (1 - c) + ((f(0, 0, 1) * (1 - a) + f(1, 0, 1) * a) * (1 - b) + (f(0, 1, 1) * (1 - a) + f(1, 1, 1) * a) * b) * c; };
  // eine Ecke je Zelle mit Vorzeichenwechsel
  const NCX = NP - 1, NCY = NY - 1, VI = new Int32Array(NCX * NCY * NCX).fill(-1), LOW = new Uint8Array(NCX * NCY * NCX), vid = (p, j, q) => (q * NCY + j) * NCX + p;
  const E = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
  const { P, N, A } = out;
  for (let q = 0; q < NCX; q++) for (let j = 0; j < NCY; j++) for (let p = 0; p < NCX; p++) {
    let mask = 0; for (let o = 0; o < 8; o++) if (F[id(p + (o & 1), j + ((o >> 1) & 1), q + (o >> 2))] < 0) mask |= 1 << o;
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a0, b0, c0, a1, b1, c1] of E) { const v0 = F[id(p + a0, j + b0, q + c0)], v1 = F[id(p + a1, j + b1, q + c1)]; if ((v0 < 0) === (v1 < 0)) continue; const t = v0 / (v0 - v1); sx += a0 + (a1 - a0) * t; sy += b0 + (b1 - b0) * t; sz += c0 + (c1 - c0) * t; cnt++; }
    const x = gx(p + sx / cnt), y = gy(j + sy / cnt), z = gx(q + sz / cnt) - x0 + z0, f = (a, b, c) => F[id(p + a, j + b, q + c)];
    let nx = f(1, 0, 0) - f(0, 0, 0) + f(1, 1, 0) - f(0, 1, 0) + f(1, 0, 1) - f(0, 0, 1) + f(1, 1, 1) - f(0, 1, 1), ny = f(0, 1, 0) - f(0, 0, 0) + f(1, 1, 0) - f(1, 0, 0) + f(0, 1, 1) - f(0, 0, 1) + f(1, 1, 1) - f(1, 0, 1), nz = f(0, 0, 1) - f(0, 0, 0) + f(1, 0, 1) - f(1, 0, 0) + f(0, 1, 1) - f(0, 1, 0) + f(1, 1, 1) - f(1, 1, 0);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    let occ = 0, w = 1; for (const s of [1.2, 2.6, 5.2]) { occ += Math.max(0, (s - sample(x + nx * s, y + ny * s, z + nz * s)) / s) * w; w *= 0.6; }
    const g = GR[Math.min(NP - 1, Math.round(sz / cnt) + q) * NP + Math.min(NP - 1, Math.round(sx / cnt) + p)], gh = y - g;
    const ao = Math.max(0.12, 1 - occ * 0.85) * (0.68 + 0.32 * Math.min(1, Math.max(0, (gh + 0.5) / 3.5)));
    const vi = vid(p, j, q); VI[vi] = P.length / 3; LOW[vi] = gh < -1.2 ? 1 : 0; P.push(x, y, z); N.push(nx, ny, nz); A.push(ao);
    if (gh > 1.5 && ny > 0.78 && ao > 0.5 && p >= 1 && q >= 1 && p <= NC && q <= NC && h3(p + ix * 97, j + 5000, q + iz * 89) < 0.05) out.spots.push(x, y, z, ny);
  }
  // Vierecke: jede Kante gehört der Kachel, in der ihr Anfangspunkt liegt (Punkte 1..NC), so passen die Kacheln ohne Lücke aneinander
  const I = out.I, quad = (a, b, c, d, flip) => {
    const A1 = VI[a], B1 = VI[b], C1 = VI[c], D1 = VI[d]; if (A1 < 0 || B1 < 0 || C1 < 0 || D1 < 0) return; if (LOW[a] && LOW[b] && LOW[c] && LOW[d]) return;
    if (flip) I.push(A1, D1, C1, A1, C1, B1); else I.push(A1, B1, C1, A1, C1, D1); };
  for (let q = 1; q <= NC; q++) for (let j = 1; j < NY - 1; j++) for (let p = 1; p <= NC; p++) {
    const v0 = F[id(p, j, q)];
    { const v1 = F[id(p + 1, j, q)]; if ((v0 < 0) !== (v1 < 0)) quad(vid(p, j - 1, q - 1), vid(p, j, q - 1), vid(p, j, q), vid(p, j - 1, q), v0 >= 0); }
    { const v1 = F[id(p, j, q + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(vid(p - 1, j - 1, q), vid(p, j - 1, q), vid(p, j, q), vid(p - 1, j, q), v0 >= 0); }
  }
  for (let q = 1; q <= NC; q++) for (let j = 0; j < NY - 1; j++) for (let p = 1; p <= NC; p++) {
    const v0 = F[id(p, j, q)], v1 = F[id(p, j + 1, q)]; if ((v0 < 0) === (v1 < 0)) continue;
    quad(vid(p - 1, j, q - 1), vid(p - 1, j, q), vid(p, j, q), vid(p, j, q - 1), v0 >= 0);
  }
  // Sandboden: Schatten am Fuß der Felsen und unter Überhängen (gleiche Punkte wie das Gelände-Gitter in world.js)
  const n = NQ + 1, occ = new Float32Array(n * n); let any = false;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * STEP, z = z0 + j * STEP, h = floorH(x, z), d0 = sdfL(L, x, h + 1.2, z); if (d0 > 9) continue;
    let o = 0.4 * (1 - Math.min(1, Math.max(0, d0 / 4))), w = 0.5; for (const s of [2, 5, 10]) { o += Math.max(0, (s - sdfL(L, x, h + s, z)) / s) * w; w *= 0.65; }
    if (o > 0.01) { occ[j * n + i] = Math.min(0.85, o); any = true; }
  }
  if (any) out.occ = occ;
  return pack(out);
}
function pack(o) {
  const nv = o.P.length / 3;
  return { ix: o.ix, iz: o.iz, P: new Float32Array(o.P), N: new Float32Array(o.N), A: new Float32Array(o.A), I: nv > 65535 ? new Uint32Array(o.I) : new Uint16Array(o.I), spots: new Float32Array(o.spots), occ: o.occ };
}
