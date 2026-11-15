// cave.js – das Loch im Schluchtboden: ein leicht gewundener Schacht hinab, dann ein Gang unter dem Grund bis in eine kleine Kammer.
// Ein Krake hat dort einmal gewohnt und gesammelt, was ihm gefiel: Muschelschalen, kleine Knochen – und einen Pottwalzahn.
// Das Gelände bleibt eine Höhenkarte; die Höhle ist ein eigenes Gitter darunter. Wer in der Röhre ist, stößt an ihre Wände statt an den Grund.
import { T, clamp, smooth, noise, rng } from './util.js';
import { uni, COMMON } from './gfx.js';
import { floorH, meshH, HOLE } from './terrain.js';

const n3 = (x, y, z, s) => noise(x * s + y * s * 0.7 + 13.1, z * s - y * s * 0.6 + 7.7) + 0.5 * noise(x * s * 2.3 - y * s * 1.1, z * s * 2.3 + y * s * 1.7 + 31.0);
const WALL = 0.84;   // so weit (Anteil am Radius) reicht der Gang für die Kollision: die Beulen im Fels ragen etwas hinein

// ---------- Mittellinie: Punkte relativ zur Öffnung (x Osten, y oben, z Norden) mit Radius ----------
const CP = [
  [0, 1.2, 0, 2.0], [0, -1.6, 0, 2.05], [0.4, -4.6, -0.3, 2.6], [0.9, -8.0, 0.3, 3.0], [0.5, -11.0, 1.2, 3.0],
  [-0.5, -13.2, 3.1, 2.8], [-1.2, -14.4, 5.8, 2.7], [-0.4, -15.1, 8.6, 2.6], [1.5, -15.7, 11.1, 2.8], [3.1, -16.3, 13.8, 3.0],
  [3.2, -16.9, 16.6, 3.0], [1.8, -17.3, 19.1, 3.8], [0.3, -17.5, 21.4, 4.6], [-0.7, -17.4, 23.6, 3.9],
];
export const CAVE = (() => {
  const yM = floorH(HOLE.x, HOLE.z), P = CP.map((p) => [HOLE.x + p[0], yM + p[1], HOLE.z + p[2], p[3]]);
  // Catmull-Rom fein abtasten, dann gleichmäßig nach Bogenlänge
  const fine = [], cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < P.length - 1; i++) for (let k = 0; k < 24; k++) { const t = k / 24, a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)]; fine.push([0, 1, 2].map((j) => cr(a[j], b[j], c[j], d[j], t)).concat([b[3] + (c[3] - b[3]) * smooth(0, 1, t)])); }
  fine.push(P[P.length - 1].slice());
  const S = []; let acc = 0, need = 0;
  for (let i = 0; i < fine.length - 1; i++) { const a = fine[i], b = fine[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); while (need <= acc + l) { const u = (need - acc) / l; S.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u, r: a[3] + (b[3] - a[3]) * u, s: need }); need += 0.45; } acc += l; }
  // Abschluss: eine Halbkugel, damit die Kammer hinten rund zugeht
  { const L = S[S.length - 1], q = S[S.length - 2], tx = L.x - q.x, ty = L.y - q.y, tz = L.z - q.z, tl = Math.hypot(tx, ty, tz); for (let k = 1; k <= 6; k++) { const f = k / 6, o = L.r * 0.92 * Math.sin(f * Math.PI / 2); S.push({ x: L.x + tx / tl * o, y: L.y + ty / tl * o, z: L.z + tz / tl * o, r: Math.max(0.04, L.r * Math.cos(f * Math.PI / 2)), s: L.s + o, cap: true }); } }
  // Richtung, Waagrechte, Höhe des flachen Bodens
  for (let i = 0; i < S.length; i++) { const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)], tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z, l = Math.hypot(tx, ty, tz) || 1, s = S[i]; s.tx = tx / l; s.ty = ty / l; s.tz = tz / l; s.h = 1 - Math.abs(s.ty); s.fl = s.r * (1 - 0.4 * smooth(0.35, 0.8, s.h)); }
  const mid = S.reduce((b, s) => (s.r > b.r && !s.cap ? s : b), S[0]);   // Mitte der Kammer: dort ist der Gang am weitesten
  const floorY = mid.y - mid.fl;
  // Zahn: auf einem flachen Stein in der Kammer, etwas zur Seite
  const tooth = { x: mid.x + 1.2, y: floorY + 0.62, z: mid.z + 0.6 };
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x - s.r); x1 = Math.max(x1, s.x + s.r); y0 = Math.min(y0, s.y - s.r); y1 = Math.max(y1, s.y + s.r); z0 = Math.min(z0, s.z - s.r); z1 = Math.max(z1, s.z + s.r); }
  return { yM, S, top: S[0], mid, floorY, tooth, box: [x0 - 2, x1 + 2, y0 - 2, y1 + 6, z0 - 2, z1 + 2], len: S[S.length - 1].s };
})();

