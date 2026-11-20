// obs.js – das versunkene Observatorium auf der Felsnadel im Süden von Atlantis.
// Das Gebäude kommt aus der Testszene (Bau im „Baumaß“, mit SC = 2,5 vergrößert) und ist hier an das Licht des Spiels angepasst:
// gleiche Sonne, gleiche Kaustiken, gleicher Nebel; innen hält die Wand Licht ab, Sonne fällt nur durch den Kuppelschlitz.
// Gebaut wird es erst, wenn man in die Nähe kommt. Für den Taucher gibt es eine eigene Begehung (Stufen, Boden, Treppe, Plattform,
// Wände mit Tür und Fenstern, Säulen, Möbel, Kuppel, Teleskop); das Boot stößt an Kugeln rund um den Bau.
import { T } from './util.js';
import { uni, COMMON, SUN } from './gfx.js';
import { rockSDF, OBSV } from './atlantis.js';
import { CAVE } from './cave.js';

export const SC = 2.5;
const B0 = new T.Vector3(OBSV.x, OBSV.top + 0.1, OBSV.z);
const UO = { uObsC: { value: B0 }, uObsS: { value: SC } };
const OBS = { base: B0.y, domeY: 6.7, domeR: 3.05 };
export const OBS_INFO = OBS;

// ---------- Licht für den Bau: wie shade() im Spiel, aber innen gedämpft und Sonne nur durch den Schlitz ----------
const OCOMMON = COMMON + /* glsl */ `
uniform vec3 uObsC; uniform float uObsS;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
float insideK(vec3 wp, out float slit){
  vec3 lp = (wp - uObsC) / uObsS; float r = length(lp.xz); slit = 0.0;
  if (r > 2.0 || lp.y < 0.9) return 0.0;
  vec3 o = lp - vec3(0.0, 6.7, 0.0); if (o.y > 0.0 && dot(o, o) > 3.0 * 3.0) return 0.0;
  vec3 s = normalize(uSunDir);
  vec2 atBase = lp.xz + s.xz / s.y * max(6.6 - lp.y, 0.0);
  float b = dot(o, s), c = dot(o, o) - 3.05 * 3.05, t = -b + sqrt(max(b * b - c, 0.0)); vec3 hp = o + s * t;
  slit = step(abs(hp.x), 0.9) * step(-0.3, hp.z) * step(length(atBase), 2.15);
  return 1.0 - smoothstep(1.92, 2.0, r);
}
vec3 obsLight(vec3 base, vec3 N, vec3 wp) {
  float sl; float ik = insideK(wp, sl);
  float lk = exp(wp.y * 0.0125), top = max(N.y, 0.0);
  top = (floor(top * 3.0) + smoothstep(0.3, 0.7, fract(top * 3.0))) / 3.0;
  float side = max(dot(N, uSunDir), 0.0);
  vec3 amb = vec3(0.020, 0.105, 0.225) * (0.45 + 0.55 * N.y) * (0.35 + 0.65 * lk);
  vec3 sun = vec3(0.10, 0.56, 0.95) * (top * 0.85 + side * 0.35) * lk * 1.15 * (0.75 + 1.05 * caustic(wp.xz + wp.y * 0.3) * smoothstep(0.15, 0.6, N.y) * (0.35 + 0.65 * smoothstep(-70.0, -25.0, wp.y)));
  amb *= mix(1.0, 0.55, ik); sun *= mix(1.0, sl * 1.25, ik);
  return base * (amb + sun + lights(wp, N)) * 1.3 + base * 0.035 * (1.0 - ik);
}`;
const VS = `varying vec3 vW, vN; varying vec3 vC;
attribute vec3 color;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; gl_Position = projectionMatrix * viewMatrix * w; }`;
let stoneMat = null, plantMat = null, rayMat = null;
function baseMats() {
  if (stoneMat) return;
  stoneMat = new T.ShaderMaterial({ uniforms: uni(UO), vertexShader: VS, extensions: { derivatives: true }, fragmentShader: `precision highp float; ${OCOMMON}
varying vec3 vW, vN, vC;
void main(){ vec3 N = normalize(mix(normalize(vN), normalize(cross(dFdx(vW), dFdy(vW))), 0.25));
  float n = vn(vW.xz * 1.7 + vW.y * 0.9), n2 = vn(vW.xy * 4.0 + vW.z);
  vec3 c = vC * (0.82 + 0.3 * n) * (0.92 + 0.12 * n2);
  gl_FragColor = vec4(fog(obsLight(c, N, vW) + vC * 0.04, vW), 1.0); }` });
  plantMat = new T.ShaderMaterial({ uniforms: uni(UO), side: T.DoubleSide, vertexShader: `uniform float uTime; varying vec3 vW, vN, vC; attribute vec3 color;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0);
    w.x += sin(uTime * 0.9 + w.z * 0.3 + w.x * 0.2) * uv.y * 0.35; w.z += cos(uTime * 0.7 + w.x * 0.25) * uv.y * 0.25;
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; ${OCOMMON}
  varying vec3 vW, vN, vC;
  void main(){ vec3 N = vec3(0.0, 1.0, 0.0); vec3 c = obsLight(vC, N, vW) * 0.85 + vC * 0.06; gl_FragColor = vec4(fog(c, vW), 1.0); }` });
  rayMat = new T.ShaderMaterial({ uniforms: uni(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `precision highp float; uniform float uTime; varying vec2 vU; varying vec3 vW;
    void main(){ float s = sin(vU.x * 3.1416); float fl = 0.55 + 0.45 * sin(uTime * 0.8 + vW.x * 0.15 + vW.z * 0.1);
      float a = s * s * pow(vU.y, 1.6) * fl * 0.13; a *= smoothstep(0.0, 6.0, length(vW - cameraPosition)) * exp(-length(vW - cameraPosition) * 0.02);
      gl_FragColor = vec4(vec3(0.55, 0.85, 1.0) * a, 1.0); }` });
}

// ---------- kleine Werkzeuge ----------
let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647, rr = (a, b) => a + R() * (b - a);
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const n2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v; };
function colorize(g, rgb) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(rgb, i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; }
function merge(list) {   // Zusammenführung (Position, Normale, Farbe, UV, aL = Ort im Bauteil für Holzmaserung), alle ohne Index
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), UV = new Float32Array(n * 2), L = new Float32Array(n * 3); let o = 0;
  for (const g of list) { const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); if (g.attributes.uv) UV.set(g.attributes.uv.array, o * 2); if (g.attributes.aL) L.set(g.attributes.aL.array, o * 3); o += c; }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(P, 3)); m.setAttribute('normal', new T.BufferAttribute(N, 3)); m.setAttribute('color', new T.BufferAttribute(C, 3)); m.setAttribute('uv', new T.BufferAttribute(UV, 2)); m.setAttribute('aL', new T.BufferAttribute(L, 3)); return m;
}
const ni = (g) => g.index ? g.toNonIndexed() : g;
function blade(x, y, z, h, w, col, bend) { const g = new T.PlaneGeometry(w, h, 1, 4); const p = g.attributes.position, a = R() * 6.28;
  for (let i = 0; i < p.count; i++) { const v = p.getY(i) / h + 0.5, bx = p.getX(i) * (1 - v * 0.8); const o = bend * v * v; p.setXYZ(i, x + Math.cos(a) * bx + Math.cos(a + 1.57) * o, y + v * h, z + Math.sin(a) * bx + Math.sin(a + 1.57) * o); }
  g.computeVertexNormals(); return colorize(ni(g), col); }

