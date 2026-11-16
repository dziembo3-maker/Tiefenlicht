// main.js – Ablauf: Eingabe, Fahrverhalten, Kamera, Sonar, Bildaufbau
import { T, clamp, damp, wrapPi, smooth, noiseTexture } from './util.js';
import { U, createBackdrop, createPost } from './gfx.js';
import { floorH, floorN, cxAt, BOUNDS, deepAt, PLAIN, WHALE, BELL, HOLE, PLAT } from './terrain.js';
import { createShaft } from './props.js';
import { createSnow } from './snow.js';
import { createWorld, poisNear } from './world.js';
import { createLife } from './life.js';
import { createFauna } from './fauna.js';
import { t, setLang, getLang } from './i18n.js';
const PC = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
import { createSub, BOATS } from './sub.js';
import { createAudio } from './audio.js';
import { createCabin, SEAT, FLOOR_Y } from './cabin.js';
import { createTable } from './sonartable.js';
import { MISSIONS, HINTED, REACH, createCanisters } from './missions.js';
import { createWhales, choosePod } from './whales.js';
import { createHumpbacks, chooseHumpSpot } from './humpback.js';
import { createDeepLife } from './deeplife.js';
import { createUpgrade, LAMP } from './upgrade.js';
import { addWhaleFigure } from './whalefig.js';
import { createDiver } from './diver.js';
import { createSchools } from './schools.js';
import { createCave, CAVE } from './cave.js';
import { addVitrine } from './vitrine.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.autoClear = true; renderer.info.autoReset = false; renderer.setClearColor(0x021a2c);
const scene = new T.Scene(), camera = new T.PerspectiveCamera(58, 1, 0.3, 700);
U.uNoise.value = noiseTexture(256);
createBackdrop(scene);
let boatKind = 0; try { boatKind = +(localStorage.getItem('tiefenlicht.boat') || 0) || 0; } catch (e) { /* ohne Speicher */ }
const life = createLife(scene), fauna = createFauna(scene), schools = createSchools(scene), world = createWorld(scene, life), post = createPost(renderer), audio = createAudio();
let boat = createSub(scene, boatKind);
createShaft(scene, PLAIN.x + 6, PLAIN.z + 4, -8, PLAIN.floor - 1, 46); const snow = createSnow(scene), cans = createCanisters(scene, world), whales = createWhales(scene), hump = createHumpbacks(scene), deepLife = createDeepLife(scene), diver = createDiver(scene);
const cave = createCave(scene); diver.cave = CAVE;
const cabin = createCabin(), cabinScene = new T.Scene(), camIn = new T.PerspectiveCamera(72, 1, 0.04, 40); cabinScene.add(cabin.group); const vitrine = addVitrine(cabin), whaleFig = addWhaleFigure(cabin), upg = createUpgrade(scene);
cabin.group.traverse((o) => { const p = o.position; if (Math.abs(p.x - 0.83) < 0.005 && Math.abs(p.z - 0.04) < 0.005) { if (o.isSprite) p.set(0.9, 0.82, -0.25); else if (Math.abs(p.y - 0.7725) < 0.005) o.visible = false; } });   // keine lose Seite mehr: neue Seiten kommen direkt ins Logbuch, das dann schimmert
// Ansicht: draußen hinter dem Boot oder drinnen in der Kabine (gehen, am Steuer sitzen, am Sonartisch stehen)
// Menü: beim Start offen; im Spiel öffnet es sich über ❚❚, Esc oder wenn die Maus freigegeben wird – dann ruht die Welt
const M = { open: true, panel: 'main', orb: 2.3, dirty: 60 };
let homeT = 0, quietUnlock = false, hadLock = false, escT = 0, fsT = -1e9, quietT = -1e9; const FS_OK = !!document.fullscreenEnabled;
const V = { mode: 'out', st: 'walk', px: 0, pz: -0.55, yaw: 0, pitch: 0, hx: 0, hy: 1.56, hz: -0.55, bob: 0 }, nav = { course: null };

// ---------- Bildgröße und Güte ----------
const FOV = { in: 64, out: 58 }; try { const f = JSON.parse(localStorage.getItem('tiefenlicht.fov') || '{}'); if (f.in) FOV.in = f.in; if (f.out) FOV.out = f.out; } catch (e) { /* ohne Speicher */ }
let PR = Q.get('q') === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2), MSAA = Q.get('q') === 'low' ? 0 : 4, portrait = false, pxScale = 600;
// Leistung: ein Regler. 0 = frei, 1 = 60 Bilder/s, 2 = 60 und schlichtere Grafik, 3 = 30 und schlichtere Grafik (am kühlsten)
const PERF = [{ cap: 0, lo: false }, { cap: 60, lo: false }, { cap: 60, lo: true }, { cap: 30, lo: true }];
let perf = 1; try { const v = localStorage.getItem('tiefenlicht.perf'); if (v !== null && PERF[+v]) perf = +v; } catch (e) { /* egal */ }
function applyPerf() { const P = PERF[perf], top = Q.get('q') === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2); PR = P.lo ? Math.min(top, 1.25) : top; MSAA = Q.get('q') === 'low' || P.lo ? 0 : 4; }
applyPerf();
function resize() {
  const w = window.innerWidth, h = window.innerHeight; portrait = h > w;
  renderer.setPixelRatio(PR); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = fovFor(V.mode); camera.updateProjectionMatrix(); camIn.aspect = camera.aspect; camIn.fov = camera.fov; camIn.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new T.Vector2()); post.resize(s.x, s.y, MSAA); M.dirty = 60; pxScale = s.y / (2 * Math.tan(camera.fov * Math.PI / 360));
}
window.addEventListener('resize', resize); resize();

// ---------- Sichtfeld (einstellbar, getrennt für draußen und drinnen; gespeichert) ----------
/** Helligkeit des Wassers nach Tiefe: bis etwa 110 m wie bisher, darunter in der großen Tiefsee immer dunkler bis fast schwarz */
function deepK(y) { const k = Math.exp((y + 32) * 0.0085); return y > -110 ? clamp(k, 0.5, 1.12) : 0.515 * Math.exp((y + 110) * 0.011); }
function fovFor(m) { const p = window.innerHeight > window.innerWidth; const fp = m === 'in' || m === 'dive'; return (fp ? FOV.in : FOV.out) + (p ? (fp ? 14 : 22) : 0); }
// ---------- Zustand ----------
const S = { x: cxAt(-86), y: -55, z: -86, h: 0.12, vx: 0, vy: 0, vz: 0, yawV: 0, roll: 0, pitch: 0, thrust: 0, prop: 0 };
const C = { yaw: 0.12, oy: 0, op: 0, dist: 11, pos: new T.Vector3(S.x, S.y + 3, S.z - 11), idle: 9, look: new T.Vector3() };
const I = { jx: 0, jy: 0, up: 0, down: 0, joyId: null, lookId: null, ox: 0, oy: 0, lx: 0, ly: 0, keys: {} };
let started = false, frames = 0, tNote = 0;

// ---------- Eingabe ----------
const joy = $('joy'), knob = $('knob'), JR = 54;
function setJoy(dx, dy) { const l = Math.hypot(dx, dy), k = l > JR ? JR / l : 1; dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.min(1, Math.hypot(dx, dy) / JR), dz = m < 0.1 ? 0 : (m - 0.1) / 0.9, a = Math.atan2(dy, dx); I.jx = Math.cos(a) * dz; I.jy = Math.sin(a) * dz; }
window.addEventListener('pointerdown', (e) => {
  if (!started || M.open) return;
  if (e.target.closest && e.target.closest('.btn,.pill,#sonar,#table,#menu,#log,#dev,#tapes,#camUI,#horch,#photoBig')) return; if (V.st === 'table' && V.mode === 'in' && !CAMV.on) return;
  if (CAMV.on) {   // im Sucher: jeder Finger sieht sich um; mit gefangener Maus löst ein Klick aus
    if (e.pointerType === 'mouse' && lockOK && e.target === canvas) { if (document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (x) { /* egal */ } } else if (e.button === 0) shoot(); return; }
    if (I.lookId === null) { I.lookId = e.pointerId; I.lx = e.clientX; I.ly = e.clientY; } return;
  }
  if (e.pointerType === 'mouse') {
    if (lockOK && e.target === canvas && !devOpen()) { if (document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { if (!hadLock) lockOK = false; else grabEl.style.opacity = 1; }); } catch (x) { if (!hadLock) lockOK = false; } } else if (e.button === 2 && V.mode !== 'dive') ping(); return; }
    if (I.lookId === null) { I.lookId = e.pointerId; I.lx = e.clientX; I.ly = e.clientY; } return;   // ohne Mausfang: Ziehen = umsehen
  }
  if (e.clientX < window.innerWidth * 0.5 && I.joyId === null) { I.joyId = e.pointerId; I.ox = e.clientX; I.oy = e.clientY; joy.style.left = e.clientX + 'px'; joy.style.top = e.clientY + 'px'; joy.style.opacity = 1; setJoy(0, 0); }
  else if (I.lookId === null) { I.lookId = e.pointerId; I.lx = e.clientX; I.ly = e.clientY; }
});
let lockOK = !!canvas.requestPointerLock; if (PC) document.body.classList.add('pc');
document.addEventListener('pointerlockerror', () => { if (!hadLock) lockOK = false; grabEl.style.opacity = started && PC && !M.open ? 1 : 0; });
document.addEventListener('pointerlockchange', () => { const locked = document.pointerLockElement === canvas; if (locked) hadLock = true;
  grabEl.style.opacity = locked || !started || !PC || M.open ? 0 : 1;
  if (!locked && started && !M.open && !quietUnlock && performance.now() - fsT > 1500 && performance.now() - quietT > 600) { escT = performance.now(); if (CAMV.on) closeCam(); else openMenu(); }   // Esc gibt die Maus frei: das Menü geht auf (im Sucher: Sucher zu)
  if (!locked) quietUnlock = false; });
function unlock() { if (document.pointerLockElement) { quietUnlock = true; quietT = performance.now(); document.exitPointerLock(); } }   // quietT: manche Browser melden das Freigeben doppelt
function lockMouse() { if (!PC || !lockOK || document.pointerLockElement === canvas || devOpen()) return; try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { grabEl.style.opacity = 1; }); } catch (x) { /* egal */ } }
const grabEl = $('grab');
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement !== canvas) return; const dx = e.movementX || 0, dy = e.movementY || 0; if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
  if (CAMV.on) { CAMV.yaw = clamp(CAMV.yaw - dx * 0.0022, -2.6, 2.6); CAMV.pitch = clamp(CAMV.pitch - dy * 0.002, -1.2, 1.2); } else if (V.mode === 'dive') { diver.yaw -= dx * 0.0024; diver.pitch = clamp(diver.pitch - dy * 0.002, -1.2, 1.2); } else if (V.mode === 'in') { V.yaw -= dx * 0.0026; V.pitch = clamp(V.pitch - dy * 0.0022, -1.25, 1.25); } else { C.oy -= dx * 0.003; C.op = clamp(C.op + dy * 0.0024, -1.15, 1.1); C.idle = 0; } });
window.addEventListener('pointermove', (e) => {
  if (e.pointerId === I.joyId) setJoy(e.clientX - I.ox, e.clientY - I.oy);
  else if (e.pointerId === I.lookId) { const dx = e.clientX - I.lx, dy = e.clientY - I.ly; I.lx = e.clientX; I.ly = e.clientY; if (CAMV.on) { CAMV.yaw = clamp(CAMV.yaw - dx * 0.0045, -2.6, 2.6); CAMV.pitch = clamp(CAMV.pitch - dy * 0.0038, -1.2, 1.2); } else if (V.mode === 'dive') { diver.yaw -= dx * 0.0048; diver.pitch = clamp(diver.pitch - dy * 0.004, -1.2, 1.2); } else if (V.mode === 'in') { V.yaw -= dx * 0.0052; V.pitch = clamp(V.pitch - dy * 0.0042, -1.25, 1.25); } else { C.oy -= dx * 0.0055; C.op = clamp(C.op + dy * 0.004, -1.15, 1.1); C.idle = 0; } }
});
const release = (e) => { if (e.pointerId === I.joyId) { I.joyId = null; I.jx = I.jy = 0; joy.style.opacity = 0; knob.style.transform = ''; } if (e.pointerId === I.lookId) I.lookId = null; };
window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
// Druckgefühl: jeder Knopf hellt sich beim Drücken weißlich auf, mindestens kurz, damit man auch schnelle Tipper sieht
const PRESS = '.pill,.mb,.btn,.boatCard,.tRow:not(.hid),#tBtns span,#scope,#camShut', pressed = new Map();
window.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest(PRESS); if (!el) return; el.classList.add('press'); pressed.set(e.pointerId, { el, t: performance.now() }); }, true);
const unpress = (e) => { const p = pressed.get(e.pointerId); if (!p) return; pressed.delete(e.pointerId); setTimeout(() => p.el.classList.remove('press'), Math.max(0, 130 - (performance.now() - p.t))); };
window.addEventListener('pointerup', unpress, true); window.addEventListener('pointercancel', unpress, true);
for (const [id, key] of [['up', 'up'], ['down', 'down']]) {
  const b = $(id), on = (e) => { e.preventDefault(); I[key] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } }, off = () => { I[key] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
}
window.addEventListener('keydown', (e) => { I.keys[e.code] = 1; }); window.addEventListener('keyup', (e) => { I.keys[e.code] = 0; if (e.code === 'Escape' && relockEsc) { relockEsc = false; lockMouse(); } });
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.suspend(); if (started) openMenu(); } else if (!M.open) audio.resume(); });

// ---------- Sonar: der Strahl kreist von selbst und zeigt nahe Wände; ein Ping reicht weit und holt Echos von Fundstellen ----------
const scope = $('scope'), sc = scope.getContext('2d'), SR = 60, PING = 480, blips = [], marks = [], echoes = [], sectors = [];
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
  for (let i = echoes.length - 1; i >= 0; i--) {
    const e = echoes[i]; e.t -= dt; if (e.t > 0) continue; echoes.splice(i, 1); audio.echo(e.vol, clamp(Math.sin(wrapPi(S.h - Math.atan2(e.x - S.x, e.z - S.z))), -1, 1) * 0.8);
    if (e.sector) { sectors.length = 0; sectors.push({ th: e.th, half: e.half, life: 1 }); continue; }
    if (!e.gold && marks.some((m) => m.gold && Math.hypot(m.x - e.x, m.z - e.z) < 6)) continue;   // das Missionsziel bleibt golden, auch wenn an derselben Stelle ein Fundort antwortet
    for (let j = marks.length - 1; j >= 0; j--) if (Math.hypot(marks[j].x - e.x, marks[j].z - e.z) < (e.gold ? 6 : 0.01)) marks.splice(j, 1); marks.push({ x: e.x, z: e.z, life: 1, born: U.uTime.value, gold: !!e.gold });
  }
  for (let i = marks.length - 1; i >= 0; i--) { marks[i].life -= dt / 75; if (marks[i].life <= 0) marks.splice(i, 1); }
  for (let i = sectors.length - 1; i >= 0; i--) { sectors[i].life -= dt / 12; if (sectors[i].life <= 0) sectors.splice(i, 1); }
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
    const q = rel(m.x, m.z), d = Math.hypot(q[0], q[1]), al = Math.min(1, m.life * 4) * (0.6 + 0.4 * Math.sin((U.uTime.value - m.born) * 3)); sc.fillStyle = m.gold ? `rgba(255,205,110,${al})` : `rgba(200,255,220,${al})`; sc.shadowColor = m.gold ? '#ffb040' : '#6fffa0'; sc.shadowBlur = 16;
    if (d < SR - 5) { const px = c + q[0] * k, py = c - q[1] * k, s = 9; sc.beginPath(); sc.moveTo(px, py - s); sc.lineTo(px + s * 0.7, py); sc.lineTo(px, py + s); sc.lineTo(px - s * 0.7, py); sc.closePath(); sc.fill(); }
    else { const ux = q[0] / d, uy = -q[1] / d, s = 13 - 6 * Math.min(1, d / PING), px = c + ux * (R - 4), py = c + uy * (R - 4); sc.beginPath(); sc.moveTo(px, py); sc.lineTo(px - ux * s * 1.9 - uy * s * 0.75, py - uy * s * 1.9 + ux * s * 0.75); sc.lineTo(px - ux * s * 1.9 + uy * s * 0.75, py - uy * s * 1.9 - ux * s * 0.75); sc.closePath(); sc.fill(); }
    sc.shadowBlur = 0;
  }
  for (const s of sectors) {   // Missionsdose: ein goldener Fächer am Rand; die Dose liegt irgendwo darin, nicht unbedingt in der Mitte
    const al = Math.min(1, s.life * 3), ph = -Math.PI / 2 - wrapPi(s.th - S.h);
    sc.fillStyle = `rgba(255,190,80,${0.3 * al})`; sc.beginPath(); sc.arc(c, c, R, ph - s.half, ph + s.half); sc.arc(c, c, R - 18, ph + s.half, ph - s.half, true); sc.closePath(); sc.fill();
    sc.strokeStyle = `rgba(255,214,130,${0.9 * al})`; sc.lineWidth = 4; sc.beginPath(); sc.arc(c, c, R - 2, ph - s.half, ph + s.half); sc.stroke();
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
  const l = misTarget(); if (l) {   // Ziel der Mission: aus der Ferne nur als Fächer in seiner Richtung, der mit der Nähe schmaler wird; in Sonarreichweite als genaue Raute
    const i = misIdx(MS.active), d = Math.hypot(l.x - S.x, l.z - S.z), half = clamp(d / 10, 8, 45) * Math.PI / 180;
    if (d < SR - 5) { sectors.length = 0; echoes.push({ x: l.x, z: l.z, t: 0.3 + d / 85, vol: 1, gold: true }); }   // im Sonarbild: kein Fächer mehr, das Ziel selbst als goldene Raute
    else echoes.push({ sector: true, th: Math.atan2(l.x - S.x, l.z - S.z) + (MS.stage === 'bell' ? 0.35 : MISSIONS[i].off || 0.6) * half, half, x: l.x, z: l.z, t: 0.3 + Math.min(d, 600) / 85, vol: 0.55 });
  }
}
$('sonar').addEventListener('pointerdown', (e) => { e.preventDefault(); if (started && !M.open) ping(); });

// ---------- Fahren ----------
/** Hindernisse in der Nähe: Felsen und Säulen aus der Welt, dazu die schlafenden Wale, wenn man bei ihnen ist */
const sphBuf = []; function nearSpheres() { const w = whales.list.length && Math.hypot(whales.list[0].x - S.x, whales.list[0].z - S.z) < 140, hc = hump.spheres.length && Math.hypot(hump.src.x - S.x, hump.src.z - S.z) < 160; if (!w && !hc) return world.near;
  sphBuf.length = 0; for (const s of world.near) sphBuf.push(s); if (w) for (const s of whales.spheres) sphBuf.push(s); if (hc) for (const s of hump.spheres) sphBuf.push(s); return sphBuf; }
