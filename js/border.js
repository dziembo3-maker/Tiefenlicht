// border.js – am Kartenrand: ein ruhiger Schriftzug „Hier ist das Ende der Karte“, solange man an der Grenze ist.
// main.js schiebt das Boot jenseits von BOUNDS.r sanft zurück; dieser Hinweis sagt, warum.
import { BOUNDS } from './terrain.js';
import { getLang } from './i18n.js';

let el = null, shown = false;
function make() {
  if (el || typeof document === 'undefined' || !document.body) return el;
  el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:0;right:0;top:36%;text-align:center;color:#fff;pointer-events:none;opacity:0;transition:opacity 1.2s;z-index:30;' +
    'text-shadow:0 2px 18px rgba(0,20,35,0.9),0 0 3px rgba(0,20,35,0.6);font-family:inherit;';
  el.innerHTML = '<span style="display:block;font-size:13px;letter-spacing:0.34em;text-transform:uppercase;margin-left:0.34em;color:rgba(255,255,255,0.82)"></span>' +
    '<span style="display:block;margin-top:9px;font-size:26px;letter-spacing:0.12em;font-style:italic"></span>';
  document.body.appendChild(el); return el;
}
/** in jedem Bild mit der Position des Boots */
export function borderStep(x, z) {
  const r = Math.hypot(x, z), on = shown ? r > BOUNDS.r - 30 : r > BOUNDS.r - 6;
  if (on === shown) return; shown = on; if (!make()) return;
  const en = getLang() === 'en';
  el.children[0].textContent = en ? 'Edge of the world' : 'Kartenrand';
  el.children[1].textContent = en ? 'This is where the map ends' : 'Hier ist das Ende der Karte';
  el.style.opacity = on ? 1 : 0;
}
