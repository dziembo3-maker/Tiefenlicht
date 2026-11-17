// deeplife.js – Leben in der Tiefe (ab etwa 180 m, voll ab 240 m): Laternenfisch-Schwärme als lebendige Wolken, rote Krill-Bänder,
// einzeln der Tiefsee-Mondfisch (seltener), der Laternenträger-Angler, der Riesen-Schlammstachel und die treibende Riesen-Staatsqualle.
// Alles lebt in einem Ring um das Boot: wer zu weit weg ist, verschwindet, und an anderer Stelle taucht Neues auf.
import { clamp, wrapPi } from './util.js';
import { floorH } from './terrain.js';
import { createDeepFish } from './tiefseefische.js';
import { createDeepModels } from './deep.js';

const PI = Math.PI, R = Math.random, rr = (a, b) => a + R() * (b - a);
/** wie häufig die Tiefseetiere in dieser Tiefe sind: oberhalb 180 m gar nicht, ab 240 m voll */
export const deepK = (y) => clamp((-y - 180) / 60, 0, 1);
const SOLO = { mola: { size: [3.0, 3.6], sp: 0.55, rate: 0.06, ph: 0.42, amp: 1 }, eel: { size: [3.3, 4.0], sp: 0.7, rate: 0.16, ph: 0.55, amp: 1 },
  angler: { size: [0.8, 1.0], sp: 0.22, rate: 0.16, ph: 0.6, amp: 0.05 }, siphon: { size: [1.5, 1.9], sp: 0.12, rate: 0.12, ph: 0, amp: 0 } };

