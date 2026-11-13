// main.js – Ablauf: Eingabe, Fahrverhalten, Kamera, Sonar, Bildaufbau
import { T, clamp, damp, wrapPi, smooth, noiseTexture } from './util.js';
import { U, createBackdrop, createPost } from './gfx.js';
import { floorH, floorN, cxAt, BOUNDS } from './terrain.js';
import { createWorld, poisNear } from './world.js';
import { createLife } from './life.js';
import { createFauna } from './fauna.js';
import { t, setLang, getLang } from './i18n.js';
const PC = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
import { createSub } from './sub.js';
import { createAudio } from './audio.js';
import { createCabin, SEAT, FLOOR_Y } from './cabin.js';
import { createTable } from './sonartable.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.autoClear = true; renderer.info.autoReset = false; renderer.setClearColor(0x021a2c);
const scene = new T.Scene(), camera = new T.PerspectiveCamera(58, 1, 0.3, 700);
U.uNoise.value = noiseTexture(256);
createBackdrop(scene);
const life = createLife(scene), fauna = createFauna(scene), world = createWorld(scene, life), boat = createSub(scene), post = createPost(renderer), audio = createAudio();
const cabin = createCabin(), cabinScene = new T.Scene(), camIn = new T.PerspectiveCamera(72, 1, 0.04, 40); cabinScene.add(cabin.group);
// Ansicht: draußen hinter dem Boot oder drinnen in der Kabine (gehen, am Steuer sitzen, am Sonartisch stehen)
const V = { mode: 'out', st: 'walk', px: 0, pz: -0.55, yaw: 0, pitch: 0, hx: 0, hy: 1.56, hz: -0.55, bob: 0 }, nav = { course: null };

// ---------- Bildgröße und Güte ----------
const FOV = { in: 64, out: 58 }; try { const f = JSON.parse(localStorage.getItem('tiefenlicht.fov') || '{}'); if (f.in) FOV.in = f.in; if (f.out) FOV.out = f.out; } catch (e) { /* ohne Speicher */ }
let PR = Q.get('q') === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2), MSAA = Q.get('q') === 'low' ? 0 : 4, portrait = false, pxScale = 600;
function resize() {
  const w = window.innerWidth, h = window.innerHeight; portrait = h > w;
  renderer.setPixelRatio(PR); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = fovFor(V.mode); camera.updateProjectionMatrix(); camIn.aspect = camera.aspect; camIn.fov = camera.fov; camIn.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new T.Vector2()); post.resize(s.x, s.y, MSAA); pxScale = s.y / (2 * Math.tan(camera.fov * Math.PI / 360));
}
window.addEventListener('resize', resize); resize();

// ---------- Sichtfeld (einstellbar, getrennt für draußen und drinnen; gespeichert) ----------
function fovFor(m) { const p = window.innerHeight > window.innerWidth; return (m === 'in' ? FOV.in : FOV.out) + (p ? (m === 'in' ? 14 : 22) : 0); }
// ---------- Zustand ----------
const S = { x: cxAt(-86), y: -45, z: -86, h: 0.12, vx: 0, vy: 0, vz: 0, yawV: 0, roll: 0, pitch: 0, thrust: 0, prop: 0 };
const C = { yaw: 0.12, oy: 0, op: 0, dist: 11, pos: new T.Vector3(S.x, S.y + 3, S.z - 11), idle: 9, look: new T.Vector3() };
const I = { jx: 0, jy: 0, up: 0, down: 0, joyId: null, lookId: null, ox: 0, oy: 0, lx: 0, ly: 0, keys: {} };
let started = false, frames = 0, tNote = 0;

// ---------- Eingabe ----------
const joy = $('joy'), knob = $('knob'), JR = 54;
function setJoy(dx, dy) { const l = Math.hypot(dx, dy), k = l > JR ? JR / l : 1; dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.min(1, Math.hypot(dx, dy) / JR), dz = m < 0.1 ? 0 : (m - 0.1) / 0.9, a = Math.atan2(dy, dx); I.jx = Math.cos(a) * dz; I.jy = Math.sin(a) * dz; }
window.addEventListener('pointerdown', (e) => {
  if (!started) return;
  if (e.target.closest && e.target.closest('.btn,.pill,#sonar,#table,#opts,#log,#dev')) return; if (V.st === 'table' && V.mode === 'in') return;
  if (e.pointerType === 'mouse') {
    if (lockOK && e.target === canvas) { if (document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { lockOK = false; }); } catch (x) { lockOK = false; } } else if (e.button === 2) ping(); return; }
    if (I.lookId === null) { I.lookId = e.pointerId; I.lx = e.clientX; I.ly = e.clientY; } return;   // ohne Mausfang: Ziehen = umsehen
  }
  if (e.clientX < window.innerWidth * 0.5 && I.joyId === null) { I.joyId = e.pointerId; I.ox = e.clientX; I.oy = e.clientY; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; joy.style.opacity = 1; setJoy(0, 0); }
  else if (I.lookId === null) { I.lookId = e.pointerId; I.lx = e.clientX; I.ly = e.clientY; }
});
let lockOK = !!canvas.requestPointerLock; if (PC) document.body.classList.add('pc');
document.addEventListener('pointerlockerror', () => { lockOK = false; });
document.addEventListener('pointerlockchange', () => { grabEl.style.opacity = document.pointerLockElement === canvas || !started || !PC ? 0 : 1; });
const grabEl = $('grab');
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement !== canvas) return; const dx = e.movementX || 0, dy = e.movementY || 0; if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
  if (V.mode === 'in') { V.yaw -= dx * 0.0026; V.pitch = clamp(V.pitch - dy * 0.0022, -1.25, 1.25); } else { C.oy -= dx * 0.003; C.op = clamp(C.op + dy * 0.0024, -1.15, 1.1); C.idle = 0; } });
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === I.joyId) setJoy(e.clientX - I.ox, e.clientY - I.oy);
  else if (e.pointerId === I.lookId) { const dx = e.clientX - I.lx, dy = e.clientY - I.ly; I.lx = e.clientX; I.ly = e.clientY; if (V.mode === 'in') { V.yaw -= dx * 0.0052; V.pitch = clamp(V.pitch - dy * 0.0042, -1.25, 1.25); } else { C.oy -= dx * 0.0055; C.op = clamp(C.op + dy * 0.004, -1.15, 1.1); C.idle = 0; } }
});
const release = (e) => { if (e.pointerId === I.joyId) { I.joyId = null; I.jx = I.jy = 0; joy.style.opacity = 0; knob.style.transform = ''; } if (e.pointerId === I.lookId) I.lookId = null; };
window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
for (const [id, key] of [['up', 'up'], ['down', 'down']]) {
  const b = $(id), on = (e) => { e.preventDefault(); I[key] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } }, off = () => { I[key] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
}
window.addEventListener('keydown', (e) => { I.keys[e.code] = 1; }); window.addEventListener('keyup', (e) => { I.keys[e.code] = 0; });
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });

