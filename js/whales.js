// whales.js – schlafende Pottwale: senkrecht im Wasser, die Köpfe knapp unter der Oberfläche, wie Säulen.
// Ein Körper aus Querschnitten (kantiger Kopf, schmaler Unterkiefer, Buckel mit „Knöcheln“, kleine Flipper, breite Fluke),
// Falten, Narben und Hautzeichnung macht der Shader. Ab und zu steigen Blasen aus dem Blasloch.
import { T, rng, clamp, smooth } from './util.js';
import { uni, COMMON, quadPoints } from './gfx.js';
import { floorH } from './terrain.js';

const PI = Math.PI;
// Querschnitte: [t (0 = Kopfspitze, 1 = Flukenansatz), halbe Höhe, halbe Breite, Mittelhöhe, Kantigkeit]
const PROF = [
  [0.000, 0.050, 0.040, 0.012, 3.0], [0.006, 0.084, 0.064, 0.008, 3.4], [0.020, 0.101, 0.078, 0.005, 3.6], [0.060, 0.112, 0.086, 0.003, 3.5],
  [0.150, 0.118, 0.092, 0.000, 3.2], [0.240, 0.117, 0.096, -0.004, 2.8], [0.300, 0.109, 0.097, -0.008, 2.4], [0.360, 0.112, 0.100, -0.010, 2.2],
  [0.460, 0.110, 0.096, -0.010, 2.1], [0.580, 0.095, 0.080, -0.008, 2.1], [0.680, 0.077, 0.059, -0.004, 2.15], [0.780, 0.059, 0.039, 0.000, 2.3],
  [0.880, 0.041, 0.022, 0.002, 2.5], [0.950, 0.029, 0.013, 0.002, 2.6], [1.000, 0.021, 0.010, 0.002, 2.6],
];
function prof(t) {
  let i = 0; while (i < PROF.length - 2 && t > PROF[i + 1][0]) i++;
  const a = PROF[i], b = PROF[i + 1], k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), s = k * k * (3 - 2 * k);
  return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s, a[4] + (b[4] - a[4]) * s];
}
const zOf = (t) => 0.5 - t;
/** Buckel und die kleinen Höcker dahinter, auf der Rückenlinie */
function hump(t) { let h = 0.026 * Math.exp(-(((t - 0.6) / 0.032) ** 2)); for (let k = 0; k < 6; k++) h += 0.009 * (1 - k / 7) * Math.exp(-(((t - (0.672 + k * 0.034)) / 0.009) ** 2)); return h; }
function bodyPt(t, a) {
  const [h, w, yc, p] = prof(t), ca = Math.cos(a), sa = Math.sin(a), e = 2 / p;
  let x = Math.sign(ca) * Math.pow(Math.abs(ca), e) * w, y = yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h;
  if (sa < 0 && t < 0.34) x *= 1 - 0.3 * (-sa) * (1 - smooth(0.22, 0.34, t));          // der Kopf läuft nach unten keilförmig auf den Kiefer zu
  if (sa > 0) y += hump(t) * Math.pow(Math.max(0, sa), 8);
  return [x, y, zOf(t)];
}

