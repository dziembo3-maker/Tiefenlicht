// atlantis.js – das Atlantis-Biom im Westen, ohne Grafik (läuft auch in Workern):
// wo das Gebiet liegt (atlK), wie der Sandboden aussieht (Dünen, Becken der Stadt, Abbruch zur südlichen Tiefsee)
// und wo der Fels steht. Der Fels ist ein Volumenfeld (Abstandsfunktion) aus vielen verformten Grundformen:
// Wände aus Säulen verschiedener Höhe, Säulengruppen, Nadeln, Türme bis an die Oberfläche, Bögen, Felstore, Höhlen. Alles entsteht Zelle für Zelle
// aus festen Zufallszahlen, nichts wird vorab für das ganze Gebiet berechnet.
import { clamp, smooth, fbm, noise, rng } from './util.js';

const fract = (v) => v - Math.floor(v), TAU = Math.PI * 2;
const terr = (k, n) => { const t = k * n, f = Math.floor(t); return (f + smooth(0.2, 0.8, t - f)) / n; };

// ---------- Lage ----------
/** Umriss des Gebiets (x, z); westlich geht es bis über den Kartenrand hinaus */
const POLY = [[-700, 1470], [-610, 1160], [-555, 930], [-530, 600], [-495, 330], [-465, 70], [-445, -200], [-460, -530], [-540, -760], [-640, -1050], [-760, -1320], [-1700, -1320], [-1700, 1470]];
/** Ort der späteren Stadt: ein flaches Sandbecken, bleibt frei von Fels */
export const CITY = { x: -880, z: 860, r: 140 };
/** Abbruch zur Tiefsee im Süden */
export const ABY = { x: -905, z: -930, rx: 290, rz: 300, floor: -218 };
/** warme Spalte im Gebiet (bleiben, um sie herum dunkle Nadeln) */
export const VENTS = [{ x: -893, z: -345 }, { x: -775, z: -85 }, { x: -1165, z: 300 }, { x: -745, z: 975 }, { x: -1240, z: 760 }];

function polySD(x, z) {
  let d = 1e9, inside = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [ax, az] = POLY[j], [bx, bz] = POLY[i], ex = bx - ax, ez = bz - az, t = clamp(((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez), 0, 1);
    d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
    if ((az > z) !== (bz > z) && x < ax + (z - az) / (bz - az) * ex) inside = !inside;
  }
  return inside ? -d : d;
}
/** 0 außerhalb, 1 im Gebiet; dazwischen ein gut 100 m breiter Übergang, der ganz innerhalb des Umrisses liegt */
export function atlK(x, z) {
  if (x > -388) return 0;
  const sd = polySD(x, z) + (fbm(x * 0.004 + 1.7, z * 0.004 - 3.3, 2) - 0.5) * 70;
  return smooth(10, 130, -sd);
}

// ---------- Sandboden ----------
// Ein Dünenfeld mit fester Richtung und fester Wellenlänge; geschwungen nur durch die Verwirbelung.
// (Früher drehte sich die Richtung und änderte sich die Wellenlänge je nach Ort. Weil die Karte weit vom Nullpunkt liegt,
// rückten die Kämme dadurch an vielen Stellen auf wenige Meter zusammen: das waren die Furchen wie auf einem Acker.)
function duneField(x, z, ang, lam, o) {
  const ca = Math.cos(ang), sa = Math.sin(ang), u = x * ca + z * sa, v = -x * sa + z * ca;
  const warp = fbm(x * 0.012 + 3 + o, z * 0.012 - 1 - o, 3) * 34 + fbm(x * 0.004 - o, z * 0.004 + 2, 2) * 40 + v * 0.06;
  const f = fract((u + warp) / lam); return f < 0.72 ? smooth(0, 1, f / 0.72) : 1 - smooth(0, 1, (f - 0.72) / 0.28);
}
function dunes(x, z) {
  const w = smooth(0.38, 0.62, fbm(x * 0.0017 + 2.2, z * 0.0017 - 1.4, 2));   // zwei Felder mit verschiedener Richtung, die ineinander übergehen
  const prof = (1 - w) * duneField(x, z, 0.6, 34, 0) + w * duneField(x, z, 1.9, 28, 17.3);
  const A = 1.0 + 5.2 * smooth(0.3, 0.78, fbm(x * 0.0055 - 4, z * 0.0055 + 6, 3));
  return A * prof;
}
/** Abstand (in Radien) zur Mitte des Abbruchs, mit unruhigem Rand */
export const abyE = (x, z) => Math.hypot((x - ABY.x) / ABY.rx, (z - ABY.z) / ABY.rz) + (fbm(x * 0.01 + 4.4, z * 0.01 - 2.2, 2) - 0.5) * 0.22;
/** Sandboden des Gebiets ohne die Sandrampen an den Felsen: rund 84 m tief, darauf hohe Dünen */
export function atlBase(x, z) {
  let h = -84 + (fbm(x * 0.0025 + 3, z * 0.0025 - 7, 3) - 0.5) * 12;
  const dc = Math.hypot(x - CITY.x, z - CITY.z) - CITY.r, flat = 1 - smooth(-10, 60, dc);
  h += dunes(x, z) * (1 - 0.8 * flat) - 4 * flat + (fbm(x * 0.045, z * 0.045, 2) - 0.5) * (1.2 - 0.7 * flat);
  const e = abyE(x, z);
  if (e < 1.25) { const k = 1 - smooth(0.8, 1.02, e), kt = k * 0.35 + 0.65 * terr(k, 4), fl = ABY.floor + (fbm(x * 0.012 - 3, z * 0.012 + 8, 3) - 0.5) * 18; h += (fl - h) * kt; }
  return h;
}