// ---------- Sonar: der Strahl kreist von selbst und zeigt nahe Wände; ein Ping reicht weit und holt Echos von Fundstellen ----------
const scope = $('scope'), sc = scope.getContext('2d'), SR = 60, PING = 480, blips = [], marks = [], echoes = [];
const sonar = { a: 0, pingR: -1, pingAt: null, cool: 0 };
function sonarCast(wa) {
  const sx = Math.sin(wa), sz = Math.cos(wa); let prev = 3;
  for (let d = 5; d <= SR; d += 2.5) {
    if (floorH(S.x + sx * d, S.z + sz * d) > S.y - 0.5) { let lo = prev, hi = d; for (let i = 0; i < 3; i++) { const m = (lo + hi) / 2; if (floorH(S.x + sx * m, S.z + sz * m) > S.y - 0.5) hi = m; else lo = m; } return hi; }
    prev = d;
  }
  return -1;
}
function sonarStep(dt) {
  const a0 = sonar.a, a1 = a0 + dt * 1.75, n = Math.max(1, Math.ceil((a1 - a0) / 0.04));
  for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, wa = S.h - a, d = sonarCast(wa); if (d > 0) blips.push({ x: S.x + Math.sin(wa) * d, z: S.z + Math.cos(wa) * d, life: 1 }); }
  const passed = (x, z) => { const rel = wrapPi(S.h - Math.atan2(x - S.x, z - S.z)), r = ((rel % 6.2832) + 6.2832) % 6.2832, b0 = ((a0 % 6.2832) + 6.2832) % 6.2832, dl = ((r - b0) % 6.2832 + 6.2832) % 6.2832; return dl < a1 - a0; };
  for (const s of world.near) { const dx = s.x - S.x, dz = s.z - S.z, d = Math.hypot(dx, dz); if (d < SR && d > 3 && Math.abs(s.y - S.y) < s.r + 0.5 && passed(s.x, s.z)) blips.push({ x: s.x - dx / d * s.r * 0.7, z: s.z - dz / d * s.r * 0.7, life: 1 }); }
  sonar.a = a1 % 6.2832; sonar.cool -= dt;
  for (let i = blips.length - 1; i >= 0; i--) { blips[i].life -= dt / 3.4; if (blips[i].life <= 0) blips.splice(i, 1); }
  for (let i = echoes.length - 1; i >= 0; i--) { const e = echoes[i]; e.t -= dt; if (e.t > 0) continue; echoes.splice(i, 1); audio.echo(e.vol, clamp(Math.sin(wrapPi(S.h - Math.atan2(e.x - S.x, e.z - S.z))), -1, 1) * 0.8); for (let j = marks.length - 1; j >= 0; j--) if (marks[j].x === e.x && marks[j].z === e.z) marks.splice(j, 1); marks.push({ x: e.x, z: e.z, life: 1, born: U.uTime.value }); }
  for (let i = marks.length - 1; i >= 0; i--) { marks[i].life -= dt / 75; if (marks[i].life <= 0) marks.splice(i, 1); }
  if (sonar.pingR >= 0) { sonar.pingR += dt * 60; U.uPing.value.set(sonar.pingAt.x, sonar.pingAt.y, sonar.pingAt.z, sonar.pingR); U.uPingFade.value = Math.pow(Math.max(0, 1 - sonar.pingR / 230), 1.5); if (sonar.pingR > 230) { sonar.pingR = -1; U.uPing.value.w = -1; } }
}
function sonarDraw() {
  const w = scope.width, c = w / 2, R = c - 6, k = R / SR; sc.clearRect(0, 0, w, w);
  sc.fillStyle = '#020604'; sc.beginPath(); sc.arc(c, c, c, 0, 6.2832); sc.fill();
  const gr = sc.createRadialGradient(c, c, 0, c, c, R); gr.addColorStop(0, 'rgba(20,70,35,0.38)'); gr.addColorStop(1, 'rgba(4,22,10,0.25)'); sc.fillStyle = gr; sc.beginPath(); sc.arc(c, c, R, 0, 6.2832); sc.fill();
  sc.strokeStyle = 'rgba(60,220,110,0.22)'; sc.lineWidth = 1.5;
  for (const r of [20, 40, 60]) { sc.beginPath(); sc.arc(c, c, r * k, 0, 6.2832); sc.stroke(); }
  sc.beginPath(); sc.moveTo(c - R, c); sc.lineTo(c + R, c); sc.moveTo(c, c - R); sc.lineTo(c, c + R); sc.stroke();
  sc.save(); sc.beginPath(); sc.arc(c, c, R, 0, 6.2832); sc.clip();
  const sa = sonar.a - Math.PI / 2;                                    // Winkel 0 zeigt nach oben, läuft im Uhrzeigersinn
  for (let i = 0; i < 30; i++) { const a = sa - i * 0.035; sc.fillStyle = `rgba(70,255,130,${0.3 * Math.pow(1 - i / 30, 2)})`; sc.beginPath(); sc.moveTo(c, c); sc.arc(c, c, R, a - 0.037, a); sc.closePath(); sc.fill(); }
  sc.strokeStyle = 'rgba(150,255,180,0.9)'; sc.lineWidth = 2.2; sc.beginPath(); sc.moveTo(c, c); sc.lineTo(c + Math.cos(sa) * R, c + Math.sin(sa) * R); sc.stroke();
  const ch = Math.cos(S.h), sh = Math.sin(S.h), rel = (x, z) => { const dx = x - S.x, dz = z - S.z; return [-(dx * ch - dz * sh), dx * sh + dz * ch]; };
  for (const b of blips) { const q = rel(b.x, b.z); sc.fillStyle = `rgba(90,255,140,${b.life * b.life * 0.85})`; sc.fillRect(c + q[0] * k - 2.5, c - q[1] * k - 2.5, 5, 5); }
  if (sonar.pingR >= 0 && sonar.pingR < SR * 1.5) { const q = rel(sonar.pingAt.x, sonar.pingAt.z); sc.strokeStyle = `rgba(150,255,190,${0.8 * (1 - sonar.pingR / (SR * 1.5))})`; sc.lineWidth = 3; sc.beginPath(); sc.arc(c + q[0] * k, c - q[1] * k, sonar.pingR * k, 0, 6.2832); sc.stroke(); }
  // Echos: in Reichweite als Raute, sonst als Pfeil am Rand in ihrer Richtung
  for (const m of marks) {
    const q = rel(m.x, m.z), d = Math.hypot(q[0], q[1]), al = Math.min(1, m.life * 4) * (0.6 + 0.4 * Math.sin((U.uTime.value - m.born) * 3)); sc.fillStyle = `rgba(200,255,220,${al})`; sc.shadowColor = '#6fffa0'; sc.shadowBlur = 16;
    if (d < SR - 5) { const px = c + q[0] * k, py = c - q[1] * k, s = 9; sc.beginPath(); sc.moveTo(px, py - s); sc.lineTo(px + s * 0.7, py); sc.lineTo(px, py + s); sc.lineTo(px - s * 0.7, py); sc.closePath(); sc.fill(); }
    else { const ux = q[0] / d, uy = -q[1] / d, s = 13 - 6 * Math.min(1, d / PING), px = c + ux * (R - 4), py = c + uy * (R - 4); sc.beginPath(); sc.moveTo(px, py); sc.lineTo(px - ux * s * 1.9 - uy * s * 0.75, py - uy * s * 1.9 + ux * s * 0.75); sc.lineTo(px - ux * s * 1.9 + uy * s * 0.75, py - uy * s * 1.9 - ux * s * 0.75); sc.closePath(); sc.fill(); }
    sc.shadowBlur = 0;
  }
  if (nav.course) {   // gesetzter Kurs: bernsteinfarbener Doppelpfeil am Rand, in Reichweite ein Ring
    const q = rel(nav.course.x, nav.course.z), d = Math.hypot(q[0], q[1]) || 1; sc.strokeStyle = 'rgba(255,205,120,0.95)'; sc.lineWidth = 3.5; sc.lineJoin = 'round';
    if (d < SR - 5) { sc.beginPath(); sc.arc(c + q[0] * k, c - q[1] * k, 11, 0, 6.2832); sc.stroke(); }
    else { const ux = q[0] / d, uy = -q[1] / d; for (const o of [5, 22]) { const px = c + ux * (R - o), py = c + uy * (R - o), s = 14; sc.beginPath(); sc.moveTo(px - ux * s - uy * s * 0.8, py - uy * s + ux * s * 0.8); sc.lineTo(px, py); sc.lineTo(px - ux * s + uy * s * 0.8, py - uy * s - ux * s * 0.8); sc.stroke(); } }
  }
  sc.restore();
  sc.fillStyle = 'rgba(200,255,220,0.95)'; sc.beginPath(); sc.moveTo(c, c - 9); sc.lineTo(c + 6, c + 7); sc.lineTo(c - 6, c + 7); sc.closePath(); sc.fill();
}
function ping() {
  if (sonar.cool > 0) return; sonar.cool = 3.2; sonar.pingR = 0; sonar.pingAt = { x: S.x, y: S.y, z: S.z }; audio.ping();
  const ps = poisNear(S.x, S.z, PING).map((p) => ({ p, d: Math.hypot(p.x - S.x, p.z - S.z) })).sort((a, b) => a.d - b.d).slice(0, 5);
  for (const { p, d } of ps) echoes.push({ x: p.x, z: p.z, t: 0.3 + d / 85, vol: clamp(1.15 - d / 500, 0.2, 1) });
}
$('sonar').addEventListener('pointerdown', (e) => { e.preventDefault(); if (started) ping(); });

