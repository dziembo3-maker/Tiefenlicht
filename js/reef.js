// reef.js – Tiere des Atlantis-Bioms im Westen: Mantarochen, Stechrochen und sechs Rifffische (Falterfisch, blauer Barsch, Drachenkopf,
// rot gestreifter Lippfisch, Drückerfisch, Silberfisch). Oben die Modelle, unten createReefLife: wer wo schwimmt, liegt oder sich im Tang versteckt.
import { T } from './util.js';
import { uni, COMMON } from './gfx.js';
import { floorH } from './terrain.js';
import { atlK, forestK, rockSDF, rock2D, CITY } from './atlantis.js';
import { denseK } from './world.js';
const PI = Math.PI, TAU = PI * 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const zOf = (t) => 0.5 - t;
function hash(i) { let h = Math.imul(i + 17, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- Baukasten (wie bei den Tiefseefischen): alles sind Gitter; Normalen aus den Nachbarn, auf Wunsch nach außen gedreht ----------
class Build {
  constructor() { this.P = []; this.N = []; this.K = []; this.I = []; this.n = 0; }
  grid(nu, nv, pos, key, wrap, out) {
    const b = this.n, pts = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = pos(i, j); pts.push(p); this.P.push(p[0], p[1], p[2]); this.K.push(...key(i, j)); this.n++; }
    const at = (i, j) => { i = i < 0 ? 0 : i > nu ? nu : i; if (wrap) j = ((j % nv) + nv) % nv; else j = j < 0 ? 0 : j > nv ? nv : j; return pts[i * (nv + 1) + j]; };
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const a = at(i + 1, j), c = at(i - 1, j), d = at(i, j + 1), e = at(i, j - 1), p = pts[i * (nv + 1) + j];
      const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2], vx = d[0] - e[0], vy = d[1] - e[1], vz = d[2] - e[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) { if (out) { const o = out(i, j); nx = p[0] - o[0]; ny = p[1] - o[1]; nz = p[2] - o[2]; l = Math.hypot(nx, ny, nz) || 1; } else { nx = 0; ny = 1; nz = 0; l = 1; } }
      nx /= l; ny /= l; nz /= l;
      if (out) { const o = out(i, j); if ((p[0] - o[0]) * nx + (p[1] - o[1]) * ny + (p[2] - o[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; } }
      this.N.push(nx, ny, nz);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = b + i * (nv + 1) + j, c = a + nv + 1; this.I.push(a, c, a + 1, a + 1, c, c + 1); }
  }
  /** Röhre entlang einer Punktfolge; rad(s) Radius, key(s, a) Attribute; flat = Querschnitt in einer Richtung gestaucht */
  tube(pts, rad, sides, key, flat) {
    const n = pts.length - 1, F = frames(pts);
    this.grid(n, sides, (i, j) => { const a = j / sides * TAU, f = F[i], r = rad(i / n), fl = flat ? flat(i / n) : 1; return add(pts[i], add(f.n.map((x) => x * Math.cos(a) * fl), f.b, Math.sin(a)), r); },
      (i, j) => key(i / n, j / sides), true, (i) => pts[i]);
  }
  ellipsoid(c, rx, ry, rz, key, nu = 8, nv = 12) {
    this.grid(nu, nv, (i, j) => { const f = i / nu * PI, a = j / nv * TAU; return [c[0] + rx * Math.sin(f) * Math.cos(a), c[1] + ry * Math.cos(f), c[2] + rz * Math.sin(f) * Math.sin(a)]; },
      (i, j) => key(i / nu, j / nv), true, () => c);
  }
  geo() {
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('aK', new T.BufferAttribute(new Float32Array(this.K), 4)); g.setIndex(this.I); return g;
  }
}
function frames(pts) {
  const F = []; let nPrev = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = norm(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let n; if (!nPrev) { const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; n = norm(...cross(cross(t, up), t)); } else { const d = nPrev[0] * t[0] + nPrev[1] * t[1] + nPrev[2] * t[2]; n = norm(nPrev[0] - t[0] * d, nPrev[1] - t[1] * d, nPrev[2] - t[2] * d); }
    nPrev = n; F.push({ t, n, b: cross(t, n) });
  }
  return F;
}
// Körperform: Reihen [t (0 = vorn, 1 = hinten), halbe Höhe, halbe Breite, Mittelhöhe]; dazwischen kubisch, damit die Flanken ohne Knicke durchlaufen
function prof(rows, t) {
  const n = rows.length; let i = 0; while (i < n - 2 && t > rows[i + 1][0]) i++;
  const r0 = rows[i], r1 = rows[i + 1], dt = r1[0] - r0[0], s = cl((t - r0[0]) / dt, 0, 1), s2 = s * s, s3 = s2 * s;
  const tan = (k, c) => { const a = rows[Math.max(0, k - 1)], b = rows[Math.min(n - 1, k + 1)]; return (b[c] - a[c]) / (b[0] - a[0]); };
  const out = [0, 0, 0];
  for (let c = 1; c <= 3; c++) { const v = (2 * s3 - 3 * s2 + 1) * r0[c] + (s3 - 2 * s2 + s) * dt * tan(i, c) + (-2 * s3 + 3 * s2) * r1[c] + (s3 - s2) * dt * tan(i + 1, c); out[c - 1] = c < 3 ? Math.max(0.0012, Math.min(v, Math.max(r0[c], r1[c]) * 1.08)) : v; }
  return out;
}
/** Punkt auf der Körperoberfläche (t entlang, a rundherum: 0 = rechte Seite, π/2 = oben); o.ef(t) macht den Querschnitt eckiger (klein) oder runder (1) */
function surf(rows, o, t, a) {
  const e = o.ef ? o.ef(t) : o.e || 0.87, [h, w, yc] = prof(rows, t), ca = Math.cos(a), sa = Math.sin(a), r = o.bump ? o.bump(t, a) : 1;
  const tp = o.tip ? o.tip(t) : 1;   // runde Kappe vorn/hinten
  return [Math.sign(ca) * Math.pow(Math.abs(ca), e) * w * r * tp, yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h * r * tp * (sa < 0 && o.low ? o.low(t) : 1), zOf(t)];
}
/** Körper von t0 bis t1; aK = (t, 0, Umfang 0…1, Höhe auf der Flanke -1 Bauch … 1 Rücken) */
function body(B, rows, o, t0 = 0, t1 = 1) {
  const NT = o.NT, NA = o.NA, tt = (i) => t0 + (t1 - t0) * Math.pow(i / NT, o.tp || 1);
  B.grid(NT, NA, (i, j) => surf(rows, o, tt(i), j / NA * TAU), (i, j) => [tt(i), 0, j / NA, Math.sin(j / NA * TAU)], true,
    (i) => { const t = tt(i), [, , yc] = prof(rows, t); return [0, yc, zOf(t)]; });
  cap(B, rows, o, t0, 1); cap(B, rows, o, t1, -1);
}
/** runde Kappe auf das offene Ende des Körpers (sonst bleibt dort ein Loch); dir = +1 vorn, -1 hinten */
function cap(B, rows, o, t, dir) {
  const NA = o.NA, [h, w, yc] = prof(rows, t), L = Math.min(h, w) * (o.cap == null ? 0.5 : o.cap);
  B.grid(5, NA, (i, j) => { const f = i / 5 * PI / 2, p = surf(rows, o, t, j / NA * TAU); return [p[0] * Math.cos(f), yc + (p[1] - yc) * Math.cos(f), p[2] + dir * L * Math.sin(f)]; },
    (i, j) => [t, 0, j / NA, Math.sin(j / NA * TAU)], true, () => [0, yc, zOf(t) - dir * L]);
}
/** Flosse: Haut zwischen Wurzellinie root(u) = [x, y, z, t] und Rand; aK = (t der Wurzel, Teil, v Wurzel→Rand, u) */
function fin(B, nu, root, dir, len, part, nv = 6, curl) {
  B.grid(nu, nv, (i, j) => { const u = i / nu, v = j / nv, r = root(u), d = dir(u), L = len(u); const p = [r[0] + d[0] * L * v, r[1] + d[1] * L * v, r[2] + d[2] * L * v]; return curl ? add(p, curl(u, v)) : p; },
    (i, j) => [root(i / nu)[3], part, j / nv, i / nu], false);
}
/** gewölbtes Auge nach außen (sx = Seite); aK.z: 0 Mitte … 1 Rand */
function eye(B, c, sx, r, t, bulge, part = 4) {
  // geschlossene Kugel: vorn gewölbt, hinten tief in den Körper (sonst schaut der offene Rand als Loch heraus)
  B.grid(12, 24, (i, j) => { const f = i <= 8 ? i / 8 * PI / 2 : PI / 2 + (i - 8) / 4 * PI / 2, a = j / 24 * TAU, cf = Math.cos(f); return [c[0] + sx * r * (cf >= 0 ? bulge : 1.2) * cf, c[1] + r * Math.sin(f) * Math.cos(a), c[2] + r * Math.sin(f) * Math.sin(a)]; },
    (i, j) => [t, part, i / 8, j / 24], true, () => c);
}

// ======================= Riesenkalmar =======================
// Vorlage: langer spitzer Mantel mit rautenförmigem Flossensaum am Ende, kurzer Kopf mit großem blauem Auge, acht kräftige Arme,
// ======================= Rifffische: gemeinsamer Bau =======================
// Ein Fisch = Körper (Reihen), Auge, Flossen (Rücken, After, Brust, Bauch), Schwanz. Länge 1, Schnauze vorn bei z = +0,5.
// aK: Körper (t, 0, Umfang, Höhe auf der Flanke), Schwanz (t, 1, v, u), Rücken/After (t, 2, v, u), Brust/Bauch (t, 3, v, u), Auge (t, 4, …), Stacheln (t, 5, v, u)
const top = (rows, o, t) => surf(rows, o, t, PI / 2), bot = (rows, o, t) => surf(rows, o, t, -PI / 2);
/** Flossensaum auf der Ober- oder Unterseite zwischen t0 und t1; h(u) Höhe, sw Neigung nach hinten; spines: Zacken am Rand (Anzahl) */
function seam(B, rows, o, t0, t1, h, sw, part, side = 1, spines = 0, nu = 24) {
  fin(B, nu, (u) => { const t = t0 + (t1 - t0) * u, p = side > 0 ? top(rows, o, t) : bot(rows, o, t); return [p[0], p[1] - side * 0.004, p[2], t]; },
    () => norm(0, side, -sw), (u) => { let L = h(u); if (spines) { const f = (u * spines) % 1; L *= 0.62 + 0.38 * Math.pow(1 - f, 0.6) * (f > 0.04 ? 1 : f / 0.04); } return Math.max(0.0005, L); }, part, 6);
}
/** Schwanzflosse am Ende des Stiels; edge(u) = Länge nach hinten (u -1 unten … 1 oben), span = halbe Höhe am Rand */
function tail(B, rows, o, t0, len, span, edge, part = 1) {
  const [h, , yc] = prof(rows, t0), z0 = zOf(t0);
  B.grid(16, 6, (i, j) => { const u = i / 8 - 1, v = j / 6, r = [0, yc + u * h * 0.9, z0], e = [0, yc + u * span, z0 - len * edge(u)]; return [0, r[1] + (e[1] - r[1]) * v, r[2] + (e[2] - r[2]) * v]; },
    (i, j) => [t0, part, j / 6, i / 8 - 1], false);
}
/** paarige Flosse (Brust oder Bauch) an der Flanke: Fächer von der Wurzel aus; ang = Spreizwinkel nach außen/hinten, droop nach unten */
function paired(B, rows, o, t, a, len, wid, ang, droop, part = 3, shape) {
  for (const sx of [-1, 1]) { const p = surf(rows, o, t, sx > 0 ? a : PI - a);
    B.grid(8, 6, (i, j) => { const u = i / 8, v = j / 6, sp = (u - 0.5) * wid, L = len * (shape ? shape(u) : 1) * v;
      const dir = norm(sx * Math.sin(ang), -droop, -Math.cos(ang)); return [p[0] + dir[0] * L + sx * 0.002, p[1] + dir[1] * L + sp * (1 - 0.6 * v) * 0.6 + sp * v * 0.8, p[2] + dir[2] * L + sp * 0.3]; },
      (i, j) => [t, part, j / 6, i / 8], false); }
}
function eyes(B, rows, o, t, a, r, bulge = 0.5) { for (const sx of [-1, 1]) { const p = surf(rows, o, t, sx > 0 ? a : PI - a); eye(B, [p[0] * 0.9, p[1], p[2]], sx, r, t, bulge); } }

// ---------- Falterfisch: hohe, flache Scheibe, spitze Schnauze, Rücken- und Afterflosse als durchgehender Saum ----------
const BF = [[0, 0.006, 0.004, 0.0], [0.05, 0.03, 0.012, 0.002], [0.13, 0.13, 0.03, 0.01], [0.24, 0.24, 0.045, 0.012], [0.36, 0.29, 0.05, 0.01], [0.5, 0.27, 0.047, 0.006], [0.64, 0.19, 0.038, 0.004], [0.76, 0.1, 0.022, 0.002], [0.84, 0.05, 0.012, 0.0], [0.9, 0.045, 0.01, 0.0]];
function buildButterfly() { const B = new Build(), o = { NT: 40, NA: 28, e: 0.75 };
  body(B, BF, o, 0, 0.9); eyes(B, BF, o, 0.17, 0.32, 0.022, 0.45);
  seam(B, BF, o, 0.26, 0.84, (u) => 0.03 + 0.11 * Math.sin(Math.min(1, u * 1.1) * PI * 0.85), 1.1, 2, 1, 11);
  seam(B, BF, o, 0.42, 0.84, (u) => 0.03 + 0.09 * Math.sin(Math.min(1, u * 1.05) * PI * 0.85), 1.0, 2, -1, 3);
  tail(B, BF, o, 0.88, 0.16, 0.1, (u) => 0.85 + 0.15 * Math.cos(u * 1.4));
  paired(B, BF, o, 0.3, -0.2, 0.1, 0.04, 0.7, 0.15); paired(B, BF, o, 0.32, -1.1, 0.08, 0.02, 0.2, 0.9);
  return B.geo(); }
// ---------- Blauer Fisch (Barsch): kräftig, leicht hoch, lange stachelige Rückenflosse, abgerundeter Schwanz ----------
const BL = [[0, 0.012, 0.01, -0.006], [0.04, 0.05, 0.04, -0.004], [0.12, 0.11, 0.07, 0.0], [0.24, 0.155, 0.085, 0.005], [0.38, 0.17, 0.085, 0.006], [0.54, 0.15, 0.072, 0.004], [0.68, 0.11, 0.05, 0.002], [0.8, 0.065, 0.03, 0.0], [0.87, 0.055, 0.022, 0.0]];
function buildBlue() { const B = new Build(), o = { NT: 40, NA: 28, e: 0.85 };
  body(B, BL, o, 0, 0.87); eyes(B, BL, o, 0.12, 0.35, 0.021, 0.5);
  seam(B, BL, o, 0.24, 0.5, (u) => 0.035 + 0.04 * Math.sin(Math.min(1, u * 1.2) * PI * 0.6), 0.8, 5, 1, 10);
  seam(B, BL, o, 0.5, 0.82, (u) => 0.075 * Math.sin(Math.min(1, u * 1.08) * PI * 0.8) + 0.02, 0.9, 2, 1);
  seam(B, BL, o, 0.56, 0.82, (u) => 0.07 * Math.sin(Math.min(1, u * 1.08) * PI * 0.8) + 0.015, 0.9, 2, -1);
  tail(B, BL, o, 0.86, 0.16, 0.11, (u) => Math.sqrt(Math.max(0, 1 - u * u * 0.55)));
  paired(B, BL, o, 0.27, -0.25, 0.13, 0.05, 0.75, 0.25); paired(B, BL, o, 0.3, -1.15, 0.09, 0.025, 0.25, 0.9);
  return B.geo(); }
// ---------- Drachenkopf: gedrungen, großer Kopf mit Hautlappen und Stacheln, warzige Haut, große Brustflossen-Fächer ----------
const SC = [[0, 0.03, 0.03, -0.01], [0.05, 0.08, 0.075, -0.005], [0.13, 0.13, 0.11, 0.004], [0.24, 0.165, 0.115, 0.01], [0.36, 0.17, 0.1, 0.008], [0.5, 0.145, 0.08, 0.005], [0.64, 0.1, 0.055, 0.002], [0.76, 0.062, 0.035, 0.0], [0.84, 0.05, 0.026, 0.0]];
function buildScorpion() { const B = new Build(), o = { NT: 46, NA: 32, e: 0.92, bump: (t, a) => 1 + 0.07 * Math.sin(t * 90 + a * 7) * Math.sin(a * 11 - t * 40) * (1 - t * 0.6) + 0.05 * Math.max(0, Math.sin(t * 37 + a * 3)) * (t < 0.3 ? 1.6 : 0.6) };
  body(B, SC, o, 0, 0.84); eyes(B, SC, o, 0.13, 0.62, 0.022, 0.75);
  // Hautlappen und Fransen: kleine, fleischige Blätter, die aus der Haut wachsen (gleiche Farbe wie der Körper): über den Augen, am Kinn, an den Wangen, entlang der Seitenlinie
  const flap = (t, a, L, W, sx) => { const p = surf(SC, o, t, a), q = surf(SC, o, t, a + 0.06), r = surf(SC, o, t + 0.01, a), [, , yc] = prof(SC, t);
    let n = norm(...cross([q[0] - p[0], q[1] - p[1], q[2] - p[2]], [r[0] - p[0], r[1] - p[1], r[2] - p[2]])); if (n[0] * p[0] + n[1] * (p[1] - yc) < 0) n = n.map((v) => -v);
    const tg = norm(...cross(n, [1, 0, 0])), bk = norm(n[0] * 0.6, n[1] * 0.6, n[2] * 0.6 - 0.8);
    B.grid(5, 4, (i, j) => { const u = i / 5, v = j / 4 - 0.5, w = W * Math.pow(Math.sin(PI * Math.min(1, u * 0.9 + 0.1)), 0.7) * (1 - 0.25 * u), bend = 0.35 * L * u * u;
      return [p[0] - n[0] * 0.004 + n[0] * L * u + bk[0] * bend + tg[0] * v * w, p[1] - n[1] * 0.004 + n[1] * L * u + bk[1] * bend + tg[1] * v * w, p[2] - n[2] * 0.004 + n[2] * L * u + bk[2] * bend + tg[2] * v * w]; },
      (i, j) => [t, 5, i / 5, j / 4], false); void sx; };
  for (const sx of [-1, 1]) { const A = (a) => (sx > 0 ? a : PI - a);
    flap(0.11, A(0.95), 0.05, 0.022, sx); flap(0.15, A(0.82), 0.04, 0.018, sx); flap(0.13, A(1.15), 0.035, 0.016, sx);   // über dem Auge
    flap(0.03, A(-0.55), 0.03, 0.014, sx); flap(0.06, A(-0.85), 0.035, 0.016, sx); flap(0.1, A(-1.0), 0.028, 0.012, sx);   // Kinn und Unterkiefer
    flap(0.19, A(-0.25), 0.03, 0.014, sx); flap(0.23, A(0.12), 0.026, 0.012, sx); flap(0.06, A(0.25), 0.022, 0.01, sx);     // Wange, Kiemendeckel, Schnauze
    for (let k = 0; k < 6; k++) flap(0.34 + k * 0.08, A(0.42 - k * 0.03), 0.016, 0.008, sx); }                               // Seitenlinie
  seam(B, SC, o, 0.18, 0.52, (u) => 0.05 + 0.1 * Math.sin(Math.min(1, u * 1.4 + 0.1) * PI * 0.5) * (1 - 0.35 * u), 0.3, 2, 1, 12);
  seam(B, SC, o, 0.52, 0.8, (u) => 0.09 * Math.sin(Math.min(1, u * 1.05) * PI * 0.8) + 0.02, 0.8, 2, 1);
  seam(B, SC, o, 0.56, 0.78, (u) => 0.07 * Math.sin(Math.min(1, u * 1.05) * PI * 0.8) + 0.015, 0.7, 2, -1, 3);
  tail(B, SC, o, 0.83, 0.17, 0.1, (u) => Math.sqrt(Math.max(0, 1 - u * u * 0.5)));
  paired(B, SC, o, 0.27, -0.5, 0.16, 0.22, 1.15, 0.4, 3, (u) => 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2))));   // große, runde Fächer
  paired(B, SC, o, 0.32, -1.2, 0.1, 0.03, 0.3, 0.9);
  return B.geo(); }
