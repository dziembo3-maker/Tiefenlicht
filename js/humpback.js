// humpback.js – Buckelwale über dem großen Abgrund: eine kleine Gruppe zieht dicht unter der Oberfläche ihre Kreise, ein Kalb immer bei seiner Mutter.
// Ein Körper aus Querschnitten (flacher Kopf mit Knubbeln, Kehlfurchen, kleine Finne mit Buckel, schmaler Schwanzstiel), sehr lange Brustflossen
// mit welligem, hellem Rand und eine breite Fluke mit gezackter Hinterkante. Schwimmen, Biegen in der Kurve und Flossenschlag macht der Vertex-Shader.
// Später tauchen sie ab: in einer langsamen Spirale hinunter ins Dunkle.
import { T, rng, clamp, smooth } from './util.js';
import { uni, COMMON, quadPoints } from './gfx.js';
import { floorH } from './terrain.js';

const PI = Math.PI;
// Querschnitte: [t (0 = Schnauze, 1 = Flukenansatz), halbe Höhe, halbe Breite, Mittelhöhe]
const PROF = [
  [0.000, 0.016, 0.020, -0.006], [0.020, 0.036, 0.044, -0.008], [0.060, 0.054, 0.064, -0.012], [0.120, 0.071, 0.080, -0.016],
  [0.200, 0.087, 0.093, -0.018], [0.280, 0.100, 0.102, -0.017], [0.360, 0.106, 0.104, -0.013], [0.450, 0.104, 0.098, -0.007],
  [0.550, 0.096, 0.085, -0.001], [0.650, 0.083, 0.066, 0.003], [0.750, 0.067, 0.045, 0.005], [0.850, 0.050, 0.028, 0.005],
  [0.930, 0.035, 0.019, 0.004], [1.000, 0.022, 0.015, 0.002],
];
function prof0(t) {
  let i = 0; while (i < PROF.length - 2 && t > PROF[i + 1][0]) i++;
  const a = PROF[i], b = PROF[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), s = k * k * (3 - 2 * k);
  const g = 1 + 0.12 * Math.exp(-(((t - 0.38) / 0.22) ** 2));   // kräftig in der Mitte, wie ein Buckelwal eben ist
  return [(a[1] + (b[1] - a[1]) * s) * g, (a[2] + (b[2] - a[2]) * s) * g, a[3] + (b[3] - a[3]) * s];
}
// vorn rund zulaufen statt flach abgeschnitten
function prof(t) { if (t < 0.05) { const q = prof0(0.05), r = prof0(t), d = Math.pow(Math.max(0, 1 - (1 - t / 0.05) ** 2), 0.5); return [q[0] * d, q[1] * d, r[2]]; } return prof0(t); }
const zOf = (t) => 0.5 - t;
/** der kleine Buckel vor der Rückenfinne (daher der Name) */
const hump = (t) => 0.012 * Math.exp(-(((t - 0.6) / 0.03) ** 2));
function bodyPt(t, a) {
  const [h, w, yc] = prof(t), ca = Math.cos(a), sa = Math.sin(a);
  const pu = 2 + 0.9 * (1 - smooth(0.12, 0.34, t)), e = 2 / (sa > 0 ? pu : 2);   // oben am Kopf flach, unten voll (Kehle)
  const lo = sa < 0 ? 1 + 0.08 * smooth(0.04, 0.16, t) * (1 - smooth(0.36, 0.5, t)) : 1;   // die Kehle mit den Furchen wölbt sich etwas vor
  const x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * w; let y = yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h * lo;
  if (sa > 0) y += hump(t) * Math.pow(sa, 6);
  return [x, y, zOf(t)];
}
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/** Normale auf dem Körper an (t, a): aus kleinen Schritten entlang und rundherum */
function bodyN(t, a) {
  const A = bodyPt(t, a + 0.01), B = bodyPt(t, a - 0.01), C = bodyPt(Math.min(1, t + 0.004), a), D = bodyPt(Math.max(0, t - 0.004), a);
  const u = [A[0] - B[0], A[1] - B[1], A[2] - B[2]], v = [C[0] - D[0], C[1] - D[1], C[2] - D[2]];
  const n = norm(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); return [-n[0], -n[1], -n[2]];
}

