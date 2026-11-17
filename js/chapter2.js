// chapter2.js – Kapitel 2 „Was unter dem Licht lebt“: Orte, Tiere und Ablauf der fünf Missionen. Wird erst geladen, wenn Kapitel 2 begonnen hat.
// Alles liegt in der großen Tiefsee nördlich der Startschlucht, zwischen 230 und 420 m, also innerhalb der Grenze von 450 m.
//   m9  Staatsqualle vermessen: oben an der Glocke markieren, dann hinab bis zum Ende der Kette und dort markieren.
//   m10 Riesenkalmar: im Dunkeln warten (Licht und Scheinwerfer aus); er kommt näher und lässt sich fotografieren. Licht an: Tinte, und er ist weg.
//   m11 Hängende Gärten: ein Laternenfisch-Schwarm wartet über dem Abgrund und zieht dann voraus zur Ostwand, wo die Gärten hängen. Foto.
//   m12 Toter Buckelwal: er sinkt über der Westwand auf einen Absatz. Auf ihm parken und eine Probe aus dem großen Biss nehmen.
//   m13 Vampirtintenfische und Leviathan: im Dunkeln stoßen sie rote Tinte aus; mit dem Periskop (Rotfilter) die Spur finden, ihr folgen. Am Ende: der Leviathan. Foto.
import { T, clamp, smooth } from './util.js';
import { floorH, floorN, steep, PLAT2 } from './terrain.js';
import { createChapter2, createInk } from './kapitel2.js';
import { createGarden } from './garten.js';
import { createDeepModels } from './deep.js';
import { createDeadHumpback } from './humpback.js';
import { createDeepFish } from './tiefseefische.js';

const PI = Math.PI, TAU = PI * 2;
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/** Orte (Welt-Koordinaten). y ist die Höhe (negativ = Tiefe) */
export const C2 = {
  siph: { x: 60, z: 700, y: -232, L: 3.2 },                 // Glocke der Riesen-Staatsqualle; die Kette hängt 12·L m hinab
  squid: { x: 150, z: 860, y: -345 },                       // Revier des Riesenkalmars
  lant: { x: 301, z: 1111, y: -262 },                       // dort warten die Laternenfische
  garden: { x: 421, z: 1019, nx: -0.8, nz: 0.61 },          // Mitte der Gärten an der Ostwand, nx/nz: aus der Wand hinaus
  fall: { x: PLAT2.x + PLAT2.dx * 14, z: PLAT2.z + PLAT2.dz * 14, y0: -165 },   // der tote Buckelwal sinkt auf den Absatz an der Westwand
  vamp: { x: 20, z: 1180, y: -420 },                         // Vampirtintenfische
  lev: { x: 150, z: 1380, y: -395 },                         // der Leviathan zieht hier seine Kreise
};
export const SIPH_LEN = Math.round(12 * C2.siph.L);
const FALL_L = 14, LEV_L = 32, FALL_YAW = Math.atan2(-PLAT2.dz, PLAT2.dx);   // der tote Wal liegt längs der Wand auf dem Absatz
C2.garden.y = floorH(C2.garden.x, C2.garden.z);