export function createDeepLife(scene) {
  const F = createDeepFish(scene), D = createDeepModels(scene, { angler: 3, siphon: 3 });
  const L = { curious: null, schools: [], krill: [], solo: [], timer: 2, cfg: { schoolN: 100, schools: 2, krill: 2, mola: 1, angler: 2, eel: 2, siphon: 2 } };
  /** ein freier Platz um das Boot: in Blickrichtung (Wahrscheinlichkeit ahead) oder ringsum, in der Tiefe des Boots, genug Wasser darunter */
  function spot(sub, d0, d1, ahead, minY = -175) {
    for (let k = 0; k < 16; k++) { const a = R() < ahead ? sub.h + rr(-0.7, 0.7) : R() * 2 * PI, d = rr(d0, d1), x = sub.x + Math.sin(a) * d, z = sub.z + Math.cos(a) * d, y = Math.min(minY, sub.y + rr(-18, 14)), f = floorH(x, z);
      if (y > f + 10) return { x, y, z }; }
    return null;
  }
  // ---------- Laternenfisch-Schwärme: ein Punkt zieht geradeaus, die Fische schwanken um ihre Plätze in der Wolke ----------
  function addSchool(p, yaw, n) {
    const s = Math.cbrt(n / 100), fish = [];
    for (let i = 0; i < n; i++) { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1); fish.push({ x: x * 3.2 * s, y: y * 1.6 * s, z: z * 5.2 * s, a: R() * 6.3, b: R() * 6.3, ph: R() * 6.3, sz: 0.4 + R() * 0.1, sd: R() }); }
    L.schools.push({ x: p.x, y: p.y, z: p.z, yaw, sp: rr(1.1, 1.6), t: R() * 100, fish });
  }
  // ---------- Krill: lange, geschwungene Bänder, die langsam treiben ----------
  function addKrill(p) { const c = D.krill.find((k) => !L.krill.some((q) => q.c === k)); if (!c) return; L.krill.push({ c, x: p.x, y: p.y, z: p.z, yaw: R() * 2 * PI, sp: rr(0.2, 0.45) }); c.mesh.visible = true; }
  // ---------- Einzelgänger ----------
  function addSolo(kind, p, yaw) { const c = SOLO[kind]; L.solo.push({ kind, x: p.x, y: p.y, z: p.z, yaw: yaw === undefined ? R() * 2 * PI : yaw, pitch: 0, size: rr(c.size[0], c.size[1]), ph: R() * 6, seed: R(), tx: p.x, ty: p.y, tz: p.z, ret: 0 }); }
  const count = (kind) => L.solo.filter((s) => s.kind === kind).length;

  /** Entwicklermenü: vor dem Boot erscheinen lassen, egal in welcher Tiefe */
  L.spawnNear = (kind, sub) => {
    const d = kind === 'school' ? 30 : kind === 'krill' ? 45 : kind === 'siphon' ? 16 : kind === 'angler' ? 7 : 14, p = { x: sub.x + Math.sin(sub.h) * d, y: Math.min(-8, sub.y + (kind === 'siphon' ? 3 : 0)), z: sub.z + Math.cos(sub.h) * d };
    if (kind === 'school') addSchool(p, sub.h + PI / 2 + rr(-0.3, 0.3), L.cfg.schoolN); else if (kind === 'krill') { if (L.krill.length >= D.krill.length) L.krill.shift().c.mesh.visible = false; addKrill(p); } else addSolo(kind, p, sub.h + PI + rr(-0.6, 0.6));
  };
  /** Fensterbesuch: ein Laternenfisch-Schwarm, ein Mondfisch oder ein Schlammstachel zieht dicht vor dem Bugfenster quer vorbei */
  L.passWindow = (sub, kind) => {
    const h = sub.h || 0, fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h), side = R() < 0.5 ? 1 : -1, D = kind === 'school' ? 15 : kind === 'mola' ? 12 : 10, W = kind === 'school' ? 45 : 22;
    const cx = sub.x + fx * D, cz = sub.z + fz * D, p = { x: cx - sx * W * side, y: sub.y + rr(-0.4, 0.9), z: cz - sz * W * side }, yaw = Math.atan2(sx * side, sz * side);
    if (floorH(p.x, p.z) > p.y - 3 || floorH(cx, cz) > p.y - 3) return false;
    if (kind === 'school') { addSchool(p, yaw, L.cfg.schoolN); return true; }
    addSolo(kind, p, yaw); const s = L.solo[L.solo.length - 1]; s.tx = cx + sx * side * 60; s.tz = cz + sz * side * 60; s.ty = p.y; s.ret = 120; s.pass = kind === 'mola' ? 3 : 2.2; return true;
  };
  L.clear = () => { L.schools.length = 0; L.solo.length = 0; for (const k of L.krill) k.c.mesh.visible = false; L.krill.length = 0; };

  L.update = (dt, time, px, sub) => {
    const k = deepK(sub.y);
    // auffüllen: nur in der Tiefe, je tiefer, desto eher
    const cu = L.curious; L.timer -= dt; if (L.timer <= 0 && k > 0) { L.timer = cu ? rr(0.8, 1.6) : rr(1.5, 3);
      if (L.schools.length < L.cfg.schools && R() < 0.3 * k) { const p = spot(sub, 70, 110, 0.6); if (p) addSchool(p, R() * 2 * PI, L.cfg.schoolN); }
      if (L.krill.length < Math.min(L.cfg.krill, D.krill.length) && R() < 0.2 * k) { const p = spot(sub, 80, 130, 0.4); if (p) addKrill(p); }
      for (const kind of Object.keys(SOLO)) if (count(kind) < L.cfg[kind] + (cu && L.cfg[kind] > 0 ? 1 : 0) && R() < SOLO[kind].rate * k * (cu ? 3 : 1)) { const p = spot(sub, cu ? 40 : 50, cu ? 70 : 95, 0.55); if (p) addSolo(kind, p); } }   // neugierig (Probefahrt): öfter, ein Tier mehr je Art, und sie kommen näher
    // Schwärme ziehen geradeaus; vor Hindernissen biegen sie sacht ab
    F.lantern.list.length = 0;
    for (let i = L.schools.length - 1; i >= 0; i--) { const s = L.schools[i]; s.t += dt;
      const ax = s.x + Math.sin(s.yaw) * 25, az = s.z + Math.cos(s.yaw) * 25; if (floorH(ax, az) > s.y - 10) s.yaw += 0.35 * dt; else if (floorH(s.x, s.z) > s.y - 12) s.y += dt;
      const bd = Math.hypot(s.x - sub.x, s.y - sub.y, s.z - sub.z); s.x += Math.sin(s.yaw) * s.sp * dt; s.z += Math.cos(s.yaw) * s.sp * dt;
      if (Math.hypot(s.x - sub.x, s.z - sub.z) > 170) { L.schools.splice(i, 1); continue; }
      const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw), t = s.t;
      for (const f of s.fish) {
        let ox = f.x + Math.sin(t * 0.21 + f.a) * 0.5 + Math.sin(t * 0.07 + f.z * 0.5) * 0.9, oy = f.y + Math.sin(t * 0.17 + f.b) * 0.35 + Math.sin(t * 0.09 + f.z * 0.4) * 0.35, oz = f.z + Math.sin(t * 0.13 + f.a * 2) * 0.6;
        let wx = s.x + ox * cy + oz * sy, wy = s.y + oy, wz = s.z - ox * sy + oz * cy;
        if (bd < 25) { const dx = wx - sub.x, dy = wy - sub.y, dz = wz - sub.z, d = Math.hypot(dx, dy, dz); if (d < 6) { const w = (6 - d) / Math.max(d, 0.5) * 1.2; wx += dx * w; wy += dy * w * 0.6; wz += dz * w; } }   // dem Boot weichen sie aus
        f.ph += dt * 2 * PI * 2.6;
        F.lantern.list.push({ x: wx, y: wy, z: wz, size: f.sz, yaw: s.yaw + Math.sin(t * 0.3 + f.ph * 0.01 + f.a) * 0.18, pitch: 0, roll: 0, ph: f.ph, amp: 0.35, seed: f.sd, glow: 1 });
      } }
    F.lantern.sync();
    // Krill treibt
    for (let i = L.krill.length - 1; i >= 0; i--) { const q = L.krill[i]; q.x += Math.sin(q.yaw) * q.sp * dt; q.z += Math.cos(q.yaw) * q.sp * dt; q.yaw += Math.sin(time * 0.02 + i) * 0.01 * dt;
      if (Math.hypot(q.x - sub.x, q.z - sub.z) > 190) { q.c.mesh.visible = false; L.krill.splice(i, 1); continue; } q.c.C.value.set(q.x, q.y, q.z); q.c.A.value = q.yaw - PI / 2; q.c.PX.value = px; }
    // Einzelgänger: wandern gemächlich, weichen dem Boot aus
    F.mola.list.length = 0; F.eel.list.length = 0; D.begin();
    for (let i = L.solo.length - 1; i >= 0; i--) { const s = L.solo[i], c = SOLO[s.kind];
      if (Math.hypot(s.x - sub.x, s.z - sub.z) > 150) { L.solo.splice(i, 1); continue; }
      s.ret -= dt; if (s.ret <= 0 || Math.hypot(s.tx - s.x, s.tz - s.z) < 3) { s.ret = rr(10, 22); s.pass = 1;
        if (cu && s.kind !== 'siphon' && R() < 0.75 && Math.hypot(cu.x - s.x, cu.z - s.z) < 140) { const a = R() * 2 * PI, d = rr(5, 10); s.tx = cu.x + Math.sin(a) * d; s.tz = cu.z + Math.cos(a) * d; s.ty = Math.max(cu.y + rr(0, 5), floorH(s.tx, s.tz) + 2.5); s.ret = rr(8, 14); }   // auf 5 bis 10 m heran
        else { const a = s.yaw + rr(-1.2, 1.2), d = rr(15, 35); s.tx = s.x + Math.sin(a) * d; s.tz = s.z + Math.cos(a) * d; s.ty = clamp(s.y + rr(-6, 6), floorH(s.tx, s.tz) + 8, -12); } }
      let dx = s.tx - s.x, dy = s.ty - s.y, dz = s.tz - s.z; const bx = s.x - sub.x, by = s.y - sub.y, bz = s.z - sub.z, bd = Math.hypot(bx, by, bz), fl = 4 + s.size;
      if (bd < fl) { const w = (fl - bd) / fl * 20; dx += bx / bd * w; dy += by / bd * w * 0.5; dz += bz / bd * w; }
      if (s.kind === 'siphon') { s.x += dx * 0.02 * dt; s.y += dy * 0.02 * dt + Math.sin(time * 0.4 + s.seed * 9) * 0.05 * dt; s.z += dz * 0.02 * dt; s.yaw += 0.04 * dt; s.ph += dt; D.add('siphon', { x: s.x, y: s.y, z: s.z, L: s.size, yaw: s.yaw, ph: s.ph, seed: s.seed, glow: 1 }); continue; }
      const wy = Math.atan2(dx, dz), turn = s.kind === 'eel' ? 0.5 : 0.3; s.yaw = wrapPi(s.yaw + clamp(wrapPi(wy - s.yaw), -turn * dt, turn * dt)); s.pitch += (clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.35, 0.35) - s.pitch) * Math.min(1, dt * 0.6);
      const sp = c.sp * (bd < fl ? 2 : 1) * (s.pass || 1); s.x += Math.sin(s.yaw) * Math.cos(s.pitch) * sp * dt; s.z += Math.cos(s.yaw) * Math.cos(s.pitch) * sp * dt; s.y += Math.sin(s.pitch) * sp * dt;
      const f = floorH(s.x, s.z); if (s.y < f + 3) s.y = f + 3;
      s.ph += dt * 2 * PI * c.ph * (bd < fl ? 1.6 : 1);
      if (s.kind === 'angler') D.add('angler', { x: s.x, y: s.y, z: s.z, L: s.size, yaw: s.yaw, pitch: s.pitch, ph: s.ph, amp: c.amp, seed: s.seed, glow: 1 });
      else (s.kind === 'mola' ? F.mola : F.eel).list.push({ x: s.x, y: s.y, z: s.z, size: s.size, yaw: s.yaw, pitch: s.pitch, roll: 0, ph: s.ph, amp: c.amp, seed: s.seed, glow: 1 }); }
    D.commit(); F.mola.sync(); F.eel.sync();
  };
  L.counts = () => ({ school: L.schools.length, krill: L.krill.length, mola: count('mola'), angler: count('angler'), eel: count('eel'), siphon: count('siphon') });
  return L;
}
