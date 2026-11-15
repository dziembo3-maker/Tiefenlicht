// humpback.js – Buckelwale über dem großen Abgrund.
// Körper aus Querschnitten mit eigenem Längsprofil (flacher, breiter Kopf, vorstehender Unterkiefer, volle Kehle, Buckel vor der Finne,
// Schwanzstiel mit Kiel und „Knöcheln“), dazu als eigene Körper: lange, dicke Brustflossen mit Höckern an der Vorderkante, eine Fluke,
// die fließend aus dem Schwanzstiel wächst, die kleine Finne, Knubbel am Kopf, Seepocken an Kinn, Kiefer, Flossen und Fluke.
// Kehlfurchen, Mundlinie, Marmorierung und das helle Muster unter Flossen und Fluke malt der Shader.
// Bewegung: eine Welle läuft durch den ganzen Körper zur Fluke; ab und zu ein kräftiger Schlag, der den Körper mitnimmt; die Flossen rudern.
import { T, rng, clamp, smooth } from './util.js';
import { uni, COMMON, quadPoints } from './gfx.js';
import { floorH } from './terrain.js';

const PI = Math.PI;
// Längsprofil (Länge 1): [t (0 = Schnauze, 1 = Flukenansatz), Höhe über der Achse, Tiefe darunter, halbe Breite, Achshöhe]
const PROF = [
  [0.000, 0.008, 0.012, 0.012, -0.004], [0.020, 0.020, 0.028, 0.034, -0.006], [0.050, 0.031, 0.046, 0.054, -0.008], [0.100, 0.044, 0.066, 0.073, -0.010],
  [0.160, 0.055, 0.088, 0.089, -0.012], [0.220, 0.067, 0.103, 0.100, -0.012], [0.300, 0.082, 0.113, 0.108, -0.010], [0.380, 0.091, 0.113, 0.112, -0.008],
  [0.460, 0.093, 0.107, 0.108, -0.004], [0.550, 0.089, 0.093, 0.096, 0.000], [0.640, 0.080, 0.076, 0.078, 0.004], [0.720, 0.066, 0.058, 0.056, 0.006],
  [0.800, 0.051, 0.044, 0.037, 0.006], [0.880, 0.037, 0.033, 0.023, 0.005], [0.940, 0.026, 0.023, 0.019, 0.004], [1.000, 0.016, 0.013, 0.028, 0.003],
];
/** weich durch die Stützstellen (Catmull-Rom), damit keine Kanten im Körper entstehen */
function prof(t) {
  t = clamp(t, 0, 1); let i = 0; while (i < PROF.length - 2 && t > PROF[i + 1][0]) i++;
  const a = PROF[Math.max(0, i - 1)], b = PROF[i], c = PROF[i + 1], d = PROF[Math.min(PROF.length - 1, i + 2)], u = (t - b[0]) / (c[0] - b[0]), u2 = u * u, u3 = u2 * u, o = [];
  for (let k = 1; k < 5; k++) o.push(0.5 * (2 * b[k] + (-a[k] + c[k]) * u + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u3));
  return o;   // [oben, unten, Breite, Achse]
}
const zOf = (t) => 0.5 - t;
/** Mundlinie als Höhe auf dem Querschnitt (sin des Winkels): vorn fast mittig, nach hinten bis unter das Auge abfallend */
const mouthS = (t) => 0.03 + 0.07 * Math.sin(PI * clamp(t / 0.17, 0, 1)) - 0.55 * smooth(0.12, 0.24, t) - 0.2 * Math.min(t, 0.24);
const MOUTH_GL = 'float mouthS(float t){ return 0.03 + 0.07 * sin(3.14159 * clamp(t / 0.17, 0.0, 1.0)) - 0.55 * smoothstep(0.12, 0.24, t) - 0.2 * min(t, 0.24); }';
const EYE_T = 0.222, EYE_S = mouthS(EYE_T) + 0.115;
const gauss = (x, s) => Math.exp(-((x / s) ** 2));

/** ein Punkt auf der Haut: t entlang, a rundherum (0 = rechts, PI/2 = oben) */
function bodyPt(t, a) {
  const [hu, hl, w, yc] = prof(t), ca = Math.cos(a), sa = Math.sin(a);
  const eu = 2 + 0.7 * (1 - smooth(0.1, 0.32, t)) - 0.5 * smooth(0.66, 0.86, t), el = 2.1 - 0.5 * smooth(0.66, 0.86, t), e = 2 / (sa > 0 ? eu : el);   // oben am Kopf flach, hinten ein Kiel
  const tip = t < 0.03 ? Math.sqrt(Math.max(0, 1 - (1 - t / 0.03) ** 2)) : 1;   // die Schnauze läuft rund zusammen
  let x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * w * tip, y = Math.sign(sa) * Math.pow(Math.abs(sa), e) * (sa > 0 ? hu : hl) * tip, z = zOf(t);
  const sm = mouthS(t), lowK = smooth(-0.05, 0.12, sm - sa), headK = 1 - smooth(0.19, 0.24, t);
  let dr = 0;
  dr -= 0.0032 * gauss(sa - sm, 0.07) * headK * smooth(0, 0.015, t);                          // Mundspalte
  dr += 0.0024 * gauss(sa - sm - 0.12, 0.08) * headK;                                         // Oberlippe wölbt sich darüber
  dr += 0.0032 * lowK * smooth(0.03, 0.1, t) * (1 - smooth(0.15, 0.26, t));                    // Unterkiefer: breiter Rand
  dr += 0.0065 * gauss(t - EYE_T, 0.012) * gauss(sa - EYE_S, 0.07) * smooth(0.3, 0.6, Math.abs(ca));   // Wulst ums Auge
  dr += 0.0065 * gauss(t - 0.178, 0.018) * smooth(0.86, 0.98, sa);                            // Spritzschutz vor den Blaslöchern
  dr += 0.0028 * smooth(0.93, 1, sa) * smooth(0.015, 0.04, t) * (1 - smooth(0.11, 0.16, t));    // Mittelgrat auf der Schnauze
  dr += 0.011 * gauss(t - 0.6, 0.032) * smooth(0.55, 0.97, sa);                               // der Buckel vor der Finne
  if (t > 0.69 && t < 0.89) dr += 0.0038 * Math.max(0, Math.sin((t - 0.69) * PI * 9)) ** 2 * smooth(0.88, 0.99, sa);   // Knöchel auf dem Schwanzstiel
  dr += 0.0012 * Math.sin(t * 31 + 2 * a) * Math.sin(t * 17 - a) * smooth(0.04, 0.12, t);       // nichts ist ganz glatt
  z += 0.009 * lowK * smooth(0, 0.02, t) * (1 - smooth(0.03, 0.1, t)) - 0.006 * (1 - lowK) * (1 - smooth(0, 0.05, t));   // der Unterkiefer steht vor
  const rl = Math.hypot(ca, sa * 1.1) || 1; x += ca / rl * dr; y += sa * 1.1 / rl * dr;
  return [x, y + yc, z];
}
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Normale der Haut an (t, a), aus kleinen Schritten */
function bodyN(t, a) { const n = norm(...cross(sub(bodyPt(t, a + 0.012), bodyPt(t, a - 0.012)), sub(bodyPt(Math.min(1, t + 0.004), a), bodyPt(Math.max(0, t - 0.004), a)))); return [-n[0], -n[1], -n[2]]; }