// ---------- Abfragen ----------
const S = CAVE.S, NS = S.length, BX = CAVE.box;
const inBox = (x, y, z) => x > BX[0] && x < BX[1] && y > BX[2] && y < BX[3] && z > BX[4] && z < BX[5];
function nearest(x, y, z) { let bi = 0, bd = 1e9; for (let i = 0; i < NS; i++) { const s = S[i], dx = x - s.x, dy = y - s.y, dz = z - s.z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; bi = i; } } return bi; }
/** Punkt gegen die Röhre: res.state 0 = draußen (Gelände gilt), 1 = über der Öffnung (kein Boden), 2 = im Gang; dazu die Korrektur, damit er mit Radius rad drinbleibt */
const R0 = { state: 0, cx: 0, cy: 0, cz: 0, ground: false };
function solve(x, y, z, rad, feet, res = R0) {
  res.state = 0; res.cx = res.cy = res.cz = 0; res.ground = false;
  if (!inBox(x, y, z)) return res;
  const i = nearest(x, y, z), s = S[i]; let ox = x - s.x, oy = y - s.y, oz = z - s.z; const al = ox * s.tx + oy * s.ty + oz * s.tz;
  if (i <= 1 && al < 0) {   // oberhalb des Schachts: über der Öffnung fällt man hinein, daneben steht man auf dem Grund
    const hr = Math.hypot(x - CAVE.top.x, z - CAVE.top.z); if (hr < HOLE.r * 0.92 && y < CAVE.top.y + 4) res.state = 1; return res;
  }
  if (i < NS - 1) { ox -= al * s.tx; oy -= al * s.ty; oz -= al * s.tz; } else if (al < 0) { ox -= al * s.tx; oy -= al * s.ty; oz -= al * s.tz; }
  const d = Math.hypot(ox, oy, oz), lim = Math.max(0.05, s.r * WALL - rad);
  if (d > s.r * WALL + 1.2) return res;   // weit im Fels: das ist nicht die Röhre (z. B. oben auf dem Grund über dem Gang)
  res.state = 2;
  if (d > lim && d > 1e-4) { const k = (d - lim) / d; res.cx = -ox * k; res.cy = -oy * k; res.cz = -oz * k; }
  if (feet && s.h > 0.35) {   // Boden: entlang der Achse zwischen den Abtastpunkten geglättet, damit man auf schrägem Grund nicht stolpert
    const s2 = S[clamp(i + (al > 0 ? 1 : -1), 0, NS - 1)], fl = s.fl + (s2.fl - s.fl) * Math.min(1, Math.abs(al) / 0.45), fy = s.y + al * s.ty - fl, ny = y + res.cy;
    if (ny < fy) { res.cy += fy - ny; res.ground = true; } else if (ny < fy + 0.12) res.ground = true; }
  return res;
}
const RA = { state: 0, cx: 0, cy: 0, cz: 0, ground: false };
const apply = (D, r) => { D.x += r.cx; D.y += r.cy; D.z += r.cz; const l = Math.hypot(r.cx, r.cy, r.cz); if (l > 1e-5) { const nx = r.cx / l, ny = r.cy / l, nz = r.cz / l, vn = D.vx * nx + D.vy * ny + D.vz * nz; if (vn < 0) { D.vx -= nx * vn; D.vy -= ny * vn; D.vz -= nz * vn; } } };
/** Taucher (senkrechte Kapsel, Augen bei D.y): 0 = Gelände zuständig, 1 = über der Öffnung (fällt), 2 = im Gang (erledigt, D.ground gesetzt) */
CAVE.diver = (D, EYE, RAD) => {
  const m = solve(D.x, D.y - EYE * 0.5, D.z, RAD, false, RA); if (m.state !== 2) return m.state;
  apply(D, m);
  let g = false; const f = solve(D.x, D.y - EYE + 0.3, D.z, 0.3, false, RA); if (f.state === 2) apply(D, f);
  const fl = solve(D.x, D.y - EYE, D.z, 0.05, true, RA); if (fl.state === 2) { D.y += fl.cy; if (fl.cy > 0 && D.vy < 0) D.vy = 0; g = fl.ground; }
  const h = solve(D.x, D.y, D.z, 0.36, false, RA); if (h.state === 2) apply(D, h);
  D.ground = g && D.vy < 0.3; return 2;
};
/** Glied des Schlauchs: bleibt in der Röhre; true = erledigt (auch über der Öffnung: dort liegt kein Boden) */
CAVE.hose = (P, o) => {
  const r = solve(P[o], P[o + 1], P[o + 2], 0.08, true, RA); if (r.state === 0) return false; if (r.state === 2) { P[o] += r.cx; P[o + 1] += r.cy; P[o + 2] += r.cz; } return true;
};
/** wie tief im Gang (0 an der Öffnung, 1 ab etwa 14 m darunter): für Lampe und Klang */
CAVE.depthK = (x, y, z) => { if (!inBox(x, y, z)) return 0; return smooth(0.5, 14, CAVE.yM - y); };
CAVE.near = (x, z, r) => Math.hypot(x - HOLE.x, z - HOLE.z) < r;