// ---------- Rot gestreifter Lippfisch: schlank, durchgehende Rückenflosse, gestutzter Schwanz ----------
const RS = [[0, 0.012, 0.008, -0.004], [0.05, 0.045, 0.03, -0.002], [0.14, 0.088, 0.052, 0.0], [0.28, 0.112, 0.06, 0.004], [0.44, 0.112, 0.058, 0.004], [0.6, 0.095, 0.048, 0.002], [0.74, 0.07, 0.034, 0.0], [0.84, 0.048, 0.022, 0.0], [0.89, 0.045, 0.018, 0.0]];
function buildStripe() { const B = new Build(), o = { NT: 40, NA: 26, e: 0.88 };
  body(B, RS, o, 0, 0.89); eyes(B, RS, o, 0.1, 0.38, 0.017, 0.5);
  seam(B, RS, o, 0.22, 0.82, (u) => 0.04 + 0.012 * Math.sin(u * PI), 0.7, 2, 1, 9);
  seam(B, RS, o, 0.52, 0.82, (u) => 0.04 * Math.sin(Math.min(1, u * 1.05) * PI * 0.85) + 0.012, 0.8, 2, -1);
  tail(B, RS, o, 0.88, 0.14, 0.085, (u) => 0.95 + 0.08 * Math.abs(u));
  paired(B, RS, o, 0.24, -0.25, 0.1, 0.04, 0.7, 0.2); paired(B, RS, o, 0.28, -1.1, 0.07, 0.02, 0.25, 0.9);
  return B.geo(); }