// ---------- Fahren ----------
const nT = { x: 0, y: 0, z: 0 }, CLEAR = 3.9, SOFT = 1.2;
function props(dt) {   // Steuerrad, Tiefenruder, Tee: laufen immer mit, auch wenn man draußen ist
  const st = cabin.state; st.wheel += (S.yawV / 0.72 * 1.4 - st.wheel) * Math.min(1, dt * 5); st.lever += (-S.vy / 3.3 * 0.55 - st.lever) * Math.min(1, dt * 5);
  for (const p of boat.planes) p.rotation.x = -S.vy / 3.3 * 0.45 + st.lever * 0;
  if (tea.phase === 'heat') { tea.t += dt; if (tea.t > 22) tea.phase = 'ready'; } else if (tea.phase === 'cool') { tea.t += dt; if (tea.t > 30) { tea.phase = 'cold'; tea.t = 0; } }
  st.boil = tea.phase === 'heat' ? Math.min(1, tea.t / 22) : tea.phase === 'ready' ? 1 : tea.phase === 'cool' ? Math.max(0, 1 - tea.t / 20) : 0; audio.kettle(V.mode === 'in' ? st.boil : st.boil * 0.3);
  if (st.cupHeat > 0 && st.cup !== 'none') st.cupHeat = Math.max(0.0, st.cupHeat - dt / 240);
  if (frames % 30 === 0) discover();
}
function drive(dt) {
  const ctl = V.mode === 'out' || V.st === 'seat', K = ctl ? I.keys : {}; let jx = ctl ? I.jx : 0, jy = ctl ? I.jy : 0;
  if (K.KeyA || K.ArrowLeft) jx -= 1; if (K.KeyD || K.ArrowRight) jx += 1; if (K.KeyW || K.ArrowUp) jy -= 1; if (K.KeyS || K.ArrowDown) jy += 1;
  const mag = Math.min(1, Math.hypot(jx, jy)), vIn = ctl ? (I.up || K.KeyE || K.Space ? 1 : 0) - (I.down || K.KeyQ || K.ShiftLeft ? 1 : 0) : 0;
  let want = 0, thrust = 0;
  if (mag > 0.05) { const diff = wrapPi((V.mode === 'out' ? C.yaw + C.oy - S.h : 0) - Math.atan2(jx, -jy)); want = clamp(diff * 1.4, -0.72, 0.72) * (0.4 + 0.6 * mag); thrust = mag * clamp(Math.cos(diff) * 1.15 + 0.1, 0.12, 1); }
  S.yawV = damp(S.yawV, want, 2.6, dt); S.h = wrapPi(S.h + S.yawV * dt); S.thrust = damp(S.thrust, thrust, 2.2, dt);
  const fx = Math.sin(S.h), fz = Math.cos(S.h);
  let vf = S.vx * fx + S.vz * fz, vl = S.vx * fz - S.vz * fx;                 // längs und quer zum Boot
  vf += (S.thrust * 3.9 - vf * 0.55) * dt; vl -= vl * Math.min(1, 1.7 * dt);
  S.vx = fx * vf + fz * vl; S.vz = fz * vf - fx * vl;
  let vyT = vIn * 3.3; if (S.y < BOUNDS.deep + 7 && vyT < 0) vyT *= smooth(BOUNDS.deep, BOUNDS.deep + 7, S.y);
  S.vy = damp(S.vy, vyT, 1.5, dt);
  S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;
  // Abstand zum Grund und zu den Wänden: weich federnd, darunter fest
  for (const o of [0, 2, -2]) {
    const px = S.x + fx * o, pz = S.z + fz * o, h = floorH(px, pz); floorN(px, pz, nT);
    const pen = (h + CLEAR - S.y) * nT.y;
    if (pen > 0) { const mv = Math.max(pen - SOFT, 0) + Math.min(pen, SOFT) * Math.min(1, 3.5 * dt); S.x += nT.x * mv; S.y += nT.y * mv; S.z += nT.z * mv; const vn = S.vx * nT.x + S.vy * nT.y + S.vz * nT.z; if (vn < 0) { const k = Math.min(1, (2 + pen * 6) * dt); S.vx -= nT.x * vn * k; S.vy -= nT.y * vn * k; S.vz -= nT.z * vn * k; } }
  }
  for (const s of world.near) {
    const dx = S.x - s.x, dy = S.y - s.y, dz = S.z - s.z, min = s.r + 2.5; if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(dy) > min) continue;
    const d = Math.hypot(dx, dy, dz); if (d >= min || d < 0.001) continue;
    const pen = min - d, mv = Math.max(pen - 0.6, 0) + Math.min(pen, 0.6) * Math.min(1, 5 * dt), nx = dx / d, ny = dy / d, nz = dz / d; S.x += nx * mv; S.y += ny * mv; S.z += nz * mv;
    const vn = S.vx * nx + S.vy * ny + S.vz * nz; if (vn < 0) { const k = Math.min(1, 8 * dt); S.vx -= nx * vn * k; S.vy -= ny * vn * k; S.vz -= nz * vn * k; }
  }
  // Rand der Probe: sanft zurückdrücken
  const rad = Math.hypot(S.x, S.z); if (rad > BOUNDS.r) { const o = (rad - BOUNDS.r) * 0.8 * dt / rad; S.vx -= S.x * o; S.vz -= S.z * o; }
  if (S.y > BOUNDS.top) { S.y = damp(S.y, BOUNDS.top, 3, dt); if (S.vy > 0) S.vy *= 1 - Math.min(1, 4 * dt); }
  if (S.y < BOUNDS.deep) { S.y = damp(S.y, BOUNDS.deep, 2, dt); }
  if (S.y < BOUNDS.deep + 3 && vIn < 0) tNote = 3.5;
  S.roll = damp(S.roll, -S.yawV * 0.42, 2.5, dt); S.pitch = damp(S.pitch, -S.vy * 0.07 - S.thrust * 0.02, 2.5, dt);
  const t = U.uTime.value, g = boat.group;
  g.position.set(S.x, S.y + Math.sin(t * 0.7) * 0.07, S.z); g.rotation.set(S.pitch + Math.sin(t * 0.53) * 0.012, S.h, S.roll + Math.sin(t * 0.61) * 0.018);
  S.prop += dt * (1.5 + S.thrust * 22); boat.prop.rotation.z = S.prop;
  boat.halo.material.opacity = 0.46 + 0.05 * Math.sin(t * 1.7);
  g.updateMatrixWorld(true);
  U.uSubPos.value.set(S.x, S.y, S.z); U.uLampPos.value.copy(boat.lampLocal).applyMatrix4(g.matrixWorld); U.uWarmPos.value.copy(boat.warmLocal).applyMatrix4(g.matrixWorld);
  U.uLampDir.value.set(0, -0.1, 1).normalize().transformDirection(g.matrixWorld);
  const sp = Math.hypot(S.vx, S.vz);
  life.emit(S.x - fx * 2.8, S.y, S.z - fz * 2.8, S.vx - fx * 1.5, 0.2, S.vz - fz * 1.5, 1.5 + S.thrust * 16, dt);
  audio.update(dt, S.thrust, Math.min(1, sp / 7));
}