function buildWhale() {
  const P = [], N = [], K = [], I = []; let n = 0;
  const v = (p, nr, t, part, vv, uu) => { P.push(p[0], p[1], p[2]); N.push(nr[0], nr[1], nr[2]); K.push(t, part, vv, uu); return n++; };
  // Körper
  const NT = 90, NA = 44, b0 = n, tOf = (j) => { const s = j / NT; return s < 0.08 ? 0.03 * (s / 0.08) ** 1.5 : 0.03 + 0.97 * ((s - 0.08) / 0.92); };
  for (let j = 0; j <= NT; j++) { const t = tOf(j); for (let i = 0; i <= NA; i++) { const a = i / NA * 2 * PI; v(bodyPt(t, a), [0, 0, 0], t, 0, i / NA, 0); } }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = b0 + j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NA; i++) {
    const g = (jj, ii) => { const q = (b0 + Math.max(0, Math.min(NT, jj)) * (NA + 1) + ((ii + NA) % NA)) * 3; return [P[q], P[q + 1], P[q + 2]]; };
    const A = g(j, i + 1), B = g(j, i - 1), C = g(j + 1, i), D = g(j - 1, i), ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2], vx = C[0] - D[0], vy = C[1] - D[1], vz = C[2] - D[2];
    const nn = norm(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), q = (b0 + j * (NA + 1) + i) * 3; N[q] = -nn[0]; N[q + 1] = -nn[1]; N[q + 2] = -nn[2];
  }
  for (let i = 0; i <= NA; i++) { const q = (b0 + i) * 3; N[q] = 0; N[q + 1] = 0; N[q + 2] = 1; }   // Schnauzenspitze: alle Punkte fallen zusammen, die Normale zeigt nach vorn
  { const [, , yc] = prof(1), c = v([0, yc, zOf(1) - 0.003], [0, 0, -1], 1, 0, 0.25, 0); for (let i = 0; i < NA; i++) { const a = b0 + NT * (NA + 1) + i; I.push(c, a, a + 1); } }
  // Knubbel (Tuberkel) auf dem flachen Oberkopf und an der Unterlippe: kleine, helle Kuppen
  const knob = (t, a, r) => { const c = bodyPt(t, a), nr = bodyN(t, a), up = Math.abs(nr[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(nr[1] * up[2] - nr[2] * up[1], nr[2] * up[0] - nr[0] * up[2], nr[0] * up[1] - nr[1] * up[0]), e2 = [nr[1] * e1[2] - nr[2] * e1[1], nr[2] * e1[0] - nr[0] * e1[2], nr[0] * e1[1] - nr[1] * e1[0]];
    const k0 = n, S = 7, R = 3;
    for (let ri = 0; ri <= R; ri++) { const ph = ri / R * PI / 2, cr = Math.cos(ph), sr = Math.sin(ph);
      for (let si = 0; si < S; si++) { const q = si / S * 2 * PI, dx = e1[0] * Math.cos(q) + e2[0] * Math.sin(q), dy = e1[1] * Math.cos(q) + e2[1] * Math.sin(q), dz = e1[2] * Math.cos(q) + e2[2] * Math.sin(q);
        v([c[0] + (dx * cr + nr[0] * sr * 0.75) * r - nr[0] * r * 0.25, c[1] + (dy * cr + nr[1] * sr * 0.75) * r - nr[1] * r * 0.25, c[2] + (dz * cr + nr[2] * sr * 0.75) * r - nr[2] * r * 0.25], norm(dx * cr + nr[0] * sr, dy * cr + nr[1] * sr, dz * cr + nr[2] * sr), t, 6, ri / R, 0); } }
    for (let ri = 0; ri < R; ri++) for (let si = 0; si < S; si++) { const a0 = k0 + ri * S + si, a1 = k0 + ri * S + (si + 1) % S; I.push(a0, a1, a0 + S, a1, a1 + S, a0 + S); } };
  { const R = rng(17); for (let k = 0; k < 7; k++) { const t = 0.022 + k * 0.021; knob(t, PI / 2, 0.0045); for (const sx of [-1, 1]) { if (k > 0) knob(t + 0.006, PI / 2 + sx * (0.42 + R() * 0.12), 0.0038); if (k > 1 && k < 6) knob(t - 0.004, PI / 2 + sx * (0.85 + R() * 0.15), 0.0032); } }
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { const t = 0.012 + k * 0.022, a = -0.3 - t * 1.8; knob(t, sx > 0 ? a - 0.15 : PI - a + 0.15, 0.0042); } }
  // Augen: klein, knapp über dem Mundwinkel
  for (const sx of [-1, 1]) {
    const t = 0.222, a = sx > 0 ? -0.2 : PI + 0.2, c = bodyPt(t, a), nr = bodyN(t, a), r = 0.0062, e0 = n, S = 12;
    v([c[0] + nr[0] * 0.0025, c[1] + nr[1] * 0.0025, c[2] + nr[2] * 0.0025], nr, t, 3, 0, 0);
    for (let i = 0; i <= S; i++) { const q = i / S * 2 * PI; v([c[0] + nr[0] * 0.0004, c[1] + Math.cos(q) * r * 0.62, c[2] + Math.sin(q) * r], nr, t, 3, 1, 0); }
    for (let i = 0; i < S; i++) if (sx > 0) I.push(e0, e0 + 1 + i, e0 + 2 + i); else I.push(e0, e0 + 2 + i, e0 + 1 + i);
  }
  // Fläche mit Dicke: zwei Häute (oben/unten); pt(u quer, w entlang) gibt Punkt, Normale und t
  const sheet = (pt, NU, NV, thick, part) => {
    for (const side of [1, -1]) {
      const s0 = n;
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const q = pt(i / NU, j / NV), th = thick(i / NU, j / NV) * side; v([q.p[0] + q.n[0] * th, q.p[1] + q.n[1] * th, q.p[2] + q.n[2] * th], [q.n[0] * side, q.n[1] * side, q.n[2] * side], q.t, part, j / NV, i / NU); }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = s0 + i * (NV + 1) + j, c = a + NV + 1; if (side > 0) I.push(a, c, a + 1, a + 1, c, c + 1); else I.push(a, a + 1, c, a + 1, c + 1, c); }
    }
  };
  // Brustflossen: sehr lang (fast ein Drittel des Körpers), schmal, leicht nach hinten gebogen, die Vorderkante mit Höckern
  for (const sx of [-1, 1]) {
    const t = 0.29, r = bodyPt(t, sx > 0 ? -0.62 : PI + 0.62), d = norm(sx * 0.7, -0.45, -0.42), wa = norm(-sx * 0.15, 0.45, 1), nr = norm(d[1] * wa[2] - d[2] * wa[1], d[2] * wa[0] - d[0] * wa[2], d[0] * wa[1] - d[1] * wa[0]);
    const nn = nr[1] < 0 ? [-nr[0], -nr[1], -nr[2]] : nr;
    sheet((u, w) => { const L = 0.31 * w, s = u * 2 - 1, chord = 0.056 * (1 - 0.62 * w) * Math.sin(PI * (0.16 + 0.84 * Math.min(1, w * 1.08 + 0.02))) + 0.006;
      const sc = s > 0 ? 1 + 0.16 * Math.pow(Math.abs(Math.sin(w * PI * 7.5)), 0.6) * smooth(0.1, 0.3, w) : 1;   // Höcker an der Vorderkante
      const back = 0.05 * w * w, dr = 0.018 * w * w;
      return { p: [r[0] + d[0] * L + wa[0] * s * chord * sc, r[1] + d[1] * L + wa[1] * s * chord * sc - dr, r[2] + d[2] * L + wa[2] * s * chord * sc - back], n: nn, t }; },
    10, 22, (u, w) => 0.0065 * (1 - 0.75 * w) * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)), 4);
  }
  // Rückenfinne: klein und gebogen, hinter dem Buckel
  { const t0 = 0.61, L = 0.07;
    sheet((u, w) => { const t = t0 + u * L, top = bodyPt(t, PI / 2)[1] - 0.004, prof = Math.sin(PI * Math.pow(u, 0.75)) * (0.25 + 0.75 * u) * smooth(0, 0.15, 1 - u + 0.05), h = 0.046 * prof;
      return { p: [0, top + h * w, zOf(t) - 0.03 * w * w * prof], n: [1, 0, 0], t }; },
    10, 6, (u, w) => 0.006 * (1 - w * 0.8) * Math.sin(PI * clamp(u, 0.02, 0.98)), 7);
  }
  // Fluke: breit, gespitzte Enden, Hinterkante gezackt, in der Mitte eine Kerbe
  { const [, , yc] = prof(1), z0 = zOf(1) + 0.01;
    sheet((u, w) => { const s = u * 2 - 1, as = Math.abs(s), lead = z0 - 0.062 * Math.pow(as, 1.15), chord = 0.07 * (1 - Math.pow(as, 1.9)) + 0.004;
      let trail = lead - chord + 0.022 * (1 - smooth(0, 0.1, as)) * (1 - as); trail += 0.0035 * Math.sin(as * 70) * smooth(0.12, 0.3, as) * (1 - smooth(0.85, 1, as));
      const z = lead + (trail - lead) * w, y = yc + 0.008 * as * as; return { p: [s * 0.165, y, z], n: [0, 1, 0], t: 1 + (z0 - z) * 2.2 }; },
    34, 8, (u, w) => 0.006 * (1 - Math.abs(u * 2 - 1) * 0.8) * (1 - w * 0.75), 5);
  }
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I);
  return g;
}

