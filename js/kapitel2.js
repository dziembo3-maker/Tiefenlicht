// kapitel2.js – Tiere für Kapitel 2 („Was unter dem Licht lebt“): Riesenkalmar, Vampirtintenfisch, der Leviathan (weißer Pottwal), Dumbo-Oktopus.
// Stand: Vorschau, noch nicht im Spiel eingebaut. Aufbau wie bei den Tiefseefischen: Gitter-Baukasten, eine Instanz je Tier, eigener Shader je Art.
// Benutzung: const K = createChapter2(scene); K.squid.list = [{ x, y, z, size, yaw, pitch, roll, ph, amp, seed, glow }]; K.squid.sync();
//   size = Gesamtlänge in Metern (beim Kalmar mit Fangarmen), ph = Phase der Schwimmbewegung, amp = Stärke der Bewegung (meist 1).
import { T } from './util.js';
import { uni, COMMON, quadPoints } from './gfx.js';
import { WHALE_MESH } from './whale_mesh.js';

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
// zwei sehr lange Fangarme mit blattförmiger Keule; dunkelrot gesprenkelt, Reihen kleiner blauer Leuchtpunkte. Der Mantel zieht voran.
const SQ = [[0, 0.002, 0.002, 0], [0.018, 0.011, 0.011, 0], [0.05, 0.022, 0.022, 0], [0.1, 0.033, 0.033, 0], [0.17, 0.043, 0.042, 0], [0.24, 0.048, 0.046, 0], [0.3, 0.047, 0.045, 0],
  [0.33, 0.044, 0.042, 0.0], [0.338, 0.04, 0.038, 0], [0.352, 0.034, 0.032, 0], [0.372, 0.04, 0.041, 0.001], [0.395, 0.036, 0.036, 0], [0.42, 0.027, 0.026, 0]];
function buildSquid() {
  const B = new Build(), o = { NT: 70, NA: 30, e: 0.95 };
  body(B, SQ, o, 0, 0.42);
  B.ellipsoid([0, 0, zOf(0.42) - 0.004], 0.026, 0.026, 0.012, (q, a) => [0.42, 0, 0.5, Math.cos(a * TAU)], 6, 16);   // Armkrone (Mitte)
  // Flossensaum: zwei Rauten am Mantelende, die Spitze nach vorn
  for (const sx of [-1, 1]) {
    fin(B, 22, (u) => { const t = 0.006 + 0.155 * u, [, w, yc] = prof(SQ, t); return [sx * w * 0.92, yc, zOf(t), t]; }, () => norm(sx, 0, 0.12),
      (u) => { const pk = 0.6, k = u < pk ? Math.pow(u / pk, 0.85) : Math.pow((1 - u) / (1 - pk), 0.65); return 0.068 * k + 0.002; }, 1, 7,
      (u, v) => [0, -0.006 * v * v * Math.sin(PI * u), 0]);
  }
  for (const sx of [-1, 1]) { const p = surf(SQ, o, 0.372, sx > 0 ? 0.1 : PI - 0.1); eye(B, [p[0] * 0.86, p[1], p[2]], sx, 0.023, 0.372, 0.55); }
  // Trichter unter dem Kopf
  { const p0 = surf(SQ, o, 0.335, -PI / 2), pts = []; for (let i = 0; i <= 6; i++) { const q = i / 6; pts.push([0, p0[1] - 0.003 + q * 0.004, p0[2] - 0.004 + q * 0.035]); } B.tube(pts, (q) => 0.011 * (1 - 0.45 * q), 10, (q, a) => [0.34, 0, 0.5, -1]); }
  // acht Arme: am Grund dick, laufen spitz aus, wellig, das Bündel öffnet sich nach hinten ein wenig
  const z0 = zOf(0.42) - 0.004;
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a), L = 0.27 + hash(k) * 0.05, ph = hash(k + 40) * 6, pts = [];
    for (let s = 0; s <= 30; s++) { const q = s / 30, sp = 0.016 + 0.045 * q + 0.04 * q * q, wv = Math.sin(q * PI * 1.9 + ph) * 0.02 * q;
      pts.push([ca * sp - sa * wv, sa * sp * 0.85 + ca * wv, z0 - L * q]); }
    B.tube(pts, (q) => 0.0165 * Math.pow(1 - q, 1.05) + 0.0013, 8, (q, ar) => [0.42 + q * L, 2, q, k + ar * 0.98]);
  }
  // zwei Fangarme: dünner Stiel, am Ende eine flache Keule
  for (let k = 0; k < 2; k++) {
    const sx = k ? 1 : -1, a = -PI / 2 + sx * 0.38, ca = Math.cos(a), sa = Math.sin(a), L = 0.575, pts = [];
    for (let s = 0; s <= 48; s++) { const q = s / 48, sp = 0.02 + 0.03 * q, wv = Math.sin(q * PI * 1.25 + k * 2.1) * 0.022 * q;
      pts.push([ca * sp + sx * wv * 0.6, sa * sp + 0.035 * q * q + wv * 0.5, z0 - L * q]); }
    B.tube(pts, (q) => 0.0068 - 0.0022 * q + (q > 0.8 ? 0.004 * Math.sin(PI * (q - 0.8) / 0.2) : 0), 7, (q, ar) => [0.42 + q * L, 3, q, 8 + k + ar * 0.98]);
    // Keule: blattförmig, breit in der Waagrechten
    const s0 = 38, F = frames(pts);
    B.grid(14, 6, (i, j) => { const s = i / 14, idx = Math.round(s0 + (48 - s0) * s), p = pts[idx], f = F[idx], w = 0.016 * Math.pow(Math.sin(PI * Math.min(1, s * 1.05)), 0.75) + 0.0006, v = j / 6 * 2 - 1;
      const side = norm(...cross(f.t, [0, 1, 0])); return add(p, side, v * w); }, (i, j) => [0.42 + L * (s0 + (48 - s0) * i / 14) / 48, 5, i / 14, j / 6], false);
  }
  return B.geo();
}

