// schools.js – große Schwärme: Kometenschwarm (kreisender Wirbel), Saphir-Plättchen (pulsierende Kugel), Neon-Säbelfische (lockerer Trupp).
// Das Handy bewegt nur die Mitte eines Schwarms; wo jeder einzelne Fisch in der Formation schwimmt, wie er sich dreht,
// mit dem Schwanz schlägt und dem Boot ausweicht, rechnet die Grafikkarte. Ein Zeichenaufruf je Art.
import { T, rng, clamp, wrapPi, smooth } from './util.js';
import { uni, COMMON } from './gfx.js';
import { floorH, BOUNDS } from './terrain.js';

const PI = Math.PI;
// Körper: [t (0 = Schnauze, 1 = Schwanzstiel), halbe Höhe, halbe Breite, Mittelhöhe]
const SPECIES = [
  { id: 'komet', body: [[0, 0.008, 0.008, -0.004], [0.05, 0.07, 0.048, -0.002], [0.18, 0.112, 0.066, 0.003], [0.4, 0.106, 0.062, 0.004], [0.65, 0.068, 0.04, 0.002], [0.88, 0.032, 0.019, 0], [1, 0.024, 0.013, 0]],
    eye: [0.075, 0.018, 0.017], fins: [{ k: 'dorsal', a: 0.32, b: 0.62, h: 0.11, sweep: 0.9 }, { k: 'anal', a: 0.52, b: 0.76, h: 0.07, sweep: 0.9 }, { k: 'caudal', h: 0.2, fork: 0.75 }, { k: 'pect', a: 0.2, h: 0.12 }], streamers: 0.75 },
  { id: 'saphir', body: [[0, 0.012, 0.008, -0.012], [0.04, 0.09, 0.038, -0.01], [0.15, 0.2, 0.058, 0], [0.35, 0.235, 0.064, 0.01], [0.56, 0.2, 0.055, 0.01], [0.76, 0.11, 0.034, 0.004], [0.9, 0.05, 0.02, 0], [1, 0.045, 0.014, 0]],
    eye: [0.1, 0.035, 0.03], fins: [{ k: 'dorsal', a: 0.24, b: 0.8, h: 0.11, sweep: 0.45, spiky: 1 }, { k: 'anal', a: 0.52, b: 0.8, h: 0.09, sweep: 0.5 }, { k: 'caudal', h: 0.18, fork: 0.25 }, { k: 'pect', a: 0.22, h: 0.13 }] },
  { id: 'saebel', body: [[0, 0.004, 0.004, 0.002], [0.07, 0.042, 0.028, -0.003], [0.2, 0.088, 0.05, 0], [0.45, 0.084, 0.047, 0.004], [0.7, 0.054, 0.03, 0.002], [0.9, 0.029, 0.016, 0], [1, 0.023, 0.012, 0]],
    eye: [0.085, 0.02, 0.024], fins: [{ k: 'dorsal', a: 0.2, b: 0.44, h: 0.16, sweep: 1.0, tri: 1 }, { k: 'dorsal', a: 0.62, b: 0.72, h: 0.05, sweep: 0.8 }, { k: 'anal', a: 0.6, b: 0.74, h: 0.06, sweep: 0.8 }, { k: 'caudal', h: 0.22, fork: 0.6 }, { k: 'pect', a: 0.21, h: 0.12 }] },
];
// Formen der Schwärme und ihr Verhalten
const TYPES = [
  { sp: 0, n: 46, form: 0, size: [0.9, 1.12], speed: 0.55, beat: 2.8, depth: [7, 22], rad: 7.5 },   // Kometenschwarm: kreisender Wirbel
  { sp: 1, n: 32, form: 1, size: [0.78, 0.95], speed: 0.45, beat: 2.3, depth: [6, 18], rad: 4.8 },     // Saphir-Plättchen: dichte, pulsierende Kugel
  { sp: 2, n: 18, form: 2, size: [1.0, 1.25], speed: 1.5, beat: 1.7, depth: [8, 28], rad: 8 },       // Neon-Säbelfische: lockerer, langgezogener Trupp
];

