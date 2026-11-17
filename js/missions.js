// missions.js – die Missionen: Reihenfolge, Fundorte der Messingdosen, Kassetten. Die Texte stehen in i18n.js.
// Eine Mission beginnt an der Logbuchseite auf dem Schreibtisch. Gestartet ändert sie wenig: Die Dose liegt dann an ihrem Ort und lässt sich bergen.
import { T, glowTexture } from './util.js';
import { U } from './gfx.js';
import { buildCanister, propMaterial } from './props.js';
import { WRECK, WHALE, GROTTO, HOLE } from './terrain.js';

/** Kassetten: 0 liegt von Anfang an im Deck; die anderen findet man. page = Logbuchseite, die mit ihr kommt */
export const TAPES = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }];
/** Missionen in ihrer Reihenfolge. page = Seite, an der sie beginnt; tape = was man findet; x/z = Ort der Dose;
 *  off = wo die Dose im Ping-Fächer liegt (-1 linker Rand, 0 Mitte, 1 rechter Rand), fest pro Mission, damit der Fächer nicht springt */
export const MISSIONS = [
  { id: 'm1', page: 0, tape: 1, x: WRECK.x + 21, z: WRECK.z - 17, yaw: 0.6, off: 0.6, extra: 'kettle' },   // neben der Dose liegt der Kessel
  { id: 'm2', page: 1, tape: 2, x: WHALE.x + 9.5, z: WHALE.z + 8.5, yaw: 2.1, off: -0.55 },
  // in der Dose liegt die Kamera; beendet ist die Mission erst mit einem Foto der großen Kristalle (photo: Ziel, h = Höhe über Grund, r = wie nah man sein muss)
  { id: 'm3', page: 2, tape: 3, x: GROTTO.x - 9, z: GROTTO.z - 2, yaw: 1.2, off: 0.5, cam: true, photo: { x: GROTTO.x + 6, z: GROTTO.z + 4, h: 5, r: 55, name: 'n_grotto' } },
  // keine Dose: die schlafenden Pottwale liegen jedes Mal woanders (main.js wählt den Ort beim Start); finden muss man sie mit dem Horchgerät, beendet wird sie mit einem Foto der Gruppe
  { id: 'm4', page: 3, tape: null, pod: true, x: GROTTO.x + 30, z: GROTTO.z + 30, yaw: 0, photo: { pod: true, r: 60, name: 'n_whales' } },
  // das Loch: die Dose am Rand bringt eine Seite (zu eng fürs Boot, der Anzug liegt in der Glocke, eine Dose ist hineingefallen). Danach: Loch am Sonartisch markieren,
  // Anzug an der Glocke holen, zurück, hinabsteigen; unten liegen der Zahn und die hineingefallene Dose (Kassette und zweite Seite). pages: so viele Seiten bringt die Mission
  { id: 'm5', page: 4, tape: 4, tapeLate: true, pages: 2, cave: true, x: HOLE.x + 8.2, z: HOLE.z - 5.4, yaw: 2.6, off: -0.45 },
  // keine Dose: Buckelwale ziehen über dem großen Abgrund (der Ort wird beim Start gewürfelt, 400 bis 700 m vom Boot). Finden mit dem Horchgerät, beobachten,
  // dann tauchen sie ab, und man folgt ihnen bis zur Tiefengrenze. Seite und Kassette liegen im zweiten Umschlag aus der Höhlendose
  { id: 'm6', page: 6, tape: 5, hump: true, x: 95, z: 600, yaw: 0 },
  // Aufrüstung: erst den Scheinwerfer am Wrack zu Fuß holen (Stufe lamp, zurück ins Boot: lampback), dann zur Dose bei den Ballasttanks am Ostrand des Abgrunds (Stufe tanks).
  // Die Dose bringt Seite und Kassette; danach ist die Tiefengrenze aufgehoben
  { id: 'm7', page: 7, tape: 6, tanks: true, x: -284.5, z: 561.5, yaw: 0.9, off: 0.3 },
  // Probefahrt: über dem Abgrund tiefer tauchen; bei 150 m reißt eine Strömung das Boot auf das Plateau an der Abgrundwand (crash.js). Dort liegt die Kittiwake:
  // ihre Schraube ersetzt die verbogene, hinter ihrer Tür liegen Dose (Seite und Kassette) und Schweißgerät für den Riss im Tank. Danach gilt die Grenze von 450 m.
  // Keine Dose im üblichen Sinn: x/z stehen nur der Ordnung halber bei der Kittiwake
  { id: 'm8', page: 8, tape: 7, crash: true, x: -227.2, z: 552.2, yaw: 0, off: 0 },
  // ---------- Kapitel 2 „Was unter dem Licht lebt“: keine Dosen, keine Kassetten; jede Mission beginnt an einer eigenen Notiz im neuen Logbuch (page2).
  // Ablauf und Orte stehen in chapter2.js; x/z hier nur der Ordnung halber
  { id: 'm9', ch2: true, page2: 0, tape: null, x: 60, z: 700, yaw: 0 },      // Staatsqualle vermessen
  { id: 'm10', ch2: true, page2: 1, tape: null, x: 150, z: 860, yaw: 0 },    // Riesenkalmar im Dunkeln fotografieren
  { id: 'm11', ch2: true, page2: 2, tape: null, x: 301, z: 1111, yaw: 0 },   // den Laternenfischen zu den hängenden Gärten folgen
  { id: 'm12', ch2: true, page2: 3, tape: null, x: -140, z: 1138, yaw: 0 },  // toter Buckelwal: parken, Probe nehmen
  { id: 'm13', ch2: true, page2: 4, tape: null, x: 20, z: 1180, yaw: 0 },    // Vampirtintenfische, Periskop, rote Spur, der Leviathan
];
/** Kapitel 1 und 2: welche Missionen zu welchem Kapitel gehören */
export const CH1 = MISSIONS.filter((m) => !m.ch2), CH2M = MISSIONS.filter((m) => m.ch2);
/** so viele weitere Missionen deutet der Missionen-Reiter nur an */
export const HINTED = 3;
/** wie nah das Boot sein muss, um die Dose zu bergen */
export const REACH = 12;

export function createCanisters(scene, world) {
  const gt = glowTexture(), list = MISSIONS.map((m) => {
    const c = buildCanister(m.x, m.z, m.yaw, m.extra), mesh = new T.Mesh(c.geo, propMaterial()); mesh.visible = false; scene.add(mesh);
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