// ======================= Vampirtintenfisch =======================
// Vorlage: kurzer runder Mantel mit zwei Ohrflossen, großes blaues Auge, acht Arme mit Haut dazwischen (Umhang), Saum gebogen zwischen den Armen;
// weinrot, Reihen heller Punkte auf den Armen, rot-orange Leuchtorgane an den Flossenwurzeln. Bewegt sich wie eine Qualle: der Umhang öffnet und schließt.
const VP = [[0, 0.004, 0.004, 0], [0.012, 0.026, 0.024, 0], [0.04, 0.05, 0.046, 0], [0.09, 0.066, 0.06, 0], [0.16, 0.074, 0.066, 0], [0.24, 0.074, 0.066, 0], [0.3, 0.068, 0.061, 0],
  [0.34, 0.059, 0.054, 0], [0.36, 0.052, 0.049, 0], [0.385, 0.057, 0.056, 0], [0.415, 0.058, 0.058, 0], [0.445, 0.052, 0.052, 0], [0.47, 0.044, 0.044, 0]];
const VAMP_ARM = (k, q) => { const a = (k + 0.5) / 8 * TAU, R = 0.042 + 0.2 * Math.pow(q, 0.95) - 0.05 * Math.pow(Math.max(0, q - 0.75) / 0.25, 2), z = zOf(0.47) - 0.012 - 0.52 * q + 0.03 * q * q;
  return [Math.cos(a) * R, Math.sin(a) * R * 0.92, z]; };
function buildVamp() {
  const B = new Build(), o = { NT: 56, NA: 30, e: 0.92 };
  body(B, VP, o, 0, 0.47);
  // Ohrflossen: oben seitlich am Mantel, rund, nach hinten oben gestellt, leicht gewölbt
  for (const sx of [-1, 1]) {
    const aa = PI / 2 - sx * 0.62;
    fin(B, 16, (u) => { const t = 0.11 + 0.15 * u, p = surf(VP, o, t, aa); return [p[0] * 0.97, p[1] * 0.97, p[2], t]; },
      () => norm(Math.cos(aa) * 0.75, Math.sin(aa) * 0.9, -0.3), (u) => { const pk = 0.7, k = u < pk ? Math.pow(u / pk, 0.6) : Math.pow((1 - u) / (1 - pk), 0.9); return 0.11 * k + 0.003; }, 1, 8,
      (u, v) => [0, 0, -0.06 * v * v * (0.3 + u)]);
  }
  for (const sx of [-1, 1]) { const p = surf(VP, o, 0.412, sx > 0 ? 0.08 : PI - 0.08); eye(B, [p[0] * 0.93, p[1], p[2]], sx, 0.031, 0.412, 0.52); }
  // Umhang: Haut zwischen je zwei Armen, Saum zwischen den Armen eingebuchtet
  for (let k = 0; k < 8; k++) {
    const qmax = (v) => 0.84 - 0.24 * Math.pow(Math.sin(PI * v), 1.3);
    B.grid(22, 8, (i, j) => { const v = j / 8, q = i / 22 * qmax(v), a = VAMP_ARM(k, q), b = VAMP_ARM((k + 1) % 8, q), m = lerp3(a, b, v), bow = Math.sin(PI * v) * 0.02 * q;
      const r = Math.hypot(m[0], m[1]) || 1; return [m[0] * (1 + bow / r * 0.6), m[1] * (1 + bow / r * 0.6), m[2] + bow * 0.4]; },
      (i, j) => { const v = j / 8, q = i / 22 * qmax(v); return [0.47 + q * 0.53, 2, q, k + v * 0.98]; }, false);
  }
  // acht Arme: ragen über den Saum hinaus, Spitzen biegen sich leicht ein
  for (let k = 0; k < 8; k++) { const pts = []; for (let s = 0; s <= 24; s++) pts.push(VAMP_ARM(k, s / 24)); B.tube(pts, (q) => 0.0085 * (1 - q) + 0.0016, 6, (q, ar) => [0.47 + q * 0.53, 3, q, k + ar * 0.98]); }
  B.ellipsoid([0, 0, zOf(0.47) - 0.01], 0.034, 0.032, 0.012, (q, a) => [0.47, 0, 0.5, 0], 5, 16);
  return B.geo();
}

// ======================= Der Leviathan: weißer Pottwal =======================
// Vorlage: riesiger kastenförmiger Kopf (gut ein Drittel der Länge) mit flacher Oberseite und senkrechter, rund gekanteter Stirn;
// darunter der schmale, kräftige Unterkiefer mit einer Zahnreihe, das Maul leicht geöffnet; kleines Auge über dem Mundwinkel;
// kurze dicke Brustflossen, flacher Rückenbuckel und eine Reihe Höcker bis zur Fluke; der Schwanzstiel hoch und schmal; Fluke breit und dick mit zerfranstem Hinterrand.
// Eisweiß, quer gefurchte Haut hinter dem Kopf, lange Kratzer und runde Saugnapfnarben von Kalmaren, leiser bläulicher Schimmer.
function buildWhale() {
  // fertiges Gitter entpacken: Lage, Normale, (v, u, Teil, Verdeckung), Dreiecke
  const M = WHALE_MESH, bin = atob(M.b64), raw = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
  const n = M.n, buf = raw.buffer; let o = 0;
  const pos = new Int16Array(buf, o, n * 3); o += n * 6; const nor = new Int8Array(buf, o, n * 3); o += n * 3; const kk = new Uint8Array(buf, o, n * 4); o += n * 4;
  const idx = M.big ? new Uint32Array(buf.slice(o, o + M.tris * 12)) : new Uint16Array(buf.slice(o, o + M.tris * 6));
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), K = new Float32Array(n * 4), AO = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) { P[i * 3 + c] = pos[i * 3 + c] * M.scale; N[i * 3 + c] = nor[i * 3 + c] / 127; }
    K[i * 4] = 0.5 - P[i * 3 + 2]; K[i * 4 + 1] = kk[i * 4 + 2]; K[i * 4 + 2] = kk[i * 4] / 255; K[i * 4 + 3] = kk[i * 4 + 1] / 127.5 - 1; AO[i] = kk[i * 4 + 3] / 255;
  }
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('aK', new T.BufferAttribute(K, 4)); g.setAttribute('aO', new T.BufferAttribute(AO, 1));
  g.setIndex(new T.BufferAttribute(idx, 1)); return g;
}

