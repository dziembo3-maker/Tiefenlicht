// deep.js – Tiefseetiere (ab etwa 180 m): Laternenfische in großen Schwärmen, Krill als rote Lichtwolken,
// einzeln der Tiefsee-Mondfisch, der Laternenträger-Angler und der Riesen-Schlammstachel, dazu die treibende Riesen-Staatsqualle.
// Jede Art hat ein eigenes Modell (Körper aus Querschnitten, Flossen als Häute) und eigene Leuchtmuster im Shader;
// Schwimmen, Flossenschlag und Pulsieren macht die Grafikkarte.
import { T, rng, clamp, smooth } from './util.js';
import { uni, COMMON } from './gfx.js';

const PI = Math.PI;
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const gauss = (x, s) => Math.exp(-((x / s) ** 2));
/** Längsprofil weich interpolieren: Zeilen [t, oben, unten, halbe Breite, Achse] */
function profAt(P, t) {
  t = clamp(t, 0, 1); let i = 0; while (i < P.length - 2 && t > P[i + 1][0]) i++;
  const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)], u = (t - b[0]) / (c[0] - b[0]), u2 = u * u, u3 = u2 * u, o = [];
  for (let k = 1; k < 5; k++) o.push(0.5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u3));
  return o;
}

/** dasselbe ohne Überschwingen (für harte Stufen wie den Mundwinkel) */
function profLin(P, t) { t = clamp(t, 0, 1); let i = 0; while (i < P.length - 2 && t > P[i + 1][0]) i++; const b = P[i], c = P[i + 1], u = clamp((t - b[0]) / (c[0] - b[0]), 0, 1), k = u * u * (3 - 2 * u); return [1, 2, 3, 4].map((q) => b[q] + (c[q] - b[q]) * k); }

/** Bauhelfer: sammelt Punkte, Normalen, aK = (t, Teil, v, u) und Dreiecke */
function Builder() {
  const P = [], N = [], K = [], I = []; let n = 0;
  const B = {
    v(p, nr, t, part, vv, uu) { P.push(p[0], p[1], p[2]); N.push(nr[0], nr[1], nr[2]); K.push(t, part, vv, uu); return n++; },
    /** Gitter (NI × NJ, in j geschlossen wenn wrap); Normalen aus den Nachbarn */
    grid(NI, NJ, pt, wrap = true, flip = false) {
      const b0 = n, G = [];
      for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) { const q = pt(i, j); G.push(q[0]); B.v(q[0], [0, 1, 0], q[1], q[2], q[3], q[4]); }
      const g = (i, j) => G[clamp(i, 0, NI) * (NJ + 1) + (wrap ? (j + NJ) % NJ : clamp(j, 0, NJ))];
      for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) {
        const cr = cross(sub(g(i, j + 1), g(i, j - 1)), sub(g(i + 1, j), g(i - 1, j))); let nn = Math.hypot(...cr) < 1e-14 ? [0, 1, 0] : norm(...cr); if (flip) nn = nn.map((x) => -x);
        const q = (b0 + i * (NJ + 1) + j) * 3; N[q] = nn[0]; N[q + 1] = nn[1]; N[q + 2] = nn[2];
      }
      for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const a = b0 + i * (NJ + 1) + j, c = a + NJ + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
      return b0;
    },
    /** Körper aus Querschnitten; mod(t, a, x, y) darf den Punkt verändern; Kopf rund geschlossen */
    body(prof, { NT = 60, NA = 30, e = 2.2, part = 0, mod = null, lin = false } = {}) {
      const pt = (t, a) => { const [hu, hl, w, yc] = (lin ? profLin : profAt)(prof, t), ca = Math.cos(a), sa = Math.sin(a), tip = t < 0.03 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.03) ** 2)) : t > 0.97 ? Math.sqrt(Math.max(0, 1 - ((t - 0.97) / 0.03) ** 2)) : 1;   // vorn und hinten rund geschlossen
        let x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e) * w * tip, y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e) * (sa > 0 ? hu : hl) * tip; const p = [x, y + yc, 0.5 - t]; return mod ? mod(t, a, p) : p; };
      B.grid(NT, NA, (j, i) => { const s = j / NT, t = s < 0.12 ? 0.05 * (s / 0.12) ** 1.4 : 0.05 + 0.95 * (s - 0.12) / 0.88; return [pt(t, i / NA * 2 * PI), t, part, i / NA, 0]; }, true, true);
      return pt;
    },
    /** dünne Flossenhaut: Wurzel root(u), Richtung dir(u), Länge len(u); u entlang der Wurzel, v zum Rand. Strahlen malt der Shader */
    fin(root, dir, len, { NU = 14, NV = 6, part = 1, t = null, nrm = null, edge = null } = {}) {
      const b0 = n;
      for (let i = 0; i <= NU; i++) { const u = i / NU, r = root(u), d = dir(u), L = len(u);
        for (let j = 0; j <= NV; j++) { const vv = j / NV, p = edge ? edge(u, vv, r, d, L) : [r[0] + d[0] * L * vv, r[1] + d[1] * L * vv, r[2] + d[2] * L * vv]; B.v(p, nrm ? nrm(u) : [1, 0, 0], t !== null ? t : 0.5 - r[2], part, vv, u); } }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = b0 + i * (NV + 1) + j, c = a + NV + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
    },
    /** Kugel/Ellipsoid (Auge, Leuchtköder) */
    ball(c, r, part, t, { S = 12, R = 8, sx = 1, sy = 1, sz = 1, vv = 0 } = {}) {
      const b0 = n;
      for (let i = 0; i <= R; i++) { const th = i / R * PI; for (let j = 0; j <= S; j++) { const ph = j / S * 2 * PI, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        B.v([c[0] + nx * r * sx, c[1] + ny * r * sy, c[2] + nz * r * sz], [nx, ny, nz], t, part, vv, i / R); } }
      for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a = b0 + i * (S + 1) + j, d = a + S + 1; I.push(a, d, a + 1, a + 1, d, d + 1); }
    },
    /** Kegel (Zähne, Stacheln) von a nach b */
    cone(a, b, r, part, t, S = 5) { const ax = norm(...sub(b, a)), up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(...cross(ax, up)), e2 = cross(ax, e1), b0 = n;
      for (let j = 0; j < S; j++) { const q = j / S * 2 * PI, d = e1.map((x, k) => x * Math.cos(q) + e2[k] * Math.sin(q)); B.v(a.map((x, k) => x + d[k] * r), d, t, part, 0, j / S); }
      const tip = B.v(b, ax, t, part, 1, 0); for (let j = 0; j < S; j++) I.push(b0 + j, b0 + (j + 1) % S, tip); },
    /** Röhre entlang Punkten (Angelrute, Fäden) */
    tube(pts, r, part, t, S = 6) { const b0 = n;
      pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], ax = norm(...sub(q, o)), up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(...cross(ax, up)), e2 = cross(ax, e1), rr = typeof r === 'function' ? r(i / (pts.length - 1)) : r;
        for (let j = 0; j <= S; j++) { const a = j / S * 2 * PI, d = e1.map((x, k) => x * Math.cos(a) + e2[k] * Math.sin(a)); B.v(p.map((x, k) => x + d[k] * rr), d, t, part, i / (pts.length - 1), j / S); } });
      for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < S; j++) { const a = b0 + i * (S + 1) + j, c = a + S + 1; I.push(a, c, a + 1, a + 1, c, c + 1); } },
    geo() { const g = new T.InstancedBufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I); return g; },
  };
  return B;
}

