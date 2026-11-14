// props.js – einzelne große Fundstücke: das Walskelett in der Schnee-Ebene und die alte Taucherglocke.
// Eigenes Material: poröser Knochen mit Rissen, Flecken und Bewuchs; Gusseisen mit Rost, Laufspuren und Patina; Messing, Glas, Schlauch.
import { T, rng, ico, noise, smooth, clamp } from './util.js';
import { uni, COMMON } from './gfx.js';
import { floorH, floorN, meshH } from './terrain.js';

// ---------- kleiner Baukasten: Position, Normale, Verdeckung (aO) und Art der Fläche (aTag) ----------
// aTag: 0 Knochen, 1 Knochen mit Bewuchs, 2 Gusseisen, 3 Glas, 4 Messing, 5 Schlauch, 6 Kette
class B {
  constructor() { this.p = []; this.n = []; this.o = []; this.t = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, tag, ao = 1) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.t.push(tag); this.o.push(ao); return this.c++; }
  tri(a, b, c) { this.i.push(a, b, c); }
  // Schlauch entlang [x,y,z,r]; flat < 1 drückt den Querschnitt (Rippen, Kiefer); up = Bezugsrichtung für die flache Seite
  tube(pts, sides, tag, flat = 1, up = [0, 1, 0], caps = true) {
    const n = pts.length, base = this.c, tv = new T.Vector3(), u = new T.Vector3(), w = new T.Vector3(), U0 = new T.Vector3(...up).normalize(), A0 = new T.Vector3(1, 0, 0);
    const frames = [];
    for (let j = 0; j < n; j++) {
      const a = pts[Math.max(0, j - 1)], c = pts[Math.min(n - 1, j + 1)];
      tv.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]).normalize();
      u.crossVectors(tv, Math.abs(tv.dot(U0)) > 0.95 ? A0 : U0).normalize(); w.crossVectors(u, tv).normalize();   // w zeigt ungefähr nach "oben"
      frames.push([tv.clone(), u.clone(), w.clone()]);
      const p = pts[j];
      for (let i = 0; i < sides; i++) {
        const an = (i / sides) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
        const ox = u.x * ca * p[3] + w.x * sa * p[3] * flat, oy = u.y * ca * p[3] + w.y * sa * p[3] * flat, oz = u.z * ca * p[3] + w.z * sa * p[3] * flat;
        const nx = u.x * ca * flat + w.x * sa, ny = u.y * ca * flat + w.y * sa, nz = u.z * ca * flat + w.z * sa, l = Math.hypot(nx, ny, nz) || 1;
        this.v(p[0] + ox, p[1] + oy, p[2] + oz, nx / l, ny / l, nz / l, p[4] === undefined ? tag : p[4]);
      }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) { const a = base + j * sides + i, b = base + j * sides + (i + 1) % sides, c = a + sides, d = b + sides; this.tri(a, c, b); this.tri(b, c, d); }
    if (caps) for (const [j, s] of [[0, -1], [n - 1, 1]]) {   // abgerundete Enden: ein Knubbel statt eines flachen Deckels
      const p = pts[j], f = frames[j], ci = this.v(p[0] + f[0].x * p[3] * 0.8 * s, p[1] + f[0].y * p[3] * 0.8 * s, p[2] + f[0].z * p[3] * 0.8 * s, f[0].x * s, f[0].y * s, f[0].z * s, p[4] === undefined ? tag : p[4]);
      for (let i = 0; i < sides; i++) { const a = base + j * sides + i, b = base + j * sides + (i + 1) % sides; if (s > 0) this.tri(a, b, ci); else this.tri(b, a, ci); }
    }
  }
  // Klumpen aus einem Ikosaeder, leicht verbeult
  blob(cx, cy, cz, rx, ry, rz, det, tag, bump = 0.12, seed = 1, rot = 0) {
    const { v, f } = ico(det), base = this.c, c = Math.cos(rot), s = Math.sin(rot);
    for (const q of v) {
      const k = 1 + (noise(q[0] * 2.3 + seed, q[1] * 2.1 + q[2] * 1.7 + seed * 0.7) - 0.5) * 2 * bump;
      const lx = q[0] * rx * k, lz = q[2] * rz * k, nx = q[0] / rx, nz = q[2] / rz, ny = q[1] / ry, l = Math.hypot(nx, ny, nz);
      this.v(cx + lx * c + lz * s, cy + q[1] * ry * k, cz - lx * s + lz * c, (nx * c + nz * s) / l, ny / l, (-nx * s + nz * c) / l, tag);
    }
    for (const t of f) this.tri(base + t[0], base + t[1], base + t[2]);
  }
  // Drehkörper um die y-Achse: prof = [[y, r], ...]; inv dreht die Normalen nach innen
  lathe(cx, cy, cz, prof, sides, tag, inv = false, tagFn) {
    const base = this.c, n = prof.length;
    for (let j = 0; j < n; j++) {
      const [y, r] = prof[j], a = prof[Math.max(0, j - 1)], b = prof[Math.min(n - 1, j + 1)], dy = b[0] - a[0], dr = b[1] - a[1], l = Math.hypot(dy, dr) || 1;
      for (let i = 0; i <= sides; i++) { const an = (i / sides) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an), s = inv ? -1 : 1; this.v(cx + ca * r, cy + y, cz + sa * r, ca * dy / l * s, -dr / l * s, sa * dy / l * s, tagFn ? tagFn(y, an) : tag); }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < sides; i++) { const a = base + j * (sides + 1) + i, b = a + 1, c = a + sides + 1, d = c + 1; if (inv) { this.tri(a, b, c); this.tri(b, d, c); } else { this.tri(a, c, b); this.tri(b, c, d); } }
  }
  ring(cx, cy, cz, R, r, sides, segs, tag, axis = 'y') {   // Ring (Torus) um eine Achse
    const pts = []; for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2, ca = Math.cos(a) * R, sa = Math.sin(a) * R; pts.push(axis === 'y' ? [cx + ca, cy, cz + sa, r] : axis === 'x' ? [cx, cy + ca, cz + sa, r] : [cx + ca, cy + sa, cz, r]); }
    this.tube(pts, sides, tag, 1, axis === 'y' ? [1, 0, 0] : [0, 1, 0], false);
  }
  // alles bisher Gebaute bewegen: drehen um y (yaw), kippen (tilt um die x-Achse, roll um z), dann verschieben
  place(start, x, y, z, yaw, tilt = 0, roll = 0) {
    const m = new T.Matrix4().makeRotationFromEuler(new T.Euler(tilt, yaw, roll, 'YXZ')).setPosition(x, y, z), nm = new T.Matrix3().getNormalMatrix(m), v = new T.Vector3();
    for (let k = start; k < this.c; k++) {
      v.set(this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2]).applyMatrix4(m); this.p[k * 3] = v.x; this.p[k * 3 + 1] = v.y; this.p[k * 3 + 2] = v.z;
      v.set(this.n[k * 3], this.n[k * 3 + 1], this.n[k * 3 + 2]).applyMatrix3(nm).normalize(); this.n[k * 3] = v.x; this.n[k * 3 + 1] = v.y; this.n[k * 3 + 2] = v.z;
    }
  }
  // Verdeckung: nah am Grund und nach unten gewandt dunkler; extra(x,y,z,nx,ny,nz) kann weiter abdunkeln
  occlude(lift = 1.6, extra) {
    for (let k = 0; k < this.c; k++) {
      const x = this.p[k * 3], y = this.p[k * 3 + 1], z = this.p[k * 3 + 2], ny = this.n[k * 3 + 1], h = y - floorH(x, z);
      let a = (0.35 + 0.65 * smooth(-0.3, lift, h)) * (0.72 + 0.28 * (ny * 0.5 + 0.5));
      if (extra) a *= extra(x, y, z, this.n[k * 3], ny, this.n[k * 3 + 2]);
      this.o[k] *= a;
    }
  }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.p), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.n), 3));
    g.setAttribute('aO', new T.BufferAttribute(new Float32Array(this.o), 1)); g.setAttribute('aTag', new T.BufferAttribute(new Float32Array(this.t), 1));
    g.setIndex(new T.BufferAttribute(this.c > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1)); g.computeBoundingSphere(); return g;
  }
}

