// atldev.js – Entwicklermenü: unter „ORTE“ ein paar Stellen im Atlantis-Biom zum direkten Hinspringen.
// Das Menü baut main.js; hier wird nur nach jedem Neuaufbau eine Zeile mit Knöpfen angehängt.
const PLACES = [
  ['Atlantis: Eingang (Osten)', -470, -30, 0, -1.57],
  ['Atlantis: Stadtbecken', -880, -40, 690, 0],
  ['Atlantis: Säulenwände', -1050, -50, 720, 1.0],
  ['Atlantis: Türme', -670, -20, -300, -1.57],
  ['Atlantis: Felstor oben', -1185, -21, 137, -1.55],
  ['Atlantis: Bogen unten', -1404, -72, -415, 2.11],
  ['Atlantis: Höhle', -1477, -73, 555, 1.85],
  ['Atlantis: Tangwald', -930, -72, 90, 0],
  ['Atlantis: Tangdickicht', -1172, -70, -102, 1.57],
  ['Atlantis: Dünen mit Seegras', -1240, -76, -10, 0.5],
  ['Atlantis: Abbruch Süd', -905, -60, -600, 3.14],
];
function go(p) {
  const s = window.__sub; if (!s) return;
  const jump = () => { s.tp(p[1], p[2], p[3], p[4]); try { s.save(); } catch (e) { /* egal */ } };
  if (s.V && s.V.mode === 'in') { s.setMode('out'); setTimeout(jump, 1300); } else jump();
}
function inject(dev) {
  if (dev.querySelector('.atlRow')) return;
  const head = [...dev.querySelectorAll('.dsec')].find((h) => h.textContent.includes('ORTE')); if (!head) return;
  const body = head.nextElementSibling; if (!body) return;
  const h = document.createElement('h3'); h.textContent = 'ATLANTIS'; body.appendChild(h);
  const r = document.createElement('div'); r.className = 'row atlRow'; r.style.flexWrap = 'wrap'; body.appendChild(r);
  for (const p of PLACES) { const b = document.createElement('span'); b.className = 'pill mini'; b.textContent = p[0]; b.addEventListener('click', () => go(p)); r.appendChild(b); }
}
function watch() {
  const dev = document.getElementById('dev'); if (!dev) return;
  new MutationObserver(() => inject(dev)).observe(dev, { childList: true }); inject(dev);
}
if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch(); }
