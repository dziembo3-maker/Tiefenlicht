// sub.js – das kleine Boot: rundlicher Rumpf mit kurzer Röhre, große Glaskuppel mit warmem Licht, zwei Scheinwerfer
import { T, Geo, addBlob, addBox, addTube, glowTexture } from './util.js';
import { uni, paintMaterial } from './gfx.js';

const CREAM = [0.88, 0.83, 0.70], RUST = [0.86, 0.36, 0.17], METAL = [0.22, 0.25, 0.29], WARM = [1.0, 0.72, 0.38];

function lathe(g, prof, sides, sx, sy, colorFn, emisFn, glass = 0, cx = 0, cy = 0) {
  const base = g.count, n = prof.length;
  for (let j = 0; j < n; j++) {
    const [z, r] = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(n - 1, j + 1)], dz = b[0] - a[0], dr = b[1] - a[1], l = Math.hypot(dz, dr) || 1;
    for (let i = 0; i <= sides; i++) { const an = (i / sides) * Math.PI * 2, c = Math.cos(an), s = Math.sin(an); g.v(cx + c * r * sx, cy + s * r * sy, z, c * dz / l, s * dz / l, -dr / l, colorFn(z, c, s), glass, emisFn ? emisFn(z, c, s) : 0); }
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) { const a = base + j * (sides + 1) + i, b = a + 1, c = a + sides + 1, d = c + 1; g.tri(a, b, c); g.tri(b, d, c); }
}
function tube(g, pts, r, sides, col, closed = false, emis = 0) {
  const base = g.count, n = pts.length, tv = new T.Vector3(), u = new T.Vector3(), w = new T.Vector3(), ref = new T.Vector3();
  for (let j = 0; j < n; j++) {
    const a = pts[closed ? (j - 1 + n) % n : Math.max(0, j - 1)], c = pts[closed ? (j + 1) % n : Math.min(n - 1, j + 1)], p = pts[j];
    tv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize(); ref.set(0, 0, 1); if (Math.abs(tv.z) > 0.9) ref.set(0, 1, 0);
    u.crossVectors(tv, ref).normalize(); w.crossVectors(tv, u);
    for (let i = 0; i < sides; i++) { const an = (i / sides) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), ox = u.x * ca + w.x * sa, oy = u.y * ca + w.y * sa, oz = u.z * ca + w.z * sa; g.v(p[0] + ox * r, p[1] + oy * r, p[2] + oz * r, ox, oy, oz, col, 0, emis); }
  }
  const m = closed ? n : n - 1;
  for (let j = 0; j < m; j++) for (let i = 0; i < sides; i++) { const a = base + j * sides + i, c = base + j * sides + (i + 1) % sides, d = base + ((j + 1) % n) * sides + i, e = base + ((j + 1) % n) * sides + (i + 1) % sides; g.tri(a, c, d); g.tri(c, e, d); }
}
function disc(g, c, nrm, r, col, emis, glass = 0, sides = 14) {
  const n = new T.Vector3(...nrm).normalize(), u = new T.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0)).normalize(), w = new T.Vector3().crossVectors(n, u);
  const ci = g.v(c[0], c[1], c[2], n.x, n.y, n.z, col, glass, emis);
  const ring = []; for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2, ca = Math.cos(a) * r, sa = Math.sin(a) * r; ring.push(g.v(c[0] + u.x * ca + w.x * sa, c[1] + u.y * ca + w.y * sa, c[2] + u.z * ca + w.z * sa, n.x, n.y, n.z, col, glass, emis)); }
  for (let i = 0; i < sides; i++) g.tri(ci, ring[i], ring[(i + 1) % sides]);
}