// ---------- Anordnung des Felses ----------
let OLD = null;   // Boden außerhalb des Gebiets (terrain.js setzt ihn), für den Übergang
export function atlSetOld(fn) { OLD = fn; }
/** Boden ohne Sandrampen, so wie er im Spiel liegt (im Übergang gemischt) */
function groundNR(x, z) { const k = atlK(x, z); if (k >= 1 || !OLD) return atlBase(x, z); return OLD(x, z) + (atlBase(x, z) - OLD(x, z)) * k; }
/** wie stark es hier felsig ist: Ebenen (unter 0,4), Säulengruppen, Säulenwände (über 0,5) */
export function massAt(x, z) {
  const wx = x + (fbm(x * 0.003 + 5.2, z * 0.003 - 3.1, 2) - 0.5) * 180, wz = z + (fbm(x * 0.003 - 9.4, z * 0.003 + 4.6, 2) - 0.5) * 180;
  let m = fbm(wx * 0.0038 + 11.3, wz * 0.0038 - 5.7, 3);
  const dc = Math.hypot(x - CITY.x, z - CITY.z) - CITY.r; if (dc > 8 && dc < 80) { const a = Math.atan2(z - CITY.z, x - CITY.x), gap = Math.min(...[-0.8, -2.3, 0.9].map((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))))); m = Math.max(m, 0.62 * smooth(0.22, 0.4, gap) * (1 - smooth(55, 80, dc))); }
  return m;
}
/** gewundene Schluchten durch das Felsland: 0 in der Mitte einer Schlucht */
export function canyonAt(x, z) {
  const wx = x + (fbm(x * 0.005 + 1.1, z * 0.005 + 7.7, 2) - 0.5) * 110, wz = z + (fbm(x * 0.005 - 6.6, z * 0.005 - 2.4, 2) - 0.5) * 110;
  return Math.abs(fbm(wx * 0.0062 + 40.5, wz * 0.0062 + 17.3, 2) - 0.5) / (0.07 + 0.05 * noise(x * 0.004 + 3.3, z * 0.004 + 1.9));
}
/** 0 bis 1: hier ragen manche Türme bis fast an die Oberfläche (dann muss man außen herum oder durch ein Felstor) */
export function towerK(x, z) { return smooth(0.55, 0.67, fbm(x * 0.0032 + 71.3, z * 0.0032 - 13.9, 2)); }
const CELL = 40, CC = new Map(), hk = (i, j) => ((Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0) || 7;
function cellAt(ci, cj) {
  const key = ci * 65536 + cj; let c = CC.get(key); if (c) return c;
  c = genCell(ci, cj); CC.set(key, c); if (CC.size > 5000) CC.delete(CC.keys().next().value); return c;
}
const TOPMAX = -14;   // so hoch reichen Säulen, über die man noch hinwegfahren kann; Türme gehen bis -3
function genCell(ci, cj) {
  const out = { B: [], T: [] }, x0 = ci * CELL, z0 = cj * CELL, cx = x0 + CELL / 2, cz = z0 + CELL / 2;
  if (cx > -360) return out;
  const k = atlK(cx, cz); if (k < 0.3) return out;
  const R = rng(hk(ci + 1201, cj - 377)), rr = (a, b) => a + R() * (b - a), hs = smooth(0.3, 0.85, k), tk = towerK(cx, cz) * hs;
  const blocked = (x, z, pad) => { if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 10 + pad || abyE(x, z) < 1.04 + pad / 250 || atlK(x, z) < 0.3) return true; for (const v of VENTS) if (Math.hypot(x - v.x, z - v.z) < 15 + pad) return true; return false; };
  // eine Grundform: Ellipse (rx, rz), Fuß im Sand, Kopf bei top
  const add = (x, z, rx, rz, top, o = {}) => {
    if (blocked(x, z, Math.max(rx, rz) * 0.6)) return null;
    const rot = o.rot ?? R() * TAU, y0 = groundNR(x, z) - 3; top = Math.min(top, -3); if (top < y0 + 5) top = y0 + 5;
    const b = { x, z, rx, rz, H: top - y0, y0, c: Math.cos(rot), s: Math.sin(rot), lx: (R() - 0.5) * (o.lean ?? 0.06), lz: (R() - 0.5) * (o.lean ?? 0.06),
      tp: o.tp ?? 0.1 + R() * 0.25, waist: o.waist ?? (R() < 0.3 ? 0.1 + R() * 0.15 : 0), wy: 0.35 + R() * 0.4, tx: (R() - 0.5) * (o.slant ?? 0.3), tz: (R() - 0.5) * (o.slant ?? 0.3), k: o.k ?? 2.6, p: o.p ?? 2.0 + R() * 1.2 };
    const mx = Math.max(rx, rz), mn = Math.min(rx, rz);
    b.rb = mx * 1.45 + (mx / mn) * (b.k + 3) + (Math.abs(b.lx) + Math.abs(b.lz)) * b.H + 3; out.B.push(b); return b;
  };
  // Höhe eines Kopfes: weit gestreut; in Turmgebieten manchmal bis knapp unter die Oberfläche
  const topOf = (x, z, hMin, hMax, tower) => { const g = groundNR(x, z); if (tower) return -3 - rr(0, 2.5); return Math.min(g + rr(hMin, hMax) * (0.6 + 0.4 * hs), TOPMAX - rr(0, 6)); };
  const feet = (b) => { if (!b || R() > 0.3) return; const n = 1 + Math.floor(R() * 2); for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.max(b.rx, b.rz) * rr(1.05, 1.5), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, s = rr(1.1, 2.6); add(x, z, s * rr(1, 1.5), s, groundNR(x, z) + s * rr(0.6, 1.3), { tp: 0.3, slant: 0.8, k: 1.0, p: 2 }); } };
  const pr = () => { const q = R(); return q < 0.22 ? rr(1.5, 2.6) : q < 0.9 ? rr(2.8, 5.4) : rr(6, 8.5); };   // dünn, normal, dick
  // eine Wand aus Säulen: niedriger Sockel, darauf Säulen nebeneinander, jede anders hoch (Bryce-Canyon-Wand)
  const wall = (px, pz, dir, L) => {
    const ca = Math.cos(dir), sa = Math.sin(dir), seed = R() * 50;
    add(px, pz, L * 0.5, rr(3.5, 5.5), groundNR(px, pz) + rr(7, 20), { rot: dir, tp: 0.25, slant: 0.4, k: 3, p: rr(2.2, 3), waist: 0 });
    const n = Math.max(2, Math.floor(L / rr(3.6, 5.2)));
    for (let i = 0; i < n; i++) {
      const t = (i / Math.max(1, n - 1) - 0.5) * L, off = rr(-1.6, 1.6), x = px + ca * t - sa * off, z = pz + sa * t + ca * off; if (canyonAt(x, z) < 0.4) continue;
      const r = pr(), hn = 0.5 + 0.5 * Math.sin(t * 0.17 + seed) * Math.cos(t * 0.07 + seed * 1.3), tower = tk > 0.4 && R() < 0.2 * tk;
      feet(add(x, z, r * rr(1, 1.35), r, topOf(x, z, 18 + 30 * hn, 34 + 34 * hn, tower), { tp: rr(0.08, 0.3), k: rr(2.2, 3.2), lean: 0.05 }));
    }
  };
  // eine Gruppe aus Säulen, unten verwachsen
  const cluster = (px, pz, n, rad, hMin, hMax) => {
    add(px, pz, rad * rr(0.7, 1.0), rad * rr(0.5, 0.8), groundNR(px, pz) + rr(5, 14), { tp: 0.3, slant: 0.5, k: 3, waist: 0 });
    for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * rad, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, r = pr(), tower = tk > 0.4 && R() < 0.3 * tk; feet(add(x, z, r * rr(1, 1.3), r, topOf(x, z, hMin, hMax, tower), { tp: rr(0.08, 0.32), k: rr(2.2, 3.2), lean: 0.06 })); }
  };
  const pt = () => [x0 + R() * CELL, z0 + R() * CELL];
  const along = (x, z) => { const e = 2, gx = canyonAt(x + e, z) - canyonAt(x - e, z), gz = canyonAt(x, z + e) - canyonAt(x, z - e); return Math.atan2(gx, -gz) + (R() - 0.5) * 0.6; };   // entlang der Schlucht
  const m = massAt(cx, cz) + (k < 0.6 ? -0.06 : 0);
  if (m > 0.5) {   // Säulenwände in Reihen, zwischen ihnen Gassen; die Schluchten bleiben frei
    for (let i = 0; i < 3; i++) { const p = pt(); if (canyonAt(p[0], p[1]) < 0.55) continue; wall(p[0], p[1], along(p[0], p[1]), rr(18, 36) * (0.7 + 0.3 * hs)); }
    if (R() < 0.5) { const p = pt(); if (canyonAt(p[0], p[1]) > 0.5) cluster(p[0], p[1], 3 + Math.floor(R() * 4), rr(5, 9), 20, 62); }
  } else if (m > 0.4) {   // einzelne Säulengruppen, mal eng, mal locker
    for (let i = 0; i < 1 + (R() < 0.6 ? 1 : 0); i++) { const p = pt(); if (canyonAt(p[0], p[1]) < 0.35) continue; if (R() < 0.35) wall(p[0], p[1], along(p[0], p[1]), rr(10, 20)); else cluster(p[0], p[1], 3 + Math.floor(R() * 5), rr(4, 9), 14, 56); }
  } else {   // Ebene: Dünen, ab und zu eine kleine Gruppe oder eine Felsplatte
    if (R() < 0.3) { const p = pt(); cluster(p[0], p[1], 1 + Math.floor(R() * 3), rr(2, 5), 10, 40); }
    if (R() < 0.3) { const p = pt(), s = rr(3, 7); add(p[0], p[1], s, s * rr(0.5, 0.8), groundNR(p[0], p[1]) + rr(1.5, 4), { tp: 0.5, slant: 0.6, k: 1.5 }); }
  }
  // seltene Landmarken: eine schlanke Nadel bis an die Oberfläche
  if (R() < 0.016 * hs && m > 0.4) { const p = pt(), r = rr(3.5, 5); feet(add(p[0], p[1], r * 1.2, r, -3, { tp: 0.5, lean: 0.03, waist: 0.15, k: 3 })); }
  // Bogen unten: eine Rippe, aus der eine Öffnung gewaschen ist
  if (R() < 0.045 * hs && m > 0.43) {
    const p = pt(), rot = R() * TAU, ca = Math.cos(rot), sa = Math.sin(rot), a = rr(6, 9), b = rr(15, 24), gy = groundNR(p[0], p[1]);
    if (!blocked(p[0], p[1], 22)) {
      for (const [dx, r, h] of [[-13, 6, 28], [0, 8, 36], [13, 7.5, 33], [25, 6, 26]]) add(p[0] + ca * dx, p[1] + sa * dx, r, 5 + a * 0.12, Math.min(TOPMAX, Math.max(gy + b + 10, gy + h * rr(0.9, 1.3))), { rot, tp: 0.12, lean: 0.03, waist: 0, slant: 0.2, k: 5 });
      out.T.push({ x: p[0] - ca, z: p[1] - sa, ux: -sa, uz: ca, yb: gy - 1.5, a, b, len: 14, wob: 1.3 });
    }
  }
  // Felstor oben: eine Wand bis an die Oberfläche, in halber Höhe ein Fenster zum Durchfahren
  if (R() < 0.05 * tk && m > 0.43) {
    const p = pt(), rot = R() * TAU, ca = Math.cos(rot), sa = Math.sin(rot), a = rr(6, 8.5), b = rr(14, 19), yb = -12 - b - rr(0, 6);
    if (!blocked(p[0], p[1], 22)) {
      for (const [dx, r] of [[-14, 6.5], [0, 8], [14, 7], [26, 6]]) add(p[0] + ca * dx, p[1] + sa * dx, r, 5 + a * 0.12, -3 - rr(0, 2), { rot, tp: 0.1, lean: 0.02, waist: 0, slant: 0.1, k: 5 });
      out.T.push({ x: p[0] - ca, z: p[1] - sa, ux: -sa, uz: ca, yb, a, b, len: 14, wob: 1.2 });
    }
  }
  // Höhle: ein Gang in einen dicken Felsen hinein, der nach hinten enger wird (hoch und breit genug, dass das Boot darin wenden kann)
  if (R() < 0.06 * hs && m > 0.5) {
    const big = out.B.filter((b) => Math.min(b.rx, b.rz) > 3.4 && b.H > 26)[0];
    if (big) { const th = R() * TAU, ux = Math.cos(th), uz = Math.sin(th), r = Math.max(big.rx, big.rz), ex = big.x - ux * r * 1.05, ez = big.z - uz * r * 1.05;
      out.T.push({ x: ex, z: ez, ux, uz, yb: groundNR(ex, ez) - 1.2, a: rr(5.5, 7), b: rr(12, 16), len: r * 2.2, wob: 0.8, cave: true }); }
  }
  // warme Spalte: dunkle Nadeln im Kreis
  for (const v of VENTS) if (Math.floor(v.x / CELL) === ci && Math.floor(v.z / CELL) === cj) {
    const n = 6 + Math.floor(R() * 2), a0 = R() * TAU, gy = groundNR(v.x, v.z);
    for (let i = 1; i < n; i++) { const a = a0 + (i / n) * TAU + rr(-0.2, 0.2), d = rr(7, 10), x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d, r = rr(2.4, 3.8), y0 = groundNR(x, z) - 3, H = gy + rr(16, 32) - y0;
      out.B.push({ x, z, rx: r, rz: r * 0.85, H, y0, c: 1, s: 0, lx: -Math.cos(a) * 0.1, lz: -Math.sin(a) * 0.1, tp: 0.7, waist: 0, wy: 0.5, tx: 0, tz: 0, k: 2, p: 2.2, rb: r * 1.45 + 1.2 * 5 + 0.2 * H + 3 }); }
  }
  return out;
}