/** baut das ganze Observatorium (einmal), gibt die Gruppe zurück */
export function buildObservatory(scene) {
  baseMats();
  // ---------- das Observatorium ----------
  // Gebaut im „Baumaß“ und mit SC = 2,5 vergrößert: außen 24 m Durchmesser, gut 24 m hoch, Innenraum knapp 10 m breit und über 20 m hoch.
  // Große Teile (Stufen, Wand, Gebälk, Gesims) sind ganze, gemeißelte Ringe; die Kuppel trägt erhabene Platten; innen Säulen, Fenster, Treppe, Mechanik.
  const FL = 1.3;   // Fußboden innen
  const mkTex = (w, h, draw, bg = '#808080') => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); draw(g, w, h); const t = new T.CanvasTexture(cv); t.wrapS = T.RepeatWrapping; t.anisotropy = 4; return t; };
  const carve = (g, pts, w, closed) => { g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [col, dy] of [['#b8b8b8', w * 0.45], ['#2c2c2c', 0]]) { g.strokeStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y + dy) : g.moveTo(x, y + dy)); if (closed) g.closePath(); g.stroke(); } };
  const circ = (cx, cy, r, n = 24) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(i / n * 6.283) * r, cy + Math.sin(i / n * 6.283) * r]);
  const runeGlyphs = (g, x0, x1, y0, y1, w, stroke) => { let s = Math.round(x0 * 7 + y0) + 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let x = x0; x < x1 - 30; x += 58) { if (r() < 0.08) { stroke([[x + 4, (y0 + y1) / 2], [x + 18, y0 + 10], [x + 32, (y0 + y1) / 2], [x + 18, y1 - 10]], w, true); continue; }
      const n = 2 + Math.floor(r() * 3), pts = []; for (let k = 0; k < n; k++) pts.push([x + r() * 36, y0 + 6 + r() * (y1 - y0 - 12)]);
      stroke([[x + 6 + r() * 24, y0 + 4], [x + 6 + r() * 24, y1 - 4]], w); stroke(pts, w * 0.85); } };
  const runeTex = mkTex(2048, 128, (g) => { carve(g, [[0, 14], [2048, 14]], 3); carve(g, [[0, 114], [2048, 114]], 3); runeGlyphs(g, 30, 2048, 24, 104, 6, (p, w, c) => carve(g, p, w, c));
    for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(40,40,40,' + (0.15 + Math.random() * 0.3) + ')'; g.beginPath(); g.arc(Math.random() * 2048, Math.random() * 128, 3 + Math.random() * 12, 0, 6.3); g.fill(); } });
  const meanderTex = mkTex(1024, 64, (g) => { for (let x = 0; x < 1024; x += 64) carve(g, [[x, 50], [x, 14], [x + 40, 14], [x + 40, 38], [x + 18, 38], [x + 18, 26]], 5); });
  // Relieftafeln (4 Szenen nebeneinander, je 512 × 768): Wellen, Sonne, Fische, Gestalten, Sterne, Teleskop
  const reliefTex = mkTex(2048, 768, (g) => { let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let p = 0; p < 4; p++) { const x0 = p * 512 + 40, x1 = x0 + 432, y0 = 60, y1 = 708; carve(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 10, true); carve(g, [[x0 + 18, y0 + 18], [x1 - 18, y0 + 18], [x1 - 18, y1 - 18], [x0 + 18, y1 - 18]], 4, true);
      const wave = (y) => { const pts = []; for (let x = x0 + 30; x <= x1 - 30; x += 8) pts.push([x, y + Math.sin(x * 0.06) * 12]); carve(g, pts, 5); };
      wave(620); wave(648);
      if (p === 0 || p === 2) { const cx = x0 + 216; carve(g, circ(cx, 210, 54, 32), 6); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; carve(g, [[cx + Math.cos(a) * 68, 210 + Math.sin(a) * 68], [cx + Math.cos(a) * 96, 210 + Math.sin(a) * 96]], 5); } }
      else if (p === 1) { for (let k = 0; k < 3; k++) { const fx = x0 + 100 + k * 120, fy = 190 + (k % 2) * 70; carve(g, [[fx - 40, fy], [fx, fy - 20], [fx + 32, fy], [fx, fy + 20], [fx - 40, fy], [fx - 58, fy - 18], [fx - 58, fy + 18], [fx - 40, fy]], 5, true); } }
      else { carve(g, [[x0 + 120, 330], [x0 + 330, 160]], 22); carve(g, [[x0 + 210, 270], [x0 + 180, 420], [x0 + 240, 420], [x0 + 210, 270]], 6, true); carve(g, circ(x0 + 330, 160, 18), 5); }
      for (let k = 0; k < 3; k++) { const fx = x0 + 100 + k * 115, fy = 470; carve(g, circ(fx, fy - 64, 17, 16), 5); carve(g, [[fx, fy - 46], [fx, fy + 36]], 6); carve(g, [[fx - 34, fy - 12], [fx, fy - 30], [fx + 36, fy - 6]], 5); carve(g, [[fx - 22, fy + 90], [fx, fy + 36], [fx + 22, fy + 90]], 5); }
      for (let k = 0; k < 16; k++) { const x = x0 + 34 + r() * 360, y = 90 + r() * 70; carve(g, [[x - 6, y], [x + 6, y]], 3); carve(g, [[x, y - 6], [x, y + 6]], 3); } }
    for (let k = 0; k < 110; k++) { g.fillStyle = 'rgba(40,40,40,' + (0.1 + r() * 0.3) + ')'; g.beginPath(); g.arc(r() * 2048, r() * 768, 4 + r() * 22, 0, 6.3); g.fill(); } });
  // leuchtende Runen innen: weiß auf schwarz (nur die Maske)
  const glowTex = mkTex(2048, 128, (g) => { const st = (pts, w, closed) => { g.strokeStyle = '#fff'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (closed) g.closePath(); g.stroke(); };
    runeGlyphs(g, 20, 2048, 22, 106, 5, st); }, '#000');
  // Globus: Meer und erfundene Kontinente auf altem Papier, Gradnetz
  const mapTex = mkTex(1024, 512, (g, w, h) => { g.fillStyle = '#2d6170'; g.fillRect(0, 0, w, h); let s = 21; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let c = 0; c < 7; c++) { const cx = r() * w, cy = 90 + r() * (h - 180); for (let k = 0; k < 40; k++) { g.fillStyle = k % 9 ? '#c8b07a' : '#a8905c'; g.beginPath(); g.ellipse(cx + (r() - 0.5) * 220, cy + (r() - 0.5) * 120, 18 + r() * 40, 14 + r() * 30, r() * 3, 0, 6.3); g.fill(); } }
    g.strokeStyle = 'rgba(240,225,180,0.45)'; g.lineWidth = 2; for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 32; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let k = 0; k < 400; k++) { g.fillStyle = 'rgba(30,30,20,' + r() * 0.15 + ')'; g.fillRect(r() * w, r() * h, 3, 3); } }, '#2d6170');
  // Pergament: Sternkarte mit Kreisen, Linien und Schrift
  const paperTex = mkTex(512, 512, (g, w, h) => { let s = 33; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const grd = g.createRadialGradient(256, 256, 60, 256, 256, 360); grd.addColorStop(0, '#d9c79c'); grd.addColorStop(1, '#9c8452'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,45,20,0.8)'; g.lineWidth = 2; for (const rr0 of [80, 150, 200]) { g.beginPath(); g.arc(256, 256, rr0, 0, 6.3); g.stroke(); }
    const st = []; for (let k = 0; k < 40; k++) st.push([60 + r() * 392, 60 + r() * 392]); g.fillStyle = 'rgba(60,35,15,0.9)'; for (const [x, y] of st) { g.beginPath(); g.arc(x, y, 2 + r() * 3, 0, 6.3); g.fill(); }
    g.beginPath(); for (let k = 0; k < 12; k++) { const a = st[k], b = st[k + 1]; g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
    g.lineWidth = 1.5; for (let y = 20; y < 50; y += 8) { g.beginPath(); g.moveTo(30, y); g.lineTo(30 + r() * 200, y); g.stroke(); } for (let y = 470; y < 500; y += 8) { g.beginPath(); g.moveTo(280, y); g.lineTo(280 + r() * 200, y); g.stroke(); } });

  // ---------- Material für alle Bauteile ----------
  // 0 Stein, 1 Bronze, 2 Eisen, 3 dunkel, 4 Stein mit gemeißelter Textur, 8 Stein mit leuchtenden Runen, 9 Holz (Maserung aus aL), 10 Farbtextur, 11 Bodenfliesen, 12 Ton, 13 leuchtende Linse
  function archMat(kind, tex) {
    return new T.ShaderMaterial({ uniforms: uni(Object.assign({}, UO, { uKind: { value: kind }, uTex: { value: tex || runeTex }, uC: { value: B0 }, uS: { value: SC } })),
      vertexShader: VS.replace('void main(){', 'attribute vec3 aL; varying vec3 vL; varying vec2 vUv; void main(){ vUv = uv; vL = aL;'), extensions: { derivatives: true }, side: T.DoubleSide,
      fragmentShader: `precision highp float; ${OCOMMON}
      uniform float uKind, uS; uniform sampler2D uTex; uniform vec3 uC; varying vec3 vW, vN, vC, vL; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }
      void main(){
        vec3 Nf = normalize(cross(dFdx(vW), dFdy(vW))), N = normalize(vN); if (dot(N, Nf) < 0.0) N = -N; if (dot(N, normalize(cameraPosition - vW)) < 0.0 && dot(Nf, normalize(cameraPosition - vW)) > 0.0) N = Nf; N = normalize(mix(N, Nf, 0.06));
        vec3 lp = (vW - uC) / uS, p = lp * 3.0;
        float n = vn(p.xz + p.y * 0.7), n2 = vn(p.xy * 3.1 + p.z * 1.7), n3 = vn(lp.yz * 5.0 + lp.x);
        vec3 stone = vec3(0.80, 0.77, 0.68) * (0.80 + 0.28 * n) * (0.93 + 0.1 * n2);
        float cr = abs(vn(lp.xz * 1.7 + lp.y * 1.3) - 0.5); stone *= 1.0 - 0.6 * (1.0 - smoothstep(0.0, 0.016, cr)) * smoothstep(0.55, 0.7, vn(lp.xy * 0.8 + 3.0));
        stone *= 1.0 - 0.18 * smoothstep(0.7, 0.9, n3);
        stone = mix(stone, vec3(0.42, 0.40, 0.33), smoothstep(0.62, 0.85, vn(lp.xz * 0.6 + lp.y * 0.4)) * 0.35);
        float pat = smoothstep(0.35, 0.7, vn(lp.xz * 1.2 + lp.y * 2.0) * 0.7 + n2 * 0.4);
        vec3 bronze = mix(vec3(0.46, 0.31, 0.18), vec3(0.30, 0.62, 0.55), pat) * (0.8 + 0.3 * n);
        vec3 c; float spec = 0.0, alg = 1.0; vec3 emit = vec3(0.0);
        if (uKind < 0.5) c = stone;
        else if (uKind < 1.5) { c = mix(bronze, vec3(0.62, 0.45, 0.25), smoothstep(0.8, 0.95, n3) * 0.5); spec = 0.55 * (1.0 - pat); }
        else if (uKind < 2.5) { c = mix(vec3(0.22, 0.22, 0.21), vec3(0.42, 0.24, 0.13), smoothstep(0.4, 0.75, n * 0.6 + n2 * 0.5)) * (0.85 + 0.25 * n3); spec = 0.35; }
        else if (uKind < 3.5) { c = vec3(0.07, 0.08, 0.08) * (0.8 + 0.4 * n); alg = 0.0; }
        else if (uKind < 4.5) { float t = texture2D(uTex, vUv).r; c = stone * (0.45 + 1.1 * t); }
        else if (uKind < 8.5) { float t = texture2D(uTex, vUv).r; c = stone * (1.0 - 0.55 * t); emit = vec3(0.25, 0.95, 0.85) * t * (0.75 + 0.25 * sin(uTime * 1.3 + vUv.x * 30.0)); alg = 0.3; }
        else if (uKind < 9.5) {   // Holz: Jahresringe um die Längsachse (x im Bauteil), Fasern, dunkel vom Wasser
          vec3 l = vL * 9.0; float ring = fract(length(l.yz + vec2(3.7, 1.3) + (vn(l.xy * 0.4) - 0.5) * 1.6) * 1.6 + vn(vec2(l.x * 0.18, l.z)) * 1.2);
          float fib = vn(vec2(l.x * 0.6, (l.y + l.z) * 14.0));
          c = mix(vec3(0.24, 0.15, 0.09), vec3(0.45, 0.31, 0.18), smoothstep(0.15, 0.85, ring)) * (0.78 + 0.35 * fib) * vec3(0.92, 0.95, 0.9); alg = 0.7; }
        else if (uKind < 10.5) { c = texture2D(uTex, vUv).rgb * (0.85 + 0.2 * n); alg = 0.25; }
        else if (uKind < 11.5) {   // Bodenfliesen: große Platten, Fugen, einzelne gesprungen, Sand in den Ecken
          vec2 q = lp.xz / 0.62; vec2 id = floor(q), f = fract(q); float hv = h21(id);
          float seam = 1.0 - smoothstep(0.02, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
          float crk = (1.0 - smoothstep(0.0, 0.02, abs(f.x - f.y * (0.3 + hv) - 0.2 * hv))) * step(0.7, hv);
          c = stone * (0.82 + 0.3 * hv) * (1.0 - 0.6 * seam) * (1.0 - 0.5 * crk);
          c = mix(c, vec3(0.78, 0.72, 0.58), smoothstep(0.5, 0.8, vn(lp.xz * 1.3 + 4.0)) * 0.6); }
        else if (uKind < 12.5) { c = mix(vec3(0.55, 0.30, 0.17), vec3(0.70, 0.45, 0.28), n) * (0.85 + 0.2 * n2); spec = 0.1; }
        else { c = vec3(0.2, 0.4, 0.4); emit = vec3(0.35, 0.95, 0.95) * (0.7 + 0.3 * sin(uTime * 2.0)); alg = 0.0; }
        c *= vC;
        float algae = smoothstep(0.55, 0.9, N.y) * smoothstep(0.38, 0.7, vn(lp.xz * 1.6 + 7.0)) + smoothstep(0.66, 0.9, vn(vec2(lp.x + lp.z, lp.y * 0.5) * 1.4)) * 0.45 * (1.0 - abs(N.y));
        c = mix(c, mix(vec3(0.17, 0.30, 0.13), vec3(0.28, 0.40, 0.17), n2), clamp(algae, 0.0, 1.0) * 0.75 * alg);
        vec3 lit = obsLight(c, N, vW) + emit;
        vec3 V = normalize(cameraPosition - vW), H = normalize(V + uSunDir); lit += spec * pow(max(dot(N, H), 0.0), 30.0) * vec3(0.5, 0.55, 0.5) * (vW.y > 0.0 ? 1.0 : 0.4);
        gl_FragColor = vec4(fog(lit, vW), 1.0);
      }` });
  }

  // ---------- Werkzeuge ----------
  const GEO = {}; const geoList = (k) => (GEO[k] || (GEO[k] = []));
  function put(kind, g, tint = 1, ao = null) {
    g = ni(g); const n = g.attributes.position.count, a = new Float32Array(n * 3), P = g.attributes.position;
    for (let i = 0; i < n; i++) { let k = tint; if (ao) k *= ao(P.getY(i), P.getX(i), P.getZ(i)); a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = k; }
    g.setAttribute('color', new T.BufferAttribute(a, 3)); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals();
    geoList(kind).push(g); return g;
  }
  const jit = (g, s, amt = 0.025) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + (h2(i, 1.7 + s) - 0.5) * amt, P.getY(i) + (h2(i, 3.1 + s) - 0.5) * amt * 0.8, P.getZ(i) + (h2(i, 5.3 + s) - 0.5) * amt); g.computeVertexNormals(); return g; };
  function smoothJ(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // Ring aus einem Stück (Profil um die Achse gezogen), mit Ausbrüchen an den Außenkanten und feiner Unebenheit; Normalen aus dem Profil
  function ringPiece(profile, o = {}) {
    const a0 = o.a0 ?? 0, a1 = o.a1 ?? 6.2832, full = o.a1 === undefined, N = o.n ?? 160, rOut = Math.max(...profile.map((q) => q[0])), yTop = Math.max(...profile.map((q) => q[1])), rIn = Math.min(...profile.map((q) => q[0]));
    seed = o.seed ?? 1; const dents = []; for (let i = 0; i < (o.dents ?? 8); i++) dents.push([rr(a0, a1), rr(0.04, 0.22), rr(0.4, 1)]);
    const dent = (a) => { let d = 0; for (const [c, w, s] of dents) { let x = Math.abs(a - c); x = Math.min(x, 6.2832 - x); d = Math.max(d, s * (1 - smoothJ(0, w, x)) * (0.7 + 0.3 * n2(a * 40, c))); } return d; };
    const depth = o.depth ?? 0.15, drop = o.drop ?? 0.08, rough = o.rough ?? 0.007;
    const pt = (q, a) => { let [r, y] = q; const d = dent(a), wOut = smoothJ(rIn + (rOut - rIn) * 0.55, rOut, r), wTop = smoothJ(yTop - 0.35, yTop, y);
      r -= depth * d * wOut * (0.6 + 0.4 * wTop); y -= drop * d * wTop * wOut;
      r += (n2(a * 30 + y * 3, y * 9 + r) - 0.5) * rough * 2; y += (n2(a * 25 + r * 7, r * 5) - 0.5) * rough;
      return [Math.cos(a) * r, y, Math.sin(a) * r]; };
    const P = [], NN = [], push = (v, nv) => { P.push(v[0], v[1], v[2]); NN.push(nv[0], nv[1], nv[2]); };
    for (let i = 0; i < N; i++) { const aa = a0 + (a1 - a0) * i / N, ab = a0 + (a1 - a0) * (i + 1) / N;
      for (let j = 0; j < profile.length; j++) { const q0 = profile[j], q1 = profile[(j + 1) % profile.length], dr = q1[0] - q0[0], dy = q1[1] - q0[1], l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l;
        const na = [nr * Math.cos(aa), ny, nr * Math.sin(aa)], nb = [nr * Math.cos(ab), ny, nr * Math.sin(ab)];
        const A = pt(q0, aa), Bv = pt(q1, aa), Cv = pt(q1, ab), D = pt(q0, ab); push(A, na); push(Cv, nb); push(D, nb); push(A, na); push(Bv, na); push(Cv, nb); } }
    if (!full) for (const aa of [a0, a1]) { const tri = T.ShapeUtils.triangulateShape(profile.map((q) => new T.Vector2(q[0], q[1])), []), flip = aa === a0, s = flip ? 1 : -1, nc = [s * Math.sin(aa), 0, -s * Math.cos(aa)];
      for (const t of tri) { const vs = t.map((k) => pt(profile[k], aa)); if (flip) vs.reverse(); vs.forEach((v) => push(v, nc)); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(NN, 3)); return g;
  }
  const rubbleList = []; const rubble = (x, z, s, y) => rubbleList.push([x, z, s, y]);
  // Holzteil: Länge entlang x; aL merkt sich den Ort im Teil, damit die Maserung mitwandert
  function wbox(len, h, d) { const g = ni(new T.BoxGeometry(len, h, d, Math.max(1, Math.round(len * 6)), 1, 1)); g.setAttribute('aL', new T.BufferAttribute(g.attributes.position.array.slice(), 3)); return g; }
  function wcyl(r, len, seg = 10) { const g = ni(new T.CylinderGeometry(r, r, len, seg, 1)); g.rotateZ(Math.PI / 2); g.setAttribute('aL', new T.BufferAttribute(g.attributes.position.array.slice(), 3)); return g; }
  const place = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
  // Zahnrad als echte Scheibe mit Zähnen, Nabe und Speichenlöchern (in der x-y-Ebene, Dicke entlang z)
  function gearGeo(r, teeth, th, holes = 4) {
    const s = new T.Shape(), rt = r, rb = r * 0.86;
    for (let k = 0; k < teeth; k++) { const a = k / teeth * 6.2832, w = 6.2832 / teeth;
      const pts = [[rb, a], [rb, a + w * 0.12], [rt, a + w * 0.28], [rt, a + w * 0.52], [rb, a + w * 0.68]];
      pts.forEach(([rr0, aa], i) => { const x = Math.cos(aa) * rr0, y = Math.sin(aa) * rr0; if (k === 0 && i === 0) s.moveTo(x, y); else s.lineTo(x, y); }); }
    s.closePath();
    const hole = (cx, cy, hr) => { const p = new T.Path(); p.absarc(cx, cy, hr, 0, 6.2832, true); s.holes.push(p); };
    hole(0, 0, r * 0.12); for (let k = 0; k < holes; k++) { const a = k / holes * 6.2832 + 0.4; hole(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.2); }
    const g = new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: true, bevelThickness: th * 0.12, bevelSize: th * 0.12, bevelSegments: 1, curveSegments: 10 }); g.translate(0, 0, -th / 2); return ni(g);
  }
  // Kette: Glieder abwechselnd gedreht entlang einer leicht durchhängenden Linie
  function chain(a, b, link, sag, kind = 2) {
    const n = Math.max(2, Math.round(a.distanceTo(b) / (link * 1.6)));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; const q = a.clone().lerp(b, t + 0.01); q.y -= Math.sin((t + 0.01) * Math.PI) * sag;
      const g = new T.TorusGeometry(link, link * 0.28, 5, 10); g.scale(1, 1.6, 1); const dir = q.sub(p).normalize(); g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir)));
      if (i % 2) g.applyMatrix4(new T.Matrix4().makeRotationAxis(dir, Math.PI / 2)); g.translate(p.x, p.y, p.z); put(kind, g, 0.85); }
  }
  // Bauteil an einer Stelle der Wand ausrichten: x = tangential, y = oben, z = nach außen
  const atWall = (g, a, r, y) => { const t = new T.Vector3(-Math.sin(a), 0, Math.cos(a)), up = new T.Vector3(0, 1, 0), out = new T.Vector3(Math.cos(a), 0, Math.sin(a)); g.applyMatrix4(new T.Matrix4().makeBasis(t, up, out)); g.translate(out.x * r, y, out.z * r); return g; };

  // ---------- 1) Unterbau: Ringe aus einem Stück, oben große Bodenplatten ohne Spalt ----------
  put(0, ringPiece([[3.9, -0.6], [4.8, -0.6], [4.8, -0.02], [4.72, 0.05], [3.9, 0.05]], { seed: 11, dents: 16, depth: 0.45, drop: 0.2, n: 180 }), 0.9);
  put(0, ringPiece([[3.2, -0.05], [4.15, -0.05], [4.15, 0.52], [4.07, 0.6], [3.2, 0.6]], { seed: 12, dents: 11, depth: 0.3, drop: 0.14 }), 0.95);
  put(0, (() => { const g = new T.CylinderGeometry(3.86, 3.86, 0.72, 64); g.translate(0, 0.94, 0); return g; })(), 0.6);
  { seed = 13; const n = 9, off = 0.2;
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832 + off, a1 = (i + 1) / n * 6.2832 + off, dy = rr(-0.025, 0.02);
      put(0, ringPiece([[2.3, 0.6], [3.9, 0.6], [3.9, 1.24 + dy], [3.84, 1.3 + dy], [2.3, 1.3 + dy]], { a0, a1, n: 18, seed: 300 + i, dents: i % 3 === 0 ? 2 : 1, depth: 0.25, drop: 0.08, rough: 0.012 }), 0.9 + 0.12 * R()); } }
  put(11, (() => { const g = new T.CylinderGeometry(2.32, 2.32, 0.1, 64); g.translate(0, FL - 0.05, 0); return g; })(), 0.95);   // Fliesenboden innen

  // ---------- 2) Cellawand: Ring mit Sockel, Tür im Westen, sechs Rundbogenfenster, Relieftafeln außen, leuchtende Runen innen ----------
  const NC = 14, CR = 3.15, SLOT = 6.2832 / NC, slotA = (k) => (k + 0.5) * SLOT + 0.11;
  const DOOR = slotA(6), DW = 0.19, WINS = [8, 10, 12, 0, 2, 4], WH = 0.16, SILL = 2.3, WTOP = 3.75, DTOP = 4.25, WI = 1.95, WO = 2.36;
  const openings = [[DOOR - DW, DOOR + DW, 'door'], ...WINS.map((k) => [slotA(k) - WH, slotA(k) + WH, 'win'])].sort((p, q) => ((p[0] + 6.2832) % 6.2832) - ((q[0] + 6.2832) % 6.2832));
  const wallProf = (y0, y1, base) => base ? [[WI, y0], [2.48, y0], [2.48, y0 + 0.16], [WO, y0 + 0.28], [WO, y1], [WI, y1]] : [[WI, y0], [WO, y0], [WO, y1], [WI, y1]];
  const wallAO = (y) => 0.66 + 0.32 * Math.min(1, (y - FL) / 3.7);
  { const norm = (a) => ((a % 6.2832) + 6.2832) % 6.2832; const ops = openings.map(([a, b, t]) => [norm(a), norm(a) + (b - a), t]).sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < ops.length; i++) { const [, e] = ops[i], [s2] = ops[(i + 1) % ops.length], a0 = e, a1 = i + 1 < ops.length ? s2 : s2 + 6.2832;
      put(0, ringPiece(wallProf(FL, 5.03, true), { a0, a1, n: Math.max(8, Math.round((a1 - a0) * 50)), seed: 40 + i, dents: 1, depth: 0.06, drop: 0, rough: 0.01 }), 0.95, wallAO); }
    for (const [a, b, t] of ops) {
      if (t === 'win') { put(0, ringPiece(wallProf(FL, SILL, true), { a0: a, a1: b, n: 12, seed: 60 + a, dents: 1, depth: 0.08, drop: 0.03 }), 0.93, wallAO);
        put(0, ringPiece(wallProf(WTOP + 0.4, 5.03, false), { a0: a, a1: b, n: 12, seed: 70 + a, dents: 0 }), 0.95, wallAO);
        const ac = (a + b) / 2, w = Math.sin(WH) * 2.15;
        { const s = new T.Shape(); s.moveTo(-w, 0); s.absarc(0, 0, w, Math.PI, 0, true); s.lineTo(w, 0.4); s.lineTo(-w, 0.4); s.closePath();   // Bogenfeld über dem Fenster
          const g = new T.ExtrudeGeometry(s, { depth: WO - WI, bevelEnabled: false, curveSegments: 14 }); put(0, atWall(ni(g), ac, WI, WTOP), 0.93, wallAO); }
        for (const rad of [WO + 0.02, WI - 0.02]) { const g = new T.TorusGeometry(w + 0.05, 0.05, 6, 20, Math.PI); put(0, atWall(g, ac, rad, WTOP), 0.9); }   // Bogenrahmen innen und außen
        { const g = new T.BoxGeometry(w * 2 + 0.2, 0.08, WO - WI + 0.16); g.translate(0, 0, (WO - WI) / 2); put(0, jit(atWall(g, ac, WI, SILL + 0.04), ac, 0.015), 0.9); } }   // Fensterbank
      else { const ac = (a + b) / 2, w = Math.sin(DW) * 2.15;
        put(0, ringPiece(wallProf(DTOP, 5.03, false), { a0: a, a1: b, n: 12, seed: 80, dents: 0 }), 0.95, wallAO);
        { const g = new T.BoxGeometry(w * 2 + 0.5, 0.42, WO - WI + 0.22); g.translate(0, 0.21, (WO - WI) / 2); put(0, jit(atWall(g, ac, WI - 0.03, DTOP), 7, 0.02), 0.95); }   // Sturz
        for (const s of [-1, 1]) { const g = new T.BoxGeometry(0.16, DTOP - FL, WO - WI + 0.18); g.translate(s * (w + 0.06), (DTOP - FL) / 2, (WO - WI) / 2); put(0, jit(atWall(g, ac, WI - 0.02, FL), s + 9, 0.015), 0.9); }   // Gewände
        { const g = new T.BoxGeometry(w * 2 + 0.3, 0.06, WO - WI + 0.4); g.translate(0, 0, (WO - WI) / 2); put(0, atWall(g, ac, WI - 0.1, FL + 0.03), 0.85); } } }   // Schwelle
    // Relieftafeln außen und innen zwischen den Öffnungen (in den Säulenfeldern); Three-Zylinderwinkel: θ = π/2 − a
    for (const k of [7, 9, 11, 13, 1, 3, 5]) { const ac = slotA(k), hw = 0.17;
      for (const [rad, y0, h] of [[WO + 0.008, 2.2, 1.95], [WI - 0.008, 2.0, 2.2]]) { const g = new T.CylinderGeometry(rad, rad, h, 20, 1, true, Math.PI / 2 - ac - hw, 2 * hw); g.translate(0, y0 + h / 2, 0);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (rad > 2 ? uv.getX(i) : 1 - uv.getX(i)) * 0.25 + (k % 4) * 0.25); put(7, g, 0.95); } }
    // innen: Gesims über den Innensäulen und ein umlaufendes Band leuchtender Runen
    put(0, ringPiece([[1.66, 5.0], [WI + 0.01, 5.0], [WI + 0.01, 5.22], [1.6, 5.22], [1.6, 5.13], [1.66, 5.08]], { seed: 90, dents: 7, depth: 0.12, drop: 0.05 }), 0.9);
    { const g = new T.CylinderGeometry(WI - 0.006, WI - 0.006, 0.36, 160, 1, true); g.translate(0, 4.68, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 2); put(8, g, 1.0); }
  }

  // ---------- 3) Säulen: massive attische Basis (eine Drehform), kannelierter Schaft, korinthisches Kapitell; außen 14, innen 7 schlankere ----------
  function column(a, R, k, o = {}) {
    const cx = Math.cos(a) * R, cz = Math.sin(a) * R, lean = o.lean || 0, sid = Math.round(a * 100) + (k < 1 ? 7 : 0);
    const pl = new T.BoxGeometry(0.74 * k, 0.14, 0.74 * k); pl.rotateY(-a); pl.translate(cx, FL + 0.07, cz); put(0, jit(pl, sid, 0.02), 0.92);
    const bp = [[0, 1.44], [0.37, 1.44], [0.385, 1.47], [0.385, 1.53], [0.355, 1.565], [0.315, 1.575], [0.3, 1.6], [0.33, 1.625], [0.335, 1.665], [0.3, 1.7], [0.275, 1.725], [0, 1.725]];
    { const g = new T.LatheGeometry(bp.map(([r, y]) => new T.Vector2(r * k, y)), 40); g.translate(cx, 0, cz); put(0, g, 0.95); }   // Basis: Wulst, Kehle, Wulst in einem Stück, fest auf der Plinthe
    const yb = 1.72, yt = 4.6, h = yt - yb, g = new T.CylinderGeometry(1, 1, h, 48, o.broken ? 70 : 14, true), P = g.attributes.position;
    const yc = (an) => 3.05 + 0.16 * Math.sin(an + 0.7) + (n2(an * 5, sid) - 0.5) * 0.08;   // Bruchlinie, schräg und zackig
    for (let q = 0; q < P.count; q++) { const x = P.getX(q), z = P.getZ(q), yy = P.getY(q) + h / 2 + yb, an = Math.atan2(z, x), t = (yy - yb) / h;
      let r = 0.27 * k * (1 - 0.13 * t + 0.05 * Math.sin(Math.PI * t)) * (1 - 0.065 * Math.pow(Math.abs(Math.cos(10 * an)), 0.7));
      r *= 1 - 0.06 * Math.max(0, n2(an * 3 + sid, yy * 2) - 0.6) * 4;
      let sx = 0, sz = 0;
      if (o.broken) { const d = yy - yc(an); r *= 1 - 0.2 * Math.exp(-((d / 0.03) ** 2)); r *= 1 - 0.28 * Math.exp(-((d / 0.09) ** 2)) * Math.max(0, Math.cos(an - 1.2)) ** 3;
        if (d > 0) { sx = 0.03 * Math.cos(a + 1.3); sz = 0.03 * Math.sin(a + 1.3); } }
      P.setXYZ(q, x * r + cx + lean * (yy - yb) * Math.cos(a) + sx, yy, z * r + cz + lean * (yy - yb) * Math.sin(a) + sz); }
    g.computeVertexNormals(); put(0, g, 0.95, (y) => 0.8 + 0.2 * Math.min(1, (y - 1.7) / 3));
    const ox = cx + lean * h * Math.cos(a), oz = cz + lean * h * Math.sin(a);
    { const t = new T.TorusGeometry(0.245 * k, 0.035 * k, 6, 28); t.rotateX(Math.PI / 2); t.translate(ox, yt, oz); put(0, t, 0.95); }
    const prof = [[0.235, 4.6], [0.245, 4.66], [0.26, 4.74], [0.28, 4.83], [0.31, 4.92], [0.34, 4.99], [0.0, 4.99]];
    const kel = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r * k, y)), 48), KP = kel.attributes.position;
    for (let q = 0; q < KP.count; q++) { const x = KP.getX(q), y = KP.getY(q), z = KP.getZ(q), r = Math.hypot(x, z); if (r < 0.01) { KP.setXYZ(q, ox, y, oz); continue; } const an = Math.atan2(z, x) - a;
      const t1 = Math.max(0, Math.cos(8 * an)) ** 2 * smoothJ(4.6, 4.7, y) * (1 - smoothJ(4.8, 4.86, y)), t2 = Math.max(0, Math.cos(8 * an + Math.PI)) ** 2 * smoothJ(4.7, 4.8, y) * (1 - smoothJ(4.93, 4.98, y));
      const nr = r + (0.05 * t1 + 0.06 * t2) * k; KP.setXYZ(q, x / r * nr + ox, y, z / r * nr + oz); }
    kel.computeVertexNormals(); put(0, kel, 0.95);
    for (let q = 0; q < 4; q++) { const an = a + Math.PI / 4 + q * Math.PI / 2, v = new T.TorusGeometry(0.05 * k, 0.025 * k, 6, 12); v.rotateY(-an + Math.PI / 2); v.translate(ox + Math.cos(an) * 0.33 * k, 4.97, oz + Math.sin(an) * 0.33 * k); put(0, v, 0.92); }
    for (let q = 0; q < 4; q++) { const an = a + q * Math.PI / 2, s = new T.SphereGeometry(0.045 * k, 6, 5); s.translate(ox + Math.cos(an) * 0.29 * k, 5.0, oz + Math.sin(an) * 0.29 * k); put(0, s, 0.9); }
    const ab = new T.CylinderGeometry(0.42 * k, 0.4 * k, 0.09, 4, 1); ab.rotateY(Math.PI / 4 - a); ab.translate(ox, 5.04, oz); if (o.cracked) { ab.translate(Math.cos(a) * 0.04, -0.01, Math.sin(a) * 0.04); rubble(cx * 1.3, cz * 1.3, 0.2); } put(0, jit(ab, sid + 50, 0.02), 0.95);
    if (o.broken && R > 2) { rubble(cx * 1.27, cz * 1.27, 0.2); rubble(cx * 1.33 + 0.3, cz * 1.3, 0.14); }
  }
  for (let i = 0; i < NC; i++) column(i / NC * 6.2832 + 0.11, CR, 1, { broken: i === 4, cracked: i === 10, lean: i === 10 ? 0.02 : 0 });
  for (const k of [7, 9, 11, 13, 1, 3, 5]) column(slotA(k), 1.7, 0.7, { broken: k === 11 });

  // ---------- 4) Gebälk: Architrav, Fries mit Runen, Gesims mit Ausbrüchen, Ring unter der Kuppel ----------
  put(0, ringPiece([[2.2, 5.06], [3.45, 5.06], [3.45, 5.3], [3.53, 5.33], [3.53, 5.58], [2.2, 5.58]], { seed: 31, dents: 12, depth: 0.16, drop: 0.08, n: 180 }), 0.92);
  put(0, ringPiece([[2.3, 5.58], [3.42, 5.58], [3.42, 6.12], [2.3, 6.12]], { seed: 32, dents: 4, depth: 0.04, drop: 0.0 }), 0.9);
  { const g = new T.CylinderGeometry(3.445, 3.445, 0.5, 128, 1, true); g.translate(0, 5.86, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3); put(4, g, 1.0); }
  put(0, ringPiece([[2.4, 6.12], [3.5, 6.12], [3.6, 6.17], [3.62, 6.22], [3.92, 6.29], [3.95, 6.36], [3.9, 6.42], [2.4, 6.42]], { seed: 34, dents: 18, depth: 0.42, drop: 0.16, n: 200 }), 0.95);
  put(0, ringPiece([[2.6, 6.42], [3.6, 6.42], [3.6, 6.5], [3.5, 6.56], [2.6, 6.56]], { seed: 35, dents: 9, depth: 0.2, drop: 0.07 }), 0.9);

  // ---------- 5) Kuppel: Bronzering mit Mäander, Schale, erhabene Platten (unten Bronze, oben Stein), Rippen, Bänder, Schienen am Schlitz ----------
  const DC = OBS.domeY, DR = OBS.domeR, SLW = 0.92;
  const inSlit = (x, y, z) => Math.abs(x) < SLW && z > -0.35;   // relativ zum Kuppelmittelpunkt; der Schlitz läuft gerade über den Scheitel
  { const g = new T.CylinderGeometry(3.2, 3.25, 0.2, 128, 1, true); g.translate(0, 6.62, 0); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 6); put(5, g, 1.0); }
  put(2, ringPiece([[2.95, 6.52], [3.14, 6.52], [3.14, 6.74], [2.95, 6.74]], { seed: 36, dents: 0, n: 96 }), 0.9);   // Eisenring (offen, keine Platte)
  function cutSlit(g, r0) { g = ni(g); const P = g.attributes.position, keep = [];
    for (let i = 0; i < P.count; i += 3) { let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += P.getX(i + k); cy += P.getY(i + k); cz += P.getZ(i + k); } if (!inSlit(cx / 3, cy / 3 - r0, cz / 3)) for (let k = 0; k < 3; k++) keep.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k)); }
    const o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); o.computeVertexNormals(); return o; }
  { const g = new T.SphereGeometry(DR, 96, 32, 0, 6.2832, 0, Math.PI / 2); g.translate(0, DC, 0); put(0, cutSlit(g, DC), 0.42); }   // Schale (dunkel: sie ist in den Fugen zu sehen)
  const dp = (phi, el, r = DR) => new T.Vector3(Math.cos(phi) * Math.cos(el) * r, DC + Math.sin(el) * r, Math.sin(phi) * Math.cos(el) * r);
  { seed = 77; const ROWS = [[0.02, 0.3, 26, 'b'], [0.3, 0.58, 24, 'b'], [0.58, 0.86, 20, 'm'], [0.86, 1.12, 16, 's'], [1.12, 1.36, 11, 's'], [1.36, 1.54, 6, 's']];
    for (const [e0, e1, n, kind] of ROWS) for (let j = 0; j < n; j++) {
      const p0 = j / n * 6.2832 + e0 * 0.9, p1 = (j + 1) / n * 6.2832 + e0 * 0.9, rr0 = DR + 0.07 + (R() - 0.5) * 0.025;
      const g = new T.SphereGeometry(rr0, 6, 3, p0 + 0.012, p1 - p0 - 0.024, Math.PI / 2 - e1 + 0.012, e1 - e0 - 0.024); g.rotateY(Math.PI); g.translate(0, DC, 0);
      const c = cutSlit(g, DC); if (!c.attributes.position.count) continue;
      const bronze = kind === 'b' || (kind === 'm' && R() < 0.4); put(bronze ? 1 : 0, jit(c, j + e0 * 50, 0.012), bronze ? 0.85 + 0.25 * R() : 0.8 + 0.2 * R());
      if (bronze) for (const [pp, ee] of [[p0 + 0.04, e0 + 0.04], [p1 - 0.04, e0 + 0.04], [p0 + 0.04, e1 - 0.04], [p1 - 0.04, e1 - 0.04], [(p0 + p1) / 2, e0 + 0.04], [(p0 + p1) / 2, e1 - 0.04]]) {
        const v = dp(-pp, ee, DR + 0.1); if (inSlit(v.x, v.y - DC, v.z)) continue; const s = new T.SphereGeometry(0.03, 5, 4); s.translate(v.x, v.y, v.z); put(2, s, 0.8); } } }
  function bar(pts, w, h, kind, tint, inward = false) {   // Leiste mit rechteckigem Querschnitt entlang einer Punktfolge
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (!a || !b) continue; const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5), out = mid.clone().sub(new T.Vector3(0, DC, 0)).normalize().multiplyScalar(inward ? -1 : 1);
      const g = new T.BoxGeometry(w, h, len + 0.015); g.applyMatrix4(new T.Matrix4().lookAt(a, b, out)); g.translate(mid.x + out.x * h * 0.45, mid.y + out.y * h * 0.45, mid.z + out.z * h * 0.45); put(kind, g, tint); } }
  const okPt = (v) => (inSlit(v.x, v.y - DC, v.z) ? null : v);
  for (let j = 0; j < 12; j++) { const phi = j / 12 * 6.2832 + 0.26, pts = []; for (let k = 0; k <= 16; k++) pts.push(okPt(dp(phi, k / 16 * 1.42, DR + 0.08))); bar(pts, 0.15, 0.1, 2, 0.95);
    for (let k = 1; k < 16; k += 2) { const v = okPt(dp(phi, k / 16 * 1.42, DR + 0.2)); if (v) { const s = new T.SphereGeometry(0.035, 5, 4); s.translate(v.x, v.y, v.z); put(2, s, 0.8); } } }
  for (const el of [0.3, 0.58, 0.86]) { const pts = []; for (let k = 0; k <= 96; k++) pts.push(okPt(dp(k / 96 * 6.2832, el, DR + 0.08))); bar(pts, 0.1, 0.07, 2, 0.9); }
  for (const s of [-1, 1]) { const x = s * (SLW + 0.05), rho = Math.sqrt(DR * DR - x * x), pts = [];
    for (let k = 0; k <= 24; k++) { const u = k / 24 * 1.8; pts.push(new T.Vector3(x, DC + Math.sin(u) * (rho + 0.06), Math.cos(u) * (rho + 0.06))); } bar(pts, 0.22, 0.22, 2, 0.85);
    if (s > 0) for (let k = 1; k < 44; k++) { const u = k / 44 * 1.75, v = new T.Vector3(x - 0.14, DC + Math.sin(u) * (rho + 0.24), Math.cos(u) * (rho + 0.24)); const t = new T.BoxGeometry(0.07, 0.07, 0.07); t.translate(v.x, v.y, v.z); put(2, t, 0.75); } }
  { const g = new T.CylinderGeometry(0.33, 0.42, 0.22, 16); g.translate(0, DC + DR + 0.04, -0.75); put(1, g, 0.8); }
  // innen: sechs Eisenbögen unter der Kuppel mit Nieten, darunter ein Zahnkranz mit Zähnen nach innen
  for (let j = 0; j < 6; j++) { const phi = j / 6 * 6.2832 + 0.52, pts = []; for (let k = 0; k <= 18; k++) pts.push(okPt(dp(phi, k / 18 * 1.38, DR - 0.03))); bar(pts, 0.2, 0.22, 2, 0.8, true);
    for (let k = 1; k < 18; k += 2) { const v = okPt(dp(phi, k / 18 * 1.38, DR - 0.27)); if (v) { const s = new T.SphereGeometry(0.035, 5, 4); s.translate(v.x, v.y, v.z); put(2, s, 0.75); } } }
  put(2, ringPiece([[2.62, 6.74], [2.95, 6.74], [2.95, 6.92], [2.62, 6.92]], { seed: 37, dents: 0, n: 96 }), 0.8);
  for (let k = 0; k < 120; k++) { const a = k / 120 * 6.2832, t = new T.BoxGeometry(0.1, 0.16, 0.09); t.rotateY(-a); t.translate(Math.cos(a) * 2.57, 6.83, Math.sin(a) * 2.57); put(2, t, 0.75); }

  // ---------- 6) Teleskop: Rohr mit Flanschen, Schrauben, Schellen; Zahnrad am Schlitz; Lager auf zwei Eisenträgern; Ketten; Okular mit leuchtender Linse ----------
  const TILT = 0.62, TLEN = 10, PIV = new T.Vector3(0, DC + 0.55, 0.9), tdir = new T.Vector3(0, Math.cos(TILT), Math.sin(TILT));
  OBS.tube = { piv: PIV.clone().multiplyScalar(SC).add(B0), dir: tdir.clone(), len: TLEN * SC };
  const along = (g, a0) => { g.rotateX(TILT); g.translate(PIV.x + tdir.x * a0, PIV.y + tdir.y * a0, PIV.z + tdir.z * a0); return g; };
  const tseg = (r0, r1, a0, a1, kind, tint, rs = 32) => { const g = new T.CylinderGeometry(r1, r0, a1 - a0, rs, Math.max(1, Math.round((a1 - a0) * 2))); g.translate(0, (a1 - a0) / 2, 0); put(kind, jit(along(g, a0), a0 * 7, 0.008), tint); };
  tseg(0.62, 0.6, -2.4, -0.6, 1, 0.85); tseg(0.56, 0.52, -0.6, 3.5, 1, 1.0); tseg(0.5, 0.47, 3.5, 6.8, 1, 1.0); tseg(0.45, 0.43, 6.8, TLEN, 1, 1.0);
  tseg(0.5, 0.5, TLEN - 0.1, TLEN + 0.45, 2, 0.9); tseg(0.36, 0.36, TLEN + 0.45, TLEN + 0.5, 3, 1.0);
  for (const [a, r] of [[-2.4, 0.7], [-0.6, 0.68], [1.0, 0.62], [3.5, 0.6], [5.1, 0.56], [6.8, 0.54], [8.4, 0.51], [TLEN - 0.15, 0.55]]) {
    tseg(r, r, a - 0.09, a + 0.09, 2, 0.95, 40); tseg(r - 0.05, r - 0.05, a + 0.09, a + 0.13, 2, 0.8, 40);
    for (let k = 0; k < 16; k++) { const an = k / 16 * 6.283, g = new T.CylinderGeometry(0.026, 0.026, 0.26, 6); g.translate(Math.cos(an) * (r - 0.05), 0, Math.sin(an) * (r - 0.05)); put(2, along(g, a), 0.75); } }
  for (const a of [2.0, 4.4, 7.6]) { tseg(0.56, 0.56, a, a + 0.28, 2, 0.85, 28); const g = new T.BoxGeometry(0.16, 0.28, 0.3); g.translate(0.58, 0.14, 0); put(2, along(g, a), 0.8); }
  { const g = gearGeo(0.9, 34, 0.16, 5); g.rotateX(-Math.PI / 2); put(2, along(g, 2.4), 0.85); tseg(0.6, 0.6, 2.27, 2.53, 1, 0.8, 32); }   // großes Zahnrad, wo das Rohr den Schlitz verlässt
  { const g = gearGeo(0.35, 14, 0.12, 3); g.rotateY(Math.PI / 2); g.translate(0.95, 0, 0); put(2, along(g, 2.4 - 0.9 - 0.3), 0.8); }   // Ritzel daneben
  // Lager: Achse quer, zwei Lagerböcke auf zwei Trägern, die von der Wand kommen (das Rohr hängt frei dazwischen)
  { const ax = new T.CylinderGeometry(0.16, 0.16, 2.3, 16); ax.rotateZ(Math.PI / 2); ax.translate(PIV.x, PIV.y, PIV.z); put(2, ax, 0.8);
    { const g = gearGeo(1.1, 40, 0.16, 6); g.rotateY(Math.PI / 2); g.translate(PIV.x + 0.78, PIV.y, PIV.z); put(2, g, 0.9); }
    for (const s of [-1, 1]) { const b = new T.BoxGeometry(0.24, 0.75, 0.55); b.translate(PIV.x + s * 1.05, PIV.y - 0.36, PIV.z); put(2, jit(b, s, 0.01), 0.75);
      const beam = new T.BoxGeometry(1.75, 0.22, 0.32); beam.translate(s * 1.85, PIV.y - 0.84, PIV.z); put(2, beam, 0.7);
      for (let k = 0; k < 6; k++) { const r = new T.SphereGeometry(0.03, 5, 4); r.translate(s * (1.1 + k * 0.28), PIV.y - 0.72, PIV.z + 0.17); put(2, r, 0.7); }
      chain(dp(s > 0 ? 0 : Math.PI, 1.1, DR - 0.3), new T.Vector3(s * 0.62, PIV.y - 1.0, PIV.z - 0.9), 0.07, 0.25); } }
  // Okular am unteren Ende: Messingringe, Fokussierknopf, leuchtende Linse
  { const a = -2.4; tseg(0.4, 0.62, a - 0.35, a, 1, 0.9); tseg(0.16, 0.2, a - 0.75, a - 0.35, 1, 1.0, 20); for (const d of [0.45, 0.6]) tseg(0.22, 0.22, a - d - 0.03, a - d + 0.03, 1, 1.1, 20);
    const lens = new T.CircleGeometry(0.15, 20); lens.rotateX(Math.PI / 2); put(13, along(lens, a - 0.76), 1.0);
    const kn = new T.CylinderGeometry(0.08, 0.08, 0.14, 12); kn.rotateZ(Math.PI / 2); kn.translate(0.28, 0, 0); put(2, along(kn, a - 0.5), 0.8); }
  chain(dp(Math.PI / 2 + 1.2, 1.05, DR - 0.3), new T.Vector3(0.3, PIV.y + tdir.y * 1.5, PIV.z + tdir.z * 1.5), 0.06, 0.15);

  // ---------- 7) Innenraum: Fliesen, gebrochene Platten, Sand, Treppe zur Plattform am Okular, Möbel und Geräte ----------
  { seed = 707;
    for (let i = 0; i < 9; i++) { const a = R() * 6.28, d = rr(0.3, 1.7), s = rr(0.22, 0.38), g = new T.BoxGeometry(s, 0.06, s * rr(0.7, 1.1)); place(g, Math.cos(a) * d, FL + 0.03, Math.sin(a) * d, R() * 3, rr(-0.18, 0.18), rr(-0.18, 0.18)); put(0, jit(g, i, 0.015), 0.8); }   // lose, gekippte Fliesen
    for (let i = 0; i < 14; i++) { const a = R() * 6.28, d = rr(1.3, 1.85), g = new T.SphereGeometry(rr(0.18, 0.4), 10, 6, 0, 6.283, 0, Math.PI / 2); g.scale(1.6, rr(0.12, 0.25), 1); g.rotateY(R() * 3); g.translate(Math.cos(a) * d, FL, Math.sin(a) * d); put(11, g, 1.0); } }   // Sandwehen an der Wand
  // Plattform am Okular auf einer Säule, Wendeltreppe außen herum (Taucher-Maß: eine Stufe 0,4 m)
  const ST = new T.Vector3(0, 0, -0.8), PY = 3.9;   // Okular-Linse liegt bei (0; 4,68; −0,94): Taucher auf der Plattform hat sie direkt vor dem Auge
  { const g = new T.CylinderGeometry(0.24, 0.3, PY - FL, 16); g.translate(ST.x, (PY + FL) / 2, ST.z); put(0, jit(g, 3, 0.01), 0.85);
    put(0, ringPiece([[0, PY - 0.12], [0.62, PY - 0.12], [0.62, PY], [0, PY]], { seed: 501, dents: 3, depth: 0.08, drop: 0.03, n: 48 }).translate(ST.x, 0, ST.z), 0.9);
    const n = 18, f0 = Math.PI * 1.02, f1 = -0.35;
    for (let i = 0; i < n; i++) { const fa = f0 + (f1 - f0) * i / n, fb = f0 + (f1 - f0) * (i + 1) / n, top = FL + (PY - FL) * (i + 1) / n;
      const st = ringPiece([[0.64, FL], [1.02, FL], [1.02, top - 0.02], [0.99, top], [0.64, top]], { a0: Math.min(fa, fb), a1: Math.max(fa, fb), n: 3, seed: 600 + i, dents: i % 4 === 0 ? 1 : 0, depth: 0.12, drop: 0.05 });
      st.translate(ST.x, 0, ST.z); put(0, st, 0.82 + 0.1 * (i % 2)); }
    // Geländer: Pfosten und ein Handlauf entlang der Wendel, dazu ein Ring um die Plattform
    const hp = []; for (let i = 0; i <= 36; i++) { const f = f0 + (f1 - f0) * i / 36, y = FL + (PY - FL) * i / 36 + 0.42; hp.push(new T.Vector3(ST.x + Math.cos(f) * 1.0, y, ST.z + Math.sin(f) * 1.0)); }
    put(2, new T.TubeGeometry(new T.CatmullRomCurve3(hp), 80, 0.025, 6, false), 0.85);
    for (let i = 0; i <= 18; i += 3) { const f = f0 + (f1 - f0) * i / 18, y = FL + (PY - FL) * i / 18; const p = new T.CylinderGeometry(0.02, 0.02, 0.44, 6); p.translate(ST.x + Math.cos(f) * 1.0, y + 0.22, ST.z + Math.sin(f) * 1.0); put(2, p, 0.8); }
    { const ring = new T.TorusGeometry(0.6, 0.022, 6, 48, 6.2832 - 0.9); ring.rotateX(Math.PI / 2); ring.rotateY(-(f1 + 0.45)); ring.translate(ST.x, PY + 0.42, ST.z); put(2, ring, 0.85);
      for (let i = 0; i < 9; i++) { const f = f1 + 0.45 + i / 9 * (6.2832 - 0.9); const p = new T.CylinderGeometry(0.018, 0.018, 0.42, 6); p.translate(ST.x + Math.cos(f) * 0.6, PY + 0.21, ST.z + Math.sin(f) * 0.6); put(2, p, 0.8); } } }
  // Globus auf Dreibein: Holzbeine, Messingring, Meridian, Kugel mit Karte
  function globe(x, z, ry) {
    for (let k = 0; k < 3; k++) { const a = ry + k / 3 * 6.283, g = wbox(0.62, 0.035, 0.035); g.rotateZ(Math.PI / 2 - 0.25); g.translate(0.07, 0.3, 0); g.rotateY(-a); g.translate(x, FL, z); put(9, g, 0.9); }
    const rg = new T.TorusGeometry(0.25, 0.018, 6, 32); rg.rotateX(Math.PI / 2); rg.translate(x, FL + 0.6, z); put(1, rg, 1.0);
    const md = new T.TorusGeometry(0.235, 0.012, 6, 32, Math.PI * 1.3); md.rotateZ(-0.4); md.rotateY(ry); md.translate(x, FL + 0.6, z); put(1, md, 1.05);
    const sp = new T.SphereGeometry(0.22, 32, 16); sp.rotateZ(0.41); sp.rotateY(ry); sp.translate(x, FL + 0.6, z); put(10, sp, 1.0);
    const b = new T.TorusGeometry(0.16, 0.02, 6, 24); b.rotateX(Math.PI / 2); b.translate(x, FL + 0.18, z); put(1, b, 0.9);
  }
  // Armillarsphäre auf Steinsockel
  function armillary(x, z) { const ped = new T.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.06], [0.09, 0.12], [0.07, 0.4], [0.12, 0.46], [0.12, 0.5], [0, 0.5]].map(([r, y]) => new T.Vector2(r, y)), 20); ped.translate(x, FL, z); put(0, ped, 0.9);
    for (const [rx, rz, r] of [[0, 0, 0.24], [Math.PI / 2, 0, 0.24], [Math.PI / 2, 0.41, 0.22], [0.3, 1.1, 0.2], [1.2, -0.6, 0.18]]) { const t = new T.TorusGeometry(r, 0.012, 6, 36); t.rotateX(rx); t.rotateZ(rz); t.translate(x, FL + 0.78, z); put(1, t, 1.05); }
    const s = new T.SphereGeometry(0.05, 10, 8); s.translate(x, FL + 0.78, z); put(1, s, 1.1); const ax = new T.CylinderGeometry(0.008, 0.008, 0.6, 5); ax.rotateZ(0.41); ax.translate(x, FL + 0.78, z); put(1, ax, 1.0); }
  // Tisch mit schräger Platte, Karte, Buch, Tintenfass
  function desk(x, z, ry) {
    const top = wbox(0.8, 0.04, 0.46); top.rotateX(0.12); place(top, 0, 0.72, 0, 0); const parts = [[top, 9]];
    for (const [lx, lz] of [[-0.35, -0.18], [0.35, -0.18], [-0.35, 0.18], [0.35, 0.18]]) { const l = wbox(0.7, 0.045, 0.045); l.rotateZ(Math.PI / 2); l.translate(lx, 0.35, lz); parts.push([l, 9]); }
    { const c = wbox(0.7, 0.03, 0.03); c.translate(0, 0.2, 0.18); parts.push([c, 9]); }
    { const m = new T.PlaneGeometry(0.42, 0.32); m.rotateX(-Math.PI / 2 + 0.12); m.rotateY(0.15); m.translate(-0.12, 0.75, 0); parts.push([m, 'paper']); }
    { const b = new T.BoxGeometry(0.22, 0.05, 0.16); b.rotateX(0.12); b.rotateY(-0.3); b.translate(0.22, 0.76, -0.02); parts.push([b, 12]); }
    { const ink = new T.LatheGeometry([[0, 0], [0.04, 0], [0.045, 0.04], [0.02, 0.06], [0.02, 0.07], [0, 0.07]].map(([r, y]) => new T.Vector2(r, y)), 12); ink.translate(0.32, 0.74, 0.12); parts.push([ink, 3]); }
    for (const [g, k] of parts) { g.rotateY(ry); g.translate(x, FL, z); put(k, g, k === 12 ? 0.6 : 0.95); }
  }
  // Regal mit Schriftrollen und Krügen
  function shelf(x, z, ry) {
    const parts = [];
    for (const s of [-1, 1]) { const p = wbox(1.3, 0.05, 0.05); p.rotateZ(Math.PI / 2); p.translate(s * 0.42, 0.65, 0.12); parts.push([p, 9]); const p2 = wbox(1.3, 0.05, 0.05); p2.rotateZ(Math.PI / 2); p2.translate(s * 0.42, 0.65, -0.12); parts.push([p2, 9]); }
    for (const y of [0.15, 0.5, 0.85, 1.2]) { const b = wbox(0.9, 0.035, 0.28); b.translate(0, y, 0); parts.push([b, 9]); }
    seed = Math.round(x * 100 + z * 10);
    for (const y of [0.17, 0.52, 0.87]) for (let k = 0; k < 4; k++) { if (R() < 0.3) continue; const sc0 = new T.CylinderGeometry(0.035, 0.035, rr(0.22, 0.3), 10); sc0.rotateZ(Math.PI / 2); sc0.rotateY(rr(-0.3, 0.3)); sc0.translate(-0.3 + k * 0.2, y + 0.05, rr(-0.06, 0.06)); parts.push([sc0, 10, paperTex]); }
    for (let k = 0; k < 2; k++) { const j = new T.LatheGeometry([[0, 0], [0.05, 0], [0.08, 0.06], [0.07, 0.14], [0.035, 0.18], [0.04, 0.2], [0, 0.2]].map(([r, y]) => new T.Vector2(r, y)), 12); j.translate(0.2 + k * 0.16, 1.22, 0); parts.push([j, 12]); }
    for (const [g, k, tex] of parts) { g.rotateY(ry); g.translate(x, FL, z); put(k === 10 ? 'paper' : k, g, 0.95); }
  }
  // Leiter, angelehnt, eine Sprosse gebrochen
  function ladder(x, z, ry, lean) { const parts = [];
    for (const s of [-1, 1]) { const r = wbox(2.0, 0.045, 0.035); r.rotateZ(Math.PI / 2); r.translate(s * 0.2, 1.0, 0); parts.push(r); }
    for (let k = 0; k < 8; k++) { if (k === 5) continue; const g = wcyl(0.016, 0.4); g.translate(0, 0.2 + k * 0.24, 0); parts.push(g); }
    for (const g of parts) { g.rotateX(lean); g.rotateY(ry); g.translate(x, FL, z); put(9, g, 0.9); } }
  // Truhe mit Eisenbändern, Deckel halb offen
  function chest(x, z, ry) { const parts = [];
    for (let k = 0; k < 4; k++) { const p = wbox(0.6, 0.075, 0.36); p.translate(0, 0.04 + k * 0.075, 0); parts.push([p, 9]); }
    const lid = wbox(0.6, 0.05, 0.36); lid.translate(0, 0, 0.18); lid.rotateX(-0.7); lid.translate(0, 0.33, -0.18); parts.push([lid, 9]);
    for (const bx of [-0.22, 0.22]) { const b = new T.BoxGeometry(0.04, 0.31, 0.37); b.translate(bx, 0.16, 0); parts.push([b, 2]); }
    const lk = new T.BoxGeometry(0.07, 0.08, 0.02); lk.translate(0, 0.26, 0.19); parts.push([lk, 1]);
    for (const [g, k] of parts) { g.rotateY(ry); g.translate(x, FL, z); put(k, g, 0.9); } }
  function amphora(x, z, lie, ry) { const g = new T.LatheGeometry([[0, 0], [0.04, 0], [0.11, 0.12], [0.13, 0.25], [0.09, 0.38], [0.05, 0.42], [0.06, 0.46], [0, 0.46]].map(([r, y]) => new T.Vector2(r, y)), 16);
    if (lie) { g.rotateZ(Math.PI / 2); g.translate(0.23, 0.12, 0); } g.rotateY(ry); g.translate(x, FL, z); put(12, g, 0.85); }
  globe(-1.05, 0.95, 0.3); globe(1.2, 0.75, 2.0); armillary(0.35, 1.45); desk(1.3, -0.15, -1.75); shelf(-1.55, -0.6, 1.35); shelf(0.95, -1.45, -0.6);
  ladder(1.55, 1.15, -0.85, -0.22); chest(-0.6, 1.55, 0.4); amphora(-1.35, 0.3, false, 0); amphora(-1.5, 0.05, true, 1.2); amphora(1.6, -0.75, false, 0.3);
  { const g = gearGeo(0.38, 18, 0.07, 4); g.rotateX(-Math.PI / 2 + 0.08); g.translate(-0.4, FL + 0.05, -1.5); put(2, g, 0.8); const g2 = gearGeo(0.26, 12, 0.06, 3); g2.rotateX(-0.3); g2.rotateY(0.6); g2.translate(1.6, FL + 0.24, 0.2); put(2, g2, 0.8); }
  chain(new T.Vector3(-0.9, FL + 0.03, -1.2), new T.Vector3(-0.2, FL + 0.03, -1.65), 0.05, -0.0);
  for (let k = 0; k < 6; k++) { seed = 900 + k; const s = new T.CylinderGeometry(0.03, 0.03, rr(0.2, 0.3), 10); s.rotateZ(Math.PI / 2); s.rotateY(R() * 3); s.translate(rr(-1.2, 1.4), FL + 0.03, rr(-0.4, 1.6)); put('paper', s, 0.9); }   // Schriftrollen am Boden

  // ---------- 8) Trümmer außen ----------
  seed = 303; for (let i = 0; i < 30; i++) { const a = R() * 6.283, d = rr(4.3, 5.6); rubble(Math.cos(a) * d, Math.sin(a) * d, rr(0.08, 0.32)); }
  for (const [x, z, s, y] of rubbleList) { const rd = Math.hypot(x, z), yy = y ?? (rd < 2 ? FL : rd < 3.85 ? 1.3 : rd < 4.15 ? 0.6 : 0.05); const g = new T.DodecahedronGeometry(s, 0); g.scale(rr(1, 1.8), rr(0.5, 0.9), rr(0.8, 1.4)); g.rotateY(R() * 6); g.translate(x, yy + s * 0.25, z); put(0, jit(g, x * 10), 0.8 + 0.2 * R()); }
  { const g = new T.CylinderGeometry(0.26, 0.27, 0.9, 20); g.rotateZ(Math.PI / 2 - 0.1); g.rotateY(0.7); g.translate(4.5, 0.25, 1.8); put(0, g, 0.85); }
  { const g = ringPiece([[3.3, 0], [3.9, 0], [3.9, 0.25], [3.3, 0.3]], { a0: 2.5, a1: 2.85, n: 6, seed: 9, dents: 2, depth: 0.2, drop: 0.05 }); g.rotateZ(0.12); g.translate(-0.6, 0.0, 1.4); put(0, g, 0.8); }

  // alles in eine Gruppe, die mit SC vergrößert wird
  const OBSG = new T.Group(); OBSG.position.copy(B0); OBSG.scale.setScalar(SC); scene.add(OBSG);
  const archMats = { 0: archMat(0), 1: archMat(1), 2: archMat(2), 3: archMat(3), 4: archMat(4, runeTex), 5: archMat(4, meanderTex), 7: archMat(4, reliefTex), 8: archMat(8, glowTex), 9: archMat(9), 10: archMat(10, mapTex), paper: archMat(10, paperTex), 11: archMat(11), 12: archMat(12), 13: archMat(13) };
  for (const k in GEO) if (GEO[k].length) OBSG.add(new T.Mesh(merge(GEO[k]), archMats[k]));

  // ---------- 9) Bewuchs: Moospolster und kurzes Algengras in Flecken, hängende Ranken; innen Seegras am Boden; Korallen und Muscheln ----------
  { const P = [], col = (r, g, b) => [r, g, b]; seed = 404;
    const tuftAt = (x, y, z, n, hmax, c) => { for (let k = 0; k < n; k++) P.push(blade(x + rr(-0.12, 0.12), y, z + rr(-0.12, 0.12), rr(0.06, hmax), rr(0.015, 0.035), c, rr(0.02, 0.1))); };
    const moss = (x, y, z, s, c) => { const g = new T.IcosahedronGeometry(s, 1); g.scale(rr(1, 1.6), rr(0.3, 0.5), rr(1, 1.5)); g.rotateY(R() * 6); g.translate(x, y, z); jit(g, x * 7, s * 0.3); P.push(colorize(ni(g), c)); };
    const ledge = (rMin, rMax, y, n, sz) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, d = rr(rMin, rMax), x = Math.cos(a) * d, z = Math.sin(a) * d, cl = n2(x * 0.8, z * 0.8);
      if (cl < 0.42) continue; moss(x, y, z, rr(sz * 0.4, sz), col(0.14 + 0.06 * R(), 0.25 + 0.08 * R(), 0.11)); if (R() < 0.5) tuftAt(x, y, z, 6, 0.28, col(0.18, 0.33 + 0.08 * R(), 0.13)); } };
    ledge(4.15, 5.2, 0.06, 700, 0.14); ledge(3.9, 4.15, 0.6, 300, 0.11); ledge(2.5, 3.9, 1.31, 420, 0.09); ledge(3.6, 3.95, 6.43, 260, 0.08); ledge(3.1, 3.55, 6.57, 140, 0.07);
    ledge(1.2, 1.9, FL + 0.02, 240, 0.08);   // innen an der Wand
    const vine = (x, y, z, len, c) => { const n = 8, w = rr(0.03, 0.07), Pp = [], Uv = [], ax = R() * 6.28; for (let k = 0; k <= n; k++) { const t = k / n, yy = y - t * len, o = Math.sin(t * 3 + x) * 0.04; for (const s of [-1, 1]) { Pp.push(x + Math.cos(ax) * w * s * (1 - t * 0.6) + o, yy, z + Math.sin(ax) * w * s * (1 - t * 0.6)); Uv.push((s + 1) / 2, t); } }
      const I = []; for (let k = 0; k < n; k++) { const q = k * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(Pp, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(Uv, 2)); g.setIndex(I); g.computeVertexNormals(); P.push(colorize(ni(g), c)); };
    for (let i = 0; i < 70; i++) { const a = R() * 6.283; if (n2(Math.cos(a) * 3, Math.sin(a) * 3) < 0.4) continue; for (let k = 0; k < 3; k++) vine(Math.cos(a + k * 0.015) * 3.95, 6.3, Math.sin(a + k * 0.015) * 3.95, rr(0.2, 1.6), col(0.15 + 0.05 * R(), 0.25 + 0.06 * R(), 0.11)); }
    for (let i = 0; i < 26; i++) { const phi = R() * 6.283, el = rr(0.05, 0.5), v = dp(phi, el, DR + 0.12); if (inSlit(v.x, v.y - DC, v.z)) continue; vine(v.x, v.y, v.z, rr(0.2, 1.0), col(0.16, 0.27, 0.12)); }
    for (let i = 0; i < 12; i++) { const a = rr(3.2, 5.5), q = PIV.clone().add(tdir.clone().multiplyScalar(a)); vine(q.x + rr(-0.35, 0.35), q.y - 0.45, q.z, rr(0.2, 0.8), col(0.16, 0.28, 0.12)); }
    for (let i = 0; i < 30; i++) { const a = R() * 6.283; vine(Math.cos(a) * 2.25, 5.05, Math.sin(a) * 2.25, rr(0.2, 1.1), col(0.15, 0.26, 0.11)); }   // innen vom Gesims
    for (let i = 0; i < 16; i++) { const a = R() * 6.283, v = dp(a, rr(0.1, 0.9), DR - 0.25); if (inSlit(v.x, v.y - DC, v.z)) continue; vine(v.x, v.y, v.z, rr(0.3, 1.4), col(0.14, 0.24, 0.1)); }   // innen von den Bögen
    for (let i = 0; i < 40; i++) { const a = R() * 6.283, d = rr(0.9, 1.85); for (let k = 0; k < 4; k++) P.push(blade(Math.cos(a) * d + rr(-0.1, 0.1), FL, Math.sin(a) * d + rr(-0.1, 0.1), rr(0.2, 0.6), 0.04, col(0.18, 0.32, 0.13), 0.12)); }   // Seegras innen
    OBSG.add(new T.Mesh(merge(P), plantMat)); }
  { const P = [], PALC = [[0.25, 0.85, 0.8], [0.55, 0.42, 0.95], [1.0, 0.62, 0.42], [0.3, 0.7, 0.95], [0.85, 0.45, 0.8], [0.95, 0.85, 0.4]]; seed = 505;
    const pc = (g, c) => P.push(colorize(ni(g), c));
    const spot = (x, y, z, c, k) => { if (k < 0.35) { for (let j = 0; j < 8; j++) { const g = new T.CylinderGeometry(0.012, 0.025, rr(0.08, 0.22), 5); g.translate(0, 0.06, 0); g.rotateX(rr(-0.5, 0.5)); g.rotateZ(rr(-0.5, 0.5)); g.translate(x + rr(-0.08, 0.08), y, z + rr(-0.08, 0.08)); pc(g, c); } }
      else if (k < 0.65) { for (let j = 0; j < 6; j++) { const g = new T.SphereGeometry(rr(0.03, 0.06), 6, 5); g.translate(x + rr(-0.1, 0.1), y + 0.03, z + rr(-0.1, 0.1)); pc(g, c); } }
      else if (k < 0.85) { const g = new T.CircleGeometry(rr(0.1, 0.2), 12, 0, Math.PI); g.rotateY(R() * 6); g.translate(x, y + 0.01, z); pc(g, c); }
      else { const g = new T.SphereGeometry(0.06, 8, 4, 0, 6.283, 0, Math.PI / 2); g.scale(1, 0.4, 1.2); g.translate(x, y, z); pc(g, [0.9, 0.8, 0.6]); } };
    for (let i = 0; i < 46; i++) { const a = R() * 6.283, d = rr(3.5, 5.3); spot(Math.cos(a) * d, d > 4.15 ? 0.05 : d > 3.9 ? 0.6 : 1.3, Math.sin(a) * d, PALC[Math.floor(R() * PALC.length)], R()); }
    for (let i = 0; i < 18; i++) { const a = R() * 6.283, d = rr(3.6, 3.9); spot(Math.cos(a) * d, 6.43, Math.sin(a) * d, PALC[Math.floor(R() * PALC.length)], R()); }   // auf dem Gesims
    for (let i = 0; i < 14; i++) { const a = R() * 6.283, d = rr(1.0, 1.8); spot(Math.cos(a) * d, FL, Math.sin(a) * d, PALC[Math.floor(R() * PALC.length)], 0.3 + R() * 0.7); }   // innen
    OBSG.add(new T.Mesh(merge(P), stoneMat)); }

  OBSG.userData.rays = [];

  // Lichtstrahlen im Inneren: durch den Schlitz schräg nach unten
  { const dir = SUN.clone().negate().normalize();
    for (let i = 0; i < 5; i++) { const g = new T.PlaneGeometry(0.5 + i * 0.12, 9, 1, 1); g.translate(0, -4.5, 0); const m = new T.Mesh(g, rayMat); m.position.set(B0.x + (i - 2) * 0.55 * SC, B0.y + 9.4 * SC, B0.z + (0.2 + (i % 2) * 0.6) * SC); m.scale.setScalar(SC);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir); m.rotateY(i * 0.5); m.renderOrder = 6; m.frustumCulled = false; scene.add(m); OBSG.userData.rays.push(m); } }
  return OBSG;
}

