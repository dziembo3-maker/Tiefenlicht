// atlrocks.js – Felsen des Atlantis-Bioms im Spiel: Aufträge an die Worker, fertige Kacheln als Meshes, Material.
// Die Form steht in atlantis.js, die Oberfläche rechnet atlmesh.js; hier wird nur verteilt und gezeichnet.
import { T } from './util.js';
import { uni, COMMON } from './gfx.js';
import { meshTile } from './atlmesh.js';

/** Licht der Atlantis-Sonne (Westen): warm von oben, damit die Farben von Gestein, Sand und Tang im blauen Wasser nicht verschwinden */
export const ATL_LIGHT = /* glsl */ `
vec3 sunA(vec3 base, vec3 N, vec3 wp) {
  float lk = clamp(exp((wp.y + 20.0) * 0.02), 0.3, 1.0), top = max(N.y, 0.0), side = max(dot(N, uSunDir), 0.0);
  float cs = caustic(wp.xz * 1.2 + wp.y * 0.3) * smoothstep(0.2, 0.7, N.y);
  return base * vec3(0.95, 0.80, 0.62) * (0.34 + top * 0.38 + side * 0.3) * lk * (0.85 + 0.8 * cs);
}`;
/** Meeresgrund wie rockMaterial(false) in gfx.js, dazu Atlantis: aAtl = wie sehr hier Atlantis ist, aOcc = Schatten der Atlantis-Felsen auf dem Sand */
export function atlTerrainMaterial() {
  const VT = `attribute float aAtl, aOcc; varying vec3 vW, vN; varying float vA, vO; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vA = aAtl; vO = aOcc; gl_Position = projectionMatrix * viewMatrix * w; }`;
  return new T.ShaderMaterial({ uniforms: uni(), vertexShader: VT, defines: { FLATK: '0.45', TERR: 1 }, extensions: { derivatives: true }, fragmentShader: /* glsl */ `precision highp float; ${COMMON} ${ATL_LIGHT} varying vec3 vW, vN;
    #ifdef TERR
    varying float vA, vO;
    #endif
    void main(){
      vec3 N = normalize(vN);
      N = normalize(mix(N, normalize(cross(dFdx(vW), dFdy(vW))), FLATK));
      float n = texture2D(uNoise, vW.xz * 0.019 + vW.y * 0.011).r, st = texture2D(uNoise, vec2(vW.y * 0.04 + n * 0.35, 0.3 + vW.x * 0.002)).g;
      float fl = smoothstep(0.8, 0.96, N.y);
      vec3 base = mix(vec3(0.20, 0.30, 0.46), vec3(0.44, 0.58, 0.74), st * 0.65 + n * 0.35);
      // Grund: Sandflächen, dazwischen dunklere Geröllfelder mit Steinchen und Bewuchsflecken
      float pt = texture2D(uNoise, vW.xz * 0.045 + 3.7).g, gravel = smoothstep(0.45, 0.62, pt + n * 0.25 - 0.1);
      float sp = texture2D(uNoise, vW.xz * 0.9).b, sp2 = texture2D(uNoise, vW.xz * 0.37 + 1.3).b;
      vec3 sand = vec3(0.50, 0.66, 0.80) * (0.9 + 0.2 * n), grav = vec3(0.24, 0.34, 0.47) * (0.85 + 0.3 * sp2);
      vec3 flo = mix(sand, grav, gravel * 0.85);
      flo *= 1.0 - 0.32 * smoothstep(0.72, 0.9, sp) * (0.35 + 0.65 * gravel) - 0.18 * smoothstep(0.8, 0.95, sp2);
      flo = mix(flo, vec3(0.13, 0.26, 0.30), smoothstep(0.6, 0.75, texture2D(uNoise, vW.xz * 0.021 - 5.1).r) * 0.45 * (1.0 - gravel));
      base = mix(base, flo, fl * 0.85);
      #ifdef TERR
      if (vA > 0.002) {   // Atlantis: heller, warmer Sand mit Riffeln quer zur Strömung, Algenflecken; steile Hänge aus geschichtetem Gestein
        float n2 = texture2D(uNoise, vW.xz * 0.09 + 2.1).g, n4 = texture2D(uNoise, vW.xz * 0.006 + 0.3).r;
        vec3 sandA = vec3(0.80, 0.72, 0.57) * (0.9 + 0.16 * n);
        sandA = mix(sandA, vec3(0.50, 0.56, 0.40), smoothstep(0.58, 0.76, n2) * 0.35);
        sandA *= 1.0 - 0.2 * smoothstep(0.86, 0.97, sp);
        float rq = dot(vW.xz, vec2(0.34, 0.94)) * 3.3 + n * 12.0 + n2 * 5.0, rp = sin(rq), rp2 = sin(rq * 0.5 + n4 * 20.0);
        sandA *= 0.93 + 0.07 * rp;
        float wb = texture2D(uNoise, vec2((vW.y + (n4 - 0.5) * 7.0) * 0.029, 0.21)).r;
        vec3 rockA = mix(vec3(0.46, 0.22, 0.14), vec3(0.80, 0.50, 0.28), smoothstep(0.32, 0.62, wb)) * (0.85 + 0.3 * n);
        vec3 bA = mix(rockA, sandA, smoothstep(0.55, 0.85, N.y));
        base = mix(base, bA, vA);
        N = normalize(N + vec3(rp * 0.12 + rp2 * 0.05, 0.0, rp * 0.036) * vA * smoothstep(0.6, 0.95, N.y));
        vec3 lit = shade(base, N, vW) + sunA(base, N, vW) * vA * 1.6;
        lit *= 1.0 - 0.78 * vO;
        gl_FragColor = vec4(fog(lit, vW), 1.0); return;
      }
      #endif
      N = normalize(N + vec3(sin(vW.x * 1.1 + n * 9.0 + vW.z * 0.3), 0.0, 0.0) * 0.16 * fl * (1.0 - gravel));          // Sandrippel
      gl_FragColor = vec4(fog(shade(base, N, vW), vW), 1.0);
    }` });
}

