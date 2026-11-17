// tiefseefische.js – drei neue Tiefseearten für Tiefenlicht: Tiefsee-Mondfisch, Riesen-Schlammstachel, Laternenfisch (für Schwärme).
// Stand: Vorschau vom 17.11.2026, noch nicht im Spiel eingebaut.
//
// Abhängigkeiten aus dem Spiel: T (Three.js r128) aus util.js, uni() und COMMON (Licht, Wasser, Nebel) aus gfx.js.
// Benutzung: const F = createDeepFish(scene); dann je Bild für jede Art die Liste füllen und sync() aufrufen, z. B.
//   F.mola.list = [{ x, y, z, size: 3.3, yaw, pitch, roll, ph, amp: 1, seed, glow }]; F.mola.sync();
//   x/y/z Weltlage, size = Länge (Mondfisch: Höhe ≈ Länge) in Metern, yaw/pitch/roll in Bogenmaß (yaw = atan2(dx, dz) der Schwimmrichtung),
//   ph = Phase der Schwimmbewegung (pro Bild weiterzählen: Mondfisch ≈ 2π·0.42/s, Schlammstachel ≈ 2π·0.55/s, Laternenfisch ≈ 2π·2.6/s),
//   amp = Stärke der Bewegung (Mondfisch und Schlammstachel 1, Laternenfisch 0.35), seed = Zufallszahl je Tier, glow = 0…1.
// Vorgeschlagene Größen: Mondfisch 3.3 m, Schlammstachel 3.7 m, Laternenfisch 0.27–0.35 m (Schwarm aus 100).
import { T } from './util.js';
import { uni, COMMON } from './gfx.js';

