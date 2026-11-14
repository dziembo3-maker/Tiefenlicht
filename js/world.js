// world.js – die große Welt: Gelände in Kacheln, die beim Fahren nachgeladen werden; was wo steht (Felsen, Tang, Kristalle, Korallen, Fundstellen)
import { T, rng, ico, noise } from './util.js';
import { rockMaterial } from './gfx.js';
import { floorH, shelfH, handDist, steep, cxAt, halfW, GROTTO, WRECK, PLAIN, WHALE, BELL, plainK } from './terrain.js';
import { buildWhale, buildBell, propMaterial } from './props.js';
import { wreckFrame, buildWreck } from './wreck.js';

export const CS = 64, NQ = 40, STEP = CS / NQ, SITE = 320, LOAD = 188, DROP = 236;
export const PAL = { cyan: [0.25, 0.9, 1.0], blue: [0.3, 0.56, 1.0], violet: [0.62, 0.42, 1.0], lilac: [0.86, 0.52, 0.96], turq: [0.2, 1.0, 0.8], peach: [1.0, 0.56, 0.4], orange: [1.0, 0.42, 0.14] };
const COOL = [PAL.cyan, PAL.cyan, PAL.blue, PAL.violet], DUSK = [PAL.violet, PAL.violet, PAL.blue, PAL.lilac], REEF = [PAL.turq, PAL.lilac, PAL.peach, PAL.violet, PAL.turq], WARM = [[1.0, 0.36, 0.08], PAL.peach, PAL.orange];
const cell = (v) => Math.floor(v / CS), key = (ix, iz) => ix + ',' + iz, h2 = (a, b) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0) || 1;
const newItems = () => ({ rocks: [], kelp: [], cry: [], coral: [[], [], [], [], []], peb: [], grass: [], jelly: [], fish: [], bub: [], dots: [], glows: [], spheres: [], wreck: null, props: [] });
const mainDist = (x, z) => (z > -185 && z < 172 ? Math.abs(x - cxAt(z)) : 999);

