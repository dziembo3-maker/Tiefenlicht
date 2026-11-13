// fauna.js – größere Tiere: Panzer-Laternenschlinger, Schimmernder Riesenbarsch, Geflügelter Tiefsee-Gleiter, ab und zu ein Hai.
// Körper aus Querschnitten, Flossen als Häute mit Strahlen, Leuchtmuster im Shader; die Schwimmwelle macht die Grafikkarte.
// Die Tiere leben in einem Ring um das Boot: wer zu weit weg ist, taucht anderswo außer Sicht wieder auf.
import { T, rng, clamp, wrapPi } from './util.js';
import { uni, COMMON } from './gfx.js';
import { floorH } from './terrain.js';

const PI = Math.PI;
// Körperform: [t (0 = Schnauze, 1 = Schwanzstiel), Höhe, Breite, Mittelhöhe]
const SPECIES = [
  { name: 'lantern', len: 1, body: [[0, 0.004, 0.004, -0.005], [0.03, 0.05, 0.045, -0.006], [0.1, 0.095, 0.082, 0], [0.22, 0.115, 0.1, 0.004], [0.4, 0.11, 0.095, 0.004], [0.6, 0.09, 0.075, 0.002], [0.78, 0.06, 0.05, 0], [0.92, 0.035, 0.03, 0], [1, 0.03, 0.022, 0]], plates: 9, eye: [0.075, 0.035, 0.016],
    fins: [{ k: 'dorsal', a: 0.2, b: 0.92, h: 0.13, sweep: 0.55, rays: 13, spiky: 1 }, { k: 'anal', a: 0.55, b: 0.88, h: 0.08, sweep: 0.5, rays: 7, spiky: 1 }, { k: 'caudal', h: 0.15, rays: 11, spiky: 1, fork: 0.15 }, { k: 'pect', a: 0.17, h: 0.11, rays: 7, spiky: 1 }, { k: 'pelvic', a: 0.42, h: 0.07, rays: 5, spiky: 1 }], barbel: 1 },
  { name: 'perch', len: 1, body: [[0, 0.01, 0.01, -0.01], [0.025, 0.07, 0.05, -0.01], [0.08, 0.13, 0.085, 0], [0.2, 0.175, 0.105, 0.01], [0.38, 0.19, 0.11, 0.015], [0.55, 0.17, 0.1, 0.012], [0.72, 0.12, 0.07, 0.006], [0.86, 0.065, 0.038, 0.002], [1, 0.05, 0.022, 0]], eye: [0.07, 0.045, 0.02],
    fins: [{ k: 'dorsal', a: 0.22, b: 0.82, h: 0.1, sweep: 0.35, rays: 14, spiky: 0.5 }, { k: 'anal', a: 0.58, b: 0.8, h: 0.08, sweep: 0.4, rays: 6 }, { k: 'caudal', h: 0.16, rays: 12, fork: -0.05 }, { k: 'pect', a: 0.2, h: 0.12, rays: 9 }, { k: 'pelvic', a: 0.3, h: 0.1, rays: 6, long: 1 }] },
  { name: 'glider', len: 1, body: [[0, 0.006, 0.006, -0.004], [0.04, 0.05, 0.04, -0.004], [0.12, 0.085, 0.06, 0], [0.3, 0.095, 0.062, 0.004], [0.5, 0.08, 0.05, 0.004], [0.72, 0.05, 0.032, 0.002], [0.9, 0.028, 0.018, 0], [1, 0.024, 0.014, 0]], eye: [0.06, 0.025, 0.014],
    fins: [{ k: 'dorsal', a: 0.25, b: 0.7, h: 0.26, sweep: 0.9, rays: 9, sail: 1 }, { k: 'anal', a: 0.45, b: 0.8, h: 0.16, sweep: 0.9, rays: 8, sail: 1 }, { k: 'caudal', h: 0.2, rays: 12, fork: 0.65 }, { k: 'pect', a: 0.18, h: 0.34, rays: 8, wing: 1 }, { k: 'pelvic', a: 0.32, h: 0.22, rays: 4, long: 1 }] },
  { name: 'shark', len: 1, body: [[0, 0.003, 0.004, -0.004], [0.02, 0.026, 0.03, -0.002], [0.06, 0.055, 0.062, 0.002], [0.13, 0.08, 0.088, 0.004], [0.25, 0.1, 0.104, 0.004], [0.36, 0.104, 0.1, 0.002], [0.5, 0.09, 0.085, 0], [0.64, 0.068, 0.062, 0], [0.78, 0.042, 0.038, 0.002], [0.88, 0.026, 0.022, 0.004], [0.95, 0.02, 0.016, 0.006], [1, 0.022, 0.012, 0.008]], eye: [0.065, 0.016, 0.008], gills: 1,
    fins: [{ k: 'dorsal', a: 0.31, b: 0.47, h: 0.15, sweep: 1.05, rays: 0, tri: 1 }, { k: 'dorsal', a: 0.76, b: 0.81, h: 0.04, sweep: 0.9, rays: 0, tri: 1 }, { k: 'anal', a: 0.78, b: 0.83, h: 0.035, sweep: 0.9, rays: 0, tri: 1 }, { k: 'caudal', h: 0.21, rays: 0, fork: 0.55, shark: 1 }, { k: 'pect', a: 0.22, h: 0.22, rays: 0, tri: 1 }, { k: 'pelvic', a: 0.6, h: 0.05, rays: 0, tri: 1 }] },
];