// ======================= die Arten =======================
// Teile: 0 Körper, 1 Flosse (Strahlen), 2 schlagende Flosse (Mondfisch), 3 Auge, 4 Zahn, 5 Leuchtköder, 6 Angelrute, 8 Stachel/Faden (Spitze leuchtet), 9 Unterkiefer
const fanOf = (B) => (c, back, up, out, R, spread, { r0 = 0.02, part = 1, t = 0.5, NU = 12, NV = 5, tilt = 0, scal = 0.05, rays = 9 } = {}) => {
  B.fin(() => c, () => back, () => R, { NU, NV, part, t, nrm: () => out, edge: (u, vv) => { const th = (u - 0.5) * spread, rad = r0 + (R * (1 + scal * Math.cos(u * rays * 2 * PI)) - r0) * vv, ct = Math.cos(th), st = Math.sin(th);
    return [c[0] + (back[0] * ct + up[0] * st) * rad + out[0] * tilt * rad, c[1] + (back[1] * ct + up[1] * st) * rad + out[1] * tilt * rad, c[2] + (back[2] * ct + up[2] * st) * rad + out[2] * tilt * rad]; } }); };
/** Segelflosse: Wurzel root(u) auf dem Körper, Spitze bei apexU, nach hinten gezogen; s = +1 nach oben, -1 nach unten */
const sailOf = (B) => (root, s, H, apexU, sweep, { part = 1, NU = 14, NV = 8, rag = 0 } = {}) => {
  const h = (u) => H * (u < apexU ? Math.pow(u / apexU, 0.8) : Math.pow(1 - (u - apexU) / (1 - apexU), 0.9) * (1 + rag * Math.sin(u * 46)));
  B.fin(root, () => [0, s, 0], h, { NU, NV, part, edge: (u, vv, r) => [0, r[1] + s * h(u) * vv, r[2] - sweep * h(u) * vv - 0.02 * vv * vv] }); };