// ---------- Bausteine: schreiben in die Liste einer Kachel ----------
function placer(R) {
  const rr = (a, b) => a + R() * (b - a), pick = (p) => p[Math.floor(R() * p.length) % p.length];
  const P = { R, rr, pick };
  const steep2 = steep;
  P.spire = (it, x, z, h, r, lean, seed, dir) => {
    const y0 = floorH(x, z) - 3, pts = [], n = 9, la = dir === undefined ? seed * 2.4 : dir;
    for (let j = 0; j <= n; j++) { const t = j / n, tt = Math.pow(t, 1.15); pts.push([x + Math.cos(la) * lean * tt * h + Math.sin(t * 5 + seed) * r * 0.25, y0 + (h + 3) * t, z + Math.sin(la) * lean * tt * h, r * (1 - Math.pow(t, 0.8)) * (1 + 0.25 * Math.sin(t * 9 + seed * 3)) + 0.08]); }
    it.rocks.push({ pts, sides: 8, seed: seed * 17, rough: 0.5 });
  };
  P.blob = (it, x, y, z, rx, ry, rz, rot, seed, det, col) => it.rocks.push({ blob: [x, y, z, rx, ry, rz, rot, seed, det, col] });
  P.boulder = (it, x, z, s) => { const y = floorH(x, z); P.blob(it, x, y + s * 0.15, z, s * rr(0.8, 1.5), s * rr(0.6, 1.1), s * rr(0.8, 1.4), R() * 6.3, R() * 90, s > 2.6 ? 2 : 1, s > 1.6); };
  P.kelp = (it, x, z, h) => { const y = floorH(x, z); if ((y < -78 && plainK(x, z) < 0.3) || steep(x, z) > 4.2) return; it.kelp.push(x, y - 0.3, z, h, R() * 6.3, R() * 6.3); };
  P.kelpPatch = (it, x, z, cnt, big) => { for (let i = 0; i < cnt; i++) { const a = R() * 6.3, d = Math.sqrt(R()) * 8; P.kelp(it, x + Math.cos(a) * d, z + Math.sin(a) * d, rr(3.5, 11.5) * big); } };
  // Kristallbüschel: schlanke Spitzen, außen kleiner und stärker geneigt
  P.tuft = (it, x, z, count, hMin, hMax, pal, power, spread = 1, yFix) => {
    const y0 = yFix === undefined ? floorH(x, z) : yFix, rad = hMax * 0.36 * spread + 0.25; let top = y0;
    for (let i = 0; i < count; i++) {
      const a = R() * 6.3, d = Math.pow(R(), 0.8) * rad, cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d, h = hMin + (hMax - hMin) * Math.pow(1 - d / rad, 1.2) * rr(0.55, 1), tl = rr(0.03, 0.2) + 0.32 * d / rad;
      const cy = (yFix === undefined ? floorH(cx, cz) : yFix) - h * 0.1, c = pick(pal), j = rr(0.85, 1.1);
      it.cry.push(cx, cy, cz, h, Math.cos(a) * tl, Math.sin(a) * tl, h * rr(0.1, 0.15), R() * 6.3, c[0] * j, c[1] * j, c[2] * j); top = Math.max(top, cy + h);
    }
    it.glows.push({ x, y: y0 + (top - y0) * 0.55, z, col: pal[0], power, size: hMax });
    if (hMax > 5) it.spheres.push({ x, y: y0 + hMax * 0.2, z, r: hMax * 0.22 });
  };
  // Korallen: verzweigte Geweihe (0) und flache Fächer (1), Spitzen leuchten
  P.coral = (it, x, z, count, sMin, sMax, pal, rad, yFix) => {
    for (let i = 0; i < count; i++) {
      const a = R() * 6.3, d = Math.sqrt(R()) * rad, cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d; if (yFix === undefined && steep(cx, cz) > 6) continue;
      if (i % 2 === 0) P.dots(it, cx, (yFix === undefined ? floorH(cx, cz) : yFix) + 0.3, cz, 4, 1.6, pal);
      const c = pick(pal), j = rr(0.85, 1.1), q = R(), ty = q < 0.3 ? 0 : q < 0.5 ? 1 : q < 0.65 ? 2 : q < 0.85 ? 3 : 4; it.coral[ty].push(cx, (yFix === undefined ? floorH(cx, cz) : yFix) - 0.08, cz, rr(sMin, sMax) * 1.5, R() * 6.3, rr(0.75, 1.25), R() * 6.3, c[0] * j, c[1] * j, c[2] * j);
    }
  };
  // Kies, Steinchen und Seegras auf flachem Grund
  P.ground = (it, x0, z0, size, nPeb, nGrass) => {
    for (let i = 0; i < nPeb; i++) {
      let x = x0 + R() * size, z = z0 + R() * size; if (R() < 0.5 && it.rocks.length) { const r = it.rocks[Math.floor(R() * it.rocks.length) % it.rocks.length], c = r.blob ? r.blob : r.pts[0]; const a = R() * 6.3, d = rr(1, 7); x = c[0] + Math.cos(a) * d; z = c[2] + Math.sin(a) * d; }
      if (steep(x, z) > 3.2) continue; const y = floorH(x, z); if (y < -120) continue; const s = Math.pow(R(), 2.2) * 0.75 + 0.1;
      it.peb.push(x, y - s * 0.12, z, s, R() * 6.3, rr(0.7, 1.4), rr(0.5, 1.1));
    }
    for (let i = 0; i < nGrass; i++) { const cx = x0 + R() * size, cz = z0 + R() * size; if (steep(cx, cz) > 2.4 || floorH(cx, cz) < -95) continue; const cnt = 4 + Math.floor(R() * 9); for (let k = 0; k < cnt; k++) { const a = R() * 6.3, d = Math.sqrt(R()) * 3.2, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; it.grass.push(x, floorH(x, z) - 0.05, z, rr(0.5, 1.4), R() * 6.3, R() * 6.3); } }
  };
  P.dots = (it, x, y, z, n, rad, pal) => { for (let i = 0; i < n; i++) { const a = R() * 6.3, d = Math.sqrt(R()) * rad, c = pick(pal); it.dots.push(x + Math.cos(a) * d, y + rr(0.3, 1) * rad * 0.5 * R() + 0.4, z + Math.sin(a) * d, c[0], c[1], c[2], R() * 6.3); } };
  P.jelly = (it, x, y, z, s) => it.jelly.push(x, y, z, s, R() * 6.3, rr(1.5, 5), rr(0.03, 0.07) * (R() < 0.5 ? -1 : 1), rr(0.9, 1.3));
  P.school = (it, x, y, z, a, b, cnt, tilt) => {
    const sp = rr(0.045, 0.085) * (R() < 0.5 ? -1 : 1), ph = R() * 6.3, amp = rr(1.5, 4), len = rr(0.9, 1.9);
    cnt = Math.round(cnt * 1.6); for (let i = 0; i < cnt; i++) { const lag = (Math.pow(R(), 1.6) * (R() < 0.5 ? -1 : 1)) * len, tight = 1 - Math.abs(lag) / len * 0.5; it.fish.push(x, y, z, ph + lag, a, b, amp, sp, (R() - 0.5) * 3.4 * tight, (R() - 0.5) * 2.6 * tight, tilt, rr(0.17, 0.29)); }
  };
  P.bubbles = (it, x, z, cnt) => { const y = floorH(x, z); if (y < -86) return; const sp = rr(1.1, 1.9), hgt = Math.min(-y - 3, rr(28, 46)); for (let i = 0; i < cnt; i++) it.bub.push(x, y, z, R(), sp, hgt, R() * 6.3); };
  // warmer Spalt: dunkle Felsnadeln um einen orange glühenden Kern
  P.vent = (it, x, z, scale = 1) => {
    const n = 6 + Math.floor(R() * 2), a0 = R() * 6.3;
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * 6.3 + rr(-0.2, 0.2), d = rr(6, 8.5) * scale; if (i === 0) continue; P.spire(it, x + Math.cos(a) * d, z + Math.sin(a) * d, rr(13, 26) * scale, rr(2.6, 4.2) * scale, rr(0.1, 0.22), R() * 40, a + Math.PI); }
    P.tuft(it, x, z, 17, 3, 14 * scale, WARM, 6, 0.6); P.coral(it, x, z, 12, 1.0, 2.4, [PAL.peach, PAL.orange, PAL.lilac], 11 * scale);
    P.dots(it, x, floorH(x, z) + 2, z, 46, 9 * scale, WARM); for (let i = 0; i < 2; i++) P.bubbles(it, x + rr(-4, 4), z + rr(-4, 4), 34);
  };
  return P;
}

// ---------- Fundstellen im weiten Netz (das Sonar findet sie aus der Ferne) ----------
const siteCache = new Map();
export function siteAt(cx, cz) {
  const k = key(cx, cz); if (siteCache.has(k)) return siteCache.get(k);
  const R = rng(h2(cx * 7 + 3, cz * 13 + 1)); let s = null;
  if (R() > 0.18) for (let i = 0; i < 10 && !s; i++) {
    const x = (cx + 0.08 + R() * 0.84) * SITE, z = (cz + 0.08 + R() * 0.84) * SITE; if (handDist(x, z) < 170) continue;
    const h = floorH(x, z); if (shelfH(x, z) - h > 26 && h > -82 && steep(x, z) < 5) { const q = R(); s = { x, y: h, z, kind: q < 0.38 ? 'grove' : q < 0.72 ? 'garden' : 'vent', seed: h2(cx, cz) }; }
  }
  siteCache.set(k, s); return s;
}
const STATIC = [{ x: GROTTO.x + 5, y: -38, z: GROTTO.z + 3, kind: 'grove' }, { x: WRECK.x, y: -52, z: WRECK.z, kind: 'wreck' },
  { x: PLAIN.x + 40, y: -88, z: PLAIN.z + 30, kind: 'plain', disc: 70 }, { x: WHALE.x, y: -90, z: WHALE.z, kind: 'whale', disc: 34 }, { x: BELL.x, y: -66, z: BELL.z, kind: 'bell', disc: 24 }];
