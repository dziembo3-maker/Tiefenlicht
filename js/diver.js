// diver.js – der Taucheranzug: schwer über den Grund gehen, mit dem Luftventil steigen und sinken, am Schlauch zum Boot.
// Der Schlauch ist eine Kette aus Gliedern (Verlet), die im Wasser langsam absinkt, auf dem Grund liegt und sich vom Heck bis zum Helm zieht.
import { T, clamp, damp } from './util.js';
import { U, paintMaterial, quadPoints } from './gfx.js';
import { floorH, floorN, BOUNDS } from './terrain.js';

export const HOSE_LEN = 55;          // so weit reicht der Schlauch
const EYE = 1.72, RAD = 0.42, N = 44, SEG = HOSE_LEN / N, SUB = 3, SIDES = 7;
const WALK = 1.45, FLOAT = 0.85, UP = 0.95, DOWN = 1.8, SINK = 0.9;

export function createDiver(scene) {
  const D = { on: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, ground: false, ph: 0, steps: 0, breath: 2.5, bob: 0, roll: 0, atEnd: 0, speed: 0 };
  const nT = { x: 0, y: 1, z: 0 };
  // ---------- Schlauch ----------
  const P = new Float32Array((N + 1) * 3), Q = new Float32Array((N + 1) * 3), FL = new Float32Array(N + 1);
  const RN = N * SUB + 1, pos = new Float32Array(RN * SIDES * 3), nor = new Float32Array(RN * SIDES * 3), col = new Float32Array(RN * SIDES * 3), wnd = new Float32Array(RN * SIDES), shd = new Float32Array(RN * SIDES), idx = [];
  for (let j = 0; j < RN; j++) {
    const m = j / (RN - 1) * HOSE_LEN, band = (m % 5) < 0.18, coupling = (m % 10) > 9.88 || (m % 10) < 0.12;
    const c = coupling ? [0.85, 0.62, 0.28] : band ? [0.72, 0.16, 0.08] : [0.56, 0.47, 0.32];
    for (let i = 0; i < SIDES; i++) { const k = (j * SIDES + i) * 3, sh2 = 0.82 + 0.18 * Math.cos(i / SIDES * Math.PI * 2 + j * 0.9); col[k] = c[0] * sh2; col[k + 1] = c[1] * sh2; col[k + 2] = c[2] * sh2; wnd[j * SIDES + i] = coupling ? 0.8 : 0.25; shd[j * SIDES + i] = coupling ? 0.22 : band ? 0.14 : 0.1; }
  }
  for (let j = 0; j < RN - 1; j++) for (let i = 0; i < SIDES; i++) { const a = j * SIDES + i, b = j * SIDES + (i + 1) % SIDES, c = a + SIDES, d = b + SIDES; idx.push(a, c, b, b, c, d); }
  const hg = new T.BufferGeometry(); hg.setAttribute('position', new T.BufferAttribute(pos, 3)); hg.setAttribute('normal', new T.BufferAttribute(nor, 3)); hg.setAttribute('color', new T.BufferAttribute(col, 3)); hg.setAttribute('aWind', new T.BufferAttribute(wnd, 1)); hg.setAttribute('aShade', new T.BufferAttribute(shd, 1)); hg.setIndex(idx);
  const hose = new T.Mesh(hg, paintMaterial(T.DoubleSide)); hose.frustumCulled = false; hose.visible = false; scene.add(hose);
  // ---------- aufgewirbelter Sand bei jedem Schritt ----------
  const NS = 48, sp = new Float32Array(NS * 3), sl = new Float32Array(NS), sv = new Float32Array(NS * 3); let si = 0; for (let i = 0; i < NS; i++) sp[i * 3 + 1] = 999;
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aL', new T.BufferAttribute(sl, 1));
  const PX = { value: 600 };
  const sand = quadPoints(sg, new T.ShaderMaterial({ uniforms: Object.assign({}, U, { uPx: PX }), transparent: true, depthWrite: false,
    vertexShader: `attribute float aL; uniform float uPx, uLampOn; uniform vec3 uLampPos, uLampDir; varying float vA; varying vec3 vC;
      void main(){ vec4 mv = viewMatrix * vec4(position, 1.0); vec3 dl = position - uLampPos; float d = length(dl), cone = smoothstep(0.75, 0.97, dot(dl / max(d, 0.01), uLampDir));
        vC = vec3(0.16, 0.2, 0.21) + vec3(0.45, 0.42, 0.36) * cone * uLampOn * 3.0 / (2.0 + d * d * 0.08); vA = aL * aL * 0.5;
        gl_PointSize = (0.25 + 1.1 * (1.0 - aL)) * uPx / max(-mv.z, 0.4); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5), a = 1.0 - smoothstep(0.0, 0.5, r); gl_FragColor = vec4(vC, a * a * vA); }` }));
  sand.renderOrder = 6; sand.visible = false; scene.add(sand);
  const puff = (x, y, z, n, k) => { for (let i = 0; i < n; i++) { const o = si * 3, a = Math.random() * 6.283; sp[o] = x + Math.cos(a) * 0.1; sp[o + 1] = y + 0.05; sp[o + 2] = z + Math.sin(a) * 0.1; sv[o] = Math.cos(a) * (0.25 + Math.random() * 0.35) * k; sv[o + 1] = 0.12 + Math.random() * 0.2; sv[o + 2] = Math.sin(a) * (0.25 + Math.random() * 0.35) * k; sl[si] = 1; si = (si + 1) % NS; } };

  /** Schlauch neu auslegen: vom Anschluss am Heck in sanftem Bogen bis zum Taucher, der Rest hängt durch */
  function layHose(a, b) {
    for (let i = 0; i <= N; i++) { const t = i / N, sag = Math.sin(t * Math.PI) * 4; const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - sag, z = a.z + (b.z - a.z) * t; P[i * 3] = Q[i * 3] = x; P[i * 3 + 1] = Q[i * 3 + 1] = y; P[i * 3 + 2] = Q[i * 3 + 2] = z; }
  }
  D.enter = (eye, yaw, anchor) => { D.on = true; D.x = eye.x; D.y = eye.y; D.z = eye.z; D.yaw = yaw; D.pitch = -0.1; D.vx = D.vy = D.vz = 0; D.ph = 0; D.breath = 1.6; D.ground = false; layHose(anchor, D.attach()); hose.visible = sand.visible = true; };
  D.exit = () => { D.on = false; hose.visible = sand.visible = false; };
  /** wo der Schlauch am Helm sitzt: hinten, etwas unter Augenhöhe */
  const at = new T.Vector3(); D.attach = () => at.set(D.x - Math.sin(D.yaw) * 0.32, D.y - 0.3, D.z - Math.cos(D.yaw) * 0.32);
  D.anchorDist = (anchor) => Math.hypot(D.x - anchor.x, D.y - anchor.y, D.z - anchor.z);

  /** ein Bild weiter. inp: {mx, my (Gehen, -1..1, my < 0 = vorwärts), up, down}; anchor: Anschluss am Boot (Welt); spheres: Felsen; boat: Kugeln des Bootsrumpfs.
   *  Gibt Ereignisse zurück (Schritt, Ausatmen, Schlauchende), damit main Ton und Blasen dazu macht. */
  const ev = { step: 0, exhale: false, end: false };
  D.update = (dt, inp, anchor, spheres, boat) => {
    ev.step = 0; ev.exhale = false; ev.end = false;
    // gehen: Richtung relativ zum Blick, auf dem Grund schwer und zielstrebig, schwebend träge
    const sy = Math.sin(D.yaw), cy = Math.cos(D.yaw), mag = Math.min(1, Math.hypot(inp.mx, inp.my)), top = D.ground ? WALK : FLOAT;
    let tx = (sy * -inp.my - cy * inp.mx) * top, tz = (cy * -inp.my + sy * inp.mx) * top; if (mag > 1) { tx /= mag; tz /= mag; }
    const k = D.ground ? 2.6 : 1.1; D.vx = damp(D.vx, tx, k, dt); D.vz = damp(D.vz, tz, k, dt);
    // Luftventil: mehr Luft = steigen, weniger = sinken; ohne Eingriff sinkt der schwere Anzug langsam
    const vyT = inp.up ? UP : inp.down ? -DOWN : D.ground ? 0 : -SINK; D.vy = damp(D.vy, vyT, inp.up ? 1.3 : 2.0, dt);
    D.x += D.vx * dt; D.y += D.vy * dt; D.z += D.vz * dt;
    // Grund: begehbare Hänge heben den Taucher, steile Wände halten ihn auf
    const fh = floorH(D.x, D.z), feet = D.y - EYE; floorN(D.x, D.z, nT);
    if (feet < fh) {
      const pen = fh - feet;
      if (nT.y > 0.55 || pen < 0.35) { D.y += pen * Math.min(1, dt * 14 + (pen > 0.3 ? 1 : 0)); if (D.vy < 0) D.vy = 0; }
      else { const hl = Math.hypot(nT.x, nT.z) || 1; D.x += nT.x / hl * pen * 0.6; D.z += nT.z / hl * pen * 0.6; const vn = (D.vx * nT.x + D.vz * nT.z) / hl; if (vn < 0) { D.vx -= nT.x / hl * vn; D.vz -= nT.z / hl * vn; } }
    }
    D.ground = D.y - EYE <= floorH(D.x, D.z) + 0.04 && D.vy < 0.3;
    // Felsen und Bootsrumpf: Kapsel vom Fuß bis zum Helm gegen Kugeln
    const push = (s) => { const cy2 = clamp(s.y, D.y - EYE + RAD, D.y), dx = D.x - s.x, dy = cy2 - s.y, dz = D.z - s.z, min = s.r + RAD; if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(dy) > min) return; const d = Math.hypot(dx, dy, dz); if (d >= min || d < 1e-4) return; const nx = dx / d, ny = dy / d, nz = dz / d, pen = min - d; D.x += nx * pen; D.y += ny * pen; D.z += nz * pen; const vn = D.vx * nx + D.vy * ny + D.vz * nz; if (vn < 0) { D.vx -= nx * vn; D.vy -= ny * vn; D.vz -= nz * vn; } };
    for (const s of spheres) push(s); for (const s of boat) push(s);
    if (D.y > BOUNDS.top - 1.5) { D.y = BOUNDS.top - 1.5; if (D.vy > 0) D.vy = 0; }
    // Schlauch zu Ende: sanft bremsen, dann halten
    const a = D.attach(), hx = a.x - anchor.x, hy = a.y - anchor.y, hz = a.z - anchor.z, hd = Math.hypot(hx, hy, hz), lim = HOSE_LEN * 0.97;
    if (hd > lim * 0.9) { const nx = hx / hd, ny = hy / hd, nz = hz / hd, vo = D.vx * nx + D.vy * ny + D.vz * nz, f = Math.min(1, (hd - lim * 0.9) / (lim * 0.1));
      if (vo > 0) { D.vx -= nx * vo * f; D.vy -= ny * vo * f; D.vz -= nz * vo * f; } if (hd > lim) { const o = hd - lim; D.x -= nx * o; D.y -= ny * o; D.z -= nz * o; } if (f > 0.6 && mag > 0.3) ev.end = true; }
    // Schritte: nur auf dem Grund, schwer, mit Sand
    D.speed = Math.hypot(D.vx, D.vz);
    if (D.ground && D.speed > 0.15) { const was = Math.floor(D.ph * 2); D.ph += dt * D.speed * 0.78; if (Math.floor(D.ph * 2) !== was) { ev.step = Math.min(1, D.speed / WALK); const side = Math.floor(D.ph * 2) % 2 ? 1 : -1; puff(D.x + cy * 0.15 * side, floorH(D.x, D.z), D.z - sy * 0.15 * side, 5, 0.6 + 0.4 * ev.step); } }
    const step = D.ground ? Math.abs(Math.sin(D.ph * Math.PI)) : 0;
    D.bob = damp(D.bob, D.ground && D.speed > 0.15 ? -step * 0.07 * Math.min(1, D.speed / WALK) : Math.sin(U.uTime.value * 0.9) * 0.03, 8, dt);
    D.roll = damp(D.roll, D.ground ? Math.sin(D.ph * Math.PI) * 0.018 * Math.min(1, D.speed / WALK) : Math.sin(U.uTime.value * 0.6) * 0.01, 5, dt);
    // atmen
    D.breath -= dt; if (D.breath <= 0) { D.breath = 4.2 + Math.random() * 1.4 - Math.min(1, D.speed / WALK) * 0.8; ev.exhale = true; }
    // Schlauch: Kette mit festen Enden, sinkt langsam, liegt auf dem Grund
    stepHose(dt, anchor, a, boat);
    // Sand
    for (let i = 0; i < NS; i++) if (sl[i] > 0) { const o = i * 3; sl[i] = Math.max(0, sl[i] - dt * 0.42); sv[o] *= 1 - dt * 1.6; sv[o + 2] *= 1 - dt * 1.6; sv[o + 1] *= 1 - dt * 1.2; sp[o] += sv[o] * dt; sp[o + 1] += sv[o + 1] * dt; sp[o + 2] += sv[o + 2] * dt; if (sl[i] === 0) sp[o + 1] = 999; }
    sg.attributes.position.__inst.needsUpdate = true; sg.attributes.aL.__inst.needsUpdate = true;
    return ev;
  };
  function stepHose(dt, A, B, boat) {
    const h = Math.min(dt, 1 / 30), drag = Math.exp(-h * 2.2), g = -0.55 * h * h;
    P[0] = A.x; P[1] = A.y; P[2] = A.z; P[N * 3] = B.x; P[N * 3 + 1] = B.y; P[N * 3 + 2] = B.z;
    for (let i = 1; i < N; i++) { const o = i * 3; for (let c = 0; c < 3; c++) { const p = P[o + c], v = (p - Q[o + c]) * drag; Q[o + c] = p; P[o + c] = p + v + (c === 1 ? g : 0); } }
    for (let it = 0; it < 12; it++) {
      for (let i = 0; i < N; i++) { const a = i * 3, b = a + 3, dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-4, diff = (d - SEG) / d;
        const wa = i === 0 ? 0 : i + 1 === N ? 1 : 0.5, wb = i === 0 ? 1 : i + 1 === N ? 0 : 0.5;
        P[a] += dx * diff * wa; P[a + 1] += dy * diff * wa; P[a + 2] += dz * diff * wa; P[b] -= dx * diff * wb; P[b + 1] -= dy * diff * wb; P[b + 2] -= dz * diff * wb; }
      P[N * 3] = B.x; P[N * 3 + 1] = B.y; P[N * 3 + 2] = B.z;
    }
    for (let i = 1; i < N; i++) { const o = i * 3, f = floorH(P[o], P[o + 2]) + 0.07; FL[i] = f; if (P[o + 1] < f) { P[o + 1] = f; Q[o] = P[o] - (P[o] - Q[o]) * 0.5; Q[o + 2] = P[o + 2] - (P[o + 2] - Q[o + 2]) * 0.5; }
      for (const s of boat) { const dx = P[o] - s.x, dy = P[o + 1] - s.y, dz = P[o + 2] - s.z, m = s.r + 0.08, d = Math.hypot(dx, dy, dz); if (d < m && d > 1e-4) { const k = (m - d) / d; P[o] += dx * k; P[o + 1] += dy * k; P[o + 2] += dz * k; } } }
  }
  // Rohr um die Kette: Catmull-Rom zwischen den Gliedern, Ringe quer zur Richtung
  const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
  const C = new Float32Array(RN * 3), tv = new T.Vector3(), uv = new T.Vector3(), wv = new T.Vector3(), ref = new T.Vector3(0, 1, 0), prevU = new T.Vector3(1, 0, 0);
  D.draw = () => {
    if (!D.on) return;
    for (let j = 0; j < RN; j++) { const s = Math.min(N - 1e-6, j / SUB), i = Math.floor(s), t = s - i, i0 = Math.max(0, i - 1), i2 = Math.min(N, i + 1), i3 = Math.min(N, i + 2); for (let c = 0; c < 3; c++) C[j * 3 + c] = cr(P[i0 * 3 + c], P[i * 3 + c], P[i2 * 3 + c], P[i3 * 3 + c], t); }
    prevU.set(1, 0, 0);
    for (let j = 0; j < RN; j++) {
      const a = Math.max(0, j - 1) * 3, b = Math.min(RN - 1, j + 1) * 3; tv.set(C[b] - C[a], C[b + 1] - C[a + 1], C[b + 2] - C[a + 2]).normalize();
      uv.copy(prevU).addScaledVector(tv, -prevU.dot(tv)); if (uv.lengthSq() < 1e-6) uv.crossVectors(tv, ref); uv.normalize(); prevU.copy(uv); wv.crossVectors(tv, uv);
      const ed = Math.hypot(C[j * 3] - D.x, C[j * 3 + 1] - D.y, C[j * 3 + 2] - D.z), near = clamp((ed - 0.7) / 0.6, 0, 1);   // das Stück direkt am Helm sieht man nicht: es hängt hinter einem
      const r = (j === RN - 1 || j === 0 ? 0.055 : 0.046 + 0.004 * Math.sin(j * 0.7)) * near * near * (3 - 2 * near);
      for (let i = 0; i < SIDES; i++) { const an = i / SIDES * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), nx = uv.x * ca + wv.x * sa, ny = uv.y * ca + wv.y * sa, nz = uv.z * ca + wv.z * sa, k = (j * SIDES + i) * 3;
        pos[k] = C[j * 3] + nx * r; pos[k + 1] = C[j * 3 + 1] + ny * r; pos[k + 2] = C[j * 3 + 2] + nz * r; nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz; }
    }
    hg.attributes.position.needsUpdate = true; hg.attributes.normal.needsUpdate = true;
  };
  /** Kamera in den Helm setzen */
  const look = new T.Vector3();
  D.camera = (cam, pxScale) => {
    PX.value = pxScale; const cp = Math.cos(D.pitch);
    cam.position.set(D.x, D.y + D.bob, D.z); look.set(D.x + Math.sin(D.yaw) * cp, D.y + D.bob + Math.sin(D.pitch), D.z + Math.cos(D.yaw) * cp); cam.up.set(0, 1, 0); cam.lookAt(look); cam.rotateZ(D.roll);
  };
  /** Helmlampe: kleiner Scheinwerfer oben am Helm, leuchtet dorthin, wohin man schaut */
  D.lamp = (pos, dir) => { pos.set(D.x + Math.cos(D.yaw) * 0.12, D.y + 0.28, D.z - Math.sin(D.yaw) * 0.12); const cp = Math.cos(D.pitch - 0.08); dir.set(Math.sin(D.yaw) * cp, Math.sin(D.pitch - 0.08), Math.cos(D.yaw) * cp).normalize(); };
  return D;
}