// ---------- Abfragen: Feld in einem Rechteck ----------
const G = 8;
/** sammelt alle Formen, die in das Rechteck reichen, in einem feinen Raster (für schnelle Abfragen) */
export function localSet(x0, z0, x1, z1) {
  const M = 80, B = [], RB = [], TN = [], seen = new Set();
  for (let i = Math.floor((x0 - M) / CELL); i <= Math.floor((x1 + M) / CELL); i++) for (let j = Math.floor((z0 - M) / CELL); j <= Math.floor((z1 + M) / CELL); j++) {
    const c = cellAt(i, j);
    for (const b of c.B) { if (seen.has(b)) continue; seen.add(b); if (b.x + b.rb > x0 && b.x - b.rb < x1 && b.z + b.rb > z0 && b.z - b.rb < z1) B.push(b); const r = reach(b); if (b.x + r > x0 && b.x - r < x1 && b.z + r > z0 && b.z - r < z1) RB.push(b); }
    for (const t of c.T) if (Math.abs(t.x - (x0 + x1) / 2) < (x1 - x0) / 2 + t.len + t.a * 3 + 6 && Math.abs(t.z - (z0 + z1) / 2) < (z1 - z0) / 2 + t.len + t.a * 3 + 6) TN.push(t);
  }
  const nx = Math.max(1, Math.ceil((x1 - x0) / G)), nz = Math.max(1, Math.ceil((z1 - z0) / G)), grid = new Array(nx * nz), rgrid = new Array(nx * nz);
  let maxTop = -1e9, minY = 1e9;
  const ins = (gr, b, r) => { for (let i = Math.max(0, Math.floor((b.x - r - x0) / G)); i <= Math.min(nx - 1, Math.floor((b.x + r - x0) / G)); i++)
    for (let j = Math.max(0, Math.floor((b.z - r - z0) / G)); j <= Math.min(nz - 1, Math.floor((b.z + r - z0) / G)); j++) (gr[j * nx + i] || (gr[j * nx + i] = [])).push(b); };
  for (const b of B) { maxTop = Math.max(maxTop, b.y0 + b.H + 4); minY = Math.min(minY, b.y0); ins(grid, b, b.rb); }
  for (const b of RB) ins(rgrid, b, reach(b));
  return { x0, z0, x1, z1, nx, nz, grid, rgrid, B, T: TN, maxTop, minY };
}
const EMPTY = [];
const rlistAt = (L, x, z) => { const i = Math.floor((x - L.x0) / G), j = Math.floor((z - L.z0) / G); if (i < 0 || j < 0 || i >= L.nx || j >= L.nz) return EMPTY; return L.rgrid[j * L.nx + i] || EMPTY; };
const listAt = (L, x, z) => { const i = Math.floor((x - L.x0) / G), j = Math.floor((z - L.z0) / G); if (i < 0 || j < 0 || i >= L.nx || j >= L.nz) return EMPTY; return L.grid[j * L.nx + i] || EMPTY; };