// ---------- Material ----------
let MAT = null;
export function propMaterial() {
  if (MAT) return MAT;
  MAT = new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide,
    vertexShader: `attribute float aO, aTag; varying vec3 vW, vN; varying float vO, vT;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vO = aO; vT = aTag; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN; varying float vO, vT;
      // Rauschen von drei Seiten projiziert, je nach Richtung der Fläche gemischt (keine Verzerrung an steilen Stellen)
      vec4 tri(vec3 p, vec3 w) { return texture2D(uNoise, p.yz) * w.x + texture2D(uNoise, p.xz) * w.y + texture2D(uNoise, p.xy) * w.z; }
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) N = -N;
        vec3 aw = abs(N); aw = pow(aw, vec3(3.0)); aw /= aw.x + aw.y + aw.z;
        float tag = floor(vT + 0.5), fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec4 n1 = tri(vW * 0.21, aw), n2 = tri(vW * 0.9 + 3.1, aw), n3 = tri(vW * 3.3 + 7.7, aw), n4 = tri(vW * 0.055 + 1.3, aw);
        vec3 base; float emit = 0.0, spec = 0.0;
        if (tag < 1.5) {
          // Knochen: elfenbeinfarben, dunkle Poren, feine Risse, bräunliche Flecken, oben grünlicher Bewuchs
          base = vec3(0.90, 0.86, 0.74) * (0.86 + 0.28 * n2.r);
          base = mix(base, vec3(0.52, 0.44, 0.32), smoothstep(0.45, 0.75, n4.g) * 0.55);
          base *= 1.0 - 0.55 * smoothstep(0.7, 0.86, n3.b) - 0.25 * smoothstep(0.62, 0.8, n2.b);
          float crack = 1.0 - smoothstep(0.0, 0.035, abs(n1.g - 0.5)); base *= 1.0 - 0.45 * crack * smoothstep(0.3, 0.6, n4.r);
          float grow = smoothstep(0.35, 0.85, N.y) * smoothstep(0.5, 0.68, n1.r + (tag > 0.5 ? 0.18 : 0.0));
          base = mix(base, vec3(0.20, 0.34, 0.30) * (0.8 + 0.5 * n3.g), grow * 0.7); spec = 0.05;
          base = mix(base, vec3(0.30, 0.26, 0.2), (1.0 - smoothstep(0.4, 0.85, vO)) * 0.5);           // Schlamm unten
          emit = smoothstep(0.955, 0.985, n3.r) * grow * (0.6 + 0.4 * sin(uTime * 1.3 + vW.x * 2.0 + vW.z));   // leuchtende Pünktchen im Bewuchs
        } else if (tag < 2.5) {
          // Gusseisen: dunkel, Rostflecken, senkrechte Rostläufer, oben Patina und Bewuchs, kleine Pockennarben
          float streak = texture2D(uNoise, vec2((vW.x + vW.z) * 0.9, vW.y * 0.09)).g, rust = smoothstep(0.42, 0.72, n1.r * 0.6 + n4.g * 0.6) + smoothstep(0.62, 0.8, streak) * 0.7;
          base = vec3(0.17, 0.18, 0.19) * (0.75 + 0.5 * n2.r);
          base = mix(base, mix(vec3(0.42, 0.17, 0.06), vec3(0.62, 0.33, 0.12), n3.g), clamp(rust * 1.15, 0.0, 1.0) * 0.9);
          base = mix(base, vec3(0.12, 0.27, 0.25) * (0.8 + 0.4 * n2.g), smoothstep(0.3, 0.9, N.y) * smoothstep(0.45, 0.7, n1.b) * 0.75);
          base *= 1.0 - 0.4 * smoothstep(0.78, 0.9, n3.b); spec = 0.15;
        } else if (tag < 3.5) {
          // Glas: dunkel, spiegelt das Wasser; dahinter ein schwaches grünliches Schimmern
          base = vec3(0.02, 0.05, 0.06); emit = 0.12 + 0.05 * sin(uTime * 0.7 + vW.x); spec = 1.2;
        } else if (tag < 4.5) {
          // Messing mit Grünspan
          base = mix(vec3(0.55, 0.40, 0.17) * (0.8 + 0.4 * n2.r), vec3(0.22, 0.46, 0.38), smoothstep(0.45, 0.72, n1.g) * 0.8); spec = 0.5;
        } else if (tag < 5.5) {
          base = vec3(0.07, 0.065, 0.06) * (0.8 + 0.5 * n2.r);   // Gummischlauch
          base = mix(base, vec3(0.14, 0.25, 0.22), smoothstep(0.5, 0.8, N.y) * 0.5 * n1.b);
        } else {
          base = mix(vec3(0.20, 0.13, 0.08), vec3(0.45, 0.2, 0.07), n3.r); spec = 0.1;   // Kette
        }
        float ao = vO;
        vec3 lit = shade(base * ao, N, vW) * 1.3 + base * ao * (tag < 1.5 ? 0.16 : 0.08);
        lit += waterCol(reflect(-V, N)) * fr * (0.25 + spec) * ao;
        if (tag > 2.5 && tag < 3.5) lit += vec3(0.08, 0.32, 0.26) * emit;
        else lit += vec3(0.25, 0.95, 0.85) * emit * 0.9;
        gl_FragColor = vec4(fog(lit, vW), 1.0);
      }` });
  return MAT;
}