const nT = { x: 0, y: 0, z: 0 }, CLEAR = 3.9, SOFT = 1.2; let gateT = 0; const tr = (k) => t(k);   // in drive() heißt t die Zeit
function props(dt) {   // Steuerrad, Tiefenruder, Tee: laufen immer mit, auch wenn man draußen ist
  cabin.state.suit = suitState(); cabin.state.heading = S.h;
  const st = cabin.state; st.wheel += (S.yawV / 0.72 * 1.4 - st.wheel) * Math.min(1, dt * 5); st.lever += (-S.vy / 3.3 * 0.55 - st.lever) * Math.min(1, dt * 5);
  for (const p of boat.planes) p.rotation.x = -S.vy / 3.3 * 0.45 + st.lever * 0;
  if (tea.phase === 'heat') { tea.t += dt; if (tea.t > 22) tea.phase = 'ready'; } else if (tea.phase === 'cool') { tea.t += dt; if (tea.t > 30) { tea.phase = 'cold'; tea.t = 0; } }
  st.boil = tea.phase === 'heat' ? Math.min(1, tea.t / 22) : tea.phase === 'ready' ? 1 : tea.phase === 'cool' ? Math.max(0, 1 - tea.t / 20) : 0; audio.kettle(V.mode === 'in' ? st.boil : st.boil * 0.3);
  if (st.cupHeat > 0 && st.cup !== 'none') st.cupHeat = Math.max(0.0, st.cupHeat - dt / 240);
  if (frames % 30 === 0) discover();
}
function drive(dt) {
  const ctl = !CAMV.on && !horchOpen && !logOpen() && (V.mode === 'out' || V.st === 'seat'), K = ctl ? I.keys : {}; let jx = ctl ? I.jx : 0, jy = ctl ? I.jy : 0;
  if (K.KeyA || K.ArrowLeft) jx -= 1; if (K.KeyD || K.ArrowRight) jx += 1; if (K.KeyW || K.ArrowUp) jy -= 1; if (K.KeyS || K.ArrowDown) jy += 1;
  const mag = Math.min(1, Math.hypot(jx, jy)), vIn = ctl ? (I.up || K.Space ? 1 : 0) - (I.down || K.ShiftLeft || K.ShiftRight ? 1 : 0) : 0;
  let want = 0, thrust = 0;
  if (mag > 0.05) { const diff = wrapPi((V.mode === 'out' ? C.yaw + C.oy - S.h : 0) - Math.atan2(jx, -jy)); want = clamp(diff * 1.4, -0.72, 0.72) * (0.4 + 0.6 * mag); thrust = mag * clamp(Math.cos(diff) * 1.15 + 0.1, 0.12, 1); }
  S.yawV = damp(S.yawV, want, 2.6, dt); S.h = wrapPi(S.h + S.yawV * dt); S.thrust = damp(S.thrust, thrust, 2.2, dt);
  const fx = Math.sin(S.h), fz = Math.cos(S.h);
  let vf = S.vx * fx + S.vz * fz, vl = S.vx * fz - S.vz * fx;                 // längs und quer zum Boot
  vf += (S.thrust * 3.9 - vf * 0.55) * dt; vl -= vl * Math.min(1, 1.7 * dt);
  S.vx = fx * vf + fz * vl; S.vz = fz * vf - fx * vl;
  const DEEP = devDeep ? -2000 : MS.done.includes('m7') ? -450 : deepAt(S.x, S.z); let vyT = vIn * 3.3; if (S.y < DEEP + 7 && vyT < 0) vyT *= smooth(DEEP, DEEP + 7, S.y);
  S.vy = damp(S.vy, vyT, 1.5, dt);
  S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;
  // Abstand zum Grund und zu den Wänden: weich federnd, darunter fest
  for (const o of [0, 2, -2]) {
    const px = S.x + fx * o, pz = S.z + fz * o, h = floorH(px, pz); floorN(px, pz, nT);
    const pen = (h + CLEAR - S.y) * nT.y;
    if (pen > 0) { const mv = Math.max(pen - SOFT, 0) + Math.min(pen, SOFT) * Math.min(1, 3.5 * dt); S.x += nT.x * mv; S.y += nT.y * mv; S.z += nT.z * mv; const vn = S.vx * nT.x + S.vy * nT.y + S.vz * nT.z; if (vn < 0) { const k = Math.min(1, (2 + pen * 6) * dt); S.vx -= nT.x * vn * k; S.vy -= nT.y * vn * k; S.vz -= nT.z * vn * k; } }
  }
  const nearLamp = Math.hypot(S.x - LAMP.x, S.z - LAMP.z) < 45;
  for (const s of nearLamp ? nearSpheres().concat(upg.blockers) : nearSpheres()) {
    const dx = S.x - s.x, dy = S.y - s.y, dz = S.z - s.z, min = s.r + 2.5; if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(dy) > min) continue;
    const d = Math.hypot(dx, dy, dz); if (d >= min || d < 0.001) continue;
    const pen = min - d, mv = Math.max(pen - 0.6, 0) + Math.min(pen, 0.6) * Math.min(1, 5 * dt), nx = dx / d, ny = dy / d, nz = dz / d; S.x += nx * mv; S.y += ny * mv; S.z += nz * mv;
    const vn = S.vx * nx + S.vy * ny + S.vz * nz; if (vn < 0) { const k = Math.min(1, 8 * dt); S.vx -= nx * vn * k; S.vy -= ny * vn * k; S.vz -= nz * vn * k; }
  }
  // Loch-Mission: erst das Loch am Sonartisch markieren, dann darf man wegfahren
  if (MS.active === 'm5' && MS.stage === 'mark') { const dx = S.x - HOLE.x, dz = S.z - HOLE.z, d = Math.hypot(dx, dz); if (d > 40) { const ux = dx / d, uz = dz / d, k = Math.min(1, (d - 40) / 10), vo = S.vx * ux + S.vz * uz; if (vo > 0) { S.vx -= ux * vo * k * Math.min(1, 6 * dt); S.vz -= uz * vo * k * Math.min(1, 6 * dt); } S.vx -= ux * k * 3 * dt; S.vz -= uz * k * 3 * dt; if (gateT <= 0) { note(tr('m5_gate')); gateT = 5; } } }
  if (gateT > 0) gateT -= dt;
  // Rand der Probe: sanft zurückdrücken
  const rad = Math.hypot(S.x, S.z); if (rad > BOUNDS.r) { const o = (rad - BOUNDS.r) * 0.8 * dt / rad; S.vx -= S.x * o; S.vz -= S.z * o; }
  if (S.y > BOUNDS.top) { S.y = damp(S.y, BOUNDS.top, 3, dt); if (S.vy > 0) S.vy *= 1 - Math.min(1, 4 * dt); }
  if (S.y < DEEP) { S.y = damp(S.y, DEEP, 2, dt); }
  if (S.y < DEEP + 3 && vIn < 0) tNote = 3.5;
  S.roll = damp(S.roll, -S.yawV * 0.42, 2.5, dt); S.pitch = damp(S.pitch, -S.vy * 0.07 - S.thrust * 0.02, 2.5, dt);
  const t = U.uTime.value, g = boat.group;
  g.position.set(S.x, S.y + Math.sin(t * 0.7) * 0.07, S.z); g.rotation.set(S.pitch + Math.sin(t * 0.53) * 0.012, S.h, S.roll + Math.sin(t * 0.61) * 0.018);
  S.prop += dt * (1.5 + S.thrust * 22); boat.prop.rotation.z = S.prop;
  boat.halo.material.opacity = 0.46 + 0.05 * Math.sin(t * 1.7);
  g.updateMatrixWorld(true);
  U.uSubPos.value.set(S.x, S.y, S.z); U.uSubA.value.set(0, 0, boat.body.z0).applyMatrix4(g.matrixWorld); U.uSubB.value.set(0, 0, boat.body.z1).applyMatrix4(g.matrixWorld); U.uLampPos.value.copy(boat.lampLocal).applyMatrix4(g.matrixWorld); U.uWarmPos.value.copy(boat.warmLocal).applyMatrix4(g.matrixWorld);
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
  if (homeT > 0) { homeT -= dt; C.oy = damp(C.oy, 0, 2.2, dt); C.op = damp(C.op, 0, 2.2, dt); }
  const yaw = C.yaw + C.oy, pit = clamp(0.27 + C.op, -1.0, 1.25), cp = Math.cos(pit), D = (portrait ? 17 : 14) * (M.open && M.panel === 'boat' ? (portrait ? 0.85 : 0.8) : 1);
  dir.set(Math.sin(yaw) * cp, -Math.sin(pit), Math.cos(yaw) * cp);
  tgt.set(S.x + Math.sin(yaw) * 2.4 * cp, S.y + 1.0, S.z + Math.cos(yaw) * 2.4 * cp);
  let tMax = 1;
  for (let i = 1; i <= 8; i++) { const t = i / 8, px = tgt.x - dir.x * D * t, py = tgt.y - dir.y * D * t, pz = tgt.z - dir.z * D * t; if (floorH(px, pz) + 1.4 > py) { tMax = Math.max(0.2, (i - 1) / 8); break; } }
  const dT = D * tMax; C.dist = damp(C.dist, dT, dT < C.dist ? 9 : 1.2, dt);
  want.copy(tgt).addScaledVector(dir, -C.dist);
  C.pos.x = damp(C.pos.x, want.x, 7, dt); C.pos.y = damp(C.pos.y, want.y, 7, dt); C.pos.z = damp(C.pos.z, want.z, 7, dt);
  for (const s of nearSpheres()) { const dx = C.pos.x - s.x, dy = C.pos.y - s.y, dz = C.pos.z - s.z, min = s.r + 0.9; if (Math.abs(dx) > min || Math.abs(dy) > min || Math.abs(dz) > min) continue; const d = Math.hypot(dx, dy, dz); if (d < min && d > 0.001) { const k = (min - d) / d; C.pos.x += dx * k; C.pos.y += dy * k; C.pos.z += dz * k; } }
  C.pos.y = clamp(C.pos.y, floorH(C.pos.x, C.pos.z) + 1.1, -1.5);
  C.look.x = damp(C.look.x, tgt.x, 9, dt); C.look.y = damp(C.look.y, tgt.y, 9, dt); C.look.z = damp(C.look.z, tgt.z, 9, dt);
  camera.position.copy(C.pos); camera.lookAt(C.look);
  U.uDeep.value = deepK(C.pos.y);
}
C.look.set(S.x, S.y + 1, S.z + 2);