// 3D-Wertrauschen
function h3(i, j, k) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function n3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = h3(i, j, k), b = h3(i + 1, j, k), c = h3(i, j + 1, k), d = h3(i + 1, j + 1, k), e = h3(i, j, k + 1), f = h3(i + 1, j, k + 1), g = h3(i, j + 1, k + 1), h = h3(i + 1, j + 1, k + 1);
  const x1 = a + (b - a) * ux, x2 = c + (d - c) * ux, x3 = e + (f - e) * ux, x4 = g + (h - g) * ux, y1 = x1 + (x2 - x1) * uy, y2 = x3 + (x4 - x3) * uy;
  return y1 + (y2 - y1) * uz;
}
export { h3 };
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);
// Gesteinsbänke: jede hat einen etwas anderen Durchmesser, geht unten weich in die vorige über und hat oben eine flache Kehle (Wülste mit Dellen)
const BEDS = [], BY0 = -230, BSTEP = 0.05, BTAB = new Int32Array(Math.ceil(240 / BSTEP));
{ const Rb = rng(77); let y = BY0; while (y < BY0 + 245) { const t = 3.0 * (0.45 + Rb() * 1.4); BEDS.push({ y0: y, t, m: 0.85 + Rb() * 0.23 }); y += t; }
  let b = 0; for (let k = 0; k < BTAB.length; k++) { const yy = BY0 + k * BSTEP; while (b < BEDS.length - 1 && yy >= BEDS[b + 1].y0) b++; BTAB[k] = b; } }