// ---------- Begehung für den Taucher ----------
// Alles im Baumaß (Mitte des Baus, Fußpunkt des Unterbaus = 0). Die Maße stammen aus dem Bau oben (Wand, Säulen, Treppe, Möbel).
// Jede Stelle (x, z) hat eine Liste fester Stücke [unten, oben]. Liegt die Oberkante höchstens CLIMB über den Füßen, ist sie Boden
// (man steigt hinauf), sonst ist sie Wand; hängt ein Stück über dem Kopf, ist es Decke.
const L = { FL: 1.3, WI: 1.95, WO: 2.36, CR: 3.15, NC: 14, SILL: 2.3, WTOP: 3.75, DTOP: 4.25, DW: 0.19, WH: 0.16, PY: 3.9, DC: 6.7, DR: 3.05 };
const SLOT = 6.2832 / 14, slotA = (k) => (k + 0.5) * SLOT + 0.11, DOOR = slotA(6), WINA = [8, 10, 12, 0, 2, 4].map(slotA);
const ST = { x: 0, z: -0.8 }, F0 = Math.PI * 1.02, F1 = -0.35, NSTEP = 18;
const TILT = 0.62, TD = { y: Math.cos(TILT), z: Math.sin(TILT) }, PIV = { x: 0, y: L.DC + 0.55, z: 0.9 };
const COLS = []; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832 + 0.11; COLS.push([Math.cos(a) * L.CR, Math.sin(a) * L.CR, 0.34, 1.3, 5.06]); }
for (const k of [7, 9, 11, 13, 1, 3, 5]) { const a = slotA(k); COLS.push([Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0.25, L.FL, 5.06]); }
// Möbel: Globen, Armillarsphäre, Tisch, Regale, Truhe (Kreis und Höhe über dem Boden)
for (const [x, z, r, h] of [[-1.05, 0.95, 0.28, 0.85], [1.2, 0.75, 0.28, 0.85], [0.35, 1.45, 0.2, 1.05], [1.3, -0.15, 0.42, 0.78], [-1.55, -0.6, 0.45, 1.3], [0.95, -1.45, 0.45, 1.3], [-0.6, 1.55, 0.35, 0.4]]) COLS.push([x, z, r, L.FL, L.FL + h]);
const CLIMB = 0.75;   // so hoch steigt der Taucher von selbst (knapp 1,9 m: die Stufen des Unterbaus)
const angD = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const SEG = [];
/** feste Stücke an der Stelle (x, z) */
function pieces(x, z) {
  SEG.length = 0; const r = Math.hypot(x, z), an = Math.atan2(z, x);
  if (r < 3.9) SEG.push(-9, 1.3); else if (r < 4.15) SEG.push(-9, 0.6); else if (r < 4.8) SEG.push(-9, 0.05);
  if (r >= L.WI && r <= L.WO) {
    if (angD(an, DOOR) < L.DW) SEG.push(L.DTOP, 5.03);
    else if (WINA.some((w) => angD(an, w) < L.WH)) SEG.push(L.FL, L.SILL, L.WTOP, 5.03);
    else SEG.push(L.FL, 5.03);
  }
  if (r >= 2.2 && r <= 3.95) SEG.push(5.06, 6.56); else if (r >= 1.6 && r < L.WI) SEG.push(5.0, 5.22);
  for (const c of COLS) if (Math.hypot(x - c[0], z - c[1]) < c[2]) SEG.push(c[3], c[4]);
  const d = Math.hypot(x - ST.x, z - ST.z);
  if (d < 0.3) SEG.push(L.FL, L.PY); else if (d < 0.62) SEG.push(L.PY - 0.12, L.PY);
  else if (d <= 1.02 && d >= 0.64) { const f = Math.atan2(z - ST.z, x - ST.x); if (f >= F1 && f <= F0) { const i = Math.min(NSTEP - 1, Math.floor((F0 - f) / (F0 - F1) * NSTEP)); SEG.push(L.FL, L.FL + (L.PY - L.FL) * (i + 1) / NSTEP); } }
  return SEG;
}
const wallAt = (x, z, feet, head) => { const s = pieces(x, z); for (let i = 0; i < s.length; i += 2) if (s[i] <= feet + CLIMB && s[i + 1] > feet + CLIMB && s[i] < head) return true; return false; };
function groundAt(x, z, feet) { const s = pieces(x, z); let g = -1e9; for (let i = 0; i < s.length; i += 2) if (s[i + 1] <= feet + CLIMB && s[i + 1] > g) g = s[i + 1]; return g; }
function ceilAt(x, z, feet, head) { const s = pieces(x, z); let c = 1e9; for (let i = 0; i < s.length; i += 2) if (s[i] > feet + CLIMB && s[i] < c) c = s[i]; return c; }
/** Felsoberkante der Nadel an (x, z) in Weltmetern, -1e9 wenn dort keine ist (über den Rand hinaus) */
function plateauY(wx, wz) {
  const T0 = OBSV.top; if (rockSDF(wx, T0 - 2, wz) >= 0) return -1e9;
  let lo = T0 - 2, hi = T0 + 2; if (rockSDF(wx, hi, wz) < 0) return hi;
  for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (rockSDF(wx, m, wz) < 0) lo = m; else hi = m; } return lo;
}
const inReach = (wx, wz, r) => Math.hypot(wx - B0.x, wz - B0.z) < r;
export const obsNear = (x, z, r) => inReach(x, z, OBSV.r + r);
// Abstand eines Punkts zum Teleskoprohr (Baumaß): Okular dünn, Rohr dick; das Okular endet kurz vor der Linse, damit man hineinschauen kann
function tubeDist(x, y, z) {
  const px = x - PIV.x, py = y - PIV.y, pz = z - PIV.z, a = py * TD.y + pz * TD.z, ac = Math.max(-2.9, Math.min(10.5, a));
  const dx = px, dy = py - TD.y * ac, dz = pz - TD.z * ac; return Math.hypot(dx, dy, dz) - (ac < -2.4 ? 0.24 : 0.64);
}
let active = false;
function obsDiver(D, EYE, RAD) {
  const lx = (D.x - B0.x) / SC, lz = (D.z - B0.z) / SC, ly = (D.y - B0.y) / SC, eye = EYE / SC, rad = RAD / SC, r = Math.hypot(lx, lz);
  let feet = ly - eye, head = ly + 0.08;
  if (r > OBSV.r / SC + 1.2 || feet < -1.6 || feet > 12) return -1;
  // Wände: ringsum prüfen, wie weit man in festes Material ragt, und herausschieben
  let px = 0, pz = 0;
  if (wallAt(lx, lz, feet, head)) {   // mitten in der Wand (z. B. nach einem Sprung): nächste freie Stelle suchen
    for (let s = 0.1; s < 1.6; s += 0.1) { let ok = false; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832, x = lx + Math.cos(a) * s, z = lz + Math.sin(a) * s; if (!wallAt(x, z, feet, head)) { px = x - lx; pz = z - lz; ok = true; break; } } if (ok) break; }
  } else {
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832, cx = Math.cos(a), cz = Math.sin(a); if (!wallAt(lx + cx * rad, lz + cz * rad, feet, head)) continue;
      let lo = 0, hi = rad; for (let q = 0; q < 6; q++) { const m = (lo + hi) / 2; if (wallAt(lx + cx * m, lz + cz * m, feet, head)) hi = m; else lo = m; }
      px -= cx * (rad - hi) * 0.5; pz -= cz * (rad - hi) * 0.5; }
  }
  // Kuppel innen und außen, Teleskop
  const cy = ly - L.DC, rin = Math.hypot(lx, cy, lz);
  let py = 0;
  if (r < 2.25 && ly > 5.2) { const lim = L.DR - 0.2 - rad; if (cy > 0 && rin > lim) { const k = (rin - lim) / rin; px -= lx * k; pz -= lz * k; py -= cy * k; } else if (cy <= 0 && r > 2.2 - rad) { const k = (r - 2.2 + rad) / r; px -= lx * k; pz -= lz * k; } }
  else if (head > 6.4 && rin < L.DR + 0.25 + rad) { const k = (L.DR + 0.25 + rad - rin) / Math.max(rin, 1e-3); px += lx * k; pz += lz * k; py += Math.max(0, cy) * k; }
  for (const hy of [head - 0.05, ly - eye * 0.5, feet + 0.2]) { const d = tubeDist(lx + px, hy + py, lz + pz) - rad; if (d < 0) { const e = 0.02, gx = tubeDist(lx + px + e, hy + py, lz + pz) - tubeDist(lx + px - e, hy + py, lz + pz), gy = tubeDist(lx + px, hy + py + e, lz + pz) - tubeDist(lx + px, hy + py - e, lz + pz), gz = tubeDist(lx + px, hy + py, lz + pz + e) - tubeDist(lx + px, hy + py, lz + pz - e), gl = Math.hypot(gx, gy, gz) || 1; px -= gx / gl * d; py -= gy / gl * d; pz -= gz / gl * d; } }
  if (px || py || pz) { const wx = px * SC, wy = py * SC, wz = pz * SC, l = Math.hypot(wx, wy, wz); D.x += wx; D.y += wy; D.z += wz; if (l > 1e-5) { const nx = wx / l, ny = wy / l, nz = wz / l, vn = D.vx * nx + D.vy * ny + D.vz * nz; if (vn < 0) { D.vx -= nx * vn; D.vy -= ny * vn; D.vz -= nz * vn; } } }
  const x2 = (D.x - B0.x) / SC, z2 = (D.z - B0.z) / SC; feet = (D.y - B0.y) / SC - eye; head = feet + eye + 0.08;
  // Decke
  const c = ceilAt(x2, z2, feet, head); if (head > c) { D.y -= (head - c) * SC; if (D.vy > 0) D.vy = 0; feet = (D.y - B0.y) / SC - eye; }
  // Boden: Bau, sonst die Felsoberkante der Nadel; große Stufen steigt man zügig hinauf
  let g = groundAt(x2, z2, feet), gw = g > -1e8 ? B0.y + g * SC : -1e9;
  if (Math.hypot(x2, z2) >= 4.8 || g < -1e8) { const p = plateauY(D.x, D.z); if (p > gw) gw = p; }
  if (gw < -1e8) return -1;   // über den Rand hinaus: das Gelände übernimmt (man sinkt am Fels hinab)
  const fw = D.y - EYE;
  if (fw < gw) { const pen = gw - fw; D.y += Math.min(pen, Math.max(dt0 * 3.2, pen * Math.min(1, dt0 * 14))); if (D.vy < 0) D.vy = 0; }
  D.ground = D.y - EYE <= gw + 0.05 && D.vy < 0.3;
  return 2;
}
let dt0 = 1 / 60, lastT = 0;
// an den Wänden der Nadel (unterhalb des Plateaus): nicht in den Fels sinken
function pillarSide(D, EYE, RAD) {
  if (!inReach(D.x, D.z, OBSV.r + 22) || D.y > OBSV.top + 1) return;
  const y = D.y - EYE * 0.5; if (rockSDF(D.x, y, D.z) > RAD + 0.3) return;
  const dx = D.x - B0.x, dz = D.z - B0.z, l = Math.hypot(dx, dz) || 1;
  for (let k = 0; k < 10 && rockSDF(D.x, y, D.z) < RAD + 0.3; k++) { D.x += dx / l * 0.25; D.z += dz / l * 0.25; }
  const vn = (D.vx * dx + D.vz * dz) / l; if (vn < 0) { D.vx -= dx / l * vn; D.vz -= dz / l * vn; }
}
// in die vorhandene Höhlen-Abfrage des Tauchers einhängen (main.js setzt diver.cave = CAVE)
{ const cd = CAVE.diver, ch = CAVE.hose, cn = CAVE.near;
  CAVE.diver = (D, EYE, RAD) => {
    const now = performance.now(); dt0 = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now;
    if (active && inReach(D.x, D.z, OBSV.r + 24)) { const s = obsDiver(D, EYE, RAD); if (s >= 0) return s; pillarSide(D, EYE, RAD); return 0; }
    return cd(D, EYE, RAD);
  };
  CAVE.hose = (P, o) => {
    if (active && inReach(P[o], P[o + 2], OBSV.r + 3) && P[o + 1] > OBSV.top - 3) {
      const x = (P[o] - B0.x) / SC, z = (P[o + 2] - B0.z) / SC, y = (P[o + 1] - B0.y) / SC;
      let g = Math.hypot(x, z) < 4.8 ? groundAt(x, z, y - 0.05) : -1e9, gw = g > -1e8 ? B0.y + g * SC + 0.07 : -1e9;
      if (gw < -1e8) { const p = plateauY(P[o], P[o + 2]); if (p > -1e8) gw = p + 0.07; }
      if (gw > -1e8) { if (P[o + 1] < gw) P[o + 1] = gw; return true; }
    }
    return ch(P, o);
  };
  CAVE.near = (x, z, r) => cn(x, z, r) || (active && inReach(x, z, OBSV.r + r));
}

