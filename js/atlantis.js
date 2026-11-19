// atlantis.js – das Atlantis-Biom im Westen, ohne Grafik (läuft auch in Workern):
// wo das Gebiet liegt (atlK), wie der Sandboden aussieht (Dünen, Becken der Stadt, Abbruch zur südlichen Tiefsee)
// und wo der Fels steht. Der Fels ist ein Volumenfeld (Abstandsfunktion) aus vielen verformten Grundformen:
// Tafelberge mit flachen Köpfen, gestufte Pfeiler, Nadeln, Rippen mit Bögen, Höhlen. Alles entsteht Zelle für Zelle
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
export const ABY = { x: -905, z: -930, rx: 290, rz: 300, floor: -205 };
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
function dunes(x, z) {
  const ang = 0.6 + (fbm(x * 0.0017 + 2.2, z * 0.0017 - 1.4, 2) - 0.5) * 1.6, ca = Math.cos(ang), sa = Math.sin(ang), u = x * ca + z * sa, v = -x * sa + z * ca;
  const warp = fbm(x * 0.016 + 3, z * 0.016 - 1, 3) * 26 + v * 0.05, lam = 20 + 12 * fbm(x * 0.006 + 9, z * 0.006, 2);
  const f = fract((u + warp) / lam), prof = f < 0.7 ? smooth(0, 1, f / 0.7) : 1 - smooth(0, 1, (f - 0.7) / 0.3);
  const f2 = fract((u * 0.6 - v * 0.8 + warp * 0.6) / 8.5), prof2 = f2 < 0.65 ? smooth(0, 1, f2 / 0.65) : 1 - smooth(0, 1, (f2 - 0.65) / 0.35);
  const A = 0.5 + 3.2 * smooth(0.35, 0.8, fbm(x * 0.006 - 4, z * 0.006 + 6, 3));
  return A * prof + A * 0.25 * prof2;
}
/** Abstand (in Radien) zur Mitte des Abbruchs, mit unruhigem Rand */
export const abyE = (x, z) => Math.hypot((x - ABY.x) / ABY.rx, (z - ABY.z) / ABY.rz) + (fbm(x * 0.01 + 4.4, z * 0.01 - 2.2, 2) - 0.5) * 0.22;
/** Sandboden des Gebiets ohne die Sandrampen an den Felsen */
export function atlBase(x, z) {
  let h = -51 + (fbm(x * 0.0025 + 3, z * 0.0025 - 7, 3) - 0.5) * 12;
  const dc = Math.hypot(x - CITY.x, z - CITY.z) - CITY.r, flat = 1 - smooth(-10, 60, dc);
  h += dunes(x, z) * (1 - 0.8 * flat) - 5 * flat + (fbm(x * 0.07, z * 0.07, 3) - 0.5) * (1.0 - 0.6 * flat);
  const e = abyE(x, z);
  if (e < 1.25) { const k = 1 - smooth(0.8, 1.02, e), kt = k * 0.35 + 0.65 * terr(k, 4), fl = ABY.floor + (fbm(x * 0.012 - 3, z * 0.012 + 8, 3) - 0.5) * 18; h += (fl - h) * kt; }
  return h;
}