function bedM(yy) {
  const k = Math.max(0, Math.min(BTAB.length - 1, Math.floor((yy - BY0) / BSTEP))), i = BTAB[k], b = BEDS[i], f = (yy - b.y0) / b.t, prev = i ? BEDS[i - 1].m : b.m;
  return (prev + (b.m - prev) * smooth(0, 0.14, f)) * (1 - 0.1 * smooth(0.72, 1, f));
}

/** Abstandsfunktion des Felses im Rechteck L: negativ innen */
export function sdfL(L, x, y, z) {
  if (y > L.maxTop) return y - L.maxTop + 2;
  const list = listAt(L, x, z); if (!list.length) return 8;
  let q = 99; for (const b of list) { const dx = x - b.x, dz = z - b.z; q = Math.min(q, Math.hypot(dx, dz) - Math.max(b.rx, b.rz) * 1.35 - Math.abs(y - b.y0) * 0.15 - (y < b.y0 ? 0 : (Math.abs(b.lx) + Math.abs(b.lz)) * (y - b.y0))); }
  if (q > 7) return q - 2;
  const wx = x + (n3(x * 0.07, y * 0.05, z * 0.07) - 0.5) * 5, wz = z + (n3(x * 0.07 + 31, y * 0.05, z * 0.07 + 7) - 0.5) * 5, yw = y + (n3(x * 0.022, 3.1, z * 0.022) - 0.5) * 3.5;
  const lay = (noise(yw * 0.75, 5.3) - 0.5) * 0.25, bm = bedM(yw);
  let d = 99;
  for (const b of list) {
    if (y > b.y0 + b.H + 2.5) continue; const t = (y - b.y0) / b.H;
    const cx = b.x + b.lx * (y - b.y0), cz = b.z + b.lz * (y - b.y0), dx = wx - cx, dz = wz - cz, u = dx * b.c + dz * b.s, v = -dx * b.s + dz * b.c;
    const tc = t < 0 ? 0 : t > 1 ? 1 : t, fl = t < 0.16 ? 0.34 * (1 - Math.max(0, t) / 0.16) ** 2 : 0, sc = 1 - b.tp * tc - b.waist * Math.exp(-(((tc - b.wy) * 6) ** 2)) + fl, rx = b.rx * sc, rz = b.rz * sc;
    const e = Math.pow(Math.pow(Math.abs(u / rx), b.p) + Math.pow(Math.abs(v / rz), b.p), 1 / b.p), d2 = (e - bm) * Math.min(rx, rz) - lay;
    d = smin(d, smax(d2, y - (b.y0 + b.H + b.tx * u + b.tz * v), 1.2), b.k);
  }
  d += (n3(x * 0.23, y * 0.09, z * 0.23) - 0.5) * 0.8 + (n3(x * 0.6, y * 0.3, z * 0.6) - 0.5) * 0.25;
  for (const tn of L.T) {   // ausgewaschene Öffnungen: unten breiter, Ränder unruhig
    const dx = x - tn.x, dz = z - tn.z, al = dx * tn.ux + dz * tn.uz, lat = -dx * tn.uz + dz * tn.ux;
    if (Math.abs(lat) > tn.a * 2.5 || y < tn.yb - 3 || y > tn.yb + tn.b + 4 || al < -tn.len - 6 || al > tn.len + 6) continue;
    const hy = (y - tn.yb) / tn.b, hyc = hy < 0 ? 0 : hy > 1 ? 1 : hy, wn = (n3(x * 0.3, y * 0.3, z * 0.3) - 0.5) * tn.wob * 2; let dt;
    if (tn.cave) { const sw = 1 - Math.max(0, Math.min(1, al / tn.len)) * 0.55; dt = (Math.hypot(lat / (tn.a * sw), Math.max(hy, 0)) - 1) * Math.min(tn.a, tn.b) * sw + wn - lay * 0.7; dt = Math.max(dt, al - tn.len, -al - 4); }
    else { const aw = tn.a * (1 + 0.28 * (1 - hyc)); dt = (Math.hypot(lat / aw, Math.max(hy, 0)) - 1) * Math.min(aw, tn.b) + wn - lay * 0.7; dt = Math.max(dt, Math.abs(al) - tn.len); }
    d = smax(d, -dt, 1.2);
  }
  return d;
}
/** grober Abstand zum Fels am Fuß (ohne Rauschen), für Sandrampen, Pflanzen und Kamera */
// Für die Abfragen am Boden zählen nur Formen, deren Reichweite (rb) die Stelle umfasst; so liefern Raster und Zellen genau dasselbe
const d2D = (b, x, z, d) => { const dx = x - b.x, dz = z - b.z; if (dx > b.rb || dx < -b.rb || dz > b.rb || dz < -b.rb) return d; const u = dx * b.c + dz * b.s, v = -dx * b.s + dz * b.c, e = Math.hypot(u / b.rx, v / b.rz), r = (e - 1) * Math.min(b.rx, b.rz); return r < d ? r : d; };
const t2D = (b, x, z, t) => { const dx = x - b.x, dz = z - b.z, u = dx * b.c + dz * b.s, v = -dx * b.s + dz * b.c; return (u / b.rx) ** 2 + (v / b.rz) ** 2 < 0.8 && b.y0 + b.H > t ? b.y0 + b.H : t; };
// Sand weht an jedem Felsen hoch: an großen Felsen meterhoch, an dünnen Säulen nur ein kleiner Kegel; davor eine lange, flache Schürze
const reach = (b) => Math.max(b.rx, b.rz) + 20 + 2 * Math.min(b.rx, b.rz);
const rampB = (b, x, z, h) => { const dx = x - b.x, dz = z - b.z, R = reach(b); if (dx > R || dx < -R || dz > R || dz < -R) return h; const u = dx * b.c + dz * b.s, v = -dx * b.s + dz * b.c, sz = Math.min(b.rx, b.rz), d = (Math.hypot(u / b.rx, v / b.rz) - 1) * sz;
  const hR = Math.min(10, 1.3 * sz + 1.5, b.H * 0.4), r = hR * (1 - smooth(-2, 4 + sz * 1.3, d)) + 0.35 * hR * (1 - smooth(3, 18 + sz * 2, d)); return r > h ? r : h; };
