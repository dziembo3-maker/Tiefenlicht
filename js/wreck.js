// wreck.js – eine gesunkene Galeone mit Tiefe: doppelte Bordwand aus überlappenden Planken, Decks auf mehreren Ebenen,
// Achterkastell mit Heckgalerie, Stückpforten, Webleinen, zerfetzte Segel; durch die Lecks sieht man Spanten und das Zwischendeck
import { T, Geo, rng, clamp } from './util.js';
import { paintMaterial } from './gfx.js';
import { floorH } from './terrain.js';
import { quad, tri, tube, disc, box, lathe, ring } from './build.js';

const K = 1.45, PI = Math.PI, zOf = (s) => -15 + 30 * s;
const beam = (s) => 3.9 * Math.pow(Math.sin(PI * Math.min(1, 0.1 + s * 0.9)), 0.5) + 0.02;
const gunY = (s) => 5.0 + 1.6 * Math.pow(1 - s, 2.5) + 1.3 * Math.pow(s, 3);             // Oberkante der Bordwand
const keelY = (s) => 2.6 * Math.pow(s, 6) + 0.9 * Math.pow(1 - s, 4);
const sec = (s, u, side) => { const a = u * PI / 2, k = keelY(s); return [side * beam(s) * Math.pow(Math.sin(a), 0.7) * (1 - 0.06 * u * u), k + (gunY(s) - k) * Math.pow(1 - Math.cos(a), 0.85), zOf(s)]; };
const uAt = (s, y) => Math.acos(1 - Math.pow(clamp((y - keelY(s)) / (gunY(s) - keelY(s)), 0, 1), 1 / 0.85)) / (PI / 2);
const hx = (s, y) => sec(s, uAt(s, y), 1)[0], topX = (s) => beam(s) * 0.94;
const QS = 0.24, PS = 0.11, FS = 0.86, FE = 0.985;                                        // Achterdeck, Hütte, Back
const mainY = (s) => gunY(s) - 0.9, qY = (s) => gunY(s) + 1.3, pY = (s) => gunY(s) + 3.3, fY = (s) => gunY(s) + 0.6;
const deckH = (s) => (s < PS ? pY(s) : s < QS ? qY(s) : s > FS ? fY(s) : mainY(s));
const deckW = (s) => (s < PS ? topX(s) * 0.86 : s < QS ? topX(s) * 0.95 : s > FS ? topX(s) * 0.93 : hx(s, mainY(s)));
const MASTS = [
  { s: 0.47, h: 24, base: mainY, lean: [0.6, -2.0], r: 0.4, nest: 0.55, yards: [[0.36, 6.2, 1.0], [0.66, 4.6, -0.7], [0.9, 3.0, 0.5]] },
  { s: 0.72, h: 18, base: mainY, lean: [-0.5, 1.4], r: 0.34, nest: 0.56, yards: [[0.4, 5.0, -1.2], [0.74, 3.6, 0.6]] },
  { s: 0.17, h: 7.5, base: qY, lean: [0.5, -0.5], r: 0.3, broken: true, yards: [] }];
const mastPt = (m, t) => [m.lean[0] * t * t, m.base(m.s) + m.h * t, zOf(m.s) + m.lean[1] * t];

/** Lage des Wracks in der Welt; Punkte auf Decks und Rumpf (für Bewuchs und Lichtpunkte), Kollisionskugeln, Lichter */
export function wreckFrame(x, z) {
  const rot = 0.95, e = new T.Euler(0.06, rot, -0.27, 'YXZ'), base = floorH(x, z) - 1.0, M = new T.Matrix4().makeRotationFromEuler(e).scale(new T.Vector3(K, K, K)).setPosition(x, base, z), v = new T.Vector3();
  const toWorld = (lx, ly, lz) => { v.set(lx, ly, lz).applyMatrix4(M); return [v.x, v.y, v.z]; };
  const F = { x, z, rot, base, euler: e, toWorld, spheres: [] };
  F.deck = (s, across) => toWorld(across * deckW(s) * 0.8, deckH(s) + 0.05, zOf(s));
  F.hull = (s, u, side) => { const p = sec(s, u, side); return toWorld(p[0] * 1.05, p[1], p[2]); };
  for (const s of [0.07, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9]) { const p = toWorld(0, gunY(s) * 0.5, zOf(s)); F.spheres.push({ x: p[0], y: p[1], z: p[2], r: Math.max(2.3, beam(s) * 0.98) * K }); }
  for (const s of [0.05, 0.16]) { const p = toWorld(0, gunY(s) + 2.2, zOf(s)); F.spheres.push({ x: p[0], y: p[1], z: p[2], r: 3.3 * K }); }
  for (const m of MASTS) for (let h = 2; h < m.h; h += 2.6) { const q = mastPt(m, h / m.h), p = toWorld(q[0], q[1], q[2]); F.spheres.push({ x: p[0], y: p[1], z: p[2], r: 1.0 }); }
  F.lights = [toWorld(1.0, 2.9, zOf(0.55)), toWorld(0, gunY(0) + 2.6, zOf(0) - 1.6), toWorld(0, mainY(QS) + 1.2, zOf(QS) + 1.2)];
  return F;
}