// ---------- Anordnung des Felses ----------
let OLD = null;   // Boden außerhalb des Gebiets (terrain.js setzt ihn), für den Übergang
export function atlSetOld(fn) { OLD = fn; }
/** Boden ohne Sandrampen, so wie er im Spiel liegt (im Übergang gemischt) */
function groundNR(x, z) { const k = atlK(x, z); if (k >= 1 || !OLD) return atlBase(x, z); return OLD(x, z) + (atlBase(x, z) - OLD(x, z)) * k; }
/** wie stark es hier felsig ist: Ebenen (unter 0,4), Pfeilerfelder, Tafelberge (über 0,5) */
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
const CELL = 40, CC = new Map(), hk = (i, j) => ((Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0) || 7;
function cellAt(ci, cj) {
  const key = ci * 65536 + cj; let c = CC.get(key); if (c) return c;
  c = genCell(ci, cj); CC.set(key, c); if (CC.size > 5000) CC.delete(CC.keys().next().value); return c;
}
function genCell(ci, cj) {
  const out = { B: [], T: [] }, x0 = ci * CELL, z0 = cj * CELL, cx = x0 + CELL / 2, cz = z0 + CELL / 2;
  if (cx > -360) return out;
  const k = atlK(cx, cz); if (k < 0.3) return out;
  const R = rng(hk(ci + 1201, cj - 377)), rr = (a, b) => a + R() * (b - a), hs = smooth(0.3, 0.85, k);
  const blocked = (x, z, pad) => { if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 10 + pad || abyE(x, z) < 1.04 + pad / 250 || atlK(x, z) < 0.3) return true; for (const v of VENTS) if (Math.hypot(x - v.x, z - v.z) < 15 + pad) return true; return false; };
  const add = (x, z, rx, rz, top, o = {}) => {
    if (blocked(x, z, Math.max(rx, rz) * 0.6)) return null;
    const rot = o.rot ?? R() * TAU, y0 = groundNR(x, z) - 3; top = Math.min(top, -12); if (top < y0 + 5) top = y0 + 5;
    const b = { x, z, rx, rz, H: top - y0, y0, c: Math.cos(rot), s: Math.sin(rot), lx: (R() - 0.5) * (o.lean ?? 0.12), lz: (R() - 0.5) * (o.lean ?? 0.12),
      tp: o.tp ?? 0.1 + R() * 0.3, waist: o.waist ?? (R() < 0.3 ? 0.12 + R() * 0.15 : 0), wy: 0.35 + R() * 0.4, tx: (R() - 0.5) * (o.slant ?? 0.35), tz: (R() - 0.5) * (o.slant ?? 0.35), k: o.k ?? 3.2, p: o.p ?? 2.2 + R() * 2.2 };
    b.rb = Math.max(rx, rz) * 1.4 + (Math.abs(b.lx) + Math.abs(b.lz)) * b.H + b.k * 2 + 8; out.B.push(b); return b;
  };
  const pt = () => [x0 + R() * CELL, z0 + R() * CELL];
  const feet = (b) => { if (!b || R() > 0.65) return; const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.max(b.rx, b.rz) * rr(1.0, 1.45), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, s = rr(1.1, 2.6); add(x, z, s * rr(1, 1.5), s, groundNR(x, z) + s * rr(0.6, 1.3), { tp: 0.3, slant: 0.8, k: 1.0, p: 2 }); } };
  const m = massAt(cx, cz) + (k < 0.6 ? -0.06 : 0);
  if (m > 0.5) {   // Tafelberge: breite Massen mit flachen Köpfen, an den Rändern Pfeiler
    const n = 3 + (R() < 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      let p = pt(), cv = canyonAt(p[0], p[1]); for (let t = 0; t < 5 && cv < 0.5; t++) { p = pt(); cv = canyonAt(p[0], p[1]); } if (cv < 0.5) continue;
      const big = smooth(0.53, 0.66, massAt(p[0], p[1])), r1 = rr(10, 17) * (0.7 + 0.3 * hs) * (0.5 + 0.5 * smooth(0.5, 1.5, cv));
      const b = add(p[0], p[1], r1, r1 * rr(0.6, 0.85), -17 - rr(0, 10) + big * 4 - (1 - hs) * 10, { tp: rr(0.04, 0.12), slant: 0.15, k: 6, p: rr(2.6, 4.2), waist: 0, lean: 0.06 }); feet(b);
      if (b) for (let j = Math.floor(R() * 3); j > 0; j--) { const a = R() * TAU, d = r1 * rr(0.8, 1.15), r = rr(3.5, 6.5); feet(add(b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, r * rr(1, 1.5), r, -14 - rr(0, 12) - (1 - hs) * 10, { tp: rr(0.15, 0.3), lean: 0.12, k: 3.5 })); }
    }
  } else if (m > 0.4) {   // Pfeilerfelder: Gruppen aus breiter Rippe und schlanken Pfeilern, mit Durchgängen
    const n = 1 + (R() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const p = pt(); if (canyonAt(p[0], p[1]) < 0.35) continue;
      const rot = R() * TAU, size = rr(5, 10) * (0.7 + 0.3 * hs);
      const base = add(p[0], p[1], size * rr(0.8, 1.3), size * rr(0.35, 0.6), groundNR(p[0], p[1]) + rr(6, 17) * (0.6 + 0.4 * hs), { rot, tp: rr(0.15, 0.35), slant: 0.5 }); feet(base);
      for (let j = 1 + Math.floor(R() * 3); j > 0; j--) { const a = rot + (R() - 0.5) * 2.4 + (R() < 0.5 ? Math.PI : 0), d = size * rr(0.25, 1.05), r = rr(3.2, 6.4); feet(add(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, r * rr(1, 1.6), r, -14 - rr(0, 18) - (1 - hs) * 8, { tp: rr(0.12, 0.37), lean: 0.15 })); }
    }
  } else {   // Ebene: Dünen, selten ein einzelner Pfeiler oder flache Felsplatten
    if (R() < 0.35) { const p = pt(), r = rr(3.5, 6); feet(add(p[0], p[1], r * rr(1, 1.4), r, -20 - rr(0, 16), { tp: rr(0.2, 0.4), lean: 0.18 })); if (R() < 0.5) add(p[0] + rr(-7, 7), p[1] + rr(-7, 7), r * 0.7, r * 0.6, -30 - rr(0, 10), { tp: 0.3 }); }
    if (R() < 0.35) { const p = pt(), s = rr(3, 7); add(p[0], p[1], s, s * rr(0.5, 0.8), groundNR(p[0], p[1]) + rr(1.5, 4), { tp: 0.5, slant: 0.6, k: 1.5 }); }
  }
  // seltene Landmarken: eine sehr hohe, schlanke Nadel
  if (R() < 0.014 * hs && m > 0.4) { const p = pt(), r = rr(4.5, 6.5); feet(add(p[0], p[1], r * 1.2, r, -10, { tp: 0.45, lean: 0.08, waist: 0.15, k: 4 })); }
  // Bogen: eine Rippe, aus der unten eine Öffnung gewaschen ist
  if (R() < 0.05 * hs && m > 0.43) {
    const p = pt(), rot = R() * TAU, ca = Math.cos(rot), sa = Math.sin(rot), a = rr(5, 7.5), b = rr(11, 17), gy = groundNR(p[0], p[1]);
    if (!blocked(p[0], p[1], 20)) {
      for (const [dx, r, top] of [[-11, 5.5, 20], [0, 7, 26], [11, 6.5, 24], [21, 5.5, 19]]) add(p[0] + ca * dx, p[1] + sa * dx, r, 4.4 + a * 0.12, Math.max(gy + b + 9, gy + top * rr(0.9, 1.25)), { rot, tp: 0.12, lean: 0.05, waist: 0, slant: 0.2, k: 5 });
      out.T.push({ x: p[0] - ca, z: p[1] - sa, ux: -sa, uz: ca, yb: gy - 1.5, a, b, len: 12, wob: 1.2 });
    }
  }
  // Höhle: ein Gang in einen großen Felsen hinein, der nach hinten enger wird
  if (R() < 0.06 * hs && m > 0.53) {
    const big = out.B.filter((b) => b.rx > 9 && b.H > 22)[0];
    if (big) { const th = R() * TAU, ux = Math.cos(th), uz = Math.sin(th), r = Math.min(big.rx, big.rz), ex = big.x - ux * r * 1.05, ez = big.z - uz * r * 1.05;
      out.T.push({ x: ex, z: ez, ux, uz, yb: groundNR(ex, ez) - 1.2, a: rr(3, 4.2), b: rr(6.5, 9), len: r * 1.6, wob: 0.8, cave: true }); }
  }
  // warme Spalte: dunkle Nadeln im Kreis
  for (const v of VENTS) if (Math.floor(v.x / CELL) === ci && Math.floor(v.z / CELL) === cj) {
    const n = 6 + Math.floor(R() * 2), a0 = R() * TAU, gy = groundNR(v.x, v.z);
    for (let i = 1; i < n; i++) { const a = a0 + (i / n) * TAU + rr(-0.2, 0.2), d = rr(7, 10), x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d, r = rr(2.4, 3.8), y0 = groundNR(x, z) - 3;
      out.B.push({ x, z, rx: r, rz: r * 0.85, H: gy + rr(14, 26) - y0, y0, c: 1, s: 0, lx: -Math.cos(a) * 0.12, lz: -Math.sin(a) * 0.12, tp: 0.7, waist: 0, wy: 0.5, tx: 0, tz: 0, k: 2, p: 2.2, rb: r * 1.4 + 0.12 * 30 + 12 }); }
  }
  return out;
}