function cells5(x, z, fn) { const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) fn(cellAt(ci + i, cj + j)); }
export function rock2DL(L, x, z) { let d = 99; for (const b of listAt(L, x, z)) d = d2D(b, x, z, d); return d; }
/** grobe Oberkante des Felses (für den Sonartisch), -1e9 wenn hier keiner steht */
export function topL(L, x, z) { let t = -1e9; for (const b of listAt(L, x, z)) t = t2D(b, x, z, t); return t; }
// Öffnungen (Bögen, Höhlen): auf ihrer ganzen Länge keine Sandrampe, und der Sand liegt nicht höher als ihr Boden.
// Sonst hob der Boden das Boot in der Höhle gegen die Decke, und man kam nicht mehr heraus.
function tunnelFloor(x, z, g, h) {
  let k = 0, lim = 1e9;
  const one = (tn) => {
    const dx = x - tn.x, dz = z - tn.z, al = dx * tn.ux + dz * tn.uz, lat = Math.abs(-dx * tn.uz + dz * tn.ux);
    const a0 = tn.cave ? -12 : -tn.len, a1 = tn.len, out = al < a0 ? a0 - al : al > a1 ? al - a1 : 0; if (out > 8) return;
    const wdt = tn.cave ? tn.a * (1 - Math.max(0, Math.min(1, al / tn.len)) * 0.55) : tn.a * 1.28;
    if (lat > wdt + 7) return; const kk = (1 - smooth(wdt + 1, wdt + 7, lat)) * (1 - smooth(1, 8, out)); if (kk > k) k = kk;
    if (kk > 0.001) lim = Math.min(lim, tn.yb + 0.6 + (1 - kk) * 30);
  };
  const L = peek(x, z); if (L) { for (const tn of L.T) one(tn); } else cells5(x, z, (c) => { for (const tn of c.T) one(tn); });
  return Math.min(g + h * (1 - k), lim);
}