function profile(sp, t) {
  const b = sp.body; let i = 0; while (i < b.length - 2 && t > b[i + 1][0]) i++;
  const [t0, h0, w0, y0] = b[i], [t1, h1, w1, y1] = b[i + 1], k = clamp((t - t0) / (t1 - t0), 0, 1), s = k * k * (3 - 2 * k);
  return [h0 + (h1 - h0) * s, w0 + (w1 - w0) * s, y0 + (y1 - y0) * s];
}
const zOf = (t) => 0.5 - t;

/** baut ein Tier: Attribute position, normal, aK = (t entlang Körper, Teil, v Wurzel→Rand, u), aW = Breiten-Koordinate */
function buildSpecies(sp, si) {
  const P = [], N = [], K = [], I = []; let n = 0;
  const v = (p, nr, t, part, vv, uu) => { P.push(...p); N.push(...nr); K.push(t, part, vv, uu); return n++; };
  // Körper
  const NT = 40, NA = 22;
  const bodyPt = (t, a) => {
    const [h, w, yc] = profile(sp, t); let r = 1;
    if (sp.plates) { const s = t * sp.plates; const f = s - Math.floor(s); if (t > 0.12 && t < 0.97) r = 1 + 0.07 * Math.pow(f, 2.2) - 0.03; }
    const ca = Math.cos(a), sa = Math.sin(a), e = 2 / 2.3;
    return [Math.sign(ca) * Math.pow(Math.abs(ca), e) * w * r, yc + Math.sign(sa) * Math.pow(Math.abs(sa), e) * h * r * (sa < 0 && si === 3 ? 0.85 : 1), zOf(t)];
  };
  const base = n;
  for (let j = 0; j <= NT; j++) { const t = Math.pow(j / NT, 1.15); for (let i = 0; i <= NA; i++) { const a = i / NA * 2 * PI; v(bodyPt(t, a), [0, 0, 0], t, 0, a / (2 * PI), 0); } }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const a = base + j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; I.push(a, c, b, b, c, d); }
  // Normalen des Körpers aus den Nachbarn
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NA; i++) {
    const idx = base + j * (NA + 1) + i, g = (jj, ii) => { const q = (base + Math.max(0, Math.min(NT, jj)) * (NA + 1) + ((ii + NA) % NA)) * 3; return [P[q], P[q + 1], P[q + 2]]; };
    const a = g(j, i + 1), b = g(j, i - 1), c = g(j + 1, i), d = g(j - 1, i), ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; N[idx * 3] = -nx / l; N[idx * 3 + 1] = -ny / l; N[idx * 3 + 2] = -nz / l;
  }
  // Flossen: Haut zwischen Wurzellinie und Rand, Strahlen im Shader
  const fin = (root, dir, lenF, nu, rays, part, opts = {}) => {
    const NV = 6, b0 = n;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu, r = root(u), d = dir(u); let L = lenF(u);
      if (opts.spiky && rays) { const q = Math.abs(Math.sin(u * rays * PI + PI / 2)); L *= 1 - opts.spiky * 0.6 * (1 - Math.pow(q, 3)); }
      for (let j = 0; j <= NV; j++) { const vv = j / NV, curl = opts.curl ? opts.curl * vv * vv : 0; v([r[0] + d[0] * L * vv + curl, r[1] + d[1] * L * vv, r[2] + d[2] * L * vv], opts.nrm || [1, 0, 0], r[3] !== undefined ? r[3] : 0.5, part, vv, u * (rays || 1)); }
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < NV; j++) { const a = b0 + i * (NV + 1) + j, c = a + NV + 1; I.push(a, c, a + 1, a + 1, c, c + 1); }
  };
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
  for (const f of sp.fins) {
    if (f.k === 'dorsal' || f.k === 'anal') {
      const up = f.k === 'dorsal' ? 1 : -1;
      fin((u) => { const t = f.a + (f.b - f.a) * u, [h, , yc] = profile(sp, t); return [0, yc + up * h * 0.92, zOf(t), t]; }, () => norm(0, up, -f.sweep),
        (u) => (f.tri ? f.h * Math.pow(1 - u, 0.8) * (0.4 + 0.6 * Math.min(1, u * 6)) : f.sail ? f.h * (0.25 + 0.75 * Math.sin(Math.min(1, u * 1.4) * PI * 0.55)) * (1 - 0.6 * u) : f.h * (0.35 + 0.65 * Math.sin(PI * (0.15 + 0.85 * u)))) + 0.004, 16, f.rays, 1, { spiky: f.spiky, curl: 0 });
    } else if (f.k === 'caudal') {
      fin((u) => { const [h, , yc] = profile(sp, 0.995), y = yc + (u * 2 - 1) * h * 0.9; return [0, y, zOf(1.0) + 0.005, 1]; }, (u) => { const s = u * 2 - 1; return norm(0, s * (0.75 + (f.shark ? (s > 0 ? 0.6 : -0.1) : 0)), -1); },
        (u) => { const s = Math.abs(u * 2 - 1); let L = f.h * (1 - f.fork * Math.pow(1 - s, 1.5) * 1.2) * (0.55 + 0.45 * s); if (f.shark) L *= u > 0.5 ? 1.35 : 0.75; return Math.max(0.02, L); }, 18, f.rays, 1, { spiky: f.spiky });
    } else {
      const pair = [-1, 1];
      for (const sx of pair) {
        const t0 = f.a, [h, w, yc] = profile(sp, t0), y0 = yc - h * (f.k === 'pect' ? 0.35 : 0.85), x0 = sx * w * (f.k === 'pect' ? 0.8 : 0.4);
        const dir = f.wing ? norm(sx * 0.9, -0.15, -0.6) : f.k === 'pect' ? norm(sx * 0.65, -0.35, -0.7) : norm(sx * 0.35, -0.75, -0.6);
        fin((u) => [x0, y0 + (u - 0.5) * 0.02, zOf(t0) - u * (f.wing ? 0.08 : 0.05), t0], () => dir, (u) => (f.long ? f.h * (1.2 - 0.9 * u) : f.wing ? f.h * (0.5 + 0.5 * Math.sin(PI * (0.25 + 0.75 * u))) * (1 - 0.5 * u * u) : f.h * Math.sin(PI * (0.2 + 0.8 * u))), 8, f.rays, 2 + (sx > 0 ? 0 : 0.5), { spiky: f.spiky, nrm: [0, 1, 0] });
      }
    }
  }
  // Augen: dunkle Linse mit leuchtendem Ring
  for (const sx of [-1, 1]) {
    const [et, ey, er] = sp.eye, [h, w, yc] = profile(sp, et), c = [sx * w * 0.86, yc + ey, zOf(et)], b0 = n, S = 10;
    v([c[0] + sx * er * 0.25, c[1], c[2]], [sx, 0, 0], et, 4, 0, 0);
    for (let i = 0; i <= S; i++) { const a = i / S * 2 * PI; v([c[0] + sx * er * 0.05, c[1] + Math.cos(a) * er, c[2] + Math.sin(a) * er], [sx, 0, 0], et, 4, 1, 0); }
    for (let i = 0; i < S; i++) I.push(b0, b0 + 1 + i, b0 + 2 + i);
  }
  // Bartel mit Leuchtspitze (Laternenschlinger)
  if (sp.barbel) {
    const b0 = n, pts = []; for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push([0, -0.05 - s * 0.17 + s * s * 0.06, zOf(0.04) - s * 0.06 + s * s * 0.12]); }
    for (let i = 0; i < pts.length; i++) for (let k = 0; k < 4; k++) { const a = k * PI / 2, r = 0.006 * (1 - i / pts.length * 0.5); v([pts[i][0] + Math.cos(a) * r, pts[i][1], pts[i][2] + Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)], 0.04, 5, i / 8, 0); }
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 4; k++) { const a = b0 + i * 4 + k, b = b0 + i * 4 + (k + 1) % 4; I.push(a, a + 4, b, b, a + 4, b + 4); }
  }
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(N), 3)); g.setAttribute('aK', new T.BufferAttribute(new Float32Array(K), 4)); g.setIndex(I);
  return g;
}