/** alles, was ein Ping im Umkreis finden kann */
export function poisNear(x, z, range) {
  const out = []; for (const s of STATIC) if (Math.hypot(s.x - x, s.z - z) < range) out.push(s);
  const c0 = Math.floor((x - range) / SITE), c1 = Math.floor((x + range) / SITE), d0 = Math.floor((z - range) / SITE), d1 = Math.floor((z + range) / SITE);
  for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) { const s = siteAt(a, b); if (s && Math.hypot(s.x - x, s.z - z) < range) out.push(s); }
  return out;
}

// ---------- die von Hand eingerichtete Startschlucht, Grotte und Wrack-Senke ----------
function handmade() {
  const B = new Map(), R = rng(4711), P = placer(R), rr = P.rr;
  const at = (x, z) => { const k = key(cell(x), cell(z)); if (!B.has(k)) B.set(k, newItems()); return B.get(k); };
  // Felsbogen quer über die Schlucht, mit Zapfen
  const AZ = -18, ac = cxAt(AZ), aw = halfW(AZ) + 9, arch = [];
  for (let j = 0; j <= 16; j++) { const t = j / 16, s = Math.sin(Math.PI * t); arch.push([ac + (t * 2 - 1) * aw + Math.sin(t * 7) * 2, -44 + 20 * Math.pow(s, 0.8) + Math.sin(t * 11) * 1.2, AZ + Math.sin(t * 4.2) * 5 - 2, 7.6 - 4.1 * Math.pow(s, 0.7)]); }
  at(ac, AZ).rocks.push({ pts: arch, sides: 11, seed: 3.3, rough: 0.5 });
  for (const t of [0.3, 0.42, 0.61]) { const p = arch[Math.round(t * 16)]; for (let k = 0; k < 2; k++) { const h = rr(2.5, 6.5), px = p[0] + rr(-2, 2), pz = p[2] + rr(-1.5, 1.5); at(ac, AZ).rocks.push({ pts: [[px, p[1] - p[3] * 0.4, pz, rr(0.7, 1.1)], [px + rr(-0.3, 0.3), p[1] - p[3] * 0.7 - h * 0.5, pz, 0.5], [px, p[1] - p[3] * 0.7 - h, pz, 0.08]], sides: 6, seed: R() * 50, rough: 0.3 }); } }
  { const z = -52, c = cxAt(z), y = floorH(c - 16, z); at(c, z).rocks.push({ pts: [[c - 22, y - 4, z - 5, 6.5], [c - 16, y + 3, z - 3, 6.2], [c - 10, y + 10, z - 1, 5.2], [c - 4, y + 16, z + 1, 3.8], [c + 1, y + 21, z + 3, 2.2], [c + 4, y + 24, z + 4, 0.3]], sides: 9, seed: 8.8, rough: 0.55 }); }
  const SP = [[AZ + 6, 0.55, 26, 4.2], [AZ + 2, 0.82, 17, 3.2], [AZ - 6, -0.7, 15, 3], [8, -0.25, 22, 3.6], [14, 0.1, 13, 2.4], [40, 0.5, 30, 4.4], [47, 0.72, 19, 3], [62, -0.45, 25, 3.8], [70, -0.1, 12, 2.2],
    [88, -0.6, 38, 5.2], [93, 0.62, 44, 5.6], [99, 0.2, 26, 3.6], [104, -0.25, 30, 4], [-82, 0.4, 20, 3.4], [-88, -0.5, 14, 2.6], [-100, 0.1, 17, 3], [-62, 0.75, 24, 3.6], [-36, -0.8, 19, 3.2], [118, -0.55, 46, 6], [124, 0.45, 40, 5.5]];
  SP.forEach((s, i) => { const x = cxAt(s[0]) + s[1] * halfW(s[0]); P.spire(at(x, s[0]), x, s[0], s[2], s[3], rr(0.02, 0.2), i * 1.37 + 0.5); });
  for (const [x, z, h, r] of [[GROTTO.x - 16, GROTTO.z - 14, 15, 3], [GROTTO.x - 20, GROTTO.z + 8, 12, 2.6], [GROTTO.x + 3, GROTTO.z - 18, 11, 2.4], [62, 30, 10, 2.2], [70, 50, 13, 2.6]]) P.spire(at(x, z), x, z, h, r, 0.12, x * 0.31);
  for (let i = 0; i < 90; i++) { const z = rr(-150, 120), x = cxAt(z) + rr(-1.15, 1.15) * halfW(z); if (floorH(x, z) < -100) continue; P.boulder(at(x, z), x, z, Math.pow(R(), 2) * 4.2 + 1.1); }
  // Tang
  for (let c = 0; c < 95; c++) { const z = rr(-160, 110), x = cxAt(z) + rr(-1.25, 1.25) * halfW(z); P.kelpPatch(at(x, z), x, z, 6 + Math.floor(R() * 14), floorH(x, z) < -40 ? 1.35 : 1); }
  for (let i = 0; i < 10; i++) { const x = cxAt(-74) + rr(-16, 16), z = -74 + rr(-12, 14); P.kelp(at(x, z), x, z, rr(7, 14)); }
  for (let i = 0; i < 9; i++) { const a = R() * 6.3, x = GROTTO.x - 24 + Math.cos(a) * 7, z = GROTTO.z - 6 + Math.sin(a) * 7; P.kelp(at(x, z), x, z, rr(4, 9)); }
  // Kristallgrotte: viele schlanke Spitzen in Blau und Violett, dazwischen Korallen und Lichtpunkte
  { const g = at(GROTTO.x, GROTTO.z), gx = GROTTO.x, gz = GROTTO.z;
    P.tuft(g, gx + 6, gz + 4, 26, 2.5, 13, DUSK, 3.4, 1.0); P.tuft(g, gx + 12, gz - 6, 14, 2, 8.5, COOL, 2.4); P.tuft(g, gx - 3, gz + 11, 13, 1.5, 7.5, [PAL.lilac, PAL.violet, PAL.blue], 2.2);
    for (let i = 0; i < 7; i++) { const a = R() * 6.3, d = rr(6, 17); P.tuft(g, gx + 4 + Math.cos(a) * d, gz + 2 + Math.sin(a) * d, 5 + Math.floor(R() * 4), 0.5, rr(1.4, 3), R() < 0.5 ? COOL : DUSK, 0.9); }
    P.coral(g, gx + 2, gz + 2, 30, 0.9, 2.8, [PAL.lilac, PAL.turq, PAL.violet, PAL.peach], 17); P.dots(g, gx + 4, floorH(gx + 4, gz + 2) + 3, gz + 2, 90, 16, [PAL.cyan, PAL.lilac, PAL.violet]); }
  // Nester entlang der Schlucht: Büschel auf Kanten, oft mit ein paar Korallen
  { const x = cxAt(-12) + halfW(-12) * 0.62; P.tuft(at(x, -10), x, -10, 13, 1, 5, COOL, 2.0); P.coral(at(x, -10), x, -10, 8, 0.6, 1.5, REEF, 6); P.dots(at(x, -10), x, floorH(x, -10) + 2, -10, 26, 6, COOL); }
  { const x = cxAt(-24) - halfW(-24) * 0.7; P.tuft(at(x, -27), x, -27, 9, 0.8, 3.6, DUSK, 1.5); P.coral(at(x, -27), x, -27, 6, 0.5, 1.3, [PAL.lilac, PAL.peach], 5); }
  for (const [z, s] of [[-96, 0.5], [-78, -0.62], [-55, 0.72], [-38, -0.3], [4, -0.74], [22, 0.3], [36, -0.55], [55, 0.66], [72, -0.2], [86, 0.5], [97, -0.6], [-124, 0.1], [50, 0.95], [112, 0.15], [-68, 0.1], [-88, 0.85], [-44, -0.95], [-6, 0.98], [28, -0.98], [64, 0.2]]) {
    const x = cxAt(z) + s * halfW(z), it = at(x, z), q = R(), pal = q < 0.4 ? COOL : q < 0.75 ? DUSK : [PAL.turq, PAL.cyan];
    P.tuft(it, x, z, 5 + Math.floor(R() * 5), 0.4, rr(1.3, 2.8), pal, 1.0); if (R() < 0.65) P.coral(it, x + rr(-2, 2), z + rr(-2, 2), 3 + Math.floor(R() * 5), 0.7, 2.0, REEF, 4); if (R() < 0.6) P.dots(it, x, floorH(x, z) + 1.2, z, 14, 4, pal);
  }
  for (const t of [0.25, 0.5, 0.72]) { const x = 34 + 72 * t + rr(-4, 4), z = 25 + 35 * t + rr(-4, 4); P.tuft(at(x, z), x, z, 6, 0.5, 2.2, DUSK, 1.0); P.coral(at(x, z), x, z, 4, 0.5, 1.1, [PAL.lilac, PAL.turq], 3); }
  // Quallen, Fische, Blasen wie gehabt
  const J = (x, y, z, s) => P.jelly(at(x, z), x, y, z, s);
  J(cxAt(-58) - 9, -37, -58, 1.5); J(cxAt(-50) + 4, -43, -44, 0.75); J(cxAt(-34) + 12, -31, -30, 1.0);
  for (let i = 0; i < 15; i++) { const z = rr(-130, 110), x = cxAt(z) + rr(-0.5, 0.5) * halfW(z); J(x, Math.max(floorH(x, z) + 8, rr(-52, -22)), z, rr(0.55, 1.5)); }
  for (let i = 0; i < 4; i++) J(GROTTO.x + rr(-14, 4), rr(-38, -28), GROTTO.z + rr(-10, 8), rr(0.5, 0.9));
  const F = (x, y, z, a, b, n, t) => P.school(at(x, z), x, y, z, a, b, n, t);
  F(cxAt(-52) - 2, -38, -50, 8, 26, 120, 0.4); F(cxAt(-20) + 6, -44, -22, 7, 22, 90, -0.3);
  for (let i = 0; i < 13; i++) { const z = rr(-125, 105); F(cxAt(z) + rr(-6, 6), rr(-54, -22), z, rr(4, 9), rr(16, 34), 60 + Math.floor(R() * 70), rr(-0.5, 0.5)); }
  F(GROTTO.x - 20, -36, GROTTO.z - 8, 6, 12, 70, 0.6); F(cxAt(120), -58, 122, 12, 30, 140, 0);
  const Bu = (x, z, n) => P.bubbles(at(x, z), x, z, n);
  Bu(cxAt(-60) + 5, -62, 44); Bu(cxAt(-40) - 9, -38, 40); Bu(cxAt(-8) + 2, -6, 44);
  for (let i = 0; i < 17; i++) { const z = rr(-140, 100); Bu(cxAt(z) + rr(-0.6, 0.6) * halfW(z), z, 30 + Math.floor(R() * 20)); }
  Bu(GROTTO.x - 8, GROTTO.z + 2, 40); Bu(GROTTO.x - 30, GROTTO.z - 12, 34);
  // Wrack in der Senke am Ende des westlichen Arms, dahinter ein warm glühender Spalt
  { const wx = WRECK.x, wz = WRECK.z, g = at(wx, wz), F2 = wreckFrame(wx, wz); g.wreck = F2;
    for (const s of F2.spheres) g.spheres.push(s); for (const L of F2.lights) g.glows.push({ x: L[0], y: L[1], z: L[2], col: [1.0, 0.6, 0.3], power: 2.2, size: 4 });
    for (let i = 0; i < 70; i++) { const p = F2.hull(rr(0.05, 0.95), rr(0.2, 1), R() < 0.5 ? -1 : 1), c = P.pick([PAL.cyan, PAL.peach, PAL.lilac, PAL.turq]); g.dots.push(p[0], p[1] + rr(-0.3, 1.2), p[2], c[0], c[1], c[2], R() * 6.3); }
    for (const [s, u, sd] of [[0.3, 0.75, 1], [0.55, 0.85, 1], [0.7, 0.6, 1], [0.4, 0.9, -1], [0.8, 0.8, -1], [0.15, 0.95, 1], [0.9, 0.9, 1]]) { const p = F2.hull(s, u, sd); P.coral(g, p[0], p[2], 3, 0.5, 1.2, REEF, 0.8, p[1] - 0.2); }
    for (const [s, ac2] of [[0.2, 0.3], [0.33, -0.5], [0.45, 0.55], [0.62, -0.3], [0.7, 0.5], [0.85, 0.0], [0.12, -0.2]]) { const p = F2.deck(s, ac2); if (R() < 0.6) P.coral(g, p[0], p[2], 2 + Math.floor(R() * 3), 0.4, 1.0, REEF, 0.9, p[1]); else P.tuft(g, p[0], p[2], 4, 0.3, 1.5, COOL, 0.7, 0.6, p[1]); }
    for (let i = 0; i < 9; i++) { const a = R() * 6.3, d = rr(9, 30), x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d; if (R() < 0.55) P.coral(g, x, z, 6 + Math.floor(R() * 5), 0.9, 2.6, REEF, 4.5); else P.tuft(g, x, z, 6 + Math.floor(R() * 5), 0.4, rr(1.5, 3.4), R() < 0.5 ? COOL : DUSK, 1.1); P.dots(g, x, floorH(x, z) + 1.5, z, 12, 4, REEF); }
    P.dots(g, wx, floorH(wx, wz) + 6, wz, 70, 16, [PAL.cyan, PAL.peach, PAL.lilac]);
    P.vent(g, wx - 36, wz + 24, 1.15);
    for (let i = 0; i < 8; i++) { const a = R() * 6.3, d = rr(26, 44), x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d; P.kelpPatch(g, x, z, 7 + Math.floor(R() * 8), 1.3); }
    for (let i = 0; i < 5; i++) { const a = R() * 6.3, d = rr(16, 38); P.boulder(g, wx + Math.cos(a) * d, wz + Math.sin(a) * d, rr(1.5, 4)); }
    P.school(g, wx + 4, -44, wz + 2, 9, 20, 130, F2.rot); P.school(g, wx - 8, -36, wz - 6, 7, 16, 90, 0.9); P.school(g, wx + 10, -50, wz + 12, 5, 12, 70, -0.4);
    P.jelly(g, wx + 14, -34, wz - 12, 1.2); P.jelly(g, wx - 16, -40, wz + 4, 0.8); P.jelly(g, wx + 2, -30, wz + 20, 0.6);
    P.bubbles(g, wx + 6, wz - 4, 40); P.bubbles(g, wx - 12, wz + 8, 34);
  }
  // Schnee-Ebene: kaum Farbe, nur dunkler Tang am Rand, ein paar Steine, und in der Mitte das Walskelett
  { const px = PLAIN.x, pz = PLAIN.z;
    for (let i = 0; i < 26; i++) { const a = R() * 6.3, d = rr(0.45, 1.0) * PLAIN.r, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d; if (floorH(x, z) > -80) continue; P.kelpPatch(at(x, z), x, z, 3 + Math.floor(R() * 7), 0.9); }
    for (let i = 0; i < 6; i++) { const a = R() * 6.3, d = rr(10, 40), x = WHALE.x + Math.cos(a) * d, z = WHALE.z + Math.sin(a) * d; P.kelpPatch(at(x, z), x, z, 2 + Math.floor(R() * 3), 0.7); }
    for (let i = 0; i < 18; i++) { const a = R() * 6.3, d = rr(0.15, 0.95) * PLAIN.r, x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d; if (Math.hypot(x - WHALE.x, z - WHALE.z) < 16) continue; P.boulder(at(x, z), x, z, Math.pow(R(), 2.5) * 3 + 0.6); }
    const g = at(WHALE.x, WHALE.z), W2 = buildWhale(WHALE.x, WHALE.z, WHALE.yaw); g.props.push(W2.geo); for (const s of W2.spheres) g.spheres.push(s);
    // auf den Knochen: wenige kleine Korallen und Kristalle in kühlen Farben, ein paar Lichtpünktchen
    W2.spots.forEach((p, i) => { if (i % 5 === 0 || i >= W2.spots.length - 3) P.coral(g, p[0], p[2], i >= W2.spots.length - 3 ? 3 : 1, 0.16, 0.34, [PAL.cyan, PAL.lilac, PAL.turq], 0.5, p[1] - 0.05); if (i % 2 === 0) P.dots(g, p[0], p[1] + 0.2, p[2], 3, 1.0, [PAL.cyan, PAL.blue]); });
    g.glows.push({ x: WHALE.x, y: floorH(WHALE.x, WHALE.z) + 8, z: WHALE.z, col: [0.42, 0.66, 0.82], power: 3.6, size: 14 });
    P.dots(g, WHALE.x, floorH(WHALE.x, WHALE.z) + 2, WHALE.z, 30, 12, [PAL.cyan, PAL.blue]);
    P.jelly(g, WHALE.x + 10, -74, WHALE.z - 6, 1.1); P.jelly(g, WHALE.x - 14, -70, WHALE.z + 9, 0.7);
  }
  // Taucherglocke auf halbem Weg die Rampe hinab
  { const g = at(BELL.x, BELL.z), Bl = buildBell(BELL.x, BELL.z, BELL.yaw); g.props.push(Bl.geo); for (const s of Bl.spheres) g.spheres.push(s);
    P.kelpPatch(g, BELL.x + 7, BELL.z + 5, 5, 0.7); P.kelpPatch(g, BELL.x - 8, BELL.z - 4, 4, 0.6); g.glows.push({ x: BELL.x, y: floorH(BELL.x, BELL.z) + 5, z: BELL.z, col: [0.4, 0.62, 0.72], power: 1.4, size: 4 });
    P.dots(g, Bl.top.x, Bl.top.y + 0.4, Bl.top.z, 6, 1.4, [PAL.cyan, PAL.turq]);
  }
  return B;
}

