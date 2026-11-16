// whalefig.js – eine geschnitzte Buckelwal-Figur auf dem Regal über der Koje (nach der Buckelwal-Mission):
// genau die Form des Wals aus dem Spiel, klein, ohne Seepocken, aus dunklem Holz mit gezeichneter Maserung, auf Messingstab und Holzsockel mit Schild.
// Benutzt das Material der Kabine (aus deren Gruppe gesucht), damit sie im selben warmen Licht steht wie alles andere.
import { T, Geo } from './util.js';
import { box, tube } from './build.js';
import { buildWhale } from './humpback.js';

const WOOD = -1, MET = 1, BRASS = [0.78, 0.56, 0.24], CARVE = [0.6, 0.43, 0.3], WD3 = [0.24, 0.14, 0.08];
/** Maserung wie bei den Planken: x quer zur Faser (Dreieckswelle, damit keine Naht entsteht), y entlang der Faser, z = Brett */
const tri = (s) => Math.abs((s - Math.floor(s)) - 0.5) * 2;

export function addWhaleFigure(cabin) {
  const inner = cabin.group.children[0]; let mat = null;
  inner.traverse((o) => { const m = o.material; if (!o.isMesh || !m || !m.uniforms || !m.uniforms.uWood || m.transparent) return; mat = mat || m; });
  // Platz: das untere Regalbrett über der Koje, neben den beiden Gefäßen
  const C = [-1.215, 0.9975, -1.02], L = 0.42, yaw = 0.2, cy = Math.cos(yaw), sy = Math.sin(yaw), lift = 0.14;
  const g = new Geo(), uv = [];
  const src = buildWhale(false), P = src.attributes.position.array, N = src.attributes.normal.array, K = src.attributes.aK.array, I = src.index.array, map = new Int32Array(P.length / 3).fill(-1);
  for (let i = 0; i < P.length / 3; i++) {
    const part = K[i * 4 + 1]; if (part > 7.5) continue;   // keine Seepocken: die Figur ist glatt geschnitzt (die Knubbel bleiben, als geschnitzte Höcker)
    const x = P[i * 3] * L, y = P[i * 3 + 1] * L, z = P[i * 3 + 2] * L, nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    const eye = part > 2.5 && part < 3.5;
    map[i] = g.v(C[0] + x * cy + z * sy, C[1] + lift + y + 0.012 * Math.sin(z * 9), C[2] - x * sy + z * cy, nx * cy + nz * sy, ny, -nx * sy + nz * cy, eye ? [0.05, 0.035, 0.03] : CARVE, eye ? 0 : WOOD);
    // Faser entlang des Körpers; die Jahresringe schneiden die Oberfläche in langen Bögen
    uv.push(tri(x * 7 + y * 4 + 0.3), (0.5 - z / L) * 0.55 + y * 1.5, eye ? -1 : 1 + (x > 0 ? 0 : 1));
  }
  for (let k = 0; k < I.length; k += 3) { const a = map[I[k]], b = map[I[k + 1]], c = map[I[k + 2]]; if (a >= 0 && b >= 0 && c >= 0) g.tri(a, b, c); }
  const n0 = g.count;
  // Sockel: dunkles Holz mit abgesetzter Kante, darauf ein Messingstab; vorn ein Schild
  box(g, [C[0], C[1] + 0.018, C[2]], [0.11, 0.036, 0.2], -yaw, WD3, 0, 0, WOOD); box(g, [C[0], C[1] + 0.039, C[2]], [0.094, 0.008, 0.184], -yaw, [0.3, 0.18, 0.1], 0, 0, WOOD);
  tube(g, [[C[0], C[1] + 0.04, C[2]], [C[0], C[1] + lift - 0.02, C[2]]], 0.0045, 0.0045, 6, BRASS, 0, MET);
  box(g, [C[0] + 0.0555 * cy, C[1] + 0.02, C[2] - 0.0555 * sy], [0.003, 0.016, 0.07], -yaw, BRASS, 0, 0, MET);
  // ein kleines Messinglicht unter dem Brett darüber: Schirm und Glühbirne (leuchtet mit der Kabinenlampe)
  { const L0 = [-1.12, 1.305, -1.0]; box(g, L0, [0.05, 0.022, 0.09], 0, BRASS, 0, 0, MET); box(g, [L0[0], L0[1] - 0.016, L0[2]], [0.03, 0.012, 0.06], 0, [1.0, 0.82, 0.55], 1, 0, 2); }
  for (let i = n0; i < g.count; i++) uv.push(0, 0, -1);
  const geo = g.build(); geo.setAttribute('aUV', new T.BufferAttribute(new Float32Array(uv), 3));
  const ao = new Float32Array(g.count || geo.attributes.position.count).fill(1), nn = geo.attributes.normal.array; for (let i = 0; i < ao.length; i++) ao[i] = 0.72 + 0.28 * (nn[i * 3 + 1] * 0.5 + 0.5);   // unten etwas dunkler
  geo.setAttribute('aAO', new T.BufferAttribute(ao, 1));
  const mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; inner.add(mesh); mesh.visible = false;
  return { set visible(v) { mesh.visible = v; cabin.state.fig = v; } };
}