// ---------- Kamera: schräg hinter dem Boot, weicht Wänden aus ----------
const dir = new T.Vector3(), tgt = new T.Vector3(), want = new T.Vector3();
function cameraStep(dt) {
  C.idle += dt;
  const moving = S.thrust > 0.15;
  if (I.lookId === null && moving && C.idle > 1.4) { C.oy = damp(C.oy, 0, 1.1, dt); C.op = damp(C.op, 0, 1.1, dt); }
  if (I.lookId === null) C.yaw += wrapPi(S.h - C.yaw) * (1 - Math.exp(-(moving ? 1.25 : 0.25) * dt));
  C.oy = wrapPi(C.oy);
  const yaw = C.yaw + C.oy, pit = clamp(0.27 + C.op, -1.0, 1.25), cp = Math.cos(pit), D = portrait ? 17 : 14;
  dir.set(Math.sin(yaw) * cp, -Math.sin(pit), Math.cos(yaw) * cp);
  tgt.set(S.x + Math.sin(yaw) * 2.4 * cp, S.y + 1.0, S.z + Math.cos(yaw) * 2.4 * cp);
  let tMax = 1;
  for (let i = 1; i <= 8; i++) { const t = i / 8, px = tgt.x - dir.x * D * t, py = tgt.y - dir.y * D * t, pz = tgt.z - dir.z * D * t; if (floorH(px, pz) + 1.4 > py) { tMax = Math.max(0.2, (i - 1) / 8); break; } }
  const dT = D * tMax; C.dist = damp(C.dist, dT, dT < C.dist ? 9 : 1.2, dt);
  want.copy(tgt).addScaledVector(dir, -C.dist);
  C.pos.x = damp(C.pos.x, want.x, 7, dt); C.pos.y = damp(C.pos.y, want.y, 7, dt); C.pos.z = damp(C.pos.z, want.z, 7, dt);
  for (const s of world.near) { const dx = C.pos.x - s.x, dy = C.pos.y - s.y, dz = C.pos.z - s.z, min = s.r + 0.9; if (Math.abs(dx) > min || Math.abs(dy) > min || Math.abs(dz) > min) continue; const d = Math.hypot(dx, dy, dz); if (d < min && d > 0.001) { const k = (min - d) / d; C.pos.x += dx * k; C.pos.y += dy * k; C.pos.z += dz * k; } }
  C.pos.y = clamp(C.pos.y, floorH(C.pos.x, C.pos.z) + 1.1, -1.5);
  C.look.x = damp(C.look.x, tgt.x, 9, dt); C.look.y = damp(C.look.y, tgt.y, 9, dt); C.look.z = damp(C.look.z, tgt.z, 9, dt);
  camera.position.copy(C.pos); camera.lookAt(C.look);
  U.uDeep.value = clamp(Math.exp((C.pos.y + 32) * 0.0085), 0.5, 1.12);
}
C.look.set(S.x, S.y + 1, S.z + 2);