// ---------- Drückerfisch: rautenförmig, Augen weit oben und hinten, kleiner Mund, Rücken- und Afterflosse weit hinten, Leierschwanz ----------
const TR = [[0, 0.014, 0.01, -0.01], [0.06, 0.06, 0.035, -0.015], [0.16, 0.14, 0.055, -0.01], [0.3, 0.22, 0.065, -0.004], [0.44, 0.24, 0.064, 0.0], [0.58, 0.2, 0.055, 0.004], [0.7, 0.13, 0.042, 0.004], [0.8, 0.06, 0.025, 0.002], [0.86, 0.05, 0.02, 0.0]];
function buildTrigger() { const B = new Build(), o = { NT: 40, NA: 28, e: 0.8 };
  body(B, TR, o, 0, 0.86); eyes(B, TR, o, 0.28, 0.75, 0.021, 0.5);
  { const p = top(TR, o, 0.33), e = [0, p[1] + 0.09, p[2] - 0.05]; B.tube([p, [0, p[1] + 0.05, p[2] - 0.02], e], (s) => 0.008 * (1 - s) + 0.001, 6, (s) => [0.33, 5, s, 0]); }   // der „Abzug“: erster Rückenstachel
  seam(B, TR, o, 0.52, 0.8, (u) => 0.03 + 0.1 * Math.pow(Math.sin(Math.min(1, u * 1.1) * PI), 0.8) * (1 - 0.4 * u), 0.8, 2, 1);
  seam(B, TR, o, 0.52, 0.8, (u) => 0.03 + 0.1 * Math.pow(Math.sin(Math.min(1, u * 1.1) * PI), 0.8) * (1 - 0.4 * u), 0.8, 2, -1);
  tail(B, TR, o, 0.85, 0.16, 0.12, (u) => 0.72 + 0.12 * Math.abs(u) + 0.5 * Math.pow(Math.max(0, Math.abs(u) - 0.72) / 0.28, 1.6));
  paired(B, TR, o, 0.4, 0.0, 0.07, 0.035, 0.8, 0.0);
  return B.geo(); }
// ---------- Silberfisch (Hering): schlank, spitz, tief gegabelter Schwanz, kleine Flossen ----------
const SV = [[0, 0.01, 0.008, -0.002], [0.05, 0.04, 0.03, 0.0], [0.14, 0.075, 0.048, 0.002], [0.3, 0.09, 0.05, 0.004], [0.46, 0.088, 0.046, 0.003], [0.62, 0.07, 0.036, 0.002], [0.76, 0.045, 0.024, 0.0], [0.85, 0.028, 0.014, 0.0], [0.88, 0.026, 0.012, 0.0]];
function buildSilver() { const B = new Build(), o = { NT: 36, NA: 24, e: 0.9 };
  body(B, SV, o, 0, 0.88); eyes(B, SV, o, 0.08, 0.15, 0.016, 0.45);
  seam(B, SV, o, 0.4, 0.55, (u) => 0.055 * Math.sin(Math.min(1, u * 1.05) * PI * 0.8) + 0.008, 1.0, 2, 1);
  seam(B, SV, o, 0.66, 0.78, (u) => 0.03 * Math.sin(Math.min(1, u * 1.05) * PI * 0.8) + 0.006, 1.0, 2, -1);
  tail(B, SV, o, 0.87, 0.18, 0.11, (u) => 0.45 + 0.6 * Math.pow(Math.abs(u), 1.3));
  paired(B, SV, o, 0.22, -0.45, 0.07, 0.02, 0.7, 0.25); paired(B, SV, o, 0.48, -1.2, 0.05, 0.015, 0.25, 0.9);
  return B.geo(); }