export function atlRockMaterial() {
  return new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, extensions: { derivatives: true },
    vertexShader: `attribute float aAO; varying vec3 vW, vN; varying float vAO; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vAO = aAO; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} ${ATL_LIGHT} varying vec3 vW, vN; varying float vAO;
    // Gesteinsschichten: rostrot, orange, sandweiß; die Bänder liegen leicht schief und wellig
    vec3 strata(vec3 p, vec3 N) {
      float w = p.y + (texture2D(uNoise, p.xz * 0.006).r - 0.5) * 7.0 + (texture2D(uNoise, p.xz * 0.045).g - 0.5) * 0.9;
      float b = texture2D(uNoise, vec2(w * 0.029, 0.21)).r, b2 = texture2D(uNoise, vec2(w * 0.12, 0.63)).g;
      vec3 c = mix(vec3(0.50, 0.19, 0.11), vec3(0.86, 0.43, 0.20), smoothstep(0.32, 0.6, b));
      c = mix(c, vec3(0.92, 0.78, 0.58), smoothstep(0.64, 0.75, b));
      c = mix(c, vec3(0.30, 0.16, 0.12), (1.0 - smoothstep(0.18, 0.3, b)) * 0.7);
      c *= 0.84 + 0.3 * b2;
      c *= 0.86 + 0.24 * texture2D(uNoise, vec2((p.x + p.z) * 0.09 + N.x * 0.3, p.y * 0.012)).r;   // Rinnen von oben nach unten
      return c;
    }
    // Höhenfeld der feinen Oberfläche: senkrechte Rillen, ausgewaschene Dellen, Kratzer, Poren, feine Risse
    float relief(vec3 p, vec3 N, out float crack) {
      vec2 t = normalize(vec2(-N.z, N.x) + 1e-4); float s = dot(p.xz, t);
      float w = p.y + (texture2D(uNoise, p.xz * 0.006).r - 0.5) * 7.0;
      float gro = texture2D(uNoise, vec2(s * 0.017, p.y * 0.0025)).r * 0.6 + texture2D(uNoise, vec2(s * 0.04, p.y * 0.006)).g * 0.4;
      float d1 = texture2D(uNoise, vec2(w * 0.009 + s * 0.0006, 0.71)).r, d2 = texture2D(uNoise, vec2(w * 0.021 - s * 0.0009, 0.29)).g;
      float bed = -(smoothstep(0.56, 0.66, d1) * (1.0 - smoothstep(0.66, 0.8, d1))) - 0.6 * (smoothstep(0.6, 0.68, d2) * (1.0 - smoothstep(0.68, 0.78, d2)));
      float scr = smoothstep(0.62, 0.7, texture2D(uNoise, vec2(s * 0.004 + w * 0.0005, w * 0.06)).b) * smoothstep(0.4, 0.6, texture2D(uNoise, vec2(s * 0.02, w * 0.004)).r);
      float pit = texture2D(uNoise, p.xz * 0.028 + p.y * vec2(0.021, 0.013)).b;
      float cr = texture2D(uNoise, vec2(s * 0.006 + p.y * 0.0012, p.y * 0.0035 + s * 0.0008)).r; crack = (1.0 - smoothstep(0.003, 0.01, abs(cr - 0.5))) * smoothstep(0.45, 0.65, texture2D(uNoise, vec2(s * 0.01, p.y * 0.01)).g);
      return gro * 0.45 + bed * 1.2 - scr * 0.25 - smoothstep(0.75, 0.95, pit) * 0.35 - crack * 0.2;
    }
    void main(){
      vec3 V = normalize(cameraPosition - vW), N = normalize(vN), Nf = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(Nf, V) < 0.0) Nf = -Nf; if (dot(N, Nf) < 0.0) N = -N;
      N = normalize(mix(N, Nf, 0.12));
      float crack, c1, c2, h = relief(vW, N, crack), near = 1.0 - smoothstep(25.0, 70.0, length(cameraPosition - vW));
      vec3 t1 = normalize(cross(N, abs(N.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), t2 = cross(N, t1); float e = 0.12;
      float h1 = relief(vW + t1 * e, N, c1), h2 = relief(vW + t2 * e, N, c2);
      N = normalize(N - (t1 * (h1 - h) + t2 * (h2 - h)) / e * 0.09 * near);
      vec3 base = strata(vW, N) * (0.82 + 0.3 * h) * (1.0 - 0.3 * crack * near);
      // Bewuchs auf allem, was nach oben schaut
      float m = texture2D(uNoise, vW.xz * 0.11 + vW.y * 0.05).r, m2 = texture2D(uNoise, vW.xz * 0.5).b;
      base = mix(base, mix(vec3(0.16, 0.28, 0.14), vec3(0.34, 0.46, 0.22), m2), smoothstep(0.6, 0.88, N.y) * smoothstep(0.45, 0.7, m + 0.16) * 0.7);
      float ao = vAO * vAO;
      vec3 lit = (shade(base, N, vW) * 0.95 + sunA(base, N, vW) * 2.5 + base * vec3(0.05, 0.05, 0.06)) * mix(0.22, 1.0, ao);
      gl_FragColor = vec4(fog(lit, vW), 1.0);
    }` });
}