export function createCh2(scene, ctx) {
  const K = createChapter2(scene), G = createGarden(scene), D = createDeepModels(scene, { giant: 1 }), F = createDeepFish(scene), DW = createDeadHumpback(scene);
  const INK = createInk(scene, 3200), DARK = createInk(scene, 900, true);
  const MS = ctx.MS, c2 = MS.c2;
  const st = { t: 0, vampK: 0, squid: { x: C2.squid.x, y: C2.squid.y - 60, z: C2.squid.z + 40, h: 0, ph: 0, near: 0, flee: 0, fleeT: 0, warnT: 0 }, school: { x: C2.lant.x, y: C2.lant.y, z: C2.lant.z, h: 0 },
    lev: { a: 0, x: C2.lev.x, y: C2.lev.y, z: C2.lev.z, h: 0, ph: 0, gone: 0 }, darkWarnT: 0, trailPeek: 0, levOn: false };
  const spheres = [];

  // ---------- Gärten: Stücke auf der steilen Wand, nach außen und ein wenig nach oben gerichtet; unter Simsen hängende Schleier ----------
  const GARDEN = [], G0 = C2.garden;
  { const R = rnd(77), nn = { x: 0, y: 0, z: 0 }, tx = -G0.nz, tz = G0.nx;   // tx/tz: entlang der Wand
    const put = (k, n, sz, mode) => { let tries = 0; while (n > 0 && tries++ < n * 60) {
      const u = (R() - 0.5) * 2, v = (R() - 0.5) * 2, x = G0.x + tx * u * 38 + G0.nx * v * 14, z = G0.z + tz * u * 38 + G0.nz * v * 14, h = floorH(x, z);
      if (h > G0.y + 38 || h < G0.y - 40) continue; const e = u * u + Math.pow((h - G0.y) / 34, 2); if (R() > (1 - smooth(0.45, 1.1, e)) * 1.1) continue;
      floorN(x, z, nn); if (nn.y > 0.75) continue;   // nur an der steilen Wand
      const o = { x, y: h, z, size: sz * (0.6 + R() * 0.8), seed: R() };
      if (mode === 'hang') { o.x += nn.x * 0.4; o.z += nn.z * 0.4; o.y = h - 0.2; o.yaw = R() * TAU; o.pitch = 0; o.roll = 0; }
      else { const ux = nn.x, uy = nn.y + 0.75, uz = nn.z, l = Math.hypot(ux, uy, uz), ax = ux / l, ay = uy / l, az = uz / l, sr = Math.hypot(ax, az);
        o.roll = Math.atan2(sr, ay); o.yaw = Math.atan2(az, -ax) + (R() - 0.5) * 0.3; o.pitch = (R() - 0.5) * 0.3; o.x -= nn.x * 0.15; o.z -= nn.z * 0.15; }
      GARDEN.push([k, o]); n--; } };
    put('venus', 34, 1.9); put('cup', 22, 1.6); put('fan', 24, 3.0); put('pen', 32, 1.9); put('coral', 64, 1.7); put('crinoid', 30, 1.1); put('mush', 64, 0.65); put('tubes', 64, 0.85); put('drape', 20, 2.3, 'hang'); }
  const gardenFront = () => ({ x: G0.x + G0.nx * 16, y: G0.y + 4, z: G0.z + G0.nz * 16 });

  // ---------- rote Spur: von den Vampiren bis zum Leviathan, leicht geschlängelt ----------
  const TRAIL = []; { const R = rnd(5), a = C2.vamp, b = C2.lev, n = 26; for (let i = 0; i <= n; i++) { const k = i / n, w = Math.sin(k * PI * 2.3) * 14 + (R() - 0.5) * 6;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); TRAIL.push({ x: a.x + dx * k - dz / l * w, y: a.y + (b.y - a.y) * k + Math.sin(k * 9) * 3, z: a.z + dz * k + dx / l * w, t: R() * 3 }); } }
  const trailDir = () => { const a = C2.vamp, b = C2.lev; return Math.atan2(b.x - a.x, b.z - a.z); };

  // ---------- Hilfen ----------
  const S = ctx.S, d2 = (p) => Math.hypot(p.x - S.x, p.z - S.z), d3 = (p) => Math.hypot(p.x - S.x, p.y - S.y, p.z - S.z);
  const active = (id) => MS.active === id;
  const stage = () => MS.stage;
  const setStage = (s, bh, bt) => { MS.stage = s; ctx.sync(); if (bh) ctx.banner(ctx.t(bh), ctx.t(bt)); ctx.save(); };
  const siphEnd = () => ({ x: C2.siph.x + Math.sin(st.t * 0.05) * 2, y: C2.siph.y - 12 * C2.siph.L + 2, z: C2.siph.z });
  /** Ort und Lage des toten Wals: sinkt, bis er auf dem Absatz liegt */
  let restY = null;
  const fallRest = () => { if (restY === null) { DW.set(C2.fall.x, 0, C2.fall.z, FALL_L, FALL_YAW, 0.06, -1.35, false); let up = -1e9;   // so hoch, dass die tiefste Stelle gerade aufliegt
    for (let i = 1; i < 20; i++) for (let j = 0; j < 16; j++) { const p = DW.surf(i / 20, j / 16 * TAU, 0).p; up = Math.max(up, floorH(p.x, p.z) - p.y); } restY = up + 0.25; } return restY; };
  const fallOn = () => c2.fallY != null;
  const fallSurfTop = () => DW.surf(0.45, 3.0, 0).p;

  // ---------- Missionen: Beginn, Ziele, Handlungen ----------
  const api = {
    spheres,
    /** wird beim Start einer Kapitel-2-Mission aufgerufen: erste Stufe */
    start(id) {
      if (id === 'm9') MS.stage = 'top';
      if (id === 'm10') { MS.stage = 'find'; st.squid.near = 0; }
      if (id === 'm11') { MS.stage = 'find'; st.school.x = C2.lant.x; st.school.y = C2.lant.y; st.school.z = C2.lant.z; }
      if (id === 'm12') { MS.stage = 'find'; c2.fallY = C2.fall.y0; }
      if (id === 'm13') { MS.stage = 'find'; st.levOn = false; }
    },
    /** Mission zurücksetzen (erneut spielen oder abbrechen) */
    reset(id) { if (id === 'm12') c2.fallY = null; if (id === 'm13') { st.levOn = false; INK.clear(); } if (id === 'm10') { DARK.clear(); st.squid.near = 0; } },
    /** wohin das Sonar zeigt */
    target() {
      const s = stage();
      if (active('m9')) return s === 'top' ? C2.siph : siphEnd();
      if (active('m10')) return C2.squid;
      if (active('m11')) return s === 'find' ? C2.lant : null;
      if (active('m12')) return { x: C2.fall.x, y: fallOn() ? c2.fallY : C2.fall.y0, z: C2.fall.z };
      if (active('m13')) return s === 'find' || s === 'dark' ? C2.vamp : null;
      return null;
    },
    /** Beschriftung des Handlungsknopfs (Schlüssel für t) oder null */
    act() {
      if (active('m9')) { const p = stage() === 'top' ? C2.siph : siphEnd(); if (Math.hypot(p.x - S.x, p.z - S.z) < 18 && Math.abs(p.y - S.y) < 13) return stage() === 'top' ? 'c2_mark_top' : 'c2_mark_end'; }
      if (active('m12') && stage() === 'park' && st.parked) return 'c2_sample';
      return null;
    },
    doAct() {
      const a = api.act(); if (!a) return;
      if (a === 'c2_mark_top') { ctx.audio.click(0.7); setStage('end', 'm9_top_h', 'm9_top'); }
      else if (a === 'c2_mark_end') { ctx.audio.click(0.7); MS.stage = 'done'; ctx.addLog({ kind: 'find', id: 'm9', dist: Math.round(Math.hypot(C2.siph.x, C2.siph.z) / 10) * 10, dir: ctx.dir8(C2.siph.x, C2.siph.z) });
        ctx.banner(ctx.t('m9_len_h'), ctx.t('m9_len', { n: SIPH_LEN })); setTimeout(() => ctx.finish('m9'), 2500); }
      else if (a === 'c2_sample') { ctx.audio.hatch(); MS.stage = 'done'; ctx.addLog({ kind: 'find', id: 'm12t', dist: Math.round(Math.hypot(C2.fall.x, C2.fall.z) / 10) * 10, dir: ctx.dir8(C2.fall.x, C2.fall.z) });
        ctx.banner(ctx.t('m12_tooth_h'), ctx.t('m12_tooth')); setTimeout(() => ctx.finish('m12'), 6500); }
    },
    /** Fotoziel der laufenden Kapitel-2-Mission */
    photoTarget() {
      if (active('m10') && stage() === 'photo') return { x: st.squid.x, y: st.squid.y, z: st.squid.z, r: 48, name: 'n_squid', dark: true };
      if (active('m11') && stage() === 'photo') { const f = gardenFront(); return { x: G0.x + G0.nx * 4, y: G0.y + 2, z: G0.z + G0.nz * 4, r: 75, name: 'n_hgarden', from: f }; }
      if (active('m13') && stage() === 'meet') return { x: st.lev.x, y: st.lev.y, z: st.lev.z, r: 130, name: 'n_leviathan' };
      return null;
    },
    /** Foto gemacht und gezählt: beendet die Mission */
    photoTaken(id) { if (MS.stage === 'photo' || MS.stage === 'meet') { const m = MS.active; MS.stage = 'done'; setTimeout(() => ctx.finish(m, id), 900); return true; } return false; },
    /** Rotfilter im Periskop: ferne rote Tinte wird sichtbar */
    set see(v) { INK.see = v; },
    /** schaut man durch das Periskop in Richtung der Spur? (Peilung in Bogenmaß, Weltrichtung) */
    peri(yaw, filter) {
      if (!active('m13') || stage() !== 'scope') return;
      const b = trailDir(); let d = Math.abs(((yaw - b) % TAU + TAU + PI) % TAU - PI);
      if (d < 0.22 && filter) { st.trailPeek += 1 / 30; if (st.trailPeek > 1.2) { st.trailPeek = 0; setStage('follow', 'm13_trail_h', 'm13_trail'); } } else st.trailPeek = 0;
    },
    periOk: () => (active('m13') && (stage() === 'scope' || stage() === 'follow' || stage() === 'meet')) || MS.done.includes('m13'),
    /** wo der Entwickler-Knopf hinspringt */
    spot(k) { const f = gardenFront(); return { siph: [C2.siph.x + 22, C2.siph.y, C2.siph.z + 10], siphEnd: [C2.siph.x + 14, siphEnd().y, C2.siph.z + 10], squid: [C2.squid.x + 30, C2.squid.y, C2.squid.z], lant: [C2.lant.x + 25, C2.lant.y, C2.lant.z], garden: [f.x + G0.nx * 30, f.y, f.z + G0.nz * 30],
      fall: [C2.fall.x + PLAT2.dx * 30, (fallOn() ? c2.fallY : fallRest()) + 10, C2.fall.z + PLAT2.dz * 30], vamp: [C2.vamp.x + 25, C2.vamp.y + 5, C2.vamp.z], lev: [C2.lev.x + 70, C2.lev.y + 5, C2.lev.z] }[k]; },
    look(k) { return { siph: C2.siph, siphEnd: siphEnd(), squid: C2.squid, lant: C2.lant, garden: G0, fall: C2.fall, vamp: C2.vamp, lev: C2.lev }[k]; },
    /** Entwicklerhilfen */
    dev: { stage: (s) => setStage(s), squidNow() { if (active('m10')) { const q = st.squid; q.near = 1; q.flee = 0; q.x = S.x + Math.sin(S.h) * 20; q.z = S.z + Math.cos(S.h) * 20; q.y = S.y - 1; setStage('photo'); } }, landWhale() { c2.fallY = fallRest(); } },
  };

  // ---------- Bild und Ablauf je Bild ----------
  const fish = []; { const R = rnd(13); for (let i = 0; i < 120; i++) { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1); fish.push({ ox: x * 3.6, oy: y * 1.8, oz: z * 5.8, ph: R() * TAU, s: 0.4 + R() * 0.1, sp: 0.6 + R() * 0.8, sd: R() }); } }
  // Licht der Gärten auf der Wand: drei farbige Leuchtpunkte, nur in der Nähe
  const GL = [[0, 0, [0.2, 1.0, 0.85]], [-16, 8, [1.0, 0.25, 0.85]], [16, -6, [0.6, 0.4, 1.0]], [3, -24, [0.3, 0.8, 1.0]]].map(([u, h, col]) => ({ x: G0.x - G0.nz * u + G0.nx * 6, y: G0.y + h, z: G0.z + G0.nx * u + G0.nz * 6, col, power: 8, size: 3 }));
  const vamps = []; { const R = rnd(21); for (let i = 0; i < 44; i++) { const a = R() * TAU, r = 3 + R() * 15; vamps.push({ ox: Math.cos(a) * r, oy: (R() - 0.5) * 10, oz: Math.sin(a) * r, ph: R() * TAU, yaw: R() * TAU, pitch: (R() - 0.5) * 0.8, seed: R() }); } }
  let inkT = 0, trailT = 0;
  api.update = (dt, time, px, dark) => {
    st.t = time; const ph = time;
    for (const k of Object.keys(K)) K[k].list.length = 0; for (const k of Object.keys(G)) G[k].list.length = 0; D.begin(); spheres.length = 0;
    // Staatsqualle: immer da, treibt sacht hin und her
    if (d2(C2.siph) < 320) D.add('giant', { x: C2.siph.x + Math.sin(time * 0.05) * 2, y: C2.siph.y, z: C2.siph.z, L: C2.siph.L, seed: 0.4, amp: 0.05, yaw: time * 0.01 });
    // Gärten (nur in der Nähe) mit ein paar Dumbos davor
    if (d2(G0) < 240) { for (const [k, o] of GARDEN) if (G[k].list.length < G[k].M) G[k].list.push(o);
      for (let i = 0; i < 4; i++) { const f = gardenFront(); K.dumbo.list.push({ x: f.x + Math.sin(time * 0.13 + i * 1.7) * 8, y: f.y + i * 3 - 6 + Math.sin(time * 0.4 + i) * 0.6, z: f.z + Math.cos(time * 0.11 + i * 2.3) * 8, size: 0.5, yaw: time * 0.13 + i * 1.7 + PI / 2, pitch: -0.2, ph: time * 1.3 + i * 2, amp: 1, seed: 0.1 + i * 0.2 }); } }
    // Laternenfisch-Schwarm: wartet über dem Abgrund, zieht dann voraus zu den Gärten und kreist dort
    { const sc = st.school, follow = active('m11') && stage() === 'follow', there = !active('m11') && MS.done.includes('m11');
      let goal = C2.lant, sp = 1.2; if (follow || there || (active('m11') && stage() === 'photo')) { goal = gardenFront(); const bd = d3(sc); sp = follow ? (bd < 38 ? 3.4 : bd < 60 ? 1.2 : 0.2) : 1.2; }
      const gx = goal.x + Math.cos(time * 0.2) * 10 - sc.x, gy = goal.y + Math.sin(time * 0.3) * 2 - sc.y, gz = goal.z + Math.sin(time * 0.2) * 10 - sc.z, gl = Math.hypot(gx, gy, gz) || 1, mv = Math.min(gl, sp * dt);
      sc.x += gx / gl * mv; sc.y += gy / gl * mv; sc.z += gz / gl * mv; const hh = Math.atan2(gx, gz); sc.h += (((hh - sc.h) % TAU + TAU + PI) % TAU - PI) * Math.min(1, dt * 1.5);
      F.lantern.list.length = 0; if (d3(sc) < 180 && (active('m11') || MS.done.includes('m11') || MS.done.includes('m10'))) { const ch = Math.cos(sc.h), sh = Math.sin(sc.h);
        for (const f of fish) { const w = time * f.sp + f.ph, lx = f.ox + Math.sin(w) * 0.5, lz = f.oz + Math.cos(w * 0.8) * 0.5; F.lantern.list.push({ x: sc.x + lx * ch + lz * sh, y: sc.y + f.oy + Math.sin(w * 1.3) * 0.3, z: sc.z - lx * sh + lz * ch, size: f.s, yaw: sc.h + Math.sin(w * 0.7) * 0.18, pitch: 0, roll: 0, ph: time * 8 + f.ph, amp: 0.35, seed: f.sd, glow: 1 }); } }
      F.lantern.sync();
      { const ex = ctx.world.extra || [], has = ex.includes(GL[0]), nearG = d2(G0) < 200; if (nearG && !has) ctx.world.setExtra(ex.concat(GL)); else if (!nearG && has) ctx.world.setExtra(ex.filter((g) => !GL.includes(g))); }
      if (follow && d2(G0) < 48 && Math.abs(S.y - G0.y) < 45) setStage('photo', 'm11_found_h', 'm11_found');
      if (active('m11') && stage() === 'find' && d3(C2.lant) < 45) setStage('follow', 'm11_go_h', 'm11_go'); }
    // Riesenkalmar: nur im Dunkeln kommt er heran; Licht an: Tinte und Flucht
    if (active('m10')) { const q = st.squid, s = stage(), home = C2.squid;
      if (s === 'find' && d3(home) < 80) setStage('dark', 'm10_dark_h', 'm10_dark');
      const close = (s === 'dark' || s === 'photo') && dark && d3(home) < 95;
      if (q.flee > 0) { q.flee -= dt; q.x += Math.sin(q.h) * 9 * dt; q.z += Math.cos(q.h) * 9 * dt; q.y -= 2 * dt; }
      else if (close) { q.near = Math.min(1, q.near + dt / 14); const a = time * 0.09, r = 26 - 10 * q.near, tx = S.x + Math.cos(a) * r, tz = S.z + Math.sin(a) * r, ty = S.y - 2 + Math.sin(time * 0.3) * 2;
        const dx = tx - q.x, dy = ty - q.y, dz = tz - q.z, l = Math.hypot(dx, dy, dz) || 1, v = Math.min(l, (l > 30 ? 6 : 1.8) * dt); q.x += dx / l * v; q.y += dy / l * v; q.z += dz / l * v; q.h += (((Math.atan2(dx, dz) - q.h) % TAU + TAU + PI) % TAU - PI) * Math.min(1, dt);
        if (s === 'dark' && d3(q) < 30) setStage('photo', 'm10_here_h', 'm10_here'); }
      else { const dx = home.x + 40 - q.x, dz = home.z + 50 - q.z, l = Math.hypot(dx, dz) || 1; if (l > 2) { q.x += dx / l * 3 * dt; q.z += dz / l * 3 * dt; q.y += (home.y - 60 - q.y) * dt * 0.1; q.h = Math.atan2(dx, dz); } }
      if (!dark && (s === 'photo' || (s === 'dark' && q.near > 0.3)) && d3(q) < 60 && q.flee <= 0) {   // Licht an: Tintenwolke, Flucht
        for (let i = 0; i < 5; i++) DARK.emit(q.x + Math.sin(q.h) * i, q.y, q.z + Math.cos(q.h) * i, 40, 2.2, 0.8); q.h = Math.atan2(q.x - S.x, q.z - S.z); q.flee = 6; q.near = 0;
        if (s === 'photo') setStage('dark', 'm10_fled_h', 'm10_fled'); else ctx.banner(ctx.t('m10_fled_h'), ctx.t('m10_fled')); }
      if (s === 'dark' && !dark && d3(home) < 95 && (st.darkWarnT -= dt) < 0) { st.darkWarnT = 30; ctx.banner(ctx.t('m10_dark_h'), ctx.t('m10_dark')); }
      q.ph += dt * (2.2 + (q.flee > 0 ? 5 : 0)); if (d3(q) < 200) K.squid.list.push({ x: q.x, y: q.y, z: q.z, size: 12, yaw: q.h, pitch: 0, ph: q.ph, amp: 1, seed: 0.37, glow: 1 }); }
    // toter Buckelwal: sinkt auf den Absatz, mit Aasfressern
    st.parked = false;
    if (fallOn()) { const rest = fallRest(), near = d2(C2.fall) < 230; if (c2.fallY > rest && (near || !active('m12'))) { c2.fallY = Math.max(rest, c2.fallY - (active('m12') ? 0.55 : 3) * dt); }
      const sinking = c2.fallY > rest + 0.01, wob = sinking ? Math.sin(time * 0.3) * 0.05 : 0;
      DW.set(C2.fall.x, c2.fallY, C2.fall.z, FALL_L, FALL_YAW, 0.06 + wob, -1.35, d2(C2.fall) < 260);
      if (d2(C2.fall) < 140) {
        for (let i = 0; i <= 6; i++) { const t = 0.08 + i * 0.13, a = DW.surf(t, 0, 0).p, b = DW.surf(t, PI, 0).p; spheres.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, r: a.distanceTo(b) * 0.5 }); }
        const top = fallSurfTop(), hd = Math.hypot(top.x - S.x, top.z - S.z), up = S.y - top.y;
        st.parked = hd < 9 && up > 0 && up < 5.5 && Math.hypot(S.vx, S.vz) < 1.6;
        if (st.parked && sinking && !ctx.input()) S.y -= (active('m12') ? 0.55 : 0) * dt;   // auf ihm geparkt: man sinkt mit
        if (active('m12') && stage() === 'find' && d2(C2.fall) < 60) setStage('park', 'm12_near_h', 'm12_near');
        // Aasfresser: wie in der Vorschau, aber nur in der Nähe
        const face = (o, n, inward) => { const f = inward ? [-n.x, -n.y, -n.z] : [n.x, n.y, n.z]; o.yaw = Math.atan2(f[0], f[2]); o.pitch = Math.asin(clamp(f[1], -1, 1)); return o; };
        const upOn = (o, n) => { const sp = Math.hypot(n.x, n.z); o.pitch = Math.atan2(sp, n.y); o.yaw = Math.atan2(-n.x, -n.z); return o; };
        const R3 = rnd(7), spots = []; for (let i = 0; i < 14; i++) spots.push([0.6 + (R3() - 0.5) * 0.14, 3.55 + (R3() - 0.5) * 0.8]); for (const b of DW.bites) spots.push([b[0], b[1]]);
        const cx = C2.fall.x, cz = C2.fall.z, cy = c2.fallY;
        spots.forEach((sp, i) => { const L = 0.55 + R3() * 0.2, peck = 0.04 * Math.max(0, Math.sin(time * (1.5 + R3()) + i * 1.7)), s = DW.surf(sp[0], sp[1], 0);
          if (i % 3 === 2 && i > 14) { const f = s.n, c = s.p.clone().addScaledVector(s.n, L * 0.5 - 0.07 - peck); K.rat.list.push(face({ x: c.x, y: c.y, z: c.z, size: 0.75, ph: time * 3 + i, amp: 0.7, seed: i * 0.2 }, { x: f.x * 0.8 + 0.2, y: f.y * 0.8, z: f.z * 0.8 }, true)); }
          else { const tl = { x: s.n.x + (R3() - 0.5) * 0.9, y: s.n.y + (R3() - 0.5) * 0.9, z: s.n.z + (R3() - 0.5) * 0.9 }, ln = Math.hypot(tl.x, tl.y, tl.z); tl.x /= ln; tl.y /= ln; tl.z /= ln; const c = s.p.clone().addScaledVector(tl, L * 0.5 - 0.09 - peck);
            K.hag.list.push(face({ x: c.x, y: c.y, z: c.z, size: L, ph: time * 9 + i * 2.1, amp: 1.8, seed: i * 0.1 }, tl, true)); } });
        for (let i = 0; i < 12; i++) { const a = i * 2.39 + time * 0.2 * (i % 2 ? 1 : -1), r = 2.5 + (i % 5) * 0.8; K.hag.list.push({ x: cx + Math.cos(a) * r, y: cy + 1.5 + Math.sin(a * 1.3 + i) * 1.5, z: cz + Math.sin(a) * r * 2, size: 0.6 + (i % 3) * 0.1, yaw: a + (i % 2 ? 0 : PI) + 1.57, pitch: 0, ph: time * 5 + i, amp: 1, seed: i * 0.1 }); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + time * 0.1, r = 6 + (i % 4); K.rat.list.push({ x: cx + Math.cos(a) * r, y: cy + 1 + Math.sin(i) * 2, z: cz + Math.sin(a) * r, size: 0.7 + (i % 3) * 0.12, yaw: a + PI, pitch: 0, ph: time * 4 + i, amp: 1, seed: i * 0.2 }); }
        if (!sinking) for (let i = 0; i < 16; i++) { const t = 0.22 + ((i * 0.173 + time * 0.003 * (i % 2 ? 1 : -1)) % 0.55 + 0.55) % 0.55, a = 2.45 + (i * 0.618) % 1.05, sz = 0.28 + (i % 3) * 0.06, s = DW.surf(t, a, sz * 0.07);
          K.crab.list.push(upOn({ x: s.p.x, y: s.p.y, z: s.p.z, size: sz, ph: time * 3 + i, amp: 1, seed: i * 0.3 }, s.n)); }
      } } else DW.set(0, -9999, 0, 1, 0, 0, 0, false);
    // Vampirtintenfische: im Dunkeln dicht und hell, bei Licht weichen sie zurück; ab und zu rote Tinte
    if (d2(C2.vamp) < 220 && (MS.done.includes('m12') || active('m13'))) { const k = dark ? 1 : 0; st.vampK = (st.vampK || 0) + (k - (st.vampK || 0)) * Math.min(1, dt * 0.5);
      // im Dunkeln kommen sie heraus und schweben um das Boot; bei Licht ziehen sie sich zu ihrem Platz zurück und verteilen sich
      const near = d3(C2.vamp) < 85 ? st.vampK : 0, cx = C2.vamp.x + (S.x - C2.vamp.x) * near * 0.85, cy = C2.vamp.y + (S.y - C2.vamp.y) * near * 0.85, cz = C2.vamp.z + (S.z - C2.vamp.z) * near * 0.85;
      st.vc = { x: cx, y: cy, z: cz };
      for (const v of vamps) { const spread = (1 + 1.8 * (1 - st.vampK)) * (v.ox * v.ox + v.oz * v.oz < 25 && near > 0.3 ? 1.6 : 1), w = time * 0.3 + v.ph; K.vamp.list.push({ x: cx + v.ox * spread + Math.sin(w) * 0.8, y: cy + v.oy + Math.sin(w * 0.7) * 0.6, z: cz + v.oz * spread + Math.cos(w) * 0.8, size: 0.32, yaw: v.yaw + Math.sin(w * 0.4) * 0.6, pitch: v.pitch, ph: time * 3.4 + v.ph * 3, amp: 1, seed: v.seed, glow: 0.35 + 0.65 * st.vampK }); }
      inkT -= dt; if (inkT < 0 && st.vampK > 0.5) { inkT = 0.7 + Math.random() * 1.5; const v = vamps[Math.floor(Math.random() * vamps.length)]; INK.emit(cx + v.ox * 1.6, cy + v.oy, cz + v.oz * 1.6, 40, 0.5); } }
    if (active('m13')) { const s = stage();
      if (s === 'find' && d3(C2.vamp) < 70) setStage('dark', 'm13_dark_h', 'm13_dark');
      if (s === 'dark' && dark && d3(C2.vamp) < 75 && st.vampK > 0.6) setStage('scope', 'm13_scope_h', 'm13_scope');
      if (s === 'dark' && !dark && d3(C2.vamp) < 75 && (st.darkWarnT -= dt) < 0) { st.darkWarnT = 30; ctx.banner(ctx.t('m13_dark_h'), ctx.t('m13_dark')); }
      if (s === 'scope' || s === 'follow' || s === 'meet') { trailT -= dt; if (trailT < 0) { trailT = 0.25; for (const p of TRAIL) { p.t -= 0.25; if (p.t < 0 && Math.hypot(p.x - S.x, p.z - S.z) < 340) { p.t = 2.5 + Math.random() * 1.5; INK.emit(p.x + (Math.random() - 0.5) * 4, p.y + (Math.random() - 0.5) * 3, p.z + (Math.random() - 0.5) * 4, 12, 2.0, 1.2); } } } }
      if (s === 'follow' && d3(C2.lev) < 95) { st.levOn = true; setStage('meet', 'm13_meet_h', 'm13_meet'); }
      if (s === 'follow' && d2(C2.lev) < 170) st.levOn = true; }
    // der Leviathan: zieht in einem großen Bogen am Boot vorbei
    if (st.levOn || (st.lev.gone > 0)) { const L = st.lev; L.a += dt * 2.6 / 46; L.ph += dt * 1.1; if (!active('m13')) { L.gone -= dt; if (L.gone <= 0) st.levOn = false; }
      L.x = C2.lev.x + Math.cos(L.a) * 46; L.z = C2.lev.z + Math.sin(L.a) * 46; L.y = C2.lev.y + Math.sin(L.a * 2) * 4; L.h = Math.atan2(-Math.sin(L.a), Math.cos(L.a));
      if (L.gone > 0 && !active('m13')) { L.x += Math.sin(L.h) * (90 - L.gone) * 1.5; L.z += Math.cos(L.h) * (90 - L.gone) * 1.5; L.y -= (90 - L.gone) * 0.4; }
      K.whale.list.push({ x: L.x, y: L.y, z: L.z, size: LEV_L, yaw: L.h, pitch: 0, roll: 0, ph: L.ph, amp: 1, seed: 0.37, glow: 1 });
      if (d2(L) < 90) for (let i = 0; i < 6; i++) { const k = 0.38 - i * 0.14; spheres.push({ x: L.x + Math.sin(L.h) * k * LEV_L, y: L.y - 0.5, z: L.z + Math.cos(L.h) * k * LEV_L, r: i < 3 ? 2.8 : 2.0 - i * 0.2 }); } }
    for (const k of Object.keys(K)) K[k].sync(); for (const k of Object.keys(G)) G[k].sync(); D.commit();
    INK.update(dt, px); DARK.update(dt, px);
  };
  /** nach der letzten Mission: der Leviathan zieht noch eine Weile, dann taucht er ab */
  api.levLeave = () => { st.lev.gone = 90; };
  return api;
}
