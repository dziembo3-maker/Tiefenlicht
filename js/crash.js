// crash.js – die Probefahrt (Mission 8): Strömung, Absturz auf das Plateau an der Abgrundwand, die alte Kittiwake des Kapitäns und die Reparatur.
// Hier stehen nur Bild und Orte; den Ablauf (Stufen, Steuerung, Texte) führt main.js.
import { T, glowTexture } from './util.js';
import { B, propMaterial } from './props.js';
import { floorH, PLAT } from './terrain.js';

const PI = Math.PI, D = [PLAT.dx, PLAT.dz], TN = [-PLAT.dz, PLAT.dx];
const at = (a, b) => ({ x: PLAT.x + D[0] * a + TN[0] * b, z: PLAT.z + D[1] * a + TN[1] * b });
const YAW_OUT = Math.atan2(D[0], D[1]);   // Blick vom Plateau hinaus über den Abgrund
/** hier schlägt das Boot auf und bleibt liegen (Kufen auf dem Grund) */
export const LAND = (() => { const p = at(2, -9); return { x: p.x, z: p.z, y: floorH(p.x, p.z) + 1.5, h: YAW_OUT + 0.3 }; })();
/** von hier fällt das Boot nach dem Sprung im Trüben in einer Spirale hinab */
export const FALL0 = (() => { const p = at(42, -4); return { x: p.x, y: -205, z: p.z }; })();
/** die Kittiwake: Bug zum Abgrund, Tür (lokal +x) zur Landestelle */
export const KIT = (() => { const p = at(3, 11); return { x: p.x, z: p.z, y: floorH(p.x, p.z) + 0.95, yaw: YAW_OUT, tilt: 0.04, roll: -0.12 }; })();
/** Riss im unteren rechten Ballasttank, je Bootsform (Bootskoordinaten vor der Skalierung): Punkt und Außenrichtung */
const TEAR = [{ p: [1.17, -0.72, -0.15], n: [0.7, -0.7, 0] }, { p: [1.02, -0.74, -0.55], n: [0.7, -0.7, 0] }, { p: [1.25, -0.83, -0.25], n: [0.7, -0.7, 0] }];