/** verteilt Kacheln an Worker (oder rechnet sie zur Not selbst), liefert Meshes */
export function createAtlRocks() {
  const mat = atlRockMaterial(), A = { queue: [], jobs: new Map(), fallback: false, done: 0 };
  let nextId = 1, workers = [], alive = false, born = performance.now();
  try {
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./atlworker.js', import.meta.url), { type: 'module' }); w.busy = null;
      w.onmessage = (e) => { const d = e.data; if (d.hello) { alive = true; return; } if (d.fail) { console.warn('Atlantis-Worker', d.fail); goFallback(); return; } alive = true; const job = A.jobs.get(d.id); w.busy = null; if (!job) return; A.jobs.delete(d.id); if (d.err) { console.warn('Atlantis-Fels', d.err); job.cb(null); return; } A.done++; job.cb(d.r); };
      w.onerror = (e) => { console.warn('Atlantis-Worker', e.message || e); goFallback(); };
      workers.push(w);
    }
  } catch (e) { A.fallback = true; }
  function goFallback() {
    if (A.fallback) return; A.fallback = true;
    for (const w of workers) try { w.terminate(); } catch (e) { /* egal */ }
    for (const job of A.jobs.values()) A.queue.push(job); A.jobs.clear(); workers = [];
  }
  /** Auftrag: Kachel (ix, iz) berechnen, dann cb(ergebnis oder null) */
  A.request = (key, ix, iz, cb) => { A.queue.push({ key, ix, iz, cb, t: 0 }); };
  A.cancel = (key) => { A.queue = A.queue.filter((j) => j.key !== key); for (const j of A.jobs.values()) if (j.key === key) j.cb = () => {}; };
  /** in jedem Bild: Aufträge verteilen, nächste zuerst */
  A.pump = (x, z) => {
    const now = performance.now();
    if (!A.fallback && (!alive && now - born > 9000)) goFallback();   // Worker melden sich nicht: selbst rechnen
    if (!A.fallback) for (const j of A.jobs.values()) if (now - j.t > 25000) { goFallback(); break; }
    if (!A.queue.length) return;
    A.queue.sort((a, b) => Math.hypot((a.ix + 0.5) * 64 - x, (a.iz + 0.5) * 64 - z) - Math.hypot((b.ix + 0.5) * 64 - x, (b.iz + 0.5) * 64 - z));
    if (A.fallback) { const t0 = performance.now(); while (A.queue.length && performance.now() - t0 < 12) { const j = A.queue.shift(); let r = null; try { r = meshTile(j.ix, j.iz); } catch (e) { console.warn(e); } A.done++; j.cb(r); } return; }
    for (const w of workers) { if (w.busy || !A.queue.length) continue; const j = A.queue.shift(); j.t = now; const id = nextId++; A.jobs.set(id, j); w.busy = id; w.postMessage({ id, ix: j.ix, iz: j.iz }); }
  };
  A.busy = () => A.queue.length + A.jobs.size;
  A.mesh = (r) => {
    if (!r || !r.I.length) return null;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(r.P, 3)); g.setAttribute('normal', new T.BufferAttribute(r.N, 3)); g.setAttribute('aAO', new T.BufferAttribute(r.A, 1)); g.setIndex(new T.BufferAttribute(r.I, 1));
    g.computeBoundingSphere(); const m = new T.Mesh(g, mat); m.userData.tris = r.I.length / 3; return m;
  };
  return A;
}