// ======================= Dumbo-Oktopus (für die hängenden Gärten) =======================
// eigener Entwurf: runder Glockenkopf mit zwei Ohrflossen, kurze Arme ganz mit Haut verbunden; rosa, durchscheinend, große dunkle Augen
const DB = [[0, 0.06, 0.07, 0.0], [0.04, 0.2, 0.21, 0], [0.12, 0.29, 0.29, 0], [0.24, 0.32, 0.32, 0], [0.38, 0.3, 0.3, 0], [0.5, 0.25, 0.25, 0], [0.56, 0.2, 0.2, 0]];
const DUMBO_ARM = (k, q) => { const a = (k + 0.5) / 8 * TAU, R = 0.16 + 0.3 * Math.sin(Math.min(q, 1) * PI * 0.5) - 0.12 * Math.max(0, q - 0.7), z = zOf(0.56) + 0.03 - 0.42 * q;
  return [Math.cos(a) * R, Math.sin(a) * R, z]; };
function buildDumbo() {
  const B = new Build(), o = { NT: 30, NA: 28, e: 0.95 };
  body(B, DB, o, 0, 0.56);
  for (const sx of [-1, 1]) {   // Ohrflossen
    fin(B, 12, (u) => { const t = 0.1 + 0.16 * u, p = surf(DB, o, t, sx > 0 ? 0.25 : PI - 0.25); return [p[0] * 0.96, p[1], p[2], t]; }, () => norm(sx, 0.35, -0.2),
      (u) => 0.22 * Math.pow(Math.sin(PI * u), 0.65), 1, 6, (u, v) => [0, 0.05 * v * v, -0.03 * v]);
    const p = surf(DB, o, 0.3, sx > 0 ? 0.35 : PI - 0.35); eye(B, [p[0] * 0.93, p[1], p[2]], sx, 0.06, 0.3, 0.75);
  }
  for (let k = 0; k < 8; k++) B.grid(14, 6, (i, j) => { const v = j / 6, q = i / 14 * (0.95 - 0.25 * Math.sin(PI * v)), a = DUMBO_ARM(k, q), b = DUMBO_ARM((k + 1) % 8, q); return lerp3(a, b, v); },
    (i, j) => [0.56 + 0.44 * i / 14, 2, i / 14, k + j / 6 * 0.98], false);
  for (let k = 0; k < 8; k++) { const pts = []; for (let s = 0; s <= 14; s++) pts.push(DUMBO_ARM(k, s / 14 * 1.05)); B.tube(pts, (q) => 0.035 * (1 - q) + 0.008, 6, (q, ar) => [0.56 + q * 0.44, 3, q, k + ar * 0.98]); }
  return B.geo();
}

// ======================= Aasfresser am toten Wal =======================
// Schleimaal: lang, walzenrund, ohne Kiefer; vorn kurze Barteln, hinten ein flacher Flossensaum; blass rosa-grau
const HAG = [[0, 0.012, 0.012, 0], [0.02, 0.026, 0.026, 0], [0.06, 0.034, 0.033, 0], [0.2, 0.038, 0.036, 0], [0.5, 0.037, 0.034, 0], [0.75, 0.033, 0.026, 0], [0.9, 0.026, 0.014, 0], [1, 0.012, 0.004, 0]];
function buildHagfish() {
  const B = new Build(), o = { NT: 60, NA: 14, e: 0.95 };
  body(B, HAG, o);
  for (const up of [1, -1]) fin(B, 24, (u) => { const t = (up > 0 ? 0.62 : 0.72) + (0.995 - (up > 0 ? 0.62 : 0.72)) * u, [h, , yc] = prof(HAG, t); return [0, yc + up * h * 0.92, zOf(t), t]; }, () => norm(0, up, -0.2),
    (u) => 0.022 * Math.sin(PI * Math.min(1, u * 1.6 + 0.1)) * (1 - 0.3 * u) + 0.002, 1, 3);
  for (let k = 0; k < 6; k++) { const a = PI / 2 + (k - 2.5) * 0.5, p = [Math.cos(a) * 0.008, Math.sin(a) * 0.008 - 0.004, 0.5], pts = []; for (let i = 0; i <= 5; i++) { const q = i / 5; pts.push([p[0] * (1 + q * 2.5), p[1] * (1 + q * 1.5) - 0.006 * q, p[2] + 0.025 * q]); } B.tube(pts, (q) => 0.0025 * (1 - q) + 0.0006, 4, (q) => [0, 5, q, 0]); }
  for (const sx of [-1, 1]) { const p = surf(HAG, o, 0.06, sx > 0 ? 0.3 : PI - 0.3); eye(B, [p[0] * 0.97, p[1], p[2]], sx, 0.006, 0.06, 0.3); }
  return B.geo();
}
// Grenadierfisch (Rattenschwanz): großer Kopf mit riesigem Auge, hohe erste Rückenflosse, Körper läuft in einen langen spitzen Schwanz aus; silbrig-braun
const RAT = [[0, 0.014, 0.012, 0.004], [0.03, 0.05, 0.04, 0.0], [0.09, 0.075, 0.056, 0], [0.17, 0.082, 0.056, 0.002], [0.27, 0.07, 0.045, 0.004], [0.42, 0.05, 0.032, 0.004], [0.6, 0.032, 0.02, 0.003], [0.8, 0.016, 0.01, 0.002], [1, 0.002, 0.002, 0]];
function buildRattail() {
  const B = new Build(), o = { NT: 70, NA: 18, e: 0.9 };
  body(B, RAT, o);
  fin(B, 12, (u) => { const t = 0.15 + 0.08 * u, [h, , yc] = prof(RAT, t); return [0, yc + h * 0.93, zOf(t), t]; }, (u) => norm(0, 1, -0.4 - 0.4 * u), (u) => 0.12 * Math.pow(1 - u, 0.7) * Math.min(1, u * 6 + 0.2) + 0.004, 1, 5);
  for (const up of [1, -1]) fin(B, 50, (u) => { const t = (up > 0 ? 0.3 : 0.24) + (0.99 - (up > 0 ? 0.3 : 0.24)) * u, [h, , yc] = prof(RAT, t); return [0, yc + up * h * 0.9, zOf(t), t]; }, () => norm(0, up, -0.3), (u) => 0.025 * (1 - 0.7 * u) + 0.002, 1.2, 3);
  for (const sx of [-1, 1]) { const [h, w, yc] = prof(RAT, 0.16); fin(B, 8, (u) => [sx * w * 0.9, yc - h * 0.25 + (u - 0.5) * 0.03, zOf(0.16), 0.16], () => norm(sx * 0.55, -0.25, -0.8), (u) => 0.08 * Math.sin(PI * (0.15 + 0.85 * u)), 2, 4);
    const p = surf(RAT, o, 0.075, sx > 0 ? 0.3 : PI - 0.3); eye(B, [p[0] * 0.93, p[1], p[2]], sx, 0.024, 0.075, 0.45); }
  { const p0 = surf(RAT, o, 0.02, -PI / 2), pts = []; for (let i = 0; i <= 4; i++) pts.push([0, p0[1] - 0.012 * i / 4, p0[2] - 0.004 * i]); B.tube(pts, (q) => 0.003 * (1 - q) + 0.0008, 4, (q) => [0, 5, q, 0]); }   // Kinnbartel
  return B.geo();
}
// Tiefseekrabbe: runder Panzer, acht dünne Beine, zwei Scheren; rötlich-orange
function buildCrab() {
  const B = new Build();
  B.ellipsoid([0, 0.08, 0], 0.22, 0.09, 0.18, (q, a) => [0, 0, q, a], 10, 24, 1);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const z0 = 0.09 - k * 0.07, a = sx * (0.2 + k * 0.08), pts = [[sx * 0.18, 0.06, z0], [sx * 0.34, 0.16, z0 + 0.03 - k * 0.04], [sx * 0.48, 0.0, z0 - 0.02 - k * 0.05], [sx * 0.52, -0.08, z0 - 0.03 - k * 0.06]]; void a;
    B.tube(pts, (q) => 0.022 * (1 - 0.6 * q) + 0.004, 6, (q) => [q, 2, q, 0]); }
  for (const sx of [-1, 1]) { const pts = [[sx * 0.12, 0.06, 0.15], [sx * 0.22, 0.12, 0.3], [sx * 0.14, 0.08, 0.42]]; B.tube(pts, (q) => 0.03 * (1 - 0.3 * q), 6, (q) => [q, 2, q, 0]);
    B.ellipsoid([sx * 0.13, 0.08, 0.46], 0.05, 0.035, 0.07, (q, a) => [1, 3, q, a], 6, 10); B.ellipsoid([sx * 0.17, 0.06, 0.5], 0.015, 0.012, 0.06, (q, a) => [1, 3, q, a], 4, 8); }
  for (const sx of [-1, 1]) B.ellipsoid([sx * 0.06, 0.16, 0.17], 0.018, 0.018, 0.018, (q) => [0, 4, q * 0.9 + 0.1, 0], 5, 8);
  return B.geo();
}

