// cabin.js – das Innere des Boots: Tonnengewölbe aus Planken mit gemalter Maserung, Messing mit Nieten und Patina,
// warmes Lampenlicht, gebackene Verschattung in Ecken und Fugen. Koordinaten der Kabine: Boden y = 0, +z zum Bug.
// Wird nach der Welt in einem zweiten Durchgang gezeichnet. Bewegliche Teile (Steuerrad, Tiefenruder, Spulen, Tassen) sind eigene Meshes.
import { T, Geo, rng, glowTexture, noise } from './util.js';
import { U, quadPoints } from './gfx.js';
import { quad, tube, disc, box, lathe, ring } from './build.js';

const BRASS_ = [0.78, 0.56, 0.24], PI = Math.PI, RC = 1.45, CY = 0.75, ZA = -2.1, ZF = 1.5, FW = Math.sqrt(RC * RC - CY * CY), F0 = Math.acos(CY / RC);
export const WIN = { x: 0, y: 1.15, r: 0.82 }, SEAT = { x: 0, y: 1.27, z: 0.52 }, FLOOR_Y = -1.0;
const wallPt = (f, z, inset = 0) => [(RC - inset) * Math.sin(f), CY - (RC - inset) * Math.cos(f), z];
const wallX = (y, inset = 0) => Math.sqrt(Math.max(0, (RC - inset) ** 2 - (y - CY) ** 2));
// Materialarten (aWind): -1 Holz, 0 matt, 1 Metall, 2 Lampe (schaltbar), 3 Feuer, 4 Lampe (fest), 5 Glas/Zifferblatt
const WOOD = -1, MET = 1, LAMP = 2, FIRE = 3, STEADY = 4, MAP = 6;

/** Geometrie mit Holz-Texturkoordinaten (u quer, v längs, Variante; Variante < 0 = keine Planke → Triplanar) */
class CGeo extends Geo {
  constructor() { super(); this.u = []; this.uvq = null; this.k = 0; }
  v(x, y, z, nx, ny, nz, col, w = 0, s = 0) { if (this.uvq) this.u.push(...this.uvq[this.k++]); else this.u.push(0, 0, -1); return super.v(x, y, z, nx, ny, nz, col, w, s); }
  build() { const u = new Float32Array(this.u), g = super.build(); g.setAttribute('aUV', new T.BufferAttribute(u, 3)); return g; }
}
/** Planke: a→b quer, a→d längs; len in Metern; Variante 0..3 */
function plank(g, a, b, c, d, tint, vari, R, len) {
  const v0 = R() * 4, v1 = v0 + len / 1.15; g.uvq = [[0, v0, vari], [1, v0, vari], [1, v1, vari], [0, v1, vari]]; g.k = 0; quad(g, a, b, c, d, tint, 0, WOOD); g.uvq = null;
}
/** Netz aus einer Funktion f(i, j) → Punkt; Normalen aus den Nachbarn; wrapI = geschlossen in i */
function grid(g, ni, nj, f, col, fl = 0, em = 0, wrapI = false, flip = false) {
  const P = []; for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) P.push(f(i, j));
  const at = (i, j) => P[Math.max(0, Math.min(nj, j)) * (ni + 1) + (wrapI ? ((i % ni) + ni) % ni : Math.max(0, Math.min(ni, i)))], base = g.count;
  for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
    const a = at(i + 1, j), b = at(i - 1, j), c = at(i, j + 1), d = at(i, j - 1), ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1, s = flip ? -1 : 1, p = at(i, j), cc = typeof col === 'function' ? col(i / ni, j / nj, p) : col;
    g.v(p[0], p[1], p[2], s * nx / l, s * ny / l, s * nz / l, cc, fl, em);
  }
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const a = base + j * (ni + 1) + i, b = a + 1, c = a + ni + 2, d = a + ni + 1; if (flip) g.quad(a, d, c, b); else g.quad(a, b, c, d); }
}
/** weicher Körper: abgerundete Kiste (m = Rundheit, 2 = Kugel, 8 = fast Kiste), leicht eingedellt */
function soft(g, c, s, m, col, seed = 0, dent = 0.04, fl = 0, rotY = 0) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY);
  grid(g, 22, 14, (i, j) => {
    const th = i / 22 * 2 * PI, ph = j / 14 * PI - PI / 2, dx = Math.cos(ph) * Math.cos(th), dy = Math.sin(ph), dz = Math.cos(ph) * Math.sin(th);
    const k = Math.pow(Math.pow(Math.abs(dx), m) + Math.pow(Math.abs(dy), m) + Math.pow(Math.abs(dz), m), -1 / m), n = 1 - dent * (noise(dx * 2.3 + seed, dz * 2.3 + dy * 1.7) + 0.4 * noise(dx * 5 + seed * 2, dy * 5 + dz * 3));
    const x = dx * k * s[0] / 2 * n, y = dy * k * s[1] / 2 * n * (dy < 0 ? 0.9 : 1), z = dz * k * s[2] / 2 * n;
    return [c[0] + x * cy + z * sy, c[1] + y, c[2] - x * sy + z * cy];
  }, col, fl, 0, true);
}
const dome = (g, c, n, r, col) => { col = col === BRASS_ ? [0.5, 0.36, 0.17] : col; const N = new T.Vector3(...n).normalize(); lathe(g, c, Math.abs(N.x) > 0.7 ? 'x' : Math.abs(N.z) > 0.7 ? 'z' : 'y', (Math.abs(N.x) > 0.7 ? N.x : Math.abs(N.z) > 0.7 ? N.z : N.y) > 0 ? [[0, r], [r * 0.45, r * 0.8], [r * 0.7, 0]] : [[0, r], [-r * 0.45, r * 0.8], [-r * 0.7, 0]], 6, col, 0, MET); };

/** gebackene Verschattung: Flächen in ein Gitter rastern, je Eckpunkt Strahlen in die Halbkugel prüfen */
function bakeAO(g) {
  const V = 0.04, X0 = -1.55, Y0 = -0.05, Z0 = -2.2, NX = Math.ceil(3.1 / V), NY = Math.ceil(2.35 / V), NZ = Math.ceil(3.85 / V), grid3 = new Uint8Array(NX * NY * NZ);
  const P = g.p, I = g.i, mark = (x, y, z) => { const i = Math.floor((x - X0) / V), j = Math.floor((y - Y0) / V), k = Math.floor((z - Z0) / V); if (i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ) grid3[(k * NY + j) * NX + i] = 1; };
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, l1 = Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]), l2 = Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]), n1 = Math.max(1, Math.ceil(l1 / (V * 0.7))), n2 = Math.max(1, Math.ceil(l2 / (V * 0.7)));
    for (let i = 0; i <= n1; i++) for (let j = 0; j <= n2 - i * n2 / n1; j++) { const u = i / n1, w = j / n2; mark(P[a] + (P[b] - P[a]) * u + (P[c] - P[a]) * w, P[a + 1] + (P[b + 1] - P[a + 1]) * u + (P[c + 1] - P[a + 1]) * w, P[a + 2] + (P[b + 2] - P[a + 2]) * u + (P[c + 2] - P[a + 2]) * w); }
  }
  const occ = (x, y, z) => { const i = Math.floor((x - X0) / V), j = Math.floor((y - Y0) / V), k = Math.floor((z - Z0) / V); return i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ && grid3[(k * NY + j) * NX + i] === 1; };
  const DIRS = []; for (let i = 0; i < 14; i++) { const y = 1 - (i + 0.5) / 14 * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996; DIRS.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const N = g.n, n = P.length / 3, ao = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2]; let nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
    if (nx * (0 - px) + ny * (1.0 - py) + nz * (-0.3 - pz) < 0) { nx = -nx; ny = -ny; nz = -nz; }   // zur Raummitte zeigen lassen
    let o = 0, w = 0;
    for (const d of DIRS) { const c = d[0] * nx + d[1] * ny + d[2] * nz; if (c <= 0.05) continue; w += c; for (let s = 1; s <= 6; s++) { const r = 0.035 + s * s * 0.013; if (occ(px + nx * 0.03 + d[0] * r, py + ny * 0.03 + d[1] * r, pz + nz * 0.03 + d[2] * r)) { o += c * (1 - (s - 1) / 7); break; } } }
    ao[v] = 1 - Math.min(1, o / Math.max(w, 1e-3)) * 0.85;
  }
  return ao;
}