const R = (() => { let s = 91; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(), rr = (a, b) => a + R() * (b - a);
const kitM = new T.Matrix4().makeRotationFromEuler(new T.Euler(KIT.tilt, KIT.yaw, KIT.roll, 'YXZ')).setPosition(KIT.x, KIT.y, KIT.z);
const kitPt = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(kitM);

// ---------- die Kittiwake: älter und kantiger als das eigene Boot, verrostet, bewachsen, voller Seepocken, die Fenster trüb ----------
const HULL = [[-3.55, 0.0], [-3.45, 0.32], [-3.05, 0.78], [-2.4, 1.08], [-1.3, 1.24], [1.1, 1.24], [2.1, 1.14], [2.8, 0.92], [3.25, 0.58], [3.42, 0.0]];
const hullR = (z) => { for (let i = 0; i < HULL.length - 1; i++) if (z <= HULL[i + 1][0]) { const t = (z - HULL[i][0]) / (HULL[i + 1][0] - HULL[i][0]); return HULL[i][1] + (HULL[i + 1][1] - HULL[i][1]) * Math.max(0, t); } return 0; };
const DOOR = { z: 0.45, y: 0.0, w: 0.46, h: 0.78 };   // Tür auf der Steuerbordseite (lokal +x): Mitte, halbe Breite, halbe Höhe

function buildKittiwake() {
  const g = new B();
  { const s = g.c; g.lathe(0, 0, 0, HULL, 10, 2); g.place(s, 0, 0, 0, 0, PI / 2, 0); }   // achtkantig wirkender Rumpf: wenige Seiten, harte Kanten
  for (const z of [-2.5, -1.3, -0.1, 1.1, 2.15]) { const s = g.c; g.ring(0, 0, 0, hullR(z) + 0.03, 0.045, 5, 10, 2, 'z'); g.place(s, 0, 0, z, 0); }   // genietete Spanten
  for (let i = 0; i < 46; i++) { const z = -2.9 + (i % 23) * 0.26, a = (i < 23 ? 0.55 : PI - 0.55), r = hullR(z) + 0.05; g.blob(Math.cos(a) * r, Math.sin(a) * r, z, 0.022, 0.022, 0.022, 0, 4, 0.05, i); }   // Nietreihen
  // Bugfenster: trüb, mit schwerem Rahmen und Gitter
  g.blob(0, 0.08, 2.88, 0.72, 0.66, 0.56, 2, 3, 0.03, 4);
  { const s = g.c; g.ring(0, 0, 0, 0.76, 0.07, 6, 12, 2, 'z'); g.place(s, 0, 0.08, 2.86, 0); }
  for (const x of [-0.25, 0.25]) g.tube([[x, 0.72, 2.92, 0.025], [x, 0.1, 3.3, 0.025], [x, -0.55, 2.95, 0.025]], 5, 2, 1, [1, 0, 0], false);
  // Turm: sechskantig, schräg nach hinten, mit Lukenrand, Sehrohr und abgeknicktem Mast
  { const s = g.c; g.lathe(0, 0, 0, [[0, 0.72], [0.55, 0.66], [0.72, 0.56], [0.78, 0.0]], 6, 2); g.place(s, 0, 1.05, -0.45, PI / 6, -0.08, 0); }
  g.ring(0, 1.84, -0.4, 0.36, 0.05, 5, 12, 4);
  g.tube([[0.18, 1.6, -0.8, 0.045], [0.18, 2.45, -0.86, 0.04], [0.18, 2.55, -0.72, 0.04]], 6, 2);
  g.tube([[-0.22, 1.7, -0.75, 0.03], [-0.22, 2.2, -0.8, 0.03], [-0.6, 2.35, -1.2, 0.025]], 5, 2);
  // Bullaugen beidseits, blind vor Schlamm
  for (const sx of [-1, 1]) for (const z of [-1.7, -0.75, 1.55]) { if (sx > 0 && Math.abs(z - DOOR.z) < 0.7) continue; const r = hullR(z), y = 0.22, x = sx * Math.sqrt(Math.max(0.01, r * r - y * y)); const s = g.c; g.ring(0, 0, 0, 0.2, 0.045, 5, 12, 4, 'x'); g.place(s, x, y, z, 0); g.blob(x - sx * 0.02, y, z, 0.03, 0.17, 0.17, 1, 3, 0.02, z); }
  // Tür offen: dunkle Öffnung mit Rahmen, das Blatt nach vorn aufgeschwungen, unten eine Schwelle
  { const r = hullR(DOOR.z), x = r - 0.04;
    g.blob(x + 0.02, DOOR.y, DOOR.z, 0.07, DOOR.h, DOOR.w, 1, 5, 0.02, 7);
    const fr = []; for (const [yy, zz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]) fr.push([x + 0.1, DOOR.y + yy * (DOOR.h + 0.06), DOOR.z + zz * (DOOR.w + 0.06), 0.05]); g.tube(fr, 5, 4, 1, [1, 0, 0], false);
    const s = g.c; g.blob(0, 0, DOOR.w, 0.05, DOOR.h, DOOR.w, 1, 2, 0.04, 8); g.blob(0.06, 0.1, DOOR.w * 1.7, 0.04, 0.05, 0.05, 0, 4, 0, 1); g.place(s, x + 0.12, DOOR.y, DOOR.z + DOOR.w + 0.04, -1.75);
    g.blob(x + 0.22, DOOR.y - DOOR.h - 0.05, DOOR.z, 0.34, 0.06, DOOR.w + 0.12, 1, 2, 0.05, 9); }
  // Heck: Flossen, Schutzring
  g.blob(0, 0.72, -3.1, 0.05, 0.62, 0.38, 1, 2, 0.05, 11); g.blob(0, -0.72, -3.1, 0.05, 0.62, 0.38, 1, 2, 0.05, 12);
  g.blob(0.72, 0, -3.1, 0.62, 0.05, 0.38, 1, 2, 0.05, 13); g.blob(-0.72, 0, -3.1, 0.62, 0.05, 0.38, 1, 2, 0.05, 14);
  { const s = g.c; g.ring(0, 0, 0, 0.72, 0.06, 6, 16, 2, 'z'); g.place(s, 0, 0, -3.68, 0); }
  for (const [x, y] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) g.tube([[x * 0.36, y * 0.36, -3.3, 0.035], [x * 0.72, y * 0.72, -3.68, 0.035]], 5, 2);
  // Kufen
  for (const sx of [-1, 1]) g.tube([[sx * 0.6, -1.05, -1.6, 0.06], [sx * 0.62, -1.3, -1.2, 0.06], [sx * 0.62, -1.32, 1.4, 0.06], [sx * 0.6, -1.08, 1.8, 0.06]], 6, 2);
  // Ballasttanks, beide zerstört: backbord in zwei Hälften zerrissen, steuerbord aufgeschlitzt und eingedrückt, abgesackt
  { const y = -0.6, x = -1.32;
    g.tube([[x, y, 0.35, 0.3], [x, y, 0.9, 0.38], [x, y, 1.5, 0.36], [x, y, 1.85, 0.0]], 9, 2);
    g.tube([[x - 0.05, y - 0.2, -2.25, 0.0], [x - 0.04, y - 0.16, -1.9, 0.36], [x - 0.02, y - 0.1, -1.1, 0.38], [x, y - 0.05, -0.55, 0.32]], 9, 2);
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2, c = Math.cos(a), s = Math.sin(a); g.blob(x + c * 0.36, y + s * 0.36, 0.28 + R() * 0.1, 0.03, 0.12, 0.16 + R() * 0.14, 1, 2, 0.4, i + 20, a); g.blob(x + c * 0.33, y - 0.05 + s * 0.33, -0.42 - R() * 0.12, 0.03, 0.1, 0.12 + R() * 0.16, 1, 2, 0.45, i + 40, a); }
    g.blob(x, y, 0.2, 0.25, 0.25, 0.04, 1, 5, 0.1, 61); g.blob(x, y - 0.05, -0.38, 0.24, 0.24, 0.04, 1, 5, 0.1, 62); }
  { const y = -0.78, x = 1.36;
    g.tube([[x, y + 0.1, -2.2, 0.0], [x, y + 0.08, -1.85, 0.34], [x + 0.05, y - 0.02, -0.9, 0.26], [x, y, 0.1, 0.36], [x - 0.02, y + 0.05, 1.3, 0.37], [x - 0.02, y + 0.05, 1.7, 0.0]], 9, 2, 0.8);
    g.blob(x + 0.3, y + 0.04, -0.25, 0.06, 0.08, 1.05, 1, 5, 0.25, 63);
    for (let i = 0; i < 6; i++) g.blob(x + 0.36, y + 0.1 - (i % 2) * 0.16, -1.05 + i * 0.32, 0.18, 0.025, 0.12, 0, 2, 0.4, i + 70, 0.6); }
  // Seepocken und Bewuchs: dicht auf den oberen Flächen, ein paar große Klumpen
  for (let i = 0; i < 260; i++) { const z = rr(-3.2, 3.0), a = rr(-0.2, PI + 0.2), r = hullR(z); if (r < 0.2) continue; if (Math.cos(a) * r > r - 0.4 && Math.abs(z - DOOR.z) < DOOR.w + 0.2 && Math.abs(Math.sin(a) * r - DOOR.y) < DOOR.h + 0.2) continue;
    const s = rr(0.025, 0.07), x = Math.cos(a) * (r + s * 0.4), y = Math.sin(a) * (r + s * 0.4); g.blob(x, y, z, s, s * 0.8, s, 0, R() < 0.8 ? 1 : 2, 0.2, i); }
  for (let i = 0; i < 14; i++) { const z = rr(-2.8, 2.4), a = rr(0.3, PI - 0.3), r = hullR(z), s = rr(0.08, 0.2); g.blob(Math.cos(a) * r, Math.sin(a) * r + s * 0.3, z, s * 1.4, s, s * 1.2, 1, 2, 0.35, i + 300); }
  g.place(0, KIT.x, KIT.y, KIT.z, KIT.yaw, KIT.tilt, KIT.roll);
  // Trümmer im Sand: ein abgerissenes Stück Tankblech, Nieten
  { const p = kitPt(-2.4, -0.95, -0.1), s = g.c; g.blob(0, 0, 0, 0.42, 0.04, 0.3, 1, 2, 0.35, 80); g.place(s, p.x, floorH(p.x, p.z) + 0.03, p.z, 0.7, 0.1, 0.25); }
  g.occlude(1.2);
  return g.build();
}
/** Schraube der Kittiwake: Messing, vier breite Blätter, unversehrt; in Bootskoordinaten der Kittiwake um ihren Nabenpunkt */
function buildKitProp() {
  const g = new B(); g.blob(0, 0, 0, 0.12, 0.12, 0.2, 1, 4, 0.03, 1);
  for (let i = 0; i < 4; i++) { const s = g.c; g.blob(0, 0.3, 0, 0.13, 0.26, 0.025, 1, 4, 0.05, i + 2); g.place(s, 0, 0, 0, 0.45, 0, 0); g.place(s, 0, 0, 0, 0, 0, i * PI / 2); }   // Blätter angestellt, dann rundum verteilt
  return g;
}
/** Dose und Schweißgerät gleich hinter der Schwelle */
const TOOLS_L = [DOOR.z, DOOR.y - DOOR.h + 0.05];
function buildTools() {
  const g = new B(), x0 = hullR(DOOR.z) - 0.05;
  { const s = g.c; g.lathe(0, 0, 0, [[0, 0.0], [0, 0.2], [0.03, 0.22], [0.1, 0.22], [0.12, 0.205], [0.62, 0.205], [0.64, 0.22], [0.72, 0.22], [0.74, 0.2], [0.76, 0.0]], 14, 4);
    for (const y of [0.25, 0.5]) g.ring(0, y, 0, 0.21, 0.014, 5, 16, 4); g.place(s, x0 + 0.12, TOOLS_L[1] + 0.2, DOOR.z - 0.38, 0.4, PI / 2, 0); }
  { const s = g.c; g.lathe(0, 0, 0, [[0, 0.0], [0, 0.15], [0.05, 0.17], [0.55, 0.17], [0.66, 0.12], [0.7, 0.05], [0.76, 0.05], [0.78, 0.0]], 12, 2);
    g.ring(0, 0.74, 0, 0.07, 0.02, 5, 10, 4); g.place(s, x0 - 0.05, TOOLS_L[1], DOOR.z + 0.12, 0, 0.12, 0.1); }
  g.tube([[x0 - 0.05, TOOLS_L[1] + 0.78, DOOR.z + 0.12, 0.022], [x0 + 0.1, TOOLS_L[1] + 0.85, DOOR.z + 0.25, 0.022], [x0 + 0.3, TOOLS_L[1] + 0.25, DOOR.z + 0.32, 0.022], [x0 + 0.42, TOOLS_L[1] + 0.06, DOOR.z + 0.1, 0.022]], 6, 5);
  g.tube([[x0 + 0.42, TOOLS_L[1] + 0.06, DOOR.z + 0.1, 0.03], [x0 + 0.5, TOOLS_L[1] + 0.06, DOOR.z - 0.08, 0.026], [x0 + 0.56, TOOLS_L[1] + 0.05, DOOR.z - 0.2, 0.012]], 6, 4);
  g.place(0, KIT.x, KIT.y, KIT.z, KIT.yaw, KIT.tilt, KIT.roll); g.occlude(0.5);
  return g.build();
}

// ---------- am eigenen Boot: verbogene Schraube, Riss, Schweißnaht ----------
function bentProp(src) {
  const g = src.geometry.clone(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y); if (r < 0.14) continue; const a = Math.atan2(y, x), k = (r - 0.14) / 0.4;
    const w0 = Math.max(0, Math.cos(a - 0.3)) ** 6, w1 = Math.max(0, Math.cos(a - 2.4)) ** 6;   // ein Blatt stark, eines etwas verbogen
    p.setZ(i, p.getZ(i) + (k * k * 0.55) * w0 - k * k * 0.18 * w1); const b = k * k * 0.5 * w0; p.setX(i, x * Math.cos(b) - y * Math.sin(b)); p.setY(i, x * Math.sin(b) + y * Math.cos(b)); }
  p.needsUpdate = true; g.computeVertexNormals(); const m = new T.Mesh(g, src.material); m.position.copy(src.position); m.frustumCulled = false; return m;
}
function tearMesh(k, seam) {
  const tr = TEAR[k], g = new B(), [x, y, z] = tr.p, rot = Math.atan2(tr.n[0], tr.n[1]);
  if (!seam) { g.blob(x, y, z, 0.03, 0.035, 0.26, 1, 5, 0.3, 3); for (let i = 0; i < 5; i++) { const s = g.c, zz = z - 0.2 + i * 0.1; g.blob(0, 0, 0, 0.06, 0.012, 0.045, 0, 2, 0.4, i); g.place(s, x + tr.n[0] * 0.03, y + tr.n[1] * 0.03 + (i % 2 ? 0.03 : -0.03), zz, 0, 0, rot + (i % 2 ? 0.6 : -0.5)); } }
  else { for (let i = 0; i < 9; i++) g.blob(x + tr.n[0] * 0.01, y + tr.n[1] * 0.01, z - 0.24 + i * 0.06, 0.035, 0.04, 0.04, 0, 6, 0.3, i); }
  const m = new T.Mesh(g.build(), propMaterial()); m.frustumCulled = false; return m;
}