export function buildWhale(calf) {
  const P = [], N = [], K = [], I = []; let n = 0; const R = rng(calf ? 77 : 41);
  const v = (p, nr, t, part, vv, uu) => { P.push(p[0], p[1], p[2]); N.push(nr[0], nr[1], nr[2]); K.push(t, part, vv, uu); return n++; };
  /** Gitter mit geschlossenem Umfang: pt(i, j) liefert [Punkt, t, Teil, v, u]; Normalen aus den Nachbarn */
  const grid = (NI, NJ, pt, flip) => {
    const b0 = n, G = [];
    for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) { const q = pt(i, j); G.push(q[0]); v(q[0], [0, 1, 0], q[1], q[2], q[3], q[4]); }
    const g = (i, j) => G[clamp(i, 0, NI) * (NJ + 1) + ((j + NJ) % NJ)];
    for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) {
      const A = g(i, j + 1), B = g(i, j - 1), C = g(Math.min(NI, i + 1), j), D = g(Math.max(0, i - 1), j); const cr = cross(sub(A, B), sub(C, D)); let nn = norm(...cr);
      if (Math.hypot(...cr) < 1e-12) nn = [0, 1, 0]; if (flip) nn = [-nn[0], -nn[1], -nn[2]];
      const q = (b0 + i * (NJ + 1) + j) * 3; N[q] = nn[0]; N[q + 1] = nn[1]; N[q + 2] = nn[2];
    }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const a = b0 + i * (NJ + 1) + j, b = a + 1, c = a + NJ + 1, d = c + 1; if (flip) I.push(a, b, c, b, d, c); else I.push(a, c, b, b, c, d); }
    return b0;
  };
  // ---------- Körper ----------
  const NT = 120, NA = 84, tOf = (j) => { const s = j / NT; return s < 0.1 ? 0.04 * (s / 0.1) ** 1.4 : 0.04 + 0.96 * ((s - 0.1) / 0.9); };
  const b0 = grid(NT, NA, (j, i) => { const t = tOf(j), a = i / NA * 2 * PI; return [bodyPt(t, a), t, 0, i / NA, 0]; }, true);
  for (let i = 0; i <= NA; i++) { const q = (b0 + i) * 3; N[q] = 0; N[q + 1] = -0.2; N[q + 2] = 0.98; }   // Schnauzenspitze
  { const yc = prof(1)[3], c = v([0, yc, zOf(1) - 0.002], [0, 0, -1], 1, 0, 0.25, 0); for (let i = 0; i < NA; i++) { const a = b0 + NT * (NA + 1) + i; I.push(c, a, a + 1); } }

  /** Profil eines Flügels (Flosse, Fluke, Finne): Vorderkante L, Sehne cd (Länge C), Dicke nd (T); j läuft rund ums Profil */
  const foil = (L, cd, nd, C, T, j, NJ) => { const ph = j / NJ * 2 * PI, p = (1 - Math.cos(ph)) / 2, side = ph < PI ? 1 : -1, th = T * 1.25 * Math.sqrt(p) * Math.pow(1 - p, 1.1) * side;
    return [[L[0] + cd[0] * p * C + nd[0] * th, L[1] + cd[1] * p * C + nd[1] * th, L[2] + cd[2] * p * C + nd[2] * th], p, side]; };
  const tipR = (s, from) => (s > from ? Math.sqrt(Math.max(0, 1 - ((s - from) / (1 - from)) ** 2)) : 1);

  // ---------- Brustflossen: fast ein Drittel der Körperlänge, dick an der Wurzel, Vorderkante mit großen Höckern ----------
  const fins = [];
  for (const sx of [1, -1]) {
    const ar = sx > 0 ? -0.55 : PI + 0.55, rn = bodyN(0.27, ar), r0 = bodyPt(0.27, ar), R0 = [r0[0] - rn[0] * 0.014, r0[1] - rn[1] * 0.014, r0[2] - rn[2] * 0.014], d = norm(sx * 0.66, -0.48, -0.58);
    const spine = (s) => [R0[0] + d[0] * 0.31 * s, R0[1] + d[1] * 0.31 * s - 0.016 * s * s, R0[2] + d[2] * 0.31 * s - 0.055 * s * s];
    const scal = (s) => 0.0085 * Math.pow(Math.abs(Math.sin(PI * s * 8.5)), 0.6) * smooth(0.12, 0.28, s) * (1 - 0.35 * s);
    const frame = (s) => { const sd = norm(...sub(spine(Math.min(1, s + 0.01)), spine(Math.max(0, s - 0.01)))), back = [0, -0.25, -1], k = back[0] * sd[0] + back[1] * sd[1] + back[2] * sd[2];
      const cd = norm(back[0] - sd[0] * k, back[1] - sd[1] * k, back[2] - sd[2] * k); let nd = norm(...cross(sd, cd)); if (nd[1] < 0) nd = [-nd[0], -nd[1], -nd[2]]; return { sd, cd, nd }; };
    const sec = (s, j, NJ) => { const f = frame(s), tr = tipR(s, 0.84), C = (0.074 - 0.05 * Math.pow(s, 1.6)) * tr + 0.002, T = (0.026 - 0.017 * s) * tr + 0.0008, sc = scal(s) * tr, sp = spine(s);
      const L = [sp[0] - f.cd[0] * (C * 0.3 + sc), sp[1] - f.cd[1] * (C * 0.3 + sc), sp[2] - f.cd[2] * (C * 0.3 + sc)]; return foil(L, f.cd, f.nd, C + sc, T, j, NJ); };
    const NS = 44, NJ = 22; grid(NS, NJ, (i, j) => { const s = i / NS, q = sec(s, j, NJ); return [q[0], 0.27, 4, s, q[1] + (q[2] < 0 ? 2 : 0)]; }, sx < 0);
    fins.push({ sx, sec, frame });
  }
  // ---------- Fluke: wächst aus dem Schwanzstiel, gespitzte Enden, gezackte Hinterkante, Kerbe in der Mitte ----------
  const [fhu, fhl, , fyc] = prof(1);
  const fluke = (sx, s) => { const zle = -0.484 - 0.078 * Math.pow(s, 1.35), C0 = 0.094 * (1 - Math.pow(s, 2.3)) + 0.004;
    let zte = zle - C0 + 0.026 * (1 - smooth(0, 0.1, s)); zte += 0.0045 * (Math.sin(s * 55) + 0.5 * Math.sin(s * 97 + 1)) * smooth(0.12, 0.28, s) * (1 - smooth(0.8, 0.97, s));
    const C = Math.max(0.003, zle - zte), T = (fhu + fhl) * 1.05 * Math.pow(1 - s, 1.4) + 0.0016, y = fyc + 0.011 * s * s;
    return { L: [sx * 0.168 * s, y, zle], C, T }; };
  for (const sx of [1, -1]) { const NS = 48, NJ = 20;
    grid(NS, NJ, (i, j) => { const s = Math.pow(i / NS, 0.85), f = fluke(sx, s), q = foil(f.L, [0, 0, -1], [0, 1, 0], f.C, f.T, j, NJ); return [q[0], 1 + (-0.484 - q[0][2]) * 2.2 + 0.016, 5, s, q[1] + (q[2] < 0 ? 2 : 0)]; }, sx > 0); }
  // ---------- Rückenfinne: wächst vorn flach aus dem Rücken heraus und fällt hinten steil ab; der Fuß liegt eingebettet auf der Haut ----------
  { const NS = 14, NJ = 14, topAt = (z) => bodyPt(0.5 - z, PI / 2)[1];
    grid(NS, NJ, (i, j) => { const h = i / NS, zf = -0.02 - 0.125 * Math.pow(h, 0.45), zb = -0.172 + 0.02 * Math.pow(h, 1.2), C = Math.max(0.003, zf - zb), T = 0.02 * Math.pow(1 - h, 1.5) + 0.0012;
      const q = foil([0, 0, zf], [0, 0, -1], [1, 0, 0], C, T, j, NJ), z = q[0][2]; q[0][1] = topAt(z) - 0.006 * (1 - h) + 0.034 * Math.pow(h, 1.25) * smooth(-0.02, -0.07, z); return [q[0], 0.63, 7, h, q[1]]; }, false); }

  // ---------- kleine Körper auf der Haut: Knubbel und Seepocken ----------
  const frameAt = (nr) => { const up = Math.abs(nr[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm(...cross(nr, up)), e2 = cross(nr, e1); return [e1, e2]; };
  const knob = (p, nr, r, t) => { const [e1, e2] = frameAt(nr), S = 7, RN = 3, k0 = n;
    for (let ri = 0; ri <= RN; ri++) { const ph = ri / RN * PI / 2, cr = Math.cos(ph), sr = Math.sin(ph);
      for (let si = 0; si < S; si++) { const q = si / S * 2 * PI, dx = e1.map((x, k) => x * Math.cos(q) + e2[k] * Math.sin(q)), dn = norm(...dx.map((x, k) => x * cr + nr[k] * sr));
        v(p.map((x, k) => x + (dx[k] * cr + nr[k] * sr * 0.8) * r - nr[k] * r * 0.3), dn, t, 6, ri / RN, 0); } }
    for (let ri = 0; ri < RN; ri++) for (let si = 0; si < S; si++) { const a0 = k0 + ri * S + si, a1 = k0 + ri * S + (si + 1) % S; I.push(a0, a1, a0 + S, a1, a1 + S, a0 + S); } };
  const barnacle = (p, nr, r, t, uu = 0) => { const [e1, e2] = frameAt(nr), S = 8, k0 = n, h = r * (0.7 + R() * 0.5), tw = R() * 6;
    const ring = (rad, up, out, w) => { for (let si = 0; si < S; si++) { const q = si / S * 2 * PI + tw, rr = rad * (1 + 0.12 * Math.sin(q * 3 + tw)), dx = e1.map((x, k) => x * Math.cos(q) + e2[k] * Math.sin(q));
      v(p.map((x, k) => x + dx[k] * rr + nr[k] * up), norm(...dx.map((x, k) => x * out + nr[k] * (1 - Math.abs(out)))), t, 8, w, uu); } };
    ring(r, -r * 0.2, 0.9, 0); ring(r * 0.62, h, 0.5, 0.5); ring(r * 0.38, h * 0.92, -0.3, 1);
    for (let rr = 0; rr < 2; rr++) for (let si = 0; si < S; si++) { const a0 = k0 + rr * S + si, a1 = k0 + rr * S + (si + 1) % S; I.push(a0, a1, a0 + S, a1, a1 + S, a0 + S); }
    const c = v(p.map((x, k) => x + nr[k] * h * 0.55), nr, t, 8, 2, uu); for (let si = 0; si < S; si++) I.push(k0 + 2 * S + si, k0 + 2 * S + (si + 1) % S, c); };
  const onBody = (t, a) => [bodyPt(t, a), bodyN(t, a)];
  const side = (sx, sa) => (sx > 0 ? Math.asin(clamp(sa, -1, 1)) : PI - Math.asin(clamp(sa, -1, 1)));
  // Knubbel: drei Reihen auf der flachen Schnauze, eine am Unterkiefer entlang, ein Büschel am Kinn
  for (let k = 0; k < 9; k++) { const t = 0.024 + k * 0.019; { const [p, nr] = onBody(t, PI / 2); knob(p, nr, 0.0046, t); }
    for (const sx of [1, -1]) { if (k > 0) { const [p, nr] = onBody(t + 0.006, PI / 2 - sx * (0.36 + R() * 0.1)); knob(p, nr, 0.0041, t); }
      if (k > 1 && k < 8) { const [p, nr] = onBody(t - 0.004, PI / 2 - sx * (0.78 + R() * 0.12)); knob(p, nr, 0.0036, t); } } }
  for (const sx of [1, -1]) for (let k = 0; k < 9; k++) { const t = 0.012 + k * 0.022, [p, nr] = onBody(t, side(sx, mouthS(t) - 0.1 - R() * 0.04)); knob(p, nr, 0.0042 + R() * 0.001, t); }
  for (let k = 0; k < 7; k++) { const t = 0.008 + R() * 0.03, [p, nr] = onBody(t, -PI / 2 + (R() - 0.5) * 1.3); knob(p, nr, 0.0045 + R() * 0.0015, t); }
  // Seepocken: dichtes Büschel am Kinn, einige am Kieferrand und an der Kehle
  const nb = calf ? 0.35 : 1;
  for (let k = 0; k < 16 * nb; k++) { const t = 0.006 + R() * 0.035, [p, nr] = onBody(t, -PI / 2 + (R() - 0.5) * 1.6); barnacle(p, nr, 0.0034 + R() * 0.0028, t); }
  for (const sx of [1, -1]) for (let k = 0; k < 6 * nb; k++) { const t = 0.03 + R() * 0.17, [p, nr] = onBody(t, side(sx, mouthS(t) - 0.05 - R() * 0.12)); barnacle(p, nr, 0.0026 + R() * 0.002, t); }
  for (let k = 0; k < 5 * nb; k++) { const t = 0.08 + R() * 0.3, [p, nr] = onBody(t, -PI / 2 + (R() - 0.5) * 1.2); barnacle(p, nr, 0.0024 + R() * 0.0018, t); }
  // an den Flossen: auf den Höckern der Vorderkante zur Spitze hin; an den Spitzen der Fluke
  for (const f of fins) for (let k = 0; k < 9 * nb; k++) { const s = 0.45 + R() * 0.5, q = f.sec(s, 1 + Math.floor(R() * 3), 22), fr = f.frame(s), nr = norm(...fr.nd.map((x, kk) => x * 0.7 - fr.cd[kk] * 0.7)); barnacle(q[0], nr, 0.0024 + R() * 0.0018, q[1], 1 + s); }
  for (const sx of [1, -1]) for (let k = 0; k < 3 * nb; k++) { const s = 0.75 + R() * 0.2, f = fluke(sx, s); barnacle([f.L[0], f.L[1] + f.T * 0.3, f.L[2] - f.C * 0.3], [0, 1, 0], 0.0022 + R() * 0.0012, 1.05); }
  // ---------- Augen: dunkle Linse in einem Lid ----------
  for (const sx of [1, -1]) { const a = side(sx, EYE_S), p = bodyPt(EYE_T, a), nr = bodyN(EYE_T, a), [e1, e2] = frameAt(nr), S = 14, e0 = n, r = 0.0074;
    v(p.map((x, k) => x + nr[k] * 0.0016), nr, EYE_T, 3, 0, 0);
    for (let i = 0; i <= S; i++) { const q = i / S * 2 * PI; v(p.map((x, k) => x + (e1[k] * Math.cos(q) * 0.62 + e2[k] * Math.sin(q)) * r + nr[k] * 0.0006), nr, EYE_T, 3, 1, 0); }
    for (let i = 0; i < S; i++) I.push(e0, e0 + 1 + i, e0 + 2 + i); }

  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I);
  return g;
}

