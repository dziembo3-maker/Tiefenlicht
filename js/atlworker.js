// atlworker.js – rechnet im Hintergrund die Felsoberfläche einer Atlantis-Kachel (atlmesh.js), damit das Spiel dabei nicht ruckelt.
// util.js liest window.THREE; im Worker gibt es kein window, darum erst ein Ersatz, dann laden
self.window = self;
const ready = import('./atlmesh.js');
self.onmessage = async (e) => {
  const { id, ix, iz } = e.data;
  try { const { meshTile } = await ready; const r = meshTile(ix, iz); const tr = [r.P.buffer, r.N.buffer, r.A.buffer, r.I.buffer, r.spots.buffer]; if (r.occ) tr.push(r.occ.buffer); self.postMessage({ id, r }, tr); }
  catch (err) { self.postMessage({ id, err: String(err && err.stack || err) }); }
};
ready.then(() => self.postMessage({ hello: true }), (err) => self.postMessage({ fail: String(err) }));