// ---------- Abfragen von überall (mit kleinem Zwischenspeicher je 64-m-Kachel) ----------
const TS = 64, TC = new Map();
export function tileSet(ix, iz) {
  const key = ix * 65536 + iz; let L = TC.get(key);
  if (!L) { L = localSet(ix * TS - 8, iz * TS - 8, ix * TS + TS + 8, iz * TS + TS + 8); TC.set(key, L); if (TC.size > 48) TC.delete(TC.keys().next().value); }
  return L;
}
const setAt = (x, z) => tileSet(Math.floor(x / TS), Math.floor(z / TS)), peek = (x, z) => TC.get(Math.floor(x / TS) * 65536 + Math.floor(z / TS));
/** Abstand zum Fels (negativ innen); weit weg vom Gebiet einfach groß */
export function rockSDF(x, y, z) { if (x > -360) return 1e3; return sdfL(setAt(x, z), x, y, z); }
// Bodenabfragen: im Raster, wenn es für die Kachel schon da ist, sonst direkt aus den Zellen (der Sonartisch fragt weit verstreut)
export function rock2D(x, z) { if (x > -360) return 1e3; const L = peek(x, z); if (L) return rock2DL(L, x, z); let d = 99; cells5(x, z, (c) => { for (const b of c.B) d = d2D(b, x, z, d); }); return d; }
export function rockTop(x, z) { if (x > -360) return -1e9; const L = peek(x, z); if (L) return topL(L, x, z); let t = -1e9; cells5(x, z, (c) => { for (const b of c.B) t = t2D(b, x, z, t); }); return t; }
/** Sandboden mit den Rampen, die sich an jedem Felsen aufwehen */
export function atlFloor(x, z) {
  const g = atlBase(x, z); if (x > -360) return g;
  let h = 0; const L = peek(x, z); if (L) { for (const b of rlistAt(L, x, z)) h = rampB(b, x, z, h); } else cells5(x, z, (c) => { for (const b of c.B) h = rampB(b, x, z, h); });
  return tunnelFloor(x, z, g, h);
}
/** hat diese 64-m-Kachel Fels? */
export function tileHasRock(ix, iz) { if (ix * TS > -360) return false; return tileSet(ix, iz).B.length > 0; }

// ---------- Bewuchs: wo Tangwälder stehen ----------
/** 0 bis 1: Dichte des Tangwalds. Vor allem auf offenen Flächen; im engen Felsland zwischen den Säulenwänden nur selten */
export function forestK(x, z) {
  const open = 1 - smooth(0.4, 0.52, massAt(x, z)), f = fbm(x * 0.0065 + 5.1, z * 0.0065 - 2.3, 3);
  return smooth(0.5 - 0.08 * open, 0.62 - 0.08 * open, f) * (0.15 + 0.85 * open) * (1 - smooth(-20, 10, CITY.r - Math.hypot(x - CITY.x, z - CITY.z)) * 0.85);
}
/** schmale Sandwege durch den Wald */
export function pathK(x, z) { return 1 - smooth(0.012, 0.03, Math.abs(fbm(x * 0.011 + 9.3, z * 0.011 - 0.7, 2) - 0.5)); }