// ---------- alles Übrige entsteht je Kachel nach Regeln ----------
function procedural(ix, iz, it) {
  const R = rng(h2(ix, iz)), P = placer(R), rr = P.rr, x0 = ix * CS, z0 = iz * CS;
  const free = (x, z) => mainDist(x, z) > 48 && Math.hypot(x - GROTTO.x, z - GROTTO.z) > 36 && Math.hypot(x - WRECK.x, z - WRECK.z) > 52;
  const pt = () => { const x = x0 + R() * CS, z = z0 + R() * CS, h = floorH(x, z); return { x, z, h, c: shelfH(x, z) - h, ok: free(x, z) && plainK(x, z) < 0.15 && Math.hypot(x - BELL.x, z - BELL.z) > 16 }; };
  for (let i = 0; i < 3; i++) { const p = pt(); if (p.ok && p.c > 18 && p.h > -105) P.spire(it, p.x, p.z, rr(9, 27), rr(2.2, 4.8), rr(0.02, 0.2), R() * 40); }
  for (let i = 0; i < 7; i++) { const p = pt(); if (p.ok && p.h > -110) P.boulder(it, p.x, p.z, Math.pow(R(), 2) * 4.2 + 1.1); }
  for (let i = 0; i < 10; i++) { const p = pt(); if (p.ok && (p.c > 8 || R() < 0.45)) P.kelpPatch(it, p.x, p.z, 8 + Math.floor(R() * 16), p.h < -40 ? 1.35 : 1); }
  for (let i = 0; i < 3; i++) { const p = pt(); if (p.ok && p.c > 8 && p.h > -88) P.coral(it, p.x, p.z, 3 + Math.floor(R() * 4), 0.7, 2.0, R() < 0.25 ? [PAL.peach, PAL.lilac, PAL.turq] : REEF, 3.5); }
  for (let i = 0; i < 3; i++) { const p = pt(); if (!p.ok || p.c < 9 || p.h < -88 || R() > 0.62) continue; const q = R(), pal = q < 0.4 ? COOL : q < 0.8 ? DUSK : [PAL.turq, PAL.cyan]; P.tuft(it, p.x, p.z, 5 + Math.floor(R() * 5), 0.4, rr(1.3, 3), pal, 1.0); if (R() < 0.55) P.coral(it, p.x + rr(-2, 2), p.z + rr(-2, 2), 3 + Math.floor(R() * 5), 0.7, 2.0, REEF, 4); if (R() < 0.5) P.dots(it, p.x, p.h + 1.2, p.z, 14, 4, pal); }
  for (let i = 0; i < 2; i++) { const p = pt(); if (p.ok && p.c > 5 && p.h > -88 && R() < 0.5) P.coral(it, p.x, p.z, 4 + Math.floor(R() * 6), 0.8, 2.4, R() < 0.3 ? [PAL.peach, PAL.orange, PAL.lilac] : REEF, 5); }
  { const p = pt(); if (p.ok && p.c > 20 && R() < 0.65) P.bubbles(it, p.x, p.z, 30 + Math.floor(R() * 18)); }
  for (let i = 0; i < 2; i++) { const p = pt(); if (p.ok && p.c > 16 && p.h > -150) P.jelly(it, p.x, Math.max(-88, Math.min(-14, Math.max(p.h, -80) + rr(8, 26))), p.z, rr(0.55, 1.5)); }
  for (let i = 0; i < 2; i++) {
    const p = pt(); if (!p.ok || !(p.c > 16 || R() < 0.25)) continue;
    const gx = floorH(p.x + 4, p.z) - floorH(p.x - 4, p.z), gz = floorH(p.x, p.z + 4) - floorH(p.x, p.z - 4);
    P.school(it, p.x, Math.max(-86, Math.min(-13, Math.max(p.h, -90) + rr(9, 22))), p.z, rr(4, 7), rr(10, 19), 50 + Math.floor(R() * 70), Math.atan2(gx, gz) + Math.PI / 2);
  }
  // Fundstelle, falls eine in dieser Kachel liegt
  const s = siteAt(Math.floor(x0 / SITE), Math.floor(z0 / SITE));
  if (s && cell(s.x) === ix && cell(s.z) === iz) {
    if (s.kind === 'vent') P.vent(it, s.x, s.z, 1);
    else if (s.kind === 'grove') {
      P.tuft(it, s.x, s.z, 22, 2, rr(9, 13), DUSK, 3.2); for (let i = 0; i < 2; i++) { const a = R() * 6.3; P.tuft(it, s.x + Math.cos(a) * 9, s.z + Math.sin(a) * 9, 12, 1.5, rr(5, 8), R() < 0.5 ? COOL : [PAL.lilac, PAL.violet], 2.0); }
      for (let i = 0; i < 6; i++) { const a = R() * 6.3, d = rr(8, 20); P.tuft(it, s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 6, 0.5, rr(1.4, 3), DUSK, 0.9); }
      P.coral(it, s.x, s.z, 18, 0.9, 2.4, [PAL.lilac, PAL.violet, PAL.turq], 18); P.dots(it, s.x, s.y + 3, s.z, 80, 17, [PAL.violet, PAL.cyan, PAL.lilac]);
    } else {
      for (let i = 0; i < 6; i++) { const a = R() * 6.3, d = rr(0, 17); P.coral(it, s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 12, 1.2, 3.4, REEF, 6); }
      for (let i = 0; i < 4; i++) { const a = R() * 6.3, d = rr(4, 18); P.tuft(it, s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 6, 0.5, rr(1.5, 3.2), [PAL.turq, PAL.cyan, PAL.blue], 1.2); }
      it.glows.push({ x: s.x, y: s.y + 3, z: s.z, col: PAL.turq, power: 2.2, size: 8 }); P.dots(it, s.x, s.y + 2.5, s.z, 110, 18, REEF);
      P.school(it, s.x, s.y + 9, s.z, 6, 13, 110, R() * 3); P.jelly(it, s.x + 8, s.y + 12, s.z - 5, 0.9); P.jelly(it, s.x - 7, s.y + 15, s.z + 6, 0.6);
    }
  }
}