let MAT = null;
export function buildWreck(F) {
  const g = new Geo(), R = rng(1912), rr = (a, b) => a + R() * (b - a), W = -1;
  const PL1 = [0.38, 0.29, 0.2], PL2 = [0.31, 0.24, 0.17], WALE = [0.2, 0.15, 0.11], DECK = [0.44, 0.36, 0.26], DK = [0.085, 0.07, 0.058], MAST = [0.27, 0.21, 0.16], RAG = [0.44, 0.5, 0.5], BRASS = [0.55, 0.45, 0.25], WARM = [1.0, 0.68, 0.32], GD = [0.04, 0.1, 0.14], IRON = [0.12, 0.13, 0.14];
  const sh = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const NS = 28, NU = 12;
  const hole = (i, j, side) => (side > 0 ? (i >= 14 && i <= 17 && j >= 3 && j <= 7 && !(i === 17 && j === 3) && !(i === 14 && j === 7)) || (i === 18 && j >= 4 && j <= 5) : (i >= 8 && i <= 10 && j >= 4 && j <= 7 && !(i === 8 && j === 4)) || (i >= 21 && i <= 22 && j >= 7 && j <= 9));

  // ---------- Rumpf: außen überlappende Plankenreihen, innen eine zweite dunkle Wand ----------
  for (const side of [-1, 1]) for (let i = 0; i < NS; i++) for (let j = 0; j < NU; j++) {
    const s0 = i / NS, s1 = (i + 1) / NS, u0 = j / NU, u1 = (j + 1) / NU, a = sec(s0, u0, side), b = sec(s1, u0, side), c = sec(s1, u1, side), d = sec(s0, u1, side);
    if (!hole(i, j, side)) {
      const lap = 0.075 * side, a2 = [a[0] + lap, a[1], a[2]], b2 = [b[0] + lap, b[1], b[2]], col = sh(j % 2 ? PL1 : PL2, (0.82 + 0.3 * R()) * (0.72 + 0.28 * u1));
      if (side > 0) quad(g, a2, d, c, b2, col, 0, W); else quad(g, a2, b2, c, d, col, 0, W);
      if (j > 0) { if (side > 0) quad(g, a, a2, b2, b, sh(DK, 2), 0, W); else quad(g, a, b, b2, a2, sh(DK, 2), 0, W); }   // Unterkante der Planke
    }
    if (!hole(i, j, side) || R() < 0.0) { const q = (p) => [p[0] * 0.88, p[1] + 0.12 * (1 - u0), p[2]]; quad(g, q(a), q(b), q(c), q(d), DK); }
    else if (R() < 0.75) { const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2]; box(g, [m[0] + side * rr(-0.1, 0.25), m[1] + rr(-0.3, 0.3), m[2] + rr(-0.4, 0.4)], [0.1, 0.26, rr(0.6, 1.3)], rr(-0.5, 0.5), PL2, 0, rr(-0.5, 0.5), W); }   // gesplitterte Plankenreste
  }
  // Spanten (hinter den Lecks sichtbar)
  for (const side of [-1, 1]) for (let i = 2; i < NS - 2; i++) { const s = (i + 0.5) / NS, pts = []; for (let j = 0; j <= 7; j++) { const p = sec(s, j / 7, side); pts.push([p[0] * 0.94, p[1], p[2]]); } tube(g, pts, 0.17, 0.13, 4, PL2, 0, W); }
  // Berghölzer, Schandeckel, Kiel, Steven, Ruder
  const along = (u, s0, s1, out, r, col, sides = 4) => { for (const side of [-1, 1]) { let run = []; const flush = () => { if (run.length > 1) tube(g, run, r, r, sides, col, 0, W); run = []; }; for (let i = Math.round(s0 * NS); i <= Math.round(s1 * NS); i++) { const j = Math.min(NU - 1, Math.floor(u * NU)); if (i < NS && hole(i, j, side) && hole(Math.max(0, i - 1), j, side)) { flush(); continue; } const p = sec(i / NS, u, side); run.push([p[0] + side * out, p[1], p[2]]); } flush(); } };
  along(0.56, 0.0, 0.97, 0.12, 0.12, WALE); along(0.8, 0.0, 0.98, 0.12, 0.11, WALE); along(1.0, 0.0, 0.99, 0.02, 0.16, WALE);
  { const pts = []; for (let i = 0; i <= 24; i++) { const s = i / 28; pts.push([0, keelY(s) - 0.12, zOf(s)]); } tube(g, pts, 0.3, 0.3, 4, WALE, 0, W);
    const st = []; for (let i = 24; i <= 28; i++) { const s = i / 28; st.push([0, keelY(s) - 0.1, zOf(s) + 0.1]); } st.push([0, gunY(1) + 0.9, zOf(1) + 0.55]); tube(g, st, 0.3, 0.22, 4, WALE, 0, W);
    tube(g, [[0, keelY(0) - 0.2, zOf(0) - 0.12], [0, gunY(0), zOf(0) - 0.12]], 0.26, 0.26, 4, WALE, 0, W); box(g, [0, keelY(0) + 2.1, zOf(0) - 0.95], [0.22, 3.6, 1.5], 0.25, PL2, 0, 0, W); }

  // ---------- Decks ----------
  const floor = (s0, s1, yf, xf, cols, col, skip) => { const n = Math.max(1, Math.round((s1 - s0) * NS)); for (let i = 0; i < n; i++) for (let c = 0; c < cols; c++) { if (skip && skip(i, c)) continue; const a = s0 + (s1 - s0) * i / n, b = s0 + (s1 - s0) * (i + 1) / n, x = (s, q) => (q / cols * 2 - 1) * xf(s), k = (c % 2 ? 0.86 : 1.04) * (0.88 + 0.24 * R()); quad(g, [x(a, c), yf(a), zOf(a)], [x(a, c + 1), yf(a), zOf(a)], [x(b, c + 1), yf(b), zOf(b)], [x(b, c), yf(b), zOf(b)], sh(col, k), 0, W); } };
  floor(QS - 0.01, FS + 0.01, mainY, (s) => hx(s, mainY(s)) * 0.995, 8, DECK, (i, c) => (i >= 6 && i <= 7 && c >= 3 && c <= 4) || (i === 9 && c >= 6) || (i === 10 && c === 7) || (i === 3 && c === 0));
  floor(0.06, 0.92, (s) => keelY(s) + (mainY(s) - keelY(s)) * 0.45, (s) => hx(s, keelY(s) + (mainY(s) - keelY(s)) * 0.45) * 0.87, 4, sh(DECK, 0.35));          // Zwischendeck im Bauch
  floor(0, QS + 0.012, qY, (s) => topX(s) * 0.97, 6, DECK); floor(0, PS + 0.012, pY, (s) => topX(s) * 0.88, 6, DECK); floor(FS - 0.012, FE, fY, (s) => topX(s) * 0.95, 6, DECK);
  // Luke: Süll und Gräting
  { const s = QS - 0.01 + (FS - QS + 0.02) * 6.5 / 18, sL = QS - 0.01 + (FS - QS + 0.02) * 6 / 18, sR = QS - 0.01 + (FS - QS + 0.02) * 8 / 18, z0 = zOf(sL), z1 = zOf(sR), w = hx(s, mainY(s)) * 0.25, y = mainY(s);
    box(g, [-w, y + 0.12, (z0 + z1) / 2], [0.16, 0.3, z1 - z0 + 0.16], 0, WALE, 0, 0, W); box(g, [w, y + 0.12, (z0 + z1) / 2], [0.16, 0.3, z1 - z0 + 0.16], 0, WALE, 0, 0, W); box(g, [0, y + 0.12, z0], [2 * w, 0.3, 0.16], 0, WALE, 0, 0, W); box(g, [0, y + 0.12, z1], [2 * w, 0.3, 0.16], 0, WALE, 0, 0, W);
    for (let k = 1; k < 5; k++) box(g, [-w + 2 * w * k / 5, y + 0.1, (z0 + z1) / 2], [0.07, 0.07, z1 - z0], 0, PL2, 0, 0, W); for (let k = 1; k < 4; k++) box(g, [0, y + 0.1, z0 + (z1 - z0) * k / 4], [2 * w, 0.07, 0.07], 0, PL2, 0, 0, W); }

  // ---------- Kastelle: Wände, Schotten mit Türen und Fenstern, Vorsprünge ----------
  const wall = (s0, s1, y0, y1, x0, x1, col) => { const n = Math.max(1, Math.round((s1 - s0) * NS)); for (const side of [-1, 1]) for (let i = 0; i < n; i++) { const a = s0 + (s1 - s0) * i / n, b = s0 + (s1 - s0) * (i + 1) / n, A = [side * x0(a), y0(a), zOf(a)], B = [side * x0(b), y0(b), zOf(b)], C = [side * x1(b), y1(b), zOf(b)], D = [side * x1(a), y1(a), zOf(a)], c = sh(col, 0.85 + 0.25 * R()); if (side > 0) quad(g, A, D, C, B, c, 0, W); else quad(g, A, B, C, D, c, 0, W); } };
  const bulk = (s, y0, y1, x0, x1, col, dz = 0) => quad(g, [-x0, y0, zOf(s) + dz], [x0, y0, zOf(s) + dz], [x1, y1, zOf(s) + dz], [-x1, y1, zOf(s) + dz], col, 0, W);
  // Fenster/Tür mit erhabenem Rahmen; yaw = Richtung der Außenseite (0 = +z)
  const frame = (c, yaw, w, h, glass, em, bars = true) => {
    const nx = Math.sin(yaw), nz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), P = (a, b, o) => [c[0] + rx * a + nx * o, c[1] + b, c[2] + rz * a + nz * o];
    quad(g, P(-w / 2, -h / 2, 0.04), P(w / 2, -h / 2, 0.04), P(w / 2, h / 2, 0.04), P(-w / 2, h / 2, 0.04), glass, em);
    for (const [a, b, sx, sy] of [[0, h / 2 + 0.05, w + 0.24, 0.12], [0, -h / 2 - 0.05, w + 0.24, 0.12], [-w / 2 - 0.05, 0, 0.12, h], [w / 2 + 0.05, 0, 0.12, h]]) box(g, P(a, b, 0.07), [sx, sy, 0.18], yaw, WALE, 0, 0, W);
    if (bars) { box(g, P(0, 0, 0.06), [0.05, h, 0.06], yaw, WALE, 0, 0, W); box(g, P(0, 0, 0.06), [w, 0.05, 0.06], yaw, WALE, 0, 0, W); }
  };
  // Achterdeck (eine Ebene über dem Hauptdeck) und Hütte (zwei Ebenen)
  wall(PS, QS, gunY, (s) => qY(s) + 0.8, topX, (s) => topX(s) * 0.95, PL1); wall(0, PS, gunY, qY, topX, (s) => topX(s) * 0.95, PL1);
  wall(0, PS, qY, (s) => pY(s) + 0.75, (s) => topX(s) * 0.86, (s) => topX(s) * 0.84, PL2);
  bulk(QS, mainY(QS), gunY(QS), hx(QS, mainY(QS)), topX(QS), PL2, 0.02); bulk(QS, gunY(QS), qY(QS), topX(QS), topX(QS) * 0.95, PL2, 0.02);
  bulk(PS, qY(PS), pY(PS), topX(PS) * 0.86, topX(PS) * 0.86, PL1, 0.02);
  frame([0, mainY(QS) + 0.95, zOf(QS) + 0.03], 0, 0.95, 1.8, DK, 0, false); for (const x of [-1.9, 1.9]) frame([x, mainY(QS) + 1.3, zOf(QS) + 0.03], 0, 0.7, 0.7, WARM, x > 0 ? 1.05 : 0.9);
  frame([0, qY(PS) + 0.9, zOf(PS) + 0.03], 0, 0.8, 1.7, DK, 0, false); for (const x of [-1.5, 1.5]) frame([x, qY(PS) + 1.2, zOf(PS) + 0.03], 0, 0.6, 0.6, x < 0 ? WARM : GD, x < 0 ? 1.0 : 0.12);
  for (const z of [zOf(QS) + 0.14, zOf(PS) + 0.14]) { const top = z > zOf(PS) + 1 ? qY(QS) : pY(PS), w = z > zOf(PS) + 1 ? topX(QS) * 0.97 : topX(PS) * 0.88; box(g, [0, top - 0.05, z], [2 * w + 0.1, 0.3, 0.34], 0, WALE, 0, 0, W); }     // Balken an den Deckkanten
  for (const side of [-1, 1]) { for (const s of [0.045, 0.16]) frame([side * (topX(s) * (s < PS ? 0.86 : 0.975) + 0.0), (s < PS ? qY(s) + 1.0 : gunY(s) + 0.55), zOf(s)], side * PI / 2 + side * 0.12, 0.8, 0.65, s < PS ? WARM : GD, s < PS ? 1.0 : 0.12);
    for (const s of [0.004, PS, QS - 0.004]) tube(g, [[side * topX(s) * 1.0, gunY(s) - 0.4, zOf(s)], [side * topX(s) * 0.97, (s <= PS ? qY(s) : qY(s) + 0.8), zOf(s)]], 0.2, 0.17, 4, WALE, 0, W); }      // Eckpfosten
  // Heck: Spiegel, Galerie mit Geländer, zwei Fensterreihen, Bekrönung, Laterne
  for (let j = 0; j < NU; j++) { const a = sec(0, j / NU, -1), b = sec(0, (j + 1) / NU, -1), c = sec(0, (j + 1) / NU, 1), d = sec(0, j / NU, 1); quad(g, a, d, c, b, sh(j % 2 ? PL1 : PL2, 0.9), 0, W); }
  { const z = zOf(0), w1 = topX(0) * 0.95, w2 = topX(0) * 0.86, y0 = gunY(0), y1 = qY(0), y2 = pY(0) + 0.75;
    quad(g, [-topX(0), y0, z], [-w1, y1, z], [w1, y1, z], [topX(0), y0, z], PL2, 0, W); quad(g, [-w2, y1, z], [-w2 * 0.98, y2, z], [w2 * 0.98, y2, z], [w2, y1, z], PL1, 0, W);
    box(g, [0, y0 - 0.02, z - 0.5], [2 * w1 + 0.5, 0.2, 1.0], 0, WALE, 0, 0, W); box(g, [0, y1 - 0.02, z - 0.22], [2 * w1 + 0.3, 0.2, 0.45], 0, WALE, 0, 0, W);
    for (let k = 0; k <= 8; k++) { const x = (k / 8 * 2 - 1) * (w1 + 0.15); tube(g, [[x, y0 + 0.05, z - 0.92], [x, y0 + 0.85, z - 0.92]], 0.07, 0.06, 4, WALE, 0, W); } tube(g, [[-w1 - 0.2, y0 + 0.88, z - 0.92], [w1 + 0.2, y0 + 0.88, z - 0.92]], 0.09, 0.09, 4, WALE, 0, W);
    for (const side of [-1, 1]) tube(g, [[side * (w1 + 0.2), y0 + 0.88, z - 0.92], [side * (w1 + 0.1), y0 + 0.88, z]], 0.08, 0.08, 4, WALE, 0, W);
    for (let k = 0; k < 4; k++) frame([(k - 1.5) * 1.45, y0 + 0.7, z - 0.03], PI, 0.95, 0.85, k === 2 ? GD : WARM, k === 2 ? 0.12 : 1.0);
    for (let k = 0; k < 3; k++) frame([(k - 1) * 1.6, y1 + 1.15, z - 0.03], PI, 0.95, 1.0, k === 0 ? GD : WARM, k === 0 ? 0.12 : 0.95);
    for (const side of [-1, 1]) tube(g, [[side * w1, y0, z - 0.06], [side * w2, y2, z - 0.06]], 0.2, 0.16, 4, WALE, 0, W);
    box(g, [0, y2 + 0.2, z - 0.05], [2 * w2 * 0.7, 0.5, 0.3], 0, WALE, 0, 0, W); box(g, [0, y2 + 0.6, z - 0.05], [2 * w2 * 0.35, 0.45, 0.28], 0, WALE, 0, 0, W);
    tube(g, [[0, y2 + 0.7, z - 0.1], [0, y2 + 1.3, z - 0.9], [0, y2 + 1.25, z - 1.3]], 0.07, 0.06, 4, IRON); box(g, [0, y2 + 0.85, z - 1.3], [0.55, 0.75, 0.55], 0, WARM, 1.6); box(g, [0, y2 + 1.27, z - 1.3], [0.7, 0.1, 0.7], 0, BRASS); box(g, [0, y2 + 0.45, z - 1.3], [0.7, 0.1, 0.7], 0, BRASS); }
  // Back (Vorschiff)
  wall(FS, FE, gunY, (s) => fY(s) + 0.7, topX, (s) => topX(s) * 0.93, PL1); bulk(FS, mainY(FS), fY(FS), hx(FS, mainY(FS)), topX(FS) * 0.95, PL2, -0.02);
  frame([0, mainY(FS) + 0.72, zOf(FS) - 0.03], PI, 0.8, 1.35, DK, 0, false); box(g, [0, fY(FS) - 0.05, zOf(FS) - 0.14], [2 * topX(FS) * 0.95 + 0.1, 0.28, 0.32], 0, WALE, 0, 0, W);
  // Geländer an den Deckkanten, Treppen zum Achterdeck
  const rail = (z, y, w, gaps) => { let run = []; const fl = () => { if (run.length > 1) tube(g, run, 0.08, 0.08, 4, WALE, 0, W); run = []; }; for (let k = 0; k <= 14; k++) { const x = (k / 14 * 2 - 1) * w; if (gaps && gaps(x)) { fl(); continue; } tube(g, [[x, y, z], [x, y + 0.85, z]], 0.06, 0.05, 4, WALE, 0, W); run.push([x, y + 0.87, z]); } fl(); };
  rail(zOf(QS) + 0.3, qY(QS), topX(QS) * 0.93, (x) => Math.abs(Math.abs(x) - 2.2) < 0.62); rail(zOf(PS) + 0.3, pY(PS), topX(PS) * 0.82); rail(zOf(FS) - 0.3, fY(FS), topX(FS) * 0.9, (x) => Math.abs(x) < 0.5);
  for (const side of [-1, 1]) { const n = 7, y0 = mainY(QS + 0.05), y1 = qY(QS); for (let k = 0; k < n; k++) box(g, [side * 2.2, y0 + (y1 - y0) * (k + 0.5) / n, zOf(QS) + 2.6 - 2.4 * (k + 0.5) / n], [1.1, 0.1, 0.42], 0, DECK, 0, 0, W);
    for (const dx of [-0.58, 0.58]) tube(g, [[side * 2.2 + dx, y0 - 0.05, zOf(QS) + 2.75], [side * 2.2 + dx, y1 - 0.1, zOf(QS) + 0.25]], 0.09, 0.09, 4, WALE, 0, W); }
  // Stückpforten: offene Klappen, dunkle oder warm erleuchtete Öffnungen, in manchen noch ein Rohr
  for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {
    const s = 0.3 + k * 0.09, i = Math.floor(s * NS), y = mainY(s) - 0.95, uu = uAt(s, y), j = Math.floor(uu * NU); if (hole(i, j, side) || hole(i, j + 1, side) || hole(i, Math.max(0, j - 1), side)) continue;
    const x = side * (hx(s, y) + 0.1), lit = R() < 0.45, yaw = side * PI / 2; frame([x, y, zOf(s)], yaw, 0.8, 0.7, lit ? WARM : sh(DK, 0.5), lit ? 0.85 : 0, false);
    box(g, [x + side * 0.38, y + 0.62, zOf(s)], [0.9, 0.07, 0.75], 0, PL2, 0, 0, W, side * -0.95);
    if (R() < 0.5) tube(g, [[x - side * 0.2, y - 0.02, zOf(s)], [x + side * 0.75, y - 0.06, zOf(s)]], 0.2, 0.15, 7, IRON);
  }

  // ---------- an Deck ----------
  { const s = 0.36, y = mainY(s), z = zOf(s); lathe(g, [0, y, z], 'y', [[0, 0.5], [0.16, 0.5], [0.22, 0.32], [0.85, 0.26], [0.9, 0.46], [1.08, 0.46], [1.12, 0.2], [1.12, 0]], 10, PL2, 0, W); for (let k = 0; k < 4; k++) { const a = k * PI / 4; tube(g, [[-Math.cos(a) * 1.5, y + 1.0, z - Math.sin(a) * 1.5], [Math.cos(a) * 1.5, y + 1.0, z + Math.sin(a) * 1.5]], 0.055, 0.055, 4, WALE, 0, W); } }   // Gangspill
  for (const [s, side, tip] of [[0.31, -1, 0], [0.6, 1, 0.5], [0.53, -1, 0]]) { const y = mainY(s), x = side * (hx(s, y) - 1.5), z = zOf(s); box(g, [x, y + 0.28, z], [1.3, 0.4, 0.8], 0, PL2, 0, 0, W, tip * 0.4); tube(g, [[x - side * 0.7, y + 0.6 + tip * 0.3, z], [x + side * 1.3, y + 0.62 - tip * 0.5, z]], 0.24, 0.16, 8, IRON);
    for (const dz of [-0.45, 0.45]) for (const dx of [-0.4, 0.4]) disc(g, [x + dx, y + 0.2, z + dz * 1.02], [0, 0, dz], 0.2, WALE, 0, 8); }   // Kanonen
  const barrel = (x, y, z) => { lathe(g, [x, y, z], 'y', [[0, 0.3], [0.25, 0.38], [0.65, 0.38], [0.9, 0.3], [0.9, 0]], 9, (t) => (t > 0.2 && t < 0.35) || (t > 0.6 && t < 0.8) ? IRON : PL1, 0, W); };
  barrel(-1.6, mainY(0.42), zOf(0.42)); barrel(-2.2, mainY(0.44), zOf(0.44)); barrel(1.4, mainY(0.8), zOf(0.8)); barrel(1.2, qY(0.2), zOf(0.21));
  for (const [s, ac] of [[0.4, 0.45], [0.82, -0.4], [0.66, -0.5]]) box(g, [ac * deckW(s), mainY(s) + 0.4, zOf(s)], [0.9, 0.8, 0.9], R(), [0.4, 0.31, 0.22], 0, 0, W);
  { const s = 0.2, y = qY(s), z = zOf(s) + 0.5; box(g, [0, y + 0.45, z], [0.22, 0.9, 0.22], 0, WALE, 0, 0, W); ring(g, [0, y + 1.0, z + 0.2], [0, 0, 1], 0.45, 0.045, 16, 5, PL1, 0, W); for (let k = 0; k < 4; k++) { const a = k * PI / 4; tube(g, [[-Math.cos(a) * 0.6, y + 1.0 - Math.sin(a) * 0.6, z + 0.2], [Math.cos(a) * 0.6, y + 1.0 + Math.sin(a) * 0.6, z + 0.2]], 0.03, 0.03, 4, PL1, 0, W); } }   // Steuerrad

  // ---------- Masten: Untermast mit Reifen, Mars, Stenge, Rahen, Segelfetzen, Wanten mit Webleinen ----------
  const shred = (p0, p1, len, bil) => {
    const segs = 3, col = sh(RAG, rr(0.6, 1.05)), tip = R() < 0.55; let a = p0, b = p1;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs, nar = 1 - t * rr(0.25, 0.6), cx = (p0[0] + p1[0]) / 2 + rr(-0.25, 0.25) * t, hw = Math.abs(p1[0] - p0[0]) / 2 * nar, y = (p0[1] + p1[1]) / 2 - len * t, z = p0[2] + Math.sin(t * 2.2) * bil;
      const c = [cx - hw, y + rr(-0.2, 0.2), z], d = [cx + hw, y + rr(-0.2, 0.2), z];
      if (k === segs && tip) tri(g, a, b, [cx, y - len * 0.2, z], sh(col, 1 - t * 0.35)); else quad(g, a, b, d, c, sh(col, 1 - t * 0.35));
      a = c; b = d;
    }
  };
  for (const m of MASTS) {
    const low = []; const tEnd = m.broken ? 1 : m.nest + 0.07; for (let j = 0; j <= 6; j++) low.push(mastPt(m, tEnd * j / 6)); tube(g, low, m.r, m.r * 0.72, 9, MAST, 0, W);
    for (let h = 2.2; h < m.h * tEnd - 0.5; h += 2.6) { const p = mastPt(m, h / m.h); lathe(g, [p[0], p[1], p[2]], 'y', [[-0.1, m.r * 1.02], [-0.1, m.r * 1.14], [0.1, m.r * 1.14], [0.1, m.r * 1.0]], 9, IRON); }
    if (m.broken) { const p = mastPt(m, 1); for (let k = 0; k < 4; k++) box(g, [p[0] + rr(-0.15, 0.15), p[1] + 0.3, p[2] + rr(-0.15, 0.15)], [0.1, rr(0.5, 1.1), 0.12], R() * 6, MAST, 0, rr(-0.3, 0.3), W); continue; }
    const np = mastPt(m, m.nest);
    disc(g, [np[0], np[1], np[2]], [0, 1, 0], 1.45, DECK, 0, 12, W); disc(g, [np[0], np[1] - 0.14, np[2]], [0, -1, 0], 1.45, WALE, 0, 12, W); lathe(g, [np[0], np[1], np[2]], 'y', [[-0.14, 1.45], [0.0, 1.45]], 12, WALE, 0, W);
    ring(g, [np[0], np[1] + 0.7, np[2]], [0, 1, 0], 1.4, 0.05, 12, 4, WALE, 0, W); for (let k = 0; k < 6; k++) { const a = k * PI / 3; tube(g, [[np[0] + Math.cos(a) * 1.4, np[1], np[2] + Math.sin(a) * 1.4], [np[0] + Math.cos(a) * 1.4, np[1] + 0.7, np[2] + Math.sin(a) * 1.4]], 0.04, 0.04, 4, WALE, 0, W); }
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.78; tube(g, [[np[0] + Math.cos(a) * 0.3, np[1] - 1.3, np[2] + Math.sin(a) * 0.3], [np[0] + Math.cos(a) * 1.2, np[1] - 0.1, np[2] + Math.sin(a) * 1.2]], 0.07, 0.07, 4, WALE, 0, W); }
    const topm = []; for (let j = 0; j <= 5; j++) { const q = mastPt(m, m.nest - 0.06 + (1.06 - m.nest) * j / 5); topm.push([q[0], q[1], q[2] + 0.42]); } tube(g, topm, m.r * 0.6, m.r * 0.28, 7, MAST, 0, W);
    for (const [t, half, droop] of m.yards) {
      const c = mastPt(m, t), zz = c[2] + (t > m.nest ? 0.42 : 0) + 0.5, a = [c[0] - half, c[1] - droop * 0.5, zz], b = [c[0] + half, c[1] + droop * 0.5, zz], mid = [c[0], c[1], zz];
      tube(g, [a, [(a[0] + mid[0]) / 2, (a[1] + mid[1]) / 2, zz], mid, [(b[0] + mid[0]) / 2, (b[1] + mid[1]) / 2, zz], b], [0.07, 0.14, 0.17, 0.14, 0.07], 0, 6, MAST, 0, W);
      const up = mastPt(m, Math.min(1, t + 0.2)); for (const e of [a, b]) tube(g, [e, [up[0], up[1], up[2] + 0.42]], 0.025, 0.025, 3, MAST);
      const N = Math.round(half * 2.6), keep = Math.floor(rr(0, N - 3)); for (let k = 0; k < N; k++) {
        const big = k >= keep && k < keep + 3; if (!big && R() < 0.3) continue; const t0 = k / N, t1 = (k + 1) / N - (big ? 0 : rr(0, 0.25) / N);
        shred([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - 0.12, zz], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - 0.12, zz], big ? rr(4.5, 6.5) : rr(1.2, 5), rr(-1, 1) * (big ? 1.2 : 0.7));
      }
    }
    for (const side of [-1, 1]) { const Tp = [np[0] + side * 1.2, np[1], np[2]], B = [-0.085, -0.05, -0.015, 0.02].map((d) => { const s = m.s + d; return [side * (topX(s) + 0.25), gunY(s), zOf(s)]; }), at = (b, t) => [b[0] + (Tp[0] - b[0]) * t, b[1] + (Tp[1] - b[1]) * t, b[2] + (Tp[2] - b[2]) * t];
      for (const b of B) tube(g, [b, Tp], 0.04, 0.04, 3, MAST); const len = np[1] - gunY(m.s); for (let h = 1.2; h < len - 0.8; h += 1.05) { if (R() < 0.12) continue; tube(g, [at(B[0], h / len), at(B[3], h / len)], 0.022, 0.022, 3, MAST); }
      box(g, [side * (topX(m.s - 0.03) + 0.2), gunY(m.s - 0.03) - 0.05, zOf(m.s - 0.03)], [0.5, 0.1, 3.6], 0, WALE, 0, 0, W); }
  }
  { const a = mastPt(MASTS[0], 1), b = mastPt(MASTS[1], 1); tube(g, [[a[0], a[1], a[2] + 0.42], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.5, (a[2] + b[2]) / 2], [b[0], b[1], b[2] + 0.42]], 0.035, 0.035, 3, MAST); tube(g, [[b[0], b[1], b[2] + 0.42], [0, gunY(1) + 3.8, 21.5]], 0.035, 0.035, 3, MAST); const n0 = mastPt(MASTS[1], MASTS[1].nest); tube(g, [n0, [0, gunY(1) + 2.6, 19]], 0.035, 0.035, 3, MAST); }
  tube(g, [[0, fY(0.96) - 0.1, zOf(0.955)], [0, gunY(1) + 2.2, 18.5], [0, gunY(1) + 4.0, 22.5]], 0.3, 0.11, 7, MAST, 0, W);
  tube(g, [[-2.6, mainY(0.62) + 0.2, zOf(0.6)], [1.4, mainY(0.66) + 0.3, zOf(0.69)], [3.5, mainY(0.7) + 1.1, zOf(0.73)]], 0.12, 0.1, 5, MAST, 0, W);      // herabgestürzte Rah
  // Laterne im Zwischendeck (durch das Leck sichtbar)
  { const p = [1.0, 2.9, zOf(0.55)]; box(g, p, [0.5, 0.65, 0.5], 0.3, WARM, 1.6); tube(g, [[p[0], p[1] + 0.3, p[2]], [p[0], mainY(0.55) - 0.05, p[2]]], 0.025, 0.025, 3, IRON); }

  const mat = MAT || (MAT = paintMaterial(T.DoubleSide));
  const ship = new T.Mesh(g.build(), mat);
  ship.position.set(F.x, F.base, F.z); ship.rotation.copy(F.euler); ship.scale.setScalar(K); ship.updateMatrixWorld(true);
  ship.geometry.boundingSphere.radius += 3;

  // ---------- Trümmerfeld ringsum (Weltkoordinaten): Fässer, Kisten, Planken, ein abgebrochener Mast ----------
  const d = new Geo(), place = (a, r) => { const x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r; return [x, floorH(x, z), z]; };
  for (let i = 0; i < 9; i++) { const p = place(rr(0, 6.3), rr(16, 34)); if (R() < 0.5) lathe(d, [p[0], p[1] - 0.1, p[2]], 'y', [[0, 0.42], [0.35, 0.54], [0.9, 0.54], [1.25, 0.42], [1.25, 0]], 9, PL1, 0, W); else lathe(d, [p[0], p[1] + 0.45, p[2]], R() < 0.5 ? 'x' : 'z', [[-0.6, 0], [-0.6, 0.42], [-0.25, 0.54], [0.25, 0.54], [0.6, 0.42], [0.6, 0]], 9, PL1, 0, W); }
  for (let i = 0; i < 7; i++) { const p = place(rr(0, 6.3), rr(14, 32)); box(d, [p[0], p[1] + 0.35, p[2]], [rr(0.8, 1.3), rr(0.6, 1.0), rr(0.8, 1.3)], R() * 6.3, [0.38, 0.3, 0.21], 0, rr(-0.3, 0.3), W); }
  for (let i = 0; i < 22; i++) { const p = place(rr(0, 6.3), rr(12, 38)); box(d, [p[0], p[1] + 0.08, p[2]], [rr(2, 5), 0.12, 0.38], R() * 6.3, sh(PL2, rr(0.8, 1.2)), 0, rr(-0.15, 0.15), W); }
  { const a = 2.6, p = place(a, 19), q = place(a + 0.45, 27); tube(d, [[p[0], p[1] + 0.3, p[2]], [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.6, (p[2] + q[2]) / 2], [q[0], q[1] + 0.5, q[2]]], 0.4, 0.3, 7, MAST, 0, W); }
  const deb = new T.Mesh(d.build(), mat);
  return [ship, deb];
}