// ---------- Material: an der Öffnung wie der Meeresgrund, nach unten zunehmend Höhle; Kammer mit leuchtendem Bewuchs ----------
let MAT = null;
function caveMaterial() {
  if (MAT) return MAT;
  MAT = new T.ShaderMaterial({ uniforms: uni({ uMouth: { value: new T.Vector3(HOLE.x, CAVE.yM, HOLE.z) }, uRoom: { value: new T.Vector3(CAVE.mid.x, CAVE.mid.y, CAVE.mid.z) } }), side: T.DoubleSide, extensions: { derivatives: true },
    vertexShader: `attribute float aO, aTag; varying vec3 vW, vN; varying float vO, vT;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vO = aO; vT = aTag; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} uniform vec3 uMouth, uRoom; varying vec3 vW, vN; varying float vO, vT;
      vec4 tri(vec3 p, vec3 w) { return texture2D(uNoise, p.yz) * w.x + texture2D(uNoise, p.xz) * w.y + texture2D(uNoise, p.xy) * w.z; }
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) N = -N;
        float tag = floor(vT + 0.5);
        if (tag < 0.5) { vec3 Nf = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(Nf, N) < 0.0) Nf = -Nf; N = normalize(mix(N, Nf, 0.45)); }
        vec3 aw = pow(abs(N), vec3(3.0)); aw /= aw.x + aw.y + aw.z;
        float below = uMouth.y - vW.y, day = 1.0 - smoothstep(0.3, 15.0, below), room = 1.0 - smoothstep(2.0, 9.0, distance(vW, uRoom));
        vec4 n1 = tri(vW * 0.21, aw), n2 = tri(vW * 0.9 + 3.1, aw), n3 = tri(vW * 3.1 + 7.7, aw);
        vec3 base; float emit = 0.0, spec = 0.08;
        if (tag < 0.5) {
          // Fels: oben genau wie der Grund ringsum, unten Schichten, helle Kalkadern, feiner Schlick auf dem Boden
          float n = texture2D(uNoise, vW.xz * 0.019 + vW.y * 0.011).r, st = texture2D(uNoise, vec2(vW.y * 0.04 + n * 0.35, 0.3 + vW.x * 0.002)).g;
          float fl = smoothstep(0.8, 0.96, N.y);
          vec3 top = mix(vec3(0.20, 0.30, 0.46), vec3(0.44, 0.58, 0.74), st * 0.65 + n * 0.35);
          float pt = texture2D(uNoise, vW.xz * 0.045 + 3.7).g, gravel = smoothstep(0.45, 0.62, pt + n * 0.25 - 0.1);
          float sp = texture2D(uNoise, vW.xz * 0.9).b, sp2 = texture2D(uNoise, vW.xz * 0.37 + 1.3).b;
          vec3 flo = mix(vec3(0.50, 0.66, 0.80) * (0.9 + 0.2 * n), vec3(0.24, 0.34, 0.47) * (0.85 + 0.3 * sp2), gravel * 0.85);
          flo *= 1.0 - 0.32 * smoothstep(0.72, 0.9, sp) * (0.35 + 0.65 * gravel) - 0.18 * smoothstep(0.8, 0.95, sp2);
          flo = mix(flo, vec3(0.13, 0.26, 0.30), smoothstep(0.6, 0.75, texture2D(uNoise, vW.xz * 0.021 - 5.1).r) * 0.45 * (1.0 - gravel));
          top = mix(top, flo, fl * 0.85);
          float layer = texture2D(uNoise, vec2(vW.y * 0.17 + n1.r * 0.45, 0.61)).g, vein = 1.0 - smoothstep(0.0, 0.05, abs(n1.g - 0.5));
          vec3 rock = mix(vec3(0.26, 0.29, 0.33), vec3(0.47, 0.50, 0.53), layer * 0.7 + n2.r * 0.3) * (0.82 + 0.3 * n3.r);
          rock = mix(rock, vec3(0.70, 0.72, 0.70), vein * 0.55 * smoothstep(0.4, 0.7, n2.g));
          rock *= 1.0 - 0.45 * smoothstep(0.72, 0.88, n3.b);   // Löcher und Poren
          rock = mix(rock, vec3(0.30, 0.31, 0.29) * (0.85 + 0.3 * n2.b), smoothstep(0.55, 0.9, N.y) * 0.85);   // Schlick am Boden
          base = mix(rock, top, day);
          // Bewuchs: kleine leuchtende Flecken, tiefer im Gang häufiger, in der Kammer am dichtesten
          float k = smoothstep(0.87 - room * 0.09, 0.93 - room * 0.06, n2.b) * smoothstep(0.45, 0.7, n1.g + room * 0.2) * (1.0 - day);
          emit = k * (0.55 + 0.45 * sin(uTime * 1.1 + vW.x * 1.7 + vW.z * 1.3)); spec = 0.18;
        } else if (tag < 1.5) {
          // Muschelschalen: helle, gerippte Außenseite, innen perlmuttrosa
          float rib = 0.5 + 0.5 * sin((vW.x + vW.z) * 60.0 + n2.r * 6.0);
          base = mix(vec3(0.5, 0.47, 0.41), vec3(0.34, 0.29, 0.25), rib * 0.4 + n3.g * 0.3);
          base = mix(base, vec3(0.56, 0.42, 0.42), smoothstep(0.55, 0.85, n2.g) * 0.45); spec = 0.2;
        } else if (tag < 2.5) {
          // kleine Knochen: grau-elfenbein, fleckig
          base = vec3(0.5, 0.48, 0.42) * (0.8 + 0.3 * n2.r); base *= 1.0 - 0.4 * smoothstep(0.7, 0.86, n3.b); spec = 0.06;
        } else {
          // der Zahn: Elfenbein mit feinen Wachstumsringen, Spitze glatt, ein leichtes Eigenleuchten im Licht der Kammer
          float ring = 0.5 + 0.5 * sin(vO * 70.0 + n2.r * 2.0);
          base = mix(vec3(0.93, 0.89, 0.78), vec3(0.78, 0.70, 0.55), ring * 0.25 + (1.0 - vO) * 0.2); spec = 0.7; emit = 0.13 + 0.07 * sin(uTime * 1.4);
        }
        float ao = clamp(vO, 0.0, 1.0); if (tag > 2.5) ao = 1.0;
        vec3 cav = base * ao * (vec3(0.006, 0.016, 0.026) + lights(vW, N) * 1.2);
        vec3 dl = uLampPos - vW; float dd = length(dl); vec3 L = dl / max(dd, 0.001), H = normalize(L + V);
        float cone = smoothstep(0.84, 0.97, dot(-L, uLampDir));
        cav += vec3(0.6, 0.8, 0.9) * pow(max(dot(N, H), 0.0), 40.0) * spec * cone * uLampOn * 5.0 / (3.0 + dd * dd * 0.05);   // nasser Glanz im Lampenlicht
        vec3 col = mix(cav, shade(base * ao, N, vW), day);
        col += (tag < 0.5 ? mix(vec3(0.15, 0.95, 0.85), vec3(0.45, 0.55, 1.0), step(0.5, fract(n3.g * 7.0))) : vec3(1.0, 0.9, 0.7)) * emit * (tag < 0.5 ? 0.9 : 1.0);
        vec3 v = vW - cameraPosition; float d = length(v), f = 1.0 - exp(-d * uFogK * (1.0 + (1.0 - day) * 0.6));
        gl_FragColor = vec4(mix(col, waterCol(v / d) * mix(0.03, 1.0, day), f), 1.0);
      }` });
  return MAT;
}