// ---------- Kabine: Ego-Perspektive ----------
const HOLE_P = { x: HOLE.x, z: HOLE.z, kind: 'hole', always: true }, table = createTable(S, nav, $('tableCv'), () => sectors[0], () => (MS.done.includes('m5') || (MS.active === 'm5' && MS.stage) ? [HOLE_P] : []), (p) => (p.kind === 'hole' ? t('s_hole') : devReveal || seen.has(Math.round(p.x) + ',' + Math.round(p.z)) ? t('s_' + (p.short || p.kind)) : null), () => t('compass')), eyeL = new T.Vector3(), winCol = new T.Vector3(), tmpS = new T.Vector3(), fadeEl = $('fade'), actEl = $('act'), modeEl = $('mode');
let switching = false;
function ui() { document.body.className = (V.mode === 'in' ? 'in ' + V.st : V.mode === 'dive' ? 'dive' : 'out') + (PC ? ' pc' : '') + (FS_OK ? ' fs' : '') + (M.open ? ' menu' : '') + (CAMV.on ? ' cam' : ''); $('modeL').textContent = V.mode === 'in' ? t('to_out') : t('to_in'); fsPlace(); }
function applyMode() {
  const inn = V.mode === 'in', dive = V.mode === 'dive'; boatVis();
  if (inn && MS.fresh >= 0 && started) setTimeout(() => note(t('page_new')), 1200);
  if (inn) { const mm = V.mem; V.mem = null; if (mm) { V.st = mm.st; V.px = V.hx = mm.px; V.pz = V.hz = mm.pz; V.hy = mm.st === 'seat' ? SEAT.y : 1.56; V.yaw = mm.yaw; V.pitch = mm.pitch; } else { V.st = 'walk'; V.px = 0; V.pz = -0.95; V.yaw = 0; V.pitch = 0; V.hx = 0; V.hy = 1.56; V.hz = -0.95; } table.reset(); if (!PC) { hintEl.textContent = t('hint_in_touch'); hintEl.style.opacity = 1; hintT = 6; } }   // zurück, wo man vor dem Hinausschauen war (am Steuer: man fährt einfach weiter)if (!PC) { hintEl.textContent = t('hint_in_touch'); hintEl.style.opacity = 1; hintT = 6; } }
  else if (dive) { hintEl.textContent = t(PC ? 'dive_hint_pc' : 'dive_hint_touch'); hintEl.style.opacity = 1; hintT = 9; }
  else { if (hintEl.textContent === t('hint_in_touch') || hintEl.textContent === t('dive_hint_touch') || hintEl.textContent === t('dive_hint_pc')) { hintEl.style.opacity = 0; hintT = 0; } C.yaw = S.h; C.oy = C.op = 0; C.dist = 14; C.pos.set(S.x - Math.sin(S.h) * 14, S.y + 4, S.z - Math.cos(S.h) * 14); C.look.set(S.x, S.y + 1, S.z); }
  if (!inn && !dive) sonHint(); audio.setInside(inn); audio.setSuit(dive); U.uLampOn.value = (dive ? 0.5 : 1) * (1 + (devLamp - 1) * 0.35); lampApply(); world.setSmall(!inn); life.setInside(inn); cabin.state.suit = suitState(); ui(); resize(); syncFov(); if (dive) drawHelmet();
}
function setMode(m) { closeTapes(); closeHorch(); if (CAMV.on) closeCam(true); if (switching || !started || V.mode === m) return; switching = true; if (V.mode === 'in' && m === 'out') V.mem = { st: V.st === 'table' ? 'walk' : V.st, px: V.st === 'table' ? -0.15 : V.px, pz: V.st === 'table' ? -1.3 : V.pz, yaw: V.yaw, pitch: V.pitch }; fadeEl.style.opacity = 1; setTimeout(() => { V.mode = m; applyMode(); fadeEl.style.opacity = 0; switching = false; }, 330); }
// ---------- Taucheranzug: durch die Luke hinaus, am Schlauch über den Grund gehen, am Heck wieder hinein ----------
let devDeep = false, devReveal = false, devLamp = 1; try { devDeep = localStorage.getItem('tiefenlicht.devdeep') === '1'; devReveal = localStorage.getItem('tiefenlicht.devreveal') === '1'; devLamp = clamp(+(localStorage.getItem('tiefenlicht.devlamp') || 1) || 1, 1, 5); } catch (e) { /* egal */ }   // Entwicklerschalter: ohne Tiefengrenze
let devSuit = false, nearHatch = false, nearTooth = false, nearBell = false, nearLampItem = false, tightT = 0; try { devSuit = localStorage.getItem('tiefenlicht.devsuit') === '1'; } catch (e) { /* egal */ }
const hasSuit = () => !!(MS.suit || devSuit), suitState = () => (!hasSuit() ? 0 : V.mode === 'dive' ? 2 : 1);
const hoseA = new T.Vector3(), bodyS = [0, 1, 2, 3, 4].map(() => ({ x: 0, y: 0, z: 0, r: 1 })), tv2 = new T.Vector3();
function boatSpheres() { const b = boat.body; for (let k = 0; k < 5; k++) { const z = b.z0 + 0.35 + (b.z1 - b.z0 - 0.5) * k / 4; tv2.set(0, 0, z).applyMatrix4(boat.group.matrixWorld); const s = bodyS[k]; s.x = tv2.x; s.y = tv2.y; s.z = tv2.z; s.r = b.r * 1.35 * (k === 0 ? 0.7 : 0.95); } return bodyS; }
function suitOut() {
  if (switching || !started || !hasSuit() || V.mode !== 'in') return; closeTapes(); closeHorch(); V.mem = null; if (V.st !== 'walk') V.st = 'walk'; switching = true; fadeEl.style.opacity = 1; audio.hatch();
  setTimeout(() => { boat.group.updateMatrixWorld(true); hoseA.copy(boat.hoseLocal).applyMatrix4(boat.group.matrixWorld); const e = new T.Vector3(3.2, -0.5, -0.9).applyMatrix4(boat.group.matrixWorld);
    e.y = Math.max(e.y, floorH(e.x, e.z) + 1.75); diver.enter(e, S.h + 0.97, hoseA); V.mode = 'dive'; applyMode(); fadeEl.style.opacity = 0; switching = false; lockMouse(); }, 480);
}
function suitIn() {
  if (switching || V.mode !== 'dive') return; switching = true; fadeEl.style.opacity = 1; audio.hatch();
  setTimeout(() => { diver.exit(); V.mode = 'in'; applyMode(); V.px = V.hx = 0; V.pz = V.hz = -1.45; V.yaw = 0; V.pitch = 0; fadeEl.style.opacity = 0; switching = false;
    if (MS.active === 'm5' && MS.stage === 'tooth') setTimeout(() => finishMission(MISSIONS[misIdx('m5')]), 1100);
    if (MS.active === 'm7' && MS.stage === 'lampback') lampAboard(); }, 480);
}
function diveStep(dt) {
  const K = I.keys; let mx = I.jx, my = I.jy; if (K.KeyA || K.ArrowLeft) mx -= 1; if (K.KeyD || K.ArrowRight) mx += 1; if (K.KeyW || K.ArrowUp) my -= 1; if (K.KeyS || K.ArrowDown) my += 1;
  const up = !!(I.up || K.Space), down = !!(I.down || K.ShiftLeft || K.ShiftRight);
  hoseA.copy(boat.hoseLocal).applyMatrix4(boat.group.matrixWorld);
  const e = diver.update(dt, { mx, my, up, down }, hoseA, nearSpheres(), boatSpheres());
  audio.valve(up ? 1 : down ? 0.6 : 0); if (e.step) audio.step(e.step);
  if (e.exhale) { audio.exhale(); helmetExhale(); life.emit(diver.x - Math.cos(diver.yaw) * 0.28, diver.y + 0.1, diver.z + Math.sin(diver.yaw) * 0.28, 0, 0.4, 0, 12 / Math.max(dt, 1e-3), dt); }
  if (e.end && noteT <= 0 && tNote <= 0) note(t('hose_end'));
  diver.draw(); diver.camera(camera, pxScale); diver.lamp(U.uLampPos.value, U.uLampDir.value);
  U.uDeep.value = deepK(diver.y);
  nearHatch = hullGap() < 4.5;   // einsteigen geht vom ganzen Rumpf aus, auch von unten, bis gut 4 m Abstand
  U.uLampOn.value = (0.5 + 0.45 * CAVE.depthK(diver.x, diver.y, diver.z)) * (1 + (devLamp - 1) * 0.35);   // in der Höhle dreht man die Helmlampe auf
  const tt = CAVE.tooth, cv = MS.active === 'm5' && MS.stage === 'cave', dT = Math.hypot(diver.x - tt.x, diver.y - 1.2 - tt.y, diver.z - tt.z), dC = Math.hypot(diver.x - CAVE.can.x, diver.y - 1.2 - CAVE.can.y, diver.z - CAVE.can.z);
  nearTooth = cv && Math.min(dT, dC) < 2.4; nearCan2 = false;   // Zahn und Dose: ein Griff für beides
  nearLampItem = MS.active === 'm7' && MS.stage === 'lamp' && Math.hypot(diver.x - LAMP.x, diver.y - 1.3 - LAMP.y, diver.z - LAMP.z) < 2.6;
}
/** kleinster Abstand zwischen Taucher (senkrechte Strecke Füße bis Helm) und Rumpf (Strecke entlang der Bootsachse), abzüglich Rumpfradius */
const hA = new T.Vector3(), hB = new T.Vector3();
function hullGap() {
  const b = boat.body; hA.set(0, 0, b.z0).applyMatrix4(boat.group.matrixWorld); hB.set(0, 0, b.z1).applyMatrix4(boat.group.matrixWorld);
  const p0 = [diver.x, diver.y - 1.72, diver.z], d1 = [0, 2.02, 0], d2 = [hB.x - hA.x, hB.y - hA.y, hB.z - hA.z], r = [p0[0] - hA.x, p0[1] - hA.y, p0[2] - hA.z];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), c = dot(d1, r), bb = dot(d1, d2), den = a * e - bb * bb;
  let s = den > 1e-6 ? clamp((bb * f - c * e) / den, 0, 1) : 0, t = (bb * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((bb - c) / a, 0, 1); }
  return Math.hypot(p0[0] + d1[0] * s - hA.x - d2[0] * t, p0[1] + d1[1] * s - hA.y - d2[1] * t, p0[2] + d1[2] * s - hA.z - d2[2] * t) - b.r;
}
// Helm: runder Ausschnitt mit Messingrand und Bolzen, links und rechts angeschnitten die Seitenfenster mit Gitter; beim Ausatmen beschlägt das Glas kurz und Blasen steigen am Rand auf
const helmEl = $('helmet'), helmFog = $('helmetFog'), helmBub = $('helmetBub'); let helmR = 200, helmC = [0, 0];
function drawHelmet() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5), W = Math.round(window.innerWidth * dpr), H = Math.round(window.innerHeight * dpr); helmEl.width = W; helmEl.height = H;
  const x = helmEl.getContext('2d'), cx = W / 2, cy = H / 2, R = W > H ? Math.min(H * 0.53, W * 0.3) : W * 0.49, side = [[cx - R * 1.78, cy + R * 0.08, R * 0.56], [cx + R * 1.78, cy + R * 0.08, R * 0.56]], topW = [cx, cy - R * 1.42, R * 0.3];
  helmR = R / dpr; helmC = [cx / dpr, cy / dpr]; const all = [[cx, cy, R], ...side, topW];
  // Helminneres: fast schwarz, warm, um die Fenster ein Kupferschimmer
  x.fillStyle = '#070403'; x.fillRect(0, 0, W, H);
  for (const [px, py, r] of all) { const g = x.createRadialGradient(px, py, r, px, py, r * 1.9); g.addColorStop(0, 'rgba(120,62,28,0.42)'); g.addColorStop(0.35, 'rgba(60,30,14,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  // Fenster ausschneiden
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000'; for (const [px, py, r] of all) { x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.fill(); } x.globalCompositeOperation = 'source-over';
  // Seitenfenster und oberes Fenster: dunkler, mit Gitterstäben
  for (const [px, py, r] of [...side, topW]) { x.save(); x.beginPath(); x.arc(px, py, r, 0, 6.2832); x.clip(); x.fillStyle = 'rgba(4,3,2,0.45)'; x.fillRect(px - r, py - r, 2 * r, 2 * r);
    const g = x.createRadialGradient(px, py, r * 0.55, px, py, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)'); x.fillStyle = g; x.fillRect(px - r, py - r, 2 * r, 2 * r);
    x.fillStyle = '#2a1a0c'; for (const k of [-0.4, 0, 0.4]) x.fillRect(px - r, py + k * r - r * 0.045, 2 * r, r * 0.09); x.fillRect(px - r * 0.045, py - r, r * 0.09, 2 * r); x.restore(); }
  // Hauptfenster: Schatten am Rand, beschlagener unterer Rand
  x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.clip();
  let g = x.createRadialGradient(cx, cy, R * 0.72, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = g; x.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  g = x.createLinearGradient(0, cy + R * 0.45, 0, cy + R); g.addColorStop(0, 'rgba(210,225,228,0)'); g.addColorStop(1, 'rgba(210,225,228,0.1)'); x.fillStyle = g; x.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  x.restore();
  // Messingrahmen mit Bolzen
  const ring = (px, py, r0, r1, bolts) => { const lg = x.createLinearGradient(px - r1, py - r1, px + r1, py + r1); lg.addColorStop(0, '#d7a75a'); lg.addColorStop(0.35, '#8a5e26'); lg.addColorStop(0.6, '#4a2f12'); lg.addColorStop(1, '#a87a38');
    x.fillStyle = lg; x.beginPath(); x.arc(px, py, r1, 0, 6.2832); x.arc(px, py, r0, 0, 6.2832, true); x.fill();
    const sg = x.createRadialGradient(px, py, r0, px, py, r1); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(0.3, 'rgba(0,0,0,0)'); sg.addColorStop(0.8, 'rgba(255,220,160,0.08)'); sg.addColorStop(1, 'rgba(0,0,0,0.6)'); x.fillStyle = sg; x.beginPath(); x.arc(px, py, r1, 0, 6.2832); x.arc(px, py, r0, 0, 6.2832, true); x.fill();
    for (let k = 0; k < bolts; k++) { const a = (k + 0.5) / bolts * 6.2832, bx = px + Math.cos(a) * (r0 + r1) / 2, by = py + Math.sin(a) * (r0 + r1) / 2, br = (r1 - r0) * 0.26, bg = x.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br); bg.addColorStop(0, '#f2cf8a'); bg.addColorStop(0.5, '#9a6c2c'); bg.addColorStop(1, '#2e1c0a'); x.fillStyle = bg; x.beginPath(); x.arc(bx, by, br, 0, 6.2832); x.fill(); } };
  ring(cx, cy, R, R * 1.075, 10); for (const [px, py, r] of side) ring(px, py, r, r * 1.11, 6); ring(topW[0], topW[1], topW[2], topW[2] * 1.14, 4);
  const fs = helmFog.style; fs.left = (cx - R) / dpr + 'px'; fs.top = (cy - R) / dpr + 'px'; fs.width = fs.height = 2 * R / dpr + 'px';
}
function helmetExhale() {
  helmFog.style.transition = 'opacity 0.35s'; helmFog.style.opacity = 1; setTimeout(() => { helmFog.style.transition = 'opacity 2.6s'; helmFog.style.opacity = 0; }, 450);
  const n = 6 + Math.floor(Math.random() * 5); for (let i = 0; i < n; i++) { const b = document.createElement('span'), s = 5 + Math.random() * 14, a = 0.25 + Math.random() * 0.5;
    b.className = 'hb'; b.style.width = b.style.height = s + 'px'; b.style.left = (helmC[0] + Math.cos(a) * helmR * 0.92 - s / 2) + 'px'; b.style.top = (helmC[1] + Math.sin(a) * helmR * 0.92) + 'px';
    b.style.animationDuration = (1.5 + Math.random() * 1.1) + 's'; b.style.animationDelay = (0.15 + i * 0.06 + Math.random() * 0.1) + 's'; b.style.setProperty('--dx', (-10 - Math.random() * 30) + 'px'); b.style.setProperty('--dy', (-helmR * (0.9 + Math.random() * 0.7)) + 'px');
    b.addEventListener('animationend', () => b.remove()); helmBub.appendChild(b); }
}
window.addEventListener('resize', () => { if (V.mode === 'dive') drawHelmet(); });
function setSt(s) {
  const was = V.st; V.st = s; if (s === 'table') unlock(); if (s === 'seat') sonHint();
  if (s === 'seat') { V.yaw = 0; V.pitch = 0; } else if (s === 'table') { V.yaw = -Math.PI / 2; V.pitch = -0.55; }
  else if (was === 'seat') { V.px = 0; V.pz = 0.2; } else if (was === 'table') { V.px = -0.15; V.pz = -1.3; }
  ui();
}
// ---------- Gegenstände benutzen: was man ansieht und erreicht, leuchtet leicht auf; der Knopf unten zeigt die Handlung ----------
const tea = { phase: 'cold', t: 0 }, wv = new T.Vector3(), fwd = new T.Vector3();
let target = null;
const LABEL = {
  seat: () => t('seat'), table: () => t('table'),
  kettle: () => (!cabin.state.kettle ? '' : tea.phase === 'cold' ? t('kettle_on') : tea.phase === 'ready' ? t('kettle_pour') : ''),
  stove: () => (cabin.state.fireT > 1.2 ? '' : t('stove')),
  cupDesk: () => (cabin.state.cup === 'desk' ? t('cup_take') : ''), cupPult: () => (cabin.state.cup === 'pult' ? (cabin.state.cupHeat > 0.05 ? t('cup_drink') : t('cup_away')) : ''),
  hatch: () => (hasSuit() ? t('suit_out') : ''), suit: () => (hasSuit() ? t('suit_out') : ''), deck: () => t('tape_menu'), light: () => (cabin.state.lampT > 0.5 ? t('light_dim') : t('light_on')), log: () => t('log_read'), horch: () => t('horch'),
};
const ACT = {
  seat: () => setSt('seat'), table: () => setSt('table'),
  kettle: () => { if (tea.phase === 'cold') { tea.phase = 'heat'; tea.t = 0; audio.click(0.6); } else if (tea.phase === 'ready') { tea.phase = 'cool'; tea.t = 0; cabin.state.cup = 'desk'; cabin.state.cupHeat = 1; audio.pour(); } },
  stove: () => { cabin.state.fireT = 1.7; setTimeout(() => { cabin.state.fireT = 1; }, 45000); audio.click(0.8); },
  cupDesk: () => { cabin.state.cup = 'pult'; audio.click(0.3); }, cupPult: () => { if (cabin.state.cupHeat > 0.05) { cabin.state.cupHeat = Math.max(0, cabin.state.cupHeat - 0.34); if (cabin.state.cupHeat <= 0.05) note(t('tea_done')); } else cabin.state.cup = 'none'; audio.click(0.25); },
  hatch: () => suitOut(), suit: () => suitOut(), deck: () => openTapes(), light: () => { cabin.state.lampT = cabin.state.lampT > 0.5 ? 0.12 : 1; audio.click(0.9); }, log: () => openLog(), horch: () => openHorch(),
};
function pickTarget() {
  if (V.mode !== 'in' || V.st === 'table') return null;
  camera.getWorldDirection(fwd); let best = null, bs = 0;
  const keys = V.st === 'seat' ? ['cupPult', 'deck', 'horch'] : Object.keys(LABEL).filter((k) => k !== 'cupPult' || cabin.state.cup === 'pult');
  for (const k of keys) { if (!LABEL[k]()) continue; cabin.toWorld(k, wv); const d = wv.sub(camera.position), l = d.length(), reach = k === 'seat' || k === 'table' ? 1.9 : 1.45; if (l > reach) continue; const c = d.dot(fwd) / l, need = k === 'seat' || k === 'table' || k === 'hatch' ? 0.86 : 0.93; if (c > need && c - l * 0.02 > bs) { bs = c - l * 0.02; best = k; } }
  return best;
}
const canHere = () => (nearCan || nearBell) && (V.mode === 'out' || (V.st === 'seat' && !target));   // Dose (und den Anzug an der Glocke) birgt man vom Steuer aus: draußen oder am Steuerrad
const actLabel = () => (canHere() ? t(nearBell ? 'suit_take' : 'can_take') : V.mode === 'dive' ? (nearLampItem ? t('lamp_take') : nearTooth ? t('tooth_take') : nearCan2 ? t('can_take') : nearHatch ? t('suit_in') : '') : V.mode !== 'in' || V.st === 'table' ? '' : target ? LABEL[target]() : V.st === 'seat' ? t('stand') : '');
actEl.addEventListener('pointerdown', (e) => { e.preventDefault(); if (V.mode === 'dive') { if (nearLampItem) takeLamp(); else if (nearTooth) takeTooth(); else if (nearCan2) takeCan2(); else if (nearHatch) suitIn(); return; } if (canHere()) { if (nearBell) takeSuit(); else takeCan(); } else if (V.mode !== 'in') return; else if (target && LABEL[target]()) ACT[target](); else if (V.st === 'seat') setSt('walk'); });
// ---------- Missionen: beginnen an der Seite auf dem Schreibtisch; gestartet liegt draußen eine Messingdose, die man birgt ----------
const MS = { active: null, done: [], pageSeen: -1, hint: null, stage: null, cam: false, pod: null, hump: null, flood: false, floodOn: false, suit: false, tooth: false, can2: false, markSeen: false, pmax: 0, got: null, fresh: -1 }, bannerEl = $('banner'); let nearCan = false, nearCan2 = false, bannerT = 0, sonHintT = 0;
/** einmal pro Mission, beim ersten Mal am Steuer (oder draußen): kleiner Hinweis neben dem Sonar */
function sonHint() { if (!started || !MS.active || CAMV.on || !(V.mode === 'out' || V.st === 'seat')) return; const bell = MS.active === 'm5' && MS.stage === 'bell', key = MS.active + (bell ? ':bell' : ''); if (MS.hint === key || (MS.active === 'm5' && MS.stage && !bell)) return; MS.hint = key; const h = $('sonHint'); h.textContent = t(bell ? 'son_hint_bell' : (MISSIONS[misIdx(MS.active)].pod || MISSIONS[misIdx(MS.active)].hump) ? 'son_hint_m4' : 'son_hint'); h.style.opacity = 1; sonHintT = 9; save(); }
const misIdx = (id) => MISSIONS.findIndex((m) => m.id === id), nextMis = () => MISSIONS.find((m) => !MS.done.includes(m.id)) || null;
// Seiten gehören Missionen: Seite 0 liegt von Anfang an bereit, danach bringt jede Mission ihre Seiten in fester Reihenfolge (das Loch zwei).
// Spielt man eine Mission erneut, bleibt ihre Seite als leere Seite stehen, bis man sie wieder findet; so verrutscht nichts.
const PAGE_OWN = (() => { const o = [null]; for (const m of MISSIONS) for (let k = 0; k < (m.pages || 1); k++) o.push({ id: m.id, k }); return o; })();
function pageHas(i) { if (i === 0) return true; const o = PAGE_OWN[i]; if (!o) return false; if (MS.done.includes(o.id)) return true; return MS.active === o.id && o.id === 'm5' && (o.k === 0 ? !!MS.stage : MS.can2); }
const curPage = () => { let n = 0; for (let i = 0; i < PAGE_OWN.length; i++) if (pageHas(i)) n = i; return Math.min(Math.max(n, MS.pmax), t('pages').length - 1); };
/** merkt sich, welche Seiten gerade lesbar sind; eine neu hinzugekommene wird „frisch“ (das Logbuch schimmert und schlägt sie auf) */
function trackPages() { const now = []; for (let i = 0; i < PAGE_OWN.length && i < t('pages').length; i++) if (pageHas(i)) now.push(i); if (!MS.got) MS.got = MS.pageSeen >= 0 ? now.slice() : [];
  let nw = -1; for (const i of now) if (!MS.got.includes(i)) nw = Math.max(nw, i); if (nw >= 0) MS.fresh = nw; MS.got = now; MS.pmax = Math.max(MS.pmax, now.length ? now[now.length - 1] : 0); }
function banner(a, b) { bannerEl.children[0].textContent = a; bannerEl.children[1].textContent = b; bannerEl.classList.toggle('long', b.length > 46); bannerEl.style.opacity = 1; bannerT = 5; }   // lange Hinweise kleiner und umbrochen
function syncMis() {
  const st = cabin.state; st.own = [true, false, false, false, false, false, false]; for (const id of MS.done) { const m = MISSIONS[misIdx(id)]; if (m) st.own[m.tape] = true; } { const am = MS.active && MS.stage ? MISSIONS[misIdx(MS.active)] : null; if (am && am.tape != null && (!am.tapeLate || MS.can2)) st.own[am.tape] = true; } if (!st.own[st.tapeIn]) st.tapeIn = 0;
  trackPages(); cans.show(MS.active && (!MS.stage || MS.stage === 'tanks') ? misIdx(MS.active) : -1); st.pageNew = MS.fresh >= 0;   // ungelesene Seite: schimmert leicht
  if (!MS.active) nearCan = false; syncPod(); syncHump();
  st.kettle = MS.done.includes('m1'); st.crystal = MS.done.includes('m3');   // Fundstücke: der Kessel aus der ersten, der Kristall aus der dritten Mission
  const m5done = MS.done.includes('m5'); cave.setTooth(!(m5done || (MS.active === 'm5' && MS.tooth))); cave.setCan(!(m5done || (MS.active === 'm5' && MS.can2))); vitrine.visible = m5done;
  if (MS.active === 'm5' && MS.stage && !MS.can2) world.setExtra([cave.canGlow]); else if (MS.active === 'm7' && MS.stage === 'lamp') world.setExtra([upg.glow]); else if (cans.shown < 0) world.setExtra([]);
  if (MS.active === 'm7' && MS.stage === 'tanks') world.setExtra((world.extra || []).filter((g) => g !== upg.tankGlow).concat([upg.tankGlow]));   // die Tanks leuchten im Hain
  upg.lamp = MS.active === 'm7' && MS.stage === 'lamp'; upg.tanks = MS.active === 'm7'; whaleFig.visible = MS.done.includes('m6'); lampApply();   // das Lämpchen der hineingefallenen Dose leuchtet schwach in die Kammer
}
/** die schlafenden Pottwale: stehen, sobald die Mission läuft, und bleiben danach; während der Suche klicken sie lauter und regelmäßig, die Gesänge treten halb zurück */
let podShown = null;
function syncPod() {
  const hunt = !!(MS.active && MISSIONS[misIdx(MS.active)].pod); if (hunt && !MS.pod) MS.pod = choosePod(S.x, S.z, 400, POD_FIXED);
  if (podShown !== MS.pod) { podShown = MS.pod; whales.setPod(MS.pod); }
  const c = MS.pod ? whales.center() : null;
  if (c && MS.active !== 'm6') { audio.clickSrc.length = 0; audio.clickSrc.push({ x: c.x, z: c.z, loud: hunt ? 1.9 : 1, gap: hunt ? [1.6, 2.6] : null, pod: true }); } else if (audio.clickSrc[0] && audio.clickSrc[0].pod) audio.clickSrc.length = 0;
  audio.setSongs(hunt ? 0.5 : 1);
}
/** die Buckelwale: ziehen über dem Abgrund, solange die Mission läuft; tauchen sie zum Schluss ab, bleiben sie, bis sie im Dunkeln verschwunden sind */
let humpShown = null, devHump = null, humpWatchT = 0, humpPid = null;
function syncHump() {
  const on = MS.active === 'm6' && !!MS.stage; if (on && !MS.hump) MS.hump = humpSpot();
  let want = on ? MS.hump : devHump; if (!want && hump.diving()) want = humpShown;
  if (humpShown !== want) { humpShown = want; hump.setPod(want); if (want && MS.stage === 'follow' && on) hump.dive(); }
  if (on && MS.hump.dx !== undefined && !MS.hump.moved) { decoy.x = MS.hump.dx; decoy.z = MS.hump.dz; audio.setSongSrc(decoy); }   // erst eine falsche Fährte: dort, wo sie eben noch waren
  else audio.setSongSrc(on ? hump.src : null);   // dann singen sie nur dort, wo sie wirklich sind
}
/** Ablauf der Buckelwal-Mission: finden (Horcher), beobachten (etwa eine Minute), folgen bis zur Tiefengrenze */
/** Ort der Wale und ein Scheinziel: Fährt man auf das Scheinziel zu, liegen die echten Wale 30 bis 90° seitlich der Fahrtrichtung */
const decoy = { x: 0, z: 0 }; let decoyT = 0;
function humpSpot() { const h = chooseHumpSpot(S.x, S.z), wx = h.x - S.x, wz = h.z - S.z, sg = Math.random() < 0.5 ? 1 : -1;
  for (let k = 0; k < 20; k++) { const a = sg * (0.42 + Math.random() * 0.3), f = 0.55 + Math.random() * 0.2, dx = S.x + (wx * Math.cos(a) - wz * Math.sin(a)) * f, dz = S.z + (wx * Math.sin(a) + wz * Math.cos(a)) * f; if (Math.hypot(dx, dz) < 1350) { h.dx = dx; h.dz = dz; break; } }
  if (h.dx === undefined) h.moved = true; decoyT = 0; return h; }
/** die Wale ziehen weiter: ab jetzt singen die echten */
function humpMove() { if (!MS.hump || MS.hump.moved) return; MS.hump.moved = true; banner(t('m6_moved_h'), t('m6_moved')); syncHump(); save(); }
function humpStep(dt) {
  if (MS.active !== 'm6' || !MS.stage || V.mode === 'dive') return;
  if (MS.stage === 'listen' && MS.hump && !MS.hump.moved && MS.hump.dx !== undefined) {   // Scheinziel: in seiner Nähe, oder nach einer Minute Fahrt grob darauf zu, ziehen sie weiter
    const ddx = MS.hump.dx - S.x, ddz = MS.hump.dz - S.z, dd = Math.hypot(ddx, ddz), sp = Math.hypot(S.vx, S.vz);
    if (sp > 1.2 && (S.vx * ddx + S.vz * ddz) / (sp * Math.max(dd, 1)) > 0.8) decoyT += dt;
    if (dd < 130 || decoyT > 60) humpMove(); } const c = hump.center(); if (!c && MS.stage !== 'follow') return;
  const dh = c ? Math.hypot(c.x - S.x, c.z - S.z) : 1e9;
  if (MS.stage === 'listen' && dh < 70 && Math.abs(c.y - S.y) < 45) { if (MS.hump) MS.hump.moved = true; MS.stage = 'watch'; humpWatchT = 0; banner(t('m6_found_h'), t('m6_found')); syncMis(); save(); return; }
  if (MS.stage === 'watch') { if (humpWatchT <= 0) return; humpWatchT -= dt; if (humpWatchT <= 0) {   // erst nach dem Foto ziehen sie los; vorher spielen sie, so lange es dauert
    MS.stage = 'follow'; hump.dive(); syncMis(); banner(t('m6_dive_h'), t('m6_dive')); save(); } return; }
  if (MS.stage === 'follow') { const lim = devDeep ? -100 : deepAt(S.x, S.z); if (S.y < lim + 3 && Math.hypot(S.x - MS.hump.x, S.z - MS.hump.z) < 280) {   // unten angekommen: tiefer kommt das Boot nicht
    const m = MISSIONS[misIdx('m6')]; MS.stage = 'end'; note(t('m6_end')); setTimeout(() => finishMission(m, humpPid), 1200); } }
}
const POD_FIXED = [{ x: WHALE.x, z: WHALE.z, kind: 'skeleton' }, { x: cxAt(235), z: 235, kind: 'hole' }];
function startMission(m = nextMis()) { if (!m || MS.active) return; MS.active = m.id; if (m.tanks) MS.stage = 'lamp'; if (m.pod) { MS.stage = 'photo'; MS.pod = choosePod(S.x, S.z, 400, POD_FIXED); } if (m.hump) { MS.stage = 'listen'; MS.hump = humpSpot(); humpPid = null; } $('log').classList.remove('open'); banner(t('mis_started'), t('mis_' + m.id)); audio.click(0.7); syncMis(); save(); lockMouse(); }
/** wohin das Sonar bei einer Mission zeigt: Dose, Fotoziel, die Glocke (Anzug) oder nichts (zurück zum Loch findet man nur über den Kurs) */
const BELL_T = { x: BELL.x, z: BELL.z };
function misTarget() { if (!MS.active) return null; const i = misIdx(MS.active), m = MISSIONS[i]; if (m.pod || m.hump) return null; if (!MS.stage || MS.stage === 'tanks') return cans.lamp(i); if (MS.stage === 'lamp') return LAMP; if (MS.stage === 'lampback') return null; if (MS.stage === 'photo') return photoTarget(); if (MS.stage === 'bell') return BELL_T; return null; }
function clearGold() { for (let i = marks.length - 1; i >= 0; i--) if (marks[i].gold) marks.splice(i, 1); for (let i = echoes.length - 1; i >= 0; i--) if (echoes[i].gold || echoes[i].sector) echoes.splice(i, 1); sectors.length = 0; }
/** an der Taucherglocke: der alte Anzug kommt an Bord */
function takeSuit() {
  if (MS.active !== 'm5' || MS.stage !== 'bell') return; nearBell = false; clearGold(); MS.suit = true; MS.stage = 'cave'; syncMis(); audio.hatch();
  addLog({ kind: 'find', id: 'm5s', dist: Math.round(Math.hypot(BELL.x, BELL.z) / 10) * 10, dir: DIR8(BELL.x, BELL.z) }); setTimeout(() => banner(t('m5_suit_h'), t('m5_suit')), 600); save();
}
/** in der Kammer: den Zahn aufheben, und die Dose, die dem Kapitän hineingefallen ist. Sind beide oben, geht es zurück ins Boot */
function takeTooth() {
  if (MS.active !== 'm5' || MS.stage !== 'cave') return; nearTooth = nearCan2 = false; const dd = Math.round(Math.hypot(HOLE.x, HOLE.z) / 10) * 10, dr = DIR8(HOLE.x, HOLE.z); audio.hatch();
  if (!MS.tooth) { MS.tooth = true; addLog({ kind: 'find', id: 'm5t', dist: dd, dir: dr }); } if (!MS.can2) { MS.can2 = true; addLog({ kind: 'find', id: 'm5c', dist: dd, dir: dr }); }
  MS.stage = 'tooth'; syncMis(); save(); setTimeout(() => note(t('m5_both')), 300);
}
const takeCan2 = takeTooth;
/** am Wrack, zu Fuß: den starken Scheinwerfer aufheben; danach zurück ins Boot */
function takeLamp() { if (MS.active !== 'm7' || MS.stage !== 'lamp') return; nearLampItem = false; MS.stage = 'lampback'; clearGold(); syncMis(); audio.hatch();
  addLog({ kind: 'find', id: 'm7l', dist: Math.round(Math.hypot(LAMP.x, LAMP.z) / 10) * 10, dir: DIR8(LAMP.x, LAMP.z) }); setTimeout(() => note(t('m7_back')), 900); save(); }
/** wieder an Bord: der Scheinwerfer sitzt am Bug; dann geht es zu den Ballasttanks */
function lampAboard() { MS.stage = 'tanks'; MS.flood = true; MS.floodOn = true; syncMis(); save();
  setTimeout(() => banner(t('m7_lamp_h'), t(PC ? 'm7_lamp_pc' : 'm7_lamp_touch')), 900); setTimeout(() => banner(t('m7_next_h'), t('m7_next')), 7500); }   // Zahn und Dose liegen beieinander und werden mit einem Griff geborgen
function takeCan() {
  const m = MISSIONS[misIdx(MS.active)]; if (!m || (MS.stage && !(m.tanks && MS.stage === 'tanks'))) return; nearCan = false;
  for (let i = marks.length - 1; i >= 0; i--) if (marks[i].gold) marks.splice(i, 1); for (let i = echoes.length - 1; i >= 0; i--) if (echoes[i].gold || echoes[i].sector) echoes.splice(i, 1); sectors.length = 0;   // die goldene Raute verschwindet mit dem Aufheben
  addLog({ kind: 'find', id: m.id, dist: Math.round(Math.hypot(m.x, m.z) / 10) * 10, dir: DIR8(m.x, m.z) });
  if (m.extra === 'kettle') setTimeout(() => addLog({ kind: 'find', id: 'm1k', dist: Math.round(Math.hypot(m.x, m.z) / 10) * 10, dir: DIR8(m.x, m.z) }), 2600);   // der Kessel kommt mit an Bord
  if (m.cave) { MS.stage = 'mark'; MS.tooth = MS.can2 = MS.markSeen = false; syncMis(); setTimeout(() => banner(t('m5_page_h'), t('m5_page')), 600); save(); return; }   // die Mission geht weiter: Seite lesen, Loch markieren, Anzug holen, hinabsteigen
  if (m.photo) {   // die Mission geht weiter: erst ein gutes Foto beendet sie
    MS.stage = 'photo'; if (m.cam) MS.cam = true; syncMis(); playTape(m.tape, true); setTimeout(() => note(m.cam ? t('cam_got') : t('m3_photo')), 4300); if (m.cam) setTimeout(() => note(t('m3_photo')), 9000); save(); return;
  }
  finishMission(m); playTape(m.tape, true);
}
function finishMission(m, pid) {
  if (m.id === 'm3') { const p = MISSIONS[misIdx('m3')]; setTimeout(() => addLog({ kind: 'find', id: 'm3k', dist: Math.round(Math.hypot(p.x, p.z) / 10) * 10, dir: DIR8(p.x, p.z) }), 3200); }   // ein kleiner Kristall von der Grotte
  MS.done.push(m.id); MS.active = null; MS.stage = null; MS.tooth = MS.can2 = false; nearCan = nearCan2 = false; syncMis(); banner(t('mis_done'), t('mis_' + m.id)); if (m.tapeLate) playTape(m.tape, true);
  if (m.pod) { setTimeout(() => addLog({ kind: 'diary', id: m.id, pid }), 2500); setTimeout(() => note(t('env_open')), 6000); }
  else if (m.hump) { setTimeout(() => addLog({ kind: 'diary', id: m.id, pid }), 2500); setTimeout(() => { note(t('env2_open')); playTape(m.tape, true); }, 6500); }   // Buckelwale: der zweite Umschlag mit Seite und Kassette
  else if (MS.fresh >= 0) setTimeout(() => note(t('page_new')), 5500);   // der erste lange eigene Eintrag, dann der Umschlag aus der dritten Dose
  save();
}
/** legt eine Kassette ins Deck und spielt sie: Herausnehmen aus dem Regal heißt abspielen */
function playTape(k, quiet) { const st = cabin.state; if (!st.own[k]) return; st.tapeIn = k; audio.tapeTrack(k); st.tape = true; audio.tape(true); if (!quiet) note(t('tape_now', { n: t('tape_n')[k] })); save(); }
// ---------- Kamera: Sucher am Bug. Umsehen ja, fahren nein; ein Foto wird gleich „entwickelt“ und ins Logbuch geklebt ----------
const CAMV = { on: false, yaw: 0, pitch: 0 }, camLocal = new T.Vector3(0, -0.05, 2.4), camP = new T.Vector3(), camL = new T.Vector3(), tv = new T.Vector3();
let devCam = false, shootReq = false, thumbT = 0; try { devCam = localStorage.getItem('tiefenlicht.devcam') === '1'; } catch (e) { /* egal */ }
const hasCam = () => MS.cam || devCam;
function openCam() { if (!hasCam() || CAMV.on || switching || !started) return; closeTapes(); closeHorch(); switching = true; fadeEl.style.opacity = 1; setTimeout(() => { CAMV.on = true; CAMV.yaw = 0; CAMV.pitch = 0; I.jx = I.jy = 0; I.joyId = null; joy.style.opacity = 0; boatVis(); ui(); resize(); fadeEl.style.opacity = 0; switching = false; }, 250); }
function closeCam(now) { if (!CAMV.on) return; const done = () => { CAMV.on = false; I.lookId = null; boatVis(); ui(); resize(); }; if (now) { done(); return; } switching = true; fadeEl.style.opacity = 1; setTimeout(() => { done(); fadeEl.style.opacity = 0; switching = false; }, 250); }
function camStep() {
  const g = boat.group; camP.copy(camLocal).applyMatrix4(g.matrixWorld); const yaw = S.h + CAMV.yaw, cp = Math.cos(CAMV.pitch);
  camL.set(camP.x + Math.sin(yaw) * cp, camP.y + Math.sin(CAMV.pitch), camP.z + Math.cos(yaw) * cp); camera.position.copy(camP); camera.lookAt(camL);
  U.uDeep.value = deepK(camP.y);
}
/** Fotoziel der laufenden Mission (oder null): Punkt über Grund, wie nah man sein muss, Name für die Beschriftung */
function photoTarget() { if (MS.active === 'm6' && (MS.stage === 'watch' || MS.stage === 'follow')) { const c = hump.center(); return c ? { x: c.x, y: c.y, z: c.z, r: 75, name: 'n_humpbacks' } : null; } if (!MS.active || MS.stage !== 'photo') return null; const p = MISSIONS[misIdx(MS.active)].photo; if (p.pod) { const c = whales.center(); return c ? { x: c.x, y: c.y, z: c.z, r: p.r, name: p.name } : null; } return { x: p.x, y: floorH(p.x, p.z) + p.h, z: p.z, r: p.r, name: p.name }; }
/** zählt das Foto? Ziel ungefähr mittig im Bild, nah genug, kein Fels dazwischen */
function camTargetOk() {
  const p = photoTarget(); if (!p || !CAMV.on) return false; const c = camera.position; if (c.distanceTo(tv.set(p.x, p.y, p.z)) > p.r) return false;
  camera.updateMatrixWorld(); tv.project(camera); if (tv.z > 1 || Math.abs(tv.x) > 0.6 || Math.abs(tv.y) > 0.6) return false;
  for (let i = 1; i < 14; i++) { const k = i / 14, x = c.x + (p.x - c.x) * k, y = c.y + (p.y - c.y) * k, z = c.z + (p.z - c.z) * k; if (floorH(x, z) > y + 0.4) return false; }
  return true;
}
function shoot() { if (CAMV.on && !switching) shootReq = true; }
/** aus dem gerenderten Bild ein altes Sofortbild machen: ausgeblichen, warm, Korn, dunkle Ecken; Papierrand mit Handschrift */
function develop(src, cap) {
  const W = src.width, H = src.height, PW = 420, PH = 315; let sw = W, sh = W * PH / PW; if (sh > H) { sh = H; sw = H * PW / PH; }
  const c = document.createElement('canvas'); c.width = PW; c.height = PH; const x = c.getContext('2d'); x.drawImage(src, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, PW, PH);
  const im = x.getImageData(0, 0, PW, PH), d = im.data;
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    const k = (j * PW + i) * 4; let r = Math.min(1, d[k] / 255 * 1.55), g = Math.min(1, d[k + 1] / 255 * 1.55), b = Math.min(1, d[k + 2] / 255 * 1.55); const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = r * 0.35 + l * 0.65; g = g * 0.35 + l * 0.65; b = b * 0.35 + l * 0.65; r = r * 1.22 + 0.06; g = g * 1.0 + 0.03; b = b * 0.72 + 0.01;
    const ux = i / PW - 0.5, uy = j / PH - 0.5, v = 1 - Math.min(1, (ux * ux + uy * uy) * 2.2) * 0.72, n = (Math.random() - 0.5) * 0.08;
    d[k] = clamp(((0.07 + 0.88 * r) * v + n) * 255, 0, 255); d[k + 1] = clamp(((0.06 + 0.88 * g) * v + n) * 255, 0, 255); d[k + 2] = clamp(((0.05 + 0.86 * b) * v + n) * 255, 0, 255);
  }
  x.putImageData(im, 0, 0); const lk = x.createLinearGradient(0, 0, PW * 0.55, PH * 0.35); lk.addColorStop(0, 'rgba(255,170,90,0.2)'); lk.addColorStop(1, 'rgba(255,170,90,0)'); x.fillStyle = lk; x.fillRect(0, 0, PW, PH);
  const M = 18, B = 70, out = document.createElement('canvas'); out.width = PW + 2 * M; out.height = PH + M + B; const o = out.getContext('2d');
  o.fillStyle = '#eee5d0'; o.fillRect(0, 0, out.width, out.height); for (let i = 0; i < 500; i++) { o.fillStyle = `rgba(120,95,60,${Math.random() * 0.07})`; o.fillRect(Math.random() * out.width, Math.random() * out.height, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  o.drawImage(c, M, M); o.strokeStyle = 'rgba(60,40,20,0.35)'; o.lineWidth = 1; o.strokeRect(M + 0.5, M + 0.5, PW - 1, PH - 1);
  const HAND = '"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive'; o.fillStyle = 'rgba(36,44,78,0.88)'; o.save(); o.translate(M + 6, PH + M + 32); o.rotate(-0.012);
  o.font = `22px ${HAND}`; o.fillText(cap[0], 0, 0); o.font = `15px ${HAND}`; o.fillText(cap[1], 2, 25); o.restore();
  return out.toDataURL('image/jpeg', 0.72);
}
// Fotos: eigener Speicher (Bilder sind groß); höchstens 40 freie, Missionsfotos bleiben immer
const PH_KEY = 'tiefenlicht.photos', PHOTOS = []; try { for (const p of JSON.parse(localStorage.getItem(PH_KEY) || '[]')) PHOTOS.push(p); } catch (e) { /* egal */ }
function storePhotos() { for (;;) { try { localStorage.setItem(PH_KEY, JSON.stringify(PHOTOS)); return; } catch (e) { const i = PHOTOS.findIndex((q) => !q.keep); if (i < 0 || PHOTOS.length < 2) return; PHOTOS.splice(i, 1); } } }
const photoSrc = (id) => { const p = PHOTOS.find((q) => q.id === id); return p ? p.src : null; };
function takePhoto() {
  audio.shutter(); const fl = $('camFlash'); fl.style.transition = 'none'; fl.style.opacity = 0.85; requestAnimationFrame(() => { fl.style.transition = 'opacity 0.7s'; fl.style.opacity = 0; });
  const ok = camTargetOk(), pt = photoTarget(); let place = t('cap_open');
  if (ok) place = t(pt.name); else { let bd = 70; for (const p of poisNear(S.x, S.z, 90)) { const d = Math.hypot(p.x - S.x, p.z - S.z); if (d < bd) { bd = d; place = t('n_' + p.kind); } } }
  const cap = [place, Math.round(-S.y) + ' m  ·  ' + new Date().toLocaleDateString(getLang() === 'de' ? 'de-DE' : 'en-GB')], id = 'p' + Date.now().toString(36), src = develop(renderer.domElement, cap);
  PHOTOS.push({ id, src, keep: ok }); while (PHOTOS.filter((q) => !q.keep).length > 40) PHOTOS.splice(PHOTOS.findIndex((q) => !q.keep), 1); storePhotos();
  addLog({ kind: 'photo', pid: id, cap }); note(t('photo_saved'));
  const th = $('camThumb'); th.src = src; th.classList.add('show'); thumbT = 2.6;
  if (ok && MS.active === 'm6') { if (!humpPid) humpPid = id; if (MS.stage === 'watch' && humpWatchT <= 0) humpWatchT = 10; }   // nach dem ersten guten Foto ziehen sie bald los
  else if (ok) setTimeout(() => { const m = MISSIONS[misIdx(MS.active)]; if (m && MS.stage === 'photo') finishMission(m, id); }, 900);
}
$('camBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); openCam(); });
$('lampBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFlood(); });
$('camShut').addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
$('camClose').addEventListener('pointerdown', (e) => { e.preventDefault(); closeCam(); });
// ---------- Horchgerät: Peilscheibe drehen, Kopfhörer auf. Klicks hört man weit, aber nur aus der Richtung, in die es zeigt ----------
let horchOpen = false, horchDeg = 0, horchDrag = null, relockEsc = false;
function openHorch() { unlock(); closeTapes(); horchOpen = true; $('horch').classList.add('open'); }
function closeHorch(esc) { if (!horchOpen) return; horchOpen = false; horchDrag = null; $('horch').classList.remove('open'); audio.hydro(false, 0); if (esc) relockEsc = true; else lockMouse(); }
const hcv = $('horchCv'), hcx = hcv.getContext('2d');
const horchAng = (e) => { const r = hcv.getBoundingClientRect(); return Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) * 180 / Math.PI; };
hcv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (e.pointerType !== 'mouse') return; horchDrag = { id: e.pointerId, a: horchAng(e) }; try { hcv.setPointerCapture(e.pointerId); } catch (x) { /* egal */ } });   // Maus: am Rand ziehen; am Handy dreht der Regler darunter
hcv.addEventListener('pointermove', (e) => { if (!horchDrag || e.pointerId !== horchDrag.id) return;
  const r = hcv.getBoundingClientRect(), rr = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) / (r.width / 2), a = horchAng(e); if (rr < 0.3) { horchDrag.a = a; return; }   // nah an der Mitte springt der Winkel: dort nicht drehen
  let d = a - horchDrag.a; d = ((d + 540) % 360) - 180; horchDeg = (horchDeg + d + 360) % 360; horchDrag.a = a; });