// ======================= Rochen =======================
// Scheibe aus Ober- und Unterseite, die am Umriss zusammenlaufen. aK = (u entlang, Teil, s Spannweite 0 Mitte … 1 Spitze, c Sehne 0 vorn … 1 hinten)
// Teile: 0 Oberseite, 6 Unterseite, 7 Kopfflossen/Lappen, 1 Schwanz, 2 Rücken-/Schwanzflössel, 4 Auge
function disc(B, W, zle, zte, thick, camber, nS = 36, nC = 24) {
  for (const side of [1, -1]) for (const sx of [-1, 1]) { const b0 = B.n;
    B.grid(nS, nC, (i, j) => { const s = i / nS, c = j / nC, a = zle(s), b = zte(s), z = a + (b - a) * c, th = thick(s, c);
      return [sx * s * W(s, c), camber(s, c) + side * th * (side > 0 ? 1 : 0.75), z]; },
      (i, j) => [(0.5 - (zle(i / nS) + (zte(i / nS) - zle(i / nS)) * j / nC)), side > 0 ? 0 : 6, i / nS, j / nC], false, (i) => [0, -side * 10, 0]);
    for (let j = 0; j <= nC; j++) { const k = (b0 + j) * 3, y = B.N[k + 1], z = B.N[k + 2], l = Math.hypot(y, z) || 1; B.N[k] = 0; B.N[k + 1] = y / l; B.N[k + 2] = z / l; } }   // Mittellinie: beide Hälften gleiche Normale, keine Naht
}
/** Kopflappen des Mantas: fleischige Flosse, die breit aus dem Kopf wächst, nach vorn zeigt und sich zur Spitze hin einrollt */
function lobe(B, base, fwd, sx, L, w0, part = 7) {
  const f = norm(...fwd), side = norm(...cross([0, 1, 0], f)).map((v) => v * sx), up = cross(f, side).map((v) => v * sx);
  B.grid(14, 18, (i, j) => { const u = i / 14, a = j / 18 * TAU, w = w0 * (1 - 0.4 * u) * Math.sqrt(Math.max(0.05, 1 - Math.pow(u, 4))) + 0.002, th = 0.008 * (1 - 0.5 * u) + 0.012 * Math.pow(1 - u, 3) + 0.002;
      const cx = w * Math.cos(a), cy = th * Math.sin(a) - 0.9 * cx * cx / w0 * u, r = sx * (0.25 + 1.25 * u), rx = cx * Math.cos(r) - cy * Math.sin(r), ry = cx * Math.sin(r) + cy * Math.cos(r);
      return [base[0] + f[0] * L * u + side[0] * rx + up[0] * ry, base[1] + f[1] * L * u + side[1] * rx + up[1] * ry - 0.025 * u * u, base[2] + f[2] * L * u + side[2] * rx + up[2] * ry]; },
    (i, j) => [0.05, part, i / 14, j / 18], true, (i) => [base[0] + f[0] * L * i / 14, base[1] + f[1] * L * i / 14 - 0.025 * (i / 14) ** 2, base[2] + f[2] * L * i / 14]);
}
/** Dicke einer Rochenscheibe: in der Mitte voller Körper, der hinten rund ausläuft (dort sitzt der Schwanz), außen flügeldünn */
const rayPr = (s, c, a = 0.45, b = 0.8) => { const wing = Math.pow(c, a) * Math.pow(1 - c, b) * 2.1, bod = Math.pow(c, 0.38) * Math.pow(1 - c, 0.3) * 1.55, k = Math.min(1, Math.max(0, (s - 0.04) / 0.24)); const kk = k * k * (3 - 2 * k); return bod * (1 - kk) + wing * kk; };
function buildManta() { const B = new Build();
  // Umriss: Vorderkante zuerst fast quer nach außen, dann immer stärker nach hinten zur spitzen Flügelspitze; Hinterkante hohl (Bumerang)
  const W = (s) => 1.12, zle = (s) => 0.45 - 0.25 * s - 0.45 * s * s * s, zte = (s) => -0.48 + 0.4 * Math.pow(s, 0.6) - 0.17 * Math.pow(s, 4);
  const thick = (s, c) => (0.085 * Math.pow(Math.max(0, 1 - s * 1.25), 1.8) + 0.012 * (1 - s) + 0.0025) * rayPr(s, c) + 0.0004;
  disc(B, W, zle, zte, thick, (s, c) => -0.05 * s * s + 0.02 * Math.sin(c * PI) * (1 - s));
  for (const sx of [-1, 1]) lobe(B, [sx * 0.135, -0.006, 0.39], [sx * 0.1, -0.12, 1], sx, 0.13, 0.04);
  for (const sx of [-1, 1]) eye(B, [sx * 0.168, 0.008, 0.37], sx, 0.013, 0.1, 0.55);
  // kleine Rückenflosse und Peitschenschwanz; der Schwanz beginnt im Körper und wird erst danach dünn
  fin(B, 8, (u) => [0, 0.025 - u * 0.02, -0.38 - u * 0.09, 0.9], () => norm(0, 1, -0.9), (u) => 0.05 * Math.sin(Math.min(1, u * 1.1) * PI * 0.8) + 0.004, 2, 5);
  const tp = []; for (let i = 0; i <= 18; i++) { const q = i / 18; tp.push([0, -0.004 + 0.02 * Math.sin(q * 2.2) * q, -0.38 - q * 0.72]); }
  B.tube(tp, (q) => 0.024 * Math.pow(1 - q, 2.2) + 0.0035 * (1 - q) + 0.0012, 8, (q) => [0.9 + q * 0.7, 1, q, 0]);
  return B.geo(); }
function buildStingray() { const B = new Build();
  // Rautenscheibe mit runden Ecken; der kräftige Schwanz wächst hinten aus dem Körper
  const mid = (s) => 0.08 - 0.06 * s, hc = (s) => (0.42 - 0.3 * Math.pow(s, 0.9)) * Math.sqrt(Math.max(0, 1 - Math.pow(s, 5))) + 0.002, W = (s) => 0.56, zle = (s) => mid(s) + hc(s) + 0.02 * Math.sin(s * PI), zte = (s) => mid(s) - hc(s) * 0.98;
  const thick = (s, c) => (0.062 * Math.pow(Math.max(0, 1 - s * 1.15), 1.5) + 0.004) * rayPr(s, c, 0.5, 0.7) + 0.0004;
  disc(B, W, zle, zte, thick, (s, c) => 0.01 * Math.sin(c * PI) * (1 - s));
  for (const sx of [-1, 1]) { B.ellipsoid([sx * 0.05, 0.066, 0.24], 0.016, 0.013, 0.02, (q, a) => [0.25, 4, q * 1.25, a], 8, 14); B.ellipsoid([sx * 0.06, 0.062, 0.2], 0.012, 0.006, 0.01, (q, a) => [0.3, 7, q, a], 4, 8); }   // Augen oben, Spritzloch dahinter
  const tp = []; for (let i = 0; i <= 20; i++) { const q = i / 20; tp.push([0, 0.012 - 0.008 * q + 0.012 * Math.sin(q * 3) * q, -0.2 - q * 0.78]); }
  B.tube(tp, (q) => 0.042 * Math.pow(1 - q, 1.6) * (q < 0.2 ? 1 : 1) + 0.004, 10, (q) => [0.7 + q * 0.8, 1, q, 0], () => 0.75);
  for (const q of [0.66, 0.8]) fin(B, 6, (u) => { const p = tp[Math.round((q + u * 0.08) * 20)]; return [0, p[1] + 0.012, p[2], 1.4]; }, () => norm(0, 1, -0.6), (u) => 0.028 * Math.sin(Math.min(1, u * 1.1) * PI * 0.8) + 0.003, 2, 4);
  for (let k = 0; k < 12; k++) { const q = 0.2 + k / 12 * 0.42, p = tp[Math.round(q * 20)], r = 0.042 * Math.pow(1 - q, 1.6) + 0.004, b = [p[0], p[1] + r * 0.7, p[2]], e = [p[0], p[1] + r * 0.7 + 0.022, p[2] - 0.012]; B.tube([b, e], (s) => 0.005 * (1 - s) + 0.0005, 4, (s) => [1.2, 5, s, 0]); }   // Dornenreihe
  return B.geo(); }