// ---------- Gitter ----------
function addV(G, x, y, z, tag, ao) { G.p.push(x, y, z); G.t.push(tag); G.o.push(ao); return G.c++; }
function finish(G) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(G.p), 3)); g.setAttribute('aTag', new T.BufferAttribute(new Float32Array(G.t), 1)); g.setAttribute('aO', new T.BufferAttribute(new Float32Array(G.o), 1));
  g.setIndex(new T.BufferAttribute(G.c > 65535 ? new Uint32Array(G.i) : new Uint16Array(G.i), 1)); g.computeVertexNormals(); g.computeBoundingSphere(); return g;
}
const newG = () => ({ p: [], t: [], o: [], i: [], c: 0 });
function grid(G, rows, sides, closed) {   // Ringe gleicher Eckenzahl zu einem Schlauch verbinden
  const base = G.c - rows * sides;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < sides; i++) { const i2 = closed ? (i + 1) % sides : i + 1; if (!closed && i === sides - 1) continue; const a = base + j * sides + i, b = base + j * sides + i2, c = a + sides, d = b + sides; G.i.push(a, c, b, b, c, d); }
}

/** Röhre und Rand der Öffnung */
function buildTube() {
  const G = newG(), SIDES = 26, T0 = new T.Vector3(), u = new T.Vector3(1, 0, 0), w = new T.Vector3(), tv = new T.Vector3(), prev = new T.Vector3();
  const tm = CAVE.yM - 0.75;   // ab hier beginnt die Röhre (darüber liegt der Rand)
  const top = S[0], dirs = []; for (let k = 0; k < SIDES; k++) { const a = k / SIDES * Math.PI * 2; dirs.push([Math.cos(a), Math.sin(a)]); }
  const rimR = (k) => HOLE.r * (1 + 0.1 * (noise(Math.cos(k / SIDES * 6.283) * 1.3 + 4.1, Math.sin(k / SIDES * 6.283) * 1.3 + 2.2) - 0.5) * 2);
  // Rand: Ringe vom Schachtmund nach außen, am äußeren Ende knapp unter dem Gelände
  const RIM = [[0, -0.75, 0.25], [0.5, -0.18, 0.5], [1.25, 0.08, 0.75], [2.3, 0.1, 0.92], [3.5, 0.05, 1], [4.8, -0.14, 1]];
  for (const [dr, dy, ao] of RIM.slice().reverse()) for (let k = 0; k < SIDES; k++) { const r = rimR(k) + dr, x = top.x + dirs[k][0] * r, z = top.z + dirs[k][1] * r; addV(G, x, meshH(x, z) + dy + (dr > 0.3 && dr < 4 ? (noise(x * 0.9, z * 0.9) - 0.5) * 0.12 : 0), z, 0, ao); }
  // Schacht und Gang: ein Ring je Abtastpunkt; Rahmen wird mitgeführt, damit sich die Röhre nicht verdreht
  let rows = RIM.length; tv.set(S[0].tx, S[0].ty, S[0].tz); w.crossVectors(tv, u).normalize(); u.crossVectors(w, tv).normalize();   // oben: u nach Osten, w nach Norden
  for (let i = 0; i < NS; i++) {
    const s = S[i]; T0.set(s.tx, s.ty, s.tz);
    if (i > 0) { prev.set(S[i - 1].tx, S[i - 1].ty, S[i - 1].tz); const q = new T.Quaternion().setFromUnitVectors(prev, T0); u.applyQuaternion(q); w.applyQuaternion(q); }
    if (s.y > tm - 0.6) continue;
    for (let k = 0; k < SIDES; k++) {
      const a = k / SIDES * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // Richtung im Querschnitt: oben am Schacht genau wie der Rand (Himmelsrichtungen), weiter unten mit dem Rahmen
      let dx = u.x * ca + w.x * sa, dy = u.y * ca + w.y * sa, dz = u.z * ca + w.z * sa;
      const blend = smooth(0, 6, tm - s.y); if (blend < 1) { dx = dirs[k][0] * (1 - blend) + dx * blend; dy *= blend; dz = dirs[k][1] * (1 - blend) + dz * blend; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; }
      const wob = 1 + 0.17 * (n3(s.x + dx * 3, s.y + dy * 3, s.z + dz * 3, 0.45) - 0.75) + 0.07 * (noise(s.s * 0.7 + a * 2.0, a * 1.3) - 0.5);
      const rr = (blend < 1 ? rimR(k) * (1 - blend) + s.r * blend : s.r) * wob;
      let x = s.x + dx * rr, y = s.y + dy * rr, z = s.z + dz * rr;
      if (s.h > 0.35 && y < s.y - s.fl) y = s.y - s.fl + (noise(x * 1.3, z * 1.3) - 0.5) * 0.1;   // flacher Boden im Gang
      const ao = 0.55 + 0.45 * smooth(-0.9, 0.6, dy) - (s.cap ? 0.1 : 0);
      addV(G, x, y, z, 0, ao);
    }
    rows++;
  }
  grid(G, rows, SIDES, true);
  // Kappe: letzter Ring zu einem Punkt
  const L = S[NS - 1], c = addV(G, L.x + L.tx * 0.03, L.y + L.ty * 0.03, L.z + L.tz * 0.03, 0, 0.5), b0 = c - SIDES; for (let k = 0; k < SIDES; k++) G.i.push(b0 + k, b0 + (k + 1) % SIDES, c);
  return finish(G);
}