const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN; varying vec4 vK; varying vec3 vL; varying float vGl;
  void main(){ vec3 p = position, nr = normal; float t = aK.x, part = aK.y, vv = aK.z;
    float ph = iA.x, amp = iA.y, k = 6.2832 * 1.0;
    float wave = sin(ph - (0.5 - p.z) * k * 0.9) * amp;
    float bodyT = part < 0.5 || part > 3.5 ? t : (part < 1.5 ? max(t, 0.0) : t);
    p.x += wave * pow(clamp(bodyT, 0.0, 1.0), 2.0) * 0.16;
    if (part > 0.5 && part < 1.5) { p.x += sin(ph * 1.3 - vv * 2.5 + aK.w * 0.4) * 0.02 * vv * (0.4 + amp); if (t > 0.98) p.x += sin(ph - 1.0) * amp * 0.12 * vv; }
    if (part > 1.5 && part < 3.5) { float fl = sin(uTime * 2.2 + iA.z + vv * 1.5) * 0.25 * vv; p.y += fl * 0.12; p.x *= 1.0 + fl * 0.3; }
    if (part > 4.5) { p.x += sin(uTime * 1.3 + vv * 3.0 + iA.z) * 0.025 * vv; p.z += sin(uTime * 0.9 + vv * 2.0) * 0.02 * vv; }
    vL = p; p *= iP.w; nr = normalize(nr);
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vGl = iA.w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FS = (si) => /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying float vGl;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.0) N = -N;
    float t = vK.x, part = vK.y, vv = vK.z, u = vK.w, side = vL.y; vec3 base, glow = vec3(0.0);
    float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + vW.x * 0.3);
    if (part < 0.5) {   // Körper
      float ang = vv * 6.2832, top = smoothstep(-0.3, 0.6, sin(ang));
      ${si === 0 ? `float s = t * 9.0, f = fract(s); float plate = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.86, 1.0, f));
        base = mix(vec3(0.16, 0.24, 0.3), vec3(0.32, 0.44, 0.5), top) * (0.75 + 0.35 * plate) + vec3(0.25, 0.4, 0.45) * smoothstep(0.82, 0.97, f) * step(0.12, t);
        float tex = h21(floor(vec2(t * 60.0, vv * 40.0))); base *= 0.9 + 0.15 * tex;
        glow = vec3(0.2, 0.9, 1.0) * smoothstep(0.93, 1.0, f) * step(0.12, t) * step(t, 0.95) * 0.35 * pulse;` : ''}
      ${si === 1 ? `vec2 sc = vec2(t * 52.0, vv * 34.0); sc.y += floor(sc.x) * 0.5; vec2 fs = fract(sc) - 0.5; float scale = smoothstep(0.32, 0.5, length(fs * vec2(1.0, 1.3)));
        base = mix(vec3(0.55, 0.7, 0.8), vec3(0.2, 0.42, 0.6), top) * (1.0 - 0.18 * scale) + vec3(0.1, 0.18, 0.2) * (1.0 - scale) * top;
        float sy2 = sin(ang), st = sin(sy2 * 7.5 + sin(t * 11.0 + sy2 * 2.0) * 1.3 + t * 3.0), st2 = sin(sy2 * 13.0 - sin(t * 7.0) * 2.0);
        float band = (smoothstep(0.86, 0.98, st) + 0.5 * smoothstep(0.93, 0.99, st2)) * smoothstep(0.1, 0.3, t) * (1.0 - smoothstep(0.82, 0.95, t)) * smoothstep(-0.7, -0.2, sy2);
        glow = vec3(0.25, 0.95, 1.0) * band * 0.75 * pulse; base = mix(base, vec3(0.45, 0.9, 1.0), clamp(band, 0.0, 1.0) * 0.5);` : ''}
      ${si === 2 ? `base = mix(vec3(0.2, 0.38, 0.68), vec3(0.08, 0.18, 0.45), top);
        vec2 c = vec2(t * 70.0, vv * 46.0); float d = length(fract(c) - 0.5), r = h21(floor(c)); float dot1 = (1.0 - smoothstep(0.1, 0.24, d)) * step(0.62, r);
        float line = 1.0 - smoothstep(0.0, 0.012, abs(side - 0.004 - sin(t * 9.0) * 0.004)); line *= step(0.08, t) * step(t, 0.9);
        glow = vec3(0.35, 0.9, 1.0) * (dot1 * (0.7 + 0.5 * sin(uTime * 2.0 + r * 30.0)) + line * 0.5) * pulse;` : ''}
      ${si === 3 ? `base = mix(vec3(0.82, 0.86, 0.88), vec3(0.27, 0.36, 0.44), smoothstep(-0.35, 0.25, sin(ang)));
        float gill = step(0.16, t) * step(t, 0.24) * smoothstep(0.75, 0.95, abs(sin(t * 3.1416 * 50.0))) * (1.0 - smoothstep(0.3, 0.6, abs(sin(ang) + 0.1)));
        base *= 1.0 - 0.6 * gill; base *= 0.92 + 0.12 * h21(floor(vec2(t * 160.0, vv * 90.0)));
        base = mix(base, base * 0.75, smoothstep(0.55, 0.95, h21(floor(vec2(t * 18.0, vv * 12.0)))) * 0.25 * top);` : ''}
      float mouth = (1.0 - smoothstep(0.0, 0.006, abs(side + ${si === 3 ? '0.03' : '0.012'} + t * 0.06))) * (1.0 - smoothstep(0.05, ${si === 3 ? '0.14' : '0.09'}, t));
      base *= 1.0 - 0.7 * mouth;
    } else if (part < 3.5) {   // Flossen: Haut mit Strahlen, Ränder leuchten bei den Tiefseearten
      float ray = 1.0 - smoothstep(0.0, 0.18, abs(fract(u) - 0.5) - 0.32); if (${si === 3 ? '1.0' : '0.0'} > 0.5) ray = 0.0;
      ${si === 3 ? 'base = mix(vec3(0.3, 0.38, 0.45), vec3(0.16, 0.2, 0.25), smoothstep(0.7, 1.0, vv));' : si === 2 ? 'base = mix(vec3(0.12, 0.25, 0.5), vec3(0.3, 0.55, 0.85), vv) * (0.8 + 0.3 * ray);' : si === 1 ? 'base = mix(vec3(0.25, 0.45, 0.6), vec3(0.4, 0.7, 0.85), vv) * (0.75 + 0.35 * ray);' : 'base = mix(vec3(0.15, 0.32, 0.4), vec3(0.3, 0.85, 0.95), vv * vv) * (0.75 + 0.35 * ray);'}
      float edge = smoothstep(0.62, 1.0, vv);
      glow = ${si === 3 ? 'vec3(0.0)' : si === 2 ? 'vec3(0.3, 0.75, 1.0) * (edge * 0.6 + ray * vv * 0.25)' : si === 1 ? 'vec3(0.3, 0.9, 1.0) * edge * 0.55' : 'vec3(0.2, 0.95, 1.0) * (edge * 1.6 + ray * vv * 0.5)'} * pulse;
    } else if (part < 4.5) {   // Auge
      base = vec3(0.02, 0.03, 0.04); glow = ${si === 3 ? 'vec3(0.0)' : 'vec3(0.3, 0.9, 1.0) * smoothstep(0.6, 1.0, vv) * 0.9'}; if (vv < 0.5) base = vec3(0.1, 0.12, 0.13);
    } else {   // Bartel
      base = vec3(0.2, 0.5, 0.55); glow = vec3(0.3, 1.0, 1.0) * (0.3 + 2.2 * smoothstep(0.75, 1.0, vv)) * pulse;
    }
    vec3 c = shade(base, N, vW) * 1.25 + base * 0.03 + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.2;
    c += glow * (0.7 + 0.6 * vGl);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;

