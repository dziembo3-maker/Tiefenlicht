// reverse.js – Rückwärtsgang: S (oder Pfeil runter) fährt das Boot rückwärts, statt es umzudrehen.
// main.js lenkt kamerabezogen (S hieß bisher: zur Kamera hin wenden). Draußen und am Steuer fängt dieses Modul S ab,
// bevor main.js die Taste sieht, und schiebt das Boot in jedem Bild nach hinten. In der Kabine, beim Tauchen und in
// Eingabefeldern bleibt S wie bisher. Am Handy ändert sich nichts (Steuerknüppel).
let rev = false, last = 0;
const canDrive = (s) => !!s && s.V && (s.V.mode === 'out' || s.V.st === 'seat') && !(s.M && s.M.open) && !(s.CAMV && s.CAMV.on) && !(s.PERI && s.PERI.on);
const isRev = (e) => e.code === 'KeyS' || e.code === 'ArrowDown';
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!isRev(e)) return; const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (!canDrive(window.__sub)) return; rev = true; e.stopImmediatePropagation();
  }, true);
  window.addEventListener('keyup', (e) => { if (isRev(e)) rev = false; }, true);
  window.addEventListener('blur', () => { rev = false; });
}
/** in jedem Bild (aus world.update): rückwärts beschleunigen, höchstens gut 3 m/s; die Schraube dreht rückwärts */
export function reverseStep() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  const s = typeof window !== 'undefined' && window.__sub; if (!rev || !canDrive(s)) return;
  const S = s.S, fx = Math.sin(S.h), fz = Math.cos(S.h);
  S.vx -= fx * 1.9 * dt; S.vz -= fz * 1.9 * dt;   // main.js bremst mit 0,55·v, also Endgeschwindigkeit 1,9 / 0,55 ≈ 3,5 m/s
  S.prop -= dt * 16;
}