function buildWhale() {
  const P = [], N = [], K = [], I = []; let n = 0;
  const v = (p, nr, t, part, vv, uu) => { P.push(p[0], p[1], p[2]); N.push(nr[0], nr[1], nr[2]); K.push(t, part, vv, uu); return n++; };
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  // Körper
  const NT = 96, NA = 44, b0 = n, tOf = (j) => { const s = j / NT; return s < 0.08 ? 0.03 * (s / 0.08) ** 1.6 : 0.03 + 0.97 * ((s - 0.08) / 0.92); };
  for (let j = 0; j <= NT; j++) { const t = tOf(j); for (let i = 0; i <= NA; i++) { const a = i / NA * 2 * PI; v(bodyPt(t, a), [0, 0, 0], t, 0, i / NA, 0); } }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = b0 + j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NA; i++) {
    const g = (jj, ii) => { const q = (b0 + Math.max(0, Math.min(NT, jj)) * (NA + 1) + ((ii + NA) % NA)) * 3; return [P[q], P[q + 1], P[q + 2]]; };
    const A = g(j, i + 1), B = g(j, i - 1), C = g(j + 1, i), D = g(j - 1, i), ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2], vx = C[0] - D[0], vy = C[1] - D[1], vz = C[2] - D[2];
    const nn = norm(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), q = (b0 + j * (NA + 1) + i) * 3; N[q] = -nn[0]; N[q + 1] = -nn[1]; N[q + 2] = -nn[2];
  }
  // Deckel vorn (stumpfe Stirn) und hinten
  for (const [j, t, s] of [[0, 0, 1], [NT, 1, -1]]) {
    const [, , yc] = prof(t), c = v([0, yc, zOf(t) + s * 0.004], [0, 0, s], t, 0, 0.25, 0);
    for (let i = 0; i < NA; i++) { const a = b0 + j * (NA + 1) + i; if (s > 0) I.push(c, a + 1, a); else I.push(c, a, a + 1); }
  }
  // Unterkiefer: schmale, helle Leiste unter dem Kopf
  { const NJ = 30, NS = 12, j0 = n;
    for (let j = 0; j <= NJ; j++) {
      const t = 0.035 + 0.27 * j / NJ, [h, , yc] = prof(t), tip = smooth(0, 0.18, j / NJ), jw = (0.011 + 0.013 * smooth(0, 1, j / NJ)) * (0.35 + 0.65 * tip), jh = 0.012 * (0.4 + 0.6 * tip), y0 = yc - h * 0.93 - jh * 0.45;
      for (let i = 0; i <= NS; i++) { const a = i / NS * 2 * PI, ca = Math.cos(a), sa = Math.sin(a); v([ca * jw, y0 + sa * jh, zOf(t)], norm(ca / jw, sa / jh, 0), t, 2, i / NS, j / NJ); }
    }
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NS; i++) { const a = j0 + j * (NS + 1) + i, c = a + NS + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
    const [h, , yc] = prof(0.035), c = v([0, yc - h * 0.93, zOf(0.035) + 0.004], [0, 0, 1], 0.035, 2, 0, 0); for (let i = 0; i < NS; i++) I.push(c, j0 + i + 1, j0 + i);
  }
  // Augen: klein, weit hinten am Kopf, knapp über dem Mundwinkel
  for (const sx of [-1, 1]) {
    const t = 0.285, a = sx > 0 ? -0.42 : PI + 0.42, c = bodyPt(t, a), nr = norm(sx, -0.25, 0.1), r = 0.0075, e0 = n, S = 12;
    v([c[0] + nr[0] * 0.004, c[1] + nr[1] * 0.004, c[2] + nr[2] * 0.004], nr, t, 3, 0, 0);
    for (let i = 0; i <= S; i++) { const q = i / S * 2 * PI; v([c[0] + nr[0] * 0.0005, c[1] + Math.cos(q) * r * 0.7, c[2] + Math.sin(q) * r], nr, t, 3, 1, 0); }
    for (let i = 0; i < S; i++) if (sx > 0) I.push(e0, e0 + 1 + i, e0 + 2 + i); else I.push(e0, e0 + 2 + i, e0 + 1 + i);
  }
  // Fläche mit Dicke: zwei Häute (oben/unten), Rand geschlossen
  const sheet = (pt, NU, NV, thick, part) => {
    for (const side of [1, -1]) {
      const s0 = n;
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const q = pt(i / NU, j / NV), th = thick(i / NU, j / NV) * side; v([q.p[0] + q.n[0] * th, q.p[1] + q.n[1] * th, q.p[2] + q.n[2] * th], [q.n[0] * side, q.n[1] * side, q.n[2] * side], q.t, part, j / NV, i / NU); }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = s0 + i * (NV + 1) + j, c = a + NV + 1; if (side > 0) I.push(a, c, a + 1, a + 1, c, c + 1); else I.push(a, a + 1, c, a + 1, c + 1, c); }
    }
  };
  // Flipper: kleine, rundliche Paddel tief an der Seite
  for (const sx of [-1, 1]) {
    const t = 0.335, r = bodyPt(t, sx > 0 ? -0.8 : PI + 0.8), d = norm(sx * 0.62, -0.42, -0.66), wa = norm(0, 0.35, 1), nr = norm(d[1] * wa[2] - d[2] * wa[1], d[2] * wa[0] - d[0] * wa[2], d[0] * wa[1] - d[1] * wa[0]);
    sheet((u, vv) => { const L = 0.088 * vv, wd = 0.03 * Math.sin(PI * (0.12 + 0.88 * vv)) * (1 - 0.25 * vv) + 0.004, s = u * 2 - 1, droop = 0.012 * vv * vv;
      return { p: [r[0] + d[0] * L + wa[0] * s * wd, r[1] + d[1] * L + wa[1] * s * wd - droop, r[2] + d[2] * L + wa[2] * s * wd], n: nr, t }; },
    8, 10, (u, vv) => 0.006 * (1 - 0.7 * vv) * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2)), 4);
  }
  // Fluke: breit, dreieckig, gerade Hinterkante mit tiefer Kerbe in der Mitte
  { const [, , yc] = prof(1), z0 = zOf(1) + 0.012;
    sheet((u, vv) => { const s = u * 2 - 1, as = Math.abs(s), lead = z0 - 0.075 * Math.pow(as, 1.35), chord = 0.075 * (1 - Math.pow(as, 1.7)) + 0.006, trail = lead - chord + 0.032 * (1 - smooth(0, 0.13, as)) * (1 - as);
      const z = lead + (trail - lead) * vv, y = yc + 0.012 * as * as; return { p: [s * 0.14, y, z], n: [0, 1, 0], t: 1 }; },
    28, 8, (u, vv) => 0.007 * (1 - Math.abs(u * 2 - 1) * 0.8) * (1 - vv * 0.75), 5);
  }
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I);
  return g;
}