// Handy: Schieberegler unter der Scheibe. Mitte = voraus, links = Backbord, rechts = Steuerbord, ganz außen = achtern
const hSl = $('horchSl'); hSl.addEventListener('input', () => { horchDeg = (+hSl.value + 360) % 360; });
for (const ev of ['pointerup', 'pointercancel']) hcv.addEventListener(ev, (e) => { if (horchDrag && e.pointerId === horchDrag.id) horchDrag = null; });
$('horchClose').addEventListener('pointerdown', (e) => { e.preventDefault(); closeHorch(); });
function drawHorch() {
  const N = hcv.width, c = N / 2, R = c - 10, x = hcx, lvl = audio.hydroLevel(); x.clearRect(0, 0, N, N);
  const gr = x.createRadialGradient(c, c * 0.8, 20, c, c, R); gr.addColorStop(0, '#efe4c4'); gr.addColorStop(1, '#bba878'); x.fillStyle = gr; x.beginPath(); x.arc(c, c, R, 0, 6.2832); x.fill();
  x.strokeStyle = 'rgba(90,60,25,0.85)'; x.lineWidth = 3; x.beginPath(); x.arc(c, c, R * 0.93, 0, 6.2832); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(c, c, R * 0.72, 0, 6.2832); x.stroke();
  const P = (deg, r) => [c + Math.sin(deg * Math.PI / 180) * r, c - Math.cos(deg * Math.PI / 180) * r];
  for (let d = 0; d < 360; d += 5) { const big = d % 30 === 0, a = P(d, R * 0.93), b = P(d, R * (big ? 0.83 : 0.88)); x.strokeStyle = d === 0 ? 'rgba(150,30,20,0.95)' : 'rgba(60,40,20,0.85)'; x.lineWidth = big ? 3 : 1.5; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  x.fillStyle = 'rgba(60,40,20,0.9)'; x.font = '26px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let d = 0; d < 360; d += 30) { const p = P(d, R * 0.77); x.fillText(String(d), p[0], p[1]); }
  const lo = (horchDeg - 20 - 90) * Math.PI / 180, hi = (horchDeg + 20 - 90) * Math.PI / 180; x.fillStyle = `rgba(60,140,80,${0.12 + lvl * 0.35})`; x.beginPath(); x.moveTo(c, c); x.arc(c, c, R * 0.7, lo, hi); x.closePath(); x.fill();   // Hörkegel
  x.fillStyle = 'rgba(60,40,20,0.55)'; x.beginPath(); x.moveTo(c, c - 46); x.quadraticCurveTo(c + 20, c - 10, c + 15, c + 40); x.lineTo(c - 15, c + 40); x.quadraticCurveTo(c - 20, c - 10, c, c - 46); x.fill();   // das eigene Boot, Bug nach oben
  const tip = P(horchDeg, R * 0.68), tail = P(horchDeg + 180, R * 0.18); x.strokeStyle = 'rgba(150,30,20,0.95)'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(tail[0], tail[1]); x.lineTo(tip[0], tip[1]); x.stroke();
  x.fillStyle = '#8a6a34'; x.beginPath(); x.arc(c, c, 16, 0, 6.2832); x.fill(); x.fillStyle = '#c9a25a'; x.beginPath(); x.arc(c, c, 8, 0, 6.2832); x.fill();
  const lp = [c, c + R * 0.45], g2 = x.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], 40); g2.addColorStop(0, `rgba(170,255,180,${0.25 + Math.min(1, lvl * 2.5) * 0.75})`); g2.addColorStop(1, 'rgba(170,255,180,0)'); x.fillStyle = g2; x.beginPath(); x.arc(lp[0], lp[1], 40, 0, 6.2832); x.fill();
  x.fillStyle = '#1d3a24'; x.beginPath(); x.arc(lp[0], lp[1], 11, 0, 6.2832); x.fill(); x.fillStyle = `rgba(150,255,170,${0.15 + Math.min(1, lvl * 2.5) * 0.85})`; x.beginPath(); x.arc(lp[0], lp[1], 9, 0, 6.2832); x.fill();
  const info = t('horch_info', { d: String(Math.round(horchDeg) % 360).padStart(3, '0'), s: t('horch_side')[Math.round(horchDeg / 45) % 8] }) + '\n' + t('horch_tip'); if ($('horchInfo').textContent !== info) $('horchInfo').textContent = info;
}
// ---------- Kassettenmenü: öffnet sich am Rekorder; Liste der Kassetten, darunter was läuft, mit Abspielen, Pause und Stopp ----------
let tapesOpen = false, reelA = 0, waveAmp = 8;
const ICON_CAS = '<svg viewBox="0 0 26 18"><rect x="1" y="1" width="24" height="16" rx="2.5"/><rect x="5" y="4" width="16" height="6" rx="1.5"/><circle cx="9.5" cy="7" r="1.6"/><circle cx="16.5" cy="7" r="1.6"/><path d="M7 17l2-4h8l2 4"/></svg>';
function fillTapes() {
  const box = $('tList'), st = cabin.state; box.innerHTML = '';
  for (let k = 0; k < st.own.length; k++) {
    const d = document.createElement('div'), own = st.own[k]; d.className = 'tRow' + (own ? '' : ' hid') + (own && k === st.tapeIn ? ' on' : '');
    d.innerHTML = ICON_CAS; const n = document.createElement('span'); n.textContent = own ? t('tape_n')[k] : '· · ·'; d.appendChild(n);
    if (own) d.addEventListener('pointerdown', (e) => { e.preventDefault(); playTape(k, true); fillTapes(); });
    box.appendChild(d);
  }
  $('tName').textContent = t('tape_n')[st.tapeIn] || ''; for (const b of document.querySelectorAll('#tBtns span')) b.classList.toggle('on', b.dataset.a === (st.tape ? 'play' : 'pause'));
}
function openTapes() { unlock(); fillTapes(); tapesOpen = true; $('tapes').classList.add('open'); }
function closeTapes(esc) { if (!tapesOpen) return; tapesOpen = false; $('tapes').classList.remove('open'); if (esc) relockEsc = true; else lockMouse(); }
for (const b of document.querySelectorAll('#tBtns span')) b.addEventListener('pointerdown', (e) => {
  e.preventDefault(); const st = cabin.state, a = b.dataset.a;
  if (a === 'play' && !st.tape) { st.tape = true; audio.tape(true); } else if (a === 'pause' && st.tape) { st.tape = false; audio.tape(false); } else if (a === 'stop') { st.tape = false; audio.tapeStop(); }
  fillTapes();
});
$('tapes').addEventListener('pointerdown', (e) => { if (e.target === $('tapes') || e.target.closest('#tClose')) { e.preventDefault(); closeTapes(); } });
function drawTapes(dt) {
  const st = cabin.state, rc = $('tReel'), r = rc.getContext('2d'), W = rc.width, c = W / 2; if (st.tape) reelA += dt * 1.6;
  r.clearRect(0, 0, W, W); r.strokeStyle = 'rgba(232,196,130,0.85)'; r.lineWidth = 3;
  r.beginPath(); r.arc(c, c, c - 4, 0, 6.2832); r.stroke(); r.beginPath(); r.arc(c, c, c * 0.24, 0, 6.2832); r.stroke(); r.beginPath(); r.arc(c, c, c * 0.1, 0, 6.2832); r.stroke();
  for (let i = 0; i < 3; i++) { const a = reelA + i * 2.0944, x = c + Math.cos(a) * c * 0.56, y = c + Math.sin(a) * c * 0.56; r.beginPath(); r.arc(x, y, c * 0.19, 0, 6.2832); r.stroke(); }
  const wc = $('tWave'), w = wc.getContext('2d'), WW = wc.width, WH = wc.height, data = st.tape ? audio.tapeWave() : null; w.clearRect(0, 0, WW, WH);
  let amp = 1; if (data) for (let i = 0; i < data.length; i++) amp = Math.max(amp, Math.abs(data[i] - 128)); waveAmp += ((data ? amp : 1) - waveAmp) * Math.min(1, dt * 3);
  const sc2 = (WH * 0.42) / Math.max(4, waveAmp); w.strokeStyle = 'rgba(232,196,130,0.8)'; w.lineWidth = 2; w.beginPath();
  for (let i = 0; i < 128; i++) { const v = data ? (data[i * 2] - 128) * sc2 : 0, x = i / 127 * WW, y = WH / 2 - v; if (i) w.lineTo(x, y); else w.moveTo(x, y); }
  w.stroke();
}
let misOpen = null, misArm = null;
function fillMis() {
  const box = $('misList'); box.innerHTML = '';
  const add = (cls, name, state, desc, id) => { const d = document.createElement('div'); d.className = 'mis ' + cls; if (name) { const a = document.createElement('div'); a.className = 'mn'; const n = document.createElement('span'); n.textContent = name; const s2 = document.createElement('span'); s2.className = 'ms2'; s2.textContent = state; a.appendChild(n); a.appendChild(s2); d.appendChild(a); const p = document.createElement('div'); p.className = 'md'; p.textContent = desc; d.appendChild(p); } else d.textContent = '· · ·';
    if (id) {   // eine gespielte (oder laufende) Mission antippen: darunter erscheint „erneut spielen“
      d.classList.add('pick'); d.addEventListener('pointerdown', (e) => { if (e.target.closest('.misRe')) return; e.preventDefault(); misOpen = misOpen === id ? null : id; misArm = null; fillMis(); });
      if (misOpen === id) { const lock = MS.active && MS.active !== id, b = document.createElement('div'); b.className = 'pill mini misRe' + (lock ? ' off' : '') + (misArm === id ? ' arm' : ''); b.textContent = lock ? t('mis_replay_lock') : misArm === id ? t('mis_replay_sure') : t('mis_replay');
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (lock) return; if (misArm !== id) { misArm = id; fillMis(); setTimeout(() => { if (misArm === id) { misArm = null; if (M.panel === 'mis') fillMis(); } }, 4000); return; } misArm = null; misOpen = null; if (replayMission(id)) closeMenu(); });
        d.appendChild(b); } }
    box.appendChild(d); };
  for (const m of MISSIONS) { if (MS.active === m.id) add('run', t('mis_' + m.id), t('mis_s_run'), t(m.id === 'm5' ? 'mish_m5' + (MS.stage ? '_' + MS.stage : '') : m.id === 'm7' ? 'mish_m7' + (MS.stage === 'lampback' ? 'b' : MS.stage === 'tanks' ? 'c' : '') : m.id === 'm6' ? 'mish_m6' + (MS.stage === 'watch' ? 'b' : MS.stage === 'follow' || MS.stage === 'end' ? 'c' : '') : 'mish_' + m.id + (MS.stage ? 'b' : '')), m.id); else if (MS.done.includes(m.id)) add('done', t('mis_' + m.id), '✓ ' + t('mis_s_done'), t('misd_' + m.id), m.id); }
  const nx = nextMis(); if (!MS.active && nx) add('', '?', t('mis_s_open'), MS.done.length ? t('mis_open') : t('mis_intro'));
  const rest = MISSIONS.length - MS.done.length - (MS.active || nx ? 1 : 0) + HINTED; for (let i = 0; i < Math.min(rest, 4); i++) add('hid');
}
/** eine Mission noch einmal spielen: nimmt nur weg, was sie selbst gebracht hat (Seiten bleiben leer stehen). Werkzeuge bleiben, wenn eine spätere Mission sie schon gebraucht hat */
function replayMission(id) {
  const i = misIdx(id), m = MISSIONS[i]; if (!m || (MS.active && MS.active !== id)) return false;
  const later = MISSIONS.slice(i + 1).some((q) => MS.done.includes(q.id)), own = new RegExp('^' + id + '(?![0-9])');
  if (V.mode === 'dive') { diver.exit(); V.mode = 'in'; applyMode(); }
  MS.done = MS.done.filter((d) => d !== id); MS.active = null; MS.stage = null; nearCan = nearCan2 = nearBell = nearTooth = false;
  if (m.cam && !later) MS.cam = false;
  if (m.cave) { if (!later) MS.suit = false; MS.tooth = MS.can2 = false; MS.markSeen = false; }
  if (m.hump) MS.hump = null;   // die Buckelwale ziehen beim Neustart woanders
  if (m.tanks) { MS.flood = false; MS.floodOn = false; }
  if (m.pod) MS.pod = null;   // die alten Pottwale verschwinden, beim Start wird eine neue Gruppe gewürfelt
  if (MS.hint && own.test(MS.hint)) MS.hint = null;
  for (let k = LOG.length - 1; k >= 0; k--) { const e = LOG[k]; if ((e.kind === 'find' || e.kind === 'diary') && e.id && own.test(e.id)) LOG.splice(k, 1); }
  clearGold(); const tin = cabin.state.tapeIn; syncMis(); if (cabin.state.tapeIn !== tin) { audio.tapeTrack(cabin.state.tapeIn); }
  startMission(m); return true;
}
// ---------- Logbuch: füllt sich von selbst, wenn man etwas findet ----------
const LOG = [], seen = new Set(); let playTime = 0;
const DIR8 = (dx, dz) => Math.round(((Math.atan2(-dx, dz) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8;   // Norden = +z; so wie die Welt gezeichnet wird, liegt Osten bei -x
function addLog(e) { e.min = Math.round(playTime / 60); e.depth = Math.round(-S.y); LOG.push(e); note(t('log_note', { t: entryTitle(e) })); save(); }
const entryTitle = (e) => (e.kind === 'shark' ? '—' : e.kind === 'photo' ? t('n_photo') : e.kind === 'diary' ? t('n_diary_' + e.id) : e.id === 'm5s' ? t('n_suit') : e.id === 'm5t' ? t('n_tooth') : e.id === 'm1k' ? t('n_kettle') : e.id === 'm7l' ? t('n_lamp') : e.id === 'm7' ? t('n_tanks') : e.id === 'm3k' ? t('n_crystal') : t('n_' + e.kind) + (e.n ? ' (' + (e.n + 1) + '.)' : ''));
const entryText = (e) => { if (e.kind === 'shark') return t('shark'); if (e.kind === 'photo') return (e.cap || []).join('  ·  '); if (e.kind === 'diary') return t('diary_' + e.id); if (e.kind === 'find') return t('find_' + e.id) + ' ' + t('where', { d: e.dist, dir: t('dirs')[e.dir] }); const tx = t(e.kind); return tx[e.n % tx.length] + ' ' + t('where', { d: e.dist, dir: t('dirs')[e.dir] }); };
function discover() {
  for (const p of poisNear(S.x, S.z, 80)) { const k = Math.round(p.x) + ',' + Math.round(p.z); if (seen.has(k)) continue;   // Fundort zählt erst in einem flachen Oval: waagerecht wie bisher, senkrecht nur ±12 m um die Mitte des Objekts
    const rh = p.disc || (p.kind === 'wreck' ? 46 : 32), yc = Math.max(p.y, floorH(p.x, p.z)) + (p.kind === 'wreck' ? 6 : 4), q = (Math.hypot(p.x - S.x, p.z - S.z) / rh) ** 2 + ((S.y - yc) / 12) ** 2; if (q > 1) continue; seen.add(k); addLog({ kind: p.kind, n: LOG.filter((e) => e.kind === p.kind).length, dist: Math.round(Math.hypot(p.x, p.z) / 10) * 10, dir: DIR8(p.x, p.z) }); }
}
// Logbuch: ein Buch mit festen Seiten zum Blättern (Pfeile unten, A / D, Wischen). Drei Reiter: „Eigenes“ füllt sich von selbst,
// „Kapitän“ sammelt seine Seiten (jede beginnt auf einer neuen Buchseite), „Fotos“ zeigt zwei Sofortbilder je Seite. Aufgeschlagen wird immer das Neueste.
let logTab = 'own';
const BOOK = { pages: [], i: 0, cap: [] }, logPg = $('logPage'), logOpen = () => $('log').classList.contains('open');
const mkDiv = (cls, text) => { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; };
/** verteilt Blöcke auf Seiten: { el } bleibt ganz, { cls, text } ist Fließtext und darf satzweise umbrechen, brk: neue Seite beginnen */
function paginate(blocks) {
  const pg = logPg, H = pg.clientHeight, pages = []; let cur = [];
  const over = () => pg.scrollHeight > H + 1, flush = () => { if (cur.length) pages.push(cur); cur = []; pg.innerHTML = ''; };
  pg.innerHTML = '';
  for (const b of blocks) {
    if (b.brk) flush();
    if (b.el) { pg.appendChild(b.el); if (over() && cur.length) { pg.removeChild(b.el); flush(); pg.appendChild(b.el); } cur.push(b.el); if (b.mark) b.mark(pages.length); continue; }
    const parts = b.text.match(/[^.!?…]+(?:[.!?…]+[»«“”"’]*)?\s*/g) || [b.text]; let el = null, acc = '';
    const start = (cls) => { el = mkDiv(cls, ''); pg.appendChild(el); cur.push(el); acc = ''; };
    start(b.cls); if (b.mark) b.mark(pages.length);
    for (const sp of parts) {
      el.textContent = acc + sp; if (!over()) { acc += sp; continue; }
      if (acc) { el.textContent = acc.trimEnd(); flush(); start(b.cls + ' cont'); el.textContent = sp; acc = sp; }
      else if (cur.length > 1) { cur.pop(); pg.removeChild(el); flush(); start(b.cls); if (b.mark) b.mark(pages.length); el.textContent = sp; acc = sp; }
      else acc += sp;   // ein einzelner Satz, der nicht auf eine Seite passt: dann eben abgeschnitten
    }
  }
  flush(); return pages.length ? pages : [[]];
}
function bookBlocks() {
  const B = [], head = (txt) => B.push({ el: mkDiv('logHead', txt) });
  if (logTab === 'cap') {
    head(t('log_cap_h')); BOOK.cap = [];
    for (let i = 0; i <= curPage(); i++) { const pg = t('pages')[i]; if (!pg) continue;
      if (!pageHas(i)) { B.push({ el: mkDiv('logBlank', '· · ·'), brk: i > 0, mark: (n) => { BOOK.cap[i] = n; } }); continue; }   // Seite einer neu gestarteten Mission: bleibt leer, bis man sie wieder findet
      B.push({ el: mkDiv('logTitle capTitle', pg[0]), brk: i > 0, mark: (n) => { BOOK.cap[i] = n; } });
      for (const par of pg[1].split('\n\n')) B.push({ cls: 'logPar', text: par });
      B.push({ el: mkDiv('logSign', pg[2]) }); }
  } else if (logTab === 'pho') {
    head(t('log_pho'));
    if (!PHOTOS.length) B.push({ el: mkDiv('', t('photo_none')) });
  } else {
    head(t('log'));
    if (!LOG.length) { const d = mkDiv('logEntry'); d.appendChild(mkDiv('logTitle', t('log_empty_t'))); d.appendChild(mkDiv('', t('log_empty'))); B.push({ el: d }); }
    for (const e of LOG) {
      const when = (e.min < 1 ? t('now') : t('after', { m: e.min })) + ', ' + e.depth + ' m', d = mkDiv('logEntry'); d.appendChild(mkDiv('logTitle', entryTitle(e) + '  ·  ' + when));
      const img = e.kind === 'photo' || e.kind === 'diary' ? photoSrc(e.pid) : null;
      if (img) { const im = document.createElement('img'); im.className = 'logPhoto'; im.src = img; im.addEventListener('pointerup', () => { if (!logSwiped) showBig(img); }); d.appendChild(im); }
      if (e.kind === 'diary') { B.push({ el: d }); for (const par of entryText(e).split('\n\n')) B.push({ cls: 'logPar', text: par }); B.push({ el: mkDiv('logEntry') }); }
      else { if (!img) d.appendChild(mkDiv('', entryText(e))); B.push({ el: d }); }
    }
  }
  return B;
}
/** baut das Buch für den aktuellen Reiter neu; at: 'new' = beim Neuesten aufschlagen, sonst die Seitenzahl halten */
function buildBook(at) {
  if (logTab === 'pho') {   // Fotos: immer zwei je Seite, so groß, wie die Seite es zulässt
    logPg.innerHTML = ''; const H = logPg.clientHeight, hd = mkDiv('logHead', t('log_pho')); logPg.appendChild(hd); const hh = hd.offsetHeight + 14, ph = Math.max(60, Math.floor((H - hh) / 2) - 22);
    BOOK.pages = []; const list = PHOTOS.slice();
    if (!list.length) BOOK.pages.push([hd, mkDiv('', t('photo_none'))]);
    for (let k = 0; k < list.length; k += 2) { const pg = [k ? mkDiv('logHead', '') : hd]; if (k) pg[0].style.visibility = 'hidden';
      for (const p of list.slice(k, k + 2)) { const im = document.createElement('img'); im.className = 'bookPhoto r' + (1 + (pg.length % 2)); im.src = p.src; im.style.maxHeight = ph + 'px'; im.addEventListener('pointerup', () => { if (!logSwiped) showBig(p.src); }); pg.push(im); }
      BOOK.pages.push(pg); }
  } else BOOK.pages = paginate(bookBlocks());
  const last = BOOK.pages.length - 1;
  const open = MS.fresh >= 0 ? MS.fresh : curPage(); BOOK.i = at === 'new' ? (logTab === 'cap' ? (BOOK.cap[open] !== undefined ? BOOK.cap[open] : last) : last) : Math.min(last, Math.max(0, at | 0));
  showBookPage(0);
}
function showBookPage(dir) {
  const n = BOOK.pages.length; BOOK.i = clamp(BOOK.i, 0, n - 1); logPg.innerHTML = ''; for (const el of BOOK.pages[BOOK.i]) logPg.appendChild(el);
  logPg.classList.remove('turnN', 'turnP'); if (dir) { void logPg.offsetWidth; logPg.classList.add(dir > 0 ? 'turnN' : 'turnP'); }
  $('logNum').textContent = (BOOK.i + 1) + ' / ' + n; $('logPrev').classList.toggle('off', BOOK.i <= 0); $('logNext').classList.toggle('off', BOOK.i >= n - 1); $('logNav').style.visibility = n > 1 ? 'visible' : 'hidden';
  // „Mission starten“ steht unter der neuesten Kapitänsseite: der Knopf erscheint, sobald man auf ihr ist
  const nx = nextMis(), go = $('logGo'), onNewest = logTab === 'cap' && BOOK.i >= (BOOK.cap[curPage()] !== undefined ? BOOK.cap[curPage()] : 1e9);
  const show = onNewest && nx && nx.page === curPage(); go.classList.toggle('show', !!show); go.classList.toggle('run', !!MS.active); go.textContent = MS.active ? t('mis_running') : t('mis_start');
}
function turnPage(d) { if (!logOpen()) return; const j = clamp(BOOK.i + d, 0, BOOK.pages.length - 1); if (j === BOOK.i) return; BOOK.i = j; showBookPage(d); audio.page(); }
function openLog(tab) {
  unlock(); logTab = tab || (MS.fresh >= 0 ? 'cap' : logTab); $('log').classList.remove('page');   // ungelesene Seite: das Logbuch schlägt sie gleich auf
  for (const b of document.querySelectorAll('#logTabs .pill')) b.classList.toggle('on', b.dataset.tab === logTab);
  $('log').classList.add('open'); buildBook('new');
  if (logTab === 'cap' && MS.fresh >= 0) { MS.fresh = -1; MS.pageSeen = curPage(); syncMis(); save(); }
}
/** alter Name: öffnet das Logbuch beim Kapitän */
function openPage() { openLog('cap'); }
function closeLog() { if (!logOpen()) return; $('log').classList.remove('open'); lockMouse(); markHint(); }
/** Loch-Mission: hat man die Seite gelesen, kommt der Hinweis, das Loch am Sonartisch zu markieren (einmal) */
function markHint() { if (MS.active === 'm5' && MS.stage === 'mark' && !MS.markSeen && MS.fresh < 0) { MS.markSeen = true; save(); setTimeout(() => banner(t('m5_mark_h'), t('m5_mark')), 500); } }
for (const b of document.querySelectorAll('#logTabs .pill')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); openLog(b.dataset.tab); });
$('logPrev').addEventListener('pointerdown', (e) => { e.preventDefault(); turnPage(-1); });
$('logNext').addEventListener('pointerdown', (e) => { e.preventDefault(); turnPage(1); });
$('logGo').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!MS.active && $('logGo').classList.contains('show')) startMission(); });
// Wischen auf der Seite blättert um (ein Wisch öffnet kein Foto)
let logSwipe = null, logSwiped = false;
$('logText').addEventListener('pointerdown', (e) => { if (e.target.closest('#logNav')) return; logSwipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; logSwiped = false; });
$('logText').addEventListener('pointermove', (e) => { if (!logSwipe || e.pointerId !== logSwipe.id) return; const dx = e.clientX - logSwipe.x; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - logSwipe.y) * 1.3) { logSwiped = true; logSwipe = null; turnPage(dx < 0 ? 1 : -1); } });
for (const ev of ['pointerup', 'pointercancel']) $('logText').addEventListener(ev, () => { logSwipe = null; setTimeout(() => { logSwiped = false; }, 0); });
window.addEventListener('resize', () => { if (logOpen()) buildBook(BOOK.i); });
$('logClose').addEventListener('pointerdown', (e) => { e.preventDefault(); closeLog(); });
/** ein Foto groß zeigen; ein Tipp (oder Esc) schließt es wieder */
const bigEl = $('photoBig'); function showBig(src) { bigEl.querySelector('img').src = src; bigEl.classList.add('open'); }
bigEl.addEventListener('pointerup', (e) => { e.preventDefault(); bigEl.classList.remove('open'); });
let noteT = 0; function note(t) { const n = $('note'); n.textContent = t; noteT = 4; }
// ---------- Einstellungen: Sichtfeld ----------
$('gear').addEventListener('pointerdown', (e) => { e.preventDefault(); openMenu(); });
// Sprache, Vollbild, neu beginnen
function texts() { for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t); ui(); syncFov(); goText(); if (M.panel === 'boat') fillBoats(); if (M.panel === 'help') fillHelp(); if (M.panel === 'mis') fillMis(); if (tapesOpen) fillTapes(); syncWhale(); syncPerf(); for (const b of document.querySelectorAll('#langs .pill')) b.classList.toggle('on', b.dataset.l === getLang()); hintEl.textContent = PC ? t('hint_pc') : t('hint_touch'); }
for (const b of document.querySelectorAll('#langs .pill')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); setLang(b.dataset.l); texts(); });
if (!document.fullscreenEnabled) $('fsBtn').style.display = 'none';
function toggleFs() { fsT = performance.now(); try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().then(() => { try { screen.orientation.unlock(); } catch (x) { /* egal */ } }).catch(() => {}); } catch (x) { /* egal */ } }
$('fsBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); toggleFs(); });
$('fsTop').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); toggleFs(); });
/** der Vollbildknopf (nur am PC) steht oben links gleich rechts neben ❚❚; im Vollbild zeigen die Ecken nach innen */
function fsPlace() { if (!FS_OK || !PC) return; const r = $('gear').getBoundingClientRect(); if (r.width) $('fsTop').style.left = Math.round(r.right + 8) + 'px'; }
document.addEventListener('fullscreenchange', () => { fsT = performance.now(); $('fsIco').setAttribute('d', document.fullscreenElement ? 'M5 1.5V5H1.5M12.5 5H9V1.5M9 12.5V9h3.5M1.5 9H5v3.5' : 'M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9'); if (started && !M.open && PC && !devOpen() && V.st !== 'table' && !$('log').classList.contains('open') && !tapesOpen && !horchOpen) setTimeout(lockMouse, 60); });
let resetArm = 0; $('resetBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (resetArm && performance.now() - resetArm < 4000) { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(PH_KEY); for (const k of ['devsuit', 'devflood', 'devdeep', 'devreveal', 'devcam']) localStorage.removeItem('tiefenlicht.' + k); } catch (x) { /* egal */ } noSave = true; location.reload(); } else { resetArm = performance.now(); $('resetBtn').textContent = t('reset_sure'); setTimeout(() => { $('resetBtn').textContent = t('reset'); }, 4000); } });
function syncPerf() { $('perf').value = perf; $('perfV').textContent = t('perf_n')[perf]; $('perfD').textContent = t('perf_d')[perf]; }
$('perf').addEventListener('input', (e) => { perf = +e.target.value; try { localStorage.setItem('tiefenlicht.perf', String(perf)); } catch (x) { /* egal */ } applyPerf(); resize(); syncPerf(); });
function syncFov() { $('fovO').value = FOV.out; $('fovI').value = FOV.in; $('fovOV').textContent = Math.round(fovFor('out')) + '°'; $('fovIV').textContent = Math.round(fovFor('in')) + '°'; }
for (const [id, k] of [['fovO', 'out'], ['fovI', 'in']]) $(id).addEventListener('input', (e) => { FOV[k] = +e.target.value; try { localStorage.setItem('tiefenlicht.fov', JSON.stringify(FOV)); } catch (x) { /* egal */ } resize(); syncFov(); });
// Walgesänge: Lautstärke, Häufigkeit, an/aus (gespeichert; dieselben Werte stehen auch im Entwicklermenü)
const WH_KEY = 'tiefenlicht.whale', whGap = (s) => Math.round(120 * Math.pow(8 / 120, s)), whPos = (g) => clamp(Math.log(g / 120) / Math.log(8 / 120), 0, 1);
try { const w = JSON.parse(localStorage.getItem(WH_KEY) || 'null'); if (w) { if (w.gap > 0) audio.whaleCfg.gap = w.gap; if (w.vol >= 0) audio.whaleCfg.vol = Math.min(2, w.vol); audio.whaleCfg.on = w.on !== false; } } catch (e) { /* egal */ }
function saveWhale() { try { localStorage.setItem(WH_KEY, JSON.stringify(audio.whaleCfg)); } catch (e) { /* egal */ } }
function syncWhale() { const w = audio.whaleCfg; $('whV').value = w.vol; $('whVV').textContent = Math.round(w.vol * 100) + ' %'; $('whG').value = whPos(w.gap); $('whGV').textContent = t('wh_every', { s: Math.round(w.gap) }); $('whOn').textContent = w.on ? t('on') : t('off'); $('whOn').classList.toggle('on', w.on); }
$('whV').addEventListener('input', (e) => { audio.whaleCfg.vol = +e.target.value; saveWhale(); syncWhale(); });
$('whG').addEventListener('input', (e) => { audio.whaleCfg.gap = whGap(+e.target.value); saveWhale(); syncWhale(); });
$('whOn').addEventListener('pointerdown', (e) => { e.preventDefault(); audio.whaleCfg.on = !audio.whaleCfg.on; saveWhale(); syncWhale(); });
modeEl.addEventListener('pointerdown', (e) => { e.preventDefault(); setMode(V.mode === 'in' ? 'out' : 'in'); });
$('tableClose').addEventListener('pointerdown', (e) => { e.preventDefault(); setSt('walk'); });
$('tableClear').addEventListener('pointerdown', (e) => { e.preventDefault(); nav.course = null; });
$('tableCv').addEventListener('pointerdown', (e) => { e.preventDefault(); const r = e.target.getBoundingClientRect(); table.tap((e.clientX - r.left) / r.width * e.target.width, (e.clientY - r.top) / r.height * e.target.height); });
function cabinStep(dt) {
  const g = cabin.group; g.position.copy(boat.group.position); g.rotation.copy(boat.group.rotation);
  let tx, ty, tz;
  if (V.st === 'walk') {
    const busy = horchOpen || logOpen(), K = busy ? {} : I.keys; let jx = busy ? 0 : I.jx, jy = busy ? 0 : I.jy; if (K.KeyA || K.ArrowLeft) jx -= 1; if (K.KeyD || K.ArrowRight) jx += 1; if (K.KeyW || K.ArrowUp) jy -= 1; if (K.KeyS || K.ArrowDown) jy += 1;
    const mag = Math.min(1, Math.hypot(jx, jy)), sy = Math.sin(V.yaw), cy = Math.cos(V.yaw);
    V.px = clamp(V.px + (sy * -jy - cy * jx) * 1.25 * dt, -0.45, 0.4); V.pz = clamp(V.pz + (cy * -jy + sy * jx) * 1.25 * dt, -1.62, 0.26);
    V.bob += mag * dt * 7.5; tx = V.px; ty = 1.56 + Math.sin(V.bob) * 0.02 * Math.min(1, mag * 2); tz = V.pz;
  } else if (V.st === 'seat') { tx = SEAT.x; ty = SEAT.y; tz = SEAT.z; V.yaw = clamp(V.yaw, -2.3, 2.3); }
  else { tx = -0.25; ty = 1.5; tz = -1.4; }
  V.hx = damp(V.hx, tx, 7, dt); V.hy = damp(V.hy, ty, 7, dt); V.hz = damp(V.hz, tz, 7, dt);
  cabin.head.position.set(V.hx, V.hy + FLOOR_Y, V.hz); cabin.head.rotation.set(V.pitch, Math.PI + V.yaw, 0);
  g.updateMatrixWorld(true); cabin.head.matrixWorld.decompose(camera.position, camera.quaternion, tmpS); camIn.position.copy(camera.position); camIn.quaternion.copy(camera.quaternion);
  U.uDeep.value = deepK(camera.position.y);
  cabin.update(dt, eyeL.set(-V.hx, V.hy, V.hz), winCol.set(0.07, 0.34, 0.52).multiplyScalar(U.uDeep.value * 1.5), pxScale);
  target = pickTarget(); cabin.highlight(target);
  table.step(dt);
  if (V.st === 'table') { table.draw(); if (frames % 12 === 0) $('tableInfo').textContent = nav.course ? t('table_course', { d: String(Math.round(Math.hypot(nav.course.x - S.x, nav.course.z - S.z) / 5) * 5).padStart(3, '0') }) : t('table_info'); }
  else if (frames % 6 === 0) { table.draw(cabin.scopeCtx, 256); cabin.scopeTex.needsUpdate = true; }
}
window.addEventListener('keydown', (e) => { if (e.repeat) return;
  if (e.code === 'Digit1' && PC && FS_OK && !(e.target && e.target.tagName === 'INPUT')) { toggleFs(); return; }
  if (bigEl.classList.contains('open')) { if (e.code === 'Escape') bigEl.classList.remove('open'); return; }
  if (M.open) { if (e.code === 'Escape' && performance.now() - escT > 350) { if (M.panel !== 'main') showPanel('main'); else if (started) closeMenu(); } else if (e.code === 'Enter' && M.panel === 'main') goBtn(); return; }
  if (e.code === 'KeyE' && devOn && started) { toggleDev(); return; }
  if (logOpen() && /^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(e.code)) { turnPage(e.code === 'KeyA' || e.code === 'ArrowLeft' ? -1 : 1); return; }   // im Logbuch blättern A / D statt zu gehen
  if (tapesOpen && (e.code === 'Escape' || e.code === 'KeyF')) { closeTapes(e.code === 'Escape'); return; }
  if (horchOpen && (e.code === 'Escape' || e.code === 'KeyF')) { closeHorch(e.code === 'Escape'); return; }
  if (CAMV.on) { if (e.code === 'Space') shoot(); else if (e.code === 'Escape' || e.code === 'KeyK') closeCam(); return; }
  if (V.mode === 'dive') { if (e.code === 'KeyF') actEl.dispatchEvent(new Event('pointerdown')); else if (e.code === 'Escape' && performance.now() - escT > 400 && started) { escT = performance.now(); openMenu(); } return; }
  if (e.code === 'KeyK' && started) { openCam(); return; }
  if (e.code === 'KeyQ' && started) { toggleFlood(); return; }
  if (e.code === 'KeyC') setMode(V.mode === 'in' ? 'out' : 'in'); if (e.code === 'KeyF') actEl.dispatchEvent(new Event('pointerdown'));
  if (e.code === 'KeyR' && started) ping(); if (e.code === 'KeyL' && started) { if (logOpen()) closeLog(); else openLog(); }
  if (e.code === 'Escape' && performance.now() - escT > 400) { if (devOpen()) toggleDev(false); else if (logOpen()) { $('log').classList.remove('open'); markHint(); } else if (V.st === 'table') setSt('walk'); else if (started) { escT = performance.now(); openMenu(); } } });

// ---------- Schleife ----------
let last = performance.now(), fpsT = 0, fpsN = 0, slowT = 0, hintT = 0;
const fpsEl = $('fps'), depthEl = $('depth'), echoEl = $('echo'), noteEl = $('note'), hintEl = $('hint'), adapt = !Q.has('nopr');
let tick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const capMs = PERF[perf].cap ? 1000 / PERF[perf].cap : 0;   // Bildrate begrenzen: Bilder, die zu früh kommen, werden ausgelassen
  if (capMs) { if (now - tick < capMs - 2) return; tick = now - tick > capMs * 2 ? now : tick + capMs; }
  const raw = (now - last) / 1000, dt = Math.min(0.05, Math.max(0.001, raw)); last = now;
  const run = !(started && M.open), showOut = M.open && M.panel === 'boat';
  if (run) U.uTime.value += dt; frames++; if (started && run) playTime += dt;
  if (showOut) { M.orb += dt * 0.3; C.oy += wrapPi(M.orb - C.oy) * (1 - Math.exp(-2.5 * dt)); C.op = damp(C.op, -0.1, 2, dt); C.idle = 0; }
  if (started && run) { drive(dt); props(dt); sonarStep(dt); if (frames % 2 === 0 && (V.mode === 'out' || V.st === 'seat')) sonarDraw(); }
  else { boat.group.position.set(S.x, S.y, S.z); boat.group.rotation.set(0, S.h, 0); boat.group.updateMatrixWorld(true); U.uSubPos.value.set(S.x, S.y, S.z); U.uSubA.value.set(0, 0, boat.body.z0).applyMatrix4(boat.group.matrixWorld); U.uSubB.value.set(0, 0, boat.body.z1).applyMatrix4(boat.group.matrixWorld); U.uLampPos.value.copy(boat.lampLocal).applyMatrix4(boat.group.matrixWorld); U.uWarmPos.value.copy(boat.warmLocal).applyMatrix4(boat.group.matrixWorld); U.uLampDir.value.set(0, -0.1, 1).normalize().transformDirection(boat.group.matrixWorld); }
  if (showOut) { const w = window.innerWidth, h = window.innerHeight, ch = $('menu').querySelector('.card').offsetHeight + 14; camera.setViewOffset(w, h, 0, Math.min(h * 0.4, ch * 0.5 + h * 0.1), w, h); } else if (camera.view && camera.view.enabled) camera.clearViewOffset();   // Boot über der Karte zeigen
  if (run || showOut) { world.update(S.x, S.z, started ? 1 : 0); if (CAMV.on && !showOut) camStep(); else if (V.mode === 'in' && !showOut) cabinStep(dt); else if (V.mode === 'dive' && !showOut) diveStep(dt); else cameraStep(dt); }
  if (window.__cam) { camera.position.set(...window.__cam[0]); camera.lookAt(...window.__cam[1]); }
  helmEl.style.visibility = showOut ? 'hidden' : '';
  if (run) { camera.getWorldDirection(fwd); S.vh = Math.atan2(fwd.x, fwd.z);   // Blickrichtung: dort tauchen Begegnungen und Schwärme auf
    life.update(dt, V.mode === 'dive' ? diver : S, pxScale, world.glows); fauna.update(dt, S, U.uTime.value); schools.update(dt, S, V.mode === 'dive' ? { x: diver.x, y: diver.y - 0.8, z: diver.z } : S); cans.update(); whales.update(dt, U.uTime.value, pxScale); hump.update(dt, U.uTime.value, pxScale); deepLife.update(dt, U.uTime.value, pxScale, S); humpStep(dt); }
  if (bannerT > 0 && run) { bannerT -= dt; if (bannerT <= 0) bannerEl.style.opacity = 0; }
  if (sonHintT > 0 && run) { sonHintT -= dt; if (sonHintT <= 0) $('sonHint').style.opacity = 0; }
  if (tapesOpen) drawTapes(dt);
  if (horchOpen && run) { const K = I.keys; horchDeg = (horchDeg + ((K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0)) * 45 * dt + 360) % 360; drawHorch(); }
  if (horchOpen && Math.abs(wrapPi((+hSl.value - horchDeg) * Math.PI / 180)) > 0.01) hSl.value = String(Math.round(((horchDeg + 180) % 360) - 180));   // Regler folgt, wenn mit A / D gedreht wird
  audio.setListener(S.x, S.z, S.h); audio.hydro(horchOpen && run, S.h - horchDeg * Math.PI / 180); cabin.setHorch(horchDeg, audio.hydroLevel());
  if (frames % 30 === 0 && devOpen()) devLive();
  if (thumbT > 0) { thumbT -= dt; if (thumbT <= 0) $('camThumb').classList.remove('show'); }
  if (CAMV.on && frames % 6 === 0) { $('camFrame').classList.toggle('ok', camTargetOk()); const ci = t('depth') + ' ' + String(Math.round(-S.y)).padStart(3, '0') + ' m'; if ($('camInfo').textContent !== ci) $('camInfo').textContent = ci; }
  if (frames % 4 === 0) { const cp = camera.position, d = Math.hypot(cp.x - PLAIN.x, cp.z - PLAIN.z) / PLAIN.r; snow.set((1 - smooth(0.9, 1.7, d)) * (1 - smooth(-82, -58, cp.y)), pxScale); }   // Schnee nur unten über der Ebene
  if (frames % 24 === 0) { let best = null; for (const m of marks) { const d = Math.hypot(m.x - S.x, m.z - S.z); if (!best || d < best) best = d; } if (MS.active === 'm5' && MS.stage === 'mark' && nav.course && Math.hypot(nav.course.x - HOLE.x, nav.course.z - HOLE.z) < 26) { MS.stage = 'bell'; MS.markSeen = true; nav.course.arm = false; syncMis(); save(); note(t('m5_marked')); audio.click(0.7); sonHint(); }
    // ein Kurs, der nah gesetzt wurde, bleibt, bis man einmal weg war
    if (nav.course) { const c = nav.course, d = Math.hypot(c.x - S.x, c.z - S.z); if (c.arm === undefined) c.arm = d > 45; else if (d > 45) c.arm = true; if (d < 28 && c.arm) nav.course = null; else best = -d; } echoEl.className = best < 0 ? 'kurs' : ''; echoEl.textContent = best ? (best < 0 ? t('course') + ' ' : t('echo') + ' ') + String(Math.round(Math.abs(best) / 5) * 5).padStart(3, '0') + ' m' : '';
    if (MS.active === 'm7' && MS.stage === 'lamp' && V.mode !== 'dive') { tightT -= dt; if (tightT <= 0 && Math.hypot(S.x - LAMP.x, S.z - LAMP.z) < 20) { banner(t('m7_tight_h'), t('m7_tight')); tightT = 40; } }   // das Boot kommt nicht heran: aussteigen
    if (MS.active && (!MS.stage || MS.stage === 'tanks')) { const l = cans.lamp(misIdx(MS.active)); nearCan = Math.hypot(l.x - S.x, l.z - S.z) < REACH && Math.abs(l.y - S.y) < REACH + 4; }
    nearBell = MS.active === 'm5' && MS.stage === 'bell' && V.mode !== 'dive' && Math.hypot(BELL.x - S.x, BELL.z - S.z) < 16 && S.y - floorH(BELL.x, BELL.z) < 18;
    $('camBtn').style.display = hasCam() && started && !CAMV.on && !horchOpen && !tapesOpen && (V.mode === 'out' || V.st === 'seat') ? 'block' : 'none';
    $('lampBtn').style.display = hasFlood() && started && !CAMV.on && !horchOpen && !tapesOpen && (V.mode === 'out' || V.st === 'seat') ? 'block' : 'none'; $('lampBtn').classList.toggle('on', MS.floodOn); { const cb = $('camBtn'); if (cb.offsetWidth) $('lampBtn').style.left = (cb.offsetLeft + cb.offsetWidth + 8) + 'px'; else $('lampBtn').style.left = ''; }   // direkt hinter den Kamera-Knopf, egal wie breit der ist
    const al = actLabel(), actL = $('actL'); if (actL.textContent !== al) { actL.textContent = al; actEl.style.display = al ? 'block' : 'none'; } }
  const bT = M.open ? (M.panel === 'boat' ? 0 : M.panel === 'set' ? 0.55 : 1) : 0, b0 = post.blur; post.blur = Math.abs(b0 - bT) < 0.004 ? bT : damp(b0, bT, 6, dt);
  if (run || showOut || M.dirty > 0 || post.blur !== b0) {   // ruht das Spiel hinter dem Menü, wird das Bild nur noch fertig weichgezeichnet und dann stehen gelassen
    M.dirty--; renderer.info.reset(); if (V.mode === 'in' && !showOut && !CAMV.on) post.render(scene, camera, cabinScene, camIn); else post.render(scene, camera);
    if (shootReq) { shootReq = false; if (CAMV.on) takePhoto(); } }
  fpsT += raw; fpsN++;
  if (fpsT >= 1) {
    const fps = fpsN / fpsT; fpsEl.textContent = Math.round(fps) + ' fps'; depthEl.textContent = t('depth') + ' ' + String(Math.round(-S.y)).padStart(3, '0') + ' m';
    if (adapt && started && run && fps < (PERF[perf].cap ? PERF[perf].cap * 0.83 : 50)) { slowT++; if (slowT >= 2) { slowT = 0; if (PR > 1.15) { PR = Math.max(1.1, PR - 0.25); resize(); } else if (MSAA) { MSAA = 0; resize(); } } } else slowT = 0;
    fpsT = 0; fpsN = 0;
  }
  if (tNote > 0) { tNote -= dt; noteEl.textContent = t('too_deep'); noteEl.style.opacity = tNote > 0.5 ? 1 : 0; } else if (noteT > 0) { noteT -= dt; noteEl.style.opacity = noteT > 0.6 ? 1 : 0; }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) hintEl.style.opacity = 0; }
}
function start() {
  if (started) return; started = true; audio.start();
  // einmal kurz in die Kabine und wieder hinaus, unter dem Titelbild: danach ist der Bildaufbau in demselben Zustand wie nach einem Besuch
  V.mode = 'in'; applyMode(); cabinStep(0.016); renderer.info.reset(); post.render(scene, camera, cabinScene, camIn); V.mode = 'out'; applyMode(); cameraStep(0.016); post.render(scene, camera);
  M.open = false; $('menu').classList.remove('open'); showPanel('main'); $('ui').classList.add('on'); last = performance.now(); ui(); texts(); homeT = 2.5;
  if (PC) { hintT = 0; hintEl.style.opacity = 0; grabEl.style.opacity = 0; lockMouse(); } else { hintEl.style.opacity = 1; hintT = 9; }
}
// ---------- Menü ----------
const PANELS = { main: 'mMain', boat: 'pBoat', set: 'pSet', help: 'pHelp', mis: 'pMis' };
function boatVis() { const v = (V.mode !== 'in' && !CAMV.on) || (M.open && M.panel === 'boat'); for (const o of boat.outer) o.visible = v; }
function showPanel(p) {
  const was = M.panel; M.panel = p; M.dirty = 60;
  for (const k in PANELS) $(PANELS[k]).classList.toggle('show', k === p);
  $('menu').classList.toggle('low', p === 'boat'); $('menu').classList.toggle('wide', p === 'help' || p === 'mis');
  if (p === 'boat') { M.orb = 2.3; if (V.mode === 'in') { C.yaw = S.h; C.oy = C.op = 0; C.dist = 10; C.pos.set(S.x - Math.sin(S.h) * 10, S.y + 3, S.z - Math.cos(S.h) * 10); C.look.set(S.x, S.y + 1, S.z); } fillBoats(); }
  else if (was === 'boat') homeT = 3;
  if (p === 'help') fillHelp(); if (p === 'mis') fillMis(); if (p === 'set') { syncFov(); syncWhale(); syncPerf(); }
  boatVis();
}
function goText() { $('mGo').textContent = started ? t('m_resume') : resumed ? t('m_continue') : t('m_dive'); $('mFoot').textContent = PC ? t('m_foot_pc') : ''; }
function openMenu() {
  if (M.open || !started) return; M.open = true; unlock();
  I.jx = I.jy = I.up = I.down = 0; I.joyId = I.lookId = null; joy.style.opacity = 0; knob.style.transform = ''; for (const k in I.keys) I.keys[k] = 0; for (const b of [$('up'), $('down')]) b.classList.remove('on');
  $('log').classList.remove('open'); closeTapes(); closeHorch(); if (V.st === 'table') setSt('walk');
  showPanel('main'); goText(); $('menu').classList.add('open'); grabEl.style.opacity = 0; audio.suspend(); ui();
}
function closeMenu() {
  if (!started) { start(); return; }
  M.open = false; showPanel('main'); $('menu').classList.remove('open'); boatVis(); audio.resume(); ui(); last = performance.now(); lockMouse();
}
function goBtn() { if (!$('menu').classList.contains('ready')) return; closeMenu(); }
function fillBoats() {
  const box = $('boats'); box.innerHTML = '';
  BOATS.forEach((b, i) => { const d = document.createElement('div'); d.className = 'boatCard' + (i === boatKind ? ' on' : '');
    const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = `linear-gradient(135deg, ${b.swatch[0]} 56%, ${b.swatch[1]} 56%)`;
    const n = document.createElement('span'); n.className = 'bn'; n.textContent = t('boat_' + b.id); const ds = document.createElement('span'); ds.className = 'bd'; ds.textContent = t('boatd_' + b.id);
    d.appendChild(sw); d.appendChild(n); d.appendChild(ds); d.addEventListener('pointerdown', (e) => { e.preventDefault(); setBoat(i); fillBoats(); }); box.appendChild(d); });
}
function setBoat(i) {
  if (i === boatKind) return; boatKind = i; try { localStorage.setItem('tiefenlicht.boat', String(i)); } catch (x) { /* egal */ }
  boat.dispose(); boat = createSub(scene, i); boatVis(); lampApply();
  boat.group.position.set(S.x, S.y, S.z); boat.group.rotation.set(S.pitch, S.h, S.roll); boat.group.updateMatrixWorld(true); M.dirty = 60;
}
function fillHelp() {
  const box = $('helpText'); box.innerHTML = '';
  for (const [h, tx] of t('help')) { const a = document.createElement('h4'); a.textContent = h; const p = document.createElement('div'); p.textContent = tx === '*' ? t(PC ? 'help_ctl_pc' : 'help_ctl_touch') : tx; box.appendChild(a); box.appendChild(p); }
}
$('mGo').addEventListener('pointerup', (e) => { e.preventDefault(); goBtn(); });
for (const [id, p] of [['mBoat', 'boat'], ['mSet', 'set'], ['mHelp', 'help'], ['mMis', 'mis']]) $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); showPanel(p); });
for (const b of document.querySelectorAll('.mBack')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); showPanel('main'); });
$('menu').classList.add('ready');
window.__sub = { deepLife, hump, syncHump, get humpWatchT() { return humpWatchT; }, set humpWatchT(v) { humpWatchT = v; }, get devHump() { return devHump; }, cave, CAVE, HOLE, get nearTooth() { return nearTooth; }, get nearCan2() { return nearCan2; }, get nearBell() { return nearBell; }, takeSuit, takeTooth, takeCan2, curPage, BOOK, replayMission, fillMis, pageHas, set devDeep(v) { devDeep = v; }, turnPage, toggleDev, buildDev, seen, misTarget, schools, diver, hullGap, suitOut, suitIn, helmetExhale, get nearHatch() { return nearHatch; }, audio, M, MS, cans, whales, syncPod, syncMis, sectors, echoes, CAMV, PHOTOS, openCam, closeCam, shoot, camTargetOk, photoTarget, openHorch, closeHorch, get horchDeg() { return horchDeg; }, set horchDeg(v) { horchDeg = v; }, startMission, takeCan, openPage, openLog, playTape, MISSIONS, openMenu, closeMenu, showPanel, setBoat, post, get boat() { return boat; }, save, load, texts, setLang, renderer, fauna, S, C, I, U, V, nav, setMode, setSt, table, cabin, tea, LOG, ACT, get target() { return target; }, start, ping, world, life, poisNear, floorH, get frames() { return frames; }, tp(x, y, z, h) { world.update(x, z, Infinity); S.x = x; S.y = y; S.z = z; S.h = h; S.vx = S.vy = S.vz = 0; C.yaw = h; C.oy = C.op = 0; C.pos.set(x - Math.sin(h) * 11, y + 3, z - Math.cos(h) * 11); C.look.set(x, y + 1, z); }, marks, info: () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls, PR, MSAA, chunks: world.chunks.size, near: world.near.length, glows: world.glows.length }) };
// ---------- Entwicklermenü (unter ⚙, Passwort) ----------
const DEV_PW = 'Entwicklung', devEl = $('dev'), pw = $('devPw');
let devOn = false; try { devOn = localStorage.getItem('tiefenlicht.dev') === '1'; } catch (e) { /* egal */ }
const devSecs = new Set(); try { for (const k of JSON.parse(localStorage.getItem('tiefenlicht.devsec') || '[]')) devSecs.add(k); } catch (e) { /* egal */ }
// am PC: E öffnet und schließt das Menü, solange es offen ist, bleibt die Maus frei (umsehen mit Klicken und Ziehen)
function devOpen() { return devEl.classList.contains('open'); }
function toggleDev(on = !devOpen()) { if (on) { devEl.classList.add('open'); buildDev(); unlock(); } else { devEl.classList.remove('open'); lockMouse(); } }
$('devBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (devOn) { devEl.classList.add('open'); buildDev(); closeMenu(); } else { pw.style.display = pw.style.display === 'inline-block' ? 'none' : 'inline-block'; pw.focus(); } });
pw.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { if (pw.value === DEV_PW) { devOn = true; try { localStorage.setItem('tiefenlicht.dev', '1'); } catch (x) { /* egal */ } pw.style.display = 'none'; pw.value = ''; devEl.classList.add('open'); buildDev(); closeMenu(); } else { pw.value = ''; pw.placeholder = '✗'; } } });
const MIX0 = Object.assign({}, audio.mix);
const DEV_NAMES = ['Laternenschlinger', 'Riesenbarsch', 'Gleiter', 'Hai'];
function devTp(x, z, faceX, faceZ) { const h = faceX === undefined ? S.h : Math.atan2(faceX - x, faceZ - z), y = Math.min(-12, faceX === undefined ? Math.max(floorH(x, z) + 6, S.y) : floorH(x, z) + 10); if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(x, y, z, h); save(); }
function tpTo(x, y, z, h) { world.update(x, z, Infinity); S.x = x; S.y = y; S.z = z; S.h = h; S.vx = S.vy = S.vz = 0; C.yaw = h; C.oy = C.op = 0; C.pos.set(x - Math.sin(h) * 14, y + 4, z - Math.cos(h) * 14); C.look.set(x, y + 1, z); }
function nearest(kind) { let best = null, bd = 1e9; for (const p of poisNear(S.x, S.z, 1500)) { if (p.kind !== kind) continue; const d = Math.hypot(p.x - S.x, p.z - S.z); if (d > 60 && d < bd) { bd = d; best = p; } } if (!best) for (const p of poisNear(S.x, S.z, 1500)) if (p.kind === kind) { best = p; break; } return best; }
/** Flutlicht (Entwicklerregler): trägt weiter und schneidet einen klaren Korridor in den Nebel, ohne breiter zu werden */
function lampDev() { lampApply(); }
let devFlood = false; try { devFlood = localStorage.getItem('tiefenlicht.devflood') === '1'; } catch (e) { /* egal */ }
const hasFlood = () => MS.flood || MS.done.includes('m7') || devFlood;
/** wirkt der starke Scheinwerfer gerade? Nur am Boot (nicht für die Helmlampe); der Entwicklerregler kann ihn zusätzlich aufdrehen */
function lampApply() { const k = V.mode === 'dive' ? devLamp : Math.max(devLamp, hasFlood() && MS.floodOn ? 3 : 1);
  U.uLampRange.value = Math.pow(k, 1.35); U.uLampFog.value = clamp((k - 1) / 4, 0, 1) * 0.92; if (V.mode !== 'dive') U.uLampOn.value = 1 + (k - 1) * 0.35; upg.fit(boat, hasFlood(), MS.floodOn); }
