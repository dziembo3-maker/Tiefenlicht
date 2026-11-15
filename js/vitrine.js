// vitrine.js – die Glasvitrine auf dem Schreibtisch: der Pottwalzahn aus der Höhle auf dunklem Samt, Messingrahmen, Messingschild.
// Benutzt Material und Glas der Kabine (aus deren Gruppe gesucht), damit sie im selben warmen Licht steht wie alles andere.
import { T, Geo } from './util.js';
import { quad, tube, box } from './build.js';

const WOOD = -1, MET = 1, BRASS = [0.78, 0.56, 0.24], WD3 = [0.2, 0.115, 0.065], IVORY = [0.9, 0.86, 0.74];
/** Gitter der Kabine braucht zusätzlich Holzkoordinaten und Verschattung (hier: keine Planke, volle Helligkeit) */
function cabinGeo(g) { const geo = g.build(), n = geo.attributes.position.count, uv = new Float32Array(n * 3); for (let i = 0; i < n; i++) uv[i * 3 + 2] = -1; geo.setAttribute('aUV', new T.BufferAttribute(uv, 3)); geo.setAttribute('aAO', new T.BufferAttribute(new Float32Array(n).fill(1), 1)); return geo; }

export function addVitrine(cabin) {
  const inner = cabin.group.children[0]; let mat = null, glassMat = null;
  inner.traverse((o) => { const m = o.material; if (!o.isMesh || !m || !m.uniforms || !m.uniforms.uWood) return; if (m.transparent) glassMat = glassMat || m; else mat = mat || m; });
  const C = [0.86, 0.767, -0.535], CW = 0.085, CD = 0.064, CH = 0.15, g = new Geo();
  const at = (p) => [C[0] + p[0], C[1] + p[1], C[2] + p[2]];
  // Sockel aus dunklem Holz, darauf Samt
  box(g, at([0, 0.013, 0]), [CW * 2 + 0.02, 0.026, CD * 2 + 0.02], 0, WD3, 0, 0, WOOD); box(g, at([0, 0.028, 0]), [CW * 2 - 0.006, 0.005, CD * 2 - 0.006], 0, [0.3, 0.07, 0.08]);
  // Messingrahmen: vier Stäbe, oben ein Rahmen; vorn ein Schildchen
  for (const [x, z] of [[-CW, -CD], [CW, -CD], [CW, CD], [-CW, CD]]) tube(g, [at([x, 0.026, z]), at([x, CH, z])], 0.0035, 0.0035, 5, BRASS, 0, MET);
  for (const [a, b] of [[[-CW, CH, -CD], [CW, CH, -CD]], [[CW, CH, -CD], [CW, CH, CD]], [[CW, CH, CD], [-CW, CH, CD]], [[-CW, CH, CD], [-CW, CH, -CD]]]) tube(g, [at(a), at(b)], 0.0035, 0.0035, 5, BRASS, 0, MET);
  box(g, at([0, 0.016, CD + 0.012]), [0.06, 0.014, 0.002], 0, BRASS, 0, 0, MET);
  // der Zahn: kegelig, leicht gebogen, liegt schräg auf dem Samt
  const tp = []; for (let k = 0; k <= 8; k++) { const f = k / 8, a = 0.5; tp.push(at([(-0.06 + f * 0.12) * Math.cos(a) - Math.sin(f * 1.6) * 0.008 * Math.sin(a), 0.047 + Math.sin(f * 2.4) * 0.014 - f * 0.012, -(-0.06 + f * 0.12) * Math.sin(a) + Math.sin(f * 1.6) * 0.008])); }
  tube(g, tp, tp.map((_, k) => 0.0185 * Math.pow(1 - k / 8, 0.55) + 0.002), 0, 9, IVORY);
  // Wurzel: der Zahn ist unten zu, mit einer flach gewölbten, etwas dunkleren Fläche (gleicher Ring wie der erste des Rohrs)
  { const a = tp[0], b = tp[1], r = 0.0205, l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), tv = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l], rf = Math.abs(tv[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    const cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], nz = (p) => { const k = Math.hypot(p[0], p[1], p[2]) || 1; return [p[0] / k, p[1] / k, p[2] / k]; }, u = nz(cr(tv, rf)), w = cr(tv, u), ROOT = [0.8, 0.73, 0.58];
    const c0 = g.v(a[0] - tv[0] * r * 0.3, a[1] - tv[1] * r * 0.3, a[2] - tv[2] * r * 0.3, -tv[0], -tv[1], -tv[2], ROOT), ring = [];
    for (let i = 0; i < 9; i++) { const an = i / 9 * Math.PI * 2, ox = u[0] * Math.cos(an) + w[0] * Math.sin(an), oy = u[1] * Math.cos(an) + w[1] * Math.sin(an), oz = u[2] * Math.cos(an) + w[2] * Math.sin(an), n = nz([ox * 0.6 - tv[0], oy * 0.6 - tv[1], oz * 0.6 - tv[2]]); ring.push(g.v(a[0] + ox * r, a[1] + oy * r, a[2] + oz * r, n[0], n[1], n[2], ROOT)); }
    for (let i = 0; i < 9; i++) g.tri(c0, ring[i], ring[(i + 1) % 9]); }
  const solid = new T.Mesh(cabinGeo(g), mat); solid.frustumCulled = false; inner.add(solid);
  // Glas: fünf Scheiben im Glanz-Material der Kuppel (zweiter Durchgang, additiv)
  const cg = new Geo(), P8 = (sx, y, sz) => at([sx * CW, y, sz * CD]);
  for (const [a, b, c, d] of [[P8(-1, 0.026, -1), P8(1, 0.026, -1), P8(1, CH, -1), P8(-1, CH, -1)], [P8(1, 0.026, -1), P8(1, 0.026, 1), P8(1, CH, 1), P8(1, CH, -1)], [P8(1, 0.026, 1), P8(-1, 0.026, 1), P8(-1, CH, 1), P8(1, CH, 1)], [P8(-1, 0.026, 1), P8(-1, 0.026, -1), P8(-1, CH, -1), P8(-1, CH, 1)], [P8(-1, CH, -1), P8(1, CH, -1), P8(1, CH, 1), P8(-1, CH, 1)]]) quad(cg, a, b, c, d, [1, 1, 1]);
  const glass = new T.Mesh(cg.build(), glassMat); glass.frustumCulled = false; glass.renderOrder = 2; glass.layers.set(1); inner.add(glass);
  const V = { set visible(v) { solid.visible = glass.visible = v; } };
  V.visible = false; return V;
}