// ======================= Shader =======================
const VS = (mode) => /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; attribute float aO; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI; varying float vO;
  void main(){ vO = aO; vec3 p = position, nr = normal; float t = aK.x, part = aK.y, vv = aK.z, ph = iA.x, amp = iA.y, sd = iA.z;
    ${mode === 'squid' ? `
      float jet = sin(ph) * amp;
      if (part < 0.5 && t < 0.34) p.xy *= 1.0 + 0.045 * jet * smoothstep(0.03, 0.14, t);
      if (part > 0.5 && part < 1.5) { p.y += sin(ph * 1.7 - t * 30.0) * 0.012 * vv * (0.6 + amp); }
      if (part > 1.5 && (part < 3.5 || part > 4.5)) { float id = floor(aK.w), q = vv, lg = part > 2.5 ? 1.8 : 1.0;
        p.xy *= 1.0 - 0.18 * jet * q * smoothstep(0.0, 0.3, q);
        p.x += sin(uTime * 0.8 + id * 1.7 - q * 4.5) * 0.022 * q * q * lg; p.y += cos(uTime * 0.65 + id * 2.3 - q * 3.5) * 0.018 * q * q * lg; }` : ''}
    ${mode === 'vamp' ? `
      float op = sin(ph) * amp;
      if (part > 1.5 && part < 3.5) { float q = vv; p.xy *= 1.0 + 0.3 * op * smoothstep(0.0, 0.7, q) - 0.06 * (1.0 - smoothstep(0.0, 0.4, q)) * op; p.z += 0.05 * op * q * q;
        if (part > 2.5) { float id = floor(aK.w); p.xy *= 1.0 + 0.08 * sin(uTime * 1.1 + id * 2.0) * q * q; } }
      if (part > 0.5 && part < 1.5) { float fl = sin(ph * 2.0 + 0.6) * amp; p.xy *= 1.0 + 0.16 * fl * vv; p.z -= 0.02 * fl * vv; }` : ''}
    ${mode === 'whale' ? `
      float env = pow(smoothstep(0.3, 1.0, t), 1.5), wv = sin(ph - t * 3.4) * amp * env * 0.045; p.y += wv;
      if (part > 1.5 && part < 2.5) p.y += sin(ph * 0.5 + 1.0) * 0.008 * vv * vv;
      if (part > 0.5 && part < 1.5) p.y += sin(ph - 3.4) * amp * 0.004 * vv * vv;` : ''}
    ${mode === 'fishy' ? `float env = 0.15 + 0.85 * t; p.x += sin(ph - t * 7.0) * amp * env * 0.05;` : ''}
    ${mode === 'crab' ? `if (part > 1.5 && part < 2.5) p.y += sin(ph * 2.0 + position.z * 20.0 + sign(position.x) * 1.5) * 0.02 * vv;` : ''}
    ${mode === 'dumbo' ? `
      float fl = sin(ph * 1.6) * amp;
      if (part > 0.5 && part < 1.5) { p.y += fl * 0.09 * vv * vv; }
      if (part > 1.5 && part < 3.5) { float q = vv; p.xy *= 1.0 + 0.12 * sin(ph * 0.8) * amp * q; p.z += 0.04 * sin(ph * 0.8 - 0.5) * q; }` : ''}
    vL = p; p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FHEAD = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI; varying float vO;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lampHit(vec3 wp){ vec3 L = wp - uLampPos; float d = length(L); return smoothstep(0.84, 0.97, dot(L / max(d, 0.001), uLampDir)) * uLampOn * 6.0 / (3.0 + d * d * 0.04); }
  vec3 gloss(vec3 N, vec3 V, vec3 wp, float pw){ vec3 L = normalize(uLampPos - wp); vec3 s = vec3(0.75, 0.92, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), pw) * lampHit(wp);
    for (int i = 0; i < 4; i++) { vec3 g = uGlow[i].xyz - wp; float r = length(g); s += uGlowCol[i] * pow(max(dot(reflect(-g / max(r, 0.001), N), V), 0.0), pw) * uGlow[i].w * 0.7 / (1.0 + r * r * 0.5); }
    return s; }
  // runde Punkte in einem Raster (für Leuchtpunkte und Saugnäpfe): g Rasterlage, r Radius in Rasterzellen
  float dots(vec2 g, float r, float keep){ vec2 id = floor(g); float on = step(1.0 - keep, h21(id + 3.1)); return on * (1.0 - smoothstep(r * 0.6, r, length(fract(g) - 0.5))); }
  void main(){ vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW); bool outer = dot(N0, V) > 0.0; vec3 N = outer ? N0 : -N0;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x, gl = vI.y; vec3 base = vec3(0.1), glow = vec3(0.0); float spec = 0.15, pw = 24.0;
    float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + seed * 3.0), fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);`;
const FTAIL = /* glsl */ `
    vec3 c = shade(base, N, vW) * 1.25 + base * 0.03 + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.2 + gloss(N, V, vW, pw) * spec;
    c += glow * (0.85 + 0.3 * gl);
    c += (base * 0.7 + vec3(0.05, 0.1, 0.15)) * REST * (0.3 + fr * 1.4);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;