// ---------- Riesentang (Tangwälder) ----------
const F32 = (a) => new Float32Array(a), U16 = (a) => new Uint16Array(a);
const ROTY = `vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }`;
// dieselbe Form wie der Tang in life.js, hier mit vielen kleinen Blättern
function kelpShape(LEAVES = 15, LK = 1) {   // LEAVES Blätter, LK = Länge der Blätter (Riesentang: viele kleine)
  const p = [], tip = [], ix = []; let n = 0;
  const SEG = 10, bend = (y) => [Math.sin(y * 2.6) * 0.035, Math.cos(y * 3.4) * 0.03];
  for (let j = 0; j <= SEG; j++) { const y = j / SEG, b = bend(y), r = 0.011 * (1.2 - y); for (let i = 0; i < 3; i++) { const a = i * 2.094; p.push(b[0] + Math.cos(a) * r, y, b[1] + Math.sin(a) * r); tip.push(0); n++; } }
  for (let j = 0; j < SEG; j++) for (let i = 0; i < 3; i++) { const a = j * 3 + i, c = j * 3 + (i + 1) % 3; ix.push(a, c, a + 3, c, c + 3, a + 3); }
  const WD = [0.16, 0.8, 1, 0.62, 0.0], TT = [0, 0.2, 0.5, 0.8, 1];
  for (let l = 0; l < LEAVES; l++) {
    const y = 0.1 + 0.9 * (l / (LEAVES - 1)), az = l * 2.4 + Math.sin(l * 1.7) * 0.5, b = bend(y), len = (0.27 - 0.09 * y) * (0.8 + 0.4 * Math.sin(l * 5.1) ** 2) * LK, wd = len * 0.2, rise = l === LEAVES - 1 ? 1.4 : 0.55 + 0.25 * Math.sin(l * 3.3);
    const ax = Math.cos(az), azz = Math.sin(az), base = n;
    for (let k = 0; k < 5; k++) { const t = TT[k], out = t * len, up = t * len * rise - t * t * len * 0.35, w = WD[k] * wd; for (const s of [-1, 1]) { p.push(b[0] + ax * out - azz * w * s, Math.min(1.08, y + up), b[1] + azz * out + ax * w * s); tip.push(0.25 + 0.75 * t); n++; } }
    for (let k = 0; k < 4; k++) { const a = base + k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  return { a: { position: [F32(p), 3], aTip: [F32(tip), 1] }, i: U16(ix) };
}

// Riesentang im Atlantis-Biom: höher, grün bis goldgelb (iG), im Gegenlicht durchscheinend, unter der warmen Atlantis-Sonne
const mKelpA = () => new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide,
    vertexShader: /* glsl */ `attribute float aTip; attribute vec4 iP; attribute vec2 iR; attribute float iG; varying float vG; uniform float uTime; uniform vec3 uSubPos, uSubA, uSubB; varying vec3 vW; varying float vT, vH; ${ROTY}
      vec3 subOff(vec3 p){ vec3 ab = uSubB - uSubA; float t = clamp(dot(p - uSubA, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0); return p - (uSubA + ab * t); }   // Abstand zur Bootsachse (Bug bis Heck), nicht nur zur Mitte
      void main(){ float h = iP.w, y = position.y; vec3 p = rotY(position, iR.x) * h;
        float sw = y * y * h * 0.085;
        p.x += sin(uTime * 0.55 + iR.y + y * 2.1) * sw + sin(uTime * 1.3 + iR.y * 3.0 + y * 17.0) * 0.022 * h * aTip;
        p.z += cos(uTime * 0.43 + iR.y * 1.7 + y * 1.7) * sw * 0.8;
        p.y += sin(uTime * 1.1 + iR.y + y * 13.0) * 0.012 * h * aTip;
        p += iP.xyz;
        vec3 d0 = subOff(iP.xyz); vec2 dir = length(d0.xz) > 0.05 ? normalize(d0.xz) : vec2(1.0, 0.0); float l = length(subOff(p)); p.xz += dir * (1.0 - smoothstep(1.6, 6.5, l)) * 3.2 * y;   // die ganze Pflanze biegt sich in eine Richtung (vom Fuß aus gesehen weg vom Boot)
        vW = p; vT = aTip; vH = y; vG = iG; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} ${ATL_LIGHT} varying vec3 vW; varying float vT, vH, vG;
      void main(){ if (distance(vW, cameraPosition) < 2.4) discard;   // keine riesigen Blätter direkt vor der Kamera
        vec3 leaf = mix(vec3(0.17, 0.33, 0.13), vec3(0.50, 0.42, 0.13), vG), base = mix(vec3(0.10, 0.17, 0.09), leaf, 0.35 + 0.65 * vT) * (0.75 + 0.45 * vH);
        vec3 Nn = normalize(vec3(0.0, 0.75, 0.0) + uSunDir * 0.3), c = shade(base, Nn, vW) * 0.8 + sunA(base, Nn, vW) * 1.6;
        c += leaf * vec3(0.55, 0.7, 0.25) * 0.22 * vT * vH * clamp(exp((vW.y + 20.0) * 0.03), 0.1, 1.0);   // Licht scheint durch die Blätter
        gl_FragColor = vec4(fog(c, vW), 1.0); }` });

let KELP = null;
/** Riesentang einer Kachel als ein Mesh: arr = je 7 Werte (x, y, z, Höhe, Drehung, Phase, Gold) */
export function atlKelpMesh(arr, cx, cz) {
  if (!arr || !arr.length) return null;
  if (!KELP) KELP = { shape: kelpShape(30, 0.46), mat: mKelpA() };
  const g = new T.InstancedBufferGeometry(), sh = KELP.shape; for (const k in sh.a) g.setAttribute(k, new T.BufferAttribute(sh.a[k][0], sh.a[k][1])); g.setIndex(new T.BufferAttribute(sh.i, 1));
  const ib = new T.InstancedInterleavedBuffer(F32(arr), 7, 1); g.setAttribute('iP', new T.InterleavedBufferAttribute(ib, 4, 0)); g.setAttribute('iR', new T.InterleavedBufferAttribute(ib, 2, 4)); g.setAttribute('iG', new T.InterleavedBufferAttribute(ib, 1, 6));
  g.instanceCount = arr.length / 7; g.boundingSphere = new T.Sphere(new T.Vector3(cx, -48, cz), 125); const m = new T.Mesh(g, KELP.mat); m.userData.tris = (sh.i.length / 3) * g.instanceCount; return m;
}