const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA, iB; uniform float uTime; varying vec3 vW, vN, vTa; varying vec4 vK; varying vec2 vI;
  float env(float t, float r){ float e = smoothstep(0.26 - r, 1.18, t); return 0.07 + e * e * 1.05; }
  float wave(float t, float ph, float amp){ float r = clamp(amp / 0.045 - 1.0, 0.0, 1.0) * 0.2; return amp * env(t, r) * sin(ph - t * 3.3); }   // beim Kraftschlag reicht die Welle weiter nach vorn
  void main(){ vec3 p = position, nr = normalize(normal); float part = aK.y, ph = iA.x, amp = iA.w;
    float t = 0.5 - position.z; t += max(0.0, t - 0.984) * 0.8;   // nach der Lage, damit Fluke, Finne, Knubbel und Seepocken genau mit dem Körper gehen; die Fluke federt etwas nach
    // die Welle läuft durch den ganzen Körper zur Fluke; die Normalen kippen mit
    float d = wave(t, ph, amp), f = (wave(t + 0.02, ph, amp) - d) / 0.02, c = 1.0 / sqrt(1.0 + f * f), s = f * c;
    p.y += d; nr = vec3(nr.x, nr.y * c + nr.z * s, -nr.y * s + nr.z * c);
    // in der Kurve biegt sich der Körper
    p.x += iA.y * 0.5 * (t - 0.45) * (t - 0.45);
    p.y += iB.w * 0.5 * (t - 0.45) * (t - 0.45);   // beim Abtauchen wölbt sich der Rücken, beim Aufsteigen biegt er sich durch
    // Brustflossen (und was auf ihnen sitzt): rudern mit dem Schlag des Körpers, die Spitze hinkt nach; dazu drehen sie sich leicht um ihre Längsachse und pendeln vor und zurück
    bool onFin = part > 7.5 && aK.w > 0.5;
    if ((part > 3.5 && part < 4.5) || onFin) { float w = onFin ? aK.w - 1.0 : aK.z, pc = onFin ? aK.x : mod(aK.w, 2.0), sd = sign(p.x), lag = w * 1.2;
      float a1 = uTime * 0.55 + iA.z * 9.0 + sd * 0.8 - lag, a2 = ph - 0.9 - lag, k2 = amp / 0.045;
      float fl = sin(a1) * 0.05 + sin(a2) * 0.04 * k2 + iB.x + sd * iB.y, tw = cos(a1) * 0.5 + cos(a2) * 0.5 * k2;
      p.y += fl * pow(w, 1.3) * 0.31 + tw * (pc - 0.35) * 0.03 * (0.3 + w); p.z += fl * 0.25 * w * w * 0.31 + sin(uTime * 0.31 + iA.z * 5.0 + sd) * 0.02 * w; p.x -= sd * abs(fl) * 0.1 * w * w * 0.31; }
    // Drehen auf die Seite: vorn mit den Flossen zuerst, das Hinterteil folgt in einer Welle
    { float tw = iB.z * smoothstep(0.12, 1.1, t), ct = cos(tw), st = sin(tw); p.xy = vec2(ct * p.x - st * p.y, st * p.x + ct * p.y); nr.xy = vec2(ct * nr.x - st * nr.y, st * nr.x + ct * nr.y); }
    vK = aK; vTa = vec3(0.0);
    if (part < 0.5) { float a = aK.z * 6.2832; vTa = vec3(-sin(a), cos(a), 0.0); }
    p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vTa = R * vTa; vW = w; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;

const FS = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vTa; varying vec4 vK; varying vec2 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nz(vec2 p){ return texture2D(uNoise, p).r; }
  ${MOUTH_GL}
  // marmoriert: Rauschen, das sich selbst verbiegt, gibt die geschwungenen Schlieren der Vorlage
  float marb(vec2 p){ p += 0.45 * vec2(nz(p * 0.6 + 1.3), nz(p * 0.7 + 5.1)) - 0.22; return nz(p * 0.8); }
  // Kehlfurchen: lange Rillen; nahe 1 = Rille
  float groove(float a, float t, float seed){ float q = 0.5 + 0.5 * cos(a * 34.0 + 0.5 * sin(t * 18.0 + seed * 7.0) + 0.25 * sin(t * 47.0)); return smoothstep(0.8, 0.98, q); }
  vec3 lightW(vec3 base, vec3 N, vec3 wp){ float lk = exp(wp.y * 0.0125), top = max(N.y, 0.0), side = max(dot(N, uSunDir), 0.0), wrap = 0.5 + 0.5 * dot(N, uSunDir);
    vec3 amb = vec3(0.020, 0.105, 0.225) * max(0.2, 0.45 + 0.55 * N.y) * (0.35 + 0.65 * lk) + vec3(0.045, 0.2, 0.3) * (0.5 - 0.5 * N.y) * lk;   // von unten kommt Streulicht aus dem Wasser, sonst wäre der Bauch schwarz
    float cau = caustic(wp.xz * 0.7 + wp.y * 0.3) * smoothstep(0.35, 0.85, N.y) * smoothstep(-60.0, -20.0, wp.y);
    return base * (amb + vec3(0.10, 0.56, 0.95) * (top * 0.8 + side * 0.3 + wrap * wrap * 0.18) * lk * 1.15 * (0.88 + 0.28 * cau) + lights(wp, N)); }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x; vec3 base; float spots = 0.0, ao = 1.0;
    vec3 c0 = vec3(0.16, 0.215, 0.255), c1 = vec3(0.31, 0.385, 0.43), pale = vec3(0.6, 0.66, 0.68), white = vec3(0.82, 0.86, 0.86);
    if (part < 0.5) {   // Haut
      float a = vv * 6.2832, sa = sin(a), ca = cos(a), sm = mouthS(t);
      vec2 mp = vec2(t * 6.0 + seed * 3.0, vv * 5.0); float m = marb(mp), m2 = nz(mp * 2.7 + 9.0);
      base = mix(c0, c1, smoothstep(0.38, 0.78, m) * 0.75 + m2 * 0.18);
      base *= 0.88 + 0.12 * (1.0 - smoothstep(0.3, 1.0, sa));   // der Rücken etwas dunkler
      float und = smoothstep(-0.22, -0.62, sa + 0.3 * (m - 0.5)) * smoothstep(0.03, 0.1, t) * (1.0 - smoothstep(0.72, 0.92, t));
      base = mix(base, vec3(0.52, 0.59, 0.62) * (0.9 + 0.2 * m2), und * 0.85);   // Unterseite deutlich heller, mit wolkigem Rand
      // Kehle: helle Furchen von unter dem Maul bis zum Nabel; die Rillen selbst dunkel, mit Relief
      float thr = smoothstep(0.0, 0.12, sm - 0.16 - sa) * smoothstep(0.012, 0.05, t) * (1.0 - smoothstep(0.44, 0.52, t)) * smoothstep(0.0, 0.25, -sa + 0.15);
      float lod = 1.0 - smoothstep(1.4, 3.0, fwidth(a * 34.0)), gr = groove(a, t, seed) * lod;
      vec3 throat = mix(vec3(0.58, 0.65, 0.68), vec3(0.74, 0.78, 0.79), smoothstep(0.3, 0.8, nz(vec2(t * 9.0, vv * 3.0) + seed)));
      base = mix(base, mix(throat, vec3(0.15, 0.19, 0.22), gr * 0.9), thr);   // die Furchen sind aufgemalt und zusätzlich als Relief beleuchtet
      if (thr > 0.01 && lod > 0.01) { float e = 0.01, dg = (groove(a + e, t, seed) - groove(a - e, t, seed)) / (2.0 * e); N = normalize(N - normalize(vTa) * dg * 0.02 * thr * lod); }
      // Bauch hinter der Kehle: weißliche Flecken
      float bel = smoothstep(-0.5, -0.9, sa) * smoothstep(0.46, 0.56, t) * (1.0 - smoothstep(0.78, 0.92, t));
      base = mix(base, pale * (0.85 + 0.15 * m2), bel * smoothstep(0.5, 0.65, marb(mp * 1.6 + 4.0)) * 0.7);
      // Mundlinie: dunkle Spalte, darunter ein heller Saum der Unterlippe
      float hk = 1.0 - smoothstep(0.205, 0.235, t), ml = sa - sm;
      base *= 1.0 - 0.75 * (1.0 - smoothstep(0.0, 0.035, abs(ml))) * hk; base = mix(base, pale * 0.8, (1.0 - smoothstep(0.02, 0.07, abs(ml + 0.07))) * hk * 0.35);
      // Lid ums Auge
      float ey = length(vec2((t - 0.222) * 9.0, (sa - mouthS(0.222) - 0.115) * 1.6)); base *= 1.0 - 0.45 * (1.0 - smoothstep(0.05, 0.11, ey)) * smoothstep(0.025, 0.06, ey) * step(0.3, abs(ca));
      // Blaslöcher: zwei Schlitze hinter dem Spritzschutz
      float bh = (1.0 - smoothstep(0.008, 0.02, abs(abs(ca) - 0.05))) * smoothstep(0.188, 0.194, t) * (1.0 - smoothstep(0.214, 0.22, t)) * step(0.0, sa);
      base *= 1.0 - 0.7 * bh;
      // ein paar helle Narben
      float scr = smoothstep(0.47, 0.495, abs(fract(t * 11.0 + vv * 7.0 + nz(vec2(t * 2.0 + seed, vv * 1.4)) * 3.0 + seed * 5.0) - 0.5)) * step(0.66, nz(vec2(t * 3.0, vv * 2.2) + seed * 1.7)) * (1.0 - thr);
      base = mix(base, pale * 0.9, scr * 0.3);
      // feine helle Punkte auf Rücken und Flanken, wie in der Vorlage
      vec2 cs = vec2(t * 150.0, vv * 64.0), cf = fract(cs) - 0.5; spots = step(0.955, h21(floor(cs) + seed * 13.0)) * (1.0 - smoothstep(0.12, 0.38, length(cf))) * smoothstep(-0.4, 0.4, sa) * smoothstep(0.06, 0.16, t) * (1.0 - smoothstep(0.88, 0.98, t));
    } else if (part < 3.5) {   // Auge
      base = vv < 0.5 ? vec3(0.02, 0.025, 0.03) : vec3(0.06, 0.07, 0.08);
      base += vec3(0.25, 0.3, 0.32) * pow(max(dot(reflect(-V, N), uSunDir), 0.0), 30.0);
    } else if (part < 4.5) {   // Brustflossen: oben dunkel, zum Rand hin weiß gefleckt; unten fast weiß, mit grauen Wolken
      float p = mod(u, 2.0), under = step(2.0, u), m = marb(vec2(vv * 7.0 + seed * 4.0, p * 3.0)), lead = 1.0 - smoothstep(0.0, 0.2, p), trail = smoothstep(0.82, 1.0, p);
      float wk = clamp(lead * 0.95 + trail * 0.6 + smoothstep(0.7, 1.0, vv) * 0.35 + smoothstep(0.45, 0.7, m) * 0.35 * (0.3 + vv), 0.0, 1.0);
      base = mix(mix(c0, c1, m * 0.6), white * (0.85 + 0.15 * m), wk);
      base = mix(base, mix(white, pale * 0.75, smoothstep(0.55, 0.75, m) * 0.6), under * (0.6 + 0.4 * vv));
      ao = 0.75 + 0.25 * smoothstep(0.0, 0.15, vv);   // an der Wurzel etwas Schatten
    } else if (part < 5.5) {   // Fluke: oben dunkel; unten das Muster, an dem man jeden Wal erkennt; die gezackte Hinterkante dunkel gesäumt
      float p = mod(u, 2.0), under = step(2.0, u), m = marb(vec2(vv * 4.0 + seed * 5.0, p * 2.0 + seed));
      base = mix(c0, c1, m * 0.5);
      base = mix(base, mix(white * 0.8, vec3(0.12, 0.14, 0.16), smoothstep(0.52, 0.6, m + 0.18 * vv - 0.1 * p)), under);
      base = mix(base, vec3(0.08, 0.1, 0.12), smoothstep(0.88, 1.0, p) * 0.8);
    } else if (part < 6.5) {   // Knubbel: hautfarben, oben etwas heller, in der Mitte ein dunkler Punkt (dort wächst ein Haar)
      base = mix(c1 * 1.1, pale * 0.85, smoothstep(0.3, 1.0, vv)) * (0.9 + 0.2 * h21(floor(vW.xz * 30.0)));
      base *= 1.0 - 0.6 * smoothstep(0.85, 1.0, vv);
    } else if (part < 7.5) {   // Rückenfinne
      base = mix(c0, c1, marb(vec2(vv * 3.0, u * 2.0) + seed) * 0.5);
    } else {   // Seepocken: kalkig, rau, oben ein dunkler Krater
      base = mix(vec3(0.86, 0.84, 0.76), vec3(0.68, 0.68, 0.62), h21(floor(vW.xz * 90.0 + vv * 3.0))) * (vv > 1.5 ? 0.3 : vv > 0.75 ? 0.75 : 1.0) * 1.25;
    }
    vec3 c = lightW(base * ao, N, vW) * 1.15;
    float fr = pow(1.0 - max(dot(N, V), 0.0), 2.6), lk = exp(vW.y * 0.0125);
    c += waterCol(reflect(-V, N)) * fr * 0.3 + vec3(0.5, 0.75, 0.85) * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 18.0) * 0.08 * lk;
    // türkiser Saum an den Rändern und die feinen Punkte: ganz leise, wie Licht, das sich in der Haut fängt
    c += vec3(0.1, 0.6, 0.65) * fr * 0.3 * uDeep + vec3(0.4, 0.92, 0.95) * spots * 0.45 * uDeep;
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;

