// util.js – Mathe, Zufall, Rauschen, Geometrie-Baukasten, Texturen
export const T = window.THREE;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, o = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < o; i++) { s += a * noise(x * f + i * 17.3, z * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export function ridge(x, z, o = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < o; i++) {
    const v = 1 - Math.abs(noise(x * f + i * 31.7, z * f + i * 11.3) * 2 - 1);
    s += a * v * v; n += a; a *= 0.5; f *= 2.1;
  }
  return s / n;
}

// ---------- Geometrie-Baukasten: sammelt viele Teile in einem einzigen Mesh ----------
export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.w = []; this.s = []; this.i = []; this.count = 0; }
  v(x, y, z, nx, ny, nz, col, wind = 0, shade = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz);
    this.c.push(clamp(col[0], 0, 1) * 255, clamp(col[1], 0, 1) * 255, clamp(col[2], 0, 1) * 255);
    this.w.push(wind); this.s.push(shade);
    return this.count++;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('color', new T.BufferAttribute(new Uint8Array(this.c), 3, true));
    g.setAttribute('aWind', new T.BufferAttribute(new Float32Array(this.w), 1));
    g.setAttribute('aShade', new T.BufferAttribute(new Float32Array(this.s), 1));
    g.setIndex(this.count > 65535 ? new T.BufferAttribute(new Uint32Array(this.i), 1) : new T.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere();
    this.p = this.n = this.c = this.w = this.s = this.i = null;
    return g;
  }
}

// Ikosphäre mit geteilten Eckpunkten (klein und weich schattiert)
const icoCache = {};
export function ico(detail) {
  if (icoCache[detail]) return icoCache[detail];
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const mid = new Map(), nf = [];
    const m = (a, b) => {
      const k = a < b ? a * 100000 + b : b * 100000 + a;
      if (mid.has(k)) return mid.get(k);
      const p = [v[a][0] + v[b][0], v[a][1] + v[b][1], v[a][2] + v[b][2]];
      const l = Math.hypot(p[0], p[1], p[2]); v.push([p[0] / l, p[1] / l, p[2] / l]);
      mid.set(k, v.length - 1); return v.length - 1;
    };
    for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = nf;
  }
  return (icoCache[detail] = { v, f });
}

// Weicher Klecks (Baumkrone, Busch): colorFn(nx,ny,nz, y) -> [r,g,b]
export function addBlob(g, cx, cy, cz, rx, ry, rz, detail, seed, colorFn, wind, shade, bump = 0.18) {
  const { v, f } = ico(detail), base = g.count;
  for (const p of v) {
    const k = 1 + (noise(p[0] * 2.1 + seed, p[1] * 2.1 + p[2] * 1.7 + seed * 0.7) - 0.5) * 2 * bump;
    const x = cx + p[0] * rx * k, y = cy + p[1] * ry * k, z = cz + p[2] * rz * k;
    g.v(x, y, z, p[0], p[1], p[2], colorFn(p[0], p[1], p[2], y), typeof wind === 'function' ? wind(y) : wind, shade);
  }
  for (const t of f) g.tri(base + t[0], base + t[1], base + t[2]);
}

// Kantiger Fels: jede Fläche eigene Normale
export function addRock(g, cx, cy, cz, rx, ry, rz, detail, seed, colorFn, shade) {
  const { v, f } = ico(detail);
  const pts = v.map((p) => {
    const k = 1 + (noise(p[0] * 1.7 + seed, p[2] * 1.7 + p[1] * 2.3 + seed) - 0.5) * 0.7;
    return [cx + p[0] * rx * k, cy + p[1] * ry * k, cz + p[2] * rz * k];
  });
  for (const t of f) {
    const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const col = colorFn(nx, ny, nz, (a[1] + b[1] + c[1]) / 3);
    const i0 = g.v(a[0], a[1], a[2], nx, ny, nz, col, 0, shade), i1 = g.v(b[0], b[1], b[2], nx, ny, nz, col, 0, shade), i2 = g.v(c[0], c[1], c[2], nx, ny, nz, col, 0, shade);
    g.tri(i0, i1, i2);
  }
}