// ---------- Kabine: Ego-Perspektive ----------
const table = createTable(S, nav, $('tableCv')), eyeL = new T.Vector3(), winCol = new T.Vector3(), tmpS = new T.Vector3(), fadeEl = $('fade'), actEl = $('act'), modeEl = $('mode');
let switching = false;
function ui() { document.body.className = (V.mode === 'in' ? 'in ' + V.st : 'out') + (PC ? ' pc' : ''); $('modeL').textContent = V.mode === 'in' ? t('to_out') : t('to_in'); }
function applyMode() {
  const inn = V.mode === 'in'; for (const o of boat.outer) o.visible = !inn;
  if (inn) { V.st = 'walk'; V.px = 0; V.pz = -0.95; V.yaw = 0; V.pitch = 0; V.hx = 0; V.hy = 1.56; V.hz = -0.95; table.reset(); if (!PC) { hintEl.textContent = t('hint_in_touch'); hintEl.style.opacity = 1; hintT = 6; } }
  else { C.yaw = S.h; C.oy = C.op = 0; C.dist = 14; C.pos.set(S.x - Math.sin(S.h) * 14, S.y + 4, S.z - Math.cos(S.h) * 14); C.look.set(S.x, S.y + 1, S.z); }
  audio.setInside(inn); world.setSmall(!inn); life.setInside(inn); ui(); resize(); syncFov();
}
function setMode(m) { if (switching || !started || V.mode === m) return; switching = true; fadeEl.style.opacity = 1; setTimeout(() => { V.mode = m; applyMode(); fadeEl.style.opacity = 0; switching = false; }, 330); }
function setSt(s) {
  const was = V.st; V.st = s; if (s === 'table' && document.pointerLockElement) document.exitPointerLock();
  if (s === 'seat') { V.yaw = 0; V.pitch = 0; } else if (s === 'table') { V.yaw = -Math.PI / 2; V.pitch = -0.55; }
  else if (was === 'seat') { V.px = 0; V.pz = 0.2; } else if (was === 'table') { V.px = -0.15; V.pz = -1.3; }
  ui();
}
// ---------- Gegenstände benutzen: was man ansieht und erreicht, leuchtet leicht auf; der Knopf unten zeigt die Handlung ----------
const tea = { phase: 'cold', t: 0 }, wv = new T.Vector3(), fwd = new T.Vector3();
let target = null;
const LABEL = {
  seat: () => t('seat'), table: () => t('table'),
  kettle: () => (tea.phase === 'cold' ? t('kettle_on') : tea.phase === 'ready' ? t('kettle_pour') : ''),
  stove: () => (cabin.state.fireT > 1.2 ? '' : t('stove')),
  cupDesk: () => (cabin.state.cup === 'desk' ? t('cup_take') : ''), cupPult: () => (cabin.state.cup === 'pult' ? (cabin.state.cupHeat > 0.05 ? t('cup_drink') : t('cup_away')) : ''),
  deck: () => (cabin.state.tape ? t('tape_stop') : t('tape_play')), light: () => (cabin.state.lampT > 0.5 ? t('light_dim') : t('light_on')), log: () => t('log_read'),
};
const ACT = {
  seat: () => setSt('seat'), table: () => setSt('table'),
  kettle: () => { if (tea.phase === 'cold') { tea.phase = 'heat'; tea.t = 0; audio.click(0.6); } else if (tea.phase === 'ready') { tea.phase = 'cool'; tea.t = 0; cabin.state.cup = 'desk'; cabin.state.cupHeat = 1; audio.pour(); } },
  stove: () => { cabin.state.fireT = 1.7; setTimeout(() => { cabin.state.fireT = 1; }, 45000); audio.click(0.8); },
  cupDesk: () => { cabin.state.cup = 'pult'; audio.click(0.3); }, cupPult: () => { if (cabin.state.cupHeat > 0.05) { cabin.state.cupHeat = Math.max(0, cabin.state.cupHeat - 0.34); if (cabin.state.cupHeat <= 0.05) note(t('tea_done')); } else cabin.state.cup = 'none'; audio.click(0.25); },
  deck: () => { cabin.state.tape = !cabin.state.tape; audio.tape(cabin.state.tape); }, light: () => { cabin.state.lampT = cabin.state.lampT > 0.5 ? 0.12 : 1; audio.click(0.9); }, log: () => openLog(),
};
function pickTarget() {
  if (V.mode !== 'in' || V.st === 'table') return null;
  camera.getWorldDirection(fwd); let best = null, bs = 0;
  const keys = V.st === 'seat' ? ['cupPult', 'deck'] : Object.keys(LABEL).filter((k) => k !== 'cupPult' || cabin.state.cup === 'pult');
  for (const k of keys) { if (!LABEL[k]()) continue; cabin.toWorld(k, wv); const d = wv.sub(camera.position), l = d.length(), reach = k === 'seat' || k === 'table' ? 1.9 : 1.45; if (l > reach) continue; const c = d.dot(fwd) / l, need = k === 'seat' || k === 'table' ? 0.86 : 0.93; if (c > need && c - l * 0.02 > bs) { bs = c - l * 0.02; best = k; } }
  return best;
}
const actLabel = () => (V.mode !== 'in' || V.st === 'table' ? '' : target ? LABEL[target]() : V.st === 'seat' ? t('stand') : '');
actEl.addEventListener('pointerdown', (e) => { e.preventDefault(); if (target && LABEL[target]()) ACT[target](); else if (V.st === 'seat') setSt('walk'); });
// ---------- Logbuch: füllt sich von selbst, wenn man etwas findet ----------
const LOG = [], seen = new Set(); let playTime = 0;
const DIR8 = (dx, dz) => Math.round(((Math.atan2(dx, dz) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8;
function addLog(e) { e.min = Math.round(playTime / 60); e.depth = Math.round(-S.y); LOG.push(e); note(t('log_note', { t: entryTitle(e) })); save(); }
const entryTitle = (e) => (e.kind === 'shark' ? '—' : t('n_' + e.kind) + (e.n ? ' (' + (e.n + 1) + '.)' : ''));
const entryText = (e) => { if (e.kind === 'shark') return t('shark'); const tx = t(e.kind); return tx[e.n % tx.length] + ' ' + t('where', { d: e.dist, dir: t('dirs')[e.dir] }); };
function discover() {
  for (const p of poisNear(S.x, S.z, 46)) { const k = Math.round(p.x) + ',' + Math.round(p.z); if (seen.has(k) || Math.hypot(p.x - S.x, p.z - S.z) > (p.kind === 'wreck' ? 46 : 32)) continue; seen.add(k); addLog({ kind: p.kind, n: LOG.filter((e) => e.kind === p.kind).length, dist: Math.round(Math.hypot(p.x, p.z) / 10) * 10, dir: DIR8(p.x, p.z) }); }
}
function openLog() {
  if (document.pointerLockElement) document.exitPointerLock();
  const box = $('logText'); box.innerHTML = ''; const h = document.createElement('div'); h.className = 'logHead'; h.textContent = t('log'); box.appendChild(h);
  const add = (title, when, text) => { const d = document.createElement('div'); d.className = 'logEntry'; const a = document.createElement('div'); a.className = 'logTitle'; a.textContent = title + (when ? '  ·  ' + when : ''); const p = document.createElement('div'); p.textContent = text; d.appendChild(a); d.appendChild(p); box.appendChild(d); };
  if (!LOG.length) add(t('log_empty_t'), '', t('log_empty'));
  for (const e of LOG.slice().reverse()) add(entryTitle(e), (e.min < 1 ? t('now') : t('after', { m: e.min })) + ', ' + e.depth + ' m', entryText(e));
  $('log').classList.add('open');
}
$('logClose').addEventListener('pointerdown', (e) => { e.preventDefault(); $('log').classList.remove('open'); });
$('logClose').textContent = t('close');
let noteT = 0; function note(t) { const n = $('note'); n.textContent = t; noteT = 4; }
// ---------- Einstellungen: Sichtfeld ----------
$('gear').addEventListener('pointerdown', (e) => { e.preventDefault(); if (document.pointerLockElement) document.exitPointerLock(); $('opts').classList.toggle('open'); syncFov(); });
// Sprache, Vollbild, neu beginnen
function texts() { for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t); ui(); syncFov(); for (const b of document.querySelectorAll('#langs .pill')) b.classList.toggle('on', b.dataset.l === getLang()); hintEl.textContent = PC ? t('hint_pc') : t('hint_touch'); }
for (const b of document.querySelectorAll('#langs .pill')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); setLang(b.dataset.l); texts(); });
if (!document.fullscreenEnabled) $('fsBtn').style.display = 'none';
$('fsBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().then(() => { try { screen.orientation.unlock(); } catch (x) { /* egal */ } }).catch(() => {}); } catch (x) { /* egal */ } });
let resetArm = 0; $('resetBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (resetArm && performance.now() - resetArm < 4000) { try { localStorage.removeItem(SAVE_KEY); } catch (x) { /* egal */ } noSave = true; location.reload(); } else { resetArm = performance.now(); $('resetBtn').textContent = t('reset_sure'); setTimeout(() => { $('resetBtn').textContent = t('reset'); }, 4000); } });
function syncFov() { const r = $('fovR'), v = V.mode === 'in' ? FOV.in : FOV.out; r.value = v; $('fovV').textContent = Math.round(fovFor(V.mode)) + '°'; $('fovL').textContent = V.mode === 'in' ? t('fov_in') : t('fov_out'); }
$('fovR').addEventListener('input', (e) => { const v = +e.target.value; if (V.mode === 'in') FOV.in = v; else FOV.out = v; try { localStorage.setItem('tiefenlicht.fov', JSON.stringify(FOV)); } catch (x) { /* egal */ } resize(); syncFov(); });
modeEl.addEventListener('pointerdown', (e) => { e.preventDefault(); setMode(V.mode === 'in' ? 'out' : 'in'); });
$('tableClose').addEventListener('pointerdown', (e) => { e.preventDefault(); setSt('walk'); });
$('tableClear').addEventListener('pointerdown', (e) => { e.preventDefault(); nav.course = null; });
$('tableCv').addEventListener('pointerdown', (e) => { e.preventDefault(); const r = e.target.getBoundingClientRect(); table.tap((e.clientX - r.left) / r.width * e.target.width, (e.clientY - r.top) / r.height * e.target.height); });
function cabinStep(dt) {
  const g = cabin.group; g.position.copy(boat.group.position); g.rotation.copy(boat.group.rotation);
  let tx, ty, tz;
  if (V.st === 'walk') {
    const K = I.keys; let jx = I.jx, jy = I.jy; if (K.KeyA || K.ArrowLeft) jx -= 1; if (K.KeyD || K.ArrowRight) jx += 1; if (K.KeyW || K.ArrowUp) jy -= 1; if (K.KeyS || K.ArrowDown) jy += 1;
    const mag = Math.min(1, Math.hypot(jx, jy)), sy = Math.sin(V.yaw), cy = Math.cos(V.yaw);
    V.px = clamp(V.px + (sy * -jy - cy * jx) * 1.25 * dt, -0.45, 0.4); V.pz = clamp(V.pz + (cy * -jy + sy * jx) * 1.25 * dt, -1.62, 0.26);
    V.bob += mag * dt * 7.5; tx = V.px; ty = 1.56 + Math.sin(V.bob) * 0.02 * Math.min(1, mag * 2); tz = V.pz;
  } else if (V.st === 'seat') { tx = SEAT.x; ty = SEAT.y; tz = SEAT.z; V.yaw = clamp(V.yaw, -2.3, 2.3); }
  else { tx = -0.25; ty = 1.5; tz = -1.4; }
  V.hx = damp(V.hx, tx, 7, dt); V.hy = damp(V.hy, ty, 7, dt); V.hz = damp(V.hz, tz, 7, dt);
  cabin.head.position.set(V.hx, V.hy + FLOOR_Y, V.hz); cabin.head.rotation.set(V.pitch, Math.PI + V.yaw, 0);
  g.updateMatrixWorld(true); cabin.head.matrixWorld.decompose(camera.position, camera.quaternion, tmpS); camIn.position.copy(camera.position); camIn.quaternion.copy(camera.quaternion);
  U.uDeep.value = clamp(Math.exp((camera.position.y + 32) * 0.0085), 0.5, 1.12);
  cabin.update(dt, eyeL.set(-V.hx, V.hy, V.hz), winCol.set(0.07, 0.34, 0.52).multiplyScalar(U.uDeep.value * 1.5), pxScale);
  target = pickTarget(); cabin.highlight(target);
  table.step(dt);
  if (V.st === 'table') { table.draw(); if (frames % 12 === 0) $('tableInfo').textContent = nav.course ? t('table_course', { d: String(Math.round(Math.hypot(nav.course.x - S.x, nav.course.z - S.z) / 5) * 5).padStart(3, '0') }) : t('table_info'); }
  else if (frames % 6 === 0) { table.draw(cabin.scopeCtx, 256); cabin.scopeTex.needsUpdate = true; }
}
window.addEventListener('keydown', (e) => { if (e.repeat) return;
  if (e.code === 'KeyC') setMode(V.mode === 'in' ? 'out' : 'in'); if (e.code === 'KeyF') actEl.dispatchEvent(new Event('pointerdown'));
  if (e.code === 'KeyR' && started) ping(); if (e.code === 'KeyL' && started) { if ($('log').classList.contains('open')) $('log').classList.remove('open'); else openLog(); }
  if (e.code === 'Escape') { $('log').classList.remove('open'); $('opts').classList.remove('open'); if (V.st === 'table') setSt('walk'); } });

// ---------- Schleife ----------
let last = performance.now(), fpsT = 0, fpsN = 0, slowT = 0, hintT = 0;
const fpsEl = $('fps'), depthEl = $('depth'), echoEl = $('echo'), noteEl = $('note'), hintEl = $('hint'), adapt = !Q.has('nopr');
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000, dt = Math.min(0.05, Math.max(0.001, raw)); last = now;
  U.uTime.value += dt; frames++; if (started) playTime += dt;
  if (started) { drive(dt); props(dt); sonarStep(dt); if (frames % 2 === 0 && (V.mode === 'out' || V.st === 'seat')) sonarDraw(); }
  else { boat.group.position.set(S.x, S.y, S.z); boat.group.rotation.set(0, S.h, 0); boat.group.updateMatrixWorld(true); U.uSubPos.value.set(S.x, S.y, S.z); U.uLampPos.value.copy(boat.lampLocal).applyMatrix4(boat.group.matrixWorld); U.uWarmPos.value.copy(boat.warmLocal).applyMatrix4(boat.group.matrixWorld); U.uLampDir.value.set(0, -0.1, 1).normalize().transformDirection(boat.group.matrixWorld); }
  world.update(S.x, S.z, started ? 1 : 0); if (V.mode === 'in') cabinStep(dt); else cameraStep(dt); if (window.__cam) { camera.position.set(...window.__cam[0]); camera.lookAt(...window.__cam[1]); } life.update(dt, S, pxScale, world.glows); fauna.update(dt, S, U.uTime.value);
  if (frames % 24 === 0) { let best = null; for (const m of marks) { const d = Math.hypot(m.x - S.x, m.z - S.z); if (!best || d < best) best = d; } if (nav.course) { const d = Math.hypot(nav.course.x - S.x, nav.course.z - S.z); if (d < 28) nav.course = null; else best = -d; } echoEl.className = best < 0 ? 'kurs' : ''; echoEl.textContent = best ? (best < 0 ? t('course') + ' ' : t('echo') + ' ') + String(Math.round(Math.abs(best) / 5) * 5).padStart(3, '0') + ' m' : '';
    const al = actLabel(), actL = $('actL'); if (actL.textContent !== al) { actL.textContent = al; actEl.style.display = al ? 'block' : 'none'; } }
  renderer.info.reset(); if (V.mode === 'in') post.render(scene, camera, cabinScene, camIn); else post.render(scene, camera);
  fpsT += raw; fpsN++;
  if (fpsT >= 1) {
    const fps = fpsN / fpsT; fpsEl.textContent = Math.round(fps) + ' fps'; depthEl.textContent = t('depth') + ' ' + String(Math.round(-S.y)).padStart(3, '0') + ' m';
    if (adapt && started && fps < 50) { slowT++; if (slowT >= 2) { slowT = 0; if (PR > 1.15) { PR = Math.max(1.1, PR - 0.25); resize(); } else if (MSAA) { MSAA = 0; resize(); } } } else slowT = 0;
    fpsT = 0; fpsN = 0;
  }
  if (tNote > 0) { tNote -= dt; noteEl.textContent = t('too_deep'); noteEl.style.opacity = tNote > 0.5 ? 1 : 0; } else if (noteT > 0) { noteT -= dt; noteEl.style.opacity = noteT > 0.6 ? 1 : 0; }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.style.opacity = 0; }
}
function start() {
  if (started) return; started = true; audio.start();
  // einmal kurz in die Kabine und wieder hinaus, unter dem Titelbild: danach ist der Bildaufbau in demselben Zustand wie nach einem Besuch
  V.mode = 'in'; applyMode(); cabinStep(0.016); renderer.info.reset(); post.render(scene, camera, cabinScene, camIn); V.mode = 'out'; applyMode(); cameraStep(0.016); post.render(scene, camera);
  $('title').classList.add('gone'); $('ui').classList.add('on'); last = performance.now(); ui(); texts();
  if (PC) { hintT = 0; hintEl.style.opacity = 0; grabEl.style.opacity = 1; } else { hintEl.style.opacity = 1; hintT = 9; }
}
$('title').addEventListener('pointerup', start);
$('title').classList.add('ready');
window.__sub = { save, load, texts, setLang, renderer, fauna, S, C, I, U, V, nav, setMode, setSt, table, cabin, tea, LOG, ACT, get target() { return target; }, start, ping, world, life, poisNear, floorH, get frames() { return frames; }, tp(x, y, z, h) { world.update(x, z, Infinity); S.x = x; S.y = y; S.z = z; S.h = h; S.vx = S.vy = S.vz = 0; C.yaw = h; C.oy = C.op = 0; C.pos.set(x - Math.sin(h) * 11, y + 3, z - Math.cos(h) * 11); C.look.set(x, y + 1, z); }, marks, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls, PR, MSAA, chunks: world.chunks.size, near: world.near.length, glows: world.glows.length }) };
// ---------- Entwicklermenü (unter ⚙, Passwort) ----------
const DEV_PW = 'Entwicklung', devEl = $('dev'), pw = $('devPw');
let devOn = false; try { devOn = localStorage.getItem('tiefenlicht.dev') === '1'; } catch (e) { /* egal */ }
$('devBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (devOn) { devEl.classList.toggle('open'); buildDev(); } else { pw.style.display = pw.style.display === 'inline-block' ? 'none' : 'inline-block'; pw.focus(); } });
pw.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { if (pw.value === DEV_PW) { devOn = true; try { localStorage.setItem('tiefenlicht.dev', '1'); } catch (x) { /* egal */ } pw.style.display = 'none'; pw.value = ''; devEl.classList.add('open'); buildDev(); } else { pw.value = ''; pw.placeholder = '✗'; } } });
const DEV_NAMES = ['Laternenschlinger', 'Riesenbarsch', 'Gleiter', 'Hai'];
function devTp(x, z, faceX, faceZ) { const h = faceX === undefined ? S.h : Math.atan2(faceX - x, faceZ - z), y = Math.min(-12, Math.max(floorH(x, z) + 6, faceX === undefined ? S.y : -40)); if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(x, y, z, h); save(); }
function tpTo(x, y, z, h) { world.update(x, z, Infinity); S.x = x; S.y = y; S.z = z; S.h = h; S.vx = S.vy = S.vz = 0; C.yaw = h; C.oy = C.op = 0; C.pos.set(x - Math.sin(h) * 14, y + 4, z - Math.cos(h) * 14); C.look.set(x, y + 1, z); }
function nearest(kind) { let best = null, bd = 1e9; for (const p of poisNear(S.x, S.z, 1500)) { if (p.kind !== kind) continue; const d = Math.hypot(p.x - S.x, p.z - S.z); if (d > 60 && d < bd) { bd = d; best = p; } } if (!best) for (const p of poisNear(S.x, S.z, 1500)) if (p.kind === kind) { best = p; break; } return best; }
function goTo(p) { if (!p) return; const a = Math.atan2(S.x - p.x, S.z - p.z), d = p.kind === 'wreck' ? 38 : 26; devTp(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, p.x, p.z); }
function buildDev() {
  const F = fauna; devEl.innerHTML = '';
  const h3 = (t) => { const e = document.createElement('h3'); e.textContent = t; devEl.appendChild(e); };
  const btn = (label, fn, parent = devEl) => { const b = document.createElement('span'); b.className = 'pill mini'; b.textContent = label; b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); }); parent.appendChild(b); return b; };
  const row = () => { const r = document.createElement('div'); r.className = 'row'; devEl.appendChild(r); return r; };
  h3('LEBEWESEN · ANZAHL UM DAS BOOT');
  DEV_NAMES.forEach((n, si) => { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = F.max[si]; s.step = 1; s.value = F.cfg[si].n; l.textContent = n; v.textContent = s.value;
    s.addEventListener('input', () => { F.setCount(si, +s.value); v.textContent = s.value; devSave(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); });
  { const r = row(), l = document.createElement('span'); l.textContent = 'Haie kommen auf mich zu'; r.appendChild(l); const b = btn(F.attract ? 'an' : 'aus', () => { F.attract = !F.attract; b.textContent = F.attract ? 'an' : 'aus'; devSave(); }, r); }
  h3('VOR DEM BOOT ERSCHEINEN LASSEN'); { const r = row(); r.style.flexWrap = 'wrap'; DEV_NAMES.forEach((n, si) => btn(n, () => F.spawnNear(si, S), r)); }
  h3('HINFAHREN'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Start', () => devTp(cxAt(-86), -86 + 0.001)); btn('Wrack', () => goTo({ x: -300, z: 236, kind: 'wreck' })); btn('Kristallgrotte', () => goTo({ x: 111, z: 63, kind: 'grove' }));
    btn('Kristallhain', () => goTo(nearest('grove'))); btn('Korallengarten', () => goTo(nearest('garden'))); btn('Warmer Spalt', () => goTo(nearest('vent'))); }
  h3('SONSTIGES'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Tee sofort fertig', () => { tea.phase = 'ready'; }, r); btn('Logbuch leeren', () => { LOG.length = 0; seen.clear(); save(); }, r); btn('Menü sperren', () => { devOn = false; try { localStorage.removeItem('tiefenlicht.dev'); } catch (x) { /* egal */ } devEl.classList.remove('open'); }, r); btn('schließen', () => devEl.classList.remove('open'), r); }
}
function devSave() { try { localStorage.setItem('tiefenlicht.devcfg', JSON.stringify({ n: fauna.cfg.map((c) => c.n), attract: fauna.attract })); } catch (e) { /* egal */ } }
try { const d = JSON.parse(localStorage.getItem('tiefenlicht.devcfg') || 'null'); if (d) { d.n.forEach((n, si) => fauna.setCount(si, n)); fauna.attract = !!d.attract; } } catch (e) { /* egal */ }

// ---------- Speichern: automatisch alle paar Sekunden und beim Verlassen ----------
const SAVE_KEY = 'tiefenlicht.save.v1'; let noSave = false;
function save() { if (noSave || !started) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, s: [S.x, S.y, S.z, S.h], log: LOG, seen: [...seen], course: nav.course, lamp: cabin.state.lampT, play: playTime, at: Date.now() })); } catch (e) { /* ohne Speicher */ } }
function load() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d || d.v !== 1 || !Array.isArray(d.s)) return false;
    [S.x, S.y, S.z, S.h] = d.s; C.yaw = S.h; C.pos.set(S.x - Math.sin(S.h) * 14, S.y + 4, S.z - Math.cos(S.h) * 14); C.look.set(S.x, S.y + 1, S.z);
    for (const e of d.log || []) LOG.push(e); for (const k of d.seen || []) seen.add(k); nav.course = d.course || null; cabin.state.lampT = cabin.state.lamp = d.lamp == null ? 1 : d.lamp; playTime = d.play || 0; return true; } catch (e) { return false; }
}
const resumed = load();
setInterval(save, 5000); window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
$('go').dataset.t = resumed ? (PC ? 'go_cont_pc' : 'go_cont') : (PC ? 'go_pc' : 'go'); texts();
world.update(S.x, S.z, Infinity);
requestAnimationFrame(frame);