const PI = Math.PI, TAU = PI * 2;
const sm = (k) => k * k * (3 - 2 * k), cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const zOf = (t) => 0.5 - t;
function hash(i) { let h = Math.imul(i + 17, 374761393); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- Baukasten: alles sind Gitter (Reihen × Spalten); Normalen aus den Nachbarn, auf Wunsch nach außen gedreht ----------
class Build {
  constructor(withC) { this.P = []; this.N = []; this.K = []; this.C = withC ? [] : null; this.I = []; this.n = 0; }
  grid(nu, nv, pos, key, wrap, out, center) {
    const b = this.n, pts = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = pos(i, j); pts.push(p); this.P.push(p[0], p[1], p[2]); this.K.push(...key(i, j)); if (this.C) this.C.push(...(center ? center(i, j) : p)); this.n++; }
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
  /** Röhre entlang einer Punktfolge; rad(s) Radius, key(s, a) Attribute */
  tube(pts, rad, sides, key, center) {
    const n = pts.length - 1, F = frames(pts);
    this.grid(n, sides, (i, j) => { const a = j / sides * TAU, f = F[i], r = rad(i / n); return add(pts[i], add(f.n.map((x) => x * Math.cos(a)), f.b, Math.sin(a)), r); },
      (i, j) => key(i / n, j / sides), true, (i) => pts[i], center);
  }
  /** Ellipsoid; key(q, a) mit q = 0 oben … 1 unten */
  ellipsoid(c, rx, ry, rz, key, nu = 8, nv = 12, center) {
    this.grid(nu, nv, (i, j) => { const f = i / nu * PI, a = j / nv * TAU; return [c[0] + rx * Math.sin(f) * Math.cos(a), c[1] + ry * Math.cos(f), c[2] + rz * Math.sin(f) * Math.sin(a)]; },
      (i, j) => key(i / nu, j / nv), true, () => c, center);
  }
  geo(instanced) {
    const g = instanced ? new T.InstancedBufferGeometry() : new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('aK', new T.BufferAttribute(new Float32Array(this.K), 4)); if (this.C) g.setAttribute('aC', new T.BufferAttribute(new Float32Array(this.C), 3));
    g.setIndex(this.I); return g;
  }
}
/** Rahmen entlang einer Kurve (mitgeführt, damit sich Röhren nicht verdrehen) */
function frames(pts) {
  const F = []; let nPrev = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = norm(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let n; if (!nPrev) { const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; n = norm(...cross(cross(t, up), t)); } else { const d = nPrev[0] * t[0] + nPrev[1] * t[1] + nPrev[2] * t[2]; n = norm(nPrev[0] - t[0] * d, nPrev[1] - t[1] * d, nPrev[2] - t[2] * d); }
    nPrev = n; F.push({ t, n, b: cross(t, n) });
  }
  return F;
}
// Körperform: Reihen [t (0 = Schnauze, 1 = Schwanzende), Höhe, Breite, Mittelhöhe]; dazwischen kubisch (Hermite), damit die Flanken ohne Knicke und Streifen durchlaufen
function prof(rows, t) {
  const n = rows.length; let i = 0; while (i < n - 2 && t > rows[i + 1][0]) i++;
  const r0 = rows[i], r1 = rows[i + 1], dt = r1[0] - r0[0], s = cl((t - r0[0]) / dt, 0, 1), s2 = s * s, s3 = s2 * s;
  const tan = (k, c) => { const a = rows[Math.max(0, k - 1)], b = rows[Math.min(n - 1, k + 1)]; return (b[c] - a[c]) / (b[0] - a[0]); };
  const out = [0, 0, 0];
  for (let c = 1; c <= 3; c++) { const v = (2 * s3 - 3 * s2 + 1) * r0[c] + (s3 - 2 * s2 + s) * dt * tan(i, c) + (-2 * s3 + 3 * s2) * r1[c] + (s3 - s2) * dt * tan(i + 1, c); out[c - 1] = c < 3 ? Math.max(0.0015, Math.min(v, Math.max(r0[c], r1[c]) * 1.08)) : v; }
  return out;
}
/** Punkt auf der Körperoberfläche (t entlang, a rundherum: 0 = rechte Seite, π/2 = oben) */
function surf(rows, o, t, a) {
  const e = o.e || 0.87, [h, w, yc] = prof(rows, t), ca = Math.cos(a), sa = Math.sin(a), r = o.bump ? o.bump(t, a) : 1;
  return [Math.sign(ca) * Math.pow(Math.abs(ca), e) * w * r, yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h * r * (sa < 0 && o.low ? o.low(t) : 1), zOf(t)];
}
/** Körper; in aK.w steht die Höhe auf der Flanke (-1 Bauch … 1 Rücken) für die Muster */
function body(B, rows, o) {
  const NT = o.NT, NA = o.NA, e = o.e || 0.87, tt = (i) => Math.pow(i / NT, o.tp || 1.1);
  B.grid(NT, NA, (i, j) => surf(rows, o, tt(i), j / NA * TAU),
    (i, j) => { const sa = Math.sin(j / NA * TAU); return [tt(i), 0, j / NA, Math.sign(sa) * Math.pow(Math.abs(sa), e)]; }, true,
    (i) => { const t = tt(i), [, , yc] = prof(rows, t); return [0, yc, zOf(t)]; });
}
/** Flosse: Haut zwischen Wurzellinie root(u) = [x, y, z, t] und Rand; aK = (t der Wurzel, Teil, v Wurzel→Rand, u·Strahlen) */
function fin(B, nu, root, dir, len, part, rays, nv = 6, curl) {
  B.grid(nu, nv, (i, j) => { const u = i / nu, v = j / nv, r = root(u), d = dir(u), L = len(u), c = curl ? curl(u, v) : null; const p = [r[0] + d[0] * L * v, r[1] + d[1] * L * v, r[2] + d[2] * L * v]; return c ? add(p, c) : p; },
    (i, j) => [root(i / nu)[3], part, j / nv, i / nu * rays], false);
}
/** gewölbtes Auge nach außen (sx = Seite); aK.z: 0 Mitte … 1 Rand */
function eye(B, c, sx, r, t, bulge) {
  B.grid(6, 20, (i, j) => { const f = i / 6 * PI / 2, a = j / 20 * TAU; return [c[0] + sx * r * bulge * Math.cos(f), c[1] + r * Math.sin(f) * Math.cos(a), c[2] + r * Math.sin(f) * Math.sin(a)]; },
    (i, j) => [t, 4, i / 6, j / 20], true, () => [c[0] - sx * r, c[1], c[2]]);
}

// ---------- Die Arten ----------
// Tiefsee-Mondfisch: scheibenförmig, sehr hoch und flach, hohe Rücken- und Afterflosse, statt Schwanz ein gewellter Ruderkamm
const MOLA = [[0, 0.03, 0.02, -0.012], [0.03, 0.11, 0.05, -0.006], [0.09, 0.2, 0.074, 0], [0.18, 0.285, 0.09, 0.004], [0.32, 0.335, 0.1, 0.004], [0.5, 0.345, 0.096, 0], [0.66, 0.32, 0.086, 0], [0.8, 0.27, 0.07, 0], [0.92, 0.215, 0.05, 0], [0.975, 0.19, 0.032, 0], [1, 0.02, 0.006, 0]];
function buildMola() {
  const B = new Build(), o = { NT: 50, NA: 34, e: 0.8, tp: 1.0 };
  body(B, MOLA, o);
  for (const up of [1, -1]) {   // Rücken- und Afterflosse: hoch, spitz, nach hinten gestrichen
    fin(B, 18, (u) => { const t = 0.6 + 0.21 * u, [h, , yc] = prof(MOLA, t); return [0, yc + up * h * 0.95, zOf(t), t]; },
      (u) => norm(0, up, -(0.62 - 0.38 * u)), (u) => 0.52 * (1 - 0.74 * u) * (0.28 + 0.72 * Math.min(1, u * 4.5 + 0.12)) * (1 - 0.3 * Math.pow(u, 3)), up > 0 ? 1.0 : 1.2, 13, 9);
  }
  // Ruderkamm (Clavus): über die ganze Hinterkante, mit Wellenrand
  fin(B, 40, (u) => { const [h, , yc] = prof(MOLA, 0.968); return [0, yc + (u * 2 - 1) * h * 0.97, zOf(0.968), 0.968]; },
    (u) => norm(0, (u * 2 - 1) * 0.4, -1), (u) => { const s = Math.abs(u * 2 - 1); return 0.12 * (0.5 + 0.5 * Math.pow(Math.abs(Math.sin(u * PI * 6.5)), 0.5)) * (1 - 0.4 * s * s); }, 1.4, 14, 5);
  for (const sx of [-1, 1]) {   // kleine runde Brustflosse
    const t0 = 0.34, [, w, yc] = prof(MOLA, t0);
    fin(B, 9, (u) => [sx * w * 0.86, yc - 0.03 + (u - 0.5) * 0.075, zOf(t0) + 0.01, t0], () => norm(sx * 0.35, 0.04, -1), (u) => 0.105 * Math.pow(Math.sin(PI * (0.08 + 0.84 * u)), 0.7), 2 + (sx > 0 ? 0 : 0.5), 8);
    const te = 0.165, p = surf(MOLA, o, te, sx > 0 ? 0.32 : PI - 0.32);
    eye(B, [p[0] * 0.97, p[1], p[2]], sx, 0.036, te, 0.42);
  }
  return B.geo(true);
}
// Laternenfisch: klein, großer Kopf mit riesigen Augen, Reihen von Leuchtorganen am Bauch, Gabelschwanz
const LANT = [[0, 0.025, 0.02, -0.012], [0.04, 0.085, 0.062, -0.006], [0.12, 0.125, 0.078, 0], [0.25, 0.132, 0.072, 0.005], [0.45, 0.116, 0.06, 0.005], [0.65, 0.085, 0.045, 0], [0.82, 0.05, 0.027, 0], [0.93, 0.036, 0.018, 0], [1, 0.034, 0.012, 0]];
function buildLantern() {
  const B = new Build(), o = { NT: 26, NA: 14, e: 0.85 };
  body(B, LANT, o);
  const med = (a, b, h, sweep, rays, part, up) => fin(B, 8, (u) => { const t = a + (b - a) * u, [hh, , yc] = prof(LANT, t); return [0, yc + up * hh * 0.93, zOf(t), t]; }, () => norm(0, up, -sweep), (u) => h * (0.3 + 0.7 * Math.sin(PI * (0.12 + 0.88 * u))) + 0.004, part, rays, 4);
  med(0.36, 0.56, 0.1, 0.45, 11, 1.0, 1); med(0.78, 0.85, 0.03, 0.6, 0, 1.0, 1); med(0.55, 0.79, 0.065, 0.5, 9, 1.2, -1);
  fin(B, 12, (u) => { const [h, , yc] = prof(LANT, 0.995); return [0, yc + (u * 2 - 1) * h * 0.85, zOf(1) + 0.004, 1]; }, (u) => norm(0, (u * 2 - 1) * 0.8, -1),
    (u) => { const s = Math.abs(u * 2 - 1); return 0.19 * (1 - 0.6 * Math.pow(1 - s, 1.4)) * (0.55 + 0.45 * s); }, 1.4, 12, 4);
  for (const sx of [-1, 1]) {
    const [h, w, yc] = prof(LANT, 0.21); fin(B, 6, (u) => [sx * w * 0.85, yc - h * 0.3 + (u - 0.5) * 0.02, zOf(0.21) - u * 0.03, 0.21], () => norm(sx * 0.6, -0.3, -0.75), (u) => 0.09 * Math.sin(PI * (0.2 + 0.8 * u)), 2 + (sx > 0 ? 0 : 0.5), 7, 4);
    const p = surf(LANT, o, 0.1, sx > 0 ? 0.2 : PI - 0.2); eye(B, [p[0] * 0.95, p[1], p[2]], sx, 0.058, 0.1, 0.5);
  }
  return B.geo(true);
}
// Riesen-Schlammstachel: lang und schlank wie ein Aal, hoher Stachelkamm vorn, langer Saum bis in die Rattenschwanzspitze, lange Bauchfäden
const EEL = [[0, 0.004, 0.004, -0.004], [0.025, 0.022, 0.018, -0.004], [0.06, 0.04, 0.032, 0], [0.12, 0.052, 0.04, 0.003], [0.2, 0.056, 0.042, 0.004], [0.32, 0.052, 0.038, 0.003], [0.45, 0.045, 0.032, 0.002], [0.6, 0.035, 0.024, 0.001], [0.75, 0.025, 0.016, 0], [0.88, 0.013, 0.009, 0], [1, 0.002, 0.002, 0]];
function buildEel() {
  const B = new Build(), o = { NT: 90, NA: 14, e: 0.9, tp: 1.0 };
  body(B, EEL, o);
  // erster Rückenkamm: hoch, stachelig
  fin(B, 14, (u) => { const t = 0.165 + 0.08 * u, [h, , yc] = prof(EEL, t); return [0, yc + h * 0.94, zOf(t), t]; }, (u) => norm(0, 1, -(0.75 - 0.3 * u)),
    (u) => { const q = Math.abs(Math.sin(u * 7 * PI + PI / 2)); return (0.085 * Math.pow(1 - u, 0.7) * (0.3 + 0.7 * Math.min(1, u * 6)) + 0.003) * (1 - 0.45 * (1 - Math.pow(q, 3))); }, 1.0, 7, 6);
  // langer Saum oben und unten bis in die Spitze
  for (const [a, up, h, part] of [[0.27, 1, 0.022, 1.0], [0.33, -1, 0.02, 1.2]]) {
    fin(B, 80, (u) => { const t = a + (0.995 - a) * u, [hh, , yc] = prof(EEL, t); return [0, yc + up * hh * 0.9, zOf(t), t]; }, () => norm(0, up, -0.35),
      (u) => h * (0.5 + 0.5 * Math.sin(PI * Math.min(1, u * 3))) * (1 - 0.55 * u) + 0.002, part, 70, 3);
  }
  for (const sx of [-1, 1]) {
    const [h, w, yc] = prof(EEL, 0.1);   // Brustflosse mit langen Strahlen
    fin(B, 9, (u) => [sx * w * 0.9, yc - h * 0.2 + (u - 0.5) * 0.025, zOf(0.1), 0.1], (u) => norm(sx * 0.55, -0.2 + u * 0.2, -0.8), (u) => 0.075 * (0.6 + 0.4 * Math.sin(PI * u)) * (1 - 0.35 * Math.pow(Math.abs(Math.sin(u * 9 * PI)), 4)), 2 + (sx > 0 ? 0 : 0.5), 9, 5);
    const p = surf(EEL, o, 0.045, sx > 0 ? 0.35 : PI - 0.35); eye(B, [p[0] * 0.95, p[1], p[2]], sx, 0.0115, 0.045, 0.55);
    // Bauchfaden: lang, dünn, nach hinten unten
    const b0 = surf(EEL, o, 0.15, -PI / 2), pts = []; for (let i = 0; i <= 16; i++) { const q = i / 16; pts.push([b0[0] + sx * 0.012 * q, b0[1] - 0.09 * q + 0.03 * q * q, b0[2] - 0.2 * q - 0.04 * q * q]); }
    B.tube(pts, (q) => 0.0035 * (1 - 0.7 * q), 4, (q) => [0.15, 5, q, 0]);
  }
  return B.geo(true);
}

// ---------- Shader der Fische ----------
const VS = (mode) => /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  void main(){ vec3 p = position, nr = normal; float t = aK.x, part = aK.y, vv = aK.z, ph = iA.x, amp = iA.y, bt = clamp(t, 0.0, 1.0);
    ${mode === 'fish' ? `p.x += sin(ph - t * 5.6) * amp * bt * bt * 0.16;
      if (part > 0.9 && part < 1.9) { p.x += sin(ph * 1.3 - vv * 2.5 + aK.w * 0.4) * 0.02 * vv * (0.4 + amp); if (part > 1.3) p.x += sin(ph - 1.0) * amp * 0.12 * vv; }
      if (part > 1.9 && part < 3.0) { float fl = sin(uTime * 2.2 + iA.z + vv * 1.5) * 0.25 * vv; p.y += fl * 0.12; p.x *= 1.0 + fl * 0.3; }
      if (part > 4.9 && part < 6.0) p.x += sin(uTime * 0.9 + iA.z) * 0.012 * vv;` : ''}
    ${mode === 'eel' ? `p.x += sin(ph - bt * 9.0) * amp * (0.1 + 0.9 * bt) * 0.075;
      if (part > 0.9 && part < 1.9) p.x += sin(ph - bt * 9.0 - vv * 1.5) * 0.01 * vv * amp;
      if (part > 1.9 && part < 3.0) { float fl = sin(uTime * 1.6 + iA.z + vv * 1.5) * 0.3 * vv; p.y += fl * 0.06; p.x *= 1.0 + fl * 0.4; }
      if (part > 4.5) { p.x += sin(uTime * 0.8 + vv * 3.0 + iA.z) * 0.02 * vv; p.y += sin(uTime * 0.6 + vv * 2.0) * 0.012 * vv; }` : ''}
    ${mode === 'mola' ? `p.x += sin(ph - bt * 3.0) * amp * 0.012 * bt; float flap = sin(ph) * amp;
      if (part > 0.9 && part < 1.1) p.x += flap * vv * vv * 0.19 + sin(ph - vv * 1.2) * 0.025 * vv * amp;
      if (part > 1.1 && part < 1.3) p.x -= flap * vv * vv * 0.19 + sin(ph - vv * 1.2) * 0.025 * vv * amp;
      if (part > 1.3 && part < 1.9) p.x += sin(ph * 2.0 + aK.w * 0.6) * 0.01 * vv;
      if (part > 1.9 && part < 3.0) p.x *= 1.0 + sin(uTime * 2.0 + iA.z + vv * 1.5) * 0.12 * vv;` : ''}
    vL = p; p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
// gemeinsamer Teil: Rauschen, Glanz im Scheinwerfer und im Leuchtlicht, Licht und Nebel wie im Spiel
const FHEAD = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lampHit(vec3 wp){ vec3 L = wp - uLampPos; float d = length(L); return smoothstep(0.84, 0.97, dot(L / max(d, 0.001), uLampDir)) * uLampOn * 6.0 / (3.0 + d * d * 0.04); }
  vec3 gloss(vec3 N, vec3 V, vec3 wp, float pw){ vec3 L = normalize(uLampPos - wp); vec3 s = vec3(0.75, 0.92, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), pw) * lampHit(wp);
    for (int i = 0; i < 4; i++) { vec3 g = uGlow[i].xyz - wp; float r = length(g); s += uGlowCol[i] * pow(max(dot(reflect(-g / max(r, 0.001), N), V), 0.0), pw) * uGlow[i].w * 0.7 / (1.0 + r * r * 0.5); }
    return s; }
  void main(){ vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW); bool outer = dot(N0, V) > 0.0; vec3 N = outer ? N0 : -N0;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x, gl = vI.y; vec3 base = vec3(0.1), glow = vec3(0.0); float spec = 0.15, pw = 24.0;
    float pulse = 0.82 + 0.18 * sin(uTime * 1.3 + seed * 3.0);`;
const FTAIL = /* glsl */ `
    vec3 c = shade(base, N, vW) * 1.25 + base * 0.03 + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.2 + gloss(N, V, vW, pw) * spec;
    c += glow * (0.85 + 0.3 * gl);
    c += (base * 0.7 + vec3(0.05, 0.1, 0.15)) * REST * (0.3 + pow(1.0 - max(dot(N, V), 0.0), 2.0) * 1.4);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;

const FS = {
  mola: FHEAD + /* glsl */ `
    vec2 s = vec2(vL.z, vL.y);
    if (part < 0.5) {
      float ny = u, top = smoothstep(-0.4, 0.7, ny), m1 = texture2D(uNoise, s * 1.6 + 0.3).r, m2 = texture2D(uNoise, s * 5.5).g;
      base = mix(vec3(0.16, 0.22, 0.28), vec3(0.075, 0.11, 0.15), top) * (0.72 + 0.5 * m1) * (0.9 + 0.2 * m2);
      base = mix(base, vec3(0.22, 0.32, 0.38), smoothstep(0.78, 0.95, abs(ny)) * 0.35);
      vec2 g = s / 0.021, id = floor(g); float r = h21(id), dt = 1.0 - smoothstep(0.13, 0.3, length(fract(g) - 0.5));
      float an = abs(ny), b1 = smoothstep(0.885, 0.9, an) * (1.0 - smoothstep(0.935, 0.95, an)), b2 = smoothstep(0.66, 0.67, an) * (1.0 - smoothstep(0.7, 0.71, an));
      float arc = (1.0 - smoothstep(0.0, 0.017, abs(length(s - vec2(0.43, 0.02)) - 0.17))) * step(s.x, 0.43);
      float gil = (1.0 - smoothstep(0.0, 0.014, abs(length((s - vec2(0.22, -0.02)) * vec2(1.0, 0.7)) - 0.075))) * step(s.x, 0.24);
      float sc = step(0.975, r) * smoothstep(0.1, 0.25, t);
      float m = (b1 * step(0.3, r) + b2 * step(0.55, r) + arc * step(0.4, r) + gil * step(0.5, r) + sc) * step(0.045, t) * step(t, 0.955);
      float tw = 0.7 + 0.3 * sin(uTime * 1.7 + r * 40.0);
      glow = vec3(0.2, 0.88, 1.0) * dt * m * 1.5 * tw; base = mix(base, vec3(0.45, 0.85, 0.95), dt * m * 0.6);
      base *= 1.0 - 0.75 * (1.0 - smoothstep(0.012, 0.03, t));   // kleiner runder Mund
      float gs = 1.0 - smoothstep(0.0, 0.005, length((s - vec2(0.19, -0.03)) * vec2(3.5, 1.0)) - 0.022); base *= 1.0 - 0.4 * gs;   // Kiemenspalt
      spec = 0.35; pw = 30.0;
    } else if (part < 3.5) {
      float ray = 1.0 - smoothstep(0.0, 0.2, abs(fract(u) - 0.5) - 0.3), ed = smoothstep(0.9, 1.0, vv);
      base = mix(vec3(0.12, 0.17, 0.22), vec3(0.06, 0.1, 0.14), vv) * (0.75 + 0.35 * ray); if (part > 1.9) base = mix(vec3(0.2, 0.28, 0.34), vec3(0.3, 0.42, 0.48), vv) * (0.8 + 0.3 * ray);
      vec2 q = vec2((fract(u) - 0.5) * 3.2, fract(vv * 6.0) - 0.5); float dd = (1.0 - smoothstep(0.1, 0.24, length(q))) * smoothstep(0.3, 0.7, vv) * step(0.35, h21(vec2(floor(u), floor(vv * 6.0))));
      glow = vec3(0.2, 0.88, 1.0) * (dd * 1.2 + ed * 0.7) * pulse; spec = 0.2;
    } else if (part < 4.5) {
      base = vv < 0.42 ? vec3(0.01, 0.015, 0.02) : mix(vec3(0.35, 0.45, 0.52), vec3(0.12, 0.2, 0.25), smoothstep(0.42, 0.8, vv));
      glow = vec3(0.25, 0.9, 1.0) * smoothstep(0.78, 0.9, vv) * (1.0 - smoothstep(0.95, 1.0, vv)) * 1.6 * pulse; spec = 1.6; pw = 70.0;
    }` + FTAIL,
  lantern: FHEAD + /* glsl */ `
    float tw = 0.55 + 0.45 * sin(uTime * 1.4 + seed * 7.0 + t * 6.0);
    if (part < 0.5) {
      float ny = u, top = smoothstep(0.05, 0.55, ny);
      vec2 sc = vec2(t * 34.0, vv * 24.0); sc.y += floor(sc.x) * 0.5; float scl = smoothstep(0.3, 0.5, length((fract(sc) - 0.5) * vec2(1.0, 1.3)));
      base = mix(vec3(0.3, 0.37, 0.44), vec3(0.025, 0.045, 0.09), top) * (1.0 - 0.18 * scl); base = mix(base, vec3(0.45, 0.5, 0.56), (1.0 - smoothstep(-0.9, -0.45, ny)) * 0.4);
      float dx = (fract(t * 22.0) - 0.5) / 22.0, hh = 0.11 * (1.0 - smoothstep(0.5, 0.9, t) * 0.55);
      float pd = (1.0 - smoothstep(0.0045, 0.0085, length(vec2(dx, (ny + 0.5) * hh)))) + (1.0 - smoothstep(0.0045, 0.0085, length(vec2(dx, (ny + 0.8) * hh))))
        + (1.0 - smoothstep(0.004, 0.0075, length(vec2(dx, (ny + 0.18) * hh)))) * step(0.3, t) * step(t, 0.75) * step(0.5, fract(t * 11.0));
      float pp = pd * step(0.12, t) * step(t, 0.86), head = (1.0 - smoothstep(0.02, 0.05, length(vec2((t - 0.075) * 3.0, ny + 0.4)))) ;
      float gland = smoothstep(0.86, 0.88, t) * (1.0 - smoothstep(0.93, 0.95, t)) * smoothstep(0.55, 0.7, abs(ny));
      float far = smoothstep(1.5, 7.0, length(cameraPosition - vW)), belly = (1.0 - smoothstep(-0.75, -0.25, ny)) * step(0.1, t) * step(t, 0.88);
      glow = vec3(0.3, 0.72, 1.0) * (pp * 3.6 + head * 2.4) * tw * (1.0 - far * 0.5) + vec3(0.45, 0.85, 1.0) * gland * 1.8 * (0.5 + 0.5 * tw) + vec3(0.3, 0.7, 1.0) * (belly * 1.6 + (1.0 - smoothstep(-0.15, 0.3, ny)) * 0.8 * step(0.12, t) * step(t, 0.9)) * far * tw;
      base = mix(base, vec3(0.12, 0.16, 0.26), clamp(pp, 0.0, 1.0) * 0.6); spec = 0.8 * (1.0 - top * 0.6); pw = 40.0;
    } else if (part < 3.5) {
      float ray = 1.0 - smoothstep(0.0, 0.2, abs(fract(u) - 0.5) - 0.3);
      base = mix(vec3(0.16, 0.22, 0.3), vec3(0.08, 0.12, 0.18), vv) * (0.7 + 0.35 * ray); glow = vec3(0.3, 0.7, 1.0) * smoothstep(0.8, 1.0, vv) * 0.25 * tw; spec = 0.3;
    } else if (part < 4.5) {
      base = vv < 0.5 ? vec3(0.008, 0.01, 0.014) : mix(vec3(0.45, 0.55, 0.55), vec3(0.15, 0.22, 0.24), smoothstep(0.5, 1.0, vv));
      glow = vec3(0.35, 0.85, 0.75) * smoothstep(0.1, 0.45, vv) * (1.0 - smoothstep(0.5, 0.6, vv)) * lampHit(vW) * 0.6; spec = 2.0; pw = 80.0;
    }` + FTAIL,
  eel: FHEAD + /* glsl */ `
    if (part < 0.5) {
      float ny = u, top = smoothstep(-0.3, 0.6, ny), n1 = texture2D(uNoise, vec2(t * 9.0, vv * 1.3)).r, n0 = texture2D(uNoise, vec2(t * 6.0, vv * 2.0)).g;
      base = mix(vec3(0.26, 0.11, 0.075), vec3(0.11, 0.045, 0.032), top) * (0.75 + 0.4 * n0);
      float lat = 1.0 - smoothstep(0.02, 0.07, abs(ny - 0.03 - sin(t * 31.0) * 0.02));
      float f = fract(t * 46.0 + abs(ny) * 1.1 + n1 * 0.25), chev = (1.0 - smoothstep(0.022, 0.065, min(f, 1.0 - f))) * (1.0 - smoothstep(0.4, 0.85, abs(ny))) * smoothstep(0.3, 0.7, n1 + 0.35);
      float f2 = fract(t * 92.0 - abs(ny) * 1.6 + n1 * 0.5), fine = (1.0 - smoothstep(0.02, 0.05, min(f2, 1.0 - f2))) * smoothstep(0.55, 0.75, n1) * (1.0 - smoothstep(0.5, 0.9, abs(ny))) * 0.55;
      float dors = (1.0 - smoothstep(0.02, 0.07, abs(ny - 0.86))) * 0.45;
      float m = (lat + chev * 0.8 + fine + dors) * step(0.04, t) * (1.0 - smoothstep(0.86, 0.99, t));
      glow = vec3(1.0, 0.3, 0.07) * m * 1.5 * (0.8 + 0.2 * sin(uTime * 0.9 - t * 12.0 + seed)); base = mix(base, vec3(0.85, 0.32, 0.12), clamp(m, 0.0, 1.0) * 0.4);
      base *= 1.0 - 0.7 * (1.0 - smoothstep(0.03, 0.06, t)) * (1.0 - smoothstep(-0.6, -0.3, ny));   // Maul unten an der Spitze
      spec = 0.45; pw = 26.0;
    } else if (part < 3.5) {
      float ray = 1.0 - smoothstep(0.0, 0.2, abs(fract(u) - 0.5) - 0.3);
      base = mix(vec3(0.2, 0.08, 0.06), vec3(0.12, 0.05, 0.04), vv) * (0.75 + 0.3 * ray);
      glow = vec3(1.0, 0.33, 0.08) * (ray * (0.25 + 0.5 * vv) + smoothstep(0.85, 1.0, vv) * 0.25) * pulse; spec = 0.25;
    } else if (part < 4.5) {
      base = vv < 0.5 ? vec3(0.01, 0.005, 0.005) : vec3(0.18, 0.07, 0.05); glow = vec3(1.0, 0.35, 0.1) * smoothstep(0.55, 0.8, vv) * (1.0 - smoothstep(0.9, 1.0, vv)) * 1.4; spec = 1.6; pw = 70.0;
    } else { base = vec3(0.22, 0.09, 0.06); glow = vec3(1.0, 0.35, 0.1) * (0.15 + 1.2 * smoothstep(0.7, 1.0, vv)) * pulse; }` + FTAIL,
};

// ---------- zusammenbauen ----------
export function createDeepFish(scene) {
  /* Restlicht: ein schwaches Eigenleuchten mit hellerem Rand, damit die Form im Dunkeln erkennbar bleibt (schwächer als der Scheinwerfer) */
  const rest = (fs, k) => '#define REST ' + k.toFixed(2) + '\n' + fs;
  const kind = (geo, mode, fs, M) => {
    const iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
    geo.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); geo.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); geo.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); geo.instanceCount = 0;
    const m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS(mode), fragmentShader: fs })); m.frustumCulled = false; scene.add(m);
    return { geo, iP, iR, iA, M, list: [],
      /** schreibt die Tiere in die Instanzdaten: {x, y, z, size, yaw, pitch, roll, ph, amp, seed, glow} */
      sync() { let n = 0; for (const f of this.list) { if (n >= M) break; const o = n * 4; iP.set([f.x, f.y, f.z, f.size], o); iR.set([f.yaw, f.pitch, f.roll || 0, 0], o); iA.set([f.ph, f.amp, f.seed, f.glow], o); n++; }
        geo.instanceCount = n; geo.attributes.iP.needsUpdate = geo.attributes.iR.needsUpdate = geo.attributes.iA.needsUpdate = true; } };
  };
  return {
    mola: kind(buildMola(), 'mola', rest(FS.mola, 0.5), 4), eel: kind(buildEel(), 'eel', rest(FS.eel, 0.0), 4), lantern: kind(buildLantern(), 'fish', rest(FS.lantern, 0.6), 420),
  };
}