export function createFauna(scene) {
  const R = rng(4242), rr = (a, b) => a + R() * (b - a);
  const kinds = SPECIES.map((sp, si) => {
    const g = buildSpecies(sp, si), M = si === 3 ? 4 : si === 2 ? 18 : 8;
    const iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
    g.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); g.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); g.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); g.instanceCount = 0;
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, vertexShader: VS, fragmentShader: FS(si) })); m.frustumCulled = false; scene.add(m);
    return { sp, si, g, iP, iR, iA, M, list: [] };
  });
  // Arten: Größe, Tempo, Tiefe, Anzahl um das Boot
  const CFG = [{ size: [1.1, 1.6], speed: 0.75, n: 6, nearFloor: [1.5, 5], beat: 1.2 }, { size: [1.7, 2.5], speed: 1.0, n: 6, nearFloor: [3, 14], beat: 0.9 }, { size: [1.0, 1.4], speed: 2.0, n: 16, nearFloor: [6, 24], beat: 2.2, school: 4 }, { size: [5.5, 7.2], speed: 2.0, n: 1, nearFloor: [8, 30], beat: 0.6 }];
  const F = { kinds, sharkT: rr(20, 45) };
  function valid(x, y, z) { const f = floorH(x, z); return y > f + 1.2 && y < -8; }
  function spawn(k, sub, ring, leader) {
    const c = CFG[k.si];
    for (let tries = 0; tries < 20; tries++) {
      let x, z, y;
      if (leader) { x = leader.x + rr(-4, 4); z = leader.z + rr(-4, 4); y = leader.y + rr(-2, 2); }
      else { const a = R() * 2 * PI, d = rr(ring[0], ring[1]); x = sub.x + Math.cos(a) * d; z = sub.z + Math.sin(a) * d; const f = floorH(x, z); y = Math.min(-10, f + rr(c.nearFloor[0], c.nearFloor[1])); }
      if (!valid(x, y, z)) continue;
      return { x, y, z, yaw: R() * 2 * PI, pitch: 0, roll: 0, sp: c.speed * rr(0.8, 1.15), size: rr(c.size[0], c.size[1]), ph: R() * 6, tx: x, ty: y, tz: z, retarget: 0, beat: 0, leader, off: leader ? [rr(-3, 3), rr(-1.5, 1.5), rr(-3, 3)] : null, glow: R(), life: 1e9 };
    }
    return null;
  }
  function retarget(f, c, sub) { let a = R() * 2 * PI; const d = rr(15, 45) * (c.speed > 1.8 ? 2 : 1); if (F.attract && c.speed > 1.8 && c.beat < 1 && sub) { const ta = Math.atan2(sub.x - f.x, sub.z - f.z); a = Math.PI / 2 - ta + rr(-0.9, 0.9); } f.tx = f.x + Math.cos(a) * d; f.tz = f.z + Math.sin(a) * d; const fl = floorH(f.tx, f.tz); f.ty = Math.min(-9, Math.max(fl + c.nearFloor[0], Math.min(fl + c.nearFloor[1], f.y + rr(-6, 6)))); f.retarget = rr(12, 30); }
  // Entwicklermenü: Anzahl je Art, Haie anlocken, Tiere vor dem Boot erscheinen lassen
  F.cfg = CFG; F.attract = false; F.max = kinds.map((k) => k.M);
  F.setCount = (si, n) => { CFG[si].n = Math.max(0, Math.min(kinds[si].M, Math.round(n))); const k = kinds[si]; while (k.list.length > CFG[si].n) { const f = k.list.pop(); for (const o of k.list) if (o.leader === f) o.leader = null; } };
  F.spawnNear = (si, sub) => {
    const k = kinds[si], c = CFG[si]; if (k.list.length >= k.M) k.list.shift(); if (c.n < k.list.length + 1) c.n = k.list.length + 1;
    const d = si === 3 ? 22 : 12, x = sub.x + Math.sin(sub.h) * d, z = sub.z + Math.cos(sub.h) * d, y = Math.max(floorH(x, z) + 2, Math.min(-9, sub.y));
    k.list.push({ x, y, z, yaw: sub.h + PI / 2, pitch: 0, roll: 0, sp: c.speed, size: (c.size[0] + c.size[1]) / 2, ph: 0, tx: x + Math.cos(sub.h) * 40, ty: y, tz: z - Math.sin(sub.h) * 40, retarget: 20, beat: 0, glow: R(), life: 1e9, leader: null });
  };
  F.update = (dt, sub, time) => {
    // seltener Hai: zieht in einiger Entfernung quer vorbei
    F.sharkT -= dt; const sh = kinds[3];
    if (false && F.sharkT <= 0 && sh.list.length === 0) {
      F.sharkT = rr(60, 120); const a = R() * 2 * PI, d = rr(50, 70), x = sub.x + Math.cos(a) * d, z = sub.z + Math.sin(a) * d, fl = floorH(x, z), y = Math.max(fl + 8, Math.min(-14, sub.y + rr(-6, 10)));
      if (valid(x, y, z)) { const pass = rr(10, 22) * (R() < 0.5 ? 1 : -1), px = sub.x + Math.cos(a + PI / 2) * pass, pz = sub.z + Math.sin(a + PI / 2) * pass, yaw = Math.atan2(px - x, pz - z), s = { x, y, z, yaw, pitch: 0, roll: 0, sp: rr(2.0, 2.8), size: rr(5.5, 7.2), ph: 0, tx: x + Math.sin(yaw) * 200, ty: y, tz: z + Math.cos(yaw) * 200, retarget: 1e9, beat: 0, glow: 0, life: 70 }; sh.list.push(s); }
    }
    for (const k of kinds) {
      const c = CFG[k.si];
      if (F.frozen) { for (const f of k.list) f.ph += dt * c.beat * 2 * PI * 0.6; } else {
      // auffüllen
      while (k.list.length < c.n) { const school = c.school && k.list.length % c.school !== 0 ? k.list[k.list.length - (k.list.length % c.school)] : null; const f = spawn(k, sub, [55, 105], school); if (!f) break; k.list.push(f); if (k.list.length > c.n + 2) break; }
      for (let i = k.list.length - 1; i >= 0; i--) {
        const f = k.list[i]; f.life -= dt;
        const dS = Math.hypot(f.x - sub.x, f.z - sub.z);
        if (dS > 150 || f.life < 0) { if (f.leader === undefined || f.leader === null) for (const o of k.list) if (o.leader === f) o.leader = null; k.list.splice(i, 1); continue; }
        // Ziel: Anführer folgen, sonst eigenes Ziel
        let tx = f.tx, ty = f.ty, tz = f.tz;
        if (f.leader && k.list.includes(f.leader)) { const L = f.leader, cy = Math.cos(L.yaw), sy = Math.sin(L.yaw); tx = L.x + f.off[0] * cy + f.off[2] * sy - Math.sin(L.yaw) * 2; ty = L.y + f.off[1]; tz = L.z - f.off[0] * sy + f.off[2] * cy - Math.cos(L.yaw) * 2; }
        else { f.leader = null; f.retarget -= dt; if (f.retarget <= 0 || Math.hypot(tx - f.x, tz - f.z) < 4) { retarget(f, c, sub); tx = f.tx; ty = f.ty; tz = f.tz; } }
        let dx = tx - f.x, dy = ty - f.y, dz = tz - f.z;
        // dem Boot ausweichen, über dem Grund bleiben
        const bx = f.x - sub.x, by = f.y - sub.y, bz = f.z - sub.z, bd = Math.hypot(bx, by, bz), flee = k.si === 3 ? 7 : 9;
        if (bd < flee) { const w = (flee - bd) / flee * 30; dx += bx / bd * w; dy += by / bd * w * 0.5; dz += bz / bd * w; }
        const ahx = f.x + Math.sin(f.yaw) * 6, ahz = f.z + Math.cos(f.yaw) * 6, fl = floorH(ahx, ahz); if (f.y < fl + 2.5) dy += (fl + 3 - f.y) * 4;
        const wantYaw = Math.atan2(dx, dz), wantPitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.45, 0.45), turn = k.si === 3 ? 0.25 : k.si === 2 ? 1.1 : 0.5;
        const dyaw = clamp(wrapPi(wantYaw - f.yaw), -turn * dt, turn * dt); f.yaw = wrapPi(f.yaw + dyaw); f.pitch += (wantPitch - f.pitch) * Math.min(1, dt * 0.8); f.roll += (-dyaw / dt * 0.5 - f.roll) * Math.min(1, dt * 2);
        const spd = f.sp * (bd < flee ? 1.6 : 1) * (f.leader ? 1.15 : 1); f.x += Math.sin(f.yaw) * Math.cos(f.pitch) * spd * dt; f.z += Math.cos(f.yaw) * Math.cos(f.pitch) * spd * dt; f.y += Math.sin(f.pitch) * spd * dt;
        const flo = floorH(f.x, f.z); if (f.y < flo + 1) f.y = flo + 1; if (f.y > -6) f.y = -6;
        // Schwanzschlag: Haie gleiten und schlagen nur ab und zu, die anderen gleichmäßig
        if (k.si === 3) { f.beat -= dt; if (f.beat < -rr(2, 5)) f.beat = rr(1.5, 3); f.amp = (f.amp || 0) + ((f.beat > 0 ? 0.5 : 0.12) - (f.amp || 0)) * Math.min(1, dt * 1.5); }
        else f.amp = 0.28 + 0.12 * (spd / f.sp - 1);
        f.ph += dt * c.beat * (k.si === 3 ? (f.beat > 0 ? 1.6 : 0.8) : 1) * 2 * PI * (0.6 + 0.4 * spd / f.sp);
      }
      }
      let n = 0;
      for (const f of k.list) { if (n >= k.M) break; const o = n * 4; k.iP[o] = f.x; k.iP[o + 1] = f.y; k.iP[o + 2] = f.z; k.iP[o + 3] = f.size; k.iR[o] = f.yaw; k.iR[o + 1] = f.pitch; k.iR[o + 2] = clamp(f.roll, -0.4, 0.4); k.iA[o] = f.ph; k.iA[o + 1] = f.amp; k.iA[o + 2] = f.x * 0.37; k.iA[o + 3] = f.glow; n++; }
      k.g.instanceCount = n; k.g.attributes.iP.needsUpdate = k.g.attributes.iR.needsUpdate = k.g.attributes.iA.needsUpdate = true;
    }
  };
  /** für Testbilder: ein Tier jeder Art vor die Kamera stellen */
  F.showcase = (x, y, z, yaw) => {
    for (const k of kinds) k.list.length = 0; const s = [[0, -6, 0], [1, 0, 0], [2, 6, -1], [3, 0, 10]];
    for (const [si, dx, dz] of s) { const k = kinds[si], c = CFG[si]; k.list.push({ x: x + Math.cos(yaw) * dx + Math.sin(yaw) * dz, y: y + (si === 2 ? 2 : si === 0 ? -1 : 0), z: z - Math.sin(yaw) * dx + Math.cos(yaw) * dz, yaw: yaw + PI / 2, pitch: 0, roll: 0, sp: 0.0001, size: (c.size[0] + c.size[1]) / 2, ph: 1, tx: x, ty: y, tz: z, retarget: 1e9, beat: 0, glow: 0.5, life: 1e9, amp: 0.3 }); }
    F.frozen = true;
  };
  return F;
}
