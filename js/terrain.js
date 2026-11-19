// terrain.js – die Höhenfunktion der ganzen Welt (ohne Grafik, damit sie überall nutzbar ist)
import { clamp, smooth, fbm, noise } from './util.js';
import { atlK, atlFloor, atlSetOld, rockTop } from './atlantis.js';

export const cxAt = (z) => Math.sin(z * 0.017) * 36 + Math.sin(z * 0.041 + 1.3) * 9;   // Mittellinie der Startschlucht
export const halfW = (z) => 27 + 7 * Math.sin(z * 0.031 + 2.0);
export const GROTTO = { x: 106, z: 60 };
export const WRECK = { x: -300, z: 236 };
export const BOUNDS = { r: 1500, top: -5, deep: -100 };
/** die ganze Welt liegt so viel tiefer als ursprünglich gebaut (die Formeln unten rechnen im alten Maß, abgezogen wird am Ende) */
export const SHIFT = 10;
// Schnee-Ebene: weite, fast leere Sandfläche, tiefer als alles andere; eine lange Rampe führt aus der Startschlucht hinab
export const PLAIN = { x: -310, z: -240, r: 92, floor: -102 };
export const WHALE = { x: -312, z: -238, yaw: 0.55 };
export const BELL = { x: -128, z: -174, yaw: 2.2 };
// das Loch im Boden einer Schlucht südöstlich der Glocke: eine flache Mulde, in der Mitte der Schacht (r = Öffnung, cut = so weit fehlt das Geländegitter)
/** Plateau an der Abgrundwand: Mitte, Richtung aus der Wand hinaus (dx, dz), Halbachsen a (hinaus) und b (entlang der Wand), Höhe */
export const PLAT = { x: -234.6, z: 543.5, dx: 0.906, dz: -0.423, a: 19, b: 24, y: -300 };
/** Kapitel 2: zweiter Absatz an der Westwand der Tiefsee, auf dem der tote Buckelwal zu liegen kommt */
export const PLAT2 = { x: -153, z: 1130, dx: 0.853, dz: 0.522, a: 26, b: 34, y: -322 };
export const HOLE = { x: 102, z: -318, r: 2.0, cut: 3.8 };
const plainR = (x, z) => { const dx = x - PLAIN.x, dz = z - PLAIN.z, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) / (PLAIN.r * (1 + 0.36 * (fbm(Math.cos(a) * 1.4 + 5.3, Math.sin(a) * 1.4 + 2.1, 2) - 0.5))); };
/** 1 mitten in der Ebene, 0 weit draußen (für Schnee, Bewuchs, Tiefengrenze) */
export const plainK = (x, z) => 1 - smooth(0.85, 1.35, Math.hypot(x - PLAIN.x, z - PLAIN.z) / PLAIN.r);
/** wie tief das Boot hier darf: über der Ebene etwas tiefer als sonst */
export const deepAt = (x, z) => BOUNDS.deep - 12 * plainK(x, z);
// von Hand gelegte Seitenarme: Punkte, halbe Breite, Breite am Ende, Tiefe
const VAL = [
  { p: [[34, 25], [106, 60]], w: 9, we: 19, e0: 0.72, d: 37 },                                        // zur Kristallgrotte
  { p: [[4, 44], [-70, 72], [-150, 104], [-226, 166], [-300, 236]], w: 13, we: 50, e0: 0.8, d: 45 },    // zum Wrack, endet in einer Senke
  { p: [[-22, -122], [-70, -146], [-128, -170], [-185, -192], [-240, -222]], w: 11, we: 26, e0: 0.7, d: 48, d1: 77 },   // Rampe hinab zur Schnee-Ebene
];
for (const v of VAL) { v.len = []; let L = 0; for (let i = 0; i < v.p.length - 1; i++) { const l = Math.hypot(v.p[i + 1][0] - v.p[i][0], v.p[i + 1][1] - v.p[i][1]); v.len.push(l); L += l; } v.L = L; }
const terr = (k, n) => { const t = k * n, f = Math.floor(t); return (f + smooth(0.2, 0.8, t - f)) / n; };
const vd = [0, 0];
function valDist(v, x, z) {
  let best = 1e9, bt = 0, acc = 0;
  for (let i = 0; i < v.p.length - 1; i++) {
    const a = v.p[i], b = v.p[i + 1], ax = b[0] - a[0], az = b[1] - a[1], t = clamp(((x - a[0]) * ax + (z - a[1]) * az) / (ax * ax + az * az), 0, 1), d = Math.hypot(x - a[0] - ax * t, z - a[1] - az * t);
    if (d < best) { best = d; bt = (acc + t * v.len[i]) / v.L; } acc += v.len[i];
  }
  vd[0] = best; vd[1] = bt;
}
const shelf0 = (x, z) => -10 - 10 * fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 3);
export const shelfH = (x, z) => shelf0(x, z) - SHIFT;
// die große Tiefsee nördlich der Startschlucht: ein Graben aus aneinandergereihten Becken (x, z, Radius), der am Ende der Schlucht beginnt
// und nach Norden in die Tiefsee am Kartenrand übergeht. Wände steil, mal mit Absätzen, mal glatter; unten ein weiter, unruhiger Grund in 300 bis 400 m
const ABYSS = [[-10, 330, 60], [60, 440, 200], [95, 570, 380], [100, 720, 420], [95, 900, 340], [140, 1060, 250], [300, 1110, 165], [40, 1230, 250], [-60, 1420, 300]];
const ABSEG = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7], [7, 8]];   // welche Becken ineinander übergehen (5 verzweigt zum Nordost-Becken 6 und nach Norden 7)
const ABX = [-500, 760, 60, 1800];   // grobe Box, außerhalb gibt es keine Tiefsee
/** Abstand zum Rand der großen Tiefsee (negativ = drinnen), mit unruhigem Rand */
export function abyssD(x, z) {
  if (x < ABX[0] || x > ABX[1] || z < ABX[2] || z > ABX[3]) return 1e3;
  let d = 1e9;
  for (const [i, j] of ABSEG) {
    const a = ABYSS[i], b = ABYSS[j], ax = b[0] - a[0], az = b[1] - a[1], t = clamp(((x - a[0]) * ax + (z - a[1]) * az) / (ax * ax + az * az), 0, 1);
    d = Math.min(d, Math.hypot(x - a[0] - ax * t, z - a[1] - az * t) - (a[2] + (b[2] - a[2]) * t));
  }
  return d + (fbm(x * 0.006 + 21.3, z * 0.006 - 4.4, 3) - 0.5) * 110 + (noise(x * 0.03 + 7, z * 0.03 + 2) - 0.5) * 14;
}
// Abstand zu allem von Hand Gebauten (Startschlucht und Seitenarme)
export function handDist(x, z) {
  let d = Math.abs(x - cxAt(clamp(z, -180, 330))); if (z < -180) d = Math.hypot(d, -180 - z); else if (z > 330) d = Math.hypot(d, z - 330);
  for (const v of VAL) { valDist(v, x, z); if (vd[0] < d) d = vd[0]; }
  return Math.min(d, Math.max(0, Math.hypot(x - PLAIN.x, z - PLAIN.z) - PLAIN.r));
}
const LEDGES = [PLAT, PLAT2];
function floorOld(x, z) {
  const shelf = shelf0(x, z), wob = fbm(x * 0.033 + 11, z * 0.033 + 5, 3) - 0.5;
  // Startschlucht mit Abgrund am Ende
  const zc = clamp(z, -260, 460), open = smooth(-170, -116, zc) * (1 - smooth(330, 430, zc)), dM = Math.abs(x - cxAt(zc));
  const w = halfW(zc) * (0.22 + 0.78 * open) * (1 + wob * 0.6);
  let k = 1 - smooth(w * 0.5, w * 1.2, dM); k = k * 0.3 + 0.7 * terr(k, 3);
  let depth = 50 * k * (0.15 + 0.85 * open) * smooth(-250, -185, z) * (1 - smooth(425, 460, z)), hand = z < -180 ? Math.hypot(dM, -180 - z) : z > 330 ? Math.hypot(dM, z - 330) : dM;
  const ab = smooth(84, 160, zc) * (1 - smooth(300, 400, zc));
  if (ab > 0) { const w2 = w * (1 + 1.7 * ab), k2 = 1 - smooth(w2 * 0.4, w2 * 1.1, dM); depth += 150 * ab * k2 * k2; }
  for (const v of VAL) {
    valDist(v, x, z); if (vd[0] < hand) hand = vd[0];
    if (vd[0] < 90) { const wb = (v.w + (v.we - v.w) * smooth(v.e0, 1, vd[1])) * (1 + wob * 0.5); let kb = 1 - smooth(wb * 0.55, wb * 1.3, vd[0]); kb = kb * 0.4 + 0.6 * terr(kb, 2); depth = Math.max(depth, (v.d1 ? v.d + (v.d1 - v.d) * smooth(0.05, 1, vd[1]) : v.d) * kb); }
  }
  // Schnee-Ebene: Wände in Stufen, unten ein fast ebener, sanft gewellter Sandboden
  const pr = plainR(x, z);
  if (pr < 1.6) { let k = 1 - smooth(0.78, 1.08, pr); k = k * 0.3 + 0.7 * terr(k, 3); const fl = PLAIN.floor + SHIFT + (fbm(x * 0.017 + 2.2, z * 0.017 - 7.1, 2) - 0.5) * 3.2 + Math.sin(x * 0.05 + z * 0.03) * 0.5; depth = Math.max(depth, (shelf - fl) * k); hand = Math.min(hand, Math.max(0, pr - 1) * PLAIN.r); }
  // das weite Netz aus Schluchten und tiefen Becken ringsum
  const m = smooth(70, 150, hand);
  if (m > 0) {
    const wx = x + (fbm(x * 0.003 + 5.2, z * 0.003 - 3.1, 2) - 0.5) * 240, wz = z + (fbm(x * 0.003 - 9.4, z * 0.003 + 4.6, 2) - 0.5) * 240;
    const v = Math.abs(fbm(wx * 0.0024 + 40.5, wz * 0.0024 + 17.3, 2) - 0.5), wid = 0.022 + 0.03 * noise(x * 0.0041 + 1.7, z * 0.0041 + 8.2);
    let kn = 1 - smooth(wid * 0.5, wid * 1.2, v); kn = kn * 0.3 + 0.7 * terr(kn, 3);
    let dn = 48 * kn * (0.75 + 0.5 * noise(x * 0.006 + 3, z * 0.006 + 9));
    const basin = smooth(0.61, 0.72, fbm(x * 0.0011 + 70.3, z * 0.0011 - 30.7, 2)); if (basin > 0) dn += 135 * terr(basin, 3);
    depth = Math.max(depth, dn * m);
  }
  // große Tiefsee: Wandbreite und Absätze wechseln, damit es mal steil, mal kurz flacher abfällt
  const ad = abyssD(x, z);
  if (ad < 140) {
    const wn = noise(x * 0.004 + 3.3, z * 0.004 - 8.1), W = 55 + 110 * wn, ledge = smooth(0.35, 0.75, noise(x * 0.007 - 2.2, z * 0.007 + 6.6));
    let ka = smooth(10, -W, ad); ka = ka * (1 - 0.6 * ledge) + terr(ka, 7) * 0.6 * ledge;   // bis 800 m: mehr Absätze, damit die hohen Wände nicht glatt gezogen wirken
    const fl = -785 - 35 * fbm(x * 0.0035 + 9.9, z * 0.0035 + 1.2, 3) + (fbm(x * 0.02 - 4, z * 0.02 + 3, 2) - 0.5) * 18;
    depth = Math.max(depth, (shelf - fl) * ka);
  }
  let h = shelf - depth + (fbm(x * 0.085, z * 0.085, 3) - 0.5) * 3.4 + (noise(x * 0.31, z * 0.31) - 0.5) * 0.7 - SHIFT;
  // Plateau bei 300 m an der Abgrundwand nahe dem Kristallhain: eine flache Kanzel, die sanft aus der Wand wächst
  for (const L of LEDGES) { const px = x - L.x, pz = z - L.z, R = Math.max(L.a, L.b) * 1.7; if (px * px + pz * pz < R * R) { const q = (px * L.dx + pz * L.dz) / L.a, w = (-px * L.dz + pz * L.dx) / L.b, rr = Math.hypot(q, w) * (1 + 0.14 * (noise(x * 0.09 + 4.1, z * 0.09 - 2.7) - 0.5));
    if (rr < 1) { const top = L.y - 1.2 * Math.max(0, q) + (fbm(x * 0.12, z * 0.12, 2) - 0.5) * 1.4, k = smooth(1, 0.86, rr); if (top > h) h += (top - h) * k; } } }
  const hx = x - HOLE.x, hz = z - HOLE.z; if (hx * hx + hz * hz < 400) { const d = Math.sqrt(hx * hx + hz * hz); h -= 3.0 * (1 - smooth(3, 17, d)); }   // Mulde um das Loch
  return h;
}
atlSetOld(floorOld);
/** Höhe des Meeresgrunds; im Westen geht die Welt in das Atlantis-Biom über (atlantis.js) */
export function floorH(x, z) {
  const k = atlK(x, z); if (k <= 0) return floorOld(x, z);
  const a = atlFloor(x, z); if (k >= 1) return a;
  const o = floorOld(x, z); return o + (a - o) * k;
}
/** Grund oder Oberkante des Felses darüber (für den Sonartisch: was ist fest?) */
export function solidH(x, z) { const h = floorH(x, z), t = rockTop(x, z); return t > h ? t : h; }
export function floorN(x, z, out) {
  const e = 1.2, dx = floorH(x + e, z) - floorH(x - e, z), dz = floorH(x, z + e) - floorH(x, z - e), l = Math.hypot(dx, 2 * e, dz);
  out.x = -dx / l; out.y = 2 * e / l; out.z = -dz / l; return out;
}
export const steep = (x, z) => Math.abs(floorH(x + 1.2, z) - floorH(x - 1.2, z)) + Math.abs(floorH(x, z + 1.2) - floorH(x, z - 1.2));
/** Höhe des gezeichneten Bodens: dieselben Dreiecke wie im Gelände-Gitter (Raster 1,6 m), damit Dinge genau aufliegen */
export function meshH(x, z) {
  const S = 1.6, gx = Math.floor(x / S), gz = Math.floor(z / S), u = x / S - gx, v = z / S - gz;
  const a = floorH(gx * S, gz * S), b = floorH((gx + 1) * S, gz * S), c = floorH(gx * S, (gz + 1) * S), d = floorH((gx + 1) * S, (gz + 1) * S);
  if (Math.abs(a - d) < Math.abs(b - c)) return u > v ? a + (b - a) * u + (d - b) * v : a + (c - a) * v + (d - c) * u;
  return u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