// ======================= Shader =======================
const VS = (mode) => /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  void main(){ vec3 p = position, nr = normal; float t = aK.x, part = aK.y, vv = aK.z, ph = iA.x, amp = iA.y;
    ${mode === 'fish' ? `float env = 0.12 + 0.88 * smoothstep(0.1, 1.0, t); float sw = sin(ph - t * 6.5) * amp * env * 0.07; p.x += sw;
      if (part > 2.5 && part < 3.5) { p.x += sign(p.x) * sin(ph * 1.6 + 1.0) * 0.012 * vv * amp; p.y += sin(ph * 1.6) * 0.006 * vv; }
      if (part > 0.5 && part < 1.5) p.x += sin(ph - t * 6.5 - vv * 1.2) * amp * 0.03 * vv;` : ''}
    ${mode === 'manta' ? `float s = (part < 0.5 || (part > 5.5 && part < 6.5)) ? vv : (part > 6.5 ? 0.13 : (part > 3.5 && part < 4.5 ? 0.14 : 0.0)); float fl = sin(ph - s * 1.4) * amp; p.y += fl * 0.25 * pow(s, 1.6); p.z -= abs(fl) * 0.03 * pow(s, 2.0);
      if (part > 0.5 && part < 1.5) { p.y += sin(ph * 0.5 - vv * 4.0) * 0.03 * vv; p.x += sin(ph * 0.7 - vv * 5.0) * 0.04 * vv; }` : ''}
    ${mode === 'ray' ? `float s = (part < 0.5 || (part > 5.5 && part < 6.5)) ? vv : 0.0; p.y += sin(ph - t * 9.0) * amp * 0.035 * pow(s, 1.5); if (part > 0.5 && part < 2.5) p.x += sin(ph * 0.6 - (0.5 - p.z) * 5.0) * 0.03 * smoothstep(0.84, 1.3, 0.5 - p.z);` : ''}
    vL = p; p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FHEAD = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nz(vec2 p){ return texture2D(uNoise, p).r; }
  // Schuppen: versetztes Raster, dunkle Ränder
  float scales(vec2 g){ g.y += floor(g.x) * 0.5; vec2 f = fract(g) - 0.5; return smoothstep(0.32, 0.5, length(f * vec2(1.0, 1.25))); }
  // Flossenstrahlen: feine Linien entlang des Strahls
  float rays(float u, float n){ return smoothstep(0.35, 0.5, abs(fract(u * n) - 0.5)); }
  void main(){ vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW); bool outer = dot(N0, V) > 0.0; vec3 N = outer ? N0 : -N0;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x; vec3 base = vec3(0.5), emis = vec3(0.0); float spec = 0.4, pw = 30.0, irid = 0.0, trans = 0.0;
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    // Kiemendeckel: geschwungene dunkle Linie; Bauch heller
    float gill = part < 0.5 ? (1.0 - smoothstep(0.0, 0.006, abs(t - GILL - 0.04 * u * u))) * step(-0.75, u) : 0.0;`;
const FEYE = /* glsl */ `
    if (part > 3.5 && part < 4.5) { float e = vv; base = e < 0.42 ? vec3(0.01) : e < 0.72 ? IRIS * (0.7 + 0.3 * smoothstep(0.42, 0.7, e)) : mix(IRIS * 0.4, BODY_EYE, smoothstep(0.72, 0.9, e)); spec = 3.0; pw = 120.0; }`;
const FTAIL = /* glsl */ `
    // Licht im flachen, klaren Wasser: fast weißes Sonnenlicht von oben, bläuliches Umgebungslicht, Lichtnetz auf dem Rücken
    vec3 L = normalize(vec3(0.25, 0.9, 0.35)); float dl = max(dot(N, L), 0.0), up = 0.5 + 0.5 * N.y;
    // in der Tiefe wird das Sonnenlicht schwächer, wie bei Fels und Tang; dazu Scheinwerfer und Umgebung wie bei allen Tieren
    float lk = clamp(exp((vW.y + 20.0) * 0.02), 0.3, 1.0);
    vec3 c = base * (vec3(0.34, 0.44, 0.5) * (0.55 + 0.45 * up) + vec3(1.0, 0.96, 0.86) * dl * (0.85 + 0.5 * caustic(vW.xz * 6.0 + vW.y) * smoothstep(0.3, 0.8, N.y)) * 0.95) * lk * 0.8 + shade(base, N, vW) * 0.5;
    c += vec3(0.85, 0.95, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), pw) * spec * 0.35;
    c += irid * (0.5 + 0.5 * cos(6.2832 * (fr * 1.4 + vec3(0.0, 0.33, 0.67) + t * 0.4))) * fr * 0.6 + irid * vec3(0.7, 0.85, 0.9) * fr * 0.4;
    c += base * trans * 0.25 * max(dot(-N, L), 0.0) + emis;
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;
const FS = {};
// Falterfisch: weiß mit feinen dunklen Linien im Fischgrätmuster, hinten und Flossen gelb, schwarzes Augenband, Augenfleck hinten an der Rückenflosse
FS.butterfly = FHEAD.replace('GILL', '0.27') + /* glsl */ `
  #define IRIS vec3(0.75, 0.6, 0.25)
  #define BODY_EYE vec3(0.05)
  float n = nz(vL.zy * 3.0);
  if (part < 0.5) { vec3 w = vec3(0.96, 0.95, 0.9); float a = abs(fract((vL.z * 0.9 + vL.y * 1.2) * 28.0) - 0.5), b = abs(fract((vL.z * 0.9 - vL.y * 1.4) * 28.0) - 0.5);
    float ln = (1.0 - smoothstep(0.04, 0.1, vL.y > 0.02 ? a : b)) * smoothstep(0.12, 0.3, t);
    base = mix(w, vec3(0.32, 0.3, 0.3), ln * 0.75); base = mix(base, vec3(1.0, 0.82, 0.12), smoothstep(0.5, 0.72, t + 0.08 * u) );
    base = mix(base, vec3(0.04), (1.0 - smoothstep(0.012, 0.022, abs(t - 0.17 - 0.03 * u))) * step(-0.85, u));   // Augenband
    base = mix(base, vec3(1.0, 0.85, 0.3), smoothstep(-0.5, -0.9, u) * 0.4); base *= 1.0 - gill * 0.3; spec = 0.6; }
  else if (part < 1.5) { base = mix(vec3(1.0, 0.8, 0.12), vec3(0.95, 0.95, 0.85), smoothstep(0.7, 0.95, vv)); base = mix(base, vec3(0.08), (1.0 - smoothstep(0.03, 0.08, abs(vv - 0.62))) * 0.85); base *= 0.85 + 0.15 * rays(u, 9.0); trans = 1.0; }
  else if (part < 3.5) { base = vec3(1.0, 0.8, 0.12) * (0.8 + 0.2 * rays(u, 16.0)); base = mix(base, vec3(0.85, 0.9, 0.95), smoothstep(0.75, 1.0, vv) * 0.6);
    if (part < 2.5 && vL.y > 0.0) { vec2 q = vec2((t - 0.7) * 9.0, (vv - 0.45) * 3.0); float oc = length(q); base = mix(base, vec3(0.03), 1.0 - smoothstep(0.42, 0.5, oc)); base = mix(base, vec3(1.0, 0.95, 0.6), (1.0 - smoothstep(0.03, 0.08, abs(oc - 0.56))) * 0.8); }
    if (part > 2.5) base = vec3(0.95, 0.95, 0.85); trans = 1.0; }
  else if (part > 4.5) base = vec3(0.9, 0.85, 0.7);` + FEYE + FTAIL;
// Blauer Barsch: tiefblau mit leuchtend türkisen Schnörkeln und Punkten, dunklere Flossen mit hellem Saum
FS.blue = FHEAD.replace('GILL', '0.22') + /* glsl */ `
  #define IRIS vec3(0.85, 0.55, 0.2)
  #define BODY_EYE vec3(0.05, 0.12, 0.35)
  // Maserung: feines Netz aus türkisen Linien (zwei Größen) und einzelne Punkte; leuchtet sacht, als einziges Leuchten des Fisches
  float n = nz(vL.zy * 2.2 + 0.3), n2 = nz(vL.zy * 5.0 - 0.7), n4 = nz(vL.zy * 4.3 + vec2(0.17, 0.61));
  float sq = max(1.0 - smoothstep(0.0, 0.03, abs(n - 0.5)), (1.0 - smoothstep(0.0, 0.025, abs(n4 - 0.5))) * 0.8), dt = (1.0 - smoothstep(0.08, 0.12, length(fract(vL.zy * 38.0 + n * 3.0) - 0.5))) * step(0.62, n2);
  vec3 deep = mix(vec3(0.04, 0.12, 0.42), vec3(0.06, 0.2, 0.55), smoothstep(-0.8, 0.6, u));
  if (part < 0.5) { float pat = max(sq * 0.85, dt * 0.8) * smoothstep(0.04, 0.12, t); base = mix(deep, vec3(0.2, 0.85, 1.0), pat); emis = vec3(0.15, 0.75, 1.0) * pat * (0.32 + 0.1 * sin(uTime * 1.3 + t * 9.0)); base *= 0.9 + 0.12 * (1.0 - scales(vec2(t * 55.0, vK.z * 30.0))); base *= 1.0 - gill * 0.5; spec = 0.9; pw = 45.0; irid = 0.3; }
  else if (part < 4.5 && part > 3.5) {}
  else { base = mix(vec3(0.04, 0.1, 0.32), vec3(0.15, 0.55, 0.9), smoothstep(0.8, 1.0, vv)) * (0.8 + 0.25 * rays(u, 14.0)); base = mix(base, vec3(0.2, 0.8, 1.0), sq * 0.5); emis = vec3(0.15, 0.7, 1.0) * sq * 0.18; trans = 0.6; }` + FEYE + FTAIL;
// Drachenkopf: rot-orange, fleckig, dunkle Querbänder, helle Pünktchen, Flossen gebändert
FS.scorpion = FHEAD.replace('GILL', '0.26') + /* glsl */ `
  #define IRIS vec3(0.75, 0.3, 0.15)
  #define BODY_EYE vec3(0.55, 0.15, 0.08)
  float n = nz(vL.zy * 3.0 + vL.x), n2 = nz(vL.zy * 9.0 - vL.x * 3.0), n3 = nz(vL.zy * 20.0 + 0.5);
  vec3 red = mix(vec3(0.72, 0.2, 0.08), vec3(0.95, 0.45, 0.2), n) * (0.75 + 0.35 * n2);
  red = mix(red, vec3(0.3, 0.07, 0.04), smoothstep(0.55, 0.75, nz(vec2(t * 4.0, u * 0.6) + 0.4)) * 0.6);
  red += vec3(0.4, 0.35, 0.3) * step(0.86, n3) * 0.6;
  if (part < 0.5) { base = mix(red, vec3(0.95, 0.65, 0.5), smoothstep(-0.5, -0.95, u) * 0.5); base *= 1.0 - gill * 0.4; spec = 0.35; }
  else if (part > 4.5) base = mix(red, vec3(0.95, 0.75, 0.6), vv * 0.5);
  else if (part < 3.5) { base = red * (0.75 + 0.3 * rays(u, part > 2.5 ? 12.0 : 18.0)); base = mix(base, vec3(0.25, 0.06, 0.04), step(0.5, fract(vv * 3.0 + n * 0.8)) * 0.45); trans = 0.7; }` + FEYE + FTAIL;
// Rot gestreift: weiß-cremig mit roten Längsstreifen, rote Flossen mit hellem Saum
FS.stripe = FHEAD.replace('GILL', '0.2') + /* glsl */ `
  #define IRIS vec3(0.9, 0.5, 0.2)
  #define BODY_EYE vec3(0.85, 0.3, 0.15)
  float n = nz(vL.zy * 4.0);
  float st = smoothstep(0.35, 0.5, abs(fract(u * 2.3 + 0.12 + 0.06 * sin(t * 9.0)) - 0.5) * 2.0 - 0.15 + 0.1 * n);
  if (part < 0.5) { base = mix(vec3(0.92, 0.25, 0.12), vec3(0.97, 0.94, 0.88), st); base = mix(base, vec3(1.0, 0.75, 0.4), smoothstep(0.15, 0.0, t) * 0.5); base *= 0.92 + 0.1 * (1.0 - scales(vec2(t * 50.0, vK.z * 26.0))); base *= 1.0 - gill * 0.3; spec = 0.7; }
  else if (part > 4.5) base = vec3(0.9);
  else if (part < 3.5) { base = mix(vec3(0.88, 0.2, 0.1), vec3(0.98, 0.9, 0.8), smoothstep(0.35, 0.5, abs(fract(vv * 2.0) - 0.5))) * (0.85 + 0.2 * rays(u, 14.0)); trans = 0.8; }` + FEYE + FTAIL;
