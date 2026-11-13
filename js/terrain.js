// terrain.js – die Höhenfunktion der ganzen Welt (ohne Grafik, damit sie überall nutzbar ist)
import { clamp, smooth, fbm, noise } from './util.js';

export const cxAt = (z) => Math.sin(z * 0.017) * 36 + Math.sin(z * 0.041 + 1.3) * 9;   // Mittellinie der Startschlucht
export const halfW = (z) => 27 + 7 * Math.sin(z * 0.031 + 2.0);
export const GROTTO = { x: 106, z: 60 };
export const WRECK = { x: -300, z: 236 };
export const BOUNDS = { r: 1500, top: -5, deep: -90 };
// von Hand gelegte Seitenarme: Punkte, halbe Breite, Breite am Ende, Tiefe
const VAL = [
  { p: [[34, 25], [106, 60]], w: 9, we: 19, e0: 0.72, d: 37 },                                        // zur Kristallgrotte
  { p: [[4, 44], [-70, 72], [-150, 104], [-226, 166], [-300, 236]], w: 13, we: 50, e0: 0.8, d: 45 },    // zum Wrack, endet in einer Senke
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
export const shelfH = (x, z) => -10 - 10 * fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 3);
// Abstand zu allem von Hand Gebauten (Startschlucht und Seitenarme)
export function handDist(x, z) {
  let d = Math.abs(x - cxAt(clamp(z, -180, 330))); if (z < -180) d = Math.hypot(d, -180 - z); else if (z > 330) d = Math.hypot(d, z - 330);
  for (const v of VAL) { valDist(v, x, z); if (vd[0] < d) d = vd[0]; }
  return d;
}
export function floorH(x, z) {
  const shelf = shelfH(x, z), wob = fbm(x * 0.033 + 11, z * 0.033 + 5, 3) - 0.5;
  // Startschlucht mit Abgrund am Ende
  const zc = clamp(z, -260, 460), open = smooth(-170, -116, zc) * (1 - smooth(330, 430, zc)), dM = Math.abs(x - cxAt(zc));
  const w = halfW(zc) * (0.22 + 0.78 * open) * (1 + wob * 0.6);
  let k = 1 - smooth(w * 0.5, w * 1.2, dM); k = k * 0.3 + 0.7 * terr(k, 3);
  let depth = 50 * k * (0.15 + 0.85 * open) * smooth(-250, -185, z) * (1 - smooth(425, 460, z)), hand = z < -180 ? Math.hypot(dM, -180 - z) : z > 330 ? Math.hypot(dM, z - 330) : dM;
  const ab = smooth(84, 160, zc) * (1 - smooth(300, 400, zc));
  if (ab > 0) { const w2 = w * (1 + 1.7 * ab), k2 = 1 - smooth(w2 * 0.4, w2 * 1.1, dM); depth += 150 * ab * k2 * k2; }
  for (const v of VAL) {
    valDist(v, x, z); if (vd[0] < hand) hand = vd[0];
    if (vd[0] < 90) { const wb = (v.w + (v.we - v.w) * smooth(v.e0, 1, vd[1])) * (1 + wob * 0.5); let kb = 1 - smooth(wb * 0.55, wb * 1.3, vd[0]); kb = kb * 0.4 + 0.6 * terr(kb, 2); depth = Math.max(depth, v.d * kb); }
  }
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
  return shelf - depth + (fbm(x * 0.085, z * 0.085, 3) - 0.5) * 3.4 + (noise(x * 0.31, z * 0.31) - 0.5) * 0.7;
}
export function floorN(x, z, out) {
  const e = 1.2, dx = floorH(x + e, z) - floorH(x - e, z), dz = floorH(x, z + e) - floorH(x, z - e), l = Math.hypot(dx, 2 * e, dz);
  out.x = -dx / l; out.y = 2 * e / l; out.z = -dz / l; return out;
}
export const steep = (x, z) => Math.abs(floorH(x + 1.2, z) - floorH(x - 1.2, z)) + Math.abs(floorH(x, z + 1.2) - floorH(x, z - 1.2));
