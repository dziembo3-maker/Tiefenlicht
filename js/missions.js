// missions.js – die Missionen: Reihenfolge, Fundorte der Messingdosen, Kassetten. Die Texte stehen in i18n.js.
// Eine Mission beginnt an der Logbuchseite auf dem Schreibtisch. Gestartet ändert sie wenig: Die Dose liegt dann an ihrem Ort und lässt sich bergen.
import { T, glowTexture } from './util.js';
import { U } from './gfx.js';
import { buildCanister, propMaterial } from './props.js';
import { WRECK, WHALE } from './terrain.js';

/** Kassetten: 0 liegt von Anfang an im Deck; die anderen findet man. page = Logbuchseite, die mit ihr kommt */
export const TAPES = [{ id: 0 }, { id: 1 }, { id: 2 }];
/** Missionen in ihrer Reihenfolge. page = Seite, an der sie beginnt; tape = was man findet; x/z = Ort der Dose;
 *  off = wo die Dose im Ping-Fächer liegt (-1 linker Rand, 0 Mitte, 1 rechter Rand), fest pro Mission, damit der Fächer nicht springt */
export const MISSIONS = [
  { id: 'm1', page: 0, tape: 1, x: WRECK.x + 21, z: WRECK.z - 17, yaw: 0.6, off: 0.6 },
  { id: 'm2', page: 1, tape: 2, x: WHALE.x + 9.5, z: WHALE.z + 8.5, yaw: 2.1, off: -0.55 },
];
/** so viele weitere Missionen deutet der Missionen-Reiter nur an */
export const HINTED = 3;
/** wie nah das Boot sein muss, um die Dose zu bergen */
export const REACH = 12;

export function createCanisters(scene, world) {
  const gt = glowTexture(), list = MISSIONS.map((m) => {
    const c = buildCanister(m.x, m.z, m.yaw), mesh = new T.Mesh(c.geo, propMaterial()); mesh.visible = false; scene.add(mesh);
    const mk = (s, op) => { const sp = new T.Sprite(new T.SpriteMaterial({ map: gt, color: new T.Color(1.0, 0.72, 0.36), transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sp.position.copy(c.lamp); sp.scale.set(s, s, 1); sp.renderOrder = 9; sp.visible = false; scene.add(sp); return sp; };
    return { m, mesh, core: mk(0.55, 0.95), halo: mk(5.5, 0.3), lamp: c.lamp, glow: { x: c.lamp.x, y: c.lamp.y, z: c.lamp.z, col: [1.0, 0.62, 0.3], power: 1.6, size: 1.2 } };
  });
  let shown = -1;
  return {
    /** zeigt die Dose der Mission i (oder keine bei -1) */
    show(i) { if (i === shown) return; shown = i; list.forEach((c, k) => { c.mesh.visible = c.core.visible = c.halo.visible = k === i; }); world.setExtra(i >= 0 ? [list[i].glow] : []); },
    /** die Lampe atmet langsam, damit man sie im Dunkeln von Weitem bemerkt */
    update() { if (shown < 0) return; const c = list[shown], k = 0.75 + 0.25 * Math.sin(U.uTime.value * 1.7); c.halo.material.opacity = 0.3 * k; c.core.material.opacity = 0.7 + 0.25 * k; },
    lamp(i) { return list[i].lamp; },
    get shown() { return shown; },
  };
}
