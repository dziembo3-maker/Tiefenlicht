// sonartable.js – der große Sonarschirm am Tisch in der Kabine: 500 m Reichweite, der Strahl zeichnet nach und nach
// die Umrisse von Schluchten und Becken; Fundstellen erscheinen nur als unbestimmte Flecken. Antippen setzt einen Kurs.
import { wrapPi } from './util.js';
const smoothA = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
import { floorH, solidH, deepAt } from './terrain.js';
import { poisNear } from './world.js';

export function createTable(S, nav, cv, sector = () => null, extra = () => [], label = () => null, dirs = () => ['N', 'O', 'S', 'W']) {   // dirs: Himmelsrichtungen in der Sprache des Spiels   // label(p): Kurzname eines Flecks, sobald er im Logbuch steht (sonst null)
  const N = cv.width, c = N / 2, R = c - 16, TR = 500, k = R / TR, cx = cv.getContext('2d');
  const ph = document.createElement('canvas'); ph.width = ph.height = N; const px = ph.getContext('2d');
  const TB = { a: 0, blobs: [], pois: [], poiT: 0, fadeT: 0, open: false };
  const scr = (x, z) => { const dx = x - S.x, dz = z - S.z, ch = Math.cos(S.h), sh = Math.sin(S.h); return [c - (dx * ch - dz * sh) * k, c - (dx * sh + dz * ch) * k]; };
  TB.reset = () => { px.clearRect(0, 0, N, N); TB.blobs.length = 0; TB.poiT = 0; };
  TB.step = (dt) => {
    TB.poiT -= dt; if (TB.poiT <= 0) { TB.poiT = 4; TB.pois = poisNear(S.x, S.z, TR).concat(extra()); }   // extra: Stellen, die nur der Tisch kennt (das Loch während der Mission)
    TB.fadeT += dt; if (TB.fadeT > 0.07) { TB.fadeT = 0; px.fillStyle = 'rgba(0,5,2,0.045)'; px.fillRect(0, 0, N, N); }
    const a0 = TB.a, a1 = a0 + dt * 1.2, n = Math.max(1, Math.ceil((a1 - a0) / 0.011)), yRef = Math.min(S.y, -44);
    for (let i = 1; i <= n; i++) {
      const t = a0 + (a1 - a0) * i / n, wa = S.h - t, dx = Math.sin(wa), dz = Math.cos(wa), sx = Math.sin(t), sy = -Math.cos(t); let prev = solidH(S.x + dx * 6, S.z + dz * 6) > yRef;
      for (let d = 12; d <= TR; d += 5) {
        const h = solidH(S.x + dx * d, S.z + dz * d), solid = h > yRef, w = Math.max(2.4, d * k * 0.015);
        if (solid !== prev) { px.fillStyle = 'rgba(130,255,170,0.95)'; px.fillRect(c + sx * d * k - w / 2, c + sy * d * k - w / 2, w, w); }
        else if (solid) { px.fillStyle = 'rgba(40,160,85,0.2)'; px.fillRect(c + sx * d * k - w / 2, c + sy * d * k - w / 2, w, w); }
        else if (h < deepAt(S.x + dx * d, S.z + dz * d) - 4 && ((d / 5) & 1)) { px.fillStyle = 'rgba(20,70,60,0.16)'; px.fillRect(c + sx * d * k - 1, c + sy * d * k - 1, 2, 2); }
        prev = solid;
      }
    }
    const b0 = ((a0 % 6.2832) + 6.2832) % 6.2832;
    for (const p of TB.pois) {
      const d = Math.hypot(p.x - S.x, p.z - S.z); if (d > TR || (d < 8 && !p.always)) continue;
      const rel = ((wrapPi(S.h - Math.atan2(p.x - S.x, p.z - S.z)) % 6.2832) + 6.2832) % 6.2832, dl = ((rel - b0) % 6.2832 + 6.2832) % 6.2832; if (dl >= a1 - a0) continue;
      const q = scr(p.x, p.z), hsh = Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1, rb = 10 + hsh * 10, g = px.createRadialGradient(q[0], q[1], 0, q[0], q[1], rb);
      g.addColorStop(0, 'rgba(225,255,235,0.95)'); g.addColorStop(0.45, 'rgba(120,255,170,0.5)'); g.addColorStop(1, 'rgba(60,255,130,0)'); px.fillStyle = g; px.beginPath(); px.ellipse(q[0], q[1], rb, rb * (0.6 + hsh * 0.4), hsh * 3, 0, 6.2832); px.fill();
      const old = TB.blobs.find((b) => b.x === p.x && b.z === p.z); if (old) { old.sx = q[0]; old.sy = q[1]; old.seenT = 0; } else TB.blobs.push({ x: p.x, z: p.z, sx: q[0], sy: q[1], p, seenT: 0 });
    }
    for (const b of TB.blobs) b.seenT += dt;
    TB.a = a1 % 6.2832;
  };
  /** zeichnet den Schirm auf eine Zeichenfläche (groß am Tisch, klein als Bildschirm im Raum) */
  TB.draw = (ctx = cx, size = N) => {
    const s = size / N; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.clearRect(0, 0, N, N);
    ctx.fillStyle = '#010503'; ctx.beginPath(); ctx.arc(c, c, c, 0, 6.2832); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.clip();
    const gr = ctx.createRadialGradient(c, c, 0, c, c, R); gr.addColorStop(0, 'rgba(16,60,30,0.5)'); gr.addColorStop(1, 'rgba(3,18,8,0.5)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(ph, 0, 0); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(70,230,120,0.2)'; ctx.lineWidth = 1.5; for (let r = 100; r <= TR; r += 100) { ctx.beginPath(); ctx.arc(c, c, r * k, 0, 6.2832); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
    const sa = TB.a - Math.PI / 2; for (let i = 0; i < 26; i++) { const a = sa - i * 0.022; ctx.fillStyle = `rgba(70,255,130,${0.2 * Math.pow(1 - i / 26, 2)})`; ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, a - 0.024, a); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(160,255,190,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(sa) * R, c + Math.sin(sa) * R); ctx.stroke();
    { const sv = sector(); if (sv) {   // Fächer der Missionsdose aus dem letzten Ping: schwach, nur die Richtung
      const al = Math.min(1, sv.life * 3), ph = -Math.PI / 2 - wrapPi(sv.th - S.h), g = ctx.createRadialGradient(c, c, 0, c, c, R); g.addColorStop(0, 'rgba(255,190,80,0)'); g.addColorStop(1, `rgba(255,190,80,${0.22 * al})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, ph - sv.half, ph + sv.half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,214,130,${0.8 * al})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c, c, R - 3, ph - sv.half, ph + sv.half); ctx.stroke(); } }
    if (nav.course) { const q = scr(nav.course.x, nav.course.z), d = Math.hypot(q[0] - c, q[1] - c); if (d < R - 6) { ctx.strokeStyle = 'rgba(255,205,120,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q[0], q[1], 17, 0, 6.2832); ctx.stroke(); ctx.setLineDash([5, 7]); ctx.strokeStyle = 'rgba(255,205,120,0.45)'; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]); } }
    if (size === N) {   // Namen bekannter Orte, klein neben ihrem Fleck (nur am großen Tisch, nicht auf dem kleinen Schirm im Raum)
      ctx.font = '15px ui-monospace, Menlo, Consolas, monospace'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,8,3,0.95)'; ctx.shadowBlur = 6;
      for (const b of TB.blobs) { const nm = label(b.p); if (!nm) continue; const q = scr(b.x, b.z), d = Math.hypot(q[0] - c, q[1] - c); if (d > R - 8) continue;
        const w = ctx.measureText(nm).width, right = q[0] + 18 + w < c + Math.sqrt(Math.max(0, R * R - (q[1] - c) ** 2)) - 6, al = 0.82 * (1 - smoothA(10, 40, b.seenT));
        if (al <= 0.02) continue; ctx.fillStyle = `rgba(175,255,205,${al})`; ctx.textAlign = right ? 'left' : 'right'; ctx.fillText(nm, q[0] + (right ? 18 : -18), q[1]); }
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; }
    if (size === N) {   // Kompassring: die Himmelsrichtungen drehen sich mit dem Bild, Norden etwas heller
      const D = dirs(); ctx.font = 'bold 20px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,8,3,0.95)'; ctx.shadowBlur = 6;
      for (let i = 0; i < 4; i++) { const wx = [0, 1, 0, -1][i], wz = [1, 0, -1, 0][i], q = scr(S.x + wx * 100, S.z + wz * 100), ux = (q[0] - c) / (100 * k), uy = (q[1] - c) / (100 * k), rr = R - 18;
        ctx.fillStyle = i === 0 ? 'rgba(255,215,140,0.95)' : 'rgba(160,255,195,0.75)'; ctx.fillText(D[i], c + ux * rr, c + uy * rr);
        ctx.strokeStyle = i === 0 ? 'rgba(255,215,140,0.8)' : 'rgba(160,255,195,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c + ux * (R - 2), c + uy * (R - 2)); ctx.lineTo(c + ux * (R - 8), c + uy * (R - 8)); ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; }
    ctx.restore();
    ctx.fillStyle = 'rgba(110,255,160,0.45)'; ctx.font = '15px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; for (let r = 100; r < TR; r += 100) ctx.fillText(r + '', c + 5, c - r * k + 16);   // 500 am Rand entfällt, dort steht der Kompass
    ctx.fillStyle = 'rgba(210,255,225,0.95)'; ctx.beginPath(); ctx.moveTo(c, c - 9); ctx.lineTo(c + 6, c + 7); ctx.lineTo(c - 6, c + 7); ctx.closePath(); ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  /** Antippen (in Pixeln der Zeichenfläche): Fleck oder freie Stelle wird Kurs; nochmal auf den Kurs tippen löscht ihn */
  TB.tap = (x, y) => {
    const d = Math.hypot(x - c, y - c); if (d > R) return;
    if (nav.course) { const q = scr(nav.course.x, nav.course.z); if (Math.hypot(q[0] - x, q[1] - y) < 30) { nav.course = null; return; } }
    let best = null, bd = 34; for (const b of TB.blobs) { const q = scr(b.x, b.z), e = Math.hypot(q[0] - x, q[1] - y); if (e < bd) { bd = e; best = b; } }
    if (best) { nav.course = { x: best.x, z: best.z }; return; }
    const t = Math.atan2(x - c, -(y - c)), wa = S.h - t, m = d / k; nav.course = { x: S.x + Math.sin(wa) * m, z: S.z + Math.cos(wa) * m };
  };
  return TB;
}