const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  void main(){ vec3 p = position, nr = normal; float t = aK.x, part = aK.y, ph = iA.x;
    // ganz langsames Wiegen: der Schwanz pendelt ein wenig, die Fluke hebt und senkt sich im Schlaf
    float sw = sin(uTime * 0.31 + ph) * 0.014 + sin(uTime * 0.17 + ph * 2.0) * 0.008;
    p.x += sw * pow(clamp(t, 0.0, 1.0), 2.6);
    if (part > 4.5) { float fl = sin(uTime * 0.42 + ph) * 0.02 * smoothstep(0.0, 1.0, abs(p.x) / 0.14); p.y += fl; }
    if (part > 3.5 && part < 4.5) { p.y += sin(uTime * 0.5 + ph + p.x * 3.0) * 0.004 * aK.z; }
    vL = p; p *= iP.w; nr = normalize(nr);
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.zw;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FS = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nz(vec2 p){ return texture2D(uNoise, p).r; }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x; vec3 base; float bump = 0.0, bk = 0.0;
    float headK = 1.0 - smoothstep(0.26, 0.36, t);
    if (part < 0.5) {   // Haut: schiefergrau mit einem Hauch Braun, der Kopf heller und voller Narben, der Leib dahinter in tiefen Falten
      float ang = vv * 6.2832, belly = smoothstep(0.2, -0.9, sin(ang));
      base = mix(vec3(0.26, 0.27, 0.29), vec3(0.37, 0.365, 0.36), headK * 0.85) * (0.88 + 0.24 * seed) + vec3(0.03) * belly * (1.0 - headK);
      vec2 sp = vec2(t * 7.0 + seed * 3.1, vv * 2.3);
      float n1 = nz(sp), n2 = nz(sp * 3.1 + 0.37), n3 = nz(vec2(t * 26.0, vv * 9.0) + seed), mott = nz(vec2(t * 4.0, vv * 3.0) + seed * 0.7);
      // Falten: quer laufende, unruhige Rillen wie eine gedörrte Pflaume; am Kopf fast glatt
      float wr = sin(t * 230.0 + n1 * 9.0 + sin(ang * 3.0 + t * 20.0) * 1.2) * 0.5 + 0.5, wr2 = sin(t * 520.0 + n2 * 14.0 + ang * 2.0) * 0.5 + 0.5;
      bump = (wr * 0.7 + wr2 * 0.3) * smoothstep(0.28, 0.4, t) * (1.0 - smoothstep(0.92, 1.0, t)) + n3 * 0.2 * (1.0 - 0.85 * headK); base *= 0.9 + 0.18 * mott;
      bk = mix(0.9, 2.6, smoothstep(0.28, 0.4, t));
      base *= 0.86 + 0.2 * wr * smoothstep(0.28, 0.4, t);
      // Narben von Kämpfen mit Kalmaren: feine, helle Kratzer und runde Saugnapfspuren, fast nur am Kopf
      float sc = nz(vec2(t * 2.2 + seed, vv * 1.6)), line = 1.0 - smoothstep(0.0, 0.035, abs(fract(t * 18.0 + vv * 11.0 + sc * 4.0 + seed) - 0.5) - 0.465);
      line *= step(0.55, nz(vec2(t * 5.0, vv * 3.0) + seed * 1.7)) * (0.35 + 0.65 * headK);
      vec2 cs = vec2(t * 95.0, vv * 60.0), cf = fract(cs) - 0.5; float ring = (1.0 - smoothstep(0.03, 0.08, abs(length(cf) - 0.28))) * step(0.9, h21(floor(cs) + seed)) * headK;
      base = mix(base, vec3(0.55, 0.56, 0.56), clamp(line * 0.55 + ring * 0.4, 0.0, 1.0));
      // Blasloch: ein schräger S-Schlitz vorn links oben
      float bh = step(t, 0.03) * (1.0 - smoothstep(0.0, 0.02, abs(vv - 0.31 - sin(t * 300.0) * 0.006))) * smoothstep(0.004, 0.012, t);
      base *= 1.0 - 0.75 * bh;
      // Mundspalte: weiße Lippe entlang des Kiefers
      float lip = (1.0 - smoothstep(0.0, 0.012, abs(sin(ang) + 0.97))) * step(0.035, t) * step(t, 0.3);
      base = mix(base, vec3(0.55, 0.55, 0.54), lip * 0.35);
    } else if (part < 2.5) {   // Unterkiefer: hell, fast weiß an den Lippen
      base = mix(vec3(0.3, 0.3, 0.31), vec3(0.55, 0.55, 0.53), smoothstep(0.1, -0.6, sin(vv * 6.2832)));
      bump = nz(vec2(t * 30.0, vv * 3.0)) * 0.4; bk = 0.6;
    } else if (part < 3.5) {   // Auge
      base = vv < 0.5 ? vec3(0.02, 0.02, 0.025) : vec3(0.1, 0.1, 0.11);
    } else {   // Flipper und Fluke: dunkler, mit hellen Kanten und Kerben
      float edge = part > 4.5 ? smoothstep(0.82, 1.0, vv) : smoothstep(0.85, 1.0, vv);
      base = vec3(0.22, 0.225, 0.24) * (0.9 + 0.2 * nz(vec2(u * 4.0, vv * 2.0) + seed)) + vec3(0.12) * edge;
      bump = nz(vec2(u * 12.0, vv * 5.0)) * 0.5; bk = 0.8;
    }
    // Falten als Relief: verbiegt die Normale nach dem Gefälle der Faltenhöhe
    vec3 dpx = dFdx(vW), dpy = dFdy(vW); float dhx = dFdx(bump), dhy = dFdy(bump);
    vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
    if (abs(det) > 1e-9) N = normalize(abs(det) * N - sign(det) * (dhx * r1 + dhy * r2) * bk * 0.012);
    // weiches Licht von oben und vom Wasser ringsum, damit die senkrechten Körper nicht nur Schattenriss sind
    float lk = exp(vW.y * 0.0125), wrap = 0.5 + 0.5 * dot(N, uSunDir), sky = 0.5 + 0.5 * N.y;
    vec3 c = shade(base, N, vW) * 1.2 + base * (vec3(0.16, 0.42, 0.62) * wrap * wrap * lk * 0.95 + vec3(0.04, 0.12, 0.2) * sky) + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.4;
    c += vec3(0.5, 0.75, 0.85) * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 18.0) * 0.08 * lk * (part < 0.5 ? 1.0 - smoothstep(0.3, 0.5, t) * 0.6 : 0.4);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;