// ---------- Felsgeometrie ----------
const n3 = (x, y, z, s) => noise(x * s + y * s * 0.7 + 13.1, z * s - y * s * 0.6 + 7.7) + 0.5 * noise(x * s * 2.3 - y * s * 1.1, z * s * 2.3 + y * s * 1.7 + 31.0);
const tv = new T.Vector3(), u = new T.Vector3(), w = new T.Vector3(), UP = new T.Vector3(0.13, 1, 0.21).normalize(), ALT = new T.Vector3(1, 0, 0.2).normalize();
function buildRocks(list, spheres) {
  const P = [], I = []; let vc = 0;
  for (const r of list) {
    if (r.blob) {
      const [cx, cy, cz, rx, ry, rz, rot, seed, det, col] = r.blob, { v, f } = ico(det), c = Math.cos(rot), s = Math.sin(rot), b = vc;
      for (const p of v) { const k = 0.62 + 0.5 * n3(p[0] + seed, p[1] * 1.6, p[2] - seed, 1.15), y = p[1] < 0 ? p[1] * 0.75 : p[1], lx = p[0] * rx * k, lz = p[2] * rz * k; P.push(cx + lx * c + lz * s, cy + y * ry * k, cz - lx * s + lz * c); vc++; }
      for (const t of f) I.push(b + t[0], b + t[1], b + t[2]);
      if (col) spheres.push({ x: cx, y: cy, z: cz, r: Math.min(rx, ry, rz) * 0.55 + (rx + ry + rz) / 3 * 0.42 });
      continue;
    }
    // Schlauch entlang von Punkten [x,y,z,r], an beiden Enden geschlossen
    const { pts, sides, seed, rough } = r, b = vc, n = pts.length; let t0 = null, t1 = null;
    for (let j = 0; j < n; j++) {
      const a = pts[Math.max(0, j - 1)], c = pts[Math.min(n - 1, j + 1)], p = pts[j];
      tv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize(); if (j === 0) t0 = tv.clone(); if (j === n - 1) t1 = tv.clone();
      u.crossVectors(tv, Math.abs(tv.y) > 0.92 ? ALT : UP).normalize(); w.crossVectors(tv, u);
      for (let i = 0; i < sides; i++) {
        const an = (i / sides) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), ox = u.x * ca + w.x * sa, oy = u.y * ca + w.y * sa, oz = u.z * ca + w.z * sa;
        const k = p[3] * (1 - rough * 0.75 + rough * n3(p[0] + ox * p[3] + seed, p[1] + oy * p[3], p[2] + oz * p[3], 0.21));
        P.push(p[0] + ox * k, p[1] + oy * k, p[2] + oz * k); vc++;
      }
      if (p[3] > 0.9) spheres.push({ x: p[0], y: p[1], z: p[2], r: p[3] * 0.9 });
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) { const a = b + j * sides + i, c = b + j * sides + (i + 1) % sides, d = a + sides, e = c + sides; I.push(a, c, d, c, e, d); }
    const p0 = pts[0], p1 = pts[n - 1], c0 = vc, c1 = vc + 1; vc += 2;
    P.push(p0[0] - t0.x * p0[3] * 0.5, p0[1] - t0.y * p0[3] * 0.5, p0[2] - t0.z * p0[3] * 0.5, p1[0] + t1.x * p1[3] * 1.5, p1[1] + t1.y * p1[3] * 1.5, p1[2] + t1.z * p1[3] * 1.5);
    for (let i = 0; i < sides; i++) { const i2 = (i + 1) % sides; I.push(b + i2, b + i, c0, b + (n - 1) * sides + i, b + (n - 1) * sides + i2, c1); }
  }
  if (!vc) return null;
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(P), 3)); g.setIndex(new T.BufferAttribute(vc > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

export function createWorld(scene, life) {
  const W = { chunks: new Map(), near: [], glows: [], extra: [], tris: 0, built: 0 };
  /** zusätzliche Lichter, die nicht zu einer Kachel gehören (z. B. die Lampe einer Messingdose) */
  W.setExtra = (list) => { W.extra = list; dirty = true; };
  const HAND = handmade(), matT = rockMaterial(false), matR = rockMaterial(true);
  const hh = new Float32Array((NQ + 3) * (NQ + 3)), M = NQ + 3;
  let dirty = true, lastKey = '';

  function stage(ch) {
    const x0 = ch.ix * CS, z0 = ch.iz * CS;
    if (ch.stage === 0) {                                        // Gelände
      let lo = 1e9, hi = -1e9;
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) hh[j * M + i] = floorH(x0 + (i - 1) * STEP, z0 + (j - 1) * STEP);
      const n = NQ + 1, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), idx = new Uint16Array(NQ * NQ * 6);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 3, q = (j + 1) * M + i + 1, h = hh[q], dx = hh[q + 1] - hh[q - 1], dz = hh[q + M] - hh[q - M], l = Math.hypot(dx, 2 * STEP, dz);
        pos[o] = x0 + i * STEP; pos[o + 1] = h; pos[o + 2] = z0 + j * STEP; nor[o] = -dx / l; nor[o + 1] = 2 * STEP / l; nor[o + 2] = -dz / l; if (h < lo) lo = h; if (h > hi) hi = h;
      }
      let q = 0;
      for (let j = 0; j < NQ; j++) for (let i = 0; i < NQ; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        if (Math.abs(pos[a * 3 + 1] - pos[d * 3 + 1]) < Math.abs(pos[b * 3 + 1] - pos[c * 3 + 1])) { idx[q++] = a; idx[q++] = c; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = b; } else { idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
      g.boundingSphere = new T.Sphere(new T.Vector3(x0 + CS / 2, (lo + hi) / 2, z0 + CS / 2), Math.hypot(CS * 0.71, (hi - lo) / 2) + 1);
      const m = new T.Mesh(g, matT); scene.add(m); ch.meshes.push(m); ch.tris += idx.length / 3;
    } else if (ch.stage === 1) {                                 // was hier steht, dann die Felsen
      const it = HAND.get(ch.key) || newItems(); if (!it.done) { procedural(ch.ix, ch.iz, it); placer(rng(h2(ch.ix + 911, ch.iz - 377))).ground(it, ch.ix * CS, ch.iz * CS, CS, 260, 15); it.done = true; } ch.items = it;
      ch.spheres = it.spheres.slice();
      const g = buildRocks(it.rocks, ch.spheres); if (g) { const m = new T.Mesh(g, matR); scene.add(m); ch.meshes.push(m); ch.tris += g.index.count / 3; }
      if (it.wreck) for (const m of buildWreck(it.wreck)) { scene.add(m); ch.meshes.push(m); ch.tris += m.geometry.index.count / 3; }
      for (const geo of it.props) { const m = new T.Mesh(geo, propMaterial()); m.frustumCulled = true; scene.add(m); ch.meshes.push(m); ch.tris += geo.index.count / 3; }
      ch.glows = it.glows;
    } else {                                                     // Leben
      for (const m of life.build(ch.items, ch.ix * CS + CS / 2, ch.iz * CS + CS / 2)) { scene.add(m); ch.meshes.push(m); }
      dirty = true;
    }
    ch.stage++; if (ch.stage === 3) W.built++;
  }
  function drop(ch) { for (const m of ch.meshes) { scene.remove(m); m.geometry.dispose(); } W.chunks.delete(ch.key); dirty = true; }
  W.setSmall = (v) => { for (const ch of W.chunks.values()) for (const m of ch.meshes) if (m.userData.small) m.visible = v; };

  /** hält die Kacheln um (x,z) aktuell; steps = wie viele Bauschritte in diesem Bild erlaubt sind (Infinity beim Start) */
  W.update = (x, z, steps) => {
    const cx = cell(x), cz = cell(z), rc = Math.ceil(LOAD / CS) + 1; let todo = [];
    for (let a = cx - rc; a <= cx + rc; a++) for (let b = cz - rc; b <= cz + rc; b++) {
      const d = Math.hypot((a + 0.5) * CS - x, (b + 0.5) * CS - z); if (d > LOAD) continue;
      const k = key(a, b); let ch = W.chunks.get(k); if (!ch) { ch = { ix: a, iz: b, key: k, stage: 0, meshes: [], spheres: [], glows: [], tris: 0, items: null }; W.chunks.set(k, ch); }
      if (ch.stage < 3) { ch.d = d; todo.push(ch); }
    }
    if (todo.length) { todo.sort((p, q) => p.d - q.d); let i = 0; while (steps > 0 && i < todo.length) { stage(todo[i]); steps--; if (todo[i].stage === 3) i++; } }
    for (const ch of W.chunks.values()) if (Math.hypot((ch.ix + 0.5) * CS - x, (ch.iz + 0.5) * CS - z) > DROP) drop(ch);
    const k = key(cx, cz);
    if (dirty || k !== lastKey) {
      lastKey = k; dirty = false; W.near.length = 0; W.glows.length = 0; W.tris = 0;
      for (const ch of W.chunks.values()) { W.tris += ch.tris; if (ch.stage < 2) continue; for (const g of ch.glows) W.glows.push(g); if (Math.abs(ch.ix - cx) <= 1 && Math.abs(ch.iz - cz) <= 1) for (const s of ch.spheres) W.near.push(s); }
      for (const g of W.extra) W.glows.push(g);
    }
    return todo.length;
  };
  return W;
}