/** Auge als flache Kuppel: v = 0 Mitte (Pupille) … 1 Rand */
const eyeOf = (B) => (c, nr, r, t) => { const up = Math.abs(nr[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(...cross(nr, up)), e2 = cross(nr, e1);
  B.grid(5, 16, (i, j) => { const f = i / 5, q = j / 16 * 2 * PI, h = r * 0.38 * (1 - f * f); return [[0, 1, 2].map((k) => c[k] + (e1[k] * Math.cos(q) + e2[k] * Math.sin(q)) * r * f + nr[k] * h), t, 3, f, j / 16]; }, true, false); };
const outN = (pt, t, a) => { const p = pt(t, a), c = pt(t, a + PI); return norm(p[0] - c[0], (p[1] - c[1]) * 0.3, 0); };

/** Laternenfisch: großer Kopf, riesiges Auge, schräges Maul; Körper läuft schlank aus, Gabelschwanz; Leuchtorgane in Reihen an Bauch und Flanke */
function buildLantern() {
  const B = Builder(), fan = fanOf(B), sail = sailOf(B), eye = eyeOf(B);
  const prof = [[0, 0.02, 0.03, 0.02, -0.005], [0.04, 0.07, 0.075, 0.05, -0.004], [0.12, 0.105, 0.11, 0.068, 0], [0.25, 0.12, 0.122, 0.074, 0.002], [0.4, 0.112, 0.11, 0.068, 0.003],
    [0.55, 0.092, 0.088, 0.056, 0.003], [0.7, 0.066, 0.062, 0.04, 0.002], [0.84, 0.042, 0.04, 0.024, 0.001], [0.93, 0.032, 0.03, 0.016, 0], [1, 0.036, 0.034, 0.012, 0]];
  const pt = B.body(prof, { NT: 30, NA: 18, e: 2.15 }), top = (t) => pt(t, PI / 2), bot = (t) => pt(t, -PI / 2);
  for (const sx of [1, -1]) { const a = sx > 0 ? 0.3 : PI - 0.3; eye(pt(0.105, a), outN(pt, 0.105, a), 0.043, 0.105); }
  sail((u) => top(0.38 + u * 0.2), 1, 0.13, 0.3, 0.45, { NU: 10, NV: 5 });
  sail((u) => top(0.8 + u * 0.05), 1, 0.03, 0.5, 0.6, { NU: 4, NV: 3 });
  sail((u) => bot(0.58 + u * 0.22), -1, 0.09, 0.3, 0.5, { NU: 10, NV: 5 });
  B.fin(() => [0, 0, -0.495], () => [0, 0, -1], (u) => 0.24 * (0.4 + 0.6 * Math.pow(Math.abs(2 * u - 1), 1.3)), { NU: 16, NV: 5, edge: (u, vv, r, d, L) => [0, (u - 0.5) * 0.07 + (u - 0.5) * 0.4 * vv, r[2] - L * vv] });
  for (const sx of [1, -1]) { fan(pt(0.23, sx > 0 ? -0.45 : PI + 0.45), [0, -0.45, -0.9], [0, 0.9, -0.45], [sx, 0, 0], 0.13, 0.9, { t: 0.23, NU: 7, NV: 4, tilt: 0.35, rays: 7 });
    fan(pt(0.42, sx > 0 ? -1.2 : PI + 1.2), [0, -0.6, -0.8], [0, 0.8, -0.6], [sx, 0, 0], 0.07, 0.8, { t: 0.42, NU: 5, NV: 3, tilt: 0.3, rays: 5 }); }
  return B.geo();
}

/** Tiefsee-Mondfisch: große ovale Scheibe mit schmalem Schwanzstiel und zerfranstem Gabelschwanz; hohe dreieckige Rücken- und Afterflosse, runde Brustflosse, großes Auge */
function buildMola() {
  const B = Builder(), fan = fanOf(B), sail = sailOf(B), eye = eyeOf(B);
  const prof = [[0, 0.04, 0.045, 0.02, -0.01], [0.05, 0.15, 0.15, 0.05, -0.005], [0.15, 0.255, 0.26, 0.078, 0], [0.3, 0.31, 0.315, 0.092, 0], [0.45, 0.3, 0.3, 0.088, 0],
    [0.58, 0.245, 0.24, 0.072, 0], [0.68, 0.17, 0.165, 0.05, 0], [0.78, 0.1, 0.095, 0.032, 0], [0.88, 0.065, 0.062, 0.02, 0], [1, 0.06, 0.058, 0.012, 0]];
  const pt = B.body(prof, { NT: 54, NA: 30, e: 2.3, mod: (t, a, p) => { const sa = Math.sin(a); if (t < 0.05) p[1] += 0.012 * gauss(sa + 0.1, 0.5) * 0; return p; } });
  const top = (t) => pt(t, PI / 2), bot = (t) => pt(t, -PI / 2);
  for (const sx of [1, -1]) { const a = sx > 0 ? 0.2 : PI - 0.2; eye(pt(0.15, a), outN(pt, 0.15, a), 0.05, 0.15); }
  sail((u) => top(0.36 + u * 0.3), 1, 0.46, 0.42, 0.5, { part: 2, NU: 18, NV: 10, rag: 0.05 });
  sail((u) => bot(0.36 + u * 0.3), -1, 0.44, 0.42, 0.5, { part: 2, NU: 18, NV: 10, rag: 0.05 });
  // Gabelschwanz mit zerfransten Lappen
  B.fin(() => [0, 0, -0.495], () => [0, 0, -1], (u) => 0.34 * (0.3 + 0.7 * Math.pow(Math.abs(2 * u - 1), 1.1)) * (1 + 0.07 * Math.sin(u * 38) + 0.04 * Math.sin(u * 71)), { NU: 30, NV: 7, edge: (u, vv, r, d, L) => [0, (u - 0.5) * 0.115 + (u - 0.5) * 0.6 * vv + 0.02 * Math.sin(vv * 6 + u * 9) * vv, r[2] - L * vv] });
  for (const sx of [1, -1]) fan(pt(0.31, sx > 0 ? -0.1 : PI + 0.1), [0, -0.15, -1], [0, 1, -0.15], [sx, 0, 0], 0.1, 2.2, { t: 0.31, NU: 12, NV: 4, tilt: 0.3, rays: 11, r0: 0.015 });
  return B.geo();
}

/** Laternenträger-Angler: gedrungener Körper, riesiges offenes Maul mit langen Nadelzähnen, vorstehender Unterkiefer; die Angel wächst aus der Stirn
 *  und hängt mit grün leuchtendem Köder vor dem Maul; Stacheln auf dem Rücken und Barteln am Kinn mit leuchtenden Spitzen */
function buildAngler() {
  const B = Builder(), fan = fanOf(B), sail = sailOf(B), eye = eyeOf(B), R = rng(13);
  // Oberkörper: vorn bildet die Unterseite das Maul-Dach (bis zum Mundwinkel bei t = 0,3), dahinter der volle Bauch
  const prof = [[0, 0.05, 0.02, 0.1, 0.14], [0.08, 0.135, 0.02, 0.16, 0.095], [0.18, 0.225, 0.022, 0.195, 0.04], [0.27, 0.28, 0.025, 0.21, -0.01], [0.33, 0.275, 0.26, 0.215, 0],
    [0.45, 0.25, 0.24, 0.2, 0.005], [0.58, 0.19, 0.18, 0.15, 0.01], [0.72, 0.12, 0.11, 0.09, 0.01], [0.85, 0.075, 0.07, 0.05, 0.01], [1, 0.055, 0.05, 0.028, 0.01]];
  const pt = B.body(prof, { NT: 56, NA: 34, e: 2.1, lin: true, mod: (t, a, p) => { const k = 1 + 0.035 * Math.sin(t * 37 + 3 * a) * Math.sin(t * 23 - 2 * a) * smooth(0.3, 0.4, t); p[0] *= k; p[1] *= k; return p; } });
  // Unterkiefer: eine Schaufel, vorn hochgebogen, steht vor
  const jaw = (s, a) => { const ca = Math.cos(a), sa = Math.sin(a), tf = s < 0.06 ? Math.sqrt(Math.max(0, 1 - (1 - s / 0.06) ** 2)) : 1, z = 0.57 - 0.45 * s, yt = -0.17 + 0.12 * s + 0.05 * (1 - Math.min(1, s)) ** 4, d = (0.04 + 0.19 * Math.pow(Math.min(s, 1), 0.8)) * (1 - 0.12 * smooth(0.6, 0.9, s)) * (1 - 0.5 * smooth(0.9, 1.25, s));
    let w = 0.24 * Math.sqrt(1 - 0.85 * (1 - Math.min(1, s / 0.55)) ** 2) * (1 - 0.14 * smooth(0.55, 0.85, s)); if (s > 0.85) w *= 1 - 0.55 * smooth(0.85, 1.25, s);   // hinten schmaler als der Körper: der Kiefer verschwindet sauber darin
    return [Math.sign(ca) * Math.pow(Math.abs(ca), 0.9) * w * tf, sa > 0 ? yt - 0.04 * sa * tf : yt - Math.pow(-sa, 0.9) * d * tf, z]; };
  B.grid(26, 26, (i, j) => { const s = i / 26 * 1.25, a = j / 26 * 2 * PI; const p = jaw(s, a); return [p, 0.5 - p[2], 9, j / 26, 0]; }, true, true);
  // Zähne: lang, dünn, unregelmäßig; oben nach unten, unten nach oben
  for (const sx of [1, -1]) for (let k = 0; k < 8; k++) { const t = 0.025 + k * 0.03, gap = 0.26 * (1 - t / 0.3), p = pt(t, sx > 0 ? -0.12 : PI + 0.12), L = Math.min(0.11, gap * 0.45) * (k % 2 ? 0.55 : 1) * (0.85 + R() * 0.3);
    B.cone([p[0] * 0.94, p[1] + 0.008, p[2]], [p[0] * 0.86, p[1] - L, p[2] - 0.015], 0.0075, 4, t);
    const s = 0.03 + k * 0.075, q = jaw(s, sx > 0 ? 0.1 : PI - 0.1), g2 = 0.26 * (1 - s * 0.9), L2 = Math.min(0.15, g2 * 0.6) * (k % 2 ? 1 : 0.5) * (0.85 + R() * 0.3);
    B.cone([q[0] * 0.95, q[1] - 0.01, q[2]], [q[0] * 0.88, q[1] + L2, q[2] - 0.02], 0.008, 4, 0.5 - q[2]); }
  for (let k = -1; k <= 1; k++) { const p = pt(0.012, -PI / 2 + k * 0.9); B.cone([p[0], p[1] + 0.008, p[2] - 0.01], [p[0], p[1] - 0.085, p[2] - 0.02], 0.007, 4, 0.01); const q = jaw(0.035, PI / 2 + k * 0.75); B.cone([q[0], q[1] - 0.01, q[2]], [q[0], q[1] + 0.13 - Math.abs(k) * 0.03, q[2] - 0.02], 0.008, 4, 0.5 - q[2]); }
  for (const sx of [1, -1]) { const a = sx > 0 ? 0.5 : PI - 0.5; eye(pt(0.27, a), outN(pt, 0.27, a), 0.03, 0.27); }
  // Angel: aus der Stirn im Bogen nach vorn; der Köder hängt vor dem Maul
  { const P0 = [0.28, 0.27], P1 = [0.4, 0.86], P2 = [0.74, 0.4], pts = []; for (let k = 0; k <= 16; k++) { const f = k / 16, g = 1 - f; pts.push([0, g * g * P0[1] + 2 * g * f * P1[1] + f * f * P2[1], g * g * P0[0] + 2 * g * f * P1[0] + f * f * P2[0]]); }
    B.tube(pts, (f) => 0.013 * (1 - 0.65 * f), 6, 0.2, 5); const e = pts[16]; B.ball([0, e[1] - 0.04, e[2] + 0.005], 0.046, 5, 0.2, { S: 12, R: 8, sy: 1.3, vv: 1 }); for (let k = -1; k <= 1; k++) B.cone([0, e[1] - 0.09, e[2]], [k * 0.025, e[1] - 0.15, e[2] + 0.01], 0.004, 5, 0.2, 3); }
  for (let k = 0; k < 7; k++) { const t = 0.3 + k * 0.05, a = PI / 2 + (R() - 0.5) * 0.7, p = pt(t, a); B.cone(p, [p[0] * 1.1, p[1] + 0.07 + R() * 0.05, p[2] - 0.02], 0.006, 8, t, 4); }
  for (let k = 0; k < 5; k++) { const q = jaw(0.15 + k * 0.16, -PI / 2 + (R() - 0.5) * 0.9); B.cone(q, [q[0], q[1] - 0.06 - R() * 0.05, q[2] - 0.01], 0.005, 8, 0.5 - q[2], 4); }
  fan([0, 0.01, -0.47], [0, 0, -1], [0, 1, 0], [1, 0, 0], 0.27, 1.35, { r0: 0.004, t: 1, NU: 16, NV: 5, rays: 11, scal: 0.06 });   // die Wurzel steckt im Schwanzstiel: keine Lücke
  sail((u) => pt(0.68 + u * 0.2, PI / 2), 1, 0.1, 0.45, 0.5, { NU: 9, NV: 4, rag: 0.08 }); sail((u) => pt(0.7 + u * 0.17, -PI / 2), -1, 0.085, 0.45, 0.5, { NU: 8, NV: 4, rag: 0.08 });
  for (const sx of [1, -1]) fan(pt(0.5, sx > 0 ? -0.3 : PI + 0.3), [0, -0.2, -1], [0, 1, -0.2], [sx, 0, 0], 0.17, 1.3, { t: 0.5, NU: 10, NV: 4, tilt: 0.5, rays: 9 });
  return B.geo();
}

/** Riesen-Schlammstachel: spitzer Kopf, Körper läuft in einen langen dünnen Schwanz aus; hohes spitzes Rückensegel, dahinter lange Flossensäume bis zur Schwanzspitze;
 *  lange Fäden unter der Brust; rot glühende Seitenlinie mit Fischgrät-Adern */
function buildStachel() {
  const B = Builder(), fan = fanOf(B), sail = sailOf(B), eye = eyeOf(B);
  const prof = [[0, 0.01, 0.016, 0.012, -0.008], [0.03, 0.034, 0.04, 0.032, -0.008], [0.08, 0.058, 0.062, 0.05, -0.004], [0.15, 0.072, 0.074, 0.057, 0.001], [0.26, 0.07, 0.07, 0.052, 0.003],
    [0.4, 0.058, 0.058, 0.041, 0.002], [0.55, 0.045, 0.045, 0.031, 0.001], [0.7, 0.032, 0.032, 0.021, 0], [0.85, 0.018, 0.018, 0.012, 0], [1, 0.004, 0.004, 0.003, 0]];
  const pt = B.body(prof, { NT: 90, NA: 20, e: 2.1 }), top = (t) => pt(t, PI / 2), bot = (t) => pt(t, -PI / 2);
  for (const sx of [1, -1]) { const a = sx > 0 ? 0.35 : PI - 0.35; eye(pt(0.075, a), outN(pt, 0.075, a), 0.027, 0.075); }
  sail((u) => top(0.17 + u * 0.1), 1, 0.2, 0.22, 0.42, { NU: 10, NV: 7 });
  sail((u) => top(0.29 + u * 0.705), 1, 0.036, 0.1, 0.5, { NU: 56, NV: 3 });
  sail((u) => bot(0.24 + u * 0.755), -1, 0.042, 0.1, 0.5, { NU: 56, NV: 3 });
  for (const sx of [1, -1]) { fan(pt(0.13, sx > 0 ? -0.2 : PI + 0.2), [0, -0.25, -1], [0, 1, -0.25], [sx, 0, 0], 0.085, 1.0, { t: 0.13, NU: 6, NV: 4, tilt: 0.4, rays: 7 });
    for (let k = 0; k < 2; k++) { const p = pt(0.12 + k * 0.02, sx > 0 ? -1.2 : PI + 1.2), pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10; pts.push([p[0] + sx * f * 0.015, p[1] - f * (0.09 + k * 0.04) - f * f * 0.03, p[2] - f * (0.26 - k * 0.06)]); } B.tube(pts, 0.0028, 8, 0.12, 3); } }
  return B.geo();
}

/** Riesen-Staatsqualle (ein Tier): hohe durchscheinende Glocke mit gewelltem Rand, innen ein rosa leuchtender Kern, vier krause Mundarme, viele lange Fangfäden */
function buildSiphon() {
  const B = Builder(), R = rng(5);
  const bell = (Rb, Hb, part, y0) => B.grid(16, 36, (i, j) => { const f = i / 16, a = j / 36 * 2 * PI, th = f * 1.72, rr = Rb * Math.sin(th) * (1 + 0.05 * Math.cos(12 * a) * f ** 4);
    return [[Math.cos(a) * rr, y0 + Hb * Math.cos(th) * (th > PI / 2 ? 1.6 : 1), Math.sin(a) * rr], 0, part, f, j / 36]; }, true, false);
  bell(0.5, 0.62, 0, 0); bell(0.38, 0.44, 1, -0.02);
  B.ball([0, 0.2, 0], 0.17, 2, 0, { S: 14, R: 10, sy: 1.5, vv: 0 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * 2 * PI + 0.4; B.grid(30, 4, (i, j) => { const f = i / 30, w = (j / 4 - 0.5) * 0.2 * (1 - 0.6 * f), fr = Math.sin(f * 16 + k) * 0.05 * (0.3 + f) * (j / 4 - 0.5) * 4, rad = 0.07 + 0.05 * f;
    return [[Math.cos(a) * rad + Math.cos(a + PI / 2) * w + Math.cos(a) * fr, 0.1 - f * 1.9, Math.sin(a) * rad + Math.sin(a + PI / 2) * w + Math.sin(a) * fr], k, 3, f, j / 4]; }, false, false); }
  for (let k = 0; k < 22; k++) { const a = k / 22 * 2 * PI + R() * 0.2, L = 1.2 + R() * R() * 3.6, fl = 0.75 + R() * 0.6, pts = []; for (let s = 0; s <= 26; s++) { const f = s / 26, rr = 0.47 * (1 - 0.45 * Math.sin(f * PI) * fl + 0.25 * f * fl); pts.push([Math.cos(a) * rr, -0.1 - f * L, Math.sin(a) * rr]); }
    B.tube(pts, (f) => 0.009 * (1 - 0.7 * f), 4, k, 3); }
  return B.geo();
}

/** Riesen-Staatsqualle für die Vermessung (Kapitel 2): dieselbe Glocke, aber die vier Mundarme hängen sehr lang herab (Einheiten der Glocke: ARM),
 *  dazu längere Nesselfäden. Mit size 3 hat die Glocke 3 m Durchmesser, die Arme reichen gut 35 m tief. */
function buildSiphonGiant() {
  const B = Builder(), R = rng(9), ARM = 11.5;
  const bell = (Rb, Hb, part, y0) => B.grid(16, 36, (i, j) => { const f = i / 16, a = j / 36 * 2 * PI, th = f * 1.72, rr = Rb * Math.sin(th) * (1 + 0.05 * Math.cos(12 * a) * f ** 4);
    return [[Math.cos(a) * rr, y0 + Hb * Math.cos(th) * (th > PI / 2 ? 1.6 : 1), Math.sin(a) * rr], 0, part, f, j / 36]; }, true, false);
  bell(0.5, 0.62, 0, 0); bell(0.38, 0.44, 1, -0.02);
  B.ball([0, 0.2, 0], 0.17, 2, 0, { S: 14, R: 10, sy: 1.5, vv: 0 });
  for (let k = 0; k < 4; k++) { const a = k / 4 * 2 * PI + 0.4; B.grid(180, 4, (i, j) => { const f = i / 180, w = (j / 4 - 0.5) * 0.24 * (1 - 0.55 * f), fr = Math.sin(f * 90 + k) * 0.06 * (0.3 + f) * (j / 4 - 0.5) * 4, rad = 0.08 + 0.1 * f, tw = f * 3 + k;
    const ox = Math.cos(a) * rad + Math.cos(a + PI / 2 + tw) * w + Math.cos(a) * fr, oz = Math.sin(a) * rad + Math.sin(a + PI / 2 + tw) * w + Math.sin(a) * fr;
    return [[ox, 0.1 - f * ARM * (0.92 + 0.08 * Math.sin(k * 1.3)), oz], k, 3, f, j / 4]; }, false, false); }
  for (let k = 0; k < 26; k++) { const a = k / 26 * 2 * PI + R() * 0.2, L = 2.2 + R() * R() * 6.5, fl = 0.75 + R() * 0.6, pts = []; for (let s = 0; s <= 60; s++) { const f = s / 60, rr = 0.47 * (1 - 0.45 * Math.sin(Math.min(1, f * 4) * PI) * fl + 0.35 * f * fl); pts.push([Math.cos(a) * rr, -0.1 - f * L, Math.sin(a) * rr]); }
    B.tube(pts, (f) => 0.009 * (1 - 0.7 * f), 4, k, 3); }
  return B.geo();
}

// ======================= Shader =======================
const VS = (sp) => /* glsl */ `#define SP ${sp}
  attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN; varying vec4 vK; varying vec4 vI;
  void main(){ vec3 p = position, nr = normalize(normal); float part = aK.y, ph = iA.x, amp = iA.y, sd = iA.z;
  #if SP == 4 || SP == 5
    // Qualle: die Glocke zieht sich zusammen und öffnet sich; Arme und Fäden folgen träge und schwingen
    float k = 0.5 + 0.5 * sin(uTime * 1.25 + sd * 6.0), kk = k * k;
    if (part < 1.5) { float f = aK.z; p.xz *= 1.0 - 0.2 * kk * f * f; p.y += 0.07 * kk * f; }
    else if (part > 2.5) { float f = aK.z, id = aK.x, kl = 0.5 + 0.5 * sin(uTime * 1.25 + sd * 6.0 - 0.6 - f * 2.5); p.xz *= 1.0 - 0.2 * kl * kl * (1.0 - f * 0.8); p.y += 0.07 * kl * kl;
      float dp = -p.y; p.x += sin(uTime * 0.45 + dp * 0.9 + id * 2.3) * 0.1 * f * (1.0 + dp * 0.25); p.z += cos(uTime * 0.38 + dp * 0.8 + id * 1.7) * 0.1 * f * (1.0 + dp * 0.25); }
  #else
    float t = 0.5 - position.z;   // nach der Lage: alles, was am selben Ort sitzt, bewegt sich gleich
    #if SP == 0
      float kw = 5.0, env = 0.05 + pow(smoothstep(0.15, 1.05, t), 1.3);
    #elif SP == 1
      float kw = 2.5, env = pow(smoothstep(0.6, 1.2, t), 1.2);
    #elif SP == 2
      float kw = 3.5, env = pow(smoothstep(0.45, 1.15, t), 1.2);
    #else
      float kw = 9.0, env = 0.1 + 0.9 * t;
    #endif
    float w = amp * env * sin(ph - t * kw), sl = -amp * env * cos(ph - t * kw) * kw; p.x += w; nr = normalize(vec3(nr.x, nr.y, nr.z + sl * nr.x));
    #if SP == 1
      if (part > 1.5 && part < 2.5) p.x += sin(ph * 0.5) * 0.3 * aK.z * aK.z;   // Rücken- und Afterflosse schlagen gemeinsam
    #endif
    #if SP == 2
      if (part > 4.5 && part < 6.5) { float f = part > 5.5 ? aK.z * aK.z : 1.0; p.y += sin(uTime * 1.1 + sd * 7.0) * 0.035 * f; p.x += cos(uTime * 0.8 + sd * 5.0) * 0.04 * f; }   // die Angel wippt
    #endif
  #endif
    p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 wp = R * p + iP.xyz; vN = R * nr; vW = wp; vK = aK; vI = iA;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`;

const FS = (sp) => /* glsl */ `#define SP ${sp}
  precision highp float; ${COMMON} varying vec3 vW, vN; varying vec4 vK; varying vec4 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nz(vec2 p){ return texture2D(uNoise, p).r; }
  // runde Leuchtpunkte in einer Reihe entlang des Körpers: Abstand dt, Höhe s0 (sin des Winkels), hs = Körperhöhe dort, ra = Radius
  float dotRow(float t, float s, float t0, float t1, float dt, float s0, float hs, float ra){ float f = (fract((t - t0) / dt + 0.5) - 0.5) * dt, d = length(vec2(f, (s - s0) * hs)); return (1.0 - smoothstep(ra * 0.55, ra, d)) * step(t0 - dt * 0.5, t) * step(t, t1 + dt * 0.5); }
  float lineAt(float x, float w){ return 1.0 - smoothstep(w * 0.5, w, abs(x)); }
  vec3 lightW(vec3 base, vec3 N, vec3 wp){ float lk = exp(wp.y * 0.0125), top = max(N.y, 0.0), wrap = 0.5 + 0.5 * dot(N, uSunDir);
    vec3 amb = vec3(0.04, 0.16, 0.28) * max(0.3, 0.5 + 0.5 * N.y) * (0.35 + 0.65 * lk) + vec3(0.04, 0.16, 0.26) * (0.5 - 0.5 * N.y) * lk;
    return base * (amb + vec3(0.1, 0.5, 0.85) * (top * 0.8 + max(dot(N, uSunDir), 0.0) * 0.3 + wrap * wrap * 0.3) * lk + lights(wp, N)); }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.z, glowK = vI.w; vec3 base = vec3(0.1), glow = vec3(0.0); float fr = pow(1.0 - max(dot(N, V), 0.0), 2.5), sa = sin(vv * 6.2832);
  #if SP == 0
    if (part < 0.5) { float m = nz(vec2(t * 8.0, vv * 3.0) + seed);
      base = mix(vec3(0.025, 0.045, 0.085), vec3(0.1, 0.17, 0.27), smoothstep(0.75, -0.2, sa)) * (0.85 + 0.3 * m);
      base += vec3(0.05, 0.16, 0.3) * lineAt(sa - 0.35, 0.35) * 0.5 * smoothstep(0.1, 0.3, t);   // blauer Schimmer auf der oberen Flanke
      base *= 1.0 - 0.75 * lineAt(sa + 0.14 + 1.6 * t, 0.05) * step(t, 0.15) * smoothstep(0.0, 0.02, t);   // Maul
      base *= 1.0 - 0.5 * lineAt(t - 0.2 + 0.035 * sa * sa, 0.008) * step(abs(sa), 0.85);   // Kiemendeckel
      float d = dotRow(t, sa, 0.1, 0.9, 0.045, -0.93, 0.11, 0.0125) + dotRow(t, sa, 0.11, 0.62, 0.05, -0.7, 0.11, 0.0125) + dotRow(t, sa, 0.3, 0.8, 0.072, -0.36, 0.1, 0.011) + dotRow(t, sa, 0.045, 0.085, 0.02, -0.55, 0.08, 0.009);
      d += lineAt(t - 0.9, 0.04) * smoothstep(0.75, 0.95, sa) * 0.9;   // Leuchtdrüse oben am Schwanzstiel
      glow = vec3(0.35, 0.85, 1.0) * d * 1.7; }
    else if (part < 2.5) { float ray = step(0.45, fract(u * 11.0)); base = vec3(0.04, 0.075, 0.13) * (0.6 + 0.5 * ray); glow = vec3(0.1, 0.3, 0.5) * ray * 0.12; }
    else { base = vv < 0.45 ? vec3(0.005) : vv < 0.86 ? vec3(0.3, 0.6, 0.85) : vec3(0.02, 0.04, 0.07); glow = vv > 0.45 && vv < 0.86 ? vec3(0.25, 0.65, 0.95) * 0.55 : vec3(0.0); }
  #elif SP == 1
    if (part < 0.5) { float m = nz(vec2(t * 3.0, vv * 2.0) + seed);
      base = mix(vec3(0.15, 0.2, 0.27), vec3(0.24, 0.31, 0.38), smoothstep(0.1, -0.7, sa)) * (0.82 + 0.3 * m);
      float eyD = length(vec2((t - 0.15) * 1.0, (sa - 0.2) * 0.3));
      base *= 1.0 - 0.6 * (1.0 - smoothstep(0.012, 0.03, length(vec2(t - 0.012, (sa + 0.08) * 0.1))));   // kleines offenes Maul
      // Punktreihen folgen den Umrissen: Rücken, Bauch, zwei kürzere auf der Flanke, ein Bogen ums Auge, der Kiemenbogen leuchtet
      float d = dotRow(t, sa, 0.08, 0.85, 0.03, 0.86, 0.3, 0.0085) + dotRow(t, sa, 0.08, 0.85, 0.03, -0.86, 0.3, 0.0085) + dotRow(t, sa, 0.3, 0.8, 0.035, 0.58, 0.3, 0.0075) + dotRow(t, sa, 0.3, 0.8, 0.035, -0.58, 0.3, 0.0075) + dotRow(t, sa, 0.55, 0.98, 0.03, 0.0, 0.2, 0.0075);
      float ringD = abs(eyD - 0.085), angE = atan((sa - 0.2) * 0.3, t - 0.15); d += (1.0 - smoothstep(0.004, 0.009, ringD)) * step(0.5, fract(angE * 3.5));
      float gill = lineAt(t - 0.26 - 0.05 * (1.0 - sa * sa * 2.2), 0.01) * step(abs(sa), 0.62);
      glow = vec3(0.3, 0.92, 0.96) * (d * 1.5 + gill * 0.8) + vec3(0.1, 0.5, 0.55) * fr * 0.25; }
    else if (part < 2.5) { float ray = step(0.4, fract(u * (part > 1.5 ? 16.0 : 12.0)));
      base = vec3(0.13, 0.18, 0.24) * (0.65 + 0.4 * ray); glow = vec3(0.25, 0.9, 0.95) * (smoothstep(0.86, 1.0, vv) * 1.0 + (1.0 - smoothstep(0.1, 0.3, length(fract(vec2(u * 14.0, vv * 5.0)) - 0.5))) * step(vv, 0.25) * 0.9 + ray * vv * 0.12); }
    else { base = vv < 0.4 ? vec3(0.005) : vv < 0.72 ? vec3(0.1, 0.16, 0.2) : vec3(0.2, 0.5, 0.55); glow = vv > 0.72 ? vec3(0.3, 0.92, 0.96) * 0.9 : vec3(0.0); }
  #elif SP == 2
    if (part < 0.5 || part > 8.5) { float m = nz(vec2(t * 9.0, vv * 6.0) + seed), m2 = nz(vec2(t * 30.0, vv * 20.0));
      base = vec3(0.065, 0.085, 0.07) * (0.7 + 0.4 * m + 0.25 * m2);
      bool inner = part < 0.5 ? (t < 0.31 && sa < -0.05) : (sa > 0.12); if (inner) base = vec3(0.025, 0.008, 0.01);
      else { vec2 cs = vec2(t * 15.0, vv * 17.0); float sp2 = step(0.86, h21(floor(cs) + seed + part)) * (1.0 - smoothstep(0.08, 0.2, length(fract(cs) - 0.5))); glow = vec3(0.4, 1.0, 0.45) * sp2 * 1.2 + vec3(0.1, 0.4, 0.2) * fr * 0.2; } }
    else if (part < 2.5) { float ray = step(0.4, fract(u * 10.0)); base = vec3(0.05, 0.065, 0.055) * (0.6 + 0.5 * ray); glow = vec3(0.3, 0.9, 0.4) * smoothstep(0.9, 1.0, vv) * ray * 0.35; }
    else if (part < 3.5) { base = vv < 0.35 ? vec3(0.01) : vv < 0.85 ? vec3(0.55, 0.6, 0.55) : vec3(0.03); glow = vv > 0.35 && vv < 0.85 ? vec3(0.2, 0.25, 0.2) : vec3(0.0); }
    else if (part < 4.5) { base = vec3(0.7, 0.75, 0.66); glow = vec3(0.22, 0.28, 0.22) * (0.4 + vv); }
    else if (part < 5.5) { base = vec3(0.2, 0.7, 0.25); glow = vec3(0.35, 1.0, 0.4) * (1.5 + 0.4 * sin(uTime * 2.3 + seed * 9.0)); }
    else if (part < 6.5) { base = vec3(0.06, 0.075, 0.06); glow = vec3(0.3, 0.9, 0.35) * smoothstep(0.75, 1.0, vv) * 0.9; }
    else { base = vec3(0.07, 0.085, 0.07); glow = vec3(0.4, 1.0, 0.45) * smoothstep(0.6, 1.0, vv) * 1.4; }
  #elif SP == 3
    if (part < 0.5) { float m = nz(vec2(t * 10.0, vv * 3.0) + seed);
      base = mix(vec3(0.13, 0.1, 0.095), vec3(0.2, 0.15, 0.13), smoothstep(-0.2, -0.8, sa)) * (0.8 + 0.35 * m);
      base *= 1.0 - 0.7 * lineAt(sa + 0.25 + 0.8 * t, 0.06) * step(t, 0.1) * smoothstep(0.0, 0.015, t);   // Maul
      base *= 1.0 - 0.45 * lineAt(t - 0.125 + 0.02 * sa * sa, 0.006) * step(abs(sa), 0.8);
      float lat = lineAt(sa, 0.07), f = (fract(t / 0.024) - 0.5) * 0.024, tick = (1.0 - smoothstep(0.0015, 0.004, abs(f + abs(sa) * 0.016))) * smoothstep(0.02, 0.08, abs(sa)) * (1.0 - smoothstep(0.3, 0.5, abs(sa)));
      glow = vec3(1.0, 0.33, 0.12) * (lat * 1.3 + tick * 0.9) * smoothstep(0.1, 0.16, t) * (1.0 - smoothstep(0.9, 1.0, t)) * (0.8 + 0.2 * sin(uTime * 1.4 - t * 12.0)); }
    else if (part < 2.5) { float ray = step(0.4, fract(u * (u > -1.0 ? 40.0 : 1.0))); base = vec3(0.2, 0.08, 0.06) * (0.55 + 0.5 * ray); glow = vec3(1.0, 0.3, 0.1) * (ray * 0.1 + smoothstep(0.85, 1.0, vv) * 0.3); }
    else if (part < 3.5) { base = vv < 0.4 ? vec3(0.01) : vv < 0.85 ? vec3(0.6, 0.58, 0.5) : vec3(0.03); glow = vv > 0.4 && vv < 0.85 ? vec3(0.2, 0.18, 0.15) : vec3(0.0); }
    else { base = vec3(0.2, 0.1, 0.08); glow = vec3(1.0, 0.35, 0.12) * (0.25 + vv * 0.6); }
  #endif
  #if SP == 4 || SP == 5
    float alpha = 0.5; float ribs = lineAt(fract(u * 18.0) - 0.5, 0.12);
    if (part < 0.5) { glow = vec3(0.25, 0.5, 1.0) * (0.07 + fr * 0.6 + ribs * 0.07 * vv) + vec3(0.7, 0.75, 1.0) * smoothstep(0.93, 1.0, vv) * 0.6; }
    else if (part < 1.5) { glow = vec3(0.45, 0.35, 1.0) * (0.06 + fr * 0.3) + vec3(1.0, 0.4, 0.7) * ribs * 0.12 * (1.0 - vv); }
    else if (part < 2.5) { glow = vec3(1.0, 0.3, 0.5) * (0.5 + 0.5 * fr + 0.15 * sin(uTime * 1.25)); }
    else if (part < 3.5) { glow = vec3(1.0, 0.45, 0.72) * (0.3 + 0.5 * abs(u - 0.5)) * (1.0 - vv * 0.6); }
    else { glow = mix(vec3(0.5, 0.6, 1.0), vec3(1.0, 0.45, 0.75), step(0.6, fract(vv * 22.0 + t * 0.37))) * 0.4 * (1.0 - vv * 0.65); }
    float dist = length(cameraPosition - vW); gl_FragColor = vec4(glow * exp(-dist * uFogK * 0.55) * 1.25, alpha);
  #else
    vec3 c = lightW(base, N, vW) * 1.2 + waterCol(reflect(-V, N)) * fr * 0.15;
    float dist = length(cameraPosition - vW); c = fog(c, vW) + glow * glowK * exp(-dist * uFogK * 0.55);   // Leuchtorgane: aus der Dunkelheit weiter sichtbar als der Körper
    gl_FragColor = vec4(c, 1.0);
  #endif
  }`;

// ======================= Krill: rote Lichtwolken =======================
function krillCloud(N = 1800) {
  const R = rng(21), g = new T.BufferGeometry(), p = new Float32Array(N * 3), s = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1); p[i * 3] = x * 30; p[i * 3 + 1] = y * 3.2 * (1 - 0.5 * Math.abs(x)); p[i * 3 + 2] = z * 5.5 * (1 - 0.5 * Math.abs(x)) + Math.sin(x * 2.2) * 5; s[i * 4] = R(); s[i * 4 + 1] = R(); s[i * 4 + 2] = R(); s[i * 4 + 3] = 0.6 + R() * 0.8; }
  g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aS', new T.BufferAttribute(s, 4));
  const PX = { value: 600 }, C = { value: new T.Vector3() }, A = { value: 0 };
  const m = new T.Points(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX, uC: C, uYaw: A }), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec4 aS; uniform float uTime, uPx, uFogK, uYaw; uniform vec3 uC; varying float vA;
      void main(){ vec3 q = position; float tt = uTime * 0.25; q += vec3(sin(tt + aS.x * 40.0 + q.z * 0.2), sin(tt * 1.3 + aS.y * 30.0 + q.x * 0.3) * 0.6, cos(tt * 0.9 + aS.z * 35.0 + q.y * 0.3)) * 1.6;
        q.x *= 1.0 + 0.15 * sin(uTime * 0.11 + q.z * 0.1); float c = cos(uYaw), s = sin(uYaw); q = vec3(c * q.x + s * q.z, q.y, -s * q.x + c * q.z);
        vec4 mv = viewMatrix * vec4(uC + q, 1.0); float d = -mv.z; vA = (0.55 + 0.45 * sin(uTime * (1.0 + aS.w) + aS.x * 50.0)) * exp(-d * uFogK * 0.45) * aS.w;
        gl_PointSize = max(1.0, 0.09 * aS.w * uPx / max(d, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = 1.0 - smoothstep(0.1, 0.5, r); gl_FragColor = vec4(vec3(1.0, 0.32, 0.14) * a * vA * 0.55, 1.0); }` }));
  m.frustumCulled = false;
  return { mesh: m, PX, C, A };
}

// ======================= Arten zusammen =======================
export const DEEP_KINDS = ['lantern', 'mola', 'angler', 'stachel', 'siphon', 'giant'];
const BUILD = [buildLantern, buildMola, buildAngler, buildStachel, buildSiphon, buildSiphonGiant];
/** legt für jede Art ein Instanzen-Netz an (max Tiere); setze Tiere mit set(kind, i, {x,y,z,L,yaw,pitch,roll,ph,amp,seed,glow}) und dann commit() */
export function createDeepModels(scene, max = { lantern: 300, mola: 4, angler: 6, stachel: 6, siphon: 3 }) {
  const M = {};
  DEEP_KINDS.forEach((k, sp) => { const n = max[k] || 0; if (!n) { M[k] = { n: 0, k: 0 }; return; } const g = BUILD[sp](), D = { g, n, k: 0 };
    for (const a of ['iP', 'iR', 'iA']) { D[a] = new Float32Array(n * 4); g.setAttribute(a, new T.InstancedBufferAttribute(D[a], 4)); } g.instanceCount = 0;
    const mat = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS(sp), fragmentShader: FS(sp), transparent: sp >= 4, depthWrite: sp < 4, blending: sp >= 4 ? T.AdditiveBlending : T.NormalBlending });
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; if (sp >= 4) mesh.renderOrder = 6; scene.add(mesh); D.mesh = mesh; M[k] = D; });
  const krill = []; for (let i = 0; i < 3; i++) { const c = krillCloud(); c.mesh.visible = false; scene.add(c.mesh); krill.push(c); }
  return {
    M, krill,
    begin() { for (const k of DEEP_KINDS) M[k].k = 0; },
    has(kind) { return M[kind].n > 0; },
    add(kind, o) { const D = M[kind]; if (D.k >= D.n) return; const q = D.k * 4; D.iP[q] = o.x; D.iP[q + 1] = o.y; D.iP[q + 2] = o.z; D.iP[q + 3] = o.L; D.iR[q] = o.yaw || 0; D.iR[q + 1] = o.pitch || 0; D.iR[q + 2] = o.roll || 0;
      D.iA[q] = o.ph || 0; D.iA[q + 1] = o.amp === undefined ? 0.05 : o.amp; D.iA[q + 2] = o.seed || 0; D.iA[q + 3] = o.glow === undefined ? 1 : o.glow; D.k++; },
    commit() { for (const k of DEEP_KINDS) { const D = M[k]; if (!D.n) continue; D.g.instanceCount = D.k; if (D.k) for (const a of ['iP', 'iR', 'iA']) D.g.attributes[a].needsUpdate = true; } },
  };
}