/** sucht einen Ort für die schlafende Gruppe: über dem Walskelett, über einem Becken oder über dem tiefen Loch am Ende der Schlucht, mindestens minD vom Boot */
export function choosePod(sx, sz, minD, fixed, rand = Math.random) {
  const deepOK = (x, z) => { for (let k = 0; k < 7; k++) { const a = k / 7 * 2 * PI, r = k ? 20 : 0; if (floorH(x + Math.cos(a) * r, z + Math.sin(a) * r) > -48) return false; } return Math.hypot(x, z) < 1300; };
  const far = (x, z) => Math.hypot(x - sx, z - sz) >= minD, opts = [];
  for (const f of fixed) if (deepOK(f.x, f.z) && far(f.x, f.z)) opts.push({ x: f.x, z: f.z, kind: f.kind });
  // freie Becken: Zufallspunkte, die tief genug liegen
  for (let i = 0; i < 1500 && opts.filter((o) => o.kind === 'basin').length < 3; i++) { const a = rand() * 2 * PI, r = Math.sqrt(rand()) * 1250, x = Math.cos(a) * r, z = Math.sin(a) * r; if (far(x, z) && Math.hypot(x - sx, z - sz) < minD + 500 && deepOK(x, z) && floorH(x, z) < -70) opts.push({ x, z, kind: 'basin' }); }
  if (!opts.length) { let best = null, bd = -1; for (const f of fixed) { const d = Math.hypot(f.x - sx, f.z - sz); if (d > bd) { bd = d; best = f; } } return { x: best.x, z: best.z, kind: best.kind, seed: Math.floor(rand() * 1e6) }; }
  // die drei Arten gleich wahrscheinlich, nicht nach Anzahl
  const kinds = [...new Set(opts.map((o) => o.kind))], k = kinds[Math.floor(rand() * kinds.length)], pick = opts.filter((o) => o.kind === k);
  const o = pick[Math.floor(rand() * pick.length)]; return { x: o.x, z: o.z, kind: o.kind, seed: Math.floor(rand() * 1e6) };
}