/** Muschelhaufen, kleine Knochen und der flache Stein; der Zahn ist ein eigenes Gitter (verschwindet beim Aufheben) */
function blob(G, cx, cy, cz, rx, ry, rz, tag, rotY, tilt, seed, ao = 1) {
  const R = 6, C = 9, base = G.c, cyw = Math.cos(rotY), syw = Math.sin(rotY), ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let j = 0; j <= R; j++) { const v = j / R * Math.PI, sv = Math.sin(v), cv = Math.cos(v); for (let i = 0; i < C; i++) { const a = i / C * Math.PI * 2, k = 1 + (noise(Math.cos(a) * 1.7 + seed, cv * 1.7 + seed * 0.3) - 0.5) * 0.3;
    let x = Math.cos(a) * sv * rx * k, y = cv * ry * k, z = Math.sin(a) * sv * rz * k; const y2 = y * ct - z * st, z2 = y * st + z * ct; y = y2; z = z2;
    addV(G, cx + x * cyw + z * syw, cy + y, cz - x * syw + z * cyw, tag, ao * (0.75 + 0.25 * cv)); } }
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) { const a = base + j * C + i, b = base + j * C + (i + 1) % C, c = a + C, d = b + C; G.i.push(a, c, b, b, c, d); }
}
function tubeG(G, pts, sides, tag) {   // pts: [x,y,z,r,ao?]
  const base = G.c, tv = new T.Vector3(), u = new T.Vector3(), w = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  for (let j = 0; j < pts.length; j++) { const a = pts[Math.max(0, j - 1)], c = pts[Math.min(pts.length - 1, j + 1)], p = pts[j]; tv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize(); u.crossVectors(tv, Math.abs(tv.y) > 0.9 ? new T.Vector3(1, 0, 0) : up).normalize(); w.crossVectors(u, tv);
    for (let i = 0; i < sides; i++) { const an = i / sides * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an); addV(G, p[0] + (u.x * ca + w.x * sa) * p[3], p[1] + (u.y * ca + w.y * sa) * p[3], p[2] + (u.z * ca + w.z * sa) * p[3], tag, p[4] === undefined ? 1 : p[4]); } }
  grid(G, pts.length, sides, true);
  const e = pts[pts.length - 1], q = pts[pts.length - 2], l = Math.hypot(e[0] - q[0], e[1] - q[1], e[2] - q[2]) || 1, c = addV(G, e[0] + (e[0] - q[0]) / l * e[3] * 0.6, e[1] + (e[1] - q[1]) / l * e[3] * 0.6, e[2] + (e[2] - q[2]) / l * e[3] * 0.6, tag, e[4] === undefined ? 1 : e[4]), b0 = c - sides;
  for (let i = 0; i < sides; i++) G.i.push(b0 + i, b0 + (i + 1) % sides, c);
}
function buildDen() {
  const G = newG(), R = rng(7341), rr = (a, b) => a + R() * (b - a), m = CAVE.mid, fy = CAVE.floorY, t = CAVE.tooth;
  // der flache Stein unter dem Zahn
  blob(G, t.x, fy + 0.22, t.z, 0.75, 0.3, 0.6, 0, 0.4, 0.05, 3.1, 0.8);
  // Muscheln: um den Stein gehäuft, nach außen dünner; flach liegend, leicht gekippt
  for (let i = 0; i < 95; i++) { const a = R() * 6.283, d = Math.pow(R(), 0.7) * 2.6 + 0.5, x = t.x + Math.cos(a) * d - 0.3, z = t.z + Math.sin(a) * d * 0.85, s = rr(0.06, 0.15), heap = Math.max(0, 1 - d / 2.4) * 0.22;
    blob(G, x, fy + 0.03 + heap * R() + s * 0.2, z, s, s * 0.32, s * 0.82, 1, R() * 6.3, rr(-0.5, 0.5), i * 1.7); }
  // ein paar kleine Knochen: Fischwirbel, Rippchen, ein Stück Kiefer
  for (let i = 0; i < 9; i++) { const a = R() * 6.283, d = rr(0.8, 2.4), x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, h = R() * 6.3, L = rr(0.25, 0.6), b = rr(0.1, 0.3);
    const pts = []; for (let k = 0; k <= 5; k++) { const f = k / 5; pts.push([x + Math.cos(h) * L * (f - 0.5), fy + 0.04 + Math.sin(f * Math.PI) * b * 0.4, z + Math.sin(h) * L * (f - 0.5) + Math.sin(f * 3.1) * b * 0.3, 0.022 * (1 - f * 0.5), 0.85]); }
    tubeG(G, pts, 5, 2); }
  for (let i = 0; i < 6; i++) { const x = t.x - 1.6 + i * 0.13, z = t.z - 1.1 + Math.sin(i) * 0.05; blob(G, x, fy + 0.05, z, 0.045, 0.045, 0.06, 2, 0.3, 0, i, 0.9); }
  // größere Steine am Rand der Kammer, damit der Boden nicht leer wirkt
  for (let i = 0; i < 7; i++) { const a = R() * 6.283, d = rr(2.8, 3.8), x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d; blob(G, x, fy + 0.15, z, rr(0.3, 0.7), rr(0.2, 0.45), rr(0.3, 0.6), 0, R() * 6, 0, i * 3.3, 0.7); }
  return finish(G);
}
function buildTooth() {
  // Pottwalzahn: kegelig, leicht gebogen, etwa 35 cm lang (ein großer)
  const G = newG(), t = CAVE.tooth, pts = [], L = 0.36;
  for (let k = 0; k <= 10; k++) { const f = k / 10, r = 0.068 * Math.pow(1 - f, 0.55) * (1 - 0.15 * Math.sin(f * 9)) + 0.004; pts.push([-L / 2 + f * L, Math.sin(f * 2.4) * 0.045 + r * 0.6, Math.sin(f * 1.6) * 0.018, r, f]); }
  tubeG(G, pts, 12, 3);
  const g = finish(G); g.rotateZ(-0.12); g.rotateY(0.9); g.translate(t.x, t.y, t.z); g.computeBoundingSphere(); return g;
}

export function createCave(scene) {
  const mat = caveMaterial(), tube = new T.Mesh(buildTube(), mat), den = new T.Mesh(buildDen(), mat), tooth = new T.Mesh(buildTooth(), mat);
  for (const m of [tube, den, tooth]) scene.add(m);
  const C = { tube, den, tooth };
  /** Zahn zeigen oder nicht (nach dem Aufheben fehlt er) */
  C.setTooth = (v) => { tooth.visible = v; };
  return C;
}