// ---------- Kugeln für das Boot, grober Abstand für die Kamera ----------
const SPH = [];
{ const add = (x, y, z, r) => SPH.push({ x: B0.x + x * SC, y: B0.y + y * SC, z: B0.z + z * SC, r: r * SC });
  for (let i = 0; i < 26; i++) { const a = i / 26 * 6.2832; add(Math.cos(a) * 4.1, 0.5, Math.sin(a) * 4.1, 0.75); }
  for (const y of [1.9, 2.9, 3.9, 4.9, 5.8]) for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832; add(Math.cos(a) * 3.3, y, Math.sin(a) * 3.3, 0.72); }
  for (let i = 0; i < 22; i++) { const a = i / 22 * 6.2832; add(Math.cos(a) * 3.55, 6.3, Math.sin(a) * 3.55, 0.6); }
  add(0, L.DC, 0, L.DR + 0.15);
  for (let a = 2.0; a <= 10.5; a += 0.55) add(PIV.x, PIV.y + TD.y * a, PIV.z + TD.z * a, 0.62); }
export const OBS_SPHERES = SPH;
/** grober Abstand zum Bau (Weltmeter), für die Kamera */
export function obsSDF(x, y, z) {
  const lx = (x - B0.x) / SC, ly = (y - B0.y) / SC, lz = (z - B0.z) / SC, r = Math.hypot(lx, lz);
  const cyl = Math.max(r - 4.0, -ly, ly - 6.6), dome = Math.hypot(lx, ly - L.DC, lz) - L.DR - 0.1, tube = tubeDist(lx, ly, lz) - 0.05;
  return Math.min(cyl, dome, tube) * SC;
}
/** Wellenmitte an der Oberfläche: wo das Rohr durchstößt */
export const TUBE_HIT = (() => { const pv = { x: B0.x + PIV.x * SC, y: B0.y + PIV.y * SC, z: B0.z + PIV.z * SC }, s = -pv.y / TD.y; return new T.Vector2(pv.x, pv.z + TD.z * s); })();
/** Bau einschalten (einmal) */
let group = null;
export function obsEnsure(scene) { if (group) return group; group = buildObservatory(scene); active = true; return group; }
export const obsActive = () => active;
/** nur für Tests: Begehung ohne Grafik einschalten */
export const obsTestOn = () => { active = true; };