// gemeinsames Auge: schwarze Pupille, leuchtende blaue Iris, dunkler Rand, kräftiger Glanzpunkt
const EYE = /* glsl */ `
      float e = vv; vec3 iris = mix(vec3(0.25, 0.75, 1.0), vec3(0.05, 0.25, 0.75), smoothstep(0.3, 0.62, e));
      base = e < 0.3 ? vec3(0.004, 0.008, 0.02) : e < 0.64 ? iris * 0.45 : mix(vec3(0.03, 0.05, 0.1), BODYC, smoothstep(0.75, 1.0, e));
      glow = iris * (1.0 - smoothstep(0.58, 0.68, e)) * smoothstep(0.26, 0.34, e) * 1.25 * EYEGLOW + vec3(0.6, 0.9, 1.0) * (1.0 - smoothstep(0.66, 0.74, e)) * smoothstep(0.6, 0.66, e) * 0.5 * EYEGLOW;
      spec = 2.2; pw = 90.0;`;
const FS = {
  squid: FHEAD + /* glsl */ `
    #define BODYC vec3(0.28, 0.05, 0.06)
    #define EYEGLOW 1.0
    vec2 s = vec2(vL.z, vL.y);
    float n1 = texture2D(uNoise, vec2(vL.z * 9.0, vL.y * 9.0 + vL.x * 5.0)).r, n2 = texture2D(uNoise, vec2(vL.z * 30.0 + vL.x * 20.0, vL.y * 30.0)).g;
    vec3 red = mix(vec3(0.55, 0.1, 0.1), vec3(0.3, 0.045, 0.055), smoothstep(-0.3, 0.8, u)) * (0.8 + 0.35 * n1);
    float spk = smoothstep(0.62, 0.78, n2); red = mix(red, vec3(0.13, 0.015, 0.03), spk * 0.55) + vec3(0.12, 0.04, 0.03) * smoothstep(0.2, 0.05, n2) * 0.6;
    if (part < 0.5) {
      base = red;
      float ridge = 1.0 - smoothstep(0.0, 0.05, abs(u - 1.0) - 0.0) ; base += vec3(0.1, 0.03, 0.03) * ridge * step(t, 0.33);
      float col = (1.0 - smoothstep(0.0, 0.004, abs(t - 0.336))); base = mix(base, vec3(0.5, 0.14, 0.12), col * 0.6);
      vec2 g = vec2(t * 150.0, 0.0); float row = (1.0 - smoothstep(0.0, 0.05, abs(u + 0.42))) * step(0.03, t) * step(t, 0.33) + (1.0 - smoothstep(0.0, 0.05, abs(u + 0.15))) * step(0.12, t) * step(t, 0.3);
      float d = (1.0 - smoothstep(0.1, 0.2, abs(fract(t * 70.0) - 0.5))) * row; float hd = (1.0 - smoothstep(0.1, 0.2, abs(fract(t * 120.0) - 0.5))) * (1.0 - smoothstep(0.0, 0.05, abs(u + 0.6))) * step(0.345, t);
      glow = vec3(0.35, 0.8, 1.0) * (d + hd) * 1.4 * pulse; base = mix(base, vec3(0.4, 0.7, 0.85), clamp(d + hd, 0.0, 1.0) * 0.3);
      if (t > 0.41) base *= 0.8;
      spec = 0.55; pw = 32.0;
    } else if (part < 1.5) {
      base = red * (0.9 + 0.25 * vv); float edge = smoothstep(0.82, 1.0, vv);
      float d = (1.0 - smoothstep(0.12, 0.22, length(vec2(fract(u * 11.0) - 0.5, (vv - 0.8) * 7.0)))); glow = vec3(0.35, 0.8, 1.0) * (d * 1.0 + edge * 0.12) * pulse; spec = 0.4;
    } else if (part < 3.5 || part > 4.5) {
      float q = vv, ar = fract(u); base = red * (1.0 - 0.25 * q);
      float side = 1.0 - smoothstep(0.08, 0.16, min(abs(ar - 0.25), abs(ar - 0.75)));
      float dt = (1.0 - smoothstep(0.05, 0.11, length(vec2(fract(q * (part > 2.5 ? 22.0 : 18.0)) - 0.5, (min(abs(ar - 0.25), abs(ar - 0.75))) * 2.5)))) * step(0.04, q);
      if (part > 4.5) { dt = dots(vec2(q * 14.0, fract(u) * 5.0), 0.3, 0.55); base = mix(red, vec3(0.5, 0.12, 0.12), 0.3); }
      glow = vec3(0.35, 0.82, 1.0) * dt * 1.1 * pulse * (1.0 - 0.4 * q); base = mix(base, vec3(0.55, 0.65, 0.75), dt * 0.2); spec = 0.5; pw = 30.0;
    } else {` + EYE + `}` + FTAIL,
  vamp: FHEAD + /* glsl */ `
    #define BODYC vec3(0.25, 0.04, 0.05)
    #define EYEGLOW 1.0
    float n1 = texture2D(uNoise, vec2(vL.z * 7.0, vL.y * 7.0 + vL.x * 4.0)).r, n2 = texture2D(uNoise, vec2(vL.z * 26.0 + vL.x * 18.0, vL.y * 26.0)).g;
    vec3 red = mix(vec3(0.46, 0.08, 0.09), vec3(0.24, 0.035, 0.05), smoothstep(-0.4, 0.9, u)) * (0.8 + 0.35 * n1); red = mix(red, vec3(0.12, 0.012, 0.025), smoothstep(0.62, 0.8, n2) * 0.5);
    if (part < 0.5) {
      base = red; if (t > 0.465) base *= 0.35;
      float d = dots(vec2(vL.z * 90.0, vL.y * 90.0 + vL.x * 60.0), 0.22, 0.08) * step(0.03, t) * step(t, 0.45); glow = vec3(0.4, 0.8, 1.0) * d * 0.8 * pulse;
      float tip = 1.0 - smoothstep(0.0, 0.03, t); glow += vec3(1.0, 0.35, 0.12) * tip * 0.9 * pulse;
      spec = 0.6; pw = 34.0;
    } else if (part < 1.5) {
      base = red * (0.95 + 0.3 * vv); float root = (1.0 - smoothstep(0.0, 0.25, vv)) * (1.0 - smoothstep(0.15, 0.45, abs(u - 0.5)));
      glow = vec3(1.0, 0.36, 0.1) * root * 2.2 * pulse + vec3(1.0, 0.45, 0.2) * smoothstep(0.85, 1.0, vv) * 0.2; spec = 0.45;
    } else if (part < 2.5) {
      float q = vv; base = mix(red, vec3(0.1, 0.01, 0.025), 0.35 + 0.35 * q) * (outer ? 1.0 : 0.6);
      float hem = smoothstep(0.035, 0.0, abs(q - (0.84 - 0.24 * pow(sin(3.14159 * fract(u)), 1.3)))) ; base += vec3(0.12, 0.03, 0.04) * hem;
      spec = 0.35; pw = 22.0;
    } else if (part < 3.5) {
      float q = vv, ar = fract(u); base = red * (1.0 - 0.2 * q);
      float dt = (1.0 - smoothstep(0.08, 0.16, length(vec2(fract(q * 20.0) - 0.5, min(abs(ar - 0.25), abs(ar - 0.75)) * 2.5)))) * step(0.08, q);
      glow = vec3(0.45, 0.85, 1.0) * dt * 1.4 * pulse + vec3(1.0, 0.4, 0.15) * smoothstep(0.93, 1.0, q) * 1.2 * pulse; spec = 0.5;
    } else {` + EYE + `}` + FTAIL,
  whale: FHEAD + /* glsl */ `
    #define BODYC vec3(0.8, 0.85, 0.87)
    #define EYEGLOW 0.0
    if (part < 3.5 || part > 5.5) {
      // Haut: Höhenfeld aus feinen Furchen, langen Narben und Saugnapfringen; daraus werden die Normalen gekippt (Relief ohne zusätzliche Geometrie)
      vec3 q = vL; float e = 0.0015;
      #define HF(P) ( texture2D(uNoise, vec2((P).z * 2.6 + (P).x * 1.4, (P).y * 3.1) + 0.2).r * 0.6 + texture2D(uNoise, vec2((P).z * 11.0 + (P).x * 7.0, (P).y * 11.0 - (P).x * 3.0)).g * 0.25 + texture2D(uNoise, vec2((P).z * 34.0 - (P).y * 9.0, (P).y * 30.0 + (P).x * 21.0) + 0.6).b * 0.08 )
      float h0 = HF(q); vec3 gr = vec3(HF(q + vec3(e, 0.0, 0.0)) - h0, HF(q + vec3(0.0, e, 0.0)) - h0, HF(q + vec3(0.0, 0.0, e)) - h0) / e;
      // Narben: lange, leicht geschwungene Linien, meist in Längsrichtung, abschnittsweise; zwei Lagen
      float n1 = texture2D(uNoise, vec2(q.z * 1.1 + q.x * 0.6, q.y * 4.2 + q.x * 2.5) + 0.13).g, n2 = texture2D(uNoise, vec2(q.z * 2.3 - q.y * 1.5, q.y * 7.5 + q.x * 4.0) + 0.57).r;
      float m1 = smoothstep(0.5, 0.62, texture2D(uNoise, vec2(q.z * 1.7, q.y * 1.7 + q.x) + 0.71).b), m2 = smoothstep(0.55, 0.66, texture2D(uNoise, vec2(q.z * 2.9 + 0.3, q.y * 2.9 - q.x) + 0.29).r);
      float l1 = 1.0 - smoothstep(0.003, 0.011, abs(n1 - 0.5)), l2 = 1.0 - smoothstep(0.002, 0.009, abs(n2 - 0.5));
      float scar = max(l1 * m1, l2 * m2 * 0.8), scarE = max((1.0 - smoothstep(0.01, 0.024, abs(n1 - 0.5))) * m1, (1.0 - smoothstep(0.008, 0.02, abs(n2 - 0.5))) * m2 * 0.8) - scar;
      // runde Saugnapfnarben, vor allem am Kopf
      vec2 sg = vec2(q.z, q.y + q.x * 0.6) * 140.0; vec2 sid = floor(sg); float rr = length(fract(sg) - 0.5);
      float ring = (1.0 - smoothstep(0.0, 0.08, abs(rr - 0.27))) * step(0.955, h21(sid)) * (1.0 - smoothstep(0.32, 0.4, t)) * step(0.02, t) * step(part, 0.5);
      // Querfurchen hinter dem Kopf
      float fw = abs(fract(q.z * 120.0 + h0 * 3.0) - 0.5), furrow = (1.0 - smoothstep(0.05, 0.22, fw)) * smoothstep(0.34, 0.44, t) * (1.0 - smoothstep(0.82, 0.9, t)) * smoothstep(0.35, 0.6, texture2D(uNoise, vec2(q.z * 4.0, q.y * 2.0 + q.x)).g) * step(part, 0.5);
      vec3 Nb = normalize(N - (gr - N * dot(gr, N)) * 0.0045);
      // Rillen der Narben und Furchen kippen die Normalen zusätzlich (wirken eingeschnitten)
      Nb = normalize(Nb + (vec3(0.0, sin(q.z * 754.0), 0.0) * furrow * 0.08));
      N = Nb;
      float ao = mix(1.0, vO, 0.9);
      vec3 ice = mix(vec3(0.9, 0.93, 0.94), vec3(0.72, 0.76, 0.79), smoothstep(0.25, -0.9, u)) * (0.9 + 0.14 * h0);
      ice = mix(ice, vec3(0.97, 0.97, 0.95), smoothstep(0.6, 0.9, u) * 0.3);
      base = ice;
      base = mix(base, vec3(0.5, 0.52, 0.54), scar * 0.55) + vec3(0.05) * max(scarE, 0.0);
      base *= 1.0 - 0.18 * ring; base *= 1.0 - 0.03 * furrow;
      if (part > 2.5) { float up = smoothstep(0.1, 0.9, u) * (1.0 - smoothstep(0.55, 0.85, vv)); base = mix(base, vec3(0.62, 0.56, 0.57), up * 0.45); }   // Unterkiefer, oben zum Maul hin rosig-grau
      if (part > 0.5 && part < 2.5) base *= 0.97 + 0.03 * vv;
      base *= ao; base *= 0.7 + 0.3 * smoothstep(0.15, 0.9, vO);
      glow = base * 0.2 * ao + vec3(0.7, 0.9, 0.95) * fr * 0.15 * ao;
      spec = 0.5 * ao; pw = 22.0;
    } else if (part > 4.5) { base = vec3(0.95, 0.93, 0.86) * (0.75 + 0.25 * vv); spec = 1.2; pw = 60.0; glow = base * 0.08; }
    else {   // Auge: dunkel, feucht glänzend, brauner Kern
      base = vv < 0.55 ? mix(vec3(0.18, 0.1, 0.05), vec3(0.02, 0.015, 0.015), smoothstep(0.0, 0.5, vv)) : vec3(0.03, 0.03, 0.035);
      spec = 3.5; pw = 140.0; glow = vec3(0.9, 0.95, 1.0) * pow(max(dot(reflect(-V, N), normalize(vec3(0.3, 0.8, 0.2))), 0.0), 40.0) * 0.7 * step(vv, 0.6) + vec3(0.25, 0.14, 0.08) * (1.0 - smoothstep(0.1, 0.4, vv)) * 0.3; }` + FTAIL,
  dumbo: FHEAD + /* glsl */ `
    #define BODYC vec3(0.75, 0.42, 0.45)
    #define EYEGLOW 0.0
    float n1 = texture2D(uNoise, vec2(vL.z * 3.0, vL.y * 3.0 + vL.x * 2.0)).r;
    vec3 pink = mix(vec3(0.95, 0.58, 0.6), vec3(0.75, 0.38, 0.45), smoothstep(-0.2, 0.9, u)) * (0.85 + 0.25 * n1);
    if (part < 0.5) { base = pink; base += vec3(0.2, 0.08, 0.1) * dots(vec2(vL.z * 30.0, vL.y * 30.0 + vL.x * 20.0), 0.35, 0.25); glow = vec3(1.0, 0.55, 0.6) * fr * 0.25; spec = 0.6; pw = 30.0; }
    else if (part < 1.5) { base = pink * (1.0 + 0.2 * vv); glow = vec3(1.0, 0.6, 0.65) * (fr * 0.3 + smoothstep(0.85, 1.0, vv) * 0.15); spec = 0.4; }
    else if (part < 3.5) { base = mix(pink, vec3(0.55, 0.22, 0.3), vv * 0.6) * (outer ? 1.0 : 0.7); float ci = dots(vec2(vv * 14.0, u * 3.0), 0.3, 0.7) * step(2.5, part); base = mix(base, vec3(1.0, 0.85, 0.85), ci * 0.6); glow = vec3(1.0, 0.55, 0.6) * fr * 0.2; spec = 0.35; }
    else {` + EYE + ` base = vv < 0.3 ? vec3(0.015, 0.01, 0.015) : vv < 0.6 ? mix(vec3(0.3, 0.16, 0.24), vec3(0.12, 0.05, 0.1), smoothstep(0.3, 0.6, vv)) : mix(vec3(0.45, 0.22, 0.26), BODYC, smoothstep(0.62, 0.85, vv)); glow = vec3(1.0, 0.85, 0.9) * pow(max(dot(reflect(-V, N), normalize(vec3(0.3, 0.8, 0.4))), 0.0), 30.0) * 0.5 * step(vv, 0.6); spec = 2.5; pw = 80.0; }` + FTAIL,
};