// Röhre entlang Ringen [{x,y,z,r}] – Stämme, Äste, Pfosten. colorFn(t 0..1, nx, nz) ; wind(t)
export function addTube(g, rings, sides, colorFn, wind, shade, cap = false) {
  const base = g.count, n = rings.length;
  for (let j = 0; j < n; j++) {
    const R = rings[j], t = j / (n - 1);
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      g.v(R.x + nx * R.r, R.y, R.z + nz * R.r, nx, 0.15, nz, colorFn(t, nx, nz), typeof wind === 'function' ? wind(t) : wind || 0, shade);
    }
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) {
    const a = base + j * (sides + 1) + i, b = a + 1, c = a + sides + 1, d = c + 1;
    g.tri(a, c, b); g.tri(b, c, d);
  }
  if (cap) {
    const R = rings[n - 1], col = colorFn(1, 0, 0), ci = g.v(R.x, R.y, R.z, 0, 1, 0, col, 0, shade), ring = base + (n - 1) * (sides + 1);
    for (let i = 0; i < sides; i++) g.tri(ring + i, ci, ring + i + 1);
  }
}

// Kegel (Tannen-Etage, Dach): unten Ring, oben Spitze
export function addCone(g, cx, y0, cz, r, h, sides, rot, colBottom, colTop, wind, shade, droop = 0) {
  const base = g.count, sl = r / Math.hypot(r, h);
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
    const k = 1 + ((i * 7919) % 5) * 0.03;
    g.v(cx + nx * r * k, y0 - droop * (i % 2), cz + nz * r * k, nx * (1 - sl * 0.5), sl + 0.25, nz * (1 - sl * 0.5), colBottom(nx, nz), wind * 0.6, shade);
    g.v(cx, y0 + h, cz, nx * 0.5, 0.86, nz * 0.5, colTop(nx, nz), wind, shade);
  }
  for (let i = 0; i < sides; i++) g.tri(base + i * 2, base + i * 2 + 1, base + i * 2 + 2);
  const ci = g.v(cx, y0 + h * 0.12, cz, 0, -1, 0, colBottom(0, 0).map((c) => c * 0.55), wind * 0.6, shade);
  for (let i = 0; i < sides; i++) g.tri(base + i * 2 + 2, ci, base + i * 2);
}

// Quader, um die y-Achse gedreht
export function addBox(g, cx, cy, cz, sx, sy, sz, rot, col, shade = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const F = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  for (const n of F) {
    const u = n[1] ? [1, 0, 0] : [-n[2], 0, n[0]], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const idx = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = (n[0] + u[0] * a + w[0] * b) * sx * 0.5, ly = (n[1] + u[1] * a + w[1] * b) * sy * 0.5, lz = (n[2] + u[2] * a + w[2] * b) * sz * 0.5;
      const k = n[1] > 0 ? 1.08 : n[1] < 0 ? 0.6 : 0.82 + 0.12 * n[0];
      idx.push(g.v(cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c, n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c, [col[0] * k, col[1] * k, col[2] * k], 0, shade));
    }
    g.quad(idx[0], idx[1], idx[2], idx[3]);
  }
}

// ---------- Texturen ----------
export function noiseTexture(size = 128) {
  // kachelbares Wolkenrauschen in zwei Kanälen
  const d = new Uint8Array(size * size * 4);
  const tile = (x, y, per, off) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash(((a % per) + per) % per + off, ((b % per) + per) % per - off);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), e = h(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, a = 0.5, n = 0, per = 4;
    for (let o = 0; o < 4; o++) {
      r += a * tile((x / size) * per, (y / size) * per, per, 11 + o * 5);
      g += a * tile((x / size) * per, (y / size) * per, per, 97 + o * 3);
      n += a; a *= 0.5; per *= 2;
    }
    const i = (y * size + x) * 4;
    d[i] = (r / n) * 255; d[i + 1] = (g / n) * 255; d[i + 2] = hash(x, y) * 255; d[i + 3] = 255;
  }
  const t = new T.DataTexture(d, size, size, T.RGBAFormat);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(0.6, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); return t;
}

// Weich abgestufte Lichtrampe für das Toon-Material: stops = [[pos, [r,g,b]], ...]
export function rampTexture(stops, softness = 0.06) {
  const w = 64, d = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const x = i / (w - 1); let col = stops[0][1];
    for (let s = 1; s < stops.length; s++) col = mix3(col, stops[s][1], smooth(stops[s][0] - softness, stops[s][0] + softness, x));
    d[i * 4] = col[0] * 255; d[i * 4 + 1] = col[1] * 255; d[i * 4 + 2] = col[2] * 255; d[i * 4 + 3] = 255;
  }
  const t = new T.DataTexture(d, w, 1, T.RGBAFormat);
  t.magFilter = t.minFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