function profile(sp, t) {
  const b = sp.body; let i = 0; while (i < b.length - 2 && t > b[i + 1][0]) i++;
  const [t0, h0, w0, y0] = b[i], [t1, h1, w1, y1] = b[i + 1], k = clamp((t - t0) / (t1 - t0), 0, 1), s = k * k * (3 - 2 * k);
  return [h0 + (h1 - h0) * s, w0 + (w1 - w0) * s, y0 + (y1 - y0) * s];
}
const zOf = (t) => 0.5 - t;

/** ein Fisch: Körper aus Querschnitten, Flossen als Häute, beim Kometen zwei lange Leuchtfäden am Schwanz.
 *  aK = (t entlang Körper, Teil, v, u). Teile: 0 Körper, 1 Rückenflosse/After/Schwanz, 2 Brustflossen, 4 Auge, 6 Leuchtfaden */
function buildFish(sp) {
  const P = [], N = [], K = [], I = []; let n = 0;
  const v = (p, nr, t, part, vv, uu) => { P.push(p[0], p[1], p[2]); N.push(nr[0], nr[1], nr[2]); K.push(t, part, vv, uu); return n++; };
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const NT = 22, NA = 14, base = n;
  const bodyPt = (t, a) => { const [h, w, yc] = profile(sp, t), ca = Math.cos(a), sa = Math.sin(a), e = 2 / 2.3; return [Math.sign(ca) * Math.pow(Math.abs(ca), e) * w, yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h, zOf(t)]; };
  for (let j = 0; j <= NT; j++) { const t = Math.pow(j / NT, 1.15); for (let i = 0; i <= NA; i++) { const a = i / NA * 2 * PI; v(bodyPt(t, a), [0, 0, 0], t, 0, i / NA, 0); } }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = base + j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NA; i++) {
    const g = (jj, ii) => { const q = (base + Math.max(0, Math.min(NT, jj)) * (NA + 1) + ((ii + NA) % NA)) * 3; return [P[q], P[q + 1], P[q + 2]]; };
    const A = g(j, i + 1), B = g(j, i - 1), C = g(j + 1, i), D = g(j - 1, i), ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2], vx = C[0] - D[0], vy = C[1] - D[1], vz = C[2] - D[2];
    const nn = norm(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx), q = (base + j * (NA + 1) + i) * 3; N[q] = -nn[0]; N[q + 1] = -nn[1]; N[q + 2] = -nn[2];
  }
  const fin = (root, dir, lenF, nu, part, nrm, spiky) => {
    const NV = 4, b0 = n;
    for (let i = 0; i <= nu; i++) { const u = i / nu, r = root(u), d = dir(u); let L = lenF(u); if (spiky) L *= 1 - 0.45 * (1 - Math.pow(Math.abs(Math.sin(u * 11 * PI + PI / 2)), 3));
      for (let j = 0; j <= NV; j++) { const vv = j / NV; v([r[0] + d[0] * L * vv, r[1] + d[1] * L * vv, r[2] + d[2] * L * vv], nrm, r[3], part, vv, u * 10); } }
    for (let i = 0; i < nu; i++) for (let j = 0; j < NV; j++) { const a = b0 + i * (NV + 1) + j, c = a + NV + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
  };
  for (const f of sp.fins) {
    if (f.k === 'dorsal' || f.k === 'anal') {
      const up = f.k === 'dorsal' ? 1 : -1;
      fin((u) => { const t = f.a + (f.b - f.a) * u, [h, , yc] = profile(sp, t); return [0, yc + up * h * 0.92, zOf(t), t]; }, () => norm(0, up, -f.sweep),
        (u) => (f.tri ? f.h * Math.pow(1 - u, 0.9) * (0.35 + 0.65 * Math.min(1, u * 5)) : f.h * (0.35 + 0.65 * Math.sin(PI * (0.15 + 0.85 * u)))) + 0.004, 10, 1, [1, 0, 0], f.spiky);
    } else if (f.k === 'caudal') {
      fin((u) => { const [h, , yc] = profile(sp, 0.995); return [0, yc + (u * 2 - 1) * h * 0.9, zOf(1.0) + 0.004, 1]; }, (u) => norm(0, (u * 2 - 1) * 0.85, -1),
        (u) => { const s = Math.abs(u * 2 - 1); return Math.max(0.02, f.h * (1 - f.fork * Math.pow(1 - s, 1.5) * 1.2) * (0.55 + 0.45 * s)); }, 14, 1, [1, 0, 0]);
    } else {
      for (const sx of [-1, 1]) { const [h, w, yc] = profile(sp, f.a), d = norm(sx * 0.65, -0.3, -0.7);
        fin((u) => [sx * w * 0.8, yc - h * 0.35 + (u - 0.5) * 0.02, zOf(f.a) - u * 0.05, f.a], () => d, (u) => f.h * Math.sin(PI * (0.2 + 0.8 * u)), 6, 2, [0, 1, 0]); }
    }
  }
  // Leuchtfäden: zwei lange, dünne Bänder von den Schwanzspitzen nach hinten
  if (sp.streamers) {
    const fc = sp.fins.find((f) => f.k === 'caudal'), [h, , yc] = profile(sp, 0.995);
    for (const s of [-1, 1]) { const b0 = n, NS = 16, L = sp.streamers, y0 = yc + s * (h * 0.9 + fc.h * 0.85 * 0.65), z0 = zOf(1.0) - fc.h * 0.75;
      for (let j = 0; j <= NS; j++) { const q = j / NS, wd = 0.012 * (1 - q * 0.8); for (const e of [-1, 1]) v([0, y0 + s * q * 0.12 + e * wd, z0 - q * L], [1, 0, 0], 1, 6, q, (e + 1) / 2); }
      for (let j = 0; j < NS; j++) { const a = b0 + j * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  }
  for (const sx of [-1, 1]) { const [et, ey, er] = sp.eye, [, w, yc] = profile(sp, et), c = [sx * w * 0.86, yc + ey, zOf(et)], b0 = n, S = 10;
    v([c[0] + sx * er * 0.25, c[1], c[2]], [sx, 0, 0], et, 4, 0, 0);
    for (let i = 0; i <= S; i++) { const a = i / S * 2 * PI; v([c[0] + sx * er * 0.05, c[1] + Math.cos(a) * er, c[2] + Math.sin(a) * er], [sx, 0, 0], et, 4, 1, 0); }
    for (let i = 0; i < S; i++) I.push(b0, b0 + 1 + i, b0 + 2 + i); }
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I);
  return g;
}

// Wo schwimmt Fisch i gerade? Formation um die Schwarmmitte, dann weicht er dem Boot (oder Taucher) aus.
const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iF, iG; uniform float uTime, uForm, uBeat, uRad, uFade; uniform vec3 uC, uDir, uAv;
  varying vec3 vW, vN, vL; varying vec4 vK; varying float vGl;
  void main(){ vec3 p = position, nr = normal; float t = aK.x, part = aK.y, vv = aK.z, tt = uTime, r0 = iF.w;
    vec3 pos, hd;
    if (uForm < 0.5) {   // Wirbel: Ring um eine senkrechte Achse, gewellt, die Fische ziehen im Kreis
      float a = iF.z + tt * (0.34 + 0.1 * iG.w) * (iF.x < 5.8 ? 1.12 : 1.0), r = iF.x + sin(tt * 0.7 + r0 * 6.0) * 0.5, h = iF.y + sin(tt * 0.5 + r0 * 9.0) * 0.35 + sin(a * 2.0 + tt * 0.3) * 0.9;
      pos = vec3(cos(a) * r, h, sin(a) * r); hd = normalize(vec3(-sin(a), 0.12 * cos(a * 2.0 + tt * 0.3), cos(a)));
    } else if (uForm < 1.5) {   // Kugel: Schale, die sich um eine schräge Achse dreht und langsam atmet
      float R = (3.3 + 0.45 * sin(tt * 0.6) + 0.25 * sin(tt * 1.3 + r0 * 4.0)) * iF.z, ph = iF.y + tt * 0.5 * (iF.z > 0.9 ? 1.0 : 1.18), el = iF.x;
      vec3 q = vec3(cos(el) * cos(ph), sin(el), cos(el) * sin(ph)) * R; vec3 dq = vec3(-sin(ph), 0.0, cos(ph));
      float c = 0.94, s = 0.34; pos = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); hd = normalize(vec3(dq.x, dq.y * c - dq.z * s, dq.y * s + dq.z * c));
    } else {   // Trupp: lockere, langgezogene Gruppe, die in Fahrtrichtung zieht; jeder pendelt ein wenig für sich
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), uDir)), upv = cross(uDir, right);
      float w1 = tt * 0.4 + r0 * 7.0, w2 = tt * 0.33 + r0 * 5.0, w3 = tt * 0.27 + r0 * 3.0;
      vec3 o = iF.xyz + vec3(sin(w1) * 1.1, sin(w2) * 0.5, sin(w3) * 1.4);
      pos = right * o.x + upv * o.y + uDir * o.z; hd = normalize(uDir * 1.6 + right * cos(w1) * 0.44 + upv * cos(w2) * 0.16);
    }
    vec3 wp = uC + pos; vec3 d = wp - uAv; float L = max(length(d), 0.01), k = max(0.0, 1.0 - L / 8.0);
    wp += d / L * k * k * 7.0; hd = normalize(hd + d / L * k * 2.2);   // dem Boot Platz machen: nah dran stärker
    float sz = iG.x, ph = tt * uBeat * 6.2832 * (1.0 + 2.0 * k) + iG.y, amp = 0.3 + 0.5 * k;
    float wave = sin(ph - (0.5 - p.z) * 6.2832 * 0.9) * amp;
    p.x += wave * pow(clamp(t, 0.0, 1.0), 2.0) * 0.16;
    if (part > 1.5 && part < 2.5) { float fl = sin(tt * 2.6 + iG.y + vv * 1.5) * 0.25 * vv; p.y += fl * 0.1; }
    if (part > 5.5) { p.x += sin(ph - 1.0 - vv * 4.0) * (0.03 + 0.12 * vv) * (0.6 + amp); p.y += sin(tt * 1.3 + iG.y + vv * 3.0) * 0.04 * vv; }
    vL = p; p *= sz * uFade;
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), hd)), upv = cross(hd, right);
    vec3 w = wp + right * p.x + upv * p.y + hd * p.z; vN = right * nr.x + upv * nr.y + hd * nr.z; vW = w; vK = aK; vGl = iG.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FS = (si) => /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying float vGl;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, pulse = 0.8 + 0.2 * sin(uTime * 1.4 + vW.x * 0.4 + vW.z * 0.3); vec3 base, glow = vec3(0.0);
    if (part < 0.5) {
      float ang = vv * 6.2832, sa = sin(ang), top = smoothstep(-0.3, 0.6, sa), flank = 1.0 - smoothstep(0.0, 0.2, abs(sa));
      ${si === 0 ? `// Kometenschwarm: nachtblau, eine Perlenreihe aus Leuchtpunkten entlang der Seitenlinie
        base = mix(vec3(0.62, 0.74, 0.92), vec3(0.2, 0.32, 0.62), top);   // Bauch silbrig hell: hebt sich vom blauen Wasser ab
        float dots = (1.0 - smoothstep(0.14, 0.34, length(vec2(fract(t * 26.0) - 0.5, sa * 2.6)))) * step(0.12, t) * step(t, 0.9);
        glow = vec3(0.3, 0.95, 1.0) * dots * 3.2 * pulse + vec3(0.15, 0.6, 0.8) * flank * 0.35;` : ''}
      ${si === 1 ? `// Saphir-Plättchen: tiefes Blau mit Schuppenglanz und Reihen leuchtender Punkte
        vec2 sc = vec2(t * 40.0, vv * 30.0); sc.y += floor(sc.x) * 0.5; float scale = smoothstep(0.3, 0.5, length((fract(sc) - 0.5) * vec2(1.0, 1.3)));
        base = mix(vec3(0.5, 0.66, 1.0), vec3(0.18, 0.3, 0.85), top) * (1.0 - 0.22 * scale) + vec3(0.08, 0.14, 0.3) * (1.0 - scale);
        float rows = 0.0; for (int k = 0; k < 3; k++) { float y0 = -0.45 + float(k) * 0.45; rows += (1.0 - smoothstep(0.1, 0.28, length(vec2(fract(t * 26.0 + float(k) * 0.33) - 0.5, (sa - y0) * 4.0)))); }
        glow = vec3(0.35, 0.65, 1.0) * rows * step(0.1, t) * step(t, 0.85) * 2.2 * pulse + vec3(0.12, 0.25, 0.6) * 0.45 * pulse;` : ''}
      ${si === 2 ? `// Neon-Säbelfisch: silbern, unregelmäßige orange Leuchtbänder quer über den Leib
        base = mix(vec3(0.72, 0.76, 0.8), vec3(0.3, 0.36, 0.42), top) * (0.9 + 0.12 * h21(floor(vec2(t * 90.0, vv * 50.0))));
        float bands = smoothstep(0.55, 0.95, sin(t * 44.0 + sin(sa * 2.2 + t * 7.0) * 1.6)) * step(0.14, t) * step(t, 0.88) * (0.55 + 0.45 * flank);
        base = mix(base, vec3(1.0, 0.6, 0.25), bands * 0.55); glow = vec3(1.0, 0.5, 0.12) * bands * 1.1 * pulse;` : ''}
      float mouth = (1.0 - smoothstep(0.0, 0.006, abs(vL.y + 0.01 + t * 0.06))) * (1.0 - smoothstep(0.04, 0.09, t)); base *= 1.0 - 0.7 * mouth;
    } else if (part < 3.5) {   // Flossen: zart, mit leuchtenden Rändern und Strahlen
      float ray = 1.0 - smoothstep(0.0, 0.2, abs(fract(u) - 0.5) - 0.3), edge = smoothstep(0.6, 1.0, vv);
      ${si === 0 ? `base = mix(vec3(0.08, 0.3, 0.5), vec3(0.3, 0.85, 1.0), vv); glow = vec3(0.25, 0.9, 1.0) * (edge * 1.4 + ray * vv * 0.4) * pulse;` : ''}
      ${si === 1 ? `base = mix(vec3(0.25, 0.4, 0.7), vec3(0.6, 0.75, 0.95), vv) * (0.8 + 0.3 * ray); glow = vec3(0.4, 0.6, 1.0) * edge * 0.6 * pulse;` : ''}
      ${si === 2 ? `base = mix(vec3(0.5, 0.45, 0.4), vec3(0.95, 0.6, 0.3), vv) * (0.8 + 0.3 * ray); glow = vec3(1.0, 0.5, 0.15) * (edge * 0.9 + ray * vv * 0.3) * pulse;` : ''}
    } else if (part < 4.5) {   // Auge: dunkel mit leuchtendem Ring
      base = vv < 0.5 ? vec3(0.02, 0.03, 0.04) : vec3(0.1, 0.1, 0.12); glow = ${si === 2 ? 'vec3(1.0, 0.7, 0.3)' : 'vec3(0.3, 0.85, 1.0)'} * smoothstep(0.6, 1.0, vv) * 0.8;
    } else {   // Leuchtfäden: hell am Ansatz, zur Spitze hin verglimmend
      base = vec3(0.1, 0.4, 0.55); glow = vec3(0.35, 0.95, 1.0) * (1.6 - 1.3 * vv) * (0.85 + 0.15 * sin(uTime * 3.0 + vv * 8.0)) * pulse;
    }
    vec3 c = shade(base, N, vW) * 1.25 + base * 0.04 + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.22;
    c += glow * (0.75 + 0.5 * vGl);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;