FS.hag = FHEAD + /* glsl */ `
    #define BODYC vec3(0.6, 0.45, 0.45)
    #define EYEGLOW 0.0
    float n1 = texture2D(uNoise, vec2(vL.z * 6.0, vL.y * 6.0 + vL.x * 4.0)).r;
    base = mix(vec3(0.85, 0.55, 0.55), vec3(0.6, 0.38, 0.42), smoothstep(-0.3, 0.8, u)) * (0.85 + 0.25 * n1);
    if (part > 0.5 && part < 1.5) base *= 0.9 + 0.2 * vv; if (part > 4.5) base = vec3(0.75, 0.6, 0.58);
    if (part > 3.5 && part < 4.5) base = vec3(0.08, 0.06, 0.06);
    float slime = pow(1.0 - max(dot(N, V), 0.0), 3.0); glow = vec3(0.6, 0.7, 0.75) * slime * 0.12; spec = 1.4; pw = 60.0;` + FTAIL;
FS.rat = FHEAD + /* glsl */ `
    #define BODYC vec3(0.35, 0.3, 0.26)
    #define EYEGLOW 0.35
    float n1 = texture2D(uNoise, vec2(vL.z * 9.0, vL.y * 9.0 + vL.x * 6.0)).r;
    if (part < 0.5) { vec2 sc = vec2(t * 60.0, vv * 26.0); sc.y += floor(sc.x) * 0.5; float scl = smoothstep(0.3, 0.5, length((fract(sc) - 0.5) * vec2(1.0, 1.3)));
      base = mix(vec3(0.55, 0.52, 0.48), vec3(0.28, 0.24, 0.2), smoothstep(-0.2, 0.8, u)) * (0.85 + 0.25 * n1) * (1.0 - 0.15 * scl); spec = 0.9; pw = 40.0; }
    else if (part < 3.5 || part > 4.5) { base = vec3(0.3, 0.26, 0.22) * (0.8 + 0.3 * vv); spec = 0.3; }
    else {` + EYE + ` }` + FTAIL;