export function createWhales(scene) {
  const g = buildWhale(), M = 8, iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
  g.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); g.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); g.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); g.instanceCount = 0;
  const mat = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS, fragmentShader: FS }); mat.extensions.derivatives = true;
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
  // Blasen aus den Blaslöchern
  const NB = 160, bp = new Float32Array(NB * 3), bl = new Float32Array(NB), bv = new Float32Array(NB); let bi = 0; for (let i = 0; i < NB; i++) bp[i * 3 + 1] = 999;
  const PX = { value: 600 }, bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(bp, 3)); bg.setAttribute('aL', new T.BufferAttribute(bl, 1));
  const bm = quadPoints(bg, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false,
    vertexShader: `attribute float aL; uniform float uPx, uFogK; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); vA = smoothstep(0.0, 0.3, aL) * 0.6 * exp(-(-mv.z) * uFogK * 0.8); gl_PointSize = max(1.5, (0.07 + 0.09 * (1.0 - aL)) * uPx / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = (1.0 - smoothstep(0.42, 0.5, r)) * (0.3 + 0.7 * smoothstep(0.2, 0.44, r)); gl_FragColor = vec4(vec3(0.75, 0.93, 1.0), a * vA); }` }));
  bm.frustumCulled = false; bm.renderOrder = 7; scene.add(bm);
  const W = { list: [], spheres: [], pod: null };
  /** setzt die Gruppe an einen Ort (oder entfernt sie mit null). seed macht Anzahl, Größen und Haltung jedes Mal gleich */
  W.setPod = (pod) => {
    W.pod = pod; W.list.length = 0; W.spheres.length = 0; if (!pod) { g.instanceCount = 0; return; }
    const R = rng(pod.seed || 1), rr = (a, b) => a + R() * (b - a), n = 6 + (R() < 0.5 ? 1 : 0), ga = R() * 2 * PI;
    for (let i = 0; i < n; i++) {
      // locker in einer Reihe, wie Säulen in einer Halle; ein paar etwas tiefer und weiter hinten
      const along = (i - (n - 1) / 2) * rr(7.5, 10), off = rr(-6, 6) + (i % 2 ? 5 : -2), x = pod.x + Math.cos(ga) * along - Math.sin(ga) * off, z = pod.z + Math.sin(ga) * along + Math.cos(ga) * off;
      const L = rr(11, 15) * (i === 2 ? 1.12 : 1), top = -6.2 - rr(0, 3.5) - (i % 3 === 1 ? rr(1, 3) : 0);
      W.list.push({ x, z, L, cy: top - L / 2, yaw: rr(0, 2 * PI), tilt: rr(-0.1, 0.1), roll: rr(-0.12, 0.12), ph: rr(0, 6.3), seed: R(), blow: rr(4, 30), dy: rr(0, 6.3) });
    }
  };
  const blowLocal = [-0.03, 0.08, 0.49];
  W.update = (dt, time, px) => {
    PX.value = px; let k = 0;
    for (const w of W.list) {
      const bob = Math.sin(time * 0.21 + w.dy) * 0.25, yaw = w.yaw + Math.sin(time * 0.05 + w.ph) * 0.15, pitch = PI / 2 + w.tilt + Math.sin(time * 0.13 + w.ph) * 0.025, o = k * 4;
      iP[o] = w.x; iP[o + 1] = w.cy + bob; iP[o + 2] = w.z; iP[o + 3] = w.L; iR[o] = yaw; iR[o + 1] = pitch; iR[o + 2] = w.roll; iA[o] = w.ph; iA[o + 1] = 0; iA[o + 2] = w.seed; iA[o + 3] = 0;
      // Kugelkette entlang der Achse, damit das Boot nicht hindurchfährt
      const cp = Math.cos(pitch), sp = Math.sin(pitch), ax = Math.sin(yaw) * cp, ay = sp, az = Math.cos(yaw) * cp;
      for (let s = 0; s < 6; s++) { const f = 0.42 - s * 0.16, idx = k * 6 + s, sph = W.spheres[idx] || (W.spheres[idx] = { x: 0, y: 0, z: 0, r: 0 }); sph.x = w.x + ax * f * w.L; sph.y = w.cy + bob + ay * f * w.L; sph.z = w.z + az * f * w.L; sph.r = w.L * (s < 3 ? 0.105 : 0.085 - s * 0.01); }
      // ab und zu ein Schwall Blasen aus dem Blasloch
      w.blow -= dt; if (w.blow < 0) { if (w.blow < -1.4) w.blow = 18 + Math.random() * 30; else if (Math.random() < dt * 30) {
        const hx = w.x + (Math.sin(yaw) * cp * blowLocal[2] + Math.cos(yaw) * blowLocal[0]) * w.L, hy = w.cy + bob + (sp * blowLocal[2] + cp * blowLocal[1] * 0) * w.L + 0.4, hz = w.z + (Math.cos(yaw) * cp * blowLocal[2] - Math.sin(yaw) * blowLocal[0]) * w.L;
        const q = bi * 3; bp[q] = hx + (Math.random() - 0.5) * 0.5; bp[q + 1] = hy; bp[q + 2] = hz + (Math.random() - 0.5) * 0.5; bv[bi] = 0.8 + Math.random() * 0.8; bl[bi] = 1; bi = (bi + 1) % NB; } }
      k++;
    }
    g.instanceCount = k; if (k) g.attributes.iP.needsUpdate = g.attributes.iR.needsUpdate = g.attributes.iA.needsUpdate = true;
    let any = false; for (let i = 0; i < NB; i++) if (bl[i] > 0) { any = true; const q = i * 3; bl[i] = Math.max(0, bl[i] - dt * 0.28); bp[q + 1] += bv[i] * dt; bp[q] += Math.sin(time * 2 + i) * 0.15 * dt; if (bp[q + 1] > -4.5 || bl[i] === 0) { bl[i] = 0; bp[q + 1] = 999; } }
    if (any || k) { const a = bg.attributes; if (a.position.__inst) a.position.__inst.needsUpdate = true; if (a.aL.__inst) a.aL.__inst.needsUpdate = true; }
  };
  /** Mitte der Gruppe auf halber Körperhöhe (für das Fotoziel) */
  W.center = () => { if (!W.list.length) return null; let x = 0, y = 0, z = 0; for (const w of W.list) { x += w.x; y += w.cy; z += w.z; } const n = W.list.length; return { x: x / n, y: y / n + 2, z: z / n }; };
  return W;
}