// ---------- Walskelett: liegt auf dem Rücken, die Rippen wölben sich wie ein Gewölbe nach oben ----------
// Rückgabe: Geometrie, Kugeln für die Kollision, ein paar Stellen für Bewuchs und Lichtpunkte
export function buildWhale(x0, z0, yaw) {
  const g = new B(), R = rng(9137), rr = (a, b) => a + R() * (b - a), spheres = [], spots = [];
  const fl = floorH(x0, z0), base = fl + 0.15;   // Grundlinie im lokalen Raum: y = 0 liegt knapp über dem Sand
  // Wirbelsäule: 42 Wirbel vom Schädel (x = 4.6) bis zur Schwanzspitze (x = -14)
  const NV = 42, spine = [];
  for (let i = 0; i < NV; i++) {
    const t = i / (NV - 1), x = 4.6 - t * 18.6, r = 0.36 * (1 - t * 0.78) + 0.05, y = 0.42 * (1 - t) + 0.2 + Math.sin(t * 9) * 0.05;
    const z = Math.sin(t * 2.6 + 0.4) * 0.5 * t + (t > 0.85 ? (R() - 0.5) * 0.6 * (t - 0.85) * 8 : 0);   // hinten etwas verrutscht
    spine.push([x, y, z, r]);
  }
  for (let i = 0; i < NV; i++) {
    const [x, y, z, r] = spine[i], t = i / (NV - 1), len = r * 1.25;
    // Wirbelkörper: kurze Walze längs der Achse
    g.tube([[x + len * 0.5, y, z, r * 0.92], [x + len * 0.35, y, z, r], [x - len * 0.35, y, z, r], [x - len * 0.5, y, z, r * 0.92]], 12, 0, 1, [0, 1, 0], true);
    // Querfortsätze: flache Flügel zu den Seiten, hinten länger und schmaler
    if (t < 0.82) for (const sd of [-1, 1]) { const L = (0.55 + 0.7 * Math.sin(Math.min(1, t * 1.6) * Math.PI)) * (0.6 + r), dn = -0.12; g.tube([[x, y, z + sd * r * 0.7, r * 0.42], [x - 0.06, y + dn * 0.5, z + sd * (r + L * 0.55), r * 0.3], [x - 0.12, y + dn, z + sd * (r + L), r * 0.16]], 7, 0, 0.42, [0, 1, 0]); }
    // Dornfortsatz zeigt nach unten in den Sand (liegt auf dem Rücken); sichtbar nur als kurzer Stumpf; nach oben ein kleiner Gelenkfortsatz
    g.tube([[x, y + r * 0.6, z, r * 0.35], [x - 0.08, y + r * 1.35, z, r * 0.18]], 6, 1, 0.6, [1, 0, 0]);
    if (r > 0.18) spheres.push([x, y, z, r * 1.1]);
  }
  // Rippen: 13 Paare, die mittleren am größten; einige gebrochen, zwei liegen flach daneben
  const NR = 13;
  for (let k = 0; k < NR; k++) {
    const t = k / (NR - 1), xs = 3.7 - t * 6.4, sp = spine[Math.round((4.6 - xs) / 18.6 * (NV - 1))], W = 1.5 + 1.35 * Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) , H = 1.0 + 1.25 * Math.sin(Math.min(1, t * 1.15 + 0.1) * Math.PI);
    for (const sd of [-1, 1]) {
      const broken = R() < 0.14, fallen = (k === 9 && sd > 0) || (k === 4 && sd < 0), pts = [];
      const phMax = broken ? rr(1.0, 1.6) : rr(2.45, 2.7), n = 16, r0 = 0.15 * (0.7 + 0.5 * Math.sin(t * Math.PI)), lean = -0.55 - t * 0.3;
      for (let j = 0; j <= n; j++) {
        const ph = 0.12 + (phMax - 0.12) * j / n, s = j / n;
        let px = xs + lean * (1 - Math.cos(ph)) * 0.5, py = sp[1] + H * (1 - Math.cos(ph)) * 0.95 + 0.05, pz = sp[2] + sd * (sp[3] + W * Math.sin(ph) * (1 + 0.06 * Math.sin(ph * 3 + k)));
        if (fallen) { const a = sd * 0.5 + (k * 0.3); px = xs + 0.6 + Math.sin(ph) * 1.2 * Math.cos(a) * sd; pz = sp[2] + sd * (W * 0.9 + (1 - Math.cos(ph)) * 1.4); py = 0.12; }
        pts.push([px, py, pz, r0 * (1 - 0.45 * s) + 0.03]);
      }
      g.tube(pts, 8, 0, 0.75, [1, 0, 0]);
      if (!fallen) { for (const q of [0.35, 0.6, 0.85]) { const p = pts[Math.round(q * n)]; if (p) spheres.push([p[0], p[1], p[2], 0.45]); } spots.push(pts[Math.round(n * 0.55)]); }
    }
  }
  // Schädel: breiter, flacher Oberkiefer (Rostrum) nach vorn, hinten die gewölbte Hirnkapsel
  {
    const s = g.c, NS = 14, secs = [];
    for (let j = 0; j <= NS; j++) {
      const t = j / NS, x = 4.9 + t * 6.2, w = 1.75 * (1 - Math.pow(t, 1.1) * 0.86) * (t < 0.08 ? 0.85 + t * 1.9 : 1), h = 0.9 * (1 - t * 0.72), y = 0.6 + 0.35 * (1 - t) - t * 0.2;
      secs.push([x, y, w, h]);
    }
    // Querschnitte als Ringe aus Punkten: oben leicht eingedellt (Mulde), unten flach
    const M = 18, ring0 = g.c;
    for (const [x, y, w, h] of secs) for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), top = sa > 0 ? 0.85 + 0.35 * Math.pow(Math.max(0, 1 - Math.abs(ca) * 2.2), 2) : 0.5;
      const py = y + sa * h * top, pz = ca * w, nx = 0, ny = sa / h, nz = ca / w, l = Math.hypot(nx, ny, nz);
      g.v(x, py, pz, nx, ny / l, nz / l, 0);
    }
    for (let j = 0; j < NS; j++) for (let i = 0; i < M; i++) { const a = ring0 + j * M + i, b = ring0 + j * M + (i + 1) % M, c = a + M, d = b + M; g.tri(a, b, c); g.tri(b, d, c); }
    { const last = secs[NS], ci = g.v(last[0] + 0.25, last[1], 0, 1, 0, 0, 0); for (let i = 0; i < M; i++) g.tri(ring0 + NS * M + i, ring0 + NS * M + (i + 1) % M, ci); }
    g.blob(4.35, 0.95, 0, 1.05, 1.0, 1.55, 2, 0, 0.1, 3.3);                         // Hirnkapsel
    g.blob(3.75, 1.15, 0, 0.55, 0.55, 1.0, 1, 1, 0.12, 5.1);                         // Hinterhauptskamm
    for (const sd of [-1, 1]) {
      g.blob(5.1, 0.95, sd * 1.75, 0.55, 0.16, 0.9, 1, 0, 0.15, 7 + sd);            // Augenbrauenbogen (Flügel zur Seite)
      g.blob(4.2, 0.55, sd * 1.35, 0.42, 0.35, 0.5, 1, 0, 0.2, 9 + sd);             // Jochbein
      g.tube([[5.4, 1.05, sd * 0.32, 0.12], [6.1, 0.95, sd * 0.24, 0.09], [7.4, 0.75, sd * 0.12, 0.06]], 6, 1, 0.6, [1, 0, 0]);   // Nasenrinne
    }
    g.place(s, 0.25, 0.05, 0.1, 0.13, 0.04, -0.05);   // Kopf ein wenig verdreht, als hätte er sich gelöst
    spheres.push([4.4, 0.95, 0.1, 1.5], [6.4, 0.7, 0.3, 1.3], [8.6, 0.5, 0.45, 0.95]);
    spots.push([4.3, 1.9, 0.1], [6.0, 1.3, 0.2], [5.0, 1.3, 1.6]);
  }
  // Unterkiefer: zwei lange, nach außen gebogene Bögen im Sand, der linke verrutscht
  for (const sd of [-1, 1]) {
    const pts = [], off = sd < 0 ? 0.6 : 0, n = 14;
    for (let j = 0; j <= n; j++) { const t = j / n, x = 3.9 + t * 7.3 + off * t, z = sd * (1.6 + 1.05 * Math.sin(t * Math.PI * 0.9) - 0.9 * t) + (sd < 0 ? -0.5 * t : 0); pts.push([x, 0.18 + 0.12 * Math.sin(t * Math.PI), z, 0.27 * (1 - 0.5 * t) + 0.06]); }
    g.tube(pts, 10, 0, 1.35, [0, 1, 0]); for (const q of [0.2, 0.5, 0.8]) { const p = pts[Math.round(q * n)]; spheres.push([p[0], p[1], p[2], 0.4]); }
  }
  // Brustflossen: Schulterblatt (flacher Fächer), Oberarm, Unterarm, vier Finger aus kleinen Gliedern
  for (const sd of [-1, 1]) {
    const bx = 2.6 + (sd > 0 ? 0.4 : -0.3), bz = sd * 3.4;
    g.blob(bx + 0.5, 0.22, bz - sd * 0.5, 0.9, 0.12, 0.75, 1, 0, 0.18, 11 + sd);
    g.tube([[bx, 0.25, bz, 0.2], [bx - 0.15, 0.2, bz + sd * 0.9, 0.17]], 8, 0, 0.8, [0, 1, 0]);
    g.tube([[bx - 0.15, 0.2, bz + sd * 0.9, 0.16], [bx - 0.3, 0.16, bz + sd * 1.6, 0.13]], 8, 0, 0.75, [0, 1, 0]);
    for (let f = 0; f < 4; f++) { let px = bx - 0.3 + (f - 1.5) * 0.18, pz = bz + sd * 1.65; for (let q = 0; q < 5 - (f === 0 || f === 3 ? 1 : 0); q++) { const L = 0.3 - q * 0.035; g.blob(px - 0.03 * (f - 1.5), 0.13, pz + sd * L * 0.5, 0.07, 0.06, L * 0.48, 0, 0, 0.1, f * 7 + q); px -= 0.03 * (f - 1.5); pz += sd * (L + 0.04); } }
  }
  // verstreute kleine Knochen und Wirbel im Sand
  for (let i = 0; i < 9; i++) { const a = rr(0, 6.3), d = rr(4, 10), px = -6 + Math.cos(a) * d * 1.3, pz = Math.sin(a) * d; g.blob(px, 0.08, pz, rr(0.12, 0.3), rr(0.08, 0.16), rr(0.1, 0.25), 1, R() < 0.4 ? 1 : 0, 0.25, i * 3, R() * 6.3); }
  for (let i = 0; i < 4; i++) { const px = rr(-16, -11), pz = rr(-1.6, 1.6), r = rr(0.08, 0.12); g.tube([[px + 0.12, 0.1, pz, r], [px - 0.12, 0.1, pz + rr(-0.05, 0.05), r]], 8, 0, 1, [0, 1, 0]); }
  // auf den Grund legen; hinten sinkt das Skelett etwas tiefer ein
  g.place(0, x0, base, z0, yaw, 0.0, 0);
  for (let k = 0; k < g.c; k++) { const x = g.p[k * 3], z = g.p[k * 3 + 2]; g.p[k * 3 + 1] += floorH(x, z) - fl; }   // dem leicht welligen Grund folgen
  const cY = Math.cos(yaw), sY = Math.sin(yaw), toW = (p) => { const x = x0 + p[0] * cY + p[2] * sY, z = z0 - p[0] * sY + p[2] * cY; return [x, base + p[1] + floorH(x, z) - fl, z]; };
  // Verdeckung: im Gewölbe der Rippen dunkler, außen heller
  g.occlude(1.4, (x, y, z, nx, ny, nz) => { const lx = (x - x0) * cY - (z - z0) * sY, lz = (x - x0) * sY + (z - z0) * cY, inCage = lx < 4 && lx > -3.2 ? 1 - smooth(1.4, 3.0, Math.abs(lz)) : 0; return 1 - 0.32 * inCage * (1 - smooth(0.0, 3.4, y - base)); });
  return { geo: g.build(), spheres: spheres.map((s) => { const p = toW(s); return { x: p[0], y: p[1], z: p[2], r: s[3] }; }), spots: spots.map(toW) };
}