export function createCrash(scene, world) {
  const mat = propMaterial(), gt = glowTexture();
  const kit = new T.Mesh(buildKittiwake(), mat); kit.frustumCulled = false; scene.add(kit);
  const pg = buildKitProp(); pg.place(0, 0, 0, -3.78, 0); const PROP_L = new T.Vector3(0, 0, -3.78); pg.place(0, KIT.x, KIT.y, KIT.z, KIT.yaw, KIT.tilt, KIT.roll);
  const kprop = new T.Mesh(pg.build(), mat); kprop.frustumCulled = false; scene.add(kprop);
  const tools = new T.Mesh(buildTools(), mat); tools.frustumCulled = false; scene.add(tools);
  const kitPropW = PROP_L.clone().applyMatrix4(kitM), toolsW = kitPt(hullR(DOOR.z) + 0.15, TOOLS_L[1] + 0.25, DOOR.z);
  // Kollision: Rumpf als Kugelreihe, dazu Turm
  const spheres = []; for (let z = -2.8; z <= 2.8; z += 1.4) { const p = kitPt(0, 0, z); spheres.push({ x: p.x, y: p.y, z: p.z, r: hullR(z) + 0.15 }); } { const p = kitPt(0, 1.3, -0.45); spheres.push({ x: p.x, y: p.y, z: p.z, r: 0.75 }); }
  for (const sx of [-1, 1]) { const p = kitPt(sx * 1.34, -0.65, -0.3); spheres.push({ x: p.x, y: p.y, z: p.z, r: 0.5 }); }
  const lampGlow = { x: toolsW.x, y: toolsW.y + 0.3, z: toolsW.z, col: [1.0, 0.62, 0.3], power: 0.9, size: 1.0 };
  const lampSpr = new T.Sprite(new T.SpriteMaterial({ map: gt, color: new T.Color(1.0, 0.72, 0.36), transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, fog: false })); lampSpr.position.set(toolsW.x, toolsW.y + 0.1, toolsW.z); lampSpr.scale.set(2.6, 2.6, 1); scene.add(lampSpr);
  const weldGlow = { x: 0, y: 0, z: 0, col: [0.75, 0.85, 1.0], power: 0, size: 1.4 };

  // Strömung: helle Schlieren rings um die Kamera, die mit dem Wasser vorbeischießen
  const SN = 260, sp = new Float32Array(SN * 6), sd = []; for (let i = 0; i < SN; i++) sd.push({ x: rr(-14, 14), y: rr(-10, 10), z: rr(-14, 14), l: rr(0.8, 2.6), v: rr(0.7, 1.3) });
  const sgeo = new T.BufferGeometry(); sgeo.setAttribute('position', new T.BufferAttribute(sp, 3));
  const streaks = new T.LineSegments(sgeo, new T.LineBasicMaterial({ color: 0x9fd4e6, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); streaks.frustumCulled = false; streaks.visible = false; scene.add(streaks);
  // Blasen aus dem Riss und Funken beim Schweißen: einfache Punktwolken in Weltkoordinaten
  const pts = (n, col, size) => { const a = new Float32Array(n * 3).fill(-9999), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3)); const m = new T.Points(g, new T.PointsMaterial({ map: gt, color: col, size, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.frustumCulled = false; scene.add(m); return { m, a, p: Array.from({ length: n }, () => ({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, l: 0 })) }; };
  const bub = pts(70, 0xbfe6f0, 0.16), spark = pts(60, 0xffd08a, 0.09);

  let boatRef = null, bent = null, tear = null, seam = null, kIdx = 0;
  const C = { kit, spheres, kitPropW, toolsW, lampGlow, weldGlow, LAND, KIT, FALL0, near: false };
  /** Zustand der Teile: prop = 'bent' | 'off' | 'ok', kitProp = Schraube hängt noch an der Kittiwake, tools = liegen noch an der Tür, tank = 'torn' | 'seam' | 'ok' */
  C.set = (boat, s) => {
    if (boat !== boatRef) { if (bent) bent.parent.remove(bent); if (tear) tear.parent.remove(tear); if (seam) seam.parent.remove(seam); boatRef = boat; kIdx = boat.kind || 0;
      bent = bentProp(boat.prop); boat.group.add(bent); tear = tearMesh(kIdx, false); seam = tearMesh(kIdx, true); boat.group.add(tear); boat.group.add(seam); }
    const sh = boat.outer[0].visible;   // in der Kabine ist der Rumpf ausgeblendet, dann auch alles daran
    bent.visible = sh && s.prop === 'bent'; boat.prop.visible = sh && s.prop === 'ok'; tear.visible = sh && s.tank === 'torn'; seam.visible = sh && s.tank === 'seam';
    kprop.visible = s.kitProp; tools.visible = lampSpr.visible = s.tools; C.leak = s.tank === 'torn';
  };
  const tv = new T.Vector3();
  /** Welt-Lage des Risses am eigenen Boot */
  C.tearW = (boat, out = new T.Vector3()) => { const tr = TEAR[boat.kind || 0]; return out.set(tr.p[0] + tr.n[0] * 0.08, tr.p[1] + tr.n[1] * 0.08, tr.p[2]).applyMatrix4(boat.group.matrixWorld); };
  C.sternW = (boat, out = new T.Vector3()) => out.copy(boat.prop.position).applyMatrix4(boat.group.matrixWorld);
  C.streak = 0; C.weld = 0; C.leak = false;
  /** jedes Bild: Schlieren um die Kamera (Strömung k 0..1, Richtung dir), Blasen am Riss, Funken an der Naht */
  C.update = (dt, cam, boat, flow) => {
    const k = C.streak; streaks.visible = k > 0.01; if (streaks.visible) { const m = streaks.material; m.opacity = 0.55 * k; const c = cam.position;
      for (let i = 0; i < SN; i++) { const q = sd[i]; q.x += flow.x * q.v * dt; q.y += flow.y * q.v * dt; q.z += flow.z * q.v * dt;
        for (const a of ['x', 'y', 'z']) { const lim = a === 'y' ? 10 : 14; if (q[a] > lim) q[a] -= 2 * lim; else if (q[a] < -lim) q[a] += 2 * lim; }
        const fl = Math.hypot(flow.x, flow.y, flow.z) || 1, l = q.l * Math.min(1.6, fl / 9), o = i * 6; sp[o] = c.x + q.x; sp[o + 1] = c.y + q.y; sp[o + 2] = c.z + q.z; sp[o + 3] = sp[o] - flow.x / fl * l; sp[o + 4] = sp[o + 1] - flow.y / fl * l; sp[o + 5] = sp[o + 2] - flow.z / fl * l; }
      sgeo.attributes.position.needsUpdate = true; }
    const run = (P, emit, n, fn) => { for (let i = 0; i < P.p.length; i++) { const q = P.p[i]; if (q.l <= 0 && n > 0 && R() < emit * dt / P.p.length * 8) { fn(q); n--; } if (q.l > 0) { q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; } if (q.l <= 0) q.y = -9999; P.a[i * 3] = q.x; P.a[i * 3 + 1] = q.y; P.a[i * 3 + 2] = q.z; } P.m.geometry.attributes.position.needsUpdate = true; };
    if (boat && boatRef === boat) C.tearW(boat, tv);
    if (C.leak || bub.p.some((q) => q.l > 0)) { bub.m.visible = true; run(bub, C.leak ? 6 : 0, 2, (q) => { q.x = tv.x + rr(-0.1, 0.1); q.y = tv.y; q.z = tv.z + rr(-0.25, 0.25); q.vx = rr(-0.15, 0.15); q.vy = rr(0.7, 1.3); q.vz = rr(-0.15, 0.15); q.l = rr(2.5, 4.5); }); } else bub.m.visible = false;
    const w = C.weld; if (w > 0 || spark.p.some((q) => q.l > 0)) { spark.m.visible = true; run(spark, w > 0 ? 40 : 0, 6, (q) => { q.x = tv.x; q.y = tv.y; q.z = tv.z; const a = R() * PI * 2, b = rr(0.5, 2.2); q.vx = Math.cos(a) * b; q.vy = rr(-0.4, 1.6); q.vz = Math.sin(a) * b; q.l = rr(0.15, 0.45); }); } else spark.m.visible = false;
    weldGlow.x = tv.x; weldGlow.y = tv.y; weldGlow.z = tv.z; weldGlow.power = w > 0 ? 1.4 + R() * 1.6 : 0;
  };
  return C;
}
