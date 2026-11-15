// upgrade.js – Fundstücke der Aufrüstungs-Mission: der starke Scheinwerfer am Wrack (unter einem umgestürzten Mast, für das Boot unerreichbar,
// nur zu Fuß im Anzug) und die zwei verstärkten Ballasttanks beim Kristallhain am Ostrand des Abgrunds. Dazu das große Lampengehäuse am Bug.
import { T, Geo } from './util.js';
import { paintMaterial } from './gfx.js';
import { floorH, WRECK } from './terrain.js';
import { wreckFrame } from './wreck.js';
import { tube } from './build.js';
import { B, propMaterial } from './props.js';

// Ort des Scheinwerfers: neben dem Rumpf der Galeone, mittschiffs, an der Seite, wo der Mast heruntergekommen ist
const F = wreckFrame(WRECK.x, WRECK.z), SIDE = 1;
const lp = F.toWorld(SIDE * 5.8, 0, 1.5);
export const LAMP = { x: lp[0], z: lp[2], y: floorH(lp[0], lp[2]) + 0.35 };
// die Tanks liegen neben der Dose der Mission (main.js setzt die Dose an m.x/m.z); hier nur ihr eigener Platz
export const TANKS = { x: -281, z: 565 };

export function createUpgrade(scene) {
  // ---------- umgestürzter Mast und eine Rah: liegen über dem Scheinwerfer, das Boot kommt nicht heran ----------
  const g = new Geo(), WOODC = [0.2, 0.15, 0.1], A = F.toWorld(SIDE * 3.0, 5.6, 4.2), Bp = F.toWorld(SIDE * 15.5, 0, -3.5); Bp[1] = floorH(Bp[0], Bp[2]) + 0.3;
  const pts = []; for (let k = 0; k <= 10; k++) { const f = k / 10; pts.push([A[0] + (Bp[0] - A[0]) * f, A[1] + (Bp[1] - A[1]) * f + Math.sin(f * Math.PI) * 0.6, A[2] + (Bp[2] - A[2]) * f]); }
  tube(g, pts, pts.map((_, k) => 0.42 - k * 0.012), 0, 10, WOODC);
  const Y0 = F.toWorld(SIDE * 7.2, 0, 6), Y1 = F.toWorld(SIDE * 9.6, 0, -2.8); Y0[1] = floorH(Y0[0], Y0[2]) + 0.25; Y1[1] = floorH(Y1[0], Y1[2]) + 0.25;
  tube(g, [Y0, [(Y0[0] + Y1[0]) / 2, (Y0[1] + Y1[1]) / 2 + 0.35, (Y0[2] + Y1[2]) / 2], Y1], 0.22, 0.16, 8, [0.24, 0.18, 0.12]);
  // ein paar Wanten hängen vom Mast herab
  for (const f of [0.3, 0.55, 0.75]) { const p = pts[Math.round(f * 10)]; tube(g, [p, [p[0] + 0.6, p[1] - 1.2, p[2] + 0.4], [p[0] + 1.1, floorH(p[0] + 1.1, p[2] + 0.8) + 0.05, p[2] + 0.8]], 0.035, 0.03, 4, [0.3, 0.27, 0.2]); }
  const mast = new T.Mesh(g.build(), paintMaterial(T.DoubleSide)); mast.frustumCulled = false; scene.add(mast);
  /** nur fürs Boot: hier ist kein Durchkommen (der Taucher geht unter dem Mast hindurch) */
  const blockers = [{ x: LAMP.x, y: LAMP.y + 2.2, z: LAMP.z, r: 4.6 }];
  for (const k of [2, 4, 6, 8]) blockers.push({ x: pts[k][0], y: pts[k][1], z: pts[k][2], r: 1.4 });

  // ---------- der Scheinwerfer: Messingtrommel mit dickem Glas, Bügel aus Eisen; liegt schräg im Sand ----------
  const lb = new B();
  lb.lathe(0, 0, 0, [[-0.32, 0.0], [-0.32, 0.18], [-0.3, 0.27], [-0.22, 0.3], [0.22, 0.31], [0.26, 0.34], [0.3, 0.34], [0.31, 0.3]], 18, 4);
  { const s = lb.c; lb.lathe(0, 0.31, 0, [[0, 0.3], [0.025, 0.24], [0.03, 0.0]], 18, 3); lb.place(s, 0, 0, 0, 0); }
  for (const y of [-0.12, 0.08]) lb.ring(0, y, 0, 0.305, 0.016, 5, 20, 4);
  lb.tube([[0.33, -0.05, 0, 0.03], [0.42, -0.05, 0, 0.03], [0.42, 0.05, -0.4, 0.03], [0, 0.05, -0.44, 0.03], [-0.42, 0.05, -0.4, 0.03], [-0.42, -0.05, 0, 0.03], [-0.33, -0.05, 0, 0.03]], 6, 2);
  lb.tube([[0, -0.32, 0.05, 0.02], [0, -0.38, 0.05, 0.02]], 6, 4);
  lb.place(0, LAMP.x, LAMP.y - 0.08, LAMP.z, 0.7, 1.25, 0.15); lb.occlude(0.6);
  const lampMesh = new T.Mesh(lb.build(), propMaterial()); lampMesh.frustumCulled = false; scene.add(lampMesh); lampMesh.visible = false;
  const glow = { x: LAMP.x, y: LAMP.y + 0.6, z: LAMP.z, col: [1.0, 0.86, 0.6], power: 1.1, size: 1.2 };

  // ---------- zwei verstärkte Ballasttanks: lange Eisenzylinder mit Messingbändern und Ventilen ----------
  const tb = new B();
  for (const [dx, dz, yaw] of [[0, 0, 0.4], [1.1, 0.9, 0.52]]) { const s = tb.c, x = TANKS.x + dx, z = TANKS.z + dz;
    tb.lathe(0, 0, 0, [[-1.3, 0.0], [-1.3, 0.2], [-1.22, 0.38], [-1.08, 0.45], [1.08, 0.45], [1.22, 0.38], [1.3, 0.2], [1.3, 0.0]], 20, 2);
    for (const y of [-0.85, -0.2, 0.45, 1.0]) tb.ring(0, y, 0, 0.455, 0.03, 5, 20, 4);
    tb.lathe(0, 1.3, 0, [[0, 0.06], [0.08, 0.06], [0.1, 0.09], [0.14, 0.09], [0.16, 0.0]], 10, 4);
    tb.place(s, x, floorH(x, z) + 0.36, z, yaw, Math.PI / 2, 0); }
  tb.occlude(0.9);
  const tankMesh = new T.Mesh(tb.build(), propMaterial()); tankMesh.frustumCulled = false; scene.add(tankMesh); tankMesh.visible = false;

  const U = {
    blockers, glow,
    set lamp(v) { lampMesh.visible = v; }, set tanks(v) { tankMesh.visible = v; },
    /** das große Lampengehäuse am Bug, wenn man den Scheinwerfer hat; on = leuchtet */
    fit(boat, has, on) {
      if (!boat.__flood) { const q = new B(), b = boat.body, z = 0.42, y = b.r + 0.2;   // oben auf dem Rumpf, vor der Luke
        q.lathe(0, 0, 0, [[-0.28, 0.0], [-0.28, 0.13], [-0.25, 0.2], [0.2, 0.22], [0.24, 0.25], [0.27, 0.25], [0.28, 0.22]], 14, 4); q.place(0, 0, y, z, 0, Math.PI / 2, 0);
        const s = q.c; q.lathe(0, 0, 0, [[0, 0.22], [0.02, 0.17], [0.025, 0.0]], 14, 3); q.place(s, 0, y, z + 0.28, 0, Math.PI / 2, 0);
        q.tube([[0, b.r - 0.1, z, 0.05], [0, y - 0.12, z, 0.05]], 6, 2);
        const m = new T.Mesh(q.build(), propMaterial()); m.frustumCulled = false; boat.group.add(m);
        const gl = new T.Mesh(new T.CircleGeometry(0.2, 16), new T.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.9, depthWrite: false })); gl.position.set(0, y, z + 0.32); boat.group.add(gl);
        boat.__flood = { m, gl }; }
      boat.__flood.m.visible = has; boat.__flood.gl.visible = has && on;
    },
  };
  return U;
}