// ---------- Taucherglocke: Gusseisen mit Nietenreihen, kleinen Sichtfenstern, Hebeöse, Kette und Luftschlauch ----------
export function buildBell(x0, z0, yaw) {
  const g = new B(), R = rng(5521), rr = (a, b) => a + R() * (b - a), S = 28;
  // Außenhaut: unten weit mit dickem Rand, leicht taillierte Wand, runde Schulter, flache Kuppel
  const OUT = [[0.0, 1.32], [0.05, 1.36], [0.16, 1.36], [0.2, 1.3], [0.7, 1.22], [1.3, 1.13], [1.9, 1.04], [2.3, 0.94], [2.58, 0.8], [2.8, 0.6], [2.95, 0.38], [3.04, 0.15], [3.06, 0.0]];
  g.lathe(0, 0, 0, OUT, S, 2);
  const rAtY = (y) => { for (let i = 0; i < OUT.length - 1; i++) if (y <= OUT[i + 1][0]) { const t = (y - OUT[i][0]) / (OUT[i + 1][0] - OUT[i][0]); return OUT[i][1] + (OUT[i + 1][1] - OUT[i][1]) * t; } return 0; };
  // Innenseite: man sieht von unten in die dunkle Glocke
  g.lathe(0, 0, 0, [[0.0, 1.24], [0.7, 1.14], [1.6, 1.0], [2.3, 0.86], [2.6, 0.55], [2.7, 0.0]], S, 2, true);
  for (let k = g.c - (S + 1) * 6; k < g.c; k++) g.o[k] = 0.25;
  // Bänder mit Nieten
  for (const y of [0.32, 1.05, 1.8, 2.42]) { const r = rAtY(y); g.ring(0, y, 0, r + 0.01, 0.045, 6, 48, 2); for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; g.blob(Math.cos(a) * (r + 0.07), y + 0.07, Math.sin(a) * (r + 0.07), 0.03, 0.03, 0.03, 0, 2, 0.05, i); g.blob(Math.cos(a) * (r + 0.07), y - 0.07, Math.sin(a) * (r + 0.07), 0.03, 0.03, 0.03, 0, 2, 0.05, i + 50); } }
  for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2 + 0.4; for (let y = 0.25; y < 2.5; y += 0.16) { const r = rAtY(y) + 0.02; g.blob(Math.cos(a) * r, y, Math.sin(a) * r, 0.028, 0.028, 0.028, 0, 2, 0.05, y * 30 + s); } }
  // Sichtfenster in der Kuppel: Messingrahmen, dickes Glas
  const port = (y, r, a, rad, tilt) => {
    const nx = Math.cos(a) * Math.cos(tilt), ny = Math.sin(tilt), nz = Math.sin(a) * Math.cos(tilt), px = Math.cos(a) * r, pz = Math.sin(a) * r;
    const s = g.c; g.ring(0, 0, 0, rad, 0.045, 7, 20, 4, 'z'); g.tube([[0, 0, -0.02, rad - 0.01, 3], [0, 0, 0.03, rad * 0.9, 3], [0, 0, 0.05, rad * 0.5, 3]], 16, 3, 1, [0, 1, 0], true);
    const yaw2 = Math.atan2(nx, nz), pitch = -Math.asin(ny); g.place(s, px, y, pz, yaw2, pitch, 0);
  };
  for (let i = 0; i < 6; i++) port(2.74, rAtY(2.74) + 0.01, i / 6 * Math.PI * 2 + 0.2, 0.12, 0.8);
  port(3.07, 0.0, 0, 0.15, 1.5707);
  for (const a of [0.9, 0.9 + Math.PI]) { port(1.45, rAtY(1.45) + 0.01, a, 0.21, 0.07); for (let b = -1; b <= 1; b++) { const s = g.c; g.tube([[0, b * 0.09, 0.06, 0.016], [0, b * 0.09, 0.06, 0.016]].map((p, i) => [i ? 0.2 : -0.2, p[1], p[2], p[3]]), 5, 2, 1, [0, 1, 0]); g.place(s, Math.cos(a) * (rAtY(1.45) + 0.04), 1.45, Math.sin(a) * (rAtY(1.45) + 0.04), Math.atan2(Math.cos(a), Math.sin(a)), 0, 0); } }
  // Hebeöse oben mit Schäkel
  g.blob(0, 3.1, 0, 0.26, 0.1, 0.26, 1, 2, 0.05, 4);
  { const s = g.c; g.ring(0, 0, 0, 0.2, 0.055, 7, 22, 2, 'z'); g.place(s, 0, 3.39, 0, 0.3, 0, 0); }
  // Ballastgewichte am Rand
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.blob(Math.cos(a) * 1.45, 0.18, Math.sin(a) * 1.45, 0.22, 0.16, 0.3, 1, 2, 0.08, i * 5, -a); }
  // Luftanschluss: Messingbogen an der Schulter
  g.tube([[0.53, 2.75, 0.53, 0.075], [0.63, 2.84, 0.63, 0.075], [0.78, 2.8, 0.78, 0.07], [0.84, 2.62, 0.84, 0.065]], 8, 4, 1, [0, 1, 0]);
  const top = g.c;
  // die Glocke liegt schief im Sand
  const fl = floorH(x0, z0), nT = { x: 0, y: 1, z: 0 }; floorN(x0, z0, nT);
  const tilt = 0.24, roll = 0.1 + Math.atan2(nT.x, nT.y) * 0.5;
  g.place(0, x0, fl - 0.35, z0, yaw, tilt, roll);
  const M = new T.Matrix4().makeRotationFromEuler(new T.Euler(tilt, yaw, roll, 'YXZ')).setPosition(x0, fl - 0.35, z0), w = (x, y, z) => new T.Vector3(x, y, z).applyMatrix4(M);
  // Kette: hängt durch die Öse, liegt über Schulter und Flanke der Glocke und läuft dann lose über den Grund aus.
  // Ovale Glieder, abwechselnd um 90° gedreht und so eng gesetzt, dass jedes durch das nächste greift.
  {
    const phi = 2.85, cp = Math.cos(phi), sp = Math.sin(phi), prof = [[0, 3.535], [0.14, 3.45], [0.27, 3.27], [0.36, 3.1]];
    for (const y of [2.98, 2.86, 2.7, 2.5, 2.3, 2.0, 1.7, 1.4, 1.1, 0.8, 0.5, 0.3]) prof.push([rAtY(y) + 0.062, y + (y > 2.2 ? 0.035 : 0)]);
    let path = []; for (const [r, y] of prof) { const q = w(cp * r, y, sp * r); if (path.length > 4 && q.y < meshH(q.x, q.z) + 0.06) break; path.push([q.x, q.y, q.z]); }
    // am Grund weiter: von der Glocke weg, in weichen Bögen, immer knapp über dem Boden
    { const l = path[path.length - 1], c0 = w(0, 0, 0); let h = Math.atan2(l[0] - c0.x, l[2] - c0.z), px = l[0], pz = l[2];
      for (let i = 1; i <= 48; i++) { h += Math.sin(i * 0.31 + 1.0) * 0.11; px += Math.sin(h) * 0.1; pz += Math.cos(h) * 0.1; const gy = meshH(px, pz) + 0.058; path.push([px, i < 4 ? Math.max(gy, l[1] + (gy - l[1]) * (i / 4)) : gy, pz]); } }
    for (let k = 0; k < 2; k++) { const q = [path[0]]; for (let i = 0; i < path.length - 1; i++) { const a2 = path[i], b2 = path[i + 1]; q.push([a2[0] * 0.75 + b2[0] * 0.25, a2[1] * 0.75 + b2[1] * 0.25, a2[2] * 0.75 + b2[2] * 0.25], [a2[0] * 0.25 + b2[0] * 0.75, a2[1] * 0.25 + b2[1] * 0.75, a2[2] * 0.25 + b2[2] * 0.75]); } q.push(path[path.length - 1]); path = q; }
    for (const q of path) q[1] = Math.max(q[1], meshH(q[0], q[2]) + 0.058);
    // gleichmäßig nach Bogenlänge abtasten: ein Glied je Teilung
    const LA = 0.078, LB = 0.044, LR = 0.0155, PITCH = 2 * (LA - LR) - 0.004, cen = []; let acc = 0, need = 0;
    for (let i = 0; i < path.length - 1; i++) { const a2 = path[i], b2 = path[i + 1], d = Math.hypot(b2[0] - a2[0], b2[1] - a2[1], b2[2] - a2[2]); while (need <= acc + d) { const u = (need - acc) / d; cen.push([a2[0] + (b2[0] - a2[0]) * u, a2[1] + (b2[1] - a2[1]) * u, a2[2] + (b2[2] - a2[2]) * u]); need += PITCH; } acc += d; }
    const oval = []; for (let i = 0; i <= 6; i++) { const an = i / 6 * Math.PI; oval.push([Math.cos(an) * LB, 0, (LA - LB) + Math.sin(an) * LB, LR]); } for (let i = 0; i <= 6; i++) { const an = Math.PI + i / 6 * Math.PI; oval.push([Math.cos(an) * LB, 0, -(LA - LB) + Math.sin(an) * LB, LR]); } oval.push(oval[0].slice());
    for (let i = 0; i < cen.length; i++) {
      const p = cen[Math.max(0, i - 1)], q = cen[Math.min(cen.length - 1, i + 1)], c = cen[i], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], dl = Math.hypot(dx, dy, dz) || 1, s = g.c;
      g.tube(oval, 5, 6, 1, [0, 1, 0], false); g.place(s, c[0], c[1], c[2], Math.atan2(dx, dz), -Math.asin(dy / dl), i % 2 ? 1.5708 : 0.12 * Math.sin(i * 1.7));
    }
  }
  // Schlauch: vom Anschluss hinunter und in Windungen über den Grund, am Ende abgerissen
  {
    const a = w(0.84, 2.6, 0.84), pts = [[a.x, a.y, a.z, 0.075]]; let px = a.x, pz = a.z, h = yaw + 0.6;
    for (let i = 1; i < 34; i++) { h += Math.sin(i * 0.5) * 0.3; px += Math.sin(h) * 0.35; pz += Math.cos(h) * 0.35; const fy = floorH(px, pz) + 0.06; pts.push([px, i < 5 ? a.y + (fy - a.y) * (i / 5) : fy, pz, 0.075]); }
    g.tube(pts, 8, 5, 1, [0, 1, 0]);
  }
  for (let k = top; k < g.c; k++) g.o[k] *= 0.9;
  g.occlude(0.9);
  const c = w(0, 1.2, 0);
  return { geo: g.build(), spheres: [{ x: c.x, y: c.y, z: c.z, r: 1.45 }, { x: c.x, y: c.y + 0.9, z: c.z, r: 1.0 }], top: w(0, 3.1, 0) };
}

