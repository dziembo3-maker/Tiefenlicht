// Kollision mit den Atlantis-Felsen.
// Das Feld der Felsen ist kein exakter Abstand (Verwirbelung, Abtragung, weiche Übergänge), sein Betrag taugt also nicht zum Messen.
// Verlässlich ist nur das Vorzeichen: drinnen oder draußen, genau wie beim gezeichneten Netz.
// Darum: festes Raster (G m), an jedem Punkt im Fels, der an freies Wasser grenzt, liegt eine kleine Kugel.
// Vergrabener Fels (unter dem Sand) zählt nicht, den übernimmt der Boden.
export function makeAtlCol(rockSDF, rock2D, floorH) {
  const G = 1.5, R = 1.0, inC = new Map(), colF = new Map(), cellC = new Map();
  const ck = (i, j) => i * 100003 + j;
  function floorAt(i, j) { const k = ck(i, j); let f = colF.get(k); if (f === undefined) { f = rock2D(i * G, j * G) > 4 ? 1e9 : floorH(i * G, j * G); colF.set(k, f); } return f; }
  // 1 = Fels über dem Sand, 0 = Wasser, -1 = Sand (zählt weder als Fels noch als Wasser)
  function state(i, j, k) {
    const f = floorAt(i, j); if (f === 1e9) return 0; const y = k * G; if (y < f) return -1;
    const key = (i * 100003 + j) * 512 + (k & 511); let s = inC.get(key);
    if (s === undefined) { s = rockSDF(i * G, y, j * G) < 0 ? 1 : 0; inC.set(key, s); }
    return s;
  }
  // Kugeln für eine Säule (i,j) und ein Höhenband von 4 Rasterpunkten
  function cell(i, j, b) {
    const key = (i * 100003 + j) * 512 + (b & 511); let L = cellC.get(key); if (L) return L; L = [];
    if (floorAt(i, j) !== 1e9) for (let k = b * 4; k < b * 4 + 4; k++) {
      if (state(i, j, k) !== 1) continue;
      if (!state(i + 1, j, k) || !state(i - 1, j, k) || !state(i, j + 1, k) || !state(i, j - 1, k) || !state(i, j, k + 1) || !state(i, j, k - 1)) L.push({ x: i * G, y: k * G, z: j * G, r: R });
    }
    cellC.set(key, L); return L;
  }
  const out = [];
  /** Kugeln rund um (x,y,z): waagerecht bis RR, senkrecht ±RY */
  function around(x, y, z, RR = 10, RY = 8) {
    if (inC.size > 400000) { inC.clear(); colF.clear(); cellC.clear(); }
    out.length = 0; const i0 = Math.floor((x - RR) / G), i1 = Math.ceil((x + RR) / G), j0 = Math.floor((z - RR) / G), j1 = Math.ceil((z + RR) / G);
    const b0 = Math.floor((y - RY) / G / 4), b1 = Math.floor((y + RY) / G / 4);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      if ((i * G - x) ** 2 + (j * G - z) ** 2 > RR * RR) continue;
      for (let b = b0; b <= b1; b++) for (const s of cell(i, j, b)) out.push(s);
    }
    return out;
  }
  return { around, G, R };
}