function box2(g, c, s, col) { addBox(g, c[0], c[1], c[2], s[0] / 2, s[1] / 2, s[2] / 2, 0, col); }
// Drei Boote mit gleicher Kuppel vorn (dahinter sitzt immer dieselbe Kabine), aber eigenem Rumpf, eigenen Farben und Anbauten
export const BOATS = [
  { id: 'laterne', HULL: [[-1.78, 0.1], [-1.66, 0.3], [-1.42, 0.52], [-1.05, 0.76], [-0.6, 0.93], [-0.1, 1.0], [0.4, 1.0], [0.78, 0.96]], SY: 0.96, tail: -1.5, ring: -1.92, rear: -0.92,
    top: CREAM, low: RUST, line: METAL, metal: METAL, swatch: ['#e0d4b3', '#db5c2b'] },
  { id: 'kupfer', HULL: [[-2.5, 0.08], [-2.36, 0.24], [-2.02, 0.43], [-1.5, 0.64], [-0.9, 0.84], [-0.25, 0.96], [0.4, 0.99], [0.78, 0.96]], SY: 0.9, tail: -2.15, ring: -2.6, rear: -1.45,
    top: [0.74, 0.40, 0.21], low: [0.09, 0.2, 0.22], line: [0.86, 0.66, 0.32], metal: [0.15, 0.17, 0.18], swatch: ['#bd6a36', '#173538'] },
  { id: 'hummel', HULL: [[-1.42, 0.12], [-1.36, 0.4], [-1.18, 0.68], [-0.88, 0.92], [-0.42, 1.08], [0.05, 1.13], [0.45, 1.09], [0.78, 0.97]], SY: 1.0, tail: -1.3, ring: -1.62, rear: -0.72,
    top: [1.0, 0.64, 0.1], low: [0.11, 0.11, 0.12], line: [0.11, 0.11, 0.12], metal: [0.52, 0.55, 0.57], swatch: ['#f2b822', '#1c1c1f'] },
];
function buildBody(g, B, k) {
  const { HULL, SY } = B, TOP = B.top, LOW = B.low, LINE = B.line, MET = B.metal;
  const rAt = (z) => { for (let i = 0; i < HULL.length - 1; i++) if (z <= HULL[i + 1][0]) { const t = (z - HULL[i][0]) / (HULL[i + 1][0] - HULL[i][0]); return HULL[i][1] + (HULL[i + 1][1] - HULL[i][1]) * Math.max(0, t); } return 0.96; };
  // Rumpf
  const hullCol = k === 2 ? (z, c, s) => (s < -0.6 || Math.abs(z + 0.78) < 0.1 || Math.abs(z + 0.2) < 0.06 ? LOW : TOP)
    : k === 1 ? (z, c, s) => (s > -0.18 ? (s < -0.1 ? LINE : TOP) : LOW)
    : (z, c, s) => (s > -0.1 ? (s < -0.02 ? MET : TOP) : LOW);
  lathe(g, HULL, k === 1 ? 26 : 22, 1, SY, hullCol);
  // Kuppelrahmen und Glaskuppel (bei allen gleich)
  lathe(g, [[0.7, 0.99], [0.74, 1.04], [0.86, 1.04], [0.9, 0.97]], 22, 1, SY, () => (k === 1 ? LINE : MET));
  lathe(g, [[0.88, 0.94], [1.08, 0.9], [1.3, 0.78], [1.48, 0.58], [1.6, 0.33], [1.66, 0.0]], 22, 1, SY,
    (z, c, s) => { const t = Math.max(0, Math.min(1, s * 0.5 + 0.5)); return s < -0.55 ? [0.25, 0.16, 0.1] : [1.0 - 0.3 * t, 0.74 - 0.12 * t, 0.42 + 0.08 * t]; },
    (z, c, s) => (s < -0.55 ? 0.3 : 1.25 - 0.45 * (s * 0.5 + 0.5)), 1);
  if (k === 0) {
    addBlob(g, 0, 0.9, 0.05, 0.5, 0.3, 0.72, 2, 3, () => TOP, 0, 0, 0.02);
    addTube(g, [{ x: 0, y: 1.08, z: 0.05, r: 0.3 }, { x: 0, y: 1.24, z: 0.05, r: 0.3 }, { x: 0, y: 1.28, z: 0.05, r: 0.24 }], 12, () => MET, 0, 0, true);
    tube(g, [[0, 1.2, -0.3], [0, 1.9, -0.36]], 0.022, 5, MET); addBlob(g, 0, 1.93, -0.36, 0.06, 0.06, 0.06, 1, 1, () => [1.0, 0.5, 0.25], 0, 1.6, 0);
  } else if (k === 1) {
    // hoher, schmaler Turm, nach hinten geneigt, mit Messinglukenring und Sehrohr
    addBlob(g, 0, 0.98, -0.35, 0.34, 0.48, 0.95, 2, 3, () => TOP, 0, 0, 0.02);
    addTube(g, [{ x: 0, y: 1.36, z: -0.15, r: 0.22 }, { x: 0, y: 1.5, z: -0.15, r: 0.22 }, { x: 0, y: 1.53, z: -0.15, r: 0.17 }], 12, () => LINE, 0, 0, true);
    tube(g, [[0.12, 1.3, -0.7], [0.12, 2.15, -0.72], [0.12, 2.22, -0.62]], 0.035, 6, LINE);
    addBlob(g, 0, 0.66, -1.55, 0.05, 0.34, 0.62, 1, 2, () => TOP, 0, 0, 0);   // Rückenkamm
    for (const z of [-1.9, -0.95, 0.2]) { const r = rAt(z) + 0.012, ring = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ring.push([Math.cos(a) * r, Math.sin(a) * r * SY, z]); } tube(g, ring, 0.035, 5, LINE, true); }
    addBlob(g, 0, 2.24, -0.72, 0.05, 0.05, 0.05, 1, 1, () => [1.0, 0.5, 0.25], 0, 1.6, 0);
  } else {
    // flache Luke, Lampenbügel und Antenne; Schutzbügel rundherum
    addTube(g, [{ x: 0, y: 1.06, z: -0.1, r: 0.36 }, { x: 0, y: 1.2, z: -0.1, r: 0.36 }, { x: 0, y: 1.24, z: -0.1, r: 0.28 }], 14, () => MET, 0, 0, true);
    tube(g, [[-0.42, 1.0, 0.45], [-0.42, 1.24, 0.45], [0.42, 1.24, 0.45], [0.42, 1.0, 0.45]], 0.035, 6, LOW);
    for (const x of [-0.25, 0.25]) { addBlob(g, x, 1.26, 0.5, 0.1, 0.1, 0.12, 1, 2, () => MET, 0, 0, 0); disc(g, [x, 1.26, 0.62], [0, 0, 1], 0.075, [1, 0.95, 0.8], 1.6); }
    tube(g, [[0, 1.15, -0.55], [0.05, 1.95, -0.62]], 0.018, 5, MET); addBlob(g, 0.05, 1.97, -0.62, 0.055, 0.055, 0.055, 1, 1, () => [1.0, 0.5, 0.25], 0, 1.6, 0);
    for (const sx of [-1, 1]) tube(g, [[sx * 0.7, -1.0, 1.25], [sx * 1.2, -0.85, 0.9], [sx * 1.44, -0.62, 0.2], [sx * 1.4, -0.52, -0.7], [sx * 0.9, -0.42, -1.25]], 0.05, 6, LOW);
    tube(g, [[-0.7, -0.9, 1.25], [0, -1.02, 1.42], [0.7, -0.9, 1.25]], 0.05, 6, LOW);
  }
  // Bullaugen
  const PORTS = k === 1 ? [[-1.45, 0.15], [-0.75, 0.17], [-0.05, 0.17]] : k === 2 ? [[-0.6, 0.27], [0.15, 0.27]] : [[-0.5, 0.17], [0.12, 0.17]];
  for (const sx of [-1, 1]) for (const [z, pr] of PORTS) {
    const r = rAt(z), a = 0.2, n = [sx * Math.cos(a), Math.sin(a), 0.05], p = [sx * Math.cos(a) * r, Math.sin(a) * r * SY, z];
    disc(g, [p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, p[2]], n, pr + 0.07, k === 1 ? LINE : MET, 0); disc(g, [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2]], n, pr, WARM, 1.15, 1);
  }
  // seitliche Tanks bzw. Torpedorohre bzw. runde Kugeltanks
  if (k === 0) for (const sx of [-1, 1]) lathe(g, [[-1.15, 0.0], [-1.05, 0.2], [-0.8, 0.29], [0.45, 0.29], [0.7, 0.2], [0.8, 0.0]], 10, 1, 1, () => LOW, null, 0, sx * 0.98, -0.5);
  if (k === 1) for (const sx of [-1, 1]) lathe(g, [[-1.95, 0.0], [-1.85, 0.12], [-1.6, 0.17], [0.35, 0.17], [0.6, 0.12], [0.7, 0.0]], 10, 1, 1, (z) => (z > 0.3 || z < -1.7 ? LINE : LOW), null, 0, sx * 0.9, -0.62);
  if (k === 2) for (const sx of [-1, 1]) { addBlob(g, sx * 0.98, -0.55, -0.25, 0.4, 0.4, 0.62, 2, 3, (x, y, z) => (Math.abs(z) < 0.16 || Math.abs(z) > 0.9 ? LOW : TOP), 0, 0, 0.02); }
  // Kufen bzw. Kiel
  if (k === 1) addBlob(g, 0, -0.95, -0.6, 0.06, 0.16, 1.5, 1, 3, () => LOW, 0, 0, 0);
  else for (const sx of [-1, 1]) {
    const w = k === 2 ? 0.62 : 0.55, rr = k === 2 ? 0.06 : 0.045;
    tube(g, [[sx * w, -0.98, -1.05], [sx * (w + 0.01), -1.14 - (k === 2 ? 0.06 : 0), -0.8], [sx * (w + 0.01), -1.16 - (k === 2 ? 0.06 : 0), 0.75], [sx * w, -1.02, 1.05]], rr, 6, MET);
    for (const z of [-0.6, 0.5]) tube(g, [[sx * (w - 0.05), -0.8, z], [sx * (w + 0.01), -1.15, z]], 0.035, 5, MET);
  }
  // Heck: Flossen und Schutzring der Schraube
  const tz = B.tail, rz = B.ring, fl = k === 1 ? 0.8 : k === 2 ? 0.5 : 0.62, fw = k === 1 ? 0.6 : 0.42;
  addBox(g, 0, fl * 0.8, tz, 0.05, fl, fw, 0, TOP); addBox(g, 0, -fl * 0.8, tz, 0.05, fl, fw, 0, LOW); addBox(g, fl * 0.8, 0, tz, fl, 0.05, fw, 0, k === 2 ? LOW : TOP); addBox(g, -fl * 0.8, 0, tz, fl, 0.05, fw, 0, k === 2 ? LOW : TOP);
  const rr = k === 2 ? 0.62 : 0.56, ring = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; ring.push([Math.cos(a) * rr, Math.sin(a) * rr, rz]); }
  tube(g, ring, k === 2 ? 0.06 : 0.045, 6, k === 1 ? LINE : MET, true);
  for (const [x, y] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) tube(g, [[x * rr * 0.5, y * rr * 0.5, rz + 0.3], [x * rr, y * rr, rz]], 0.03, 5, MET);
  // Heckfenster: von hinten sieht man das warme Licht der Kabine
  { const z = B.rear, r = rAt(z) * SY, n = [0, 0.93, -0.36]; disc(g, [0, r + 0.012, z], n, 0.31, k === 1 ? LINE : MET, 0); disc(g, [0, r + 0.03, z - 0.005], n, 0.235, WARM, 1.2, 1); }
  return rAt;
}
export function createSub(scene, kind = 0) {
  const k = Math.max(0, Math.min(BOATS.length - 1, kind | 0)), B = BOATS[k], g = new Geo(), MET = B.metal, TOP = B.top, LOW = B.low;
  buildBody(g, B, k);
  // Scheinwerfer (bei allen an derselben Stelle, damit der Lichtkegel passt)
  const LAMPS = [[-0.52, -0.6, 0.98], [0.52, -0.6, 0.98]];
  for (const l of LAMPS) { addBlob(g, l[0], l[1], l[2] - 0.05, 0.19, 0.19, 0.22, 1, 2, () => MET, 0, 0, 0); disc(g, [l[0], l[1], l[2] + 0.16], [0, -0.08, 1], 0.14, [0.92, 1.0, 0.9], 1.7); }

  const geo = g.build();
  const mat = paintMaterial();
  const S = new T.Group(); S.rotation.order = 'YXZ'; S.scale.setScalar(1.35);
  const hull = new T.Mesh(geo, mat); hull.frustumCulled = false; S.add(hull);

  // Schraube
  const pg = new Geo(); addBlob(pg, 0, 0, 0, 0.1, 0.1, 0.16, 1, 5, () => METAL, 0, 0, 0);
  for (let i = 0; i < 3; i++) { const a = i * 2.094, c = Math.cos(a), s = Math.sin(a), q = []; for (const [r, w] of [[0.06, 0.05], [0.3, 0.13], [0.5, 0.07]]) { q.push(pg.v(c * r - s * w, s * r + c * w, 0.06, 0, 0, 1, [0.5, 0.42, 0.25]), pg.v(c * r + s * w, s * r - c * w, -0.06, 0, 0, 1, [0.5, 0.42, 0.25])); } pg.quad(q[0], q[1], q[3], q[2]); pg.quad(q[2], q[3], q[5], q[4]); }
  const mp = paintMaterial(T.DoubleSide);
  const prop = new T.Mesh(pg.build(), mp); prop.position.set(0, 0, B.ring + 0.02); prop.frustumCulled = false; S.add(prop);

  // Lichtkegel der Scheinwerfer
  const cp = [], ct = [], ci = [], CS = 20, CR = 7, LEN = 26;
  for (let j = 0; j <= CR; j++) { const t = j / CR, r = 0.3 + t * 8.2; for (let i = 0; i <= CS; i++) { const a = (i / CS) * Math.PI * 2; cp.push(Math.cos(a) * r, Math.sin(a) * r, t * LEN); ct.push(t); } }
  for (let j = 0; j < CR; j++) for (let i = 0; i < CS; i++) { const a = j * (CS + 1) + i; ci.push(a, a + 1, a + CS + 1, a + 1, a + CS + 2, a + CS + 1); }
  const cg = new T.BufferGeometry(); cg.setAttribute('position', new T.BufferAttribute(new Float32Array(cp), 3)); cg.setAttribute('aT', new T.BufferAttribute(new Float32Array(ct), 1)); cg.setIndex(ci);
  const cone = new T.Mesh(cg, new T.ShaderMaterial({ uniforms: uni(), transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    vertexShader: `attribute float aT; varying float vT; varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * vec3(position.xy, -0.25 * length(position.xy)); vT = aT; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; uniform float uLampOn; varying float vT; varying vec3 vW, vN;
      void main(){ float f = abs(dot(normalize(vN), normalize(cameraPosition - vW))); float tt = clamp(vT, 0.0, 1.0); float a = pow(max(1.0 - tt, 0.0), 2.6) * smoothstep(0.0, 0.03, tt) * pow(clamp(f, 0.0, 1.0), 1.7);   // Werte begrenzen: pow mit negativer Basis ergibt auf manchen Grafikchips NaN
        gl_FragColor = vec4(vec3(0.28, 0.60, 0.74) * max(a, 0.0) * 0.24 * uLampOn, 1.0); }` }));
  cone.position.set(0, -0.6, 1.15); cone.rotation.x = 0.1; cone.frustumCulled = false; cone.renderOrder = 8; S.add(cone);

  // weicher Schein um Kuppel und Lampen
  const gt = glowTexture();
  const outer = [hull, prop]; const spr = (x, y, z, s, col, op) => { const m = new T.Sprite(new T.SpriteMaterial({ map: gt, color: new T.Color(col[0], col[1], col[2]), transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(x, y, z); m.scale.set(s, s, 1); m.renderOrder = 9; S.add(m); outer.push(m); return m; };
  const halo = spr(0, 0.15, 0.7, 7.5, [1.0, 0.58, 0.26], 0.5);
  for (const l of LAMPS) spr(l[0], l[1], l[2] + 0.25, 1.5, [0.75, 1.0, 0.85], 0.75);
  spr(0, 1.93, -0.36, 0.5, [1.0, 0.45, 0.2], 0.7);

  // Tiefenruder: zwei Flossen vorn an den Seiten, kippen beim Steigen und Sinken
  const planes = [];
  for (const sx of [-1, 1]) {
    const q = new Geo(), N = 10, pts = [];
    for (let i = 0; i <= N; i++) { const t = i / N, w = 0.17 * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2))) + 0.04; pts.push([sx * (0.05 + t * 0.62), w]); }
    for (let i = 0; i < N; i++) { const [x0, w0] = pts[i], [x1, w1] = pts[i + 1]; for (const s2 of [1, -1]) { const a2 = q.v(x0, 0.025 * s2, -w0, 0, s2, 0, TOP), b2 = q.v(x1, 0.025 * s2, -w1, 0, s2, 0, TOP), c2 = q.v(x1, 0.025 * s2, w1 * 0.7, 0, s2, 0, TOP), d2 = q.v(x0, 0.025 * s2, w0 * 0.7, 0, s2, 0, TOP); if (s2 > 0) q.quad(a2, d2, c2, b2); else q.quad(a2, b2, c2, d2); } }
    const tip = pts[N]; box2(q, [tip[0], 0, 0], [0.04, 0.07, 0.24], LOW);
    const m = new T.Mesh(q.build(), mat); m.frustumCulled = false; const p = new T.Group(); p.position.set(sx * (k === 2 ? 0.92 : 0.86), -0.18, 0.45); p.add(m); S.add(p); planes.push(p); outer.push(p);
    const pin = new Geo(); addTube(pin, [{ x: sx * 0.8, y: -0.18, z: 0.45, r: 0.06 }, { x: sx * 0.92, y: -0.18, z: 0.45, r: 0.06 }], 8, () => MET, 0, 0, true); const pm = new T.Mesh(pin.build(), mat); pm.frustumCulled = false; S.add(pm); outer.push(pm);
  }
  scene.add(S);
  const dispose = () => { scene.remove(S); S.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
  return { kind: k, dispose, group: S, prop, halo, outer, planes, lampLocal: new T.Vector3(0, -0.6, 1.2), warmLocal: new T.Vector3(0, 0.25, 1.9) };
}
