// garten.js – die hängenden Gärten an der Tiefseewand (Kapitel 2): Glasschwämme mit Gitterwänden, leuchtende Bambuskorallen, Federsterne,
// Leuchtpilze, purpurne Röhrenschwämme und hängende Glasschleier. Alles wächst in Bauteilen entlang +y (Einheit 1 = Größe im Spiel),
// eine Instanz je Stück; an der Wand dreht man es mit pitch/roll von der Wand weg (oder kopfüber für die hängenden Teile).
// Benutzung: const G = createGarden(scene); G.venus.list = [{ x, y, z, size, yaw, pitch, roll, seed }]; G.venus.sync();
import { T } from './util.js';
import { uni, COMMON } from './gfx.js';

const PI = Math.PI, TAU = PI * 2;
const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Gitter-Baukasten wie bei den Tieren: aK = (Höhe 0…1 im Stück, Teil, entlang 0…1, rundherum 0…1)
class Build {
  constructor() { this.P = []; this.N = []; this.K = []; this.I = []; this.n = 0; }
  grid(nu, nv, pos, key, wrap, out) {
    const b = this.n, pts = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = pos(i, j); pts.push(p); this.P.push(p[0], p[1], p[2]); this.K.push(...key(i, j, p)); this.n++; }
    const at = (i, j) => { i = i < 0 ? 0 : i > nu ? nu : i; if (wrap) j = ((j % nv) + nv) % nv; else j = j < 0 ? 0 : j > nv ? nv : j; return pts[i * (nv + 1) + j]; };
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const a = at(i + 1, j), c = at(i - 1, j), d = at(i, j + 1), e = at(i, j - 1), p = pts[i * (nv + 1) + j];
      const ux = a[0] - c[0], uy = a[1] - c[1], uz = a[2] - c[2], vx = d[0] - e[0], vy = d[1] - e[1], vz = d[2] - e[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) { if (out) { const o = out(i, j); nx = p[0] - o[0]; ny = p[1] - o[1]; nz = p[2] - o[2]; l = Math.hypot(nx, ny, nz) || 1; } else { nx = 0; ny = 1; nz = 0; l = 1; } }
      nx /= l; ny /= l; nz /= l;
      if (out) { const o = out(i, j); if ((p[0] - o[0]) * nx + (p[1] - o[1]) * ny + (p[2] - o[2]) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; } }
      this.N.push(nx, ny, nz);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = b + i * (nv + 1) + j, c = a + nv + 1; this.I.push(a, c, a + 1, a + 1, c, c + 1); }
  }
  /** Röhre um eine Mittellinie; rad(s, a) darf rundherum schwanken (Wellenrand) */
  tube(pts, rad, sides, key) {
    const n = pts.length - 1, F = frames(pts);
    this.grid(n, sides, (i, j) => { const a = j / sides * TAU, f = F[i], r = rad(i / n, j / sides); return add(pts[i], add(f.n.map((x) => x * Math.cos(a)), f.b, Math.sin(a)), r); },
      (i, j, p) => key(i / n, j / sides, p), true, (i) => pts[i]);
  }
  ellipsoid(c, rx, ry, rz, key, nu = 8, nv = 12, cut = 1) {
    this.grid(nu, nv, (i, j) => { const f = i / nu * PI * cut, a = j / nv * TAU; return [c[0] + rx * Math.sin(f) * Math.cos(a), c[1] + ry * Math.cos(f), c[2] + rz * Math.sin(f) * Math.sin(a)]; },
      (i, j, p) => key(i / nu, j / nv, p), true, () => c);
  }
  geo() {
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.P), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.N), 3));
    g.setAttribute('aK', new T.BufferAttribute(new Float32Array(this.K), 4)); g.setIndex(this.I); return g;
  }
}
function frames(pts) {
  const F = []; let nPrev = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = norm(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let n; if (!nPrev) { const up = Math.abs(t[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]; n = norm(...cross(cross(t, up), t)); } else { const d = nPrev[0] * t[0] + nPrev[1] * t[1] + nPrev[2] * t[2]; n = norm(nPrev[0] - t[0] * d, nPrev[1] - t[1] * d, nPrev[2] - t[2] * d); }
    nPrev = n; F.push({ t, n, b: cross(t, n) });
  }
  return F;
}
/** sanft gebogene Linie von a in Richtung d, Länge L, mit Biegung bend (Vektor) */
const curve = (a, d, L, bend, n) => { const pts = []; for (let i = 0; i <= n; i++) { const q = i / n; pts.push([a[0] + d[0] * L * q + bend[0] * q * q, a[1] + d[1] * L * q + bend[1] * q * q, a[2] + d[2] * L * q + bend[2] * q * q]); } return pts; };

// ---------- Gießkannenschwamm (Venuskörbchen): drei bis vier weiße Gitterröhren aus einem Fuß, oben ein Siebdeckel mit Krause ----------
function buildVenus() {
  const B = new Build(), R = rng(11);
  const tubes = [[0, 0, 1.0, 0.0, 0.0], [0.13, -0.05, 0.8, 0.28, -0.1], [-0.12, 0.04, 0.72, -0.3, 0.12], [0.03, 0.12, 0.6, 0.06, 0.32]];
  for (const [x0, z0, H, lx, lz] of tubes) {
    const pts = curve([x0, 0, z0], norm(lx * 0.6, 1, lz * 0.6), H, [lx * 0.15, 0, lz * 0.15], 30);
    const rad = (s, a) => { const r = 0.035 + 0.075 * Math.pow(Math.sin(Math.min(1, s * 1.15) * PI * 0.5), 0.8) - 0.012 * Math.max(0, (s - 0.85) / 0.15); return r * H * (1 + 0.04 * Math.sin(a * TAU * 6 + s * 9)); };
    B.tube(pts, rad, 22, (s, a) => [s * H, 0, s, a]);
    // Siebdeckel: flache Kuppel oben, Krause rundherum
    const top = pts[pts.length - 1], F = frames(pts)[pts.length - 1], rt = rad(1, 0);
    B.grid(6, 22, (i, j) => { const f = i / 6, a = j / 22 * TAU, r = rt * f, h = 0.012 * H * (1 - f * f); return add(add(top, add(F.n.map((x) => x * Math.cos(a)), F.b, Math.sin(a)), r), F.t, h); },
      (i, j) => [H, 1, i / 6, j / 22], true, () => add(top, F.t, -1));
    B.grid(4, 44, (i, j) => { const f = i / 4, a = j / 44 * TAU, r = rt * (1 + 0.28 * f) + 0.01 * H * Math.sin(a * 11) * f, h = -0.03 * H * f + 0.012 * H * Math.sin(a * 7) * f; return add(add(top, add(F.n.map((x) => x * Math.cos(a)), F.b, Math.sin(a)), r), F.t, h - 0.01 * H); },
      (i, j) => [H, 2, i / 4, j / 44], false);
  }
  // Wurzelschopf: feine Glasfäden in den Fels
  for (let k = 0; k < 14; k++) { const a = R() * TAU, pts = curve([Math.cos(a) * 0.03, 0.02, Math.sin(a) * 0.03], norm(Math.cos(a), -0.6, Math.sin(a)), 0.12 + R() * 0.1, [0, -0.03, 0], 6); B.tube(pts, (s) => 0.003 * (1 - s) + 0.0008, 4, () => [0, 3, 0, 0]); }
  return B.geo();
}
// ---------- Kelchschwamm: auf kurzem Stiel ein weiter, gewellter Trichter mit Gitterwand ----------
function buildCup() {
  const B = new Build();
  const pts = curve([0, 0, 0], [0, 1, 0], 1, [0.06, 0, 0.03], 30);
  B.tube(pts, (s, a) => { const r = 0.05 + 0.5 * Math.pow(Math.max(0, s - 0.18) / 0.82, 1.6) + 0.025 * Math.sin(s * PI); return r * (1 + (0.1 * Math.sin(a * TAU * 5) + 0.05 * Math.sin(a * TAU * 3 + 1)) * Math.pow(s, 3)); }, 30, (s, a) => [s, 0, s, a]);
  // Boden des Kelchs, damit man nicht durchsieht
  B.grid(4, 30, (i, j) => { const f = i / 4, a = j / 30 * TAU, r = 0.07 * f; return [0.0105 + Math.cos(a) * r, 0.3, 0.005 + Math.sin(a) * r]; }, (i, j) => [0.3, 1, i / 4, j / 30], true, () => [0, 0, 0]);
  return B.geo();
}
// ---------- hängender Glasschleier: oben breit an der Decke angewachsen, nach unten eine lange, gedrehte Gitterglocke mit Fransen ----------
function buildDrape() {
  const B = new Build();
  const pts = []; for (let i = 0; i <= 34; i++) { const q = i / 34; pts.push([0.05 * Math.sin(q * 3), -q, 0.04 * Math.sin(q * 2.2)]); }
  B.tube(pts, (s, a) => { const r = 0.26 * Math.pow(1 - s, 0.55) + 0.02 + 0.06 * Math.sin(s * PI) ; return r * (1 + 0.12 * Math.sin(a * TAU * 4 + s * 6) * s); }, 26, (s, a) => [s, 0, s, a]);
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU, p0 = [0.05 * Math.sin(3) + Math.cos(a) * 0.04, -0.98, 0.04 * Math.sin(2.2) + Math.sin(a) * 0.04], pts2 = curve(p0, norm(Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3), 0.18 + 0.12 * Math.abs(Math.sin(k * 2.7)), [0, 0, 0], 6);
    B.tube(pts2, (s) => 0.004 * (1 - s) + 0.001, 4, (s) => [1, 3, s, 0]); }
  return B.geo();
}
// ---------- Bambuskoralle: verzweigter Fächer, dunkle Glieder, die Spitzen leuchten türkis ----------
function buildCoral() {
  const B = new Build(), R = rng(7);
  const branch = (p, d, L, r, depth) => {
    const bend = [(R() - 0.5) * 0.12 * L, 0.04 * L, (R() - 0.5) * 0.05 * L], pts = curve(p, d, L, bend, 8), end = pts[pts.length - 1], tip = depth === 0;
    B.tube(pts, (s) => r * (1 - 0.3 * s) + 0.0025, 6, (s, a, q) => [q[1], tip ? 2 : 1, s, a]);
    if (depth > 0) { const n = depth >= 4 ? 3 : 2 + (R() < 0.45 ? 1 : 0); for (let k = 0; k < n; k++) { const sp = (k - (n - 1) / 2) * (depth >= 4 ? 0.7 : 0.5) + (R() - 0.5) * 0.3, cs = Math.cos(sp), sn = Math.sin(sp), dir = norm(d[0] * cs - d[1] * sn, d[0] * sn + d[1] * cs, d[2] * 0.5 + (R() - 0.5) * 0.3);
      branch(end, dir, L * (0.72 + R() * 0.16), r * 0.72, depth - 1); } }
    else B.ellipsoid(end, r * 2.2 + 0.004, r * 2.2 + 0.004, r * 2.2 + 0.004, (q, a, p2) => [p2[1], 2, 1, a], 4, 8);
  };
  branch([0, 0, 0], [0, 1, 0], 0.2, 0.03, 5);
  B.ellipsoid([0, 0, 0], 0.06, 0.03, 0.06, (q, a) => [0, 1, 0, a], 4, 10);
  return B.geo();
}
// ---------- Federstern (Seelilie): kurzer Stiel, kleiner Kelch, zwanzig gefiederte Arme rundum wie eine Sonne, leicht zur Strömung gewölbt ----------
function buildCrinoid() {
  const B = new Build(), R = rng(3), H = 0.22;
  B.tube(curve([0, 0, 0], [0, 1, 0], H, [0.02, 0, 0.01], 12), (s) => 0.014 - 0.004 * s, 6, (s, a, q) => [q[1], 1, s, a]);
  const top = [0.02, H + 0.03, 0.01];
  B.ellipsoid(top, 0.04, 0.035, 0.035, (q, a, p) => [p[1], 1, q, a], 5, 10);
  for (let k = 0; k < 15; k++) {
    const a = k / 15 * TAU + R() * 0.12, dir = norm(Math.cos(a), Math.sin(a), 0.35), L = 0.34 + R() * 0.08;
    const pts = curve(top, dir, L, [0, -0.04, 0.12], 22), F = frames(pts);   // Fiederchen nur an jedem zweiten Punkt, dafür breiter
    B.tube(pts, (s) => 0.007 * (1 - 0.7 * s) + 0.0015, 5, (s, b, q) => [0.3 + 0.7 * s, 3, s, b]);
    for (let i = 2; i < 22; i++) { const s = i / 22, p = pts[i], f = F[i], side = i % 2 ? 1 : -1, l = 0.05 * (1 - 0.55 * s) + 0.008, dd = norm(...add(f.b.map((x) => x * side), f.t, 0.6));
      B.tube([p, add(add(p, dd, l * 0.6), f.n, 0.006), add(add(p, dd, l), f.n, 0.003)], (u) => 0.0026 * (1 - u) + 0.0006, 3, () => [0.3 + 0.7 * s, 4, s, 0]); }
  }
  return B.geo();
}
// ---------- Leuchtpilze: kleine Gruppe Pilzpolypen, die Hüte leuchten blau ----------
function buildMush() {
  const B = new Build(), R = rng(21);
  const set = [[0, 0, 0.55, 0.16], [0.18, 0.06, 0.38, 0.12], [-0.15, 0.1, 0.42, 0.11], [0.06, -0.17, 0.28, 0.09], [-0.08, -0.12, 0.22, 0.07]];
  for (const [x, z, h, r] of set) {
    const lean = [(R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3], pts = curve([x, 0, z], norm(...lean), h, [(R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.08], 10), top = pts[10];
    B.tube(pts, (s) => r * 0.22 * (1 - 0.3 * s) + 0.004, 8, (s, a) => [s * h, 1, s, a]);
    // Hut: oben gewölbt, unten mit leuchtenden Lamellen
    B.grid(8, 24, (i, j) => { const f = i / 8, a = j / 24 * TAU, rr = r * Math.sin(f * PI * 0.55) / Math.sin(PI * 0.55), y = r * 0.55 * Math.cos(f * PI * 0.55) - r * 0.2; return [top[0] + Math.cos(a) * rr, top[1] + y, top[2] + Math.sin(a) * rr]; },
      (i, j) => [h, 2, i / 8, j / 24], true, () => [top[0], top[1] - r, top[2]]);
    B.grid(4, 24, (i, j) => { const f = i / 4, a = j / 24 * TAU, rr = r * (0.2 + 0.8 * f), y = -r * 0.2 + r * 0.12 * (1 - f) - 0.01 * Math.sin(a * 14) * f; return [top[0] + Math.cos(a) * rr, top[1] + y - r * 0.05, top[2] + Math.sin(a) * rr]; },
      (i, j) => [h, 3, i / 4, j / 24], true, () => [top[0], top[1] + r, top[2]]);
  }
  return B.geo();
}
// ---------- Röhrenschwämme: purpurne Kolben, unten schmal, oben bauchig mit dunkler Öffnung ----------
function buildTubes() {
  const B = new Build(), R = rng(5);
  const set = [[0, 0, 0.7], [0.12, 0.05, 0.52], [-0.1, 0.07, 0.6], [0.04, -0.12, 0.42], [-0.06, -0.1, 0.33], [0.15, -0.08, 0.28]];
  for (const [x, z, h] of set) {
    const pts = curve([x, 0, z], norm((R() - 0.5) * 0.35 + x, 1, (R() - 0.5) * 0.35 + z), h, [x * 0.2, 0, z * 0.2], 18);
    B.tube(pts, (s) => { const r = 0.025 + 0.055 * Math.pow(Math.sin(Math.min(1, s * 1.12) * PI * 0.62), 2) - 0.022 * Math.max(0, (s - 0.9) / 0.1); return r * h / 0.6; }, 14, (s, a) => [s * h, 1, s, a]);
    const top = pts[18], F = frames(pts)[18], rt = 0.033 * h / 0.6;
    B.grid(3, 14, (i, j) => { const f = i / 3, a = j / 14 * TAU; return add(add(top, add(F.n.map((v) => v * Math.cos(a)), F.b, Math.sin(a)), rt * (1 - f)), F.t, -0.02 * f); }, (i, j) => [h, 2, i / 3, j / 14], true, () => add(top, F.t, 1));
  }
  return B.geo();
}

// ---------- Fächerkoralle (Gorgonie): großer flacher Fächer aus purpurnen Ästen, dazwischen ein feines Netz; die Polypen leuchten magenta, an den Rändern türkis ----------
function buildFan() {
  const B = new Build(), R = rng(31);
  const outline = (th) => 0.92 * (1 - 0.22 * th * th) + 0.05 * Math.sin(th * 7 + 1) + 0.03 * Math.sin(th * 13);
  const cupZ = (x, y) => 0.08 * x * x - 0.03 * y;   // leicht gewölbt, wie in die Strömung gestellt
  // Netz: Fläche im Fächerumriss, das Muster schneidet später die Löcher
  B.grid(26, 44, (i, j) => { const r = 0.06 + 0.94 * i / 26, th = (j / 44 - 0.5) * 2.3, R0 = outline(th) * r, x = Math.sin(th) * R0, y = Math.cos(th) * R0 * 0.95 + 0.04; return [x, y, cupZ(x, y)]; },
    (i, j, p) => [p[1], 0, i / 26, j / 44], false);
  // Äste: vom Fuß aus in der Fächerebene verzweigt
  const branch = (p, th, L, r, depth) => {
    const pts = []; const th2 = th + (R() - 0.5) * 0.25;
    for (let i = 0; i <= 8; i++) { const q = i / 8, a = th + (th2 - th) * q, x = p[0] + Math.sin(a) * L * q, y = p[1] + Math.cos(a) * L * q * 0.95; pts.push([x, y, cupZ(x, y) + 0.004]); }
    B.tube(pts, (q) => r * (1 - 0.35 * q) + 0.0016, 5, (q, a, pp) => [pp[1], 1, q, a]);
    const end = pts[8], rr = Math.hypot(end[0], end[1] - 0.04), lim = outline(Math.atan2(end[0], end[1] - 0.04));
    if (depth > 0 && rr < lim * 0.97) { const n = 2; for (let k = 0; k < n; k++) branch(end, th2 + (k ? 1 : -1) * (0.18 + R() * 0.25), Math.min(L * (0.78 + R() * 0.2), lim - rr + 0.02), r * 0.72, depth - 1); }
  };
  for (const th of [-0.75, -0.25, 0.25, 0.75]) branch([0, 0.03, 0], th * 0.6, 0.22, 0.011, 5);
  B.tube(curve([0, -0.04, 0], [0, 1, 0], 0.09, [0, 0, 0], 4), (q) => 0.03 - 0.008 * q, 8, (q, a, pp) => [pp[1], 1, q, a]);
  B.ellipsoid([0, -0.03, 0], 0.07, 0.03, 0.05, (q, a) => [0, 1, 0, a], 4, 10);
  return B.geo();
}
// ---------- Seefeder: hoher Stiel mit gefiederten Blattpolstern; Leuchtwellen laufen von unten nach oben, türkis über violett nach magenta ----------
function buildPen() {
  const B = new Build(), R = rng(41), H = 1.0;
  const pts = curve([0, 0, 0], [0, 1, 0], H, [0.08, 0, 0.04], 30);
  B.tube(pts, (q) => 0.03 * (1 - 0.55 * q) + 0.006 + 0.012 * Math.exp(-q * 18), 8, (q, a, pp) => [pp[1], 1, q, a]);
  const F = frames(pts);
  for (let k = 0; k < 30; k++) {
    const q = 0.28 + 0.68 * k / 30, idx = Math.round(q * 30), p = pts[idx], f = F[idx];
    for (const side of [-1, 1]) {
      const L = (0.25 * Math.sin(Math.min(1, (q - 0.22) / 0.78) * PI * 0.92) + 0.03) * (0.9 + R() * 0.2), out = norm(...add(f.b.map((v) => v * side), f.t, 0.55 + 0.25 * q));
      B.grid(6, 8, (i, j) => { const a = i / 6, b = j / 8 - 0.5, w = 0.035 * Math.sin(PI * Math.min(1, a * 1.05 + 0.08)) * (1 + 0.5 * a);
        return add(add(add(p, out, L * a), f.t, b * w * 1.6), f.n, 0.012 * Math.sin(PI * a) - 0.02 * a * a + 0.01 * b * b); },
        (i, j) => [q, 2, i / 6, j / 8], false);
    }
  }
  B.ellipsoid([0, 0, 0], 0.05, 0.035, 0.05, (q, a) => [0, 1, 0, a], 4, 10);
  return B.geo();
}

// ======================= Shader =======================
const VS = /* glsl */ `attribute vec4 aK; attribute vec4 iP, iR, iA; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  void main(){ vec3 p = position, nr = normal; float h = aK.x, sd = iA.x;
    float sw = h * h; p.x += sin(uTime * 0.55 + sd * 6.0 + h * 1.5) * 0.03 * sw; p.z += cos(uTime * 0.43 + sd * 4.0 + h * 1.2) * 0.025 * sw;   // ganz leichtes Wiegen in der Strömung
    vL = p; p *= iP.w;
    float cy = cos(iR.x), sy = sin(iR.x), cp = cos(iR.y), sp = sin(iR.y), cr = cos(iR.z), sr = sin(iR.z);
    mat3 Rr = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0), Rp = mat3(1.0, 0.0, 0.0, 0.0, cp, -sp, 0.0, sp, cp), Ry = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
    mat3 R = Ry * Rp * Rr; vec3 w = R * p + iP.xyz; vN = R * nr; vW = w; vK = aK; vI = iA.xy;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`;
const FHEAD = /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vL; varying vec4 vK; varying vec2 vI;
  float lampHit(vec3 wp){ vec3 L = wp - uLampPos; float d = length(L); return smoothstep(0.84, 0.97, dot(L / max(d, 0.001), uLampDir)) * uLampOn * 6.0 / (3.0 + d * d * 0.04); }
  vec3 gloss(vec3 N, vec3 V, vec3 wp, float pw){ vec3 L = normalize(uLampPos - wp); return vec3(0.75, 0.92, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), pw) * lampHit(wp); }
  // Gitter aus Quer-, Längs- und zwei Schräglinien (wie beim echten Glasschwamm); w = Linienbreite in Zellen
  float lattice(vec2 g, float w){ vec2 f = abs(fract(g) - 0.5); vec2 d = abs(fract(vec2(g.x + g.y, g.x - g.y) * 0.5) - 0.5); vec2 fw = fwidth(g) * 0.75 + 0.0001;
    float a = max(smoothstep(0.5 - w - fw.x, 0.5 - w, f.x), smoothstep(0.5 - w - fw.y, 0.5 - w, f.y)); float b = max(smoothstep(0.5 - w * 0.7 - fw.x, 0.5 - w * 0.7, d.x), smoothstep(0.5 - w * 0.7 - fw.y, 0.5 - w * 0.7, d.y));
    return max(a, b * 0.85); }
  void main(){ vec3 N0 = normalize(vN), V = normalize(cameraPosition - vW); bool outer = dot(N0, V) > 0.0; vec3 N = outer ? N0 : -N0;
    float h = vK.x, part = vK.y, vv = vK.z, u = vK.w, seed = vI.x; vec3 base = vec3(0.1), glow = vec3(0.0); float spec = 0.2, pw = 24.0, fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
    float pulse = 0.8 + 0.2 * sin(uTime * 0.9 + seed * 5.0 + h * 2.0);`.replace('void main(){', 'float h21g(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n  void main(){');
const FTAIL = /* glsl */ `
    vec3 c = shade(base, N, vW) * 1.2 + base * 0.04 + waterCol(reflect(-V, N)) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.15 + gloss(N, V, vW, pw) * spec;
    c += glow + (base * 0.6 + vec3(0.04, 0.08, 0.12)) * REST * (0.3 + fr * 1.2);
    gl_FragColor = vec4(fog(c, vW), 1.0); }`;
const GLASS = /* glsl */ `
      float ln = lattice(vec2(u * NA, vv * NV), 0.1); if (ln < 0.35) discard;
      vec3 tint = seed < 0.4 ? vec3(0.78, 0.86, 0.9) : seed < 0.7 ? vec3(0.6, 0.9, 0.86) : vec3(0.84, 0.74, 0.94), tg = seed < 0.4 ? vec3(0.55, 0.85, 1.0) : seed < 0.7 ? vec3(0.3, 1.0, 0.85) : vec3(0.8, 0.5, 1.0);
      base = tint * (outer ? 1.0 : 0.6) * (0.85 + 0.15 * texture2D(uNoise, vec2(u * 3.0, vv * 2.0)).r);
      glow = tg * (0.12 + 0.25 * fr) * pulse; spec = 1.2; pw = 40.0;`;
const FS = {
  fan: FHEAD + /* glsl */ `
    float n1 = texture2D(uNoise, vec2(u * 2.0 + seed, vv * 1.5)).r;
    if (part < 0.5) {
      // Netz: verzerrte Maschen, mal enger, mal weiter; Löcher werden weggeschnitten
      vec2 g = vec2(u * 46.0 + n1 * 3.0, vv * 22.0 + texture2D(uNoise, vec2(u * 3.0, vv * 2.0) + 0.4).g * 3.0); vec2 f = abs(fract(g) - 0.5), fw = fwidth(g) * 0.75 + 0.0001;
      float ln = max(smoothstep(0.38 - fw.x, 0.38, f.x), smoothstep(0.36 - fw.y, 0.36, f.y)); if (ln < 0.4 || vv > 0.985) discard;
      float pol = step(0.7, h21g(floor(g))) * (1.0 - smoothstep(0.1, 0.3, length(fract(g) - 0.5) - 0.2));
      vec3 mag = mix(vec3(0.42, 0.06, 0.4), vec3(0.62, 0.1, 0.55), n1);
      base = mag * (outer ? 1.0 : 0.7); float tw = 0.6 + 0.4 * sin(uTime * 1.7 + h21g(floor(g)) * 20.0);
      glow = mix(vec3(1.0, 0.2, 0.85), vec3(0.2, 1.0, 0.9), smoothstep(0.8, 1.0, vv)) * (0.18 + 0.5 * vv + pol * 0.9 * tw) * pulse; spec = 0.6; pw = 28.0;
    } else { base = mix(vec3(0.25, 0.04, 0.24), vec3(0.5, 0.08, 0.45), h) * (0.8 + 0.3 * n1); glow = vec3(0.9, 0.2, 0.8) * (0.12 + 0.35 * h) * pulse; spec = 0.6; }` + FTAIL,
  pen: FHEAD + /* glsl */ `
    float wave = pow(0.5 + 0.5 * sin(h * 13.0 - uTime * 2.1 + seed * 6.0), 5.0), wave2 = pow(0.5 + 0.5 * sin(h * 7.0 - uTime * 1.3 + seed * 3.0 + 1.0), 4.0);
    vec3 col = h < 0.55 ? mix(vec3(0.15, 1.0, 0.85), vec3(0.55, 0.3, 1.0), smoothstep(0.2, 0.55, h)) : mix(vec3(0.55, 0.3, 1.0), vec3(1.0, 0.2, 0.75), smoothstep(0.55, 0.95, h));
    if (part < 1.5) { base = mix(vec3(0.16, 0.07, 0.22), vec3(0.32, 0.12, 0.4), h); glow = col * (0.12 + 0.8 * wave + 0.3 * wave2) * pulse * smoothstep(0.1, 0.3, h); spec = 0.5; }
    else { float rib = 0.6 + 0.4 * smoothstep(0.3, 0.5, abs(fract(u * 4.0) - 0.5) * 2.0); base = mix(vec3(0.3, 0.1, 0.4), col * 0.6, 0.4 * vv) * rib;
      glow = col * (0.2 + 1.5 * wave + 0.5 * wave2) * (0.4 + 0.6 * vv) * rib * pulse; spec = 0.5; pw = 26.0; }` + FTAIL,
  venus: FHEAD + /* glsl */ `
    #define NA 14.0
    #define NV 16.0
    if (part < 0.5) {` + GLASS + `}
    else if (part < 1.5) { float ln = lattice(vec2(u * 22.0, vv * 5.0), 0.12); if (ln < 0.35 && vv > 0.25) discard; base = vec3(0.8, 0.88, 0.92); glow = vec3(0.55, 0.85, 1.0) * 0.2 * pulse; spec = 1.0; }
    else if (part < 2.5) { float ln = lattice(vec2(u * 44.0, vv * 4.0), 0.14); if (ln < 0.35) discard; base = vec3(0.85, 0.92, 0.95); glow = vec3(0.6, 0.9, 1.0) * (0.25 + 0.3 * vv) * pulse; spec = 1.0; }
    else { base = vec3(0.7, 0.78, 0.8); glow = vec3(0.5, 0.8, 0.95) * 0.12; }` + FTAIL,
  cup: FHEAD + /* glsl */ `
    #define NA 18.0
    #define NV 11.0
    if (part < 0.5) { if (vv < 0.15) { base = vec3(0.7, 0.78, 0.8); glow = vec3(0.5, 0.8, 0.95) * 0.1; } else {` + GLASS + ` glow += vec3(0.6, 0.9, 1.0) * smoothstep(0.92, 1.0, vv) * 0.35; } }
    else { base = vec3(0.55, 0.62, 0.66); glow = vec3(0.4, 0.7, 0.85) * 0.1; }` + FTAIL,
  drape: FHEAD + /* glsl */ `
    #define NA 16.0
    #define NV 18.0
    if (part < 0.5) {` + GLASS + ` glow += vec3(0.6, 0.9, 1.0) * smoothstep(0.8, 1.0, vv) * 0.3 * pulse; }
    else { base = vec3(0.8, 0.88, 0.92); glow = vec3(0.6, 0.9, 1.0) * (0.3 + 0.5 * vv) * pulse; }` + FTAIL,
  coral: FHEAD + /* glsl */ `
    float node = 1.0 - smoothstep(0.0, 0.08, abs(fract(vv * 4.0) - 0.5) - 0.38);
    vec3 stem = mix(vec3(0.04, 0.12, 0.13), vec3(0.08, 0.3, 0.3), h) * (1.0 - 0.4 * node);
    if (part < 1.5) { base = stem; glow = vec3(0.1, 0.9, 0.85) * (0.08 + 0.25 * h * h) * pulse + vec3(0.6, 1.0, 0.9) * node * 0.05; spec = 0.6; }
    else { base = mix(stem, vec3(0.3, 0.95, 0.9), vv); glow = vec3(0.15, 1.0, 0.9) * (0.4 + 1.4 * vv * vv) * pulse; spec = 0.8; }` + FTAIL,
  crinoid: FHEAD + /* glsl */ `
    float n1 = texture2D(uNoise, vec2(vv * 4.0, h * 3.0 + seed)).r;
    if (part < 1.5) { base = vec3(0.32, 0.18, 0.12) * (0.8 + 0.4 * n1) * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.1, abs(fract(vv * 18.0) - 0.5) - 0.38))); spec = 0.4; }
    else { base = mix(vec3(0.85, 0.3, 0.12), vec3(1.0, 0.62, 0.38), smoothstep(0.55, 1.0, vv)) * (0.8 + 0.3 * n1); if (part > 3.5) base *= 1.05;
      glow = vec3(1.0, 0.6, 0.35) * smoothstep(0.75, 1.0, vv) * 0.15 * pulse; spec = 0.5; }` + FTAIL,
  mush: FHEAD + /* glsl */ `
    if (part < 1.5) { base = vec3(0.12, 0.2, 0.26) * (0.8 + 0.3 * vv); glow = vec3(0.3, 0.7, 1.0) * smoothstep(0.6, 1.0, vv) * 0.25 * pulse; spec = 0.5; }
    else if (part < 2.5) { float sp = step(0.82, fract(sin(dot(floor(vec2(u * 30.0, vv * 6.0)), vec2(12.9, 78.2))) * 43758.5)); base = mix(vec3(0.15, 0.35, 0.6), vec3(0.35, 0.75, 1.0), vv) * (0.85 + 0.2 * sp);
      glow = vec3(0.25, 0.65, 1.0) * (0.35 + 0.9 * vv * vv + sp * 0.4) * pulse; spec = 1.0; pw = 40.0; }
    else { float gi = 0.5 + 0.5 * sin(u * 6.2832 * 28.0); base = vec3(0.3, 0.7, 1.0); glow = vec3(0.35, 0.85, 1.0) * (0.9 + 0.8 * gi) * pulse; }` + FTAIL,
  tubes: FHEAD + /* glsl */ `
    float n1 = texture2D(uNoise, vec2(u * 3.0, vv * 2.5 + seed)).r, n2 = texture2D(uNoise, vec2(u * 12.0, vv * 9.0)).g;
    if (part < 1.5) { base = mix(vec3(0.22, 0.08, 0.32), vec3(0.55, 0.25, 0.75), vv) * (0.75 + 0.4 * n1) * (1.0 - 0.25 * smoothstep(0.6, 0.8, n2));
      glow = vec3(0.7, 0.35, 1.0) * (fr * 0.35 + smoothstep(0.85, 1.0, vv) * 0.4) * pulse; spec = 0.7; pw = 30.0; }
    else { base = vec3(0.05, 0.02, 0.08); glow = vec3(0.6, 0.3, 1.0) * (1.0 - vv) * 0.3; }` + FTAIL,
};

export function createGarden(scene) {
  const kind = (geo, fs, M, rest) => {
    const iP = new Float32Array(M * 4), iR = new Float32Array(M * 4), iA = new Float32Array(M * 4);
    geo.setAttribute('iP', new T.InstancedBufferAttribute(iP, 4)); geo.setAttribute('iR', new T.InstancedBufferAttribute(iR, 4)); geo.setAttribute('iA', new T.InstancedBufferAttribute(iA, 4)); geo.instanceCount = 0;
    const m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, extensions: { derivatives: true }, vertexShader: VS, fragmentShader: '#define REST ' + rest.toFixed(2) + '\n' + fs })); m.frustumCulled = false; scene.add(m);
    return { geo, M, list: [], mesh: m,
      sync() { let n = 0; for (const f of this.list) { if (n >= M) break; const o = n * 4; iP.set([f.x, f.y, f.z, f.size], o); iR.set([f.yaw || 0, f.pitch || 0, f.roll || 0, 0], o); iA.set([f.seed || 0, 0, 0, 0], o); n++; }
        geo.instanceCount = n; geo.attributes.iP.needsUpdate = geo.attributes.iR.needsUpdate = geo.attributes.iA.needsUpdate = true; } };
  };
  return {
    venus: kind(buildVenus(), FS.venus, 140, 0.5), cup: kind(buildCup(), FS.cup, 80, 0.5), drape: kind(buildDrape(), FS.drape, 60, 0.5),
    coral: kind(buildCoral(), FS.coral, 200, 0.4), crinoid: kind(buildCrinoid(), FS.crinoid, 110, 0.35), mush: kind(buildMush(), FS.mush, 200, 0.4), tubes: kind(buildTubes(), FS.tubes, 200, 0.4),
    fan: kind(buildFan(), FS.fan, 60, 0.45), pen: kind(buildPen(), FS.pen, 80, 0.4),
  };
}