// ---------- Messingdose des Kapitäns: verschraubter Zylinder mit Tragring, daneben ein Stab mit einer kleinen Lampe ----------
export function buildCanister(x0, z0, yaw = 0) {
  const g = new B();
  g.lathe(0, 0, 0, [[0, 0.0], [0, 0.25], [0.04, 0.27], [0.12, 0.27], [0.14, 0.255], [0.78, 0.255], [0.8, 0.27], [0.9, 0.27], [0.92, 0.25], [0.94, 0.12], [0.95, 0.0]], 18, 4);
  for (const y of [0.3, 0.62]) g.ring(0, y, 0, 0.258, 0.016, 5, 20, 4);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.blob(Math.cos(a) * 0.2, 0.955, Math.sin(a) * 0.2, 0.028, 0.02, 0.028, 0, 2, 0.05, i); }
  { const s = g.c; g.ring(0, 0, 0, 0.09, 0.018, 6, 14, 2, 'z'); g.place(s, 0, 1.01, 0, 0.5, 0, 0); }
  g.tube([[0.36, -0.2, 0.1, 0.022], [0.37, 0.6, 0.1, 0.02], [0.385, 1.32, 0.1, 0.016]], 6, 2, 1, [1, 0, 0]);
  g.lathe(0.385, 1.3, 0.1, [[0, 0.03], [0.02, 0.05], [0.04, 0.05], [0.05, 0.0]], 8, 4);
  g.blob(0.385, 1.42, 0.1, 0.06, 0.075, 0.06, 1, 3, 0.02, 2);
  g.lathe(0.385, 1.48, 0.1, [[0, 0.045], [0.03, 0.02], [0.04, 0.0]], 8, 4);
  const y = meshH(x0, z0) - 0.1; g.place(0, x0, y, z0, yaw, 0.1, -0.07);
  const lamp = new T.Vector3(0.385, 1.42, 0.1).applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(0.1, yaw, -0.07, 'YXZ')).setPosition(x0, y, z0));
  g.occlude(0.7);
  return { geo: g.build(), lamp };
}

