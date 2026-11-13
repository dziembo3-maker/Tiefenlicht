// build.js – Bausteine für Modelle aus Flächen: Viereck, Rohr, Scheibe, Kiste, Drehkörper, Ring.
// fl: -1 = Holz (Maserung), 1 = Glas/Metallglanz, 2 = flackerndes Leuchten;  em = Eigenleuchten
import { T } from './util.js';

const tv = new T.Vector3(), u = new T.Vector3(), w = new T.Vector3(), ref = new T.Vector3();

export function quad(g, a, b, c, d, col, em = 0, fl = 0) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const i = [a, b, c, d].map((p) => g.v(p[0], p[1], p[2], nx, ny, nz, col, fl, em)); g.quad(i[0], i[1], i[2], i[3]);
}
export function tri(g, a, b, c, col, em = 0, fl = 0) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
  const i = [a, b, c].map((p) => g.v(p[0], p[1], p[2], nx / l, ny / l, nz / l, col, fl, em)); g.tri(i[0], i[1], i[2]);
}
/** Rohr entlang von Punkten; r0..r1 oder eine Liste von Radien */
export function tube(g, pts, r0, r1, sides, col, em = 0, fl = 0, closed = false) {
  const base = g.count, n = pts.length;
  for (let j = 0; j < n; j++) {
    const a = pts[closed ? (j - 1 + n) % n : Math.max(0, j - 1)], c = pts[closed ? (j + 1) % n : Math.min(n - 1, j + 1)], p = pts[j], r = Array.isArray(r0) ? r0[j] : r0 + (r1 - r0) * (n > 1 ? j / (n - 1) : 0);
    tv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize(); ref.set(0, 0, 1); if (Math.abs(tv.z) > 0.9) ref.set(0, 1, 0); u.crossVectors(tv, ref).normalize(); w.crossVectors(tv, u);
    for (let i = 0; i < sides; i++) { const an = (i / sides) * Math.PI * 2 + (sides === 4 ? Math.PI / 4 : 0), ca = Math.cos(an), sa = Math.sin(an), ox = u.x * ca + w.x * sa, oy = u.y * ca + w.y * sa, oz = u.z * ca + w.z * sa; g.v(p[0] + ox * r, p[1] + oy * r, p[2] + oz * r, ox, oy, oz, col, fl, em); }
  }
  const m = closed ? n : n - 1;
  for (let j = 0; j < m; j++) for (let i = 0; i < sides; i++) { const a = base + j * sides + i, c = base + j * sides + (i + 1) % sides, d = base + ((j + 1) % n) * sides + i, e = base + ((j + 1) % n) * sides + (i + 1) % sides; g.tri(a, c, d); g.tri(c, e, d); }
}
export function disc(g, c, n, r, col, em = 0, sides = 10, fl = 0) {
  const N = new T.Vector3(n[0], n[1], n[2]).normalize(), a = new T.Vector3().crossVectors(N, Math.abs(N.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0)).normalize(), b = new T.Vector3().crossVectors(N, a);
  const ci = g.v(c[0], c[1], c[2], N.x, N.y, N.z, col, fl, em), ring = [];
  for (let i = 0; i < sides; i++) { const t = (i / sides) * Math.PI * 2, ca = Math.cos(t) * r, sa = Math.sin(t) * r; ring.push(g.v(c[0] + a.x * ca + b.x * sa, c[1] + a.y * ca + b.y * sa, c[2] + a.z * ca + b.z * sa, N.x, N.y, N.z, col, fl, em)); }
  for (let i = 0; i < sides; i++) g.tri(ci, ring[i], ring[(i + 1) % sides]);
}
/** Kiste um ihren Mittelpunkt, gedreht um y (rotY), dann gekippt um x (rotX) und z (rotZ) */
export function box(g, c, s, rotY, col, em = 0, rotX = 0, fl = 0, rotZ = 0) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX), cz = Math.cos(rotZ), sz = Math.sin(rotZ);
  const P = (x, y, z) => { const x1 = x * cz - y * sz, y1 = x * sz + y * cz, y2 = y1 * cx - z * sx, z2 = y1 * sx + z * cx; return [c[0] + x1 * cy + z2 * sy, c[1] + y2, c[2] - x1 * sy + z2 * cy]; };
  const h = [s[0] / 2, s[1] / 2, s[2] / 2], v = [];
  for (const [x, y, z] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) v.push(P(x * h[0], y * h[1], z * h[2]));
  for (const [a, b, c2, d, k] of [[0, 3, 2, 1, 0.82], [4, 5, 6, 7, 0.9], [0, 4, 7, 3, 0.76], [1, 2, 6, 5, 0.94], [3, 7, 6, 2, 1.08], [0, 1, 5, 4, 0.6]]) quad(g, v[a], v[b], v[c2], v[d], col.map((q) => q * k), em, fl);
}
/** Drehkörper um eine Achse ('x','y','z') durch o; prof = [[Höhe entlang der Achse, Radius], ...] */
export function lathe(g, o, axis, prof, sides, col, em = 0, fl = 0) {
  const base = g.count, n = prof.length, A = axis === 'y' ? [[0, 0, 1], [0, 1, 0], [1, 0, 0]] : axis === 'z' ? [[1, 0, 0], [0, 0, 1], [0, 1, 0]] : [[0, 1, 0], [1, 0, 0], [0, 0, 1]];   // [u, Achse, v]
  for (let j = 0; j < n; j++) {
    const [h, r] = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(n - 1, j + 1)], dh = b[0] - a[0], dr = b[1] - a[1], l = Math.hypot(dh, dr) || 1, nr = dh / l, nh = -dr / l, c = typeof col === 'function' ? col(j / (n - 1)) : col;
    for (let i = 0; i <= sides; i++) {
      const t = (i / sides) * Math.PI * 2, ca = Math.cos(t), sa = Math.sin(t), P = (ru, rh, rv) => [A[0][0] * ru + A[1][0] * rh + A[2][0] * rv, A[0][1] * ru + A[1][1] * rh + A[2][1] * rv, A[0][2] * ru + A[1][2] * rh + A[2][2] * rv];
      const p = P(ca * r, h, sa * r), q = P(ca * nr, nh, sa * nr); g.v(o[0] + p[0], o[1] + p[1], o[2] + p[2], q[0], q[1], q[2], c, fl, em);
    }
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) { const a = base + j * (sides + 1) + i, b = a + 1, c = a + sides + 1, d = c + 1; g.tri(a, b, c); g.tri(b, d, c); }
}
/** Ring (Torus) um c mit Achse n: großer Radius R, Rohrradius r */
export function ring(g, c, n, R, r, segs, sides, col, em = 0, fl = 0) {
  const N = new T.Vector3(n[0], n[1], n[2]).normalize(), a = new T.Vector3().crossVectors(N, Math.abs(N.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0)).normalize(), b = new T.Vector3().crossVectors(N, a), base = g.count;
  for (let i = 0; i < segs; i++) { const t = (i / segs) * Math.PI * 2, ex = a.x * Math.cos(t) + b.x * Math.sin(t), ey = a.y * Math.cos(t) + b.y * Math.sin(t), ez = a.z * Math.cos(t) + b.z * Math.sin(t);
    for (let k = 0; k < sides; k++) { const f = (k / sides) * Math.PI * 2, cf = Math.cos(f), sf = Math.sin(f), nx = ex * cf + N.x * sf, ny = ey * cf + N.y * sf, nz = ez * cf + N.z * sf; g.v(c[0] + ex * R + nx * r, c[1] + ey * R + ny * r, c[2] + ez * R + nz * r, nx, ny, nz, col, fl, em); } }
  for (let i = 0; i < segs; i++) for (let k = 0; k < sides; k++) { const p = base + i * sides + k, q = base + i * sides + (k + 1) % sides, p2 = base + ((i + 1) % segs) * sides + k, q2 = base + ((i + 1) % segs) * sides + (k + 1) % sides; g.tri(p, p2, q); g.tri(q, p2, q2); }
}