/** sucht einen Ort für die Gruppe über dem großen Abgrund: tief genug, mit Platz für ihre Kreise, 400 bis 700 m vom Boot */
export function chooseHumpSpot(sx, sz, rand = Math.random) {
  const ok = (x, z) => { if (Math.hypot(x, z) > 1340 || floorH(x, z) > -250) return false; for (let k = 0; k < 8; k++) { const a = k / 8 * 2 * PI; if (floorH(x + Math.cos(a) * 48, z + Math.sin(a) * 48) > -160) return false; } return true; };
  const opts = [];
  for (let i = 0; i < 2500 && opts.length < 24; i++) { const a = rand() * 2 * PI, r = 400 + rand() * 300, x = sx + Math.sin(a) * r, z = sz + Math.cos(a) * r; if (ok(x, z)) opts.push({ x, z }); }
  if (!opts.length) {   // zu weit weg vom Abgrund: der Punkt im Abgrund, dessen Abstand am besten passt
    let best = null, bd = 1e9; for (let x = -480; x <= 760; x += 20) for (let z = 300; z <= 1480; z += 20) { if (!ok(x, z)) continue; const d = Math.abs(Math.hypot(x - sx, z - sz) - 550); if (d < bd) { bd = d; best = { x, z }; } }
    if (best) opts.push(best); else opts.push({ x: 95, z: 600 });
  }
  const o = opts[Math.floor(rand() * opts.length)]; return { x: o.x, z: o.z, seed: Math.floor(rand() * 1e6) };
}