// Drückerfisch: graugrün mit Rautenschuppen, gelblicher Bauch, blaue Linien am Maul, Flossen olivgelb
FS.trigger = FHEAD.replace('GILL', '0.3') + /* glsl */ `
  #define IRIS vec3(0.6, 0.65, 0.3)
  #define BODY_EYE vec3(0.45, 0.5, 0.42)
  float n = nz(vL.zy * 2.5);
  vec2 dg = vec2(vL.z + vL.y, vL.z - vL.y) * 34.0; float dia = smoothstep(0.38, 0.5, max(abs(fract(dg.x) - 0.5), abs(fract(dg.y) - 0.5)));
  if (part < 0.5) { base = mix(vec3(0.62, 0.62, 0.42), vec3(0.42, 0.5, 0.45), smoothstep(-0.4, 0.7, u)) * (0.85 + 0.2 * n); base *= 1.0 - dia * 0.18;
    base = mix(base, vec3(0.95, 0.8, 0.4), smoothstep(-0.3, -0.85, u) * 0.4);
    base = mix(base, vec3(0.3, 0.6, 0.85), (1.0 - smoothstep(0.0, 0.012, abs(fract((vL.z * 1.0 + vL.y * 0.6) * 22.0) - 0.5) - 0.0)) * smoothstep(0.24, 0.1, t) * 0.7); spec = 0.5; }
  else if (part > 4.5) base = vec3(0.35, 0.4, 0.32);
  else if (part < 3.5) { base = mix(vec3(0.55, 0.58, 0.38), vec3(0.85, 0.75, 0.35), smoothstep(0.6, 1.0, vv)) * (0.8 + 0.25 * rays(u, 14.0)); trans = 0.7; }` + FEYE + FTAIL;
// Silberfisch: dunkler Rücken, silbrig schillernde Flanken, Seitenlinie, Fleck hinter dem Kiemendeckel, gelb-orange Flossen und Schwanz
FS.silver = FHEAD.replace('GILL', '0.19') + /* glsl */ `
  #define IRIS vec3(0.85, 0.85, 0.8)
  #define BODY_EYE vec3(0.75, 0.78, 0.8)
  float n = nz(vL.zy * 3.0);
  if (part < 0.5) { base = mix(vec3(0.8, 0.84, 0.86), vec3(0.22, 0.32, 0.42), smoothstep(0.2, 0.75, u)); base *= 0.9 + 0.12 * (1.0 - scales(vec2(t * 60.0, vK.z * 30.0)));
    base = mix(base, vec3(0.15, 0.2, 0.26), (1.0 - smoothstep(0.0, 0.05, length(vec2((t - 0.24) * 2.0, u - 0.3)))) * 0.8);
    base *= 1.0 - gill * 0.3; spec = 2.2; pw = 70.0; irid = 0.8; }
  else if (part > 4.5) base = vec3(0.8);
  else if (part < 3.5) { base = mix(vec3(0.95, 0.65, 0.2), vec3(1.0, 0.85, 0.4), vv) * (0.8 + 0.25 * rays(u, 12.0)); trans = 1.0; }` + FEYE + FTAIL;
// Manta: oben schiefergrau mit hellen Schulterflecken und kleinen türkisen Punkten, unten weiß mit dunklem Saum, Maul dunkel
FS.manta = FHEAD.replace('GILL', '-9.0') + /* glsl */ `
  #define IRIS vec3(0.4, 0.35, 0.3)
  #define BODY_EYE vec3(0.12, 0.15, 0.18)
  float n = nz(vL.xz * 2.0), n2 = nz(vL.xz * 6.0 + 0.3), n3 = nz(vL.xz * 13.0 - 1.0);
  if (part < 0.5) { base = mix(vec3(0.1, 0.13, 0.17), vec3(0.18, 0.23, 0.27), n);
    // zwei helle Schulterflecken hinter dem Kopf, schräg nach außen und hinten, mit ausgefranstem Rand; dazu einzelne helle Spritzer auf den Flügeln
    vec2 q = vec2(abs(vL.x), vL.z), a0 = vec2(0.1, 0.3), a1 = vec2(0.5, 0.02), ab = a1 - a0; float hk = clamp(dot(q - a0, ab) / dot(ab, ab), 0.0, 1.0); float dsh = length(q - a0 - ab * hk);
    float sh = 1.0 - smoothstep(0.0, 0.03, dsh - (0.075 - 0.04 * hk) - (nz(q * 5.0) - 0.5) * 0.06);
    base = mix(base, vec3(0.78, 0.82, 0.84), sh * 0.9);
    // verstreute türkise Pünktchen
    { vec2 g = vec2(vL.x, vL.z) * 26.0, id = floor(g); vec2 jp = vec2(h21(id), h21(id + 7.3)) * 0.6 + 0.2; float d = length(fract(g) - jp); base += vec3(0.3, 0.8, 0.85) * (1.0 - smoothstep(0.06, 0.12, d)) * step(0.8, h21(id + 2.1)) * smoothstep(0.1, 0.3, vv) * 0.55; } base = mix(base, vec3(0.3, 0.38, 0.42), smoothstep(0.9, 1.0, vv) * 0.4); spec = 0.6; }
  else if (part > 5.5 && part < 6.5) { base = vec3(0.9, 0.92, 0.92) * (0.9 + 0.1 * n); base = mix(base, vec3(0.12, 0.15, 0.18), max(max(smoothstep(0.9, 1.0, vv), 1.0 - smoothstep(0.0, 0.07, u)), smoothstep(0.93, 1.0, u))); base = mix(base, vec3(0.2, 0.24, 0.28), smoothstep(0.75, 1.0, max(vv, max(u * 1.15 - 0.15, 0.0))) * 0.8);
    base = mix(base, vec3(0.25), step(0.9, n3) * 0.5 * smoothstep(0.6, 0.2, vv));
    for (int k = 0; k < 5; k++) { float gz = 0.2 - float(k) * 0.035; base *= 1.0 - (1.0 - smoothstep(0.0, 0.004, abs(vL.z - gz))) * step(abs(vL.x), 0.14) * step(0.06, abs(vL.x)) * 0.6; }   // Kiemenspalten
    base = mix(base, vec3(0.05), (1.0 - smoothstep(0.0, 0.02, abs(vL.z - 0.43))) * step(abs(vL.x), 0.13)); spec = 0.5; }
  else if (part > 6.5) { base = mix(vec3(0.15, 0.18, 0.22), vec3(0.6, 0.62, 0.64), smoothstep(-0.3, -1.0, sin(u * 6.2832)) * 0.7); }
  else base = vec3(0.12, 0.15, 0.18);` + FEYE + FTAIL;
// Stechrochen: sandbraun mit dunklen Flecken und hellen Pünktchen, hell abgesetzter Rand, unten weißlich
FS.ray = FHEAD.replace('GILL', '-9.0') + /* glsl */ `
  #define IRIS vec3(0.7, 0.55, 0.3)
  #define BODY_EYE vec3(0.5, 0.4, 0.28)
  vec2 rq = vL.xz + vec2(0.37, 0.11); float n = nz(rq * 0.9) * 0.6 + nz(rq * 2.3 + 0.2) * 0.4, n2 = nz(rq * 4.1 + 0.4) * 0.6 + nz(rq * 8.7) * 0.4, n3 = nz(rq * 17.0 - 0.6);
  vec3 sand = mix(vec3(0.42, 0.32, 0.2), vec3(0.58, 0.47, 0.32), n) * (0.85 + 0.25 * n2);
  sand = mix(sand, vec3(0.26, 0.18, 0.11), smoothstep(0.6, 0.7, n2) * 0.55); sand += vec3(0.25, 0.22, 0.18) * step(0.88, n3) * 0.45;
  if (part < 0.5) { base = mix(sand, vec3(0.72, 0.62, 0.45), smoothstep(0.85, 1.0, max(vv, abs(u - 0.5) * 2.0 * vv)) * 0.5); spec = 0.3; }
  else if (part > 5.5 && part < 6.5) { base = vec3(0.92, 0.88, 0.82) * (0.9 + 0.1 * n); spec = 0.3; }
  else if (part > 6.5) base = mix(sand, vec3(0.25, 0.18, 0.12), 0.3);
  else if (part > 4.5) base = vec3(0.75, 0.66, 0.5);
  else if (part < 3.5) base = sand * 0.9;` + FEYE + FTAIL;