FS.crab = FHEAD + /* glsl */ `
    #define BODYC vec3(0.6, 0.2, 0.1)
    #define EYEGLOW 0.0
    float n1 = texture2D(uNoise, vec2(vL.x * 6.0, vL.z * 6.0)).r, n2 = texture2D(uNoise, vec2(vL.x * 22.0, vL.z * 22.0)).g;
    base = mix(vec3(0.7, 0.16, 0.08), vec3(0.85, 0.3, 0.14), smoothstep(0.3, 0.8, n1)) * (0.9 + 0.12 * n2);
    if (part > 1.5 && part < 2.5) base *= 0.85 + 0.3 * vv; if (part > 2.5 && part < 3.5) base = mix(base, vec3(0.95, 0.85, 0.75), smoothstep(0.6, 1.0, vv) * 0.6);
    if (part > 3.5) base = vec3(0.02);
    spec = 0.8; pw = 36.0;` + FTAIL;

export function createChapter2(scene) {
  const rest = (fs, k) => '#define REST ' + k.toFixed(2) + '\n' + fs;
  const kind = (geo, mode, fs, M) => {
    const iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
    geo.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); geo.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); geo.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); geo.instanceCount = 0;
    const m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS(mode), fragmentShader: fs })); m.frustumCulled = false; scene.add(m);
    return { geo, M, list: [], mesh: m,
      sync() { let n = 0; for (const f of this.list) { if (n >= M) break; const o = n * 4; iP.set([f.x, f.y, f.z, f.size], o); iR.set([f.yaw, f.pitch || 0, f.roll || 0, 0], o); iA.set([f.ph || 0, f.amp == null ? 1 : f.amp, f.seed || 0, f.glow == null ? 1 : f.glow], o); n++; }
        geo.instanceCount = n; geo.attributes.iP.needsUpdate = geo.attributes.iR.needsUpdate = geo.attributes.iA.needsUpdate = true; } };
  };
  return {
    squid: kind(buildSquid(), 'squid', rest(FS.squid, 0.35), 4),
    vamp: kind(buildVamp(), 'vamp', rest(FS.vamp, 0.3), 400),
    whale: kind(buildWhale(), 'whale', rest(FS.whale, 0.6), 2),
    dumbo: kind(buildDumbo(), 'dumbo', rest(FS.dumbo, 0.45), 8),
    hag: kind(buildHagfish(), 'fishy', rest(FS.hag, 0.3), 90), rat: kind(buildRattail(), 'fishy', rest(FS.rat, 0.3), 40), crab: kind(buildCrab(), 'crab', rest(FS.crab, 0.3), 30),
  };
}