export function createHumpbacks(scene) {
  // zwei Modelle: Erwachsene und Kälber (die Kälber mit weniger Seepocken)
  const M = 6;
  const mk = (calf) => { const g = buildWhale(calf), D = { g, k: 0 };
    for (const k of ['iP', 'iR', 'iA', 'iB']) { D[k] = new Float32Array(M * 4); g.setAttribute(k, new T.InstancedBufferAttribute(D[k], 4)); } g.instanceCount = 0;
    const mat = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS, fragmentShader: FS }); mat.extensions.derivatives = true;
    const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh); return D; };
  const AD = mk(false), CA = mk(true);
  // Ausatmen: ab und zu steigt ein Schwall Blasen aus dem Blasloch zur Oberfläche
  const NB = 140, bp = new Float32Array(NB * 3), bl = new Float32Array(NB), bv = new Float32Array(NB); let bi = 0; for (let i = 0; i < NB; i++) bp[i * 3 + 1] = 999;
  const PX = { value: 600 }, bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3)); bg.setAttribute('aL', new T.BufferAttribute(bl, 1));
  const bm = quadPoints(bg, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false,
    vertexShader: `attribute float aL; uniform float uPx, uFogK; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); vA = smoothstep(0.0, 0.3, aL) * 0.6 * exp(-(-mv.z) * uFogK * 0.8); gl_PointSize = max(1.5, (0.07 + 0.1 * (1.0 - aL)) * uPx / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = (1.0 - smoothstep(0.42, 0.5, r)) * (0.3 + 0.7 * smoothstep(0.2, 0.44, r)); gl_FragColor = vec4(vec3(0.75, 0.93, 1.0), a * vA); }` }));
  bm.frustumCulled = false; bm.renderOrder = 7; scene.add(bm);

  const H = { list: [], spheres: [], pod: null, mode: 'off', time: 0, src: { x: 0, z: 0 }, Y0: -11.5 };
  const newWhale = (o, R) => Object.assign({ ph: R() * 6.3, seed: R(), amp: 0.045, wob: R() * 6.3, roll: 0, rollT: 20 + R() * 30, blow: 6 + R() * 20, gone: false, dive0: 0, yaw: 0, pitch: 0, x: 0, y: 0, z: 0, turn: 0,
    stroke: 0, strokeT: 3 + R() * 8, flap: 0, vy: 0, evT: 8 + R() * 20, ev: 0, evS: 0 }, o);
  /** setzt die Gruppe an einen Ort (oder entfernt sie mit null). seed macht Anzahl, Größen und Plätze jedes Mal gleich.
   *  Solange niemand ein Foto gemacht hat, spielen sie an Ort und Stelle: jeder zieht eigene Kreise, mal steigt einer steil auf oder taucht kurz ab, die Kälber bei der Mutter */
  H.setPod = (pod) => {
    H.pod = pod; H.list.length = 0; H.spheres.length = 0; H.time = 0; H.still = false; H.mode = pod ? 'play' : 'off'; AD.g.instanceCount = CA.g.instanceCount = 0; if (!pod) return;
    const R = rng(pod.seed || 1), rr = (a, b) => a + R() * (b - a), adults = 3 + (R() < 0.5 ? 1 : 0), calves = R() < 0.6 ? 1 : 2;
    H.dir = R() < 0.5 ? 1 : -1; H.src.x = pod.x; H.src.z = pod.z;
    for (let i = 0; i < adults; i++) { const w = newWhale({ L: rr(12.5, 15), calf: false, band: 9 + i * 6.5, spd: rr(2.0, 2.6), up: rr(-1.5, 1.5) }, R); w.rad = w.band + rr(-2, 2); w.radT = w.rad; w.ang = R() * 2 * PI; w.x = pod.x + Math.sin(w.ang) * w.rad; w.z = pod.z + Math.cos(w.ang) * w.rad; w.y = H.Y0 + w.up; w.yT = w.y; H.list.push(w); }
    for (let c = 0; c < calves; c++) { const m = H.list[c], w = newWhale({ L: rr(5.2, 6.4), calf: true, mom: c, rollT: 1e9, amp: 0.055, side: c ? -1 : 1 }, R); w.x = m.x + 4; w.y = m.y + 2.5; w.z = m.z; H.list.push(w); }
    for (const w of H.list) { w.px = w.x; w.py = w.y; w.pz = w.z; }
  };
  /** zum Ansehen (Vorschau, Entwicklermenü): Wale stehen an festen Plätzen und schwimmen auf der Stelle */
  H.showcase = (x, y, z, n = 1) => {
    H.setPod({ x, z, seed: 5 }); H.still = true; H.list.length = 0; const R = rng(9);
    const sp = [[0, 0, 0, 14, false], [-26, 4, 6, 13.5, false], [7, 4, 6, 5.8, true], [24, -3, -8, 14.5, false], [-14, 7, -14, 6.2, true], [14, -7, 20, 13, false]];
    for (let i = 0; i < Math.min(n, 6); i++) { const s = sp[i], w = newWhale({ L: s[3], calf: s[4], rollT: 1e9 }, R); w.x = x + s[0]; w.y = y + s[1]; w.z = z + s[2]; w.yaw = 0; w.fix = true; H.list.push(w); }
  };
  /** ein kräftiger Flossenschlag (alle, oder Wal i) */
  H.kick = (i) => { H.list.forEach((w, k) => { if (i === undefined || i === k) w.stroke = 2.8; }); };
  /** sie ziehen los: erst sammeln sie sich hintereinander auf einem weiten Kreis, dann tauchen sie einer nach dem anderen ab, die Kälber mit der Mutter */
  H.dive = () => { if (H.mode !== 'play') return; H.mode = 'dive'; let k = 0; for (const w of H.list) if (!w.calf) { w.slot = k; w.dive0 = H.time + 6 + k++ * 2.6 + Math.random(); } };
  H.diving = () => H.mode === 'dive' && H.list.some((w) => !w.gone);
  const FORM = [[30, 0], [25, -0.24], [35, -0.3], [30, -0.52]];   // Platz in der Formation: Halbmesser, Winkel hinter dem Ersten
  /** bewegt einen Großen um einen Schritt (Spielen oder Formation) */
  function moveAdult(w, dt, k) {
    const lead = H.list[0];
    if (H.mode === 'play') {
      w.evT -= dt; if (w.evT < 0 && !w.ev) { w.ev = Math.random() < 0.55 ? 1 : 2; w.evS = 0; w.evT = 18 + Math.random() * 26; if (Math.random() < 0.4) w.radT = w.band + (Math.random() - 0.5) * 6; }
      if (w.ev) { w.evS += dt; w.yT = w.ev === 1 ? -6.5 : -42; if (w.evS > (w.ev === 1 ? 8 : 13)) w.ev = 0; } else w.yT = H.Y0 + w.up;   // 1: steil hinauf bis dicht unter die Oberfläche, 2: fast senkrecht hinab, über die Fluke, und wieder herauf
      w.rad += (w.radT - w.rad) * Math.min(1, dt * 0.15);
      const dv = w.ev === 2 && w.evS < 6 ? 0.25 : 1;   // beim steilen Abtauchen kaum Fahrt nach vorn, damit er fast senkrecht steht
      w.ang += H.dir * w.spd * dv * (1 + 0.35 * k) / Math.max(6, w.rad) * dt;
    } else {
      const f = FORM[Math.min(w.slot, 3)], angT = lead.ang - H.dir * f[1] * (w === lead ? 0 : 1); let e = Math.atan2(Math.sin(angT - w.ang), Math.cos(angT - w.ang)) * H.dir; if (w === lead) e = 0;
      w.rad += (f[0] - w.rad) * Math.min(1, dt * 0.25);
      w.ang += H.dir * 2.5 * (1 + clamp(e * 2.2, -0.45, 0.6)) / Math.max(6, w.rad) * dt;
      const s = H.time - w.dive0; w.yT = s > 0 ? -1e4 : H.Y0;
    }
    const tx = H.pod.x + Math.sin(w.ang) * w.rad, tz = H.pod.z + Math.cos(w.ang) * w.rad;
    w.x = tx; w.z = tz;
    if (H.mode === 'dive' && H.time > w.dive0) { const s = H.time - w.dive0; w.vy = -1.9 * (1 - Math.exp(-s / 5)); }   // abtauchen: sacht beginnen, dann gleichmäßig tiefer
    else w.vy += (clamp((w.yT - w.y) * 0.4, w.ev === 2 ? -5 : -2.4, w.ev === 1 ? 3.6 : 2.4) - w.vy) * Math.min(1, dt * 0.9);   // steigen und sinken mit Schwung
    w.y = Math.min(-6, w.y + w.vy * dt);
  }
  /** ein Kalb: hält sich neben und etwas über der Mutter, mit eigenem Übermut */
  function moveCalf(w, dt) {
    const m = H.list[w.mom], fx = Math.sin(m.yaw), fz = Math.cos(m.yaw), rx = fz, rz = -fx, wig = Math.sin(H.time * 0.37 + w.wob) * 2.2;
    const tx = m.x + rx * w.side * (4.5 + wig * 0.4) - fx * 2, ty = m.y + 2.6 + Math.sin(H.time * 0.29 + w.wob * 2) * 1.6, tz = m.z + rz * w.side * (4.5 + wig * 0.4) - fz * 2;
    const k = Math.min(1, dt * 1.4); w.x += (tx - w.x) * k; w.z += (tz - w.z) * k; w.y = Math.min(-6, w.y + (ty - w.y) * k);
  }
  H.update = (dt, time, px) => {
    PX.value = px; AD.k = CA.k = 0;
    if (H.pod) {
      H.time += dt; let cx = 0, cz = 0, cn = 0, si = 0;
      for (const w of H.list) {
        if (w.gone) continue;
        // Flossenschlag: ruhig im Takt, ab und zu ein kräftiger Schlag, der den ganzen Körper mitnimmt
        w.strokeT -= dt; if (w.strokeT < 0 && w.stroke <= 0) { w.stroke = 2.8; w.strokeT = (w.calf ? 5 : 8) + Math.random() * 10; }
        let k = 0; if (w.stroke > 0) { w.stroke -= dt; k = Math.sin(PI * clamp(1 - w.stroke / 2.8, 0, 1)); }
        if (!(H.still && w.fix) && dt > 0) {
          w.px = w.x; w.py = w.y; w.pz = w.z;
          if (w.calf) moveCalf(w, dt); else moveAdult(w, dt, k);
          const vx = (w.x - w.px) / dt, vy = (w.y - w.py) / dt, vz = (w.z - w.pz) / dt, vh = Math.hypot(vx, vz);
          if (vh > 0.2) { const yaw = Math.atan2(vx, vz); let dy = Math.atan2(Math.sin(yaw - w.yaw), Math.cos(yaw - w.yaw)); if (!w.init) dy = 0, w.yaw = yaw;
            const yr = dy / dt; w.yaw += dy * Math.min(1, dt * 3); w.turn += (clamp(yr / Math.max(vh, 0.5), -0.06, 0.06) * w.L - w.turn) * Math.min(1, dt * 2); }
          const pOld = w.pitch; w.pitch += (Math.atan2(vy, Math.max(vh, 0.3)) - w.pitch) * Math.min(1, dt * 2); w.init = true;
          const pr = (w.pitch - pOld) / dt, sp = Math.max(Math.hypot(vh, vy), 0.8); w.arch = (w.arch || 0) + (clamp(pr / sp * w.L, -0.5, 0.5) - (w.arch || 0)) * Math.min(1, dt * 2);
        } else w.init = true;
        if (w.y < -340) { w.gone = true; continue; }
        // ab und zu dreht sich ein Großer langsam auf die Seite und zeigt die weiße Flosse
        if (!w.calf && H.mode === 'play' && !H.still) { w.rollT -= dt; if (w.rollT < 0) { const s = -w.rollT; w.roll = 1.75 * Math.pow(Math.sin(Math.min(PI, s / 10 * PI)), 2) * (w.seed < 0.5 ? 1 : -1); if (s > 10) { w.rollT = 25 + Math.random() * 35; w.roll = 0; } } }
        else if (w.roll) w.roll *= 1 - Math.min(1, dt);
        w.rollLag = (w.rollLag || 0) + (w.roll - (w.rollLag || 0)) * Math.min(1, dt * 1.3);   // das Hinterteil dreht sich hinterher
        const ampT = (w.calf ? 0.055 : 0.045) * (1 + 1.15 * k); w.amp += (ampT - w.amp) * Math.min(1, dt * 3);
        w.ph += dt * (w.calf ? 1.6 : 1.15) * (1 + 0.9 * k);
        w.flap += (k * 0.07 - w.flap) * Math.min(1, dt * 2);
        const bank = clamp(-w.turn * 0.8, -0.25, 0.25), D = w.calf ? CA : AD, o = D.k * 4;
        D.iP[o] = w.x; D.iP[o + 1] = w.y; D.iP[o + 2] = w.z; D.iP[o + 3] = w.L; D.iR[o] = w.yaw; D.iR[o + 1] = w.pitch; D.iR[o + 2] = w.roll + bank; D.iA[o] = w.ph; D.iA[o + 1] = w.turn; D.iA[o + 2] = w.seed; D.iA[o + 3] = w.amp;
        D.iB[o] = w.flap; D.iB[o + 1] = clamp(w.turn * 0.4, -0.06, 0.06); D.iB[o + 2] = (w.rollLag || 0) - w.roll; D.iB[o + 3] = w.arch || 0; D.k++;
        // Kugelkette entlang der Achse, damit das Boot nicht hindurchfährt
        const cp = Math.cos(w.pitch), ax = Math.sin(w.yaw) * cp, ay = Math.sin(w.pitch), az = Math.cos(w.yaw) * cp;
        for (let s = 0; s < 4; s++) { const f = 0.3 - s * 0.2, sph = H.spheres[si] || (H.spheres[si] = { x: 0, y: 0, z: 0, r: 0 }); sph.x = w.x + ax * f * w.L; sph.y = w.y + ay * f * w.L; sph.z = w.z + az * f * w.L; sph.r = w.L * (s < 2 ? 0.11 : 0.075); si++; }
        // Ausatmen: Blasen aus dem Blasloch, nur dicht unter der Oberfläche
        w.blow -= dt; if (w.blow < 0 && w.y > -30) { if (w.blow < -1.6) w.blow = 14 + Math.random() * 26; else if (Math.random() < dt * 34) {
          const hf = 0.3 * w.L, q = bi * 3; bp[q] = w.x + ax * hf + (Math.random() - 0.5) * 0.4; bp[q + 1] = w.y + ay * hf + w.L * 0.08; bp[q + 2] = w.z + az * hf + (Math.random() - 0.5) * 0.4; bv[bi] = 0.9 + Math.random() * 0.9; bl[bi] = 1; bi = (bi + 1) % NB; } }
        cx += w.x; cz += w.z; cn++;
      }
      H.spheres.length = si;
      if (cn) { H.src.x = cx / cn; H.src.z = cz / cn; }
      if (H.mode === 'dive' && !cn) { H.pod = null; H.mode = 'off'; H.list.length = 0; }   // alle sind im Dunkeln verschwunden
    }
    for (const D of [AD, CA]) { D.g.instanceCount = D.k; if (D.k) for (const k of ['iP', 'iR', 'iA', 'iB']) D.g.attributes[k].needsUpdate = true; }
    let any = false; for (let i = 0; i < NB; i++) if (bl[i] > 0) { any = true; const q = i * 3; bl[i] = Math.max(0, bl[i] - dt * 0.25); bp[q + 1] += bv[i] * dt; bp[q] += Math.sin(time * 2 + i) * 0.15 * dt; if (bp[q + 1] > -4.5 || bl[i] === 0) { bl[i] = 0; bp[q + 1] = 999; } }
    if (any || AD.k || CA.k) { const a = bg.attributes; if (a.position.__inst) a.position.__inst.needsUpdate = true; if (a.aL.__inst) a.aL.__inst.needsUpdate = true; }
  };
  /** Mitte der sichtbaren Wale (für das Fotoziel und die Mission) */
  H.center = () => { let x = 0, y = 0, z = 0, n = 0; for (const w of H.list) if (!w.gone && w.init) { x += w.x; y += w.y; z += w.z; n++; } return n ? { x: x / n, y: y / n, z: z / n } : null; };
  return H;
}