const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN; varying vec4 vK; varying vec2 vI;
  float env(float t){ float e = smoothstep(0.32, 1.25, t); return e * e; }
  float wave(float t, float ph, float amp){ return amp * env(t) * sin(ph - t * 2.4); }
  void main(){ vec3 p = position, nr = normalize(normal); float t = aK.x, part = aK.y, ph = iA.x, amp = iA.w;
    // Flossenschlag: eine Welle läuft zum Schwanz, die Fluke hebt und senkt sich; die Normalen kippen mit
    float d = wave(t, ph, amp), sl = (wave(t + 0.02, ph, amp) - d) / 0.02, f = sl, c = 1.0 / sqrt(1.0 + f * f), s = f * c;
    p.y += d; nr = vec3(nr.x, nr.y * c + nr.z * s, -nr.y * s + nr.z * c);
    // in der Kurve biegt sich der ganze Körper mit
    p.x += iA.y * 0.5 * (t - 0.45) * (t - 0.45);
    // Brustflossen: langsames Rudern
    if (part > 3.5 && part < 4.5) { float w = aK.z; p.y += (sin(uTime * 0.55 + iA.z * 9.0 + sign(p.x) * 0.6) * 0.022 + sin(ph * 0.5) * 0.01) * w * w; }
    p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;

const FS = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN; varying vec4 vK; varying vec2 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nz(vec2 p){ return texture2D(uNoise, p).r; }
  // weiches Licht ohne die gemalten Stufen; das Lichtnetz von der Oberfläche nur leise, sonst wirkt die Haut fleckig
  vec3 lightW(vec3 base, vec3 N, vec3 wp){ float lk = exp(wp.y * 0.0125), top = max(N.y, 0.0), side = max(dot(N, uSunDir), 0.0);
    vec3 amb = vec3(0.020, 0.105, 0.225) * (0.45 + 0.55 * N.y) * (0.35 + 0.65 * lk);
    float cau = caustic(wp.xz * 0.7 + wp.y * 0.3) * smoothstep(0.35, 0.85, N.y) * smoothstep(-60.0, -20.0, wp.y);
    return base * (amb + vec3(0.10, 0.56, 0.95) * (top * 0.85 + side * 0.35) * lk * 1.15 * (0.85 + 0.3 * cau) + lights(wp, N)); }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x; vec3 base; float bump = 0.0, bk = 1.0, glint = 0.0;
    vec3 dark = vec3(0.17, 0.225, 0.27) * (0.9 + 0.2 * seed), pale = vec3(0.45, 0.52, 0.56);
    if (part < 0.5) {   // Haut: dunkles Schiefergrau mit Blaustich, wolkig gefleckt; unten die hellen Kehlfurchen
      float ang = vv * 6.2832, sy = sin(ang), cx = abs(cos(ang));
      float m1 = nz(vec2(t * 3.0 + seed * 2.0, vv * 2.0)), m2 = nz(vec2(t * 9.0, vv * 5.0) + seed), streak = nz(vec2(t * 1.5 + seed, vv * 8.0 + t * 2.0));
      base = dark * (0.9 + 0.14 * m1) * (0.95 + 0.09 * smoothstep(0.4, 0.7, streak));
      // Kehlfurchen: lange Rillen von der Kehle bis etwa zur Körpermitte, hell zwischen dunklen Linien
      float throat = smoothstep(-0.25, -0.6, sy) * smoothstep(0.02, 0.06, t) * (1.0 - smoothstep(0.42, 0.52, t));
      float gr = abs(sin(ang * 46.0 + sin(t * 30.0) * 0.4)), groove = 1.0 - smoothstep(0.0, 0.35, gr);
      base = mix(base, mix(pale * 0.8, pale * 0.45, groove), throat * 0.8); bump += (1.0 - gr) * throat * 0.6;
      // Bauch hinter den Furchen: etwas heller, mit weißlichen Flecken wie bei vielen Buckelwalen
      float belly = smoothstep(-0.45, -0.85, sy) * smoothstep(0.45, 0.55, t) * (1.0 - smoothstep(0.8, 0.95, t));
      base = mix(base, pale * (0.7 + 0.3 * m2), belly * 0.45 * smoothstep(0.45, 0.7, nz(vec2(t * 4.0, vv * 3.0) + seed * 3.0)));
      // Mundlinie: vom Schnauzenende schräg nach unten bis unter das Auge
      float ml = -0.06 - 1.15 * t, lip = (1.0 - smoothstep(0.0, 0.03, abs(sy - ml))) * step(t, 0.215) * smoothstep(0.25, 0.5, cx);
      base *= 1.0 - 0.6 * lip;
      // Blaslöcher: zwei kleine Schlitze oben auf dem Kopf
      float bh = (1.0 - smoothstep(0.0, 0.012, abs(abs(cos(ang)) - 0.06))) * smoothstep(0.155, 0.165, t) * (1.0 - smoothstep(0.185, 0.195, t)) * step(0.0, sy);
      base *= 1.0 - 0.6 * bh;
      // ein paar helle Kratzer und Narben
      float sc = nz(vec2(t * 2.0 + seed, vv * 1.4)), line = smoothstep(0.47, 0.495, abs(fract(t * 14.0 + vv * 9.0 + sc * 3.0 + seed * 5.0) - 0.5));
      line *= step(0.62, nz(vec2(t * 4.0, vv * 2.6) + seed * 1.7)) * (1.0 - throat);
      base = mix(base, pale * 1.1, line * 0.35);
      bump += m2 * 0.12 + nz(vec2(t * 30.0, vv * 16.0)) * 0.1;
      // leises Funkeln auf dem Rücken: winzige helle Punkte, wie in der Vorlage
      vec2 cs = vec2(t * 140.0, vv * 70.0); glint = step(0.978, h21(floor(cs) + seed * 13.0)) * (1.0 - smoothstep(0.1, 0.45, length(fract(cs) - 0.5))) * smoothstep(0.2, 0.7, sy) * smoothstep(0.08, 0.2, t);
    } else if (part < 3.5) {   // Auge
      base = vv < 0.5 ? vec3(0.015, 0.018, 0.022) : vec3(0.08, 0.09, 0.1);
    } else if (part < 4.5) {   // Brustflossen: oben dunkel, Ränder und Unterseite weißlich, die Höcker hell
      float edge = max(smoothstep(0.84, 1.0, u) * 0.75, smoothstep(0.16, 0.0, u)), tip = smoothstep(0.86, 1.0, vv), under = step(dot(vN, vec3(0.0, 1.0, 0.0)), 0.0);
      float mot = nz(vec2(u * 3.0, vv * 5.0) + seed * 4.0);
      base = mix(dark * (0.85 + 0.2 * mot), vec3(0.72, 0.76, 0.77) * (0.85 + 0.15 * mot), clamp(edge * 0.85 + tip * 0.3 + under * smoothstep(0.35, 0.7, mot + vv * 0.4) * 0.6, 0.0, 1.0));
      bump = nz(vec2(u * 10.0, vv * 18.0)) * 0.4;
    } else if (part < 5.5) {   // Fluke: oben dunkel; unten das helle Muster, an dem man jeden Wal erkennt
      float s = abs(u * 2.0 - 1.0), mot = nz(vec2(u * 3.0 + seed * 5.0, vv * 2.0)), under = step(N.y, 0.0);
      base = dark * (0.85 + 0.25 * mot);
      base = mix(base, vec3(0.8, 0.82, 0.8), under * smoothstep(0.42, 0.62, mot + 0.25 * (1.0 - s)) * 0.85);
      base = mix(base, vec3(0.62, 0.66, 0.68), smoothstep(0.75, 1.0, vv) * 0.45);   // die gezackte Hinterkante hell
      bump = mot * 0.4;
    } else if (part < 6.5) {   // Knubbel: hell, wie mit Seepocken besetzt
      base = mix(vec3(0.5, 0.52, 0.5), vec3(0.75, 0.74, 0.68), smoothstep(0.3, 0.9, vv)) * (0.85 + 0.25 * h21(floor(vW.xz * 40.0)));
      bk = 0.4;
    } else {   // Rückenfinne
      base = dark * 0.92; bump = nz(vec2(u * 6.0, vv * 3.0)) * 0.3;
    }
    vec3 dpx = dFdx(vW), dpy = dFdy(vW); float dhx = dFdx(bump), dhy = dFdy(bump);
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
    if (abs(det) > 1e-9) N = normalize(abs(det) * N - sign(det) * (dhx * r1 + dhy * r2) * bk * 0.01);
    float lk = exp(vW.y * 0.0125), wrap = 0.5 + 0.5 * dot(N, uSunDir), sky = 0.5 + 0.5 * N.y, fr = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 c = lightW(base, N, vW) * 1.15 + base * (vec3(0.16, 0.42, 0.62) * wrap * wrap * lk * 0.9 + vec3(0.04, 0.12, 0.2) * sky) + waterCol(reflect(-V, N)) * fr * 0.35;
    c += vec3(0.5, 0.75, 0.85) * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 16.0) * 0.07 * lk;
    // türkiser Saum an den Rändern und das Funkeln: ganz leise, wie Licht, das sich in der Haut fängt
    c += vec3(0.12, 0.62, 0.66) * fr * 0.22 * uDeep + vec3(0.35, 0.9, 0.95) * glint * 0.5 * uDeep;
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
  const g = buildWhale(), M = 6, iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
  g.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); g.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); g.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); g.instanceCount = 0;
  const mat = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS, fragmentShader: FS }); mat.extensions.derivatives = true;
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
  // Ausatmen: ab und zu steigt ein Schwall Blasen aus dem Blasloch zur Oberfläche
  const NB = 140, bp = new Float32Array(NB * 3), bl = new Float32Array(NB), bv = new Float32Array(NB); let bi = 0; for (let i = 0; i < NB; i++) bp[i * 3 + 1] = 999;
  const PX = { value: 600 }, bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3)); bg.setAttribute('aL', new T.BufferAttribute(bl, 1));
  const bm = quadPoints(bg, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false,
    vertexShader: `attribute float aL; uniform float uPx, uFogK; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); vA = smoothstep(0.0, 0.3, aL) * 0.6 * exp(-(-mv.z) * uFogK * 0.8); gl_PointSize = max(1.5, (0.07 + 0.1 * (1.0 - aL)) * uPx / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = (1.0 - smoothstep(0.42, 0.5, r)) * (0.3 + 0.7 * smoothstep(0.2, 0.44, r)); gl_FragColor = vec4(vec3(0.75, 0.93, 1.0), a * vA); }` }));
  bm.frustumCulled = false; bm.renderOrder = 7; scene.add(bm);

  const H = { list: [], spheres: [], pod: null, mode: 'off', time: 0, src: { x: 0, z: 0 }, Y0: -11.5, R: 34, speed: 2.4 };
  /** setzt die Gruppe an einen Ort (oder entfernt sie mit null). seed macht Anzahl, Größen und Formation jedes Mal gleich */
  H.setPod = (pod) => {
    H.pod = pod; H.list.length = 0; H.spheres.length = 0; H.time = 0; H.mode = pod ? 'swim' : 'off'; g.instanceCount = 0; if (!pod) return;
    const R = rng(pod.seed || 1), rr = (a, b) => a + R() * (b - a), adults = 3 + (R() < 0.5 ? 1 : 0), calves = R() < 0.6 ? 1 : 2;
    H.dirS = R() < 0.5 ? 1 : -1; H.ph0 = R() * 2 * PI; H.src.x = pod.x; H.src.z = pod.z;
    const slots = [[0, 0, 0], [-9, -7, -1.5], [8, -12, 1], [-3, -22, -2.5]];
    for (let i = 0; i < adults; i++) { const s = slots[i]; H.list.push({ lat: s[0] + rr(-2, 2), back: -s[1] + rr(-2, 2), up: s[2], L: rr(12.5, 15), calf: false, ph: rr(0, 6.3), seed: R(), amp: 0.032, wob: rr(0, 6.3), roll: 0, rollT: rr(20, 50), blow: rr(6, 25), gone: false, dive0: 0, yaw: 0, pitch: 0, x: 0, y: 0, z: 0, turn: 0 }); }
    for (let c = 0; c < calves; c++) { const m = H.list[c]; H.list.push({ lat: m.lat + (c ? -4.5 : 4.5), back: m.back + 2, up: m.up + 2.6, L: rr(5.2, 6.4), calf: true, ph: rr(0, 6.3), seed: R(), amp: 0.045, wob: rr(0, 6.3), roll: 0, rollT: 1e9, blow: rr(5, 20), gone: false, dive0: 0, mom: c, yaw: 0, pitch: 0, x: 0, y: 0, z: 0, turn: 0 }); }
  };
  /** die Gruppe taucht ab: einer nach dem anderen, ein Kalb mit seiner Mutter */
  H.dive = () => { if (H.mode !== 'swim') return; H.mode = 'dive'; let k = 0; for (const w of H.list) if (!w.calf) w.dive0 = H.time + 1 + k++ * 2.4 + Math.random(); for (const w of H.list) if (w.calf) w.dive0 = H.list[w.mom].dive0 + 0.6; };
  H.diving = () => H.mode === 'dive' && H.list.some((w) => !w.gone);
  // Weg der Gruppe: ein weiter Kreis um den Ort; jeder Wal folgt ihm mit eigenem Abstand und etwas Eigensinn
  const gp = (tau, out) => { const om = H.speed / H.R * H.dirS, a = H.ph0 + om * tau; out.x = H.pod.x + Math.sin(a) * H.R; out.z = H.pod.z + Math.cos(a) * H.R; out.tx = Math.cos(a) * H.dirS; out.tz = -Math.sin(a) * H.dirS; return out; };
  const G = { x: 0, z: 0, tx: 0, tz: 0 };
  function pos(w, tau, o) {
    gp(tau - w.back / H.speed, G); const lx = G.tz, lz = -G.tx, wob = Math.sin(tau * 0.11 + w.wob) * 2.5;
    o.x = G.x + lx * (w.lat + wob) + G.tx * Math.sin(tau * 0.07 + w.wob * 2) * 1.5; o.z = G.z + lz * (w.lat + wob) + G.tz * Math.sin(tau * 0.07 + w.wob * 2) * 1.5;
    o.y = H.Y0 + w.up + Math.sin(tau * 0.19 + w.wob) * 1.1;
    if (w.dive0 > 0) { const s = tau - w.dive0; if (s > 0) { const T0 = 5, vd = 1.9; o.y -= vd * (s - T0 * (1 - Math.exp(-s / T0))); } }   // Abtauchen: sacht beginnen, dann gleichmäßig tiefer
    return o;
  }
  const A = { x: 0, y: 0, z: 0 }, B = { x: 0, y: 0, z: 0 };
  H.update = (dt, time, px) => {
    PX.value = px; let k = 0;
    if (H.pod) {
      H.time += dt; let cx = 0, cz = 0, cn = 0;
      for (const w of H.list) {
        if (w.gone) continue;
        if (H.still && w.x !== 0) { A.x = w.x; A.y = w.y; A.z = w.z; B.x = A.x + Math.sin(w.yaw); B.y = A.y; B.z = A.z + Math.cos(w.yaw); } else { pos(w, H.time, A); pos(w, H.time + 0.3, B); }   // still: nur fürs Entwicklermenü, die Wale halten an
        const vx = (B.x - A.x) / 0.3, vy = (B.y - A.y) / 0.3, vz = (B.z - A.z) / 0.3, vh = Math.hypot(vx, vz), yaw = Math.atan2(vx, vz);
        let dy = yaw - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const yr = dt > 0 && w.x !== 0 ? dy / dt : 0;
        w.turn += ((clamp(yr / Math.max(vh, 0.5), -0.06, 0.06) * w.L) - w.turn) * Math.min(1, dt * 2);
        w.yaw = yaw; w.pitch = Math.atan2(vy, vh); w.x = A.x; w.y = A.y; w.z = A.z;
        if (w.y < -340) { w.gone = true; continue; }
        // ab und zu dreht sich ein Großer langsam auf die Seite und zeigt die weiße Flosse
        if (!w.calf && H.mode === 'swim') { w.rollT -= dt; if (w.rollT < 0) { const s = -w.rollT; w.roll = 1.15 * Math.pow(Math.sin(Math.min(PI, s / 9 * PI)), 2) * (w.seed < 0.5 ? 1 : -1); if (s > 9) { w.rollT = 25 + Math.random() * 35; w.roll = 0; } } }
        const bank = clamp(-w.turn * 0.8, -0.25, 0.25), spd = Math.hypot(vh, vy);
        w.ph += dt * (0.7 + spd * 0.3) * (w.calf ? 1.5 : 1);
        const o = k * 4; iP[o] = w.x; iP[o + 1] = w.y; iP[o + 2] = w.z; iP[o + 3] = w.L; iR[o] = w.yaw; iR[o + 1] = w.pitch; iR[o + 2] = w.roll + bank; iA[o] = w.ph; iA[o + 1] = w.turn; iA[o + 2] = w.seed; iA[o + 3] = w.amp;
        // Kugelkette entlang der Achse, damit das Boot nicht hindurchfährt
        const cp = Math.cos(w.pitch), ax = Math.sin(w.yaw) * cp, ay = Math.sin(w.pitch), az = Math.cos(w.yaw) * cp;
        for (let s = 0; s < 4; s++) { const f = 0.3 - s * 0.2, idx = k * 4 + s, sph = H.spheres[idx] || (H.spheres[idx] = { x: 0, y: 0, z: 0, r: 0 }); sph.x = w.x + ax * f * w.L; sph.y = w.y + ay * f * w.L; sph.z = w.z + az * f * w.L; sph.r = w.L * (s < 2 ? 0.1 : 0.07); }
        // Ausatmen: Blasen aus dem Blasloch, nur dicht unter der Oberfläche
        w.blow -= dt; if (w.blow < 0 && w.y > -30) { if (w.blow < -1.6) w.blow = 14 + Math.random() * 26; else if (Math.random() < dt * 34) {
          const hf = 0.32 * w.L, q = bi * 3; bp[q] = w.x + ax * hf + (Math.random() - 0.5) * 0.4; bp[q + 1] = w.y + ay * hf + w.L * 0.08; bp[q + 2] = w.z + az * hf + (Math.random() - 0.5) * 0.4; bv[bi] = 0.9 + Math.random() * 0.9; bl[bi] = 1; bi = (bi + 1) % NB; } }
        cx += w.x; cz += w.z; cn++; k++;
      }
      H.spheres.length = k * 4;
      if (cn) { H.src.x = cx / cn; H.src.z = cz / cn; }
      if (H.mode === 'dive' && !cn) { H.pod = null; H.mode = 'off'; H.list.length = 0; }   // alle sind im Dunkeln verschwunden
    }
    g.instanceCount = k; if (k) g.attributes.iP.needsUpdate = g.attributes.iR.needsUpdate = g.attributes.iA.needsUpdate = true;
    let any = false; for (let i = 0; i < NB; i++) if (bl[i] > 0) { any = true; const q = i * 3; bl[i] = Math.max(0, bl[i] - dt * 0.25); bp[q + 1] += bv[i] * dt; bp[q] += Math.sin(time * 2 + i) * 0.15 * dt; if (bp[q + 1] > -4.5 || bl[i] === 0) { bl[i] = 0; bp[q + 1] = 999; } }
    if (any || k) { const a = bg.attributes; if (a.position.__inst) a.position.__inst.needsUpdate = true; if (a.aL.__inst) a.aL.__inst.needsUpdate = true; }
  };
  /** Mitte der sichtbaren Wale (für das Fotoziel und die Mission) */
  H.center = () => { let x = 0, y = 0, z = 0, n = 0; for (const w of H.list) if (!w.gone && w.x !== 0) { x += w.x; y += w.y; z += w.z; n++; } return n ? { x: x / n, y: y / n, z: z / n } : null; };
  return H;
}