/** Tinte: rote Leuchttinte der Vampirtintenfische (Standard) oder dunkle Tinte des Kalmars (dark). Weiche Wölkchen, die langsam aufquellen, treiben und verblassen.
 *  emit(x, y, z, n, r, life) setzt eine Wolke; see = 0…1 macht ferne Wolken sichtbarer (Rotfilter im Periskop) */
export function createInk(scene, N = 2400, dark = false) {
  const pos = new Float32Array(N * 3), aA = new Float32Array(N * 2), q = []; for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -9999; q.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0, s: 0 }); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aA', new T.BufferAttribute(aA, 2));
  const PX = { value: 600 }, SEE = { value: 0 }; let head = 0;
  const m = quadPoints(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX, uSee: SEE }), transparent: true, depthWrite: false, blending: dark ? T.NormalBlending : T.AdditiveBlending,
    vertexShader: `attribute vec2 aA; uniform float uPx, uFogK, uSee; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); float d = -mv.z; vA = aA.x * exp(-d * uFogK * 0.4 * (1.0 - 0.9 * uSee)) * (1.0 + uSee * 1.5); gl_PointSize = max(1.0, aA.y * uPx / max(d, 0.3) * (1.0 + uSee * smoothstep(40.0, 200.0, d) * 3.0)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: dark ? `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(0.0, 1.0 - r), 1.6); gl_FragColor = vec4(vec3(0.03, 0.02, 0.025), a * min(1.0, vA * 1.6)); }`
      : `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0, a = pow(max(0.0, 1.0 - r), 2.2); gl_FragColor = vec4(vec3(1.0, 0.12, 0.08) * a * vA * 0.9 + vec3(1.0, 0.5, 0.3) * pow(max(0.0, 1.0 - r * 1.6), 4.0) * vA * 0.25, 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = 7; scene.add(m);
  const R = Math.random;
  return { mesh: m,
    set see(v) { SEE.value = v; }, get see() { return SEE.value; },
    clear() { for (const p of q) p.age = p.life = 0; },
    emit(x, y, z, n = 60, r = 0.3, life = 1) { for (let i = 0; i < n; i++) { const p = q[head]; head = (head + 1) % N; const a = R() * Math.PI * 2, b = Math.acos(R() * 2 - 1), rr = r * Math.cbrt(R());
      p.x = x + Math.cos(a) * Math.sin(b) * rr; p.y = y + Math.cos(b) * rr; p.z = z + Math.sin(a) * Math.sin(b) * rr; p.vx = (p.x - x) * 0.5; p.vy = (p.y - y) * 0.5; p.vz = (p.z - z) * 0.5; p.age = 0; p.life = (18 + R() * 25) * life; p.s = (0.14 + R() * 0.22) * (dark ? 2.2 : 1); } },
    update(dt, px) { PX.value = px; for (let i = 0; i < N; i++) { const p = q[i]; if (p.age >= p.life) { if (aA[i * 2] !== 0) { pos[i * 3 + 1] = -9999; aA[i * 2] = 0; } continue; }
      p.age += dt; const k = Math.exp(-dt * 0.6); p.vx *= k; p.vy *= k; p.vz *= k; p.x += p.vx * dt; p.y += (p.vy + 0.01) * dt; p.z += p.vz * dt;
      const f = p.age / p.life; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; aA[i * 2] = Math.min(1, p.age * 3) * (1 - f) * (1 - f) * (dark ? 0.8 : 0.5); aA[i * 2 + 1] = p.s * (1 + f * 5); }
      g.attributes.position.needsUpdate = true; g.attributes.aA.needsUpdate = true; if (g.attributes.position.__inst) { g.attributes.position.__inst.needsUpdate = true; g.attributes.aA.__inst.needsUpdate = true; } },
  };
}