/** Q oder der Lampenknopf: an und aus, nur am Steuer oder draußen; beim Aufstehen bleibt es, wie es ist */
function toggleFlood() { if (!hasFlood() || !(V.mode === 'out' || (V.mode === 'in' && V.st === 'seat'))) return; MS.floodOn = !MS.floodOn; audio.click(0.9); lampApply(); note(t(MS.floodOn ? 'flood_on' : 'flood_off')); save(); }
function humpGo() { const c = hump.center(); if (!c) return; const a = Math.atan2(S.x - c.x, S.z - c.z) || 0.5, x = c.x + Math.sin(a) * 55, z = c.z + Math.cos(a) * 55; if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(x, -14, z, Math.atan2(c.x - x, c.z - z)); save(); }
function goTo(p) { if (!p) return; const a = Math.atan2(S.x - p.x, S.z - p.z), d = p.kind === 'wreck' ? 38 : p.kind === 'bell' ? 14 : 26; devTp(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, p.x, p.z); }
function buildDev() {
  const F = fauna; devEl.innerHTML = ''; let cur = devEl;
  // Klappreiter: ein Klick auf die Überschrift öffnet oder schließt den Abschnitt; welche offen sind, bleibt gespeichert
  const sec = (name) => { const h = document.createElement('div'), ar = document.createElement('span'), bd = document.createElement('div'); h.className = 'dsec' + (devSecs.has(name) ? ' open' : ''); ar.className = 'dar'; ar.textContent = '▸'; h.appendChild(ar); h.appendChild(document.createTextNode(name)); bd.className = 'dbody';
    h.addEventListener('pointerdown', (e) => { e.preventDefault(); if (devSecs.has(name)) devSecs.delete(name); else devSecs.add(name); h.classList.toggle('open', devSecs.has(name)); try { localStorage.setItem('tiefenlicht.devsec', JSON.stringify([...devSecs])); } catch (x) { /* egal */ } });
    devEl.appendChild(h); devEl.appendChild(bd); cur = bd; };
  const h3 = (t) => { const e = document.createElement('h3'); e.textContent = t; cur.appendChild(e); };
  let bn = 0; const btn = (label, fn, parent = cur) => { const b = document.createElement('span'), i = bn++; b.className = 'pill mini'; b.textContent = label; b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); if (!b.isConnected) devFlash(i); }); parent.appendChild(b); return b; };
  const row = () => { const r = document.createElement('div'); r.className = 'row'; cur.appendChild(r); return r; };
  // Regler: Name, Schieber, Wert
  const sl = (label, min, max, step, get, set, unit = ' s') => { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = get(); l.textContent = label; v.textContent = '≈' + get() + unit;
    s.addEventListener('input', () => { set(+s.value); v.textContent = '≈' + s.value + unit; devSave(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); };
  sec('TIERE');
  h3('FISCHE & HAI · ANZAHL UM DAS BOOT');
  DEV_NAMES.forEach((n, si) => { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = F.max[si]; s.step = 1; s.value = F.cfg[si].n; l.textContent = n; v.textContent = s.value;
    s.addEventListener('input', () => { F.setCount(si, +s.value); v.textContent = s.value; devSave(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); });
  h3('FISCHE & HAI · VOR MIR ERSCHEINEN LASSEN'); { const r = row(); r.style.flexWrap = 'wrap'; DEV_NAMES.forEach((n, si) => btn(n, () => F.spawnNear(si, S), r)); }
  h3('HAI'); sl('Hai kommt vorbei alle', 20, 300, 5, () => fauna.sharkGap, (x) => { fauna.sharkGap = x; fauna.sharkT = Math.min(fauna.sharkT, x); });
  { const r = row(); r.style.flexWrap = 'wrap'; btn('Hai jetzt vorbei', () => fauna.sharkPass(S), r); const lb = () => (F.attract ? 'Haie: kommen auf mich zu' : 'Haie auf mich zukommen lassen'), b = btn(lb(), () => { F.attract = !F.attract; b.textContent = lb(); devSave(); }, r); }
  h3('BEGEGNUNGEN'); sl('Begegnung alle', 8, 120, 1, () => fauna.encGap, (x) => { fauna.encGap = x; fauna.encT = Math.min(fauna.encT, x); });
  { const r = row(); btn('Begegnung jetzt', () => { if (!fauna.encounter(S)) note('Keine Begegnung möglich (zu flach)'); }, r); }
  h3('SCHWÄRME'); sl('Schwarm alle', 15, 300, 5, () => schools.gap, (x) => { schools.gap = x; schools.timer = Math.min(schools.timer, x); });
  { const r = row(); r.style.flexWrap = 'wrap';
    ['Kometenschwarm', 'Saphir-Plättchen', 'Neon-Säbelfische'].forEach((n, ti) => btn(n + ' jetzt', () => { const t = schools.types[ti]; t.on = false; t.m.visible = false; if (!schools.spawn(ti, S, true)) note('Hier ist kein Platz für den Schwarm (zu flach)'); devLive(); }, r));
    btn('Schwarm: Wirbel jetzt', () => schools.swirl(), r); btn('Schwärme weg', () => schools.clear(), r); }
  { const r2 = row(), l = document.createElement('span'); l.id = 'devLive'; l.style.fontSize = '11px'; r2.appendChild(l); devLive(); }
  sec('TIEFSEETIERE');
  { const C = deepLife.cfg, row1 = (label, key, max) => { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = max; s.step = 1; s.value = C[key]; l.textContent = label; v.textContent = s.value; s.addEventListener('input', () => { C[key] = +s.value; v.textContent = s.value; }); r.appendChild(l); r.appendChild(s); r.appendChild(v); };
    h3('HÄUFIGKEIT · HÖCHSTENS GLEICHZEITIG (AB 180 M, VOLL AB 240 M)'); row1('Laternenfisch-Schwärme', 'schools', 2); row1('Krill-Bänder', 'krill', 3); row1('Tiefsee-Mondfisch', 'mola', 2); row1('Laternenträger-Angler', 'angler', 3); row1('Riesen-Schlammstachel', 'eel', 3); row1('Riesen-Staatsqualle', 'siphon', 3);
    h3('SCHWARMGRÖSSE'); { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 20; s.max = 200; s.step = 10; s.value = C.schoolN; l.textContent = 'Laternenfische je Schwarm'; v.textContent = s.value; s.addEventListener('input', () => { C.schoolN = +s.value; v.textContent = s.value; }); r.appendChild(l); r.appendChild(s); r.appendChild(v); }
    h3('VOR MIR ERSCHEINEN LASSEN'); { const r = row(); r.style.flexWrap = 'wrap'; for (const [k, n] of [['school', 'Laternenfisch-Schwarm'], ['krill', 'Krill'], ['mola', 'Tiefsee-Mondfisch'], ['angler', 'Laternenträger-Angler'], ['eel', 'Riesen-Schlammstachel'], ['siphon', 'Riesen-Staatsqualle']]) btn(n, () => deepLife.spawnNear(k, S), r); btn('Tiefseetiere weg', () => deepLife.clear(), r); }
    { const r2 = row(), l = document.createElement('span'), c = deepLife.counts(); l.style.fontSize = '11px'; l.textContent = `gerade da: ${c.school} Schwärme, ${c.krill} Krill, ${c.mola} Mondfisch, ${c.angler} Angler, ${c.eel} Schlammstachel, ${c.siphon} Quallen`; r2.appendChild(l); } }
  sec('WALE');
  h3('POTTWALE'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Pottwale vor mich (Test)', () => { MS.pod = { x: S.x + Math.sin(S.h) * 70, z: S.z + Math.cos(S.h) * 70, kind: 'test', seed: Math.floor(Math.random() * 1e6) }; syncPod(); save(); buildDev(); }, r);
    btn('Pottwal-Ort neu würfeln', () => { MS.pod = choosePod(S.x, S.z, 400, POD_FIXED); syncPod(); save(); buildDev(); }, r); btn('zu den Pottwalen', () => { const c = whales.center(); if (c) devTp(c.x + 45, c.z + 30, c.x, c.z); }, r); btn('Pottwale weg', () => { MS.pod = null; syncPod(); save(); buildDev(); }, r);
    const r2 = row(), l = document.createElement('span'); l.style.fontSize = '11px'; const c = whales.center(); l.textContent = c ? `Pottwale (${MS.pod.kind}): ${Math.round(Math.hypot(c.x - S.x, c.z - S.z))} m entfernt` : 'keine Pottwale'; r2.appendChild(l); }
  h3('BUCKELWALE'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Buckelwale vor mich (Test)', () => { devHump = { x: S.x + Math.sin(S.h) * 70, z: S.z + Math.cos(S.h) * 70, seed: Math.floor(Math.random() * 1e6) }; syncHump(); buildDev(); }, r);
    btn('zu den Buckelwalen', humpGo, r); btn('Kraftschlag', () => hump.kick(), r);
    btn('Buckelwale weg', () => { devHump = null; humpShown = null; hump.setPod(null); syncHump(); buildDev(); }, r);
    const r2 = row(), l = document.createElement('span'); l.style.fontSize = '11px'; const c = hump.center(); l.textContent = c ? `Buckelwale: ${hump.list.length} Tiere, ${Math.round(Math.hypot(c.x - S.x, c.z - S.z))} m entfernt` : 'keine Buckelwale'; r2.appendChild(l); }
  sec('ORTE');
  { const r = row(); r.style.flexWrap = 'wrap';
    btn('Start', () => devTp(cxAt(-86), -86 + 0.001)); btn('Wrack', () => goTo({ x: -300, z: 236, kind: 'wreck' })); btn('Kristallgrotte', () => goTo({ x: 111, z: 63, kind: 'grove' }));
    btn('Schnee-Ebene', () => goTo({ x: PLAIN.x + 30, z: PLAIN.z + 26, kind: 'grove' })); btn('Walskelett', () => goTo({ x: WHALE.x, z: WHALE.z, kind: 'wreck' })); btn('Taucherglocke', () => goTo({ x: BELL.x, z: BELL.z, kind: 'bell' }));
    btn('Kristallhain', () => goTo(nearest('grove'))); btn('Korallengarten', () => goTo(nearest('garden'))); btn('Warmer Spalt', () => goTo(nearest('vent'))); btn('Loch', () => devTp(HOLE.x + 15, HOLE.z - 9, HOLE.x, HOLE.z)); const rv = btn(devReveal ? 'Orte: aufgedeckt' : 'Alle Orte aufdecken', () => { devReveal = !devReveal; try { localStorage.setItem('tiefenlicht.devreveal', devReveal ? '1' : '0'); } catch (x) { /* egal */ } rv.textContent = devReveal ? 'Orte: aufgedeckt' : 'Alle Orte aufdecken'; }); btn('Abgrund (Kante)', () => { if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(cxAt(215), -60, 215, 0); save(); }); btn('Abgrund (Grund)', () => { if (!devDeep) { note('Erst unter Ausrüstung die Tiefengrenze ausschalten'); return; } if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(90, floorH(90, 700) + 12, 700, 0); save(); });
    btn('Plateau (300 m)', () => { if (V.mode === 'in') { V.mode = 'out'; applyMode(); } const x = PLAT.x + PLAT.dx * 4, z = PLAT.z + PLAT.dz * 4; tpTo(x, floorH(x, z) + 4, z, Math.atan2(PLAT.dx, PLAT.dz)); save(); });
    btn('Tiefsee (250 m)', () => { if (V.mode === 'in') { V.mode = 'out'; applyMode(); } tpTo(60, -250, 640, 0); save(); }); }
  sec('MISSIONEN');
  h3('ALLGEMEIN'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('nächste starten', () => { startMission(); buildDev(); }, r);
    btn('zur Dose', () => { const l = misTarget() || (MS.active === 'm5' ? HOLE : null); if (!l) return; devTp(l.x + 14, l.z + 12, l.x, l.z); }, r);
    btn('alle zurücksetzen', () => { MS.active = null; MS.stage = null; MS.cam = false; MS.suit = false; MS.tooth = MS.can2 = false; MS.pod = null; MS.hump = null; MS.done.length = 0; MS.pageSeen = -1; cabin.state.tapeIn = 0; audio.tapeTrack(0); syncMis(); save(); }, r); }
  h3('DAS LOCH'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Loch-Mission starten', () => { MS.done = ['m1', 'm2', 'm3', 'm4']; MS.cam = true; MS.active = null; MS.stage = null; MS.suit = false; MS.tooth = MS.can2 = false; MS.markSeen = false; MS.pageSeen = 4; startMission(); buildDev(); }, r);
    btn('Loch: nächste Stufe', () => { if (MS.active !== 'm5') return; const ST = [null, 'mark', 'bell', 'cave', 'tooth'], NM = ['Dose am Rand', 'Seite lesen, Loch markieren', 'zur Glocke', 'Höhle: Zahn und Dose', 'zurück ins Boot'], k = (ST.indexOf(MS.stage) + 1) % ST.length; MS.stage = ST[k]; if (k >= 3) MS.suit = true; MS.tooth = MS.can2 = k === 4; MS.markSeen = k >= 2; syncMis(); save(); note('Stufe: ' + NM[k]); buildDev(); }, r);
    btn('zum Loch', () => devTp(HOLE.x + 15, HOLE.z - 9, HOLE.x, HOLE.z), r);
    btn('zum Zahn (Taucher)', () => { if (V.mode !== 'dive') return; const tt = CAVE.tooth; diver.x = tt.x - 2; diver.y = tt.y + 1.4; diver.z = tt.z - 1; diver.vx = diver.vy = diver.vz = 0; toggleDev(false); }, r);
    btn('in die Höhle (Taucher)', () => { if (!hasSuit()) { devSuit = true; try { localStorage.setItem('tiefenlicht.devsuit', '1'); } catch (x) { /* egal */ } } const go = () => { const m = CAVE.mid; diver.x = m.x - 0.8; diver.y = CAVE.floorY + 1.75; diver.z = m.z - 1.2; diver.vx = diver.vy = diver.vz = 0; diver.yaw = 0.6; }; toggleDev(false); if (V.mode === 'dive') go(); else { devTp(HOLE.x + 1, HOLE.z + 1); V.mode = 'in'; applyMode(); suitOut(); setTimeout(go, 700); } }, r);
    btn('Höhlendose zurücklegen', () => { MS.can2 = false; MS.tooth = false; if (MS.active === 'm5' && MS.stage === 'tooth') MS.stage = 'cave'; syncMis(); save(); }, r); }
  h3('AUFRÜSTUNG'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Aufrüstungs-Mission starten', () => { for (const d of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']) if (!MS.done.includes(d)) MS.done.push(d); MS.done = MS.done.filter((d) => d !== 'm7'); MS.cam = true; MS.suit = true; MS.active = null; MS.stage = null; MS.flood = MS.floodOn = false; MS.pageSeen = 7; syncMis(); startMission(MISSIONS[misIdx('m7')]); buildDev(); }, r);
    btn('zum Scheinwerfer (Boot)', () => devTp(LAMP.x + 22, LAMP.z + 10, LAMP.x, LAMP.z), r);
    btn('Scheinwerfer aufheben', () => { if (MS.active === 'm7' && MS.stage === 'lamp') { takeLamp(); lampAboard(); } }, r);
    btn('zu den Tanks', () => { const m = MISSIONS[misIdx('m7')]; devTp(m.x + 12, m.z + 10, m.x, m.z); }, r);
    const r2 = row(), l = document.createElement('span'); l.style.fontSize = '11px'; l.textContent = MS.active === 'm7' ? 'Stufe: ' + ({ lamp: 'Scheinwerfer am Wrack holen (zu Fuß)', lampback: 'zurück ins Boot', tanks: 'zu den Ballasttanks' }[MS.stage] || MS.stage) : 'Mission läuft nicht'; r2.appendChild(l); }
  h3('DIE SÄNGER'); { const r = row(); r.style.flexWrap = 'wrap';
    btn('Buckelwal-Mission starten', () => { devHump = null; MS.done = MS.done.filter((d) => d !== 'm6'); for (const d of ['m1', 'm2', 'm3', 'm4', 'm5']) if (!MS.done.includes(d)) MS.done.push(d); MS.cam = true; MS.active = null; MS.stage = null; MS.hump = null; MS.pageSeen = 6; syncMis(); startMission(MISSIONS[misIdx('m6')]); buildDev(); }, r);
    btn('zu den Buckelwalen', humpGo, r);
    btn('Wale ziehen jetzt weiter', humpMove, r);
    btn('Foto zählt als gemacht', () => { if (MS.active !== 'm6') return; if (MS.stage === 'listen') { MS.stage = 'watch'; syncMis(); } if (MS.stage === 'watch' && humpWatchT <= 0) humpWatchT = 10; }, r);
    btn('jetzt abtauchen', () => { if (MS.active !== 'm6') { hump.dive(); return; } if (MS.stage === 'listen') { MS.stage = 'watch'; syncMis(); } if (MS.stage === 'watch') humpWatchT = 0.01; }, r);
    const r2 = row(), l = document.createElement('span'); l.style.fontSize = '11px'; l.textContent = MS.active === 'm6' ? 'Stufe: ' + ({ listen: 'suchen', watch: humpWatchT > 0 ? 'Foto gemacht, gleich tauchen sie ab' : 'beobachten, Foto fehlt', follow: 'folgen', end: 'geschafft' }[MS.stage] || MS.stage) : 'Mission läuft nicht'; r2.appendChild(l); }
  sec('AUSRÜSTUNG');
  h3('BOOT'); { const r = row(); r.style.flexWrap = 'wrap'; const lb = () => (devDeep ? 'Tiefengrenze: aufgehoben' : 'Tiefengrenze aufheben'), b = btn(lb(), () => { devDeep = !devDeep; try { localStorage.setItem('tiefenlicht.devdeep', devDeep ? '1' : '0'); } catch (x) { /* egal */ } b.textContent = lb(); }, r); }
  { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 1; s.max = 5; s.step = 0.25; s.value = devLamp; l.textContent = 'Scheinwerfer'; v.textContent = devLamp + '×';
    s.addEventListener('input', () => { devLamp = +s.value; v.textContent = devLamp + '×'; try { localStorage.setItem('tiefenlicht.devlamp', String(devLamp)); } catch (x) { /* egal */ } U.uLampOn.value = (V.mode === 'dive' ? 0.5 : 1) * (1 + (devLamp - 1) * 0.35); lampDev(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); }
  { const r = row(); r.style.flexWrap = 'wrap'; const lb = () => (devFlood ? 'Flutlicht: frei' : 'Flutlicht freischalten'), b = btn(lb(), () => { devFlood = !devFlood; try { localStorage.setItem('tiefenlicht.devflood', devFlood ? '1' : '0'); } catch (x) { /* egal */ } b.textContent = lb(); lampApply(); }, r); }
  h3('TAUCHERANZUG'); { const r = row(); r.style.flexWrap = 'wrap';
    const sb = btn(devSuit ? 'Anzug: frei' : 'Anzug freischalten', () => { devSuit = !devSuit; try { localStorage.setItem('tiefenlicht.devsuit', devSuit ? '1' : '0'); } catch (x) { /* egal */ } sb.textContent = devSuit ? 'Anzug: frei' : 'Anzug freischalten'; }, r);
    btn('jetzt aussteigen', () => { if (!hasSuit()) { devSuit = true; try { localStorage.setItem('tiefenlicht.devsuit', '1'); } catch (x) { /* egal */ } } if (V.mode === 'out') { V.mode = 'in'; applyMode(); } toggleDev(false); suitOut(); }, r); btn('zurück ins Boot', () => suitIn(), r); }
  h3('KAMERA & HORCHER'); { const r = row(); r.style.flexWrap = 'wrap';
    const cb = btn(devCam ? 'Kamera: frei' : 'Kamera freischalten', () => { devCam = !devCam; try { localStorage.setItem('tiefenlicht.devcam', devCam ? '1' : '0'); } catch (x) { /* egal */ } cb.textContent = devCam ? 'Kamera: frei' : 'Kamera freischalten'; }, r);
    btn('Testquelle setzen', () => { const a = Math.random() * 6.2832, d = 450 + Math.random() * 300; let x = S.x + Math.sin(a) * d, z = S.z + Math.cos(a) * d; const k = Math.hypot(x, z) > BOUNDS.r * 0.9 ? BOUNDS.r * 0.9 / Math.hypot(x, z) : 1; x *= k; z *= k; audio.clickSrc.length = 0; audio.clickSrc.push({ x, z }); buildDev(); }, r);
    btn('Testquelle weg', () => { audio.clickSrc.length = 0; buildDev(); }, r); btn('zur Testquelle', () => { const q = audio.clickSrc[0]; if (q) devTp(q.x + 30, q.z + 30, q.x, q.z); }, r);
    const q = audio.clickSrc[0], r2 = row(), l = document.createElement('span'); l.style.fontSize = '11px';
    if (q) { const d = Math.hypot(q.x - S.x, q.z - S.z), b = ((S.h - Math.atan2(q.x - S.x, q.z - S.z)) * 180 / Math.PI % 360 + 360) % 360; l.textContent = `Testquelle: ${Math.round(d)} m, Peilung jetzt ≈${Math.round(b)}°`; } else l.textContent = 'keine Testquelle'; r2.appendChild(l); }
  sec('KLANG');
  h3('WALGESÄNGE'); { const wc = audio.whaleCfg;
    const sl = (label, min, max, step, get, set, fmt) => { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = get(); l.textContent = label; v.textContent = fmt(get());
      s.addEventListener('input', () => { set(+s.value); v.textContent = fmt(+s.value); saveWhale(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); };
    sl('Abstand', 6, 180, 1, () => wc.gap, (x) => { wc.gap = x; }, (x) => '≈' + x + ' s'); sl('Lautstärke', 0, 2, 0.05, () => wc.vol, (x) => { wc.vol = x; }, (x) => Math.round(x * 100) + '%');
    const r = row(); r.style.flexWrap = 'wrap'; const b = btn(wc.on ? 'an' : 'aus', () => { wc.on = !wc.on; b.textContent = wc.on ? 'an' : 'aus'; saveWhale(); }, r); btn('jetzt einer', () => audio.whale(true), r); }
  h3('MISCHPULT'); { const NM = { rausch: 'Rauschen der Tiefe', wasser: 'Wasser am Rumpf', blasen: 'Blasen', motor: 'Motor', grollen: 'fernes Grollen', wale: 'Walgesänge (zusätzlich)', sonar: 'Sonar', kassette: 'Kassetten', kabine: 'Kabine (Kessel, Ofen, Klicks)' };
    for (const k in NM) { const r = row(), l = document.createElement('span'), v = document.createElement('span'), s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 3; s.step = 0.05; s.value = audio.mix[k]; l.textContent = NM[k]; v.textContent = Math.round(audio.mix[k] * 100) + '%';
      s.addEventListener('input', () => { audio.setMix(k, +s.value); v.textContent = Math.round(+s.value * 100) + '%'; devSave(); }); r.appendChild(l); r.appendChild(s); r.appendChild(v); }
    const r = row(); btn('Mischpult zurücksetzen', () => { for (const [k, v] of Object.entries(MIX0)) audio.setMix(k, v); devSave(); buildDev(); }, r); }
  h3('DIAGNOSE'); { const r = row(), l = document.createElement('span'); l.textContent = audio.info(); l.style.fontSize = '11px'; r.appendChild(l);
    const r2 = row(); r2.style.flexWrap = 'wrap'; const hb = btn('Hall ' + (audio.hall ? 'an' : 'aus'), () => { audio.setHall(!audio.hall); hb.textContent = 'Hall ' + (audio.hall ? 'an' : 'aus'); }, r2);
    btn('alles stumm', () => { for (const k in audio.mix) audio.setMix(k, 0); audio.whaleCfg.on = false; buildDev(); }, r2); }
  sec('SONSTIGES');
  { const r = row(); r.style.flexWrap = 'wrap';
    btn('Tee sofort fertig', () => { tea.phase = 'ready'; }, r); btn('Logbuch leeren', () => { LOG.length = 0; seen.clear(); save(); }, r); btn('Menü sperren', () => { devOn = false; try { localStorage.removeItem('tiefenlicht.dev'); } catch (x) { /* egal */ } devEl.classList.remove('open'); }, r); btn('schließen', () => toggleDev(false), r); }
}
/** baut ein Knopf das Menü neu auf, leuchtet der neue Knopf an derselben Stelle kurz auf, damit man den Druck trotzdem sieht */
function devFlash(i) { const nb = devEl.querySelectorAll('.pill.mini')[i]; if (!nb) return; nb.classList.add('press'); setTimeout(() => nb.classList.remove('press'), 160); }
function devSave() { try { localStorage.setItem('tiefenlicht.devcfg', JSON.stringify({ n: fauna.cfg.map((c) => c.n), attract: fauna.attract, mix: audio.mix, mixV: 1, enc: fauna.encGap, shk: fauna.sharkGap, sch: schools.gap, nV: 3 })); } catch (e) { /* egal */ } }
/** Live-Anzeige im Entwicklermenü: was gerade in der Nähe schwimmt */
function devLive() { const l = $('devLive'); if (!l) return; const f = fauna.countNear(S.x, S.z, 60), sc = schools.countNear(S.x, S.z, 60), names = ['Komet', 'Saphir', 'Säbel'], on = schools.types.filter((t) => t.on).map((t) => names[t.ti] + ' ' + Math.round(Math.hypot(t.x - S.x, t.z - S.z)) + ' m'); l.textContent = `im Umkreis 60 m: ${f} Tiere, ${sc} Schwarmfische · Schwärme: ${on.length ? on.join(', ') : 'keiner'} · nächster Hai in ${Math.max(0, Math.round(fauna.sharkT))} s`; }
try { const d = JSON.parse(localStorage.getItem('tiefenlicht.devcfg') || 'null'); if (d) { if (d.nV === 3) { d.n.forEach((n, si) => fauna.setCount(si, n)); if (d.enc) fauna.encGap = d.enc; if (d.shk) fauna.sharkGap = d.shk; if (d.sch) schools.gap = d.sch; } fauna.attract = !!d.attract; if (d.mix && d.mixV === 1) for (const k in d.mix) if (k in audio.mix) audio.setMix(k, +d.mix[k]); } } catch (e) { /* egal */ }

// ---------- Speichern: automatisch alle paar Sekunden und beim Verlassen ----------
const SAVE_KEY = 'tiefenlicht.save.v1'; let noSave = false;
function save() { if (noSave || !started) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, s: [S.x, S.y, S.z, S.h], log: LOG, seen: [...seen], course: nav.course, lamp: cabin.state.lampT, play: playTime, ms: { a: MS.active, d: MS.done, p: MS.pageSeen, t: cabin.state.tapeIn, h: MS.hint, s: MS.stage, c: MS.cam, w: MS.pod, hu: MS.hump, fl: MS.flood, fo: MS.floodOn, u: MS.suit, o: MS.tooth, k: MS.can2, m: MS.markSeen, x: MS.pmax, g: MS.got, f: MS.fresh }, at: Date.now() })); } catch (e) { /* ohne Speicher */ } }
function load() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d || d.v !== 1 || !Array.isArray(d.s)) return false;
    [S.x, S.y, S.z, S.h] = d.s; C.yaw = S.h; C.pos.set(S.x - Math.sin(S.h) * 14, S.y + 4, S.z - Math.cos(S.h) * 14); C.look.set(S.x, S.y + 1, S.z);
    for (const e of d.log || []) LOG.push(e); for (const k of d.seen || []) seen.add(k); nav.course = d.course || null; cabin.state.lampT = cabin.state.lamp = d.lamp == null ? 1 : d.lamp; playTime = d.play || 0;
    if (d.ms) { MS.done = (d.ms.d || []).filter((id) => misIdx(id) >= 0); MS.active = misIdx(d.ms.a) >= 0 && !MS.done.includes(d.ms.a) ? d.ms.a : null; MS.pageSeen = d.ms.p == null ? -1 : d.ms.p; MS.hint = d.ms.h || null; MS.stage = MS.active ? d.ms.s || null : null; MS.cam = !!d.ms.c || MS.done.includes('m3'); MS.suit = !!d.ms.u; MS.pod = d.ms.w || null; MS.hump = d.ms.hu || null; MS.flood = !!d.ms.fl; MS.floodOn = !!d.ms.fo; if (MS.active === 'm6' && (MS.stage === 'follow' || MS.stage === 'end')) MS.stage = 'watch'; MS.tooth = !!d.ms.o || MS.stage === 'tooth'; MS.can2 = !!d.ms.k || MS.stage === 'tooth'; MS.markSeen = d.ms.m !== false; MS.pmax = d.ms.x || 0; MS.got = Array.isArray(d.ms.g) ? d.ms.g : null; MS.fresh = d.ms.f == null ? -2 : d.ms.f; cabin.state.tapeIn = d.ms.t || 0; audio.tapeTrack(cabin.state.tapeIn); }
    return true; } catch (e) { return false; }
}
const resumed = load(); if (MS.fresh === -2) { MS.fresh = -1; trackPages(); if (MS.pageSeen < curPage()) MS.fresh = curPage(); } syncMis();   // alte Spielstände: ungelesene neueste Seite bleibt frisch
setInterval(save, 5000); window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
texts();
world.update(S.x, S.z, Infinity);
requestAnimationFrame(frame);