// ---------- Abfragen: Feld in einem Rechteck ----------
const G = 8;
/** sammelt alle Formen, die in das Rechteck reichen, in einem feinen Raster (für schnelle Abfragen) */
export function localSet(x0, z0, x1, z1) {
  const M = 80, B = [], TN = [], seen = new Set();
  for (let i = Math.floor((x0 - M) / CELL); i <= Math.floor((x1 + M) / CELL); i++) for (let j = Math.floor((z0 - M) / CELL); j <= Math.floor((z1 + M) / CELL); j++) {
    const c = cellAt(i, j);
    for (const b of c.B) if (b.x + b.rb > x0 && b.x - b.rb < x1 && b.z + b.rb > z0 && b.z - b.rb < z1 && !seen.has(b)) { seen.add(b); B.push(b); }
    for (const t of c.T) if (Math.abs(t.x - (x0 + x1) / 2) < (x1 - x0) / 2 + t.len + t.a * 3 + 6 && Math.abs(t.z - (z0 + z1) / 2) < (z1 - z0) / 2 + t.len + t.a * 3 + 6) TN.push(t);
  }
  const nx = Math.max(1, Math.ceil((x1 - x0) / G)), nz = Math.max(1, Math.ceil((z1 - z0) / G)), grid = new Array(nx * nz);
  let maxTop = -1e9, minY = 1e9;
  for (const b of B) {
    maxTop = Math.max(maxTop, b.y0 + b.H + 4); minY = Math.min(minY, b.y0);
    for (let i = Math.max(0, Math.floor((b.x - b.rb - x0) / G)); i <= Math.min(nx - 1, Math.floor((b.x + b.rb - x0) / G)); i++)
      for (let j = Math.max(0, Math.floor((b.z - b.rb - z0) / G)); j <= Math.min(nz - 1, Math.floor((b.z + b.rb - z0) / G)); j++) (grid[j * nx + i] || (grid[j * nx + i] = [])).push(b);
  }
  return { x0, z0, x1, z1, nx, nz, grid, B, T: TN, maxTop, minY };
}
const EMPTY = [];
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
    const t = (y - b.y0) / b.H; if (t > 1.5) continue;
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
function cells5(x, z, fn) { const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL); for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) fn(cellAt(ci + i, cj + j)); }
export function rock2DL(L, x, z) { let d = 99; for (const b of listAt(L, x, z)) d = d2D(b, x, z, d); return d; }
/** grobe Oberkante des Felses (für den Sonartisch), -1e9 wenn hier keiner steht */
export function topL(L, x, z) { let t = -1e9; for (const b of listAt(L, x, z)) t = t2D(b, x, z, t); return t; }
function tunnelK(x, z) { let m = 1; cells5(x, z, (c) => { for (const tn of c.T) { const dd = Math.hypot(x - tn.x, z - tn.z); if (dd < tn.a * 3 + 8) m = Math.min(m, smooth(tn.a * 0.8, tn.a * 2.6 + 4, dd)); } }); return m; }

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
  const r = rock2D(x, z); if (r > 14) return g;
  return g + (2.4 * (1 - smooth(-1, 7, r)) + 0.8 * (1 - smooth(4, 14, r))) * tunnelK(x, z);
}
/** hat diese 64-m-Kachel Fels? */
export function tileHasRock(ix, iz) { if (ix * TS > -360) return false; return tileSet(ix, iz).B.length > 0; }

// ---------- Bewuchs: wo Tangwälder stehen ----------
/** 0 bis 1: Dichte des Tangwalds */
export function forestK(x, z) { return smooth(0.52, 0.64, fbm(x * 0.0065 + 5.1, z * 0.0065 - 2.3, 3)) * (1 - smooth(-20, 10, CITY.r - Math.hypot(x - CITY.x, z - CITY.z)) * 0.85); }
/** schmale Sandwege durch den Wald */
export function pathK(x, z) { return 1 - smooth(0.012, 0.03, Math.abs(fbm(x * 0.011 + 9.3, z * 0.011 - 0.7, 2) - 0.5)); }
