// life.js – alles, was die Welt belebt: Tang, Kristalle, Korallen, Quallen, Fischschwärme, Lichtpunkte, Blasen, Lichtbahnen.
// Die Formen gibt es je einmal; jede Kachel der Welt bekommt daraus ihre eigenen Exemplare.
import { T, rng } from './util.js';
import { U, uni, COMMON, SUN, quadPoints } from './gfx.js';

const ROTY = `vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }`;
const F32 = (a) => new Float32Array(a), U16 = (a) => new Uint16Array(a);

// ---------- Formen ----------
function kelpShape() {
  const p = [], tip = [], ix = []; let n = 0;
  const SEG = 10, bend = (y) => [Math.sin(y * 2.6) * 0.035, Math.cos(y * 3.4) * 0.03];
  for (let j = 0; j <= SEG; j++) { const y = j / SEG, b = bend(y), r = 0.011 * (1.2 - y); for (let i = 0; i < 3; i++) { const a = i * 2.094; p.push(b[0] + Math.cos(a) * r, y, b[1] + Math.sin(a) * r); tip.push(0); n++; } }
  for (let j = 0; j < SEG; j++) for (let i = 0; i < 3; i++) { const a = j * 3 + i, c = j * 3 + (i + 1) % 3; ix.push(a, c, a + 3, c, c + 3, a + 3); }
  const LEAVES = 15, WD = [0.16, 0.8, 1, 0.62, 0.0], TT = [0, 0.2, 0.5, 0.8, 1];
  for (let l = 0; l < LEAVES; l++) {
    const y = 0.1 + 0.9 * (l / (LEAVES - 1)), az = l * 2.4 + Math.sin(l * 1.7) * 0.5, b = bend(y), len = (0.27 - 0.09 * y) * (0.8 + 0.4 * Math.sin(l * 5.1) ** 2), wd = len * 0.2, rise = l === LEAVES - 1 ? 1.4 : 0.55 + 0.25 * Math.sin(l * 3.3);
    const ax = Math.cos(az), azz = Math.sin(az), base = n;
    for (let k = 0; k < 5; k++) { const t = TT[k], out = t * len, up = t * len * rise - t * t * len * 0.35, w = WD[k] * wd; for (const s of [-1, 1]) { p.push(b[0] + ax * out - azz * w * s, Math.min(1.08, y + up), b[1] + azz * out + ax * w * s); tip.push(0.25 + 0.75 * t); n++; } }
    for (let k = 0; k < 4; k++) { const a = base + k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  return { a: { position: [F32(p), 3], aTip: [F32(tip), 1] }, i: U16(ix) };
}
// Kristall: schlanke vierkantige Spitze, unten schmal, im unteren Drittel am breitesten, oben in einem Punkt geschlossen
function crystalShape() {
  const p = [], nn = [], ix = []; let n = 0;
  const C = [[1, 0], [0, 0.55], [-1, 0], [0, -0.55]], ring = (y, s) => C.map((c) => [c[0] * s, y, c[1] * s]), A = ring(0, 0.4), B = ring(0.27, 1), tip = [0, 1, 0];
  const face = (pts) => {
    const a = pts[0], b = pts[1], c = pts[2]; let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const mx = pts.reduce((s, q) => s + q[0], 0), mz = pts.reduce((s, q) => s + q[2], 0); if (nx * mx + nz * mz < 0) { pts = pts.slice().reverse(); nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz); for (const q of pts) { p.push(q[0], q[1], q[2]); nn.push(nx / l, ny / l, nz / l); }
    for (let k = 1; k < pts.length - 1; k++) ix.push(n, n + k, n + k + 1); n += pts.length;
  };
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face([A[i], A[j], B[j], B[i]]); face([B[i], B[j], tip]); }
  return { a: { position: [F32(p), 3], normal: [F32(nn), 3] }, i: U16(ix) };
}
// ---------- Korallen: vier kräftige Formen; aT = 0 am Fuß, 1 an den leuchtenden Rändern/Spitzen ----------
function geoOut(p, t, ix, nrm) { const a = { position: [F32(p), 3], aT: [F32(t), 1] }; if (nrm) a.normal = [F32(nrm), 3]; return { a, i: U16(ix) }; }
// Geweih: dicke, runde Äste, die sich zwei-, dreimal teilen
function antlerShape(seed, flat) {
  const R = rng(seed), p = [], t = [], ix = []; let n = 0, top = 0.01; const S = 6;
  const ring = (c, d, r) => { let ux = -d[2], uz = d[0], l = Math.hypot(ux, uz); if (l < 0.01) { ux = 1; uz = 0; l = 1; } ux /= l; uz /= l; const wx = d[1] * uz, wy = d[2] * ux - d[0] * uz, wz = -d[1] * ux, b = n; for (let i = 0; i < S; i++) { const a = i * 6.2832 / S, ca = Math.cos(a) * r, sa = Math.sin(a) * r; p.push(c[0] + ux * ca + wx * sa, c[1] + wy * sa, c[2] + uz * ca + wz * sa); n++; } return b; };
  const join = (a, b) => { for (let i = 0; i < S; i++) { const j = (i + 1) % S; ix.push(a + i, a + j, b + i, a + j, b + j, b + i); } };
  function branch(c, d, len, r, depth) {
    const m = [c[0] + d[0] * len * 0.5, c[1] + d[1] * len * 0.5, c[2] + d[2] * len * 0.5], e = [c[0] + d[0] * len, c[1] + d[1] * len, c[2] + d[2] * len];
    const a = ring(c, d, r), b = ring(m, d, r * 0.93), q = ring(e, d, r * 0.86); join(a, b); join(b, q); top = Math.max(top, e[1] + r);
    if (depth === 0) { p.push(e[0] + d[0] * r * 1.1, e[1] + d[1] * r * 1.1, e[2] + d[2] * r * 1.1); for (let i = 0; i < S; i++) ix.push(q + i, q + (i + 1) % S, n); n++; return; }
    const kids = R() < 0.35 ? 3 : 2, a0 = R() * 6.3;
    for (let k = 0; k < kids; k++) { const an = a0 + k * 6.283 / kids + (R() - 0.5) * 0.6, sp = 0.6 + R() * 0.45; let nx = d[0] * 0.7 + Math.cos(an) * sp, ny = d[1] * 0.7 + 0.5, nz = d[2] * 0.7 + Math.sin(an) * sp * (flat ? 0.2 : 1); const l = Math.hypot(nx, ny, nz); branch(e, [nx / l, ny / l, nz / l], len * (0.72 + R() * 0.15), r * 0.8, depth - 1); }
  }
  branch([0, 0, 0], [0, 1, 0], 0.3, 0.085, 3);
  for (let i = 0; i < p.length; i += 3) { p[i] /= top; p[i + 1] /= top; p[i + 2] /= top; t.push(Math.max(0, p[i + 1])); }
  return geoOut(p, t, ix);
}
// Fächer: gewellte, flache Scheibe auf kurzem Stiel, der Rand leuchtet
function fanShape(seed) {
  const R = rng(seed), p = [], t = [], ix = [], A = 18, RR = 5;
  p.push(0, 0, 0); t.push(0);
  for (let j = 1; j <= RR; j++) for (let i = 0; i <= A; i++) {
    const u = j / RR, a = -1.25 + 2.5 * i / A, wob = 1 + 0.12 * Math.sin(a * 7 + seed) + 0.06 * Math.sin(a * 13), r = u * wob;
    p.push(Math.sin(a) * r * 0.62, 0.12 + Math.cos(a) * r * 0.88, Math.sin(a * 5 + u * 3 + seed) * 0.07 * u + u * u * 0.08); t.push(Math.pow(u, 1.4));
  }
  for (let i = 0; i < A; i++) ix.push(0, 1 + i, 2 + i);
  for (let j = 1; j < RR; j++) for (let i = 0; i < A; i++) { const a = 1 + (j - 1) * (A + 1) + i, b = a + A + 1; ix.push(a, b, a + 1, a + 1, b, b + 1); }
  return geoOut(p, t, ix);
}
// Röhren: ein Bündel offener Rohre, die Öffnungen leuchten
function tubeShape(seed) {
  const R = rng(seed), p = [], t = [], ix = []; let n = 0; const S = 7;
  for (let k = 0; k < 6; k++) {
    const a = R() * 6.3, d = k ? 0.12 + R() * 0.16 : 0, h = (k ? 0.45 + R() * 0.45 : 1), r = 0.07 + R() * 0.04, lx = Math.cos(a) * d, lz = Math.sin(a) * d, tilt = d * 0.6, b = n;
    for (let j = 0; j <= 3; j++) { const y = h * j / 3, rr = r * (1 + 0.25 * (j === 3)); for (let i = 0; i < S; i++) { const an = i * 6.2832 / S; p.push(lx + Math.cos(a) * tilt * y + Math.cos(an) * rr, y, lz + Math.sin(a) * tilt * y + Math.sin(an) * rr); t.push(j === 3 ? 1 : 0.15 + 0.5 * j / 3); n++; } }
    for (let j = 0; j < 3; j++) for (let i = 0; i < S; i++) { const q = b + j * S + i, q2 = b + j * S + (i + 1) % S; ix.push(q, q2, q + S, q2, q2 + S, q + S); }
    // Innenseite dunkel bis zum Rand
    const top = b + 3 * S, c = n; p.push(lx + Math.cos(a) * tilt * h, h - 0.12, lz + Math.sin(a) * tilt * h); t.push(0.3); n++;
    for (let i = 0; i < S; i++) ix.push(top + i, c, top + (i + 1) % S);
  }
  return geoOut(p, t, ix);
}
// Busch: viele kurze, dicke Finger aus einem Polster
function bushShape(seed) {
  const R = rng(seed), p = [], t = [], ix = []; let n = 0; const S = 5;
  for (let k = 0; k < 16; k++) {
    const a = R() * 6.3, d = Math.sqrt(R()) * 0.42, h = 0.35 + R() * 0.55 - d * 0.4, r = 0.06 + R() * 0.03, bx = Math.cos(a) * d, bz = Math.sin(a) * d, lean = 0.25 + d * 0.6, b = n;
    for (let j = 0; j <= 2; j++) { const y = h * j / 2, o = lean * y * y, rr = r * (1 - 0.15 * j); for (let i = 0; i < S; i++) { const an = i * 6.2832 / S; p.push(bx + Math.cos(a) * o + Math.cos(an) * rr, y, bz + Math.sin(a) * o + Math.sin(an) * rr); t.push(0.1 + 0.6 * j / 2); n++; } }
    for (let j = 0; j < 2; j++) for (let i = 0; i < S; i++) { const q = b + j * S + i, q2 = b + j * S + (i + 1) % S; ix.push(q, q2, q + S, q2, q2 + S, q + S); }
    const top = b + 2 * S, c = n; p.push(bx + Math.cos(a) * lean * h * h, h + r, bz + Math.sin(a) * lean * h * h); t.push(1); n++;
    for (let i = 0; i < S; i++) ix.push(top + i, top + (i + 1) % S, c);
  }
  let top = 0; for (let i = 1; i < p.length; i += 3) top = Math.max(top, p[i]); for (let i = 0; i < p.length; i++) p[i] /= top;
  return geoOut(p, t, ix);
}
// Kiesel: kantiger kleiner Stein
function pebbleShape() {
  const p = [], nn = [], ix = []; let n = 0; const v = [];
  for (let i = 0; i < 7; i++) { const a = i * 6.2832 / 7; v.push([Math.cos(a) * (0.85 + 0.25 * Math.sin(i * 3.7)), 0, Math.sin(a) * (0.85 + 0.25 * Math.cos(i * 2.3))]); }
  const top = [0.1, 0.55, -0.05], mid = v.map((q, i) => [q[0] * 0.7, 0.35 + 0.08 * Math.sin(i * 1.9), q[2] * 0.7]);
  const tri = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; [b, c] = [c, b]; } for (const q of [a, b, c]) { p.push(q[0], q[1], q[2]); nn.push(nx / l, ny / l, nz / l); } ix.push(n, n + 1, n + 2); n += 3; };
  for (let i = 0; i < 7; i++) { const j = (i + 1) % 7; tri(v[i], mid[j], v[j]); tri(v[i], mid[i], mid[j]); tri(mid[i], top, mid[j]); }
  return { a: { position: [F32(p), 3], normal: [F32(nn), 3] }, i: U16(ix) };
}
// Seegras: ein Büschel schmaler, gebogener Halme
function grassShape() {
  const R = rng(5), p = [], t = [], ix = []; let n = 0;
  for (let k = 0; k < 9; k++) {
    const a = R() * 6.3, d = R() * 0.35, bx = Math.cos(a) * d, bz = Math.sin(a) * d, h = 0.55 + R() * 0.45, lean = 0.2 + R() * 0.35, w = 0.035 + R() * 0.02, ra = a + 1.57, b = n;
    for (let j = 0; j <= 4; j++) { const u = j / 4, y = h * u, o = lean * u * u, ww = w * (1 - u * 0.9); for (const s of [-1, 1]) { p.push(bx + Math.cos(a) * o + Math.cos(ra) * ww * s, y, bz + Math.sin(a) * o + Math.sin(ra) * ww * s); t.push(u); n++; } }
    for (let j = 0; j < 4; j++) { const q = b + j * 2; ix.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  return geoOut(p, t, ix);
}
function jellyShape() {
  const p = [], k = [], ix = []; let n = 0;
  const RG = 7, SG = 12;
  for (let j = 0; j <= RG; j++) { const a = (j / RG) * Math.PI * 0.56, r = Math.sin(a) / Math.sin(Math.PI * 0.56), y = 0.62 * Math.cos(a) + 0.08; for (let i = 0; i <= SG; i++) { const b = (i / SG) * Math.PI * 2; p.push(Math.cos(b) * r, y, Math.sin(b) * r); k.push(r, 0); n++; } }
  for (let j = 0; j < RG; j++) for (let i = 0; i < SG; i++) { const a = j * (SG + 1) + i; ix.push(a, a + SG + 1, a + 1, a + 1, a + SG + 1, a + SG + 2); }
  const ribbon = (bx, bz, len, wd, type, segs, ph) => {
    const base = n, tx = -bz, tz = bx, tl = Math.hypot(tx, tz) || 1;
    for (let j = 0; j <= segs; j++) { const t = j / segs, w = wd * (1 - t * 0.7); for (const s of [-1, 1]) { p.push(bx * (1 - t * 0.25) + (tx / tl) * w * s, -t * len, bz * (1 - t * 0.25) + (tz / tl) * w * s); k.push(t, type + ph); n++; } }
    for (let j = 0; j < segs; j++) { const a = base + j * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.4; ribbon(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.9, 0.16, 1, 7, i * 0.17); }
  for (let i = 0; i < 12; i++) { const a = i * 0.5236; ribbon(Math.cos(a) * 0.93, Math.sin(a) * 0.93, 3.6 + (i % 3) * 0.9, 0.022, 2, 9, i * 0.07); }
  return { a: { position: [F32(p), 3], aK: [F32(k), 2] }, i: U16(ix) };
}

export function createLife(scene) {
  const L = {}, PX = { value: 600 };
  const kelp = kelpShape(), crystal = crystalShape(), corals = [antlerShape(11, false), fanShape(3), tubeShape(7), bushShape(13), antlerShape(29, true)], jelly = jellyShape(), pebble = pebbleShape(), grass = grassShape();
  const quadS = { a: { position: [F32([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3] }, i: U16([0, 1, 2, 0, 2, 3]) };

  // ---------- Materialien ----------
  const mKelp = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide,
      vertexShader: /* glsl */ `attribute float aTip; attribute vec4 iP; attribute vec2 iR; uniform float uTime; uniform vec3 uSubPos; varying vec3 vW; varying float vT, vH; ${ROTY}
        void main(){ float h = iP.w, y = position.y; vec3 p = rotY(position, iR.x) * h;
          float sw = y * y * h * 0.085;
          p.x += sin(uTime * 0.55 + iR.y + y * 2.1) * sw + sin(uTime * 1.3 + iR.y * 3.0 + y * 17.0) * 0.022 * h * aTip;
          p.z += cos(uTime * 0.43 + iR.y * 1.7 + y * 1.7) * sw * 0.8;
          p.y += sin(uTime * 1.1 + iR.y + y * 13.0) * 0.012 * h * aTip;
          p += iP.xyz;
          vec3 d = p - uSubPos; float l = length(d); p.xz += d.xz / max(l, 0.01) * (1.0 - smoothstep(1.0, 5.0, l)) * 2.2 * y;
          vW = p; vT = aTip; vH = y; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW; varying float vT, vH;
        void main(){ vec3 base = mix(vec3(0.07, 0.17, 0.17), vec3(0.11, 0.30, 0.25), vT * vH);
          vec3 c = shade(base, normalize(vec3(0.0, 0.75, 0.0) + uSunDir * 0.3), vW) * 0.5;
          gl_FragColor = vec4(fog(c, vW), 1.0); }` });
  const mCry = new T.ShaderMaterial({ uniforms: uni(),
    vertexShader: /* glsl */ `attribute vec4 iP, iD; attribute vec3 iC; varying vec3 vW, vN, vC; varying float vY; ${ROTY}
      void main(){ vec3 up = normalize(vec3(iD.x, 1.0, iD.y)), rt = normalize(cross(up, vec3(0.0, 0.0, 1.0))), fw = cross(rt, up), q = rotY(position, iD.w), nq = rotY(normal, iD.w);
        vec3 p = iP.xyz + rt * q.x * iD.z + up * q.y * iP.w + fw * q.z * iD.z;
        vN = rt * nq.x + up * nq.y * 0.3 + fw * nq.z; vW = p; vY = position.y; vC = iC; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vC; varying float vY;
      void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float g = smoothstep(0.0, 0.95, vY), pulse = 0.9 + 0.1 * sin(uTime * 0.8 + vW.x * 0.4 + vW.z * 0.3), nv = abs(dot(N, V)), face = 0.5 + 0.5 * max(dot(N, normalize(vec3(0.45, 0.55, 0.35))), 0.0);
        vec3 lo = vC * vC * 0.45 + vC * 0.2 + vec3(0.0, 0.015, 0.06);
        vec3 c = mix(lo, vC, g) * (0.95 + 1.5 * g) * face * pulse + vC * pow(1.0 - nv, 2.0) * 0.5 + vec3(0.9, 0.95, 1.0) * pow(g, 6.0) * 0.5;
        gl_FragColor = vec4(fog(c, vW), 1.0); }` });
  const mCoral = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide,
    vertexShader: /* glsl */ `attribute float aT; attribute vec4 iP; attribute vec3 iD, iC; uniform float uTime; varying vec3 vW, vC; varying float vT, vF; ${ROTY}
      void main(){ vec3 p = rotY(position * vec3(iP.w, iP.w * iD.y, iP.w), iD.x); float sw = aT * aT * iP.w * 0.05;
        p.x += sin(uTime * 0.6 + iD.z + aT * 3.0) * sw; p.z += cos(uTime * 0.47 + iD.z * 1.7 + aT * 2.0) * sw; p += iP.xyz;
        vW = p; vT = aT; vC = iC; vF = 1.0 - smoothstep(14.0, 55.0, distance(p, cameraPosition)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vC; varying float vT, vF;
      void main(){ float lk = exp(vW.y * 0.0125), pulse = 0.85 + 0.15 * sin(uTime * 0.9 + vW.x * 0.7 + vW.z * 0.5);
        vec3 body = vC * (0.18 + 0.55 * vT + 0.1 * lk) + vC * lights(vW, vec3(0.0, 1.0, 0.0)) * 0.3;
        float rim = smoothstep(0.72, 1.0, vT);
        vec3 c = body + vC * rim * (0.9 + 0.8 * vF) * pulse + vec3(1.0) * rim * rim * 0.28 * vF;
        gl_FragColor = vec4(fog(c, vW), 1.0); }` });
  // Kiesel und Steinchen: gleiche Farbe wie der Grund, etwas dunkler und mit eigener Schattierung
  const mPeb = new T.ShaderMaterial({ uniforms: uni(),
    vertexShader: /* glsl */ `attribute vec4 iP; attribute vec3 iD; varying vec3 vW, vN; varying float vK; ${ROTY}
      void main(){ vec3 p = rotY(position * vec3(iD.y, iD.z, 1.0) * iP.w, iD.x) + iP.xyz; vN = rotY(normal / vec3(iD.y, iD.z, 1.0), iD.x); vW = p; vK = fract(iD.x * 3.1); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN; varying float vK;
      void main(){ vec3 base = mix(vec3(0.16, 0.24, 0.36), vec3(0.42, 0.52, 0.62), vK); gl_FragColor = vec4(fog(shade(base, normalize(vN), vW), vW), 1.0); }` });
  const mGrass = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide,
    vertexShader: /* glsl */ `attribute float aT; attribute vec4 iP; attribute vec2 iR; uniform float uTime; uniform vec3 uSubPos; varying vec3 vW; varying float vT; ${ROTY}
      void main(){ vec3 p = rotY(position * iP.w, iR.x); float sw = aT * aT * iP.w * 0.25; p.x += sin(uTime * 0.8 + iR.y + iP.x * 0.2) * sw; p.z += cos(uTime * 0.65 + iR.y) * sw * 0.7; p += iP.xyz;
        vec3 d = p - uSubPos; float l = length(d); p.xz += d.xz / max(l, 0.01) * smoothstep(4.0, 1.0, l) * aT * 0.8;
        vW = p; vT = aT; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW; varying float vT;
      void main(){ vec3 base = mix(vec3(0.05, 0.13, 0.15), vec3(0.14, 0.34, 0.33), vT); gl_FragColor = vec4(fog(shade(base, vec3(0.0, 1.0, 0.0), vW) * 0.62, vW), 1.0); }` });
  const mJelly = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `attribute vec2 aK; attribute vec4 iP, iQ; uniform float uTime; varying vec3 vW, vL; varying vec2 vK;
        void main(){ float ty = floor(aK.y + 0.01), ph = iQ.x + fract(aK.y) * 6.0, t = uTime * iQ.w, beat = sin(t * 1.5 + iQ.x), s = iP.w; vec3 p = position;
          if (ty < 0.5) { p.xz *= 1.0 - 0.2 * beat * aK.x * aK.x; p.y *= 1.0 + 0.12 * beat; }
          else { float a = aK.x; p.xz *= 1.0 - 0.2 * beat * (1.0 - a); p.x += sin(t * 1.5 - a * 5.0 + ph) * 0.3 * a; p.z += cos(t * 1.2 - a * 4.0 + ph * 1.3) * 0.3 * a; p.y += -0.15 * beat * a; }
          vL = p; p *= s;
          // Treiben in der Strömung: jede Qualle langsam in ihre eigene Richtung, über Minuten hin und her
          float f1 = 0.026 + 0.02 * fract(iQ.x * 3.7), f2 = 0.022 + 0.018 * fract(iQ.x * 5.3);
          vec3 drift = vec3(sin(uTime * f1 + iQ.x * 5.0) * 6.5 + sin(uTime * 0.011 + iQ.x * 2.0) * 3.0, sin(uTime * 0.017 + iQ.x * 4.0) * 1.2, cos(uTime * f2 + iQ.x * 3.0) * 6.5 + cos(uTime * 0.009 + iQ.x) * 3.0);
          vec2 vel = vec2(cos(uTime * f1 + iQ.x * 5.0) * 6.5 * f1, -sin(uTime * f2 + iQ.x * 3.0) * 6.5 * f2); p.xz -= vel * p.y * 1.4;   // Schirm neigt sich leicht gegen die Strömung
          float ang = uTime * iQ.z + iQ.x; p += iP.xyz + drift + vec3(cos(ang) * iQ.y, sin(uTime * 0.23 + iQ.x) * 1.6 + 0.25 * s * sin(t * 1.5 + iQ.x - 1.0), sin(ang) * iQ.y);
          vW = p; vK = vec2(aK.x, ty); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vL; varying vec2 vK;
        void main(){ vec3 c; float a;
          if (vK.y < 0.5) { float rim = smoothstep(0.55, 1.0, vK.x), stripes = 0.5 + 0.5 * sin(atan(vL.z, vL.x) * 16.0); c = vec3(0.50, 0.82, 1.0) * (0.55 + 0.9 * rim + 0.18 * stripes * rim) + vec3(0.5, 0.4, 0.9) * (1.0 - vK.x) * 0.35; a = 0.36 + 0.5 * rim; }
          else if (vK.y < 1.5) { c = vec3(0.60, 0.80, 1.0) * (0.85 - 0.4 * vK.x); a = 0.55 * (1.0 - vK.x * 0.8); }
          else { c = vec3(0.45, 0.75, 1.0) * 0.9; a = 0.6 * (1.0 - vK.x); }
          float f = 1.0 - exp(-distance(vW, cameraPosition) * uFogK * 0.8);
          gl_FragColor = vec4(mix(c, waterCol(normalize(vW - cameraPosition)), f), a * (1.0 - f * 0.6)); }` });
  const mFish = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `attribute vec4 iA, iB, iC; uniform float uTime; uniform vec3 uSubPos; varying vec2 vQ; varying float vF, vN; uniform float uFogK;
        vec3 path(float th){ float c = cos(iC.z), s = sin(iC.z); vec2 e = vec2(cos(th) * iB.x + sin(th * 2.0 + 1.0) * iB.x * 0.35, sin(th) * iB.y);
          return iA.xyz + vec3(e.x * c + e.y * s, sin(th * 2.0 + iA.w * 0.2) * iB.z * 0.6, -e.x * s + e.y * c); }
        void main(){ float th = uTime * iB.w + iA.w; vec3 p = path(th), dir = normalize(path(th + 0.03 * sign(iB.w)) - p);
          p += vec3(iC.x, iC.y, 0.0) + vec3(sin(uTime * 1.7 + iA.w * 37.0), cos(uTime * 1.3 + iA.w * 51.0), 0.0) * 0.18;
          vec3 d = p - uSubPos; float l = length(d); p += d / max(l, 0.01) * (1.0 - smoothstep(2.0, 9.0, l)) * 5.0;
          vec3 v = normalize(cameraPosition - p), sd = normalize(cross(dir, v)); float dist = distance(p, cameraPosition), sz = iC.w * (1.0 + dist * 0.012);
          p += dir * position.x * sz + sd * position.y * sz * 0.3;
          vQ = position.xy; vF = exp(-dist * uFogK * 0.7); vN = smoothstep(2.0, 9.0, dist); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `precision highp float; varying vec2 vQ; varying float vF, vN;
        void main(){ float a = (1.0 - smoothstep(0.15, 0.5, abs(vQ.y) + max(vQ.x, 0.0) * 0.5)) * (1.0 - smoothstep(0.3, 0.5, abs(vQ.x))); gl_FragColor = vec4(vec3(0.80, 0.97, 1.0) * (0.6 + 0.9 * vF), a * (0.3 + 0.7 * vF) * vN); }` });
  const mBub = new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 aQ; uniform float uTime, uPx, uFogK; varying float vA;
        void main(){ float t = fract(aQ.x + uTime * aQ.y / aQ.z), h = t * aQ.z; vec3 p = position + vec3(sin(h * 0.55 + aQ.w) * (0.15 + h * 0.012), h, cos(h * 0.47 + aQ.w * 2.0) * (0.15 + h * 0.012));
          vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; vA = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.8, 1.0, t)) * exp(-d * uFogK * 0.75);
          gl_PointSize = clamp((0.09 + 0.1 * fract(aQ.x * 7.3)) * (0.6 + 0.6 * t) * uPx / max(d, 0.5), 1.5, uPx * 0.014); vA *= smoothstep(1.5, 5.0, d); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = (1.0 - smoothstep(0.42, 0.5, r)) * (0.35 + 0.65 * smoothstep(0.22, 0.44, r)); gl_FragColor = vec4(vec3(0.62, 0.88, 1.0), a * vA * 0.8); }` });
  const mDots = new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec4 aC; uniform float uTime, uPx, uFogK; varying vec3 vC; varying float vA;
      void main(){ float ph = aC.w; vec3 p = position + vec3(sin(uTime * 0.31 + ph), sin(uTime * 0.43 + ph * 1.7), cos(uTime * 0.27 + ph * 2.3)) * 0.4;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; vA = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.3 + ph * 5.0), 2.0)) * exp(-d * uFogK * 0.65) * smoothstep(1.0, 4.0, d); vC = aC.rgb;
        gl_PointSize = clamp((0.08 + 0.08 * fract(ph * 3.7)) * uPx / max(d, 0.5), 1.8, uPx * 0.014); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = 1.0 - smoothstep(0.08, 0.5, r); gl_FragColor = vec4((vC * 0.85 + 0.15) * a * a * vA * 1.7, 1.0); }` });

  const BS = (cx, cz) => new T.Sphere(new T.Vector3(cx, -48, cz), 125);
  function iMesh(shape, mat, arr, stride, layout, cx, cz, order) {
    if (!arr.length) return null;
    const g = new T.InstancedBufferGeometry(); for (const k in shape.a) g.setAttribute(k, new T.BufferAttribute(shape.a[k][0], shape.a[k][1])); g.setIndex(new T.BufferAttribute(shape.i, 1));
    const ib = new T.InstancedInterleavedBuffer(F32(arr), stride, 1); let o = 0; for (const [name, size] of layout) { g.setAttribute(name, new T.InterleavedBufferAttribute(ib, size, o)); o += size; }
    g.instanceCount = arr.length / stride; g.boundingSphere = BS(cx, cz); const m = new T.Mesh(g, mat); m.renderOrder = order || 0; m.userData.tris = (shape.i.length / 3) * g.instanceCount; return m;
  }
  function pMesh(mat, arr, stride, layout, cx, cz) {
    if (!arr.length) return null;
    const g = new T.BufferGeometry(), ib = new T.InterleavedBuffer(F32(arr), stride); let o = 0; for (const [name, size] of layout) { g.setAttribute(name, new T.InterleavedBufferAttribute(ib, size, o)); o += size; }
    g.boundingSphere = BS(cx, cz); const m = quadPoints(g, mat); m.renderOrder = 6; return m;
  }
  const tag = (m) => { if (m) m.userData.small = true; return m; };
  L.inside = false; L.setInside = (v) => { L.inside = v; };
  L.build = (it, cx, cz) => [
    iMesh(kelp, mKelp, it.kelp, 6, [['iP', 4], ['iR', 2]], cx, cz),
    iMesh(crystal, mCry, it.cry, 11, [['iP', 4], ['iD', 4], ['iC', 3]], cx, cz),
    ...corals.map((sh, k) => iMesh(sh, mCoral, it.coral[k], 10, [['iP', 4], ['iD', 3], ['iC', 3]], cx, cz)),
    tag(iMesh(pebble, mPeb, it.peb, 7, [['iP', 4], ['iD', 3]], cx, cz)),
    tag(iMesh(grass, mGrass, it.grass, 6, [['iP', 4], ['iR', 2]], cx, cz)),
    iMesh(jelly, mJelly, it.jelly, 8, [['iP', 4], ['iQ', 4]], cx, cz, 5),
    iMesh(quadS, mFish, it.fish, 12, [['iA', 4], ['iB', 4], ['iC', 4]], cx, cz, 4),
    pMesh(mBub, it.bub, 7, [['position', 3], ['aQ', 4]], cx, cz),
    pMesh(mDots, it.dots, 7, [['position', 3], ['aC', 4]], cx, cz),
  ].filter(Boolean);

  // ---------- Schwebeteilchen um die Kamera ----------
  const R = rng(99), rr = (a, b) => a + R() * (b - a);
  {
    const N = 1300, p = new Float32Array(N * 3), s = new Float32Array(N); for (let i = 0; i < N; i++) { p[i * 3] = R() * 44; p[i * 3 + 1] = R() * 44; p[i * 3 + 2] = R() * 44; s[i] = R(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aS', new T.BufferAttribute(s, 1));
    const m = quadPoints(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute float aS; uniform float uTime, uPx; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime * 0.11 + aS * 40.0) * 0.8, uTime * (0.05 + aS * 0.1) * -1.0, uTime * 0.12 + cos(uTime * 0.09 + aS * 31.0) * 0.8);
          p = mod(p - cameraPosition, 44.0) - 22.0 + cameraPosition; vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
          vA = (1.0 - smoothstep(13.0, 22.0, d)) * smoothstep(0.6, 3.0, d) * (0.25 + 0.75 * aS); gl_PointSize = max(1.0, (0.035 + 0.05 * aS) * uPx / max(d, 0.5)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = (1.0 - smoothstep(0.1, 0.5, length(q))); gl_FragColor = vec4(vec3(0.45, 0.75, 0.85) * a * vA * 0.55, 1.0); }` }));
    m.frustumCulled = false; m.renderOrder = 6; scene.add(m);
  }
  // ---------- Glimmern: farbiges Plankton, das in einem weiten Feld um die Kamera schwebt und funkelt ----------
  {
    const N = 2200, p = new Float32Array(N * 3), c = new Float32Array(N * 4), PAL = [[0.3, 0.9, 1.0], [0.3, 0.9, 1.0], [0.55, 0.5, 1.0], [0.85, 0.55, 1.0], [0.3, 1.0, 0.8], [1.0, 0.65, 0.45]];
    for (let i = 0; i < N; i++) { p[i * 3] = R() * 90; p[i * 3 + 1] = R() * 90; p[i * 3 + 2] = R() * 90; const q = PAL[Math.floor(R() * PAL.length) % PAL.length]; c[i * 4] = q[0]; c[i * 4 + 1] = q[1]; c[i * 4 + 2] = q[2]; c[i * 4 + 3] = R(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aC', new T.BufferAttribute(c, 4));
    const m = quadPoints(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute vec4 aC; uniform float uTime, uPx, uFogK, uDeep; varying vec3 vC; varying float vA;
        void main(){ float s = aC.w; vec3 p = position + vec3(sin(uTime * 0.07 + s * 40.0) * 2.0, sin(uTime * 0.05 + s * 17.0) * 1.5, uTime * 0.1 + cos(uTime * 0.06 + s * 31.0) * 2.0);
          p = mod(p - cameraPosition, 90.0) - 45.0 + cameraPosition; vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
          float tw = pow(0.5 + 0.5 * sin(uTime * (0.6 + s * 1.4) + s * 60.0), 3.0);
          vA = (1.0 - smoothstep(30.0, 45.0, d)) * smoothstep(1.5, 5.0, d) * (0.15 + 0.85 * tw) * exp(-d * uFogK * 0.6) * (0.55 + 0.45 * smoothstep(-90.0, -20.0, p.y)); vC = aC.rgb;
          gl_PointSize = clamp((0.05 + 0.06 * fract(s * 7.7)) * uPx / max(d, 0.5), 1.5, uPx * 0.01); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; varying vec3 vC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = 1.0 - smoothstep(0.05, 0.5, r); gl_FragColor = vec4((vC * 0.8 + 0.2) * a * a * vA * 1.1, 1.0); }` }));
    m.frustumCulled = false; m.renderOrder = 6; scene.add(m);
  }
  // ---------- Blasen hinter der Schraube ----------
  const NB = 90, bp = new Float32Array(NB * 3), bl = new Float32Array(NB), bv = new Float32Array(NB * 3); let bi = 0; for (let i = 0; i < NB; i++) bp[i * 3 + 1] = 999;
  {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(bp, 3)); g.setAttribute('aL', new T.BufferAttribute(bl, 1));
    const m = quadPoints(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX }), transparent: true, depthWrite: false,
      vertexShader: `attribute float aL; uniform float uPx; varying float vA; void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); vA = smoothstep(0.0, 0.35, aL) * 0.55; gl_PointSize = max(1.5, (0.045 + 0.07 * (1.0 - aL)) * uPx / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5), a = (1.0 - smoothstep(0.42, 0.5, r)) * (0.3 + 0.7 * smoothstep(0.2, 0.44, r)); gl_FragColor = vec4(vec3(0.7, 0.92, 1.0), a * vA); }` }));
    m.frustumCulled = false; m.renderOrder = 7; scene.add(m); L.wake = g;
  }
  let emitAcc = 0;
  L.emit = (x, y, z, vx, vy, vz, rate, dt) => {
    emitAcc += rate * dt;
    while (emitAcc >= 1) { emitAcc -= 1; const o = bi * 3; bp[o] = x + (Math.random() - 0.5) * 0.4; bp[o + 1] = y + (Math.random() - 0.5) * 0.4; bp[o + 2] = z + (Math.random() - 0.5) * 0.4; bv[o] = vx + (Math.random() - 0.5) * 0.8; bv[o + 1] = vy + Math.random() * 0.5; bv[o + 2] = vz + (Math.random() - 0.5) * 0.8; bl[bi] = 1; bi = (bi + 1) % NB; }
  };
  // ---------- Lichtbahnen von der Oberfläche: ein Feld, das mit der Kamera wandert ----------
  {
    const g = new T.InstancedBufferGeometry(); g.setAttribute('position', new T.BufferAttribute(F32([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const iP = [], iQ = [];
    for (let i = 0; i < 120; i++) { const thin = R() < 0.55; iP.push(rr(0, 340) + SUN.x * 6, 6, rr(0, 340) + SUN.z * 6, thin ? rr(1.5, 4.5) : rr(6, 17)); iQ.push(rr(80, 125), R() * 6.3, thin ? rr(0.7, 1.2) : rr(0.4, 0.8), 0); }
    g.setAttribute('iP', new T.InstancedBufferAttribute(F32(iP), 4)); g.setAttribute('iQ', new T.InstancedBufferAttribute(F32(iQ), 4)); g.instanceCount = iP.length / 4;
    const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute vec4 iP, iQ; uniform vec3 uSunDir; uniform float uTime; varying vec2 vQ; varying vec3 vW; varying float vI;
        void main(){ vec3 ax = -uSunDir, b0 = iP.xyz; b0.xz = mod(b0.xz - cameraPosition.xz + 170.0, 340.0) - 170.0 + cameraPosition.xz; vec3 p0 = b0 + ax * position.y * iQ.x + vec3(sin(uTime * 0.05 + iQ.y) * 2.0, 0.0, 0.0), sd = normalize(cross(ax, cameraPosition - p0));
          vec3 p = p0 + sd * position.x * iP.w * (1.0 + position.y * 1.2); vQ = position.xy; vW = p; vI = iQ.z * (0.72 + 0.28 * sin(uTime * 0.31 + iQ.y * 3.0)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `precision highp float; uniform float uFogK, uDeep; varying vec2 vQ; varying vec3 vW; varying float vI;
        void main(){ float e = 1.0 - 4.0 * vQ.x * vQ.x, d = distance(vW, cameraPosition); float a = e * e * smoothstep(0.0, 0.1, vQ.y) * pow(1.0 - vQ.y, 0.9) * smoothstep(4.0, 24.0, d) * exp(-d * uFogK * 0.5);
          gl_FragColor = vec4(vec3(0.07, 0.34, 0.46) * a * vI * 1.8 * uDeep, 1.0); }` }));
    m.frustumCulled = false; m.renderOrder = 3; scene.add(m);
  }

  // ---------- pro Bild ----------
  const tmp = [];
  L.update = (dt, sub, pxScale, glows) => {
    PX.value = pxScale;
    for (let i = 0; i < NB; i++) if (bl[i] > 0) { const o = i * 3; bl[i] = Math.max(0, bl[i] - dt * 0.55); bv[o] *= 1 - dt * 1.8; bv[o + 2] *= 1 - dt * 1.8; bv[o + 1] += (1.3 - bv[o + 1]) * dt * 1.5; bp[o] += bv[o] * dt; bp[o + 1] += bv[o + 1] * dt; bp[o + 2] += bv[o + 2] * dt; if (bl[i] === 0) bp[o + 1] = 999; }
    L.wake.attributes.position.__inst.needsUpdate = true; L.wake.attributes.aL.__inst.needsUpdate = true;
    // die vier nächsten leuchtenden Stellen beleuchten ihre Umgebung
    tmp.length = 0; for (const gl of glows) { gl.d = Math.hypot(gl.x - sub.x, gl.y - sub.y, gl.z - sub.z) - gl.size * 2; if (gl.d < 90) tmp.push(gl); }
    tmp.sort((a, b) => a.d - b.d);
    for (let i = 0; i < 4; i++) { const gl = tmp[i]; if (!gl) { U.uGlow.value[i].w = 0; continue; } const fade = Math.min(1, (90 - gl.d) / 25); U.uGlow.value[i].set(gl.x, gl.y, gl.z, gl.power * fade * (0.92 + 0.08 * Math.sin(U.uTime.value * 0.7 + gl.x))); U.uGlowCol.value[i].set(gl.col[0], gl.col[1], gl.col[2]); }
  };
  return L;
}