/** gemalte Seekarte: Pergament, Küsten mit Schraffur, Tiefenlinien, Gitter, Kompassrose, Kurslinie */
function chartTexture() {
  const W = 512, H = 360, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), R = rng(5);
  const gr = x.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.65); gr.addColorStop(0, '#e2d2a8'); gr.addColorStop(1, '#a88a5a'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(90,60,30,${R() * 0.06})`; x.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3); }
  const land = (cx, cy, r, s) => { const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, k = r * (0.75 + 0.35 * noise(Math.cos(a) * 1.4 + s, Math.sin(a) * 1.4 + s * 2)); pts.push([cx + Math.cos(a) * k * 1.3, cy + Math.sin(a) * k]); } return pts; };
  const islands = [land(110, 110, 70, 1), land(390, 250, 85, 4), land(300, 70, 30, 7), land(460, 90, 22, 9)];
  for (const pts of islands) for (let ring = 4; ring >= 1; ring--) { x.strokeStyle = `rgba(70,95,110,${0.12 + ring * 0.04})`; x.lineWidth = 1; x.beginPath(); pts.forEach(([px, py], i) => { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, k = 1 + ring * 0.13; const qx = cx + (px - cx) * k, qy = cy + (py - cy) * k; if (i) x.lineTo(qx, qy); else x.moveTo(qx, qy); }); x.closePath(); x.stroke(); }
  for (const pts of islands) { x.fillStyle = '#c8ad78'; x.strokeStyle = '#5a3d1e'; x.lineWidth = 2; x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); x.stroke();
    x.save(); x.clip(); x.strokeStyle = 'rgba(90,60,30,0.35)'; x.lineWidth = 1; for (let k = -W; k < W; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + H, H); x.stroke(); } x.restore(); }
  x.strokeStyle = 'rgba(90,60,30,0.25)'; x.lineWidth = 1; for (let k = 0; k < W; k += 64) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, H); x.stroke(); } for (let k = 0; k < H; k += 64) { x.beginPath(); x.moveTo(0, k); x.lineTo(W, k); x.stroke(); }
  const cx = 250, cy = 230; x.strokeStyle = 'rgba(80,45,20,0.8)'; x.fillStyle = 'rgba(120,40,25,0.75)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, 42, 0, 6.283); x.stroke(); x.beginPath(); x.arc(cx, cy, 36, 0, 6.283); x.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, l = i % 2 ? 26 : 46; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a + 0.12) * 8, cy + Math.sin(a + 0.12) * 8); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.lineTo(cx + Math.cos(a - 0.12) * 8, cy + Math.sin(a - 0.12) * 8); x.closePath(); i % 2 ? x.stroke() : x.fill(); }
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * W, cy + Math.sin(a) * W); x.strokeStyle = 'rgba(80,45,20,0.08)'; x.stroke(); }
  x.setLineDash([6, 5]); x.strokeStyle = 'rgba(130,40,25,0.8)'; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 300); x.bezierCurveTo(160, 260, 220, 160, 330, 150); x.bezierCurveTo(400, 145, 430, 180, 470, 170); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(130,40,25,0.85)'; x.beginPath(); x.arc(470, 170, 5, 0, 6.283); x.fill(); x.font = 'italic 15px Georgia, serif'; x.fillStyle = 'rgba(70,40,20,0.85)'; x.fillText('Tiefenlicht', 20, 28); x.font = 'italic 11px Georgia, serif'; x.fillText('Schlucht', 205, 290); x.fillText('?', 476, 162);
  x.strokeStyle = 'rgba(80,50,25,0.6)'; x.lineWidth = 3; x.strokeRect(6, 6, W - 12, H - 12);
  const t = new T.CanvasTexture(cv); t.anisotropy = 4; return t;
}
export function createCabin() {
  const g = new CGeo(), R = rng(77), rr = (a, b) => a + R() * (b - a);
  // Holz ist eine Tönung der Textur (1 = so wie gemalt); alles andere echte Farben
  const WT1 = [0.95, 0.95, 0.95], WT2 = [0.78, 0.76, 0.75], WT3 = [0.58, 0.55, 0.53], WD3 = [0.2, 0.115, 0.065], BRASS = BRASS_, COPPER = [0.55, 0.3, 0.16], IRON = [0.1, 0.1, 0.11], CAST = [0.13, 0.12, 0.12], LEATH = [0.42, 0.14, 0.09], CREAM = [0.72, 0.66, 0.54], WARM = [1.0, 0.72, 0.4], FIREC = [1.0, 0.45, 0.12], PAPER = [0.84, 0.78, 0.64], DARK = [0.03, 0.022, 0.018];
  const sh = (c, k) => [c[0] * k, c[1] * k, c[2] * k], tint = (k) => [k, k * 0.97, k * 0.95];

  // ---------- Hülle: dunkle Innenhaut, davor einzelne Planken mit Fugen ----------
  const NA = 18, NZ = 5, dF = (2 * PI - 2 * F0) / NA, dZ = (ZF - ZA) / NZ, GAP = 0.012;
  const sideWin = (a, k) => (a === 3 || a === NA - 4) && k === 4;
  for (let a = 0; a < NA; a++) for (let k = 0; k < NZ; k++) {
    const f0 = F0 + a * dF, f1 = f0 + dF, z0 = ZA + k * dZ, z1 = z0 + dZ;
    quad(g, wallPt(f0, z0, -0.02), wallPt(f0, z1, -0.02), wallPt(f1, z1, -0.02), wallPt(f1, z0, -0.02), DARK);
    for (let h = 0; h < 2; h++) {                                                  // zwei Planken je Feld
      const g0 = f0 + h * dF / 2 + GAP / RC, g1 = f0 + (h + 1) * dF / 2 - GAP / RC, zz0 = z0 + GAP, zz1 = z1 - GAP;
      plank(g, wallPt(g0, zz0), wallPt(g1, zz0), wallPt(g1, zz1), wallPt(g0, zz1), tint((0.72 + 0.3 * R()) * (0.8 + 0.2 * Math.sin(f0 * 0.5))), Math.floor(R() * 4), R, dZ);
    }
  }
  // Schotten vorn (mit Ausschnitt für die Kuppel) und hinten: Fächer vom Ausschnitt bis zum Umriss des Gewölbes, als Bretter getönt
  const bulkhead = (z, cy, r, flip) => {
    const N = 48, out = (al) => { const dx = Math.cos(al), dy = Math.sin(al), qy = cy - CY, b = qy * dy, t1 = -b + Math.sqrt(b * b - (qy * qy - (RC + 0.03) * (RC + 0.03))), t2 = dy < -0.001 ? -cy / dy : 1e9, t = Math.min(t1, t2); return [dx * t, cy + dy * t, z]; };
    for (let i = 0; i < N; i++) { const a0 = i / N * 2 * PI, a1 = (i + 1) / N * 2 * PI, p0 = [Math.cos(a0) * r, cy + Math.sin(a0) * r, z], p1 = [Math.cos(a1) * r, cy + Math.sin(a1) * r, z], c = tint(0.62 + 0.12 * ((i >> 2) % 2)); if (flip) quad(g, p0, out(a0), out(a1), p1, c, 0, WOOD); else quad(g, p0, p1, out(a1), out(a0), c, 0, WOOD); }
  };
  bulkhead(ZF, WIN.y, WIN.r + 0.02, false); bulkhead(ZA, 0.95, 0.001, true);
  for (const x of [-1.0, -0.6, 0.6, 1.0]) { const y0 = 0, y1 = CY + Math.sqrt(RC * RC - x * x) - 0.02; tube(g, [[x, y0, ZA + 0.03], [x, y1, ZA + 0.03]], 0.035, 0.035, 4, WD3, 0, WOOD); }
  // Boden: Dielen mit Fugen über dunklem Grund
  quad(g, [-FW, -0.01, ZA], [-FW, -0.01, ZF], [FW, -0.01, ZF], [FW, -0.01, ZA], DARK);
  for (let c = 0; c < 9; c++) for (let k = 0; k < 3; k++) { const w = 2 * FW / 9, x0 = -FW + c * w + 0.006, x1 = x0 + w - 0.012, zs = [ZA, ZA + 1.1 + (c % 2) * 0.5, ZA + 2.4 - (c % 3) * 0.3, ZF], z0 = zs[k] + 0.006, z1 = zs[k + 1] - 0.006; plank(g, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], tint(0.62 + 0.25 * R()), Math.floor(R() * 4), R, z1 - z0); }
  // Spanten mit gewölbten Nieten, Längsbalken
  for (let k = 1; k < NZ; k++) { const z = ZA + k * dZ, pts = []; for (let a = 0; a <= 24; a++) pts.push(wallPt(F0 + (2 * PI - 2 * F0) * a / 24, z, 0.05)); tube(g, pts, 0.075, 0.075, 4, WD3, 0, WOOD);
    for (let a = 1; a <= 23; a += 4) { const p = wallPt(F0 + (2 * PI - 2 * F0) * a / 24, z, 0.13); dome(g, p, [-p[0], CY - p[1], 0], 0.013, BRASS); } }
  for (const a of [5.0, NA - 5.0]) tube(g, [wallPt(F0 + a * dF, ZA, 0.05), wallPt(F0 + a * dF, ZF, 0.05)], 0.055, 0.055, 4, WD3, 0, WOOD);

  // ---------- Messingrohre unter der Decke: leicht durchhängend, Muffen mit Schrauben, Schellen ----------
  for (const [x, r, col] of [[-0.42, 0.045, BRASS], [0.3, 0.036, COPPER], [0.47, 0.03, BRASS]]) {
    const y = CY + Math.sqrt((RC - 0.15) ** 2 - x * x), pts = []; for (let i = 0; i <= 16; i++) { const z = ZA + (ZF - ZA) * i / 16; pts.push([x + Math.sin(i * 1.3 + x * 9) * 0.006, y - Math.sin(((z - ZA) / dZ) * PI) ** 2 * 0.018, z]); }
    tube(g, pts, r, r, 8, col, 0, MET);
    for (let k = 0; k <= NZ; k++) { const z = ZA + k * dZ + (k === 0 ? 0.12 : k === NZ ? -0.12 : 0); if (k % 2) { lathe(g, [x, y, z], 'z', [[-0.035, r * 1.35], [-0.035, r * 1.5], [0.035, r * 1.5], [0.035, r * 1.35]], 10, BRASS, 0, MET); for (let b = 0; b < 4; b++) { const an = b * PI / 2 + 0.4; dome(g, [x + Math.cos(an) * r * 1.5, y + Math.sin(an) * r * 1.5, z + 0.04], [0, 0, 1], 0.009, IRON); } }
      else { ring(g, [x, y, z], [0, 0, 1], r + 0.008, 0.008, 10, 4, IRON, 0, MET); box(g, [x, y + r + 0.05, z], [0.018, 0.1, 0.018], 0, IRON, 0, 0, MET); } }
  }
  tube(g, [[-0.42, 2.03, ZF - 0.05], [-0.62, 1.95, ZF - 0.05], [-0.95, 1.2, ZF - 0.06], [-0.9, 0.86, ZF - 0.12]], 0.035, 0.035, 8, COPPER, 0, MET);
  { const p = [-0.73, 1.62, ZF - 0.06]; lathe(g, p, 'z', [[0, 0.05], [-0.05, 0.05], [-0.06, 0]], 10, BRASS, 0, MET); disc(g, [p[0], p[1], p[2] - 0.061], [0, 0, -1], 0.045, [0.92, 0.88, 0.7], 0.5, 12); }   // Manometer am Rohr

  // ---------- Kuppelfenster: dicker Messingring, Nietkranz, Streben ----------
  lathe(g, [0, WIN.y, ZF - 0.02], 'z', [[0, WIN.r], [-0.04, WIN.r + 0.015], [-0.08, WIN.r + 0.07], [-0.09, WIN.r + 0.16], [-0.05, WIN.r + 0.22], [0, WIN.r + 0.25]].map(([a, b]) => [a, b]), 48, BRASS, 0, MET);
  for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI + 0.13; dome(g, [Math.cos(a) * (WIN.r + 0.19), WIN.y + Math.sin(a) * (WIN.r + 0.19), ZF - 0.075], [0, 0, -1], 0.02, BRASS); }
  for (const a of [0.62, PI - 0.62, PI + 0.5, -0.5]) tube(g, [[Math.cos(a) * (WIN.r + 0.24), WIN.y + Math.sin(a) * (WIN.r + 0.24), ZF - 0.04], [Math.cos(a) * 1.28, WIN.y + Math.sin(a) * 1.28 * (Math.sin(a) < 0 ? 0.7 : 0.8), ZF - 0.04]], 0.03, 0.03, 6, BRASS, 0, MET);
  // Seitenfenster
  for (const side of [-1, 1]) { const fc = F0 + 3.5 * dF, c0 = wallPt(fc, ZA + 4.5 * dZ, -0.01), c = [side * c0[0], c0[1], c0[2]], n = [-side * Math.sin(fc), Math.cos(fc), 0];
    disc(g, [c[0] + n[0] * 0.025, c[1] + n[1] * 0.025, c[2]], n, 0.2, [0.05, 0.28, 0.42], 0.9, 20); disc(g, [c[0] + n[0] * 0.027, c[1] + n[1] * 0.027 + 0.05, c[2] - 0.05], n, 0.05, [0.2, 0.5, 0.6], 0.5, 10);
    ring(g, [c[0] + n[0] * 0.03, c[1] + n[1] * 0.03, c[2]], n, 0.24, 0.04, 24, 6, BRASS, 0, MET); ring(g, [c[0] + n[0] * 0.05, c[1] + n[1] * 0.05, c[2]], n, 0.17, 0.025, 24, 5, BRASS, 0, MET);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI, ux = n[1], uy = -n[0]; dome(g, [c[0] + n[0] * 0.07 + ux * Math.sin(a) * 0.205, c[1] + n[1] * 0.07 + uy * Math.sin(a) * 0.205, c[2] + Math.cos(a) * 0.205], n, 0.012, BRASS); } }

  // ---------- Steuerstand: Sitz, Pult, Anzeigen (Rad und Ruder sind beweglich, siehe unten) ----------
  lathe(g, [0, 0, 0.72], 'y', [[0, 0.24], [0.03, 0.24], [0.06, 0.06], [0.44, 0.05], [0.46, 0.14]], 12, IRON, 0, MET);
  soft(g, [0, 0.52, 0.72], [0.52, 0.13, 0.5], 4, LEATH, 1, 0.05); soft(g, [0, 0.82, 0.47], [0.44, 0.5, 0.11], 4, LEATH, 2, 0.05);
  for (const sx of [-1, 1]) tube(g, [[sx * 0.27, 0.5, 0.5], [sx * 0.29, 0.7, 0.52], [sx * 0.29, 0.7, 0.9]], 0.022, 0.022, 6, BRASS, 0, MET);
  for (const [x0, x1, y0, y1, z] of [[-0.85, 0.85, 0, 0.78, 1.17]]) for (let k = 0; k < 6; k++) { const a = x0 + (x1 - x0) * k / 6, b = a + (x1 - x0) / 6 - 0.008; plank(g, [a, y0, z], [b, y0, z], [b, y1, z], [a, y1, z], tint(0.7 + 0.2 * R()), k % 4, R, 0.8); }
  quad(g, [-0.85, 0.78, 1.16], [0.85, 0.78, 1.16], [0.85, 0.98, 1.47], [-0.85, 0.98, 1.47], WD3, 0, WOOD); box(g, [0, 0.39, 1.33], [1.7, 0.78, 0.3], 0, WD3, 0, 0, WOOD); box(g, [0, 0.775, 1.16], [1.74, 0.05, 0.05], 0, BRASS, 0, 0, MET);
  const pn = [0, 0.84, -0.54];
  for (const [x, r, em] of [[-0.5, 0.085, 0.38], [-0.3, 0.06, 0.3], [0.5, 0.075, 0.35], [0.68, 0.055, 0.28]]) { const c = [x, 0.9, 1.34]; disc(g, [c[0], c[1] + 0.012, c[2] - 0.008], pn, r, [0.95, 0.88, 0.62], em, 16); ring(g, [c[0], c[1] + 0.016, c[2] - 0.01], pn, r, 0.016, 16, 5, BRASS, 0, MET); quad(g, [c[0] - 0.004, c[1] + 0.02, c[2] - 0.012], [c[0] + 0.004, c[1] + 0.02, c[2] - 0.012], [c[0] + r * 0.5, c[1] + 0.02 + r * 0.45, c[2] - 0.012 + r * 0.7], [c[0] + r * 0.5 - 0.008, c[1] + 0.02 + r * 0.45, c[2] - 0.012 + r * 0.7], IRON); for (let b = 0; b < 4; b++) { const an = b * PI / 2 + 0.78; dome(g, [c[0] + Math.cos(an) * (r + 0.03), c[1] + 0.012 + Math.sin(an) * (r + 0.03) * 0.54, c[2] - 0.008 + Math.sin(an) * (r + 0.03) * 0.84], pn, 0.007, BRASS); } }
  for (const [x, lean, col] of [[-0.72, 0.12, [0.7, 0.12, 0.08]], [-0.62, -0.1, [0.1, 0.1, 0.1]], [0.8, 0.16, [0.75, 0.6, 0.2]]]) { tube(g, [[x, 0.82, 1.24], [x, 1.02, 1.24 - lean]], 0.014, 0.014, 6, BRASS, 0, MET); soft(g, [x, 1.03, 1.24 - lean], [0.055, 0.055, 0.055], 2, col, x, 0); }
  for (let k = 0; k < 5; k++) box(g, [-0.1 + k * 0.07, 0.86, 1.28], [0.03, 0.03, 0.02], 0, k === 1 ? [0.2, 0.9, 0.4] : BRASS, k === 1 ? 1.2 : 0, 0.55, k === 1 ? 0 : MET);
  lathe(g, [0.66, 0.78, 1.02], 'y', [[0, 0.075], [0.012, 0.075], [0.016, 0.06]], 12, BRASS, 0, MET); tube(g, [[0.66, 0.77, 1.02], [0.66, 0.7, 1.12]], 0.012, 0.012, 4, BRASS, 0, MET);      // Tassenhalter am Pult
  // Wandlaternen
  for (const sx of [-1, 1]) { const c = [sx * 1.0, 1.36, ZF - 0.1]; box(g, [c[0], c[1] + 0.13, c[2]], [0.13, 0.03, 0.13], 0, BRASS, 0, 0, MET); box(g, [c[0], c[1] - 0.13, c[2]], [0.13, 0.03, 0.13], 0, BRASS, 0, 0, MET); box(g, c, [0.09, 0.22, 0.09], 0, WARM, 1.3, 0, LAMP); lathe(g, [c[0], c[1] + 0.145, c[2]], 'y', [[0, 0.075], [0.06, 0.03], [0.07, 0]], 8, BRASS, 0, MET); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tube(g, [[c[0] + dx * 0.058, c[1] - 0.13, c[2] + dz * 0.058], [c[0] + dx * 0.058, c[1] + 0.13, c[2] + dz * 0.058]], 0.008, 0.008, 4, BRASS, 0, MET); tube(g, [[c[0], c[1] - 0.15, c[2]], [c[0], c[1] - 0.22, c[2] + 0.04], [c[0], c[1] - 0.24, c[2] + 0.1]], 0.012, 0.012, 4, BRASS, 0, MET); }

  // ---------- links: Koje mit Matratze, Kissen und Decke ----------
  { const x0 = -1.2, x1 = -0.5, z0 = -2.06, z1 = -0.34;
    for (let k = 0; k < 3; k++) plank(g, [x1, k * 0.14 + 0.004, z0], [x1, k * 0.14 + 0.136, z0], [x1, k * 0.14 + 0.136, z1], [x1, k * 0.14 + 0.004, z1], tint(0.75 + 0.2 * R()), k, R, z1 - z0);
    for (const z of [z0, z1]) { for (let k = 0; k < 4; k++) { const y0 = k * 0.19, y1 = y0 + 0.18; plank(g, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], tint(0.7 + 0.2 * R()), k, R, 0.7); } lathe(g, [x1, 0, z], 'y', [[0, 0.04], [0.8, 0.04], [0.82, 0.05], [0.86, 0.035], [0.88, 0]], 8, WD3, 0, WOOD); }
    box(g, [-0.85, 0.415, -1.2], [0.7, 0.03, 1.7], 0, WD3, 0, 0, WOOD);
    for (const z of [-1.62, -0.78]) { box(g, [-0.495, 0.17, z], [0.02, 0.2, 0.7], 0, sh(WD3, 1.4), 0, 0, WOOD); lathe(g, [-0.485, 0.17, z], 'x', [[0, 0.018], [0.02, 0.024], [0.034, 0]], 8, BRASS, 0, MET); }
    soft(g, [-0.85, 0.5, -1.2], [0.68, 0.14, 1.66], 7, CREAM, 3, 0.03);
    soft(g, [-0.88, 0.6, -1.8], [0.48, 0.13, 0.3], 2.6, [0.82, 0.79, 0.72], 4, 0.12, 0, 0.12);
    const top = 0.575;                                                              // Wolldecke: liegt auf, hängt vorn über die Kante, am Kopfende umgeschlagen
    grid(g, 26, 22, (i, j) => { const s = i / 26, t = j / 22, z = -1.48 + t * 1.16, fold = Math.sin(t * 13 + s * 2) * 0.012 + Math.sin(t * 5.3 + 1) * 0.015 * s;
      if (s < 0.78) { const x = -1.18 + 0.66 * s / 0.78; return [x, top + 0.01 + fold + 0.035 * Math.exp(-(((t - 0.06) / 0.06) ** 2)) + 0.02 * Math.sin(s * 9 + t * 4) * s, z]; }
      const u = (s - 0.78) / 0.22; return [-0.515 + 0.05 * Math.sin(u * PI * 0.5) + fold * 0.6, top + 0.01 - u * 0.24 + fold, z + Math.sin(t * 9) * 0.02 * u]; },
      (s, t) => { const stripe = Math.floor(t * 22) % 9 === 1 || Math.floor(t * 22) % 9 === 2; return stripe ? [0.5, 0.36, 0.17] : sh([0.3, 0.34, 0.24], 0.9 + 0.15 * noise(s * 8, t * 8)); }, 0, 0);
    tube(g, Array.from({ length: 9 }, (_, i) => { const s = i / 8; return [-1.16 + 0.62 * s, top + 0.035 + 0.01 * Math.sin(s * 7), -1.49]; }), 0.035, 0.035, 8, [0.3, 0.34, 0.24]);
  }
  // Regale mit Büchern (gerundete Rücken, Schnitt, Goldbänder), Buchstützen
  const book = (bx, by, bz, h, t, d, col, lean) => {
    const cz = bz + Math.sin(lean) * h / 2, cy = by + Math.cos(lean) * h / 2;
    box(g, [bx, cy, cz], [d, h, 0.008], 0, col, 0, lean); box(g, [bx, cy, cz + t / 2 * Math.cos(lean)], [d, h, 0.008], 0, col, 0, lean);
    box(g, [bx - 0.006, cy, cz + t / 4 * Math.cos(lean)], [d - 0.012, h - 0.016, t * 0.5], 0, PAPER, 0, lean);
    const s0 = [bx + d / 2 - t * 0.12, by + 0.004, bz + t / 4], s1 = [bx + d / 2 - t * 0.12, by + Math.cos(lean) * h - 0.004, bz + t / 4 + Math.sin(lean) * h]; tube(g, [s0, s1], t * 0.32, t * 0.32, 7, col);
    for (const f of [0.18, 0.82]) { const y = by + Math.cos(lean) * h * f, z = bz + t / 4 + Math.sin(lean) * h * f; box(g, [bx + d / 2 + t * 0.19, y, z], [0.004, 0.008, t * 0.42], 0, [0.85, 0.66, 0.3], 0, lean, MET); }
  };
  const BOOKS = [[0.42, 0.1, 0.08], [0.13, 0.26, 0.17], [0.52, 0.37, 0.14], [0.17, 0.21, 0.34], [0.36, 0.2, 0.11], [0.58, 0.52, 0.4], [0.3, 0.08, 0.1], [0.1, 0.14, 0.12]];
  for (const [y, n] of [[1.34, 15], [0.98, 0]]) { const x = -wallX(y + 0.2, 0.03), xs = -wallX(y, 0.03); box(g, [(x + xs) / 2 + 0.13, y, -1.25], [0.3, 0.035, 1.15], 0, WT2, 0, 0, WOOD);
    for (const z of [-1.82, -0.68]) { tube(g, [[xs + 0.02, y - 0.02, z], [xs + 0.12, y - 0.13, z]], 0.012, 0.012, 4, IRON); }
    tube(g, [[x + 0.3, y + 0.08, -1.84], [x + 0.3, y + 0.08, -0.66]], 0.01, 0.01, 6, BRASS, 0, MET); let z = -1.76;
    for (let i = 0; i < n; i++) { const t = rr(0.03, 0.065), h = rr(0.18, 0.28), d = rr(0.15, 0.2), lean = i === 9 ? 0.32 : rr(-0.025, 0.025); book(x + 0.15 + (0.2 - d) / 2, y + 0.018, z + (i === 9 ? 0.05 : 0), h, t, d, sh(BOOKS[Math.floor(R() * BOOKS.length) % BOOKS.length], rr(0.8, 1.1)), lean); z += t + 0.006 + (i === 9 ? 0.1 : 0); }
    if (n) { box(g, [x + 0.16, y + 0.1, z + 0.01], [0.16, 0.16, 0.012], 0, BRASS, 0, 0, MET); box(g, [x + 0.16, y + 0.022, z - 0.03], [0.16, 0.008, 0.08], 0, BRASS, 0, 0, MET); }
    if (!n) { lathe(g, [x + 0.16, y + 0.018, -1.6], 'y', [[0, 0.05], [0.12, 0.05], [0.14, 0.03], [0.16, 0.035]], 10, [0.3, 0.42, 0.4], 0, MET); lathe(g, [x + 0.16, y + 0.018, -1.42], 'y', [[0, 0.04], [0.08, 0.045], [0.1, 0.035], [0.1, 0]], 10, COPPER, 0, MET); soft(g, [x + 0.17, y + 0.06, -1.05], [0.15, 0.08, 0.2], 4, [0.33, 0.24, 0.13], 6, 0.03); lathe(g, [x + 0.16, y + 0.018, -0.8], 'y', [[0, 0.03], [0.02, 0.045], [0.1, 0.045], [0.12, 0.025], [0.15, 0.02], [0.15, 0]], 10, [0.18, 0.32, 0.26]); }
  }
  // Seekarte an der Wand
  { const y = 1.5, x = -wallX(y, 0.03), rx = x / (RC - 0.03), ry = (y - CY) / (RC - 0.03), P = (a, b) => [x + ry * b - rx * 0.02, y - rx * b - ry * 0.02, -0.28 + a];
    g.uvq = []; for (let j = 0; j <= 10; j++) for (let k = 0; k <= 14; k++) g.uvq.push([k / 14, j / 10, -2]); g.k = 0; grid(g, 14, 10, (k, j) => { const a = -0.38 + k / 14 * 0.76, b = -0.27 + j / 10 * 0.54, p = P(a, b), cu = 0.012 * (Math.sin(k * 0.45) * 0.6 + Math.pow(Math.abs(k / 7 - 1), 3)) + 0.006 * Math.sin(j * 0.8); return [p[0] - rx * cu, p[1] - ry * cu, p[2]]; }, [1, 1, 1], MAP); g.uvq = null;
    for (const [a, b] of [[-0.36, -0.25], [0.36, -0.25], [-0.36, 0.25], [0.36, 0.25]]) { const p = P(a, b); dome(g, [p[0] - rx * 0.006, p[1] - ry * 0.006, p[2]], [-rx, -ry, 0], 0.012, BRASS); } }

  // ---------- Ofen: gusseiserner Bauchofen mit Füßen, Tür, Glut, Rohr; daneben ein Holzkorb ----------
  { const o = [-0.88, 0, 0.25];
    lathe(g, [o[0], 0.17, o[2]], 'y', [[0, 0], [0, 0.18], [0.03, 0.22], [0.13, 0.27], [0.28, 0.295], [0.4, 0.27], [0.46, 0.22], [0.5, 0.2], [0.52, 0.23], [0.56, 0.23], [0.58, 0.19], [0.58, 0]], 16, CAST, 0, MET);
    for (const y of [0.3, 0.57]) ring(g, [o[0], y, o[2]], [0, 1, 0], y < 0.4 ? 0.272 : 0.29, 0.016, 20, 5, sh(CAST, 1.6), 0, MET);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4, ca = Math.cos(a), sa = Math.sin(a); tube(g, [[o[0] + ca * 0.16, 0.2, o[2] + sa * 0.16], [o[0] + ca * 0.24, 0.1, o[2] + sa * 0.24], [o[0] + ca * 0.27, 0.01, o[2] + sa * 0.27]], 0.025, 0.018, 6, CAST, 0, MET); soft(g, [o[0] + ca * 0.275, 0.012, o[2] + sa * 0.275], [0.05, 0.025, 0.05], 2.5, CAST, k, 0); }
    lathe(g, [o[0], 0.74, o[2]], 'y', [[0, 0.24], [0.012, 0.24], [0.018, 0.2], [0.018, 0.0]], 16, sh(CAST, 1.5), 0, MET);
    const dx = o[0] + 0.285, dy = 0.42;
    box(g, [dx + 0.01, dy, o[2]], [0.03, 0.2, 0.22], 0, sh(CAST, 1.3), 0, 0, MET); box(g, [dx - 0.005, dy, o[2]], [0.02, 0.16, 0.18], 0, FIREC, 1.6, 0, FIRE);
    for (let k = 0; k < 5; k++) box(g, [dx + 0.028, dy, o[2] - 0.07 + k * 0.035], [0.012, 0.15, 0.012], 0, CAST, 0, 0, MET);
    lathe(g, [dx + 0.035, dy, o[2] + 0.09], 'x', [[0, 0.015], [0.05, 0.012], [0.055, 0]], 6, BRASS, 0, MET);
    box(g, [dx + 0.01, 0.22, o[2]], [0.03, 0.05, 0.18], 0, sh(CAST, 1.2), 0, 0, MET); box(g, [dx - 0.005, 0.22, o[2]], [0.02, 0.03, 0.14], 0, FIREC, 0.7, 0, FIRE);
    tube(g, [[o[0] - 0.08, 0.75, o[2] + 0.1], [o[0] - 0.08, 1.45, o[2] + 0.1], [o[0] - 0.14, 1.58, o[2] + 0.1], [o[0] - 0.3, 1.68, o[2] + 0.1], [o[0] - 0.42, 1.73, o[2] + 0.1]], 0.065, 0.065, 10, CAST, 0, MET);
    ring(g, [o[0] - 0.08, 1.15, o[2] + 0.1], [0, 1, 0], 0.07, 0.012, 12, 4, BRASS, 0, MET); tube(g, [[o[0] - 0.16, 1.15, o[2] + 0.1], [o[0] + 0.0, 1.15, o[2] + 0.1]], 0.01, 0.01, 4, BRASS, 0, MET); lathe(g, [o[0] + 0.01, 1.15, o[2] + 0.1], 'x', [[0, 0.018], [0.03, 0.018], [0.035, 0]], 6, [0.2, 0.12, 0.08]);
    // Holzkorb
    const bk = [-0.84, 0, -0.18]; for (let k = 0; k < 14; k++) { const a = k / 14 * 2 * PI; tube(g, [[bk[0] + Math.cos(a) * 0.14, 0, bk[2] + Math.sin(a) * 0.11], [bk[0] + Math.cos(a) * 0.17, 0.2, bk[2] + Math.sin(a) * 0.14]], 0.008, 0.008, 3, [0.4, 0.3, 0.16]); }
    for (const y of [0.02, 0.08, 0.14, 0.2]) { const k = y / 0.2, pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * 2 * PI; pts.push([bk[0] + Math.cos(a) * (0.14 + 0.03 * k), y, bk[2] + Math.sin(a) * (0.11 + 0.03 * k)]); } tube(g, pts, 0.013, 0.013, 4, [0.45, 0.34, 0.18]); }
    for (let k = 0; k < 5; k++) { const a = rr(-0.3, 0.3) + (k % 2) * PI / 2, y = 0.08 + k * 0.045, l = 0.2, cx = bk[0] + rr(-0.04, 0.04), cz = bk[2] + rr(-0.03, 0.03), p0 = [cx - Math.cos(a) * l / 2, y, cz - Math.sin(a) * l / 2], p1 = [cx + Math.cos(a) * l / 2, y + 0.04, cz + Math.sin(a) * l / 2]; tube(g, [p0, p1], 0.035, 0.035, 7, [0.33, 0.23, 0.14], 0, WOOD); disc(g, p0, [-(p1[0] - p0[0]), -(p1[1] - p0[1]), -(p1[2] - p0[2])], 0.035, [0.72, 0.56, 0.36], 0, 7); disc(g, p1, [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], 0.035, [0.72, 0.56, 0.36], 0, 7); }
  }

  // ---------- rechts: Schreibtisch mit Lampe, Papieren, Logbuch; Funkgestell mit Anzeigen und Kassettendeck ----------
  for (let k = 0; k < 3; k++) plank(g, [0.6 + k * 0.205, 0.765, -0.65], [0.6 + (k + 1) * 0.205 - 0.006, 0.765, -0.65], [0.6 + (k + 1) * 0.205 - 0.006, 0.765, 0.65], [0.6 + k * 0.205, 0.765, 0.65], tint(0.85 + 0.15 * R()), k, R, 1.3);
  box(g, [0.9, 0.742, 0.0], [0.64, 0.045, 1.32], 0, WT3, 0, 0, WOOD); box(g, [0.92, 0.37, -0.42], [0.56, 0.7, 0.44], 0, WT2, 0, 0, WOOD); lathe(g, [0.64, 0, 0.58], 'y', [[0, 0.035], [0.05, 0.04], [0.1, 0.03], [0.65, 0.032], [0.7, 0.04], [0.72, 0.03]], 8, WT2, 0, WOOD);
  for (let k = 0; k < 3; k++) { box(g, [0.635, 0.16 + k * 0.21, -0.42], [0.02, 0.17, 0.38], 0, WT1, 0, 0, WOOD); lathe(g, [0.62, 0.16 + k * 0.21, -0.42], 'x', [[0, 0], [-0.01, 0.022], [-0.03, 0.018], [-0.035, 0]], 8, BRASS, 0, MET); }
  { const b = [0.98, 0.765, 0.42]; lathe(g, b, 'y', [[0, 0.07], [0.015, 0.07], [0.02, 0.02]], 10, BRASS, 0, MET); tube(g, [[b[0], b[1], b[2]], [b[0], b[1] + 0.26, b[2]], [b[0] - 0.1, b[1] + 0.33, b[2] - 0.06]], 0.012, 0.012, 6, BRASS, 0, MET); lathe(g, [b[0] - 0.12, b[1] + 0.24, b[2] - 0.07], 'y', [[0, 0.1], [0.07, 0.05], [0.1, 0.03]], 12, [0.2, 0.36, 0.26]); disc(g, [b[0] - 0.12, b[1] + 0.243, b[2] - 0.07], [0, -1, 0], 0.092, WARM, 1.8, 12, STEADY); }
  for (const [x, z, r, c] of [[0.82, 0.05, 0.25, PAPER], [0.9, -0.08, -0.4, sh(PAPER, 0.92)], [0.8, 0.22, 0.9, sh(PAPER, 0.96)]]) box(g, [x, 0.77, z], [0.21, 0.003, 0.29], r, c);
  { const c = [0.77, 0.772, -0.22]; tube(g, [[c[0], c[1], c[2]], [c[0] + 0.12, c[1] + 0.005, c[2] + 0.06]], 0.006, 0.004, 6, [0.15, 0.1, 0.06]); lathe(g, [0.72, 0.767, 0.16], 'y', [[0, 0.03], [0.05, 0.035], [0.06, 0.02], [0.06, 0]], 10, [0.08, 0.1, 0.14]); }   // Feder und Tintenfass
  // Logbuch: aufgeschlagen, Ledereinband
  { const c = [0.9, 0.77, -0.25]; box(g, [c[0], c[1] + 0.004, c[2]], [0.24, 0.008, 0.34], 0.15, [0.36, 0.12, 0.08]); for (const s of [-1, 1]) grid(g, 6, 2, (i, j) => { const u = i / 6, v = j / 2, a = 0.15, lx = -0.11 + v * 0.22, lz = s * (0.005 + u * 0.155), y = c[1] + 0.012 + Math.sin(u * PI) * 0.012 * (1 - u * 0.3); return [c[0] + lx * Math.cos(a) + lz * Math.sin(a), y, c[2] - lx * Math.sin(a) + lz * Math.cos(a)]; }, PAPER); }
  // Kassettenregal: kleines Holzgestell hinten auf dem Schreibtisch, unter dem Funkgestell; sechs Fächer
  box(g, [1.135, 0.772, 0.0], [0.1, 0.012, 0.3], 0, WT2, 0, 0, WOOD); box(g, [1.182, 0.83, 0.0], [0.008, 0.125, 0.3], 0, WT3, 0, 0, WOOD);
  for (const z of [-0.146, 0.146]) box(g, [1.135, 0.83, z], [0.1, 0.125, 0.012], 0, WT1, 0, 0, WOOD); tube(g, [[1.086, 0.782, -0.146], [1.086, 0.782, 0.146]], 0.005, 0.005, 4, BRASS, 0, MET);
  { const y0 = 1.02, y1 = 1.66, xw = wallX(y1, 0.02), xf = 1.06, yc = (y0 + y1) / 2, F = (y, z, d = 0) => [xf - 0.01 - d, y, z];
    // Gehäuse aus Brettern, dunkelgrün lackierte Frontplatte mit Messingrahmen und Schrauben
    box(g, [(xw + xf) / 2 + 0.04, yc, 0.14], [xw - xf + 0.08, y1 - y0, 0.96], 0, WT2, 0, 0, WOOD);
    for (const z of [-0.33, 0.61]) box(g, [xf - 0.005, yc, z], [0.04, y1 - y0 + 0.02, 0.04], 0, WT1, 0, 0, WOOD); for (const y of [y0, y1]) box(g, [xf - 0.005, y, 0.14], [0.04, 0.04, 0.98], 0, WT1, 0, 0, WOOD);
    quad(g, F(1.34, -0.3), F(1.34, 0.58), F(1.63, 0.58), F(1.63, -0.3), [0.07, 0.14, 0.11], 0, MET); for (const [y, z] of [[1.355, -0.28], [1.355, 0.56], [1.615, -0.28], [1.615, 0.56]]) dome(g, F(y, z, 0.002), [-1, 0, 0], 0.01, BRASS);
    tube(g, [F(1.34, -0.3, 0.008), F(1.34, 0.58, 0.008), F(1.63, 0.58, 0.008), F(1.63, -0.3, 0.008), F(1.34, -0.3, 0.008)], 0.01, 0.01, 4, BRASS, 0, MET);
    for (const [y, z, r] of [[1.49, -0.13, 0.095], [1.49, 0.13, 0.095]]) { disc(g, F(y, z, 0.012), [-1, 0, 0], r, [0.86, 0.8, 0.6], 0.32, 20); for (let t = 0; t < 9; t++) { const a = -2.2 + t * 0.55, cy = Math.cos(a), sy = Math.sin(a); quad(g, F(y + cy * r * 0.78 - 0.002 * sy, z + sy * r * 0.78, 0.014), F(y + cy * r * 0.78 + 0.002 * sy, z + sy * r * 0.78, 0.014), F(y + cy * r * 0.92, z + sy * r * 0.92, 0.014), F(y + cy * r * 0.92, z + sy * r * 0.92 - 0.003, 0.014), [0.18, 0.12, 0.08]); }
      lathe(g, F(y, z, 0), 'x', [[0, r + 0.022], [-0.022, r + 0.022], [-0.032, r + 0.004], [-0.024, r - 0.006]], 20, BRASS, 0, MET); disc(g, F(y, z, 0.03), [-1, 0, 0], 0.012, BRASS, 0, 8);
      quad(g, F(y - 0.003, z, 0.016), F(y + 0.003, z, 0.016), F(y + 0.07, z + (z < 0 ? 0.03 : -0.045), 0.016), F(y + 0.066, z + (z < 0 ? 0.026 : -0.049), 0.016), [0.12, 0.05, 0.04]); }
    for (const [z, col] of [[0.33, [0.3, 1.0, 0.45]], [0.4, [1.0, 0.55, 0.2]]]) { lathe(g, F(1.56, z, 0), 'x', [[0, 0.018], [-0.012, 0.018], [-0.018, 0.012]], 8, BRASS, 0, MET); disc(g, F(1.56, z, 0.019), [-1, 0, 0], 0.012, col, 1.4, 8); }
    for (const [z, k] of [[0.36, 0], [0.47, 1]]) { lathe(g, F(1.43, z, 0), 'x', [[0, 0.035], [-0.03, 0.033], [-0.04, 0.026], [-0.045, 0]], 12, [0.12, 0.1, 0.09], 0, MET); box(g, F(1.43 + 0.022, z, 0.045), [0.006, 0.014, 0.004], 0, [0.8, 0.75, 0.6], 0, k * 0.4); }
    // Kassettendeck: Holzkasten mit Messingkante, Schacht mit Sichtfenster, Klaviertasten, Lautsprecherbespannung, Aussteuerungsanzeige
    const dz0 = -0.3, dz1 = 0.58, dy0 = 1.05, dy1 = 1.32;
    box(g, [xf + 0.02, (dy0 + dy1) / 2, (dz0 + dz1) / 2], [0.12, dy1 - dy0, dz1 - dz0], 0, WT1, 0, 0, WOOD); tube(g, [F(dy1, dz0, 0.04), F(dy1, dz1, 0.04)], 0.008, 0.008, 4, BRASS, 0, MET);
    quad(g, F(1.115, -0.17, 0.042), F(1.115, 0.21, 0.042), F(1.305, 0.21, 0.042), F(1.305, -0.17, 0.042), [0.07, 0.065, 0.06], 0, MET);
    quad(g, F(1.165, -0.12, 0.045), F(1.165, 0.16, 0.045), F(1.29, 0.16, 0.045), F(1.29, -0.12, 0.045), [0.08, 0.075, 0.07]);
    quad(g, F(1.17, -0.11, 0.047), F(1.17, 0.15, 0.047), F(1.285, 0.15, 0.047), F(1.285, -0.11, 0.047), [0.82, 0.74, 0.55]); quad(g, F(1.195, -0.06, 0.049), F(1.195, 0.1, 0.049), F(1.245, 0.1, 0.049), F(1.245, -0.06, 0.049), [0.05, 0.05, 0.05]);
    quad(g, F(1.253, -0.09, 0.049), F(1.253, 0.13, 0.049), F(1.265, 0.13, 0.049), F(1.265, -0.09, 0.049), [0.75, 0.25, 0.14]);
    for (let k = 0; k < 6; k++) { const z = -0.16 + k * 0.062; box(g, F(1.09, z + 0.025, 0.06), [0.05, 0.03, 0.05], 0, k === 5 ? [0.75, 0.18, 0.12] : [0.86, 0.82, 0.72], 0, 0.25, 0); box(g, F(1.075, z + 0.025, 0.05), [0.03, 0.01, 0.052], 0, [0.6, 0.6, 0.58], 0, 0.25, MET); }
    quad(g, F(1.08, 0.25, 0.042), F(1.08, 0.55, 0.042), F(1.3, 0.55, 0.042), F(1.3, 0.25, 0.042), [0.2, 0.15, 0.1]); for (let k = 0; k < 9; k++) { const y = 1.095 + k * 0.023; tube(g, [F(y, 0.26, 0.046), F(y, 0.54, 0.046)], 0.004, 0.004, 4, BRASS, 0, MET); }
    for (const [y, z] of [[1.075, 0.27], [1.075, 0.53], [1.285, 0.27], [1.285, 0.53]]) dome(g, F(y, z, 0.044), [-1, 0, 0], 0.007, BRASS);
    tube(g, [[xf + 0.05, y1, -0.2], [xf - 0.1, y1 + 0.2, -0.3], [0.6, CY + Math.sqrt((RC - 0.1) ** 2 - 0.36), -0.5]], 0.012, 0.012, 5, IRON); tube(g, [[xf + 0.05, y1, 0.3], [xf - 0.05, y1 + 0.25, 0.5], [0.46, 2.0, 0.9]], 0.01, 0.01, 5, [0.3, 0.08, 0.06]); }

  // ---------- rechts hinten: Sonartisch ----------
  box(g, [0.92, 0.42, -1.42], [0.6, 0.84, 0.92], 0, WT2, 0, 0, WOOD); quad(g, [0.6, 0.84, -1.89], [0.6, 0.84, -0.95], [1.24, 1.13, -0.95], [1.24, 1.13, -1.89], WD3, 0, WOOD); box(g, [0.605, 0.83, -1.42], [0.04, 0.05, 0.96], 0, BRASS, 0, 0, MET);
  const sn = [-0.413, 0.911, 0], sc = [0.9, 0.976, -1.42];
  ring(g, [sc[0] + sn[0] * 0.015, sc[1] + sn[1] * 0.015, sc[2]], sn, 0.3, 0.032, 32, 6, BRASS, 0, MET);
  for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI, u = [sn[1], -sn[0], 0], p = [sc[0] + sn[0] * 0.03 + u[0] * Math.cos(a) * 0.3, sc[1] + sn[1] * 0.03 + u[1] * Math.cos(a) * 0.3, sc[2] + Math.sin(a) * 0.3]; dome(g, p, sn, 0.01, BRASS); }
  for (const z of [-1.72, -1.12]) { box(g, [0.615, 0.4, z], [0.02, 0.5, 0.36], 0, WT1, 0, 0, WOOD); lathe(g, [0.6, 0.55, z], 'x', [[0, 0], [-0.01, 0.02], [-0.03, 0.016], [-0.035, 0]], 8, BRASS, 0, MET); }

  // ---------- hinten: Luke, Uhr, Lichtschalter, Mantel ----------
  disc(g, [0, 0.95, ZA + 0.03], [0, 0, 1], 0.56, sh(IRON, 1.6), 0, 24, MET); ring(g, [0, 0.95, ZA + 0.05], [0, 0, 1], 0.56, 0.05, 32, 6, BRASS, 0, MET); ring(g, [0, 0.95, ZA + 0.12], [0, 0, 1], 0.17, 0.02, 20, 6, BRASS, 0, MET);
  for (let k = 0; k < 3; k++) { const a = k * PI / 3; tube(g, [[-Math.cos(a) * 0.17, 0.95 - Math.sin(a) * 0.17, ZA + 0.12], [Math.cos(a) * 0.17, 0.95 + Math.sin(a) * 0.17, ZA + 0.12]], 0.012, 0.012, 5, BRASS, 0, MET); } tube(g, [[0, 0.95, ZA + 0.03], [0, 0.95, ZA + 0.12]], 0.025, 0.025, 8, BRASS, 0, MET);
  for (let k = 0; k < 12; k++) { const a = k / 12 * 2 * PI; dome(g, [Math.cos(a) * 0.48, 0.95 + Math.sin(a) * 0.48, ZA + 0.04], [0, 0, 1], 0.018, BRASS); }
  disc(g, [0.72, 1.55, ZA + 0.04], [0, 0, 1], 0.11, [0.95, 0.9, 0.72], 0.6, 18); lathe(g, [0.72, 1.55, ZA + 0.02], 'z', [[0, 0.135], [0.02, 0.135], [0.03, 0.115], [0.025, 0.105]], 18, BRASS, 0, MET); quad(g, [0.716, 1.55, ZA + 0.045], [0.724, 1.55, ZA + 0.045], [0.76, 1.61, ZA + 0.045], [0.752, 1.615, ZA + 0.045], IRON); quad(g, [0.716, 1.55, ZA + 0.045], [0.724, 1.55, ZA + 0.045], [0.69, 1.5, ZA + 0.045], [0.684, 1.505, ZA + 0.045], IRON);
  { const s = [0.45, 1.3, ZA + 0.03]; box(g, s, [0.09, 0.14, 0.012], 0, BRASS, 0, 0, MET); for (const dy of [-0.05, 0.05]) dome(g, [s[0], s[1] + dy, s[2] + 0.008], [0, 0, 1], 0.008, BRASS); }
  soft(g, [-0.62, 1.22, ZA + 0.1], [0.34, 0.72, 0.1], 5, [0.2, 0.24, 0.2], 9, 0.08); soft(g, [-0.62, 1.58, ZA + 0.12], [0.2, 0.08, 0.1], 3, [0.18, 0.22, 0.18], 10, 0.05); box(g, [-0.62, 1.62, ZA + 0.06], [0.05, 0.05, 0.1], 0, BRASS, 0, 0, MET);
  lathe(g, [-0.3, 1.62, ZA + 0.1], 'z', [[0, 0.16], [0.03, 0.15], [0.06, 0.08], [0.1, 0.07], [0.11, 0]], 12, [0.32, 0.22, 0.12]);
  // Hängelampe und Teppich
  { const p = [0, 2.02, -0.55]; tube(g, [[0, CY + RC - 0.02, p[2]], [0, p[1] + 0.12, p[2]]], 0.008, 0.008, 4, IRON); lathe(g, p, 'y', [[0.12, 0.012], [0.108, 0.03], [0.072, 0.08], [0.066, 0.03]], 12, BRASS, 0, MET); lathe(g, p, 'y', [[0.066, 0.03], [0.024, 0.046], [-0.024, 0.037], [-0.042, 0.018], [-0.045, 0]], 12, WARM, 1.5, LAMP); }
  for (const [w, l, col] of [[0.46, 0.92, [0.3, 0.07, 0.06]], [0.4, 0.86, [0.5, 0.36, 0.16]], [0.33, 0.79, [0.34, 0.09, 0.08]], [0.14, 0.5, [0.46, 0.32, 0.15]]]) quad(g, [-w, 0.004 + (0.5 - w) * 0.008, -0.55 - l], [-w, 0.004 + (0.5 - w) * 0.008, -0.55 + l], [w, 0.004 + (0.5 - w) * 0.008, -0.55 + l], [w, 0.004 + (0.5 - w) * 0.008, -0.55 - l], col);

  // gebackene Verschattung
  const AO = bakeAO(g);

  // ---------- Material ----------
  const wood = new T.TextureLoader().load('wood.jpg'); wood.wrapS = T.ClampToEdgeWrapping; wood.wrapT = T.RepeatWrapping; wood.anisotropy = 4;
  const LP = [[0, 1.95, -0.55], [-1.0, 1.36, 1.36], [1.0, 1.36, 1.36], [0.86, 0.98, 0.35], [-0.6, 0.4, 0.25], [0.86, 1.1, -1.42]], LC = [[1.0, 0.68, 0.38, 1.7], [1.0, 0.68, 0.38, 0.7], [1.0, 0.68, 0.38, 0.7], [1.0, 0.7, 0.4, 0.6], [1.0, 0.4, 0.12, 0.9], [0.2, 1.0, 0.5, 0.1]];
  const UC = { uNoise: U.uNoise, uTime: U.uTime, uWood: { value: wood }, uMap: { value: chartTexture() }, uWin: { value: new T.Vector3(0.1, 0.4, 0.6) }, uEye: { value: new T.Vector3() }, uLamp: { value: 1 }, uFire: { value: 1 },
    uLP: { value: LP.map((p) => new T.Vector3(p[0], p[1], p[2])) }, uLC: { value: LC.map((c) => new T.Vector3(c[0] * c[3], c[1] * c[3], c[2] * c[3])) } };
  const LC0 = LC.map((c) => new T.Vector3(c[0] * c[3], c[1] * c[3], c[2] * c[3]));
  const VS = `attribute float aWind, aShade, aAO; attribute vec3 aUV; varying vec3 vL, vN, vC, vUV; varying float vE, vG, vA; void main(){ vL = position; vN = normal; vC = color; vE = aShade; vG = aWind; vA = aAO; vUV = aUV; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const FS = /* glsl */ `precision highp float; uniform sampler2D uNoise, uWood, uMap; uniform float uTime, uLamp, uFire; uniform vec3 uWin, uEye, uLP[6], uLC[6]; varying vec3 vL, vN, vC, vUV; varying float vE, vG, vA;
    vec3 woodAt(vec2 uv, float k) { return texture2D(uWood, vec2((k + 0.03 + uv.x * 0.94) * 0.25, uv.y)).rgb; }
    void main(){ vec3 N = normalize(vN), V = normalize(uEye - vL); if (dot(N, V) < 0.0) N = -N;
      vec3 base = vC; float ao = vA;
      if (vG < -0.5) {
        vec3 w;
        if (vUV.z >= 0.0) w = woodAt(vUV.xy, vUV.z);
        else { vec3 a = abs(N); vec3 p = vL * vec3(4.0, 0.9, 0.9); w = (woodAt(fract(vec2(p.y * 4.0, p.z)), 1.0) * a.x + woodAt(fract(vec2(p.x * 1.1, p.z)), 2.0) * a.y + woodAt(fract(vec2(p.x * 1.1, p.y)), 3.0) * a.z) / (a.x + a.y + a.z); }
        base = w * vC * 1.25;
      } else if (vG > 5.5) { base = texture2D(uMap, vUV.xy).rgb;
      } else if (vG > 0.5 && vG < 1.5) {   // Messing/Eisen: Patina in Vertiefungen, Flecken
        float n = texture2D(uNoise, vL.xz * 3.0 + vL.y * 2.0).r, n2 = texture2D(uNoise, vL.zy * 7.0).g;
        base = mix(base, vec3(0.16, 0.27, 0.2) * (base.r + 0.3), smoothstep(0.55, 0.9, (1.0 - ao) * 1.4 + n * 0.35) * 0.75) * (0.82 + 0.3 * n2);
      }
      float fl = 0.82 + 0.1 * sin(uTime * 11.0) * sin(uTime * 6.3) + 0.08 * sin(uTime * 23.0 + 1.0), metal = step(0.5, vG) * step(vG, 1.5);
      vec3 L = vec3(0.13, 0.088, 0.064) * (0.4 + 0.6 * uLamp), S = vec3(0.0);
      for (int i = 0; i < 6; i++) { vec3 d = uLP[i] - vL; float r2 = dot(d, d); d *= inversesqrt(r2); float k = (i == 4) ? fl : 0.97 + 0.03 * sin(uTime * 3.0 + float(i) * 2.0), at = 1.0 / (1.0 + r2 * 0.9);
        L += uLC[i] * k * (0.15 + 0.85 * max(dot(N, d), 0.0)) * at; S += uLC[i] * k * pow(max(dot(reflect(-d, N), V), 0.0), metal > 0.5 ? 22.0 : 10.0) * at * (metal > 0.5 ? 2.2 : 0.25); }
      vec3 dw = vec3(0.0, 1.15, 1.75) - vL; float rw = dot(dw, dw); L += uWin * (0.2 + 0.8 * max(dot(N, dw * inversesqrt(rw)), 0.0)) / (1.0 + rw * 0.8);
      float ao2 = mix(1.0, ao, 0.85);
      vec3 env = metal * base * (0.12 + 0.3 * pow(1.0 - max(dot(N, V), 0.0), 2.0)) * vec3(1.0, 0.75, 0.5) * uLamp;   // warmer Raum spiegelt sich im Messing
      vec3 emi = vC * vE * (vG > 2.5 && vG < 3.5 ? fl * uFire : vG > 1.5 && vG < 2.5 ? uLamp : 1.0);
      vec3 c = base * L * ao2 + S * (0.35 + base) * ao + env * ao + emi;
      gl_FragColor = vec4(c, 1.0); }`;
  const mat = new T.ShaderMaterial({ uniforms: UC, vertexColors: true, side: T.DoubleSide, vertexShader: VS, fragmentShader: FS });
  const group = new T.Group(), inner = new T.Group(); inner.position.y = FLOOR_Y; inner.scale.x = -1; group.add(inner); group.rotation.order = 'YXZ';   // gespiegelt: Koje links, Schreibtisch rechts
  const withAO = (geo, ao) => { geo.setAttribute('aAO', new T.BufferAttribute(ao || new Float32Array(geo.attributes.position.count).fill(1), 1)); return geo; };
  Object.assign(mat, { stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp });
  const mesh = new T.Mesh(withAO(g.build(), AO), mat); mesh.frustumCulled = false; inner.add(mesh);
  const part = (fn, pivot) => { const q = new CGeo(); fn(q); const m = new T.Mesh(withAO(q.build()), mat); m.frustumCulled = false; const p = new T.Group(); p.position.set(...pivot); p.add(m); inner.add(p); return p; };

  // ---------- bewegliche Teile ----------
  const wn = new T.Vector3(0, 0.8, -0.6).normalize();
  const wheel = part((q) => { ring(q, [0, 0, 0], [0, 0, 1], 0.15, 0.02, 24, 6, WT1, 0, WOOD); for (let k = 0; k < 6; k++) { const a = k * PI / 3, ca = Math.cos(a), sa = Math.sin(a); tube(q, [[ca * 0.03, sa * 0.03, 0], [ca * 0.15, sa * 0.15, 0], [ca * 0.21, sa * 0.21, 0]], 0.011, 0.016, 6, k ? WT1 : [0.7, 0.55, 0.3], 0, WOOD); soft(q, [ca * 0.215, sa * 0.215, 0], [0.03, 0.03, 0.03], 2, WT2, k, 0, WOOD); } lathe(q, [0, 0, 0], 'z', [[-0.03, 0.035], [0.02, 0.04], [0.03, 0.02], [0.035, 0]], 10, BRASS, 0, MET); }, [0, 0.88, 1.08]);
  wheel.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), wn);
  const helm = new T.Mesh(withAO((() => { const q = new CGeo(); tube(q, [[0, 0.8, 1.2], [0, 0.88, 1.08]], 0.028, 0.028, 8, BRASS, 0, MET); return q.build(); })()), mat); inner.add(helm);
  const lever = part((q) => { tube(q, [[0, 0, 0], [0, 0.2, 0]], 0.012, 0.01, 6, BRASS, 0, MET); soft(q, [0, 0.215, 0], [0.04, 0.05, 0.04], 2.4, [0.08, 0.07, 0.06], 3, 0); }, [0.32, 0.84, 1.2]);
  { const q = new CGeo(); for (const s of [-1, 1]) box(q, [0.32 + s * 0.03, 0.84, 1.2], [0.012, 0.06, 0.14], 0, BRASS, 0, 0, MET); lathe(q, [0.32, 0.84, 1.2], 'x', [[-0.03, 0.02], [0.03, 0.02]], 8, IRON, 0, MET); box(q, [0.32, 0.835, 1.2], [0.05, 0.012, 0.16], 0, [0.1, 0.1, 0.1]); const m = new T.Mesh(withAO(q.build()), mat); m.frustumCulled = false; inner.add(m); }
  const reels = [-0.035, 0.075].map((z) => part((q) => { disc(q, [0, 0, 0], [-1, 0, 0], 0.024, [0.75, 0.7, 0.6], 0, 12); for (let k = 0; k < 3; k++) { const a = k * 2.094; box(q, [-0.002, Math.cos(a) * 0.016, Math.sin(a) * 0.016], [0.004, 0.006, 0.022], -0, [0.1, 0.1, 0.1], 0, a); } }, [1.06 - 0.06, 1.22, z]));
  const tapeLed = part((q) => disc(q, [0, 0, 0], [-1, 0, 0], 0.009, [1.0, 0.3, 0.15], 1.6, 8), [1.06 - 0.055, 1.14, 0.2]); tapeLed.visible = false;
  // Kassetten im Regal (nur die, die man besitzt und die nicht gerade im Deck liegen) und die lose Logbuchseite des Kapitäns
  const CASZ = (k) => -0.105 + k * 0.042, CASC = [[0.5, 0.17, 0.12], [0.16, 0.36, 0.36], [0.62, 0.68, 0.74], [0.5, 0.4, 0.16], [0.3, 0.2, 0.42], [0.2, 0.3, 0.16]];
  const cass = CASC.map((c, k) => { const p = part((q) => { box(q, [0, 0, 0], [0.068, 0.104, 0.027], 0, c); box(q, [-0.0345, 0.004, 0], [0.002, 0.074, 0.021], 0, PAPER); box(q, [-0.0358, 0.026, 0], [0.002, 0.012, 0.022], 0, sh(c, 1.5)); for (let i = 0; i < 3; i++) box(q, [-0.0358, -0.004 - i * 0.012, 0], [0.002, 0.002, 0.014], 0, [0.25, 0.18, 0.12]); }, [1.132, 0.83, CASZ(k)]); p.rotation.x = k % 3 === 1 ? 0.05 : k % 3 === 2 ? -0.04 : 0; p.visible = false; return p; });
  const page = part((q) => { const a = 0.25, ca = Math.cos(a), sa = Math.sin(a), at = (lx, lz) => [lx * ca + lz * sa, 0.0048, -lx * sa + lz * ca]; box(q, [0, 0.002, 0], [0.2, 0.004, 0.275], a, [0.88, 0.79, 0.58]);
    for (let i = 0; i < 9; i++) box(q, at(i === 8 ? -0.03 : 0, -0.105 + i * 0.022), [i === 8 ? 0.09 : 0.155 - (i % 3) * 0.012, 0.0008, 0.0035], a, [0.24, 0.16, 0.1]); disc(q, at(0.062, 0.108), [0, 1, 0], 0.014, [0.55, 0.1, 0.08], 0, 10); }, [0.83, 0.7725, 0.04]);
  const cupGeo = (q) => { lathe(q, [0, 0, 0], 'y', [[0, 0.036], [0.005, 0.04], [0.07, 0.045], [0.08, 0.044], [0.08, 0.038], [0.012, 0.034], [0.012, 0]], 12, [0.82, 0.8, 0.74]); disc(q, [0, 0.07, 0], [0, 1, 0], 0.038, [0.38, 0.19, 0.08], 0, 12); ring(q, [0.052, 0.04, 0], [0, 0, 1], 0.018, 0.006, 10, 4, [0.82, 0.8, 0.74]); };
  const cupDesk = part(cupGeo, [0.74, 0.769, 0.32]), cupPult = part(cupGeo, [0.66, 0.795, 1.02]); cupDesk.visible = cupPult.visible = false;
  const kettle = part((q) => { lathe(q, [0, 0, 0], 'y', [[0, 0.085], [0.02, 0.115], [0.1, 0.118], [0.14, 0.085], [0.155, 0.04], [0.16, 0.035], [0.17, 0.02], [0.175, 0]], 14, COPPER, 0, MET); tube(q, [[0.1, 0.06, 0], [0.18, 0.12, 0], [0.22, 0.17, 0]], 0.024, 0.01, 8, COPPER, 0, MET); const hp = []; for (let k = 0; k <= 10; k++) { const a = k / 10 * PI; hp.push([0, 0.15 + Math.sin(a) * 0.12, -0.08 + k * 0.016]); } tube(q, hp, 0.01, 0.01, 6, IRON, 0, MET); soft(q, [0, 0.27, 0], [0.04, 0.03, 0.12], 3, [0.12, 0.08, 0.06], 1, 0); }, [-0.82, 0.76, 0.22]);

  // Bildschirm des Sonartischs
  const scv = document.createElement('canvas'); scv.width = scv.height = 256; const stex = new T.CanvasTexture(scv); stex.minFilter = T.LinearFilter; stex.generateMipmaps = false;
  const smesh = new T.Mesh(new T.CircleGeometry(0.285, 40), new T.MeshBasicMaterial({ map: stex, stencilWrite: true, stencilRef: 1, stencilFunc: T.AlwaysStencilFunc, stencilZPass: T.ReplaceStencilOp })); smesh.position.set(sc[0] + sn[0] * 0.012, sc[1] + sn[1] * 0.012, sc[2]); smesh.lookAt(sc[0] + sn[0], sc[1] + sn[1], sc[2]); inner.add(smesh); stex.wrapS = T.RepeatWrapping; stex.repeat.x = -1; stex.offset.x = 1;
  // Glaskuppel: Spiegelung am Rand
  const gg = new Geo(); lathe(gg, [0, WIN.y, ZF + 0.02], 'z', [[0, WIN.r + 0.02], [0.3, WIN.r * 0.96], [0.55, WIN.r * 0.78], [0.72, WIN.r * 0.5], [0.8, WIN.r * 0.2], [0.82, 0]], 32, [1, 1, 1]);
  const glass = new T.Mesh(gg.build(), new T.ShaderMaterial({ uniforms: UC, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec3 vL, vN; void main(){ vL = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; uniform vec3 uEye, uWin; uniform float uLamp; varying vec3 vL, vN; void main(){ vec3 N = normalize(vN), V = normalize(uEye - vL); float f = pow(1.0 - abs(dot(N, V)), 3.0), hl = pow(max(dot(reflect(-V, N), normalize(vec3(0.3, 0.6, -0.74))), 0.0), 40.0); gl_FragColor = vec4(vec3(1.0, 0.75, 0.45) * (f * 0.1 + hl * 0.25) * uLamp + uWin * f * 0.25, 1.0); }` }));
  glass.frustumCulled = false; glass.renderOrder = 2; glass.layers.set(1); inner.add(glass);
  // Dampf (Kessel und Tasse), Staub im Lampenlicht, Hinweis-Schimmer
  const gt = glowTexture(), steamK = [], steamC = [];
  for (let i = 0; i < 7; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xd8cfc0, transparent: true, opacity: 0, depthWrite: false })); s.userData.t = i / 7; s.layers.set(1); inner.add(s); steamK.push(s); }
  for (let i = 0; i < 4; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xd8cfc0, transparent: true, opacity: 0, depthWrite: false })); s.userData.t = i / 4; s.layers.set(1); inner.add(s); steamC.push(s); }
  const NDu = 160, dp = new Float32Array(NDu * 3), dsd = new Float32Array(NDu); for (let i = 0; i < NDu; i++) { dp[i * 3] = rr(-1, 1); dp[i * 3 + 1] = rr(0.3, 2.1); dp[i * 3 + 2] = rr(-2, 1.4); dsd[i] = R(); }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.setAttribute('aS', new T.BufferAttribute(dsd, 1));
  const dust = quadPoints(dg, new T.ShaderMaterial({ uniforms: Object.assign({ uPx: { value: 600 } }, UC), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute float aS; uniform float uTime, uPx, uLamp; uniform vec3 uLP[6]; varying float vA; void main(){ vec3 p = position + vec3(sin(uTime * 0.13 + aS * 30.0) * 0.15, sin(uTime * 0.07 + aS * 17.0) * 0.12, cos(uTime * 0.11 + aS * 23.0) * 0.15);
      float l = 0.0; for (int i = 0; i < 4; i++) { float d = distance(p, uLP[i]); l += 1.0 / (1.0 + d * d * 9.0); } vA = l * (0.4 + 0.6 * uLamp);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(0.006 * uPx / max(-mv.z, 0.05), 1.0, 4.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * (1.0 - smoothstep(0.1, 0.5, r)) * vA * 0.5, 1.0); }` }));
  dust.frustumCulled = false; dust.layers.set(1); inner.add(dust);
  const hint = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xffe2b0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false })); hint.renderOrder = 10; hint.layers.set(1); inner.add(hint);
  const head = new T.Object3D(); head.rotation.order = 'YXZ'; group.add(head);

  // Stellen, an denen man etwas tun kann (Kabinenkoordinaten)
  const TG = { seat: [0, 0.75, 0.72], table: [0.9, 1.02, -1.42], kettle: [-0.82, 0.92, 0.22], stove: [-0.6, 0.42, 0.25], cupDesk: [0.74, 0.82, 0.32], cupPult: [0.66, 0.84, 1.02], deck: [1.0, 1.19, 0.05], light: [0.45, 1.3, ZA + 0.05], log: [0.9, 0.8, -0.25], page: [0.83, 0.79, 0.04] }; for (let k = 0; k < 6; k++) TG['cas' + k] = [1.09, 0.835, CASZ(k)];
  const pglow = new T.Sprite(new T.SpriteMaterial({ map: gt, color: 0xffd9a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })); pglow.position.set(0.83, 0.8, 0.04); pglow.scale.set(0.3, 0.3, 1); pglow.layers.set(1); inner.add(pglow);
  const C = { group, head, scopeCtx: scv.getContext('2d'), scopeTex: stex, uni: UC, TG, inner };
  const st = { fire: 1, fireT: 1, lamp: 1, lampT: 1, boil: 0, cup: 'none', cupHeat: 0, tape: false, wheel: 0, lever: 0, own: [true, false, false, false, false, false], tapeIn: 0, pageNew: false };
  C.state = st;
  C.toWorld = (k, out) => out.set(TG[k][0], TG[k][1], TG[k][2]).applyMatrix4(inner.matrixWorld);
  C.highlight = (k) => { if (!k) { hint.material.opacity = Math.max(0, hint.material.opacity - 0.08); return; } hint.position.set(...TG[k]); const s = k === 'seat' || k === 'table' ? 0.32 : k.startsWith('cas') ? 0.09 : 0.16; hint.scale.set(s, s, 1); hint.material.opacity = 0.16 + 0.07 * Math.sin(U.uTime.value * 3); };
  C.update = (dt, eyeLocal, winCol, pxScale) => {
    UC.uEye.value.copy(eyeLocal); UC.uWin.value.copy(winCol); dust.material.uniforms.uPx.value = pxScale;
    st.fire += (st.fireT - st.fire) * Math.min(1, dt * 0.8); st.lamp += (st.lampT - st.lamp) * Math.min(1, dt * 6); UC.uFire.value = st.fire; UC.uLamp.value = st.lamp;
    for (let i = 0; i < 3; i++) UC.uLC.value[i].copy(LC0[i]).multiplyScalar(st.lamp); UC.uLC.value[4].copy(LC0[4]).multiplyScalar(st.fire);
    wheel.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), wn); wheel.rotateZ(st.wheel);
    lever.rotation.x = st.lever;
    for (let k = 0; k < 6; k++) cass[k].visible = st.own[k] && st.tapeIn !== k; pglow.material.opacity = st.pageNew ? 0.1 + 0.07 * Math.sin(U.uTime.value * 2.2) : 0;
    if (st.tape) for (const r of reels) r.rotation.x += dt * 2.6; tapeLed.visible = st.tape;
    for (const s of steamK) { s.userData.t = (s.userData.t + dt * (0.22 + 0.25 * st.boil)) % 1; const t = s.userData.t; s.position.set(-0.6 + Math.sin(t * 5 + s.id) * 0.03 + t * 0.06, 0.95 + t * (0.4 + 0.4 * st.boil), 0.22 + Math.cos(t * 4 + s.id) * 0.03); const k = 0.06 + t * (0.2 + 0.2 * st.boil); s.scale.set(k, k, 1); s.material.opacity = Math.sin(t * PI) * (0.05 + 0.2 * st.boil); }
    const cp = st.cup === 'desk' ? cupDesk : st.cup === 'pult' ? cupPult : null; cupDesk.visible = st.cup === 'desk'; cupPult.visible = st.cup === 'pult';
    for (const s of steamC) { s.userData.t = (s.userData.t + dt * 0.3) % 1; const t = s.userData.t; if (!cp) { s.material.opacity = 0; continue; } s.position.set(cp.position.x + Math.sin(t * 6 + s.id) * 0.015, cp.position.y + 0.09 + t * 0.22, cp.position.z + Math.cos(t * 5 + s.id) * 0.015); const k = 0.03 + t * 0.09; s.scale.set(k, k, 1); s.material.opacity = Math.sin(t * PI) * 0.18 * st.cupHeat; }
  };
  return C;
}