export function createSchools(scene) {
  const R = rng(9090), rr = (a, b) => a + R() * (b - a);
  const S = { gap: 55, timer: 20, list: [] };   // gap: im Mittel so viele Sekunden zwischen zwei Schwärmen
  const types = TYPES.map((ty, ti) => {
    const sp = SPECIES[ty.sp], g = buildFish(sp), iF = new Float32Array(ty.n * 4), iG = new Float32Array(ty.n * 4);
    for (let i = 0; i < ty.n; i++) {
      const q = R(), w = R();
      if (ty.form === 0) { iF.set([4.6 + Math.sqrt(R()) * 2.6, (R() - 0.5) * 2.4, R() * 2 * PI, q], i * 4); }
      else if (ty.form === 1) { iF.set([Math.asin(R() * 2 - 1) * 0.92, R() * 2 * PI, 0.72 + Math.sqrt(R()) * 0.3, q], i * 4); }
      else { iF.set([(R() - 0.5) * 7, (R() - 0.5) * 3, (R() - 0.5) * 15, q], i * 4); }
      iG.set([rr(ty.size[0], ty.size[1]), R() * 6.28, R(), w], i * 4);
    }
    g.setAttribute('iF', new T.InstancedBufferAttribute(iF, 4)); g.setAttribute('iG', new T.InstancedBufferAttribute(iG, 4)); g.instanceCount = ty.n;
    const u = { uC: { value: new T.Vector3() }, uDir: { value: new T.Vector3(0, 0, 1) }, uAv: { value: new T.Vector3(0, 1e4, 0) }, uForm: { value: ty.form }, uBeat: { value: ty.beat }, uRad: { value: ty.rad }, uFade: { value: 0 } };
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: uni(u), side: T.DoubleSide, vertexShader: VS, fragmentShader: FS(ty.sp) })); m.frustumCulled = false; m.visible = false; scene.add(m);
    return { ti, ty, m, u, on: false, x: 0, y: 0, z: 0, yaw: 0, turn: 0, fade: 0, out: false };
  });
  S.types = types;
  /** Höhe, in der ein Schwarm hier schwimmen will */
  const wantY = (ty, x, z, ry) => { const fl = floorH(x, z), lo = fl + ty.rad * 0.7 + 1.5; let y = fl + ty.rad * 0.6 + (ty.depth[0] + ty.depth[1]) * 0.5; if (ry !== undefined) y = clamp(y, ry - 5, ry + 5); return Math.max(lo, Math.min(-6 - ty.rad * 0.3, y)); };   // bleibt in Sichthöhe des Spielers (±5 m), über dem Grund, unter der Oberfläche
  /** einen Schwarm auftauchen lassen: dort, wohin der Spieler schaut, in Sichthöhe; er zieht auf einen Punkt dicht neben dem Spieler zu */
  S.spawn = (ti, ref, near) => {
    const s = types[ti]; if (s.on) return false; const ty = s.ty, look = ref.vh !== undefined ? ref.vh : ref.h || 0;
    for (let k = 0; k < 40; k++) {
      const spread = k < 14 ? 0.45 : k < 28 ? 1.1 : PI, a = look + (k < 14 ? (R() < 0.5 ? 1 : -1) * rr(0.22, 0.5) : rr(-spread, spread)), d = near ? rr(20, 26) : rr(42, 56), x = ref.x + Math.sin(a) * d, z = ref.z + Math.cos(a) * d;
      if (Math.hypot(x, z) > BOUNDS.r * 0.95) continue;
      const y = wantY(ty, x, z, ref.y + rr(0, 4)), fl = floorH(x, z); if (y - ty.rad * 0.7 < fl + 1 || y > -5) continue;
      if (k < 32 && Math.abs(y - ref.y) > 10) continue;   // erst nur in Sichthöhe suchen
      let blocked = false; for (let i = 1; i < 10 && !blocked; i++) { const q = i / 10; if (floorH(x + (ref.x - x) * q, z + (ref.z - z) * q) > y + (ref.y - y) * q - ty.rad * 0.4) blocked = true; }
      if (blocked && k < 32) continue;   // kein Hang zwischen Schwarm und Spieler
      const side = (R() < 0.5 ? 1 : -1) * rr(near ? 3 : 2, near ? 9 : 10), ux = (ref.x - x) / d, uz = (ref.z - z) / d, px = ref.x - uz * side, pz = ref.z + ux * side;
      Object.assign(s, { on: true, out: false, x, y, z, yaw: Math.atan2(px - x, pz - z), turn: 0, fade: 0, life: 0, run: d + 10 }); s.m.visible = true; return true;
    }
    return false;
  };
  S.clear = () => { for (const s of types) { s.on = false; s.m.visible = false; } };
  S.active = () => types.filter((s) => s.on).length;
  S.update = (dt, ref, avoid) => {
    S.timer -= dt;
    if (S.timer <= 0) { S.timer = S.gap * rr(0.6, 1.4); if (S.active() < 2) { const free = types.filter((s) => !s.on); if (free.length && !S.spawn(free[Math.floor(R() * free.length)].ti, ref)) S.timer = 6; } }   // kein Platz (zu flach): bald noch einmal versuchen
    for (const s of types) {
      if (!s.on) continue; const ty = s.ty; s.life += dt;
      // Anflug: zügig und geradeaus zum Spieler hin, in seiner Nähe dann gemächlich; danach sanftes Schlängeln
      const dR = Math.hypot(s.x - ref.x, s.z - ref.z), boost = s.run > 0 ? 1 + 2.2 * smooth(14, 34, dR) : 1;
      if (s.run > 0) s.run -= ty.speed * boost * dt; else { s.turn += (rr(-1, 1) * 0.25 - s.turn) * Math.min(1, dt * 0.3); s.yaw = wrapPi(s.yaw + s.turn * dt * 0.25); }
      if (Math.hypot(s.x, s.z) > BOUNDS.r * 0.9) s.yaw += wrapPi(Math.atan2(-s.x, -s.z) - s.yaw) * Math.min(1, dt * 0.5);
      const ahx = s.x + Math.sin(s.yaw) * 12, ahz = s.z + Math.cos(s.yaw) * 12; if (floorH(ahx, ahz) > s.y - ty.rad * 0.7 - 1) s.yaw += dt * 0.6;   // vorn steigt der Grund: abdrehen
      s.x += Math.sin(s.yaw) * ty.speed * boost * dt; s.z += Math.cos(s.yaw) * ty.speed * boost * dt;
      s.y += (wantY(ty, s.x, s.z, dR < 70 ? ref.y : undefined) - s.y) * Math.min(1, dt * 0.25); s.y = Math.max(s.y, floorH(s.x, s.z) + ty.rad * 0.7 + 1.5);
      const dB = Math.hypot(s.x - ref.x, s.z - ref.z); if (dB > 170 || (s.life > 240 && dB > 110)) s.out = true;
      s.fade = s.out ? Math.max(0, s.fade - dt * 0.5) : Math.min(1, s.fade + dt * 0.5); if (s.out && s.fade <= 0) { s.on = false; s.m.visible = false; continue; }
      s.u.uC.value.set(s.x, s.y, s.z); s.u.uDir.value.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)); s.u.uAv.value.set(avoid.x, avoid.y, avoid.z); s.u.uFade.value = 0.3 + 0.7 * s.fade;
    }
  };
  /** wie viele Fische aus Schwärmen gerade im Umkreis r schwimmen (ungefähr, nach der Schwarmmitte) */
  S.countNear = (x, z, r) => { let c = 0; for (const s of types) if (s.on && Math.hypot(s.x - x, s.z - z) < r + s.ty.rad) c += s.ty.n; return c; };
  return S;
}