// ---------- Lichtsäule über der Schnee-Ebene: ein paar weiche, senkrechte Bahnen, die langsam atmen ----------
export function createShaft(scene, x, z, yTop, yBot, rad) {
  const R = rng(77), g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = [], iQ = [];
  for (let i = 0; i < 9; i++) { const a = R() * 6.3, d = Math.sqrt(R()) * rad * 0.45; iP.push(x + Math.cos(a) * d, yBot, z + Math.sin(a) * d, rad * (0.35 + R() * 0.5)); iQ.push(yTop - yBot, R() * 6.3, 0.5 + R() * 0.6, 0); }
  g.setAttribute('iP', new T.InstancedBufferAttribute(new Float32Array(iP), 4)); g.setAttribute('iQ', new T.InstancedBufferAttribute(new Float32Array(iQ), 4)); g.instanceCount = 9;
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: uni(), side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec4 iP, iQ; uniform float uTime; varying vec2 vQ; varying vec3 vW; varying float vI;
      void main(){ vec3 p0 = iP.xyz + vec3(sin(uTime * 0.04 + iQ.y) * 1.5, position.y * iQ.x, cos(uTime * 0.035 + iQ.y) * 1.5);
        vec3 sd = normalize(cross(vec3(0.0, 1.0, 0.0), cameraPosition - p0)); vec3 p = p0 + sd * position.x * iP.w * (1.0 - position.y * 0.55);
        vQ = position.xy; vW = p; vI = iQ.z * (0.7 + 0.3 * sin(uTime * 0.21 + iQ.y * 2.0)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `precision highp float; uniform float uFogK; varying vec2 vQ; varying vec3 vW; varying float vI;
      void main(){ float e = 1.0 - 4.0 * vQ.x * vQ.x, d = distance(vW, cameraPosition); float a = e * e * smoothstep(0.0, 0.25, vQ.y) * (1.0 - smoothstep(0.55, 1.0, vQ.y)) * smoothstep(3.0, 18.0, d) * exp(-d * uFogK * 0.35);
        gl_FragColor = vec4(vec3(0.10, 0.32, 0.42) * a * vI * 0.55, 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = 3; scene.add(m); return m;
}