export function createReef(scene) {
  const kind = (geo, mode, fs, M) => {
    const iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
    geo.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); geo.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); geo.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); geo.instanceCount = 0;
    const m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS(mode), fragmentShader: fs })); m.frustumCulled = false; scene.add(m);
    return { geo, M, list: [], mesh: m,
      sync() { let n = 0; for (const f of this.list) { if (n >= M) break; const o = n * 4; iP.set([f.x, f.y, f.z, f.size], o); iR.set([f.yaw, f.pitch || 0, f.roll || 0, 0], o); iA.set([f.ph || 0, f.amp == null ? 1 : f.amp, f.seed || 0, 0], o); n++; }
        geo.instanceCount = n; geo.attributes.iP.needsUpdate = geo.attributes.iR.needsUpdate = geo.attributes.iA.needsUpdate = true; } };
  };
  return {
    manta: kind(buildManta(), 'manta', FS.manta, 6), ray: kind(buildStingray(), 'ray', FS.ray, 12),
    butterfly: kind(buildButterfly(), 'fish', FS.butterfly, 200), blue: kind(buildBlue(), 'fish', FS.blue, 200), scorpion: kind(buildScorpion(), 'fish', FS.scorpion, 40),
    stripe: kind(buildStripe(), 'fish', FS.stripe, 200), trigger: kind(buildTrigger(), 'fish', FS.trigger, 60), silver: kind(buildSilver(), 'fish', FS.silver, 600),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Leben im Riff: Gruppen von Tieren entstehen in einem Ring um das Boot und verschwinden wieder, wenn es weit weg ist (wie bei
// den anderen Fischen). Im Tangwald entstehen deutlich mehr Gruppen; dort bleiben sie zwischen den Stängeln und weichen dem Boot
// tiefer in den Tang aus. Drachenköpfe liegen auf dem Sand neben Felsen, Stechrochen ruhen auf offenem Sand und gleiten ab und zu
// ein Stück weiter, der Mantarochen zieht hoch im Freiwasser.
const rngR = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Größe (m), Tempo (m/s), Flossenschlag (je s), Höhe über Grund, Gruppengröße, Gruppen ums Boot: n im offenen Riff, nF zusätzlich
// mitten im Tangwald; grpF: Gruppengröße im Wald; turn: wie schnell sie drehen
export const REEF_CFG = {
  silver: { size: [1.0, 1.2], speed: 2.4, beat: 2.4, h: [4, 14], grp: [22, 34], grpF: [10, 16], n: 3, nF: 2, turn: 1.2, up: 0.6 },
  stripe: { size: [1.1, 1.4], speed: 1.5, beat: 1.7, h: [1.5, 5], grp: [5, 9], grpF: [5, 9], n: 3, nF: 6, turn: 1.0, up: 0.2 },
  butterfly: { size: [1.0, 1.3], speed: 1.0, beat: 2.0, h: [1.5, 6], grp: [2, 4], grpF: [2, 4], n: 4, nF: 14, turn: 0.9, close: 1, up: 0.25 },
  blue: { size: [1.3, 1.7], speed: 1.1, beat: 1.5, h: [2, 8], grp: [1, 2], grpF: [1, 3], n: 4, nF: 12, turn: 0.8, close: 1, up: 0.4 },
  trigger: { size: [1.5, 1.9], speed: 1.2, beat: 1.3, h: [2, 7], grp: [1, 1], grpF: [1, 2], n: 3, nF: 3, turn: 0.8, up: 0.4 },
  scorpion: { size: [1.1, 1.4], speed: 0.8, beat: 0.8, h: [0, 0], grp: [1, 1], grpF: [1, 1], n: 4, nF: 10, turn: 1.0, floor: 1, close: 1 },
  ray: { size: [1.8, 2.6], speed: 0.6, beat: 0.6, h: [0.5, 1.5], grp: [1, 1], grpF: [1, 1], n: 2, nF: 0, turn: 0.5, floor: 1 },
  manta: { size: [4.5, 6], speed: 3.2, beat: 0.5, h: [10, 20], minH: 8, up: 1, surf: [8, 20], grp: [1, 1], grpF: [1, 1], n: 1, nF: 0, turn: 0.3 },
};
// up: so ein Anteil der Gruppen im offenen Riff schwimmt im oberen Wasser, surf m unter der Oberfläche (sonst 7 bis 28 m)
// close: im Tangwald neugierig, sie kommen bis auf wenige Meter ans Boot heran
const KEYS = Object.keys(REEF_CFG), REEF_DEPTH = -112;   // tiefer als das gibt es keine Rifftiere

export function createReefLife(scene) {
  const M = createReef(scene), R = rngR(7171), rr = (a, b) => a + R() * (b - a), C = REEF_CFG;
  const L = { groups: [], cfg: C, fF: 0, fT: 0, models: M };
  const inBiome = (x, z) => atlK(x, z) > 0.6 && Math.hypot(x - CITY.x, z - CITY.z) > CITY.r * 0.7;
  /** Höhe, in der eine Art hier schwimmt (Bodentiere: direkt auf dem Sand) */
  const wantY = (c, x, z, fl, up) => { if (c.floor && !c.h[1]) return fl; if (up) { const sf = c.surf || [7, 28]; return Math.min(-6, Math.max(fl + (c.minH || c.h[0]), -rr(sf[0], sf[1]))); } return Math.min(-6, fl + rr(c.h[0], c.h[1])); };   // up: oberes Wasser
  function freeAt(x, y, z, r) { return rockSDF(x, y, z) > r; }
  /** ein Platz für eine neue Gruppe: Wald oder offenes Riff */
  function place(c, sub, forest, near, up) {
    const look = sub.vh !== undefined ? sub.vh : sub.h || 0;
    for (let k = 0; k < 14; k++) {
      const fw = !near && R() < 0.55, a = fw ? look + rr(-0.8, 0.8) : R() * 2 * PI, d = near ? rr(9, 13) : fw ? rr(48, 75) : forest ? rr(16, 65) : rr(42, 80);
      const x = near ? sub.x + Math.sin(look) * d : sub.x + Math.sin(a) * d, z = near ? sub.z + Math.cos(look) * d : sub.z + Math.cos(a) * d;
      if (!fw && !near && d < 48 && Math.abs(wrap(a - look)) < 1.0 && !(forest && denseK(x, z) > 0.3)) continue;   // nicht mitten im Blickfeld auftauchen (im dichten Tang sieht man es nicht)
      if (!near && !inBiome(x, z)) continue;
      const fl = floorH(x, z); if (!near && fl < REEF_DEPTH) continue;
      const fk = forestK(x, z); if (!near && (forest ? fk < 0.55 : !up && fk > 0.5 && R() < 0.7)) continue;   // im oberen Wasser auch über dem Wald
      if (c === C.ray && !near && (fk > 0.3 || rock2D(x, z) < 5)) continue;   // Rochen: offener Sand
      if (c === C.scorpion && !near && !forest) { const rd = rock2D(x, z); if (rd > 5 && R() < 0.8) continue; }   // Drachenköpfe: meist neben Felsen
      const y = near ? Math.max(fl + (c.floor ? 0 : 1.5), Math.min(-6, sub.y)) : wantY(c, x, z, fl, up);
      if (!freeAt(x, y + 0.5, z, c === C.manta ? 5 : 1.2)) continue;
      return { x, y, z, fl };
    }
    return null;
  }
  function spawn(key, sub, forest, near) {
    const c = C[key], up = !near && (!forest || key === 'silver') && R() < (c.up || 0), p = place(c, sub, forest, near, up); if (!p) return null;
    const gr = forest ? c.grpF : c.grp, dense = forest && denseK(p.x, p.z) > 0.3 ? 1.4 : 1, n = Math.max(1, Math.round(rr(gr[0], gr[1] + 0.99) * dense - 0.49));
    const look = sub.vh !== undefined ? sub.vh : sub.h || 0;
    const g = { key, c, forest, up: near ? sub.y - p.fl > 15 : up, x: p.x, y: p.y, z: p.z, yaw: near ? look + PI / 2 : R() * 2 * PI, pitch: 0, sp: c.speed * rr(0.85, 1.15), tx: p.x, ty: p.y, tz: p.z, re: 0, rest: c.floor ? rr(15, 50) : 0, flee: 0, mem: [] };
    const sz = rr(c.size[0], c.size[1]), spread = (n > 12 ? 2.2 : n > 4 ? 1.4 : 0.9) * Math.max(1, sz * 1.6);
    for (let i = 0; i < n; i++) {
      const o = i === 0 ? [0, 0, 0] : [rr(-1, 1) * spread * (1 + n * 0.03), rr(-0.5, 0.5) * spread * 0.7, rr(-1, 1) * spread * (1 + n * 0.04)];
      g.mem.push({ o, x: g.x + o[0], y: g.y + o[1], z: g.z + o[2], yaw: g.yaw, pitch: 0, roll: 0, ph: R() * 6.3, amp: 1, size: sz * rr(0.9, 1.1), seed: R(), w: R() * 6.3 });
    }
    if (near) { const d = 30; g.tx = g.x + Math.sin(g.yaw) * d; g.tz = g.z + Math.cos(g.yaw) * d; g.re = 15; g.rest = 0; }
    L.groups.push(g); return g;
  }
  /** neues Ziel; im Wald bleibt das Ziel im Tang, beim Ausweichen geht es dorthin, wo er am dichtesten ist */
  function retarget(g, sub, away) {
    const c = g.c; let best = null, bs = -1e9;
    for (let k = 0; k < (away ? 6 : 8); k++) {
      let a = R() * 2 * PI; if (away) a = Math.atan2(g.x - sub.x, g.z - sub.z) + rr(-0.9, 0.9);
      else if (g.forest && c.close && L.av && R() < 0.35 && Math.hypot(g.x - L.av.x, g.z - L.av.z) < 30) { const b = R() * 2 * PI, q = rr(4, 8); const px = L.av.x + Math.sin(b) * q, pz = L.av.z + Math.cos(b) * q; a = Math.atan2(px - g.x, pz - g.z); }   // neugierig: zum Boot hin
      const d = away ? rr(8, 16) : g.forest ? rr(6, 18) : c === C.manta ? rr(30, 60) : rr(10, 30) * (c.speed > 1.4 ? 1.6 : 1);
      const tx = g.x + Math.sin(a) * d, tz = g.z + Math.cos(a) * d; if (!inBiome(tx, tz)) continue;
      const fl = floorH(tx, tz); if (fl < REEF_DEPTH - 6) continue;
      const ty = c.floor ? fl + rr(c.h[0], c.h[1]) : wantY(c, tx, tz, fl, g.up); if (!freeAt(tx, ty, tz, c === C.manta ? 5 : 1.5)) continue;
      const fk = forestK(tx, tz); if (g.forest && fk < 0.5 && !away) continue;
      const s = away ? (g.forest ? denseK(tx, tz) * 3 + fk : 0) + R() * 0.3 : R(); if (s > bs) { bs = s; best = [tx, ty, tz]; }
    }
    if (best) { g.tx = best[0]; g.ty = best[1]; g.tz = best[2]; }
    else { const a = g.yaw + PI + rr(-0.6, 0.6); g.tx = g.x + Math.sin(a) * 12; g.tz = g.z + Math.cos(a) * 12; g.ty = g.y; }   // nichts gefunden: umkehren
    g.re = away ? rr(5, 9) : rr(8, 20);
  }
  /** Wie viel Tangwald es rings um das Boot gibt (0 bis 1) */
  function forestShare(sub) { let s = 0; for (let i = 0; i < 24; i++) { const a = i * 2.4, d = 12 + (i % 6) * 13; s += forestK(sub.x + Math.sin(a) * d, sub.z + Math.cos(a) * d) > 0.45 ? 1 : 0; } return s / 24; }

  L.spawnNear = (key, sub) => spawn(key, sub, false, true);
  L.clear = () => { L.groups.length = 0; };
  L.counts = () => { const o = {}; for (const k of KEYS) o[k] = 0; for (const g of L.groups) o[g.key] += g.mem.length; return o; };
  L.countNear = (x, z, r) => { let n = 0; for (const g of L.groups) if (Math.hypot(g.x - x, g.z - z) < r) n += g.mem.length; return n; };
  L.update = (dt, sub, avoid) => {
    dt = Math.min(dt, 0.1); L.av = avoid; L.fT -= dt; if (L.fT <= 0) { L.fT = 1.5; L.fF = forestShare(sub); }
    // auffüllen: je Art offene Gruppen und Waldgruppen, höchstens zwei neue Gruppen je Bild
    let made = 0;
    if (atlK(sub.x, sub.z) > 0 || sub.x < -300) for (const key of KEYS) {
      if (made >= 2) break; const c = C[key]; let open = 0, fo = 0; for (const g of L.groups) if (g.key === key) { if (g.forest) fo++; else open++; }
      const wantF = Math.round(c.nF * 2 * Math.min(1, L.fF * 1.5));
      if (fo < wantF) { if (spawn(key, sub, true)) made++; }
      else if (open < c.n) { if (spawn(key, sub, false)) made++; }
    }
    for (let i = L.groups.length - 1; i >= 0; i--) {
      const g = L.groups[i], c = g.c, dS = Math.hypot(g.x - sub.x, g.z - sub.z);
      if (dS > 105) { L.groups.splice(i, 1); continue; }
      const dA = Math.hypot(g.x - avoid.x, g.y - avoid.y, g.z - avoid.z), scare = c === C.manta ? 0 : g.forest && c.close ? 3.5 : c.floor ? 6 : g.forest ? 7 : 9;   // im Wald lassen sie das Boot näher heran und huschen dann tiefer in den Tang
      g.flee = Math.max(0, g.flee - dt);
      if (dA < scare && g.flee <= 0) { retarget(g, avoid, true); g.flee = 4; g.rest = 0; }
      // Bodentiere: liegen still; ab und zu (oder wenn das Boot kommt) ein Stück weiter
      if (c.floor && g.rest > 0) {
        g.rest -= dt; const fl = floorH(g.x, g.z); g.y += (fl + (c === C.ray ? 0.06 : 0.04) * g.mem[0].size - g.y) * Math.min(1, dt * 2); g.pitch = 0;
        if (g.rest <= 0) retarget(g, sub, false);
      } else {
        g.re -= dt; const dT = Math.hypot(g.tx - g.x, g.tz - g.z);
        if (g.re <= 0 || dT < 2.5) { if (c.floor && g.flee <= 0) { g.rest = c === C.ray ? rr(20, 60) : rr(25, 80); g.tx = g.x; g.tz = g.z; } else retarget(g, sub, false); }
        let dx = g.tx - g.x, dy = g.ty - g.y, dz = g.tz - g.z;
        const ahx = g.x + Math.sin(g.yaw) * 4, ahz = g.z + Math.cos(g.yaw) * 4, fla = floorH(ahx, ahz), low = c.floor ? 0.4 : c.minH || Math.max(0.8, c.h[0] * 0.6);
        if (g.y < fla + low) dy += (fla + low + 0.5 - g.y) * 3;
        if (!freeAt(ahx, g.y, ahz, c === C.manta ? 4 : 1.2)) { g.yaw += dt * c.turn * 1.5; g.re = Math.min(g.re, 0.6); }   // Fels voraus: abdrehen
        if (!inBiome(ahx, ahz)) { let a = g.yaw + PI, bk = -1; for (let j = 0; j < 8; j++) { const b = j * PI / 4, px = g.x + Math.sin(b) * 25, pz = g.z + Math.cos(b) * 25, kk = inBiome(px, pz) ? 1 + R() : atlK(px, pz) * 0.5; if (kk > bk) { bk = kk; a = b; } } g.tx = g.x + Math.sin(a) * 20; g.tz = g.z + Math.cos(a) * 20; g.re = 6; }   // am Rand des Bioms (oder der Stadt): zurück ins Riff
        const wy = Math.atan2(dx, dz), wp = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, Math.hypot(dx, dz)))), tr = c.turn * (g.flee > 0 ? 2 : 1);
        g.yaw = wrap(g.yaw + Math.max(-tr * dt, Math.min(tr * dt, wrap(wy - g.yaw)))); g.pitch += (wp - g.pitch) * Math.min(1, dt * 1.2);
        const sp = g.sp * (g.flee > 0 ? 2.2 : 1) * (c.floor ? 1 : 0.9 + 0.1 * Math.sin(g.mem[0].w + g.re));
        g.x += Math.sin(g.yaw) * Math.cos(g.pitch) * sp * dt; g.z += Math.cos(g.yaw) * Math.cos(g.pitch) * sp * dt; g.y += Math.sin(g.pitch) * sp * dt;
        const fl = floorH(g.x, g.z), mh = c.floor ? 0.05 : c.minH || 0.6; if (c.minH && g.y < fl + mh) g.y += (fl + mh - g.y) * Math.min(1, dt * 1.5); if (g.y < fl + mh * 0.7) g.y = fl + mh * 0.7; if (g.y > -6) g.y = -6;   // der Manta hält Abstand zum Grund
      }
      // die einzelnen Tiere: folgen ihrem Platz in der Gruppe, schwanken ein wenig, weichen dem Boot einzeln aus
      const cy = Math.cos(g.yaw), sy = Math.sin(g.yaw), moving = !(c.floor && g.rest > 0), k = Math.min(1, dt * (g.mem.length > 1 ? 1.4 : 6));
      for (const f of g.mem) {
        f.w += dt * 0.7; const wob = g.mem.length > 1 ? 0.35 : 0;
        const tx = g.x + f.o[0] * cy + f.o[2] * sy + Math.sin(f.w) * wob, ty = g.y + f.o[1] + Math.sin(f.w * 1.3) * wob * 0.5, tz = g.z - f.o[0] * sy + f.o[2] * cy + Math.cos(f.w * 0.8) * wob;
        f.x += (tx - f.x) * k; f.y += (ty - f.y) * k; f.z += (tz - f.z) * k;
        const bx = f.x - avoid.x, by = f.y - avoid.y, bz = f.z - avoid.z, bd = Math.hypot(bx, by, bz) || 1; const ar = g.forest && c.close ? 2.5 : 4.5; if (bd < ar && c !== C.manta) { const w = (ar - bd) * dt * 3; f.x += bx / bd * w; f.y += by / bd * w * 0.4; f.z += bz / bd * w; }
        const flo = floorH(f.x, f.z); if (f.y < flo + 0.04 * f.size) f.y = flo + 0.04 * f.size;
        const dyaw = wrap(g.yaw + (g.mem.length > 1 ? Math.sin(f.w * 0.9) * 0.15 : 0) - f.yaw); f.yaw = wrap(f.yaw + dyaw * Math.min(1, dt * 3)); f.pitch = g.pitch; f.roll += (-dyaw * 0.6 - f.roll) * Math.min(1, dt * 2);
        const rate = moving ? (g.flee > 0 ? 1.7 : 1) : 0.35; f.amp = moving ? (g.flee > 0 ? 1.3 : 1) : 0.15;
        f.ph = (f.ph + dt * c.beat * 2 * PI * rate) % (PI * 2000);
      }
    }
    for (const key of KEYS) M[key].list.length = 0;
    for (const g of L.groups) { const lst = M[g.key].list; for (const f of g.mem) lst.push(f); }
    for (const key of KEYS) M[key].sync();
  };
  return L;
}
