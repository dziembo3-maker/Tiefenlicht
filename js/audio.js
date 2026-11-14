import PING_B64 from './snd_ping.js';
// audio.js – gedämpfte Unterwasserwelt, alles live erzeugt: Brummen, Rauschen, Blasen, Sonarton, fernes Grollen. Keine Musik.
export function createAudio() {
  let ctx = null, master = null, noiseBuf = null, echo = null, eng = null, bubT = 1, groanT = 14, pingBus = null, pingOut = null, pingWet = null, outLP = null, inside = false, crackT = 1, mus = null, whistle = null, DEST = null, glow = null;
  const A = { started: false, muted: false };
  /** Mischpult: Lautstärke je Klanggruppe (1 = normal). Rauschen bewusst leise, Wasser und Blasen kräftiger */
  A.mix = { rausch: 0.25, wasser: 2.2, blasen: 2.4, motor: 1, grollen: 1, sonar: 1, kassette: 1, kabine: 1 };
  const BUS = {};
  A.setMix = (k, v) => { A.mix[k] = v; if (BUS[k] && ctx) BUS[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  const noise = (rate) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s; };

  A.start = () => {
    if (A.started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    A.started = true;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 6; comp.attack.value = 0.005; comp.release.value = 0.25; comp.connect(ctx.destination); DEST = comp;
    const out = filt('lowpass', 5200, 0.5); out.connect(DEST); outLP = out;
    master = gain(0); master.connect(out); master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);
    for (const k of ['rausch', 'wasser', 'blasen', 'motor', 'grollen']) { BUS[k] = gain(A.mix[k]); BUS[k].connect(master); }
    for (const k of ['sonar', 'kassette', 'kabine']) { BUS[k] = gain(A.mix[k]); BUS[k].connect(DEST); }
    const len = ctx.sampleRate * 3; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b * 3 + (Math.random() * 2 - 1) * 0.25; }
    // langes Echo: der Raum unter Wasser
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.56; const fb = gain(0.5), lp = filt('lowpass', 1500, 0.5); echo = gain(1);
    chain(echo, dl, lp, fb, dl); lp.connect(master);
    // eigener, ungedämpfter Weg für das Sonar mit langem Hall
    pingOut = gain(0.8); pingOut.connect(BUS.sonar); pingBus = gain(1); pingBus.connect(pingOut);
    const il = Math.floor(ctx.sampleRate * 3.4), ir = ctx.createBuffer(2, il, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d2 = ir.getChannelData(c); let lp2 = 0; for (let i = 0; i < il; i++) { lp2 = lp2 * 0.55 + (Math.random() * 2 - 1) * 0.45; d2[i] = lp2 * Math.pow(1 - i / il, 2.6) * (i < 600 ? i / 600 : 1); } }
    const cv = ctx.createConvolver(); cv.buffer = ir; pingWet = gain(1); const wg2 = gain(0.5); chain(pingWet, cv, wg2, pingOut); const sendW = gain(0.55); pingBus.connect(sendW); sendW.connect(pingWet);
    { const gb = filt('lowpass', 260, 0.7), gl2 = gain(0); glow = gl2; chain(noise(0.35), gb, gl2, BUS.kabine); const lf = ctx.createOscillator(), lg = gain(90); lf.frequency.value = 0.13; chain(lf, lg, gb.frequency); lf.start(); }
    loadPing();
    // Grundrauschen der Tiefe
    chain(noise(0.5), filt('lowpass', 150, 0.6), gain(0.5), BUS.rausch);
    const wash = filt('bandpass', 520, 0.5), wg = gain(0.02); chain(noise(0.8), wash, wg, BUS.rausch);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = gain(0.012); chain(lfo, lg, wg.gain); lfo.start();
    // Motor: zwei tiefe Töne und ein Strömungsrauschen
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = 44; o2.frequency.value = 66.4;
    const g2 = gain(0.35), elp = filt('lowpass', 150, 1.2), eg = gain(0.05); o1.connect(elp); chain(o2, g2, elp); chain(elp, eg, BUS.motor); o1.start(); o2.start();
    const rf = filt('bandpass', 240, 0.8), rg = gain(0); chain(noise(1), rf, rg, BUS.wasser);
    eng = { o1, o2, eg, rf, rg, elp };
  };
  A.setMuted = (m) => { A.muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.2); };
  A.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = () => { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  function tone(type, f0, f1, att, dec, peak, toEcho = 0, when = 0, dest = master) {
    const o = ctx.createOscillator(), g = gain(0), t0 = ctx.currentTime + when; o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + att + dec);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dec);
    chain(o, g, dest); if (toEcho) { const e = gain(toEcho); g.connect(e); e.connect(echo); }
    o.start(t0); o.stop(t0 + att + dec + 0.1);
  }
  // Sonar: Max' Aufnahme; das Echo ist dieselbe Aufnahme, leiser, dumpfer und aus der Richtung des Ziels
  let pingBuf = null;
  function loadPing() {
    try { const bin = atob(PING_B64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const p = ctx.decodeAudioData(u8.buffer, (b) => { pingBuf = b; }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ohne Ping weiter */ }
  }
  function play(buf, vol, rate, pan, lp, wet) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; const g = gain(vol); let n = s;
    if (lp) { const f = filt('lowpass', lp, 0.6); s.connect(f); n = f; } n.connect(g);
    let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(pingOut); if (wet) { const w = gain(wet); out.connect(w); w.connect(pingWet); } s.start();
  }
  A.ping = () => { if (ctx && pingBuf) play(pingBuf, 0.9, 1, 0, 0, 0.18); };
  A.echo = (vol, pan) => { if (ctx && pingBuf) play(pingBuf, 0.22 * vol + 0.05, 0.985, pan, 1400 + 1200 * vol, 0.5); };
  A.blip = () => {};

  A.setInside = (v) => { inside = v; if (!ctx) return; outLP.frequency.setTargetAtTime(v ? 1500 : 5200, ctx.currentTime, 0.25); pingOut.gain.setTargetAtTime(v ? 0.45 : 0.8, ctx.currentTime, 0.2); if (mus) { mus.lp.frequency.setTargetAtTime(v ? 3600 : 700, ctx.currentTime, 0.3); mus.out.gain.setTargetAtTime(v ? 1 : 0.45, ctx.currentTime, 0.3); } };
  // ---------- Kassettendeck: ruhige, langsam schwebende Musik, live erzeugt; Band leiert leicht, rauscht ----------
  const CH = [[45, [57, 60, 64, 67, 71]], [41, [53, 57, 60, 64, 67]], [48, [55, 60, 64, 67, 71]], [40, [52, 55, 59, 62, 66]], [45, [57, 60, 64, 69, 72]], [41, [57, 60, 64, 65, 69]], [43, [55, 59, 62, 66, 69]], [40, [55, 59, 62, 64, 67]]];
  // Kassetten: jede hat eigene Harmonien, eigenes Tempo und einen eigenen Klang. 0 = Bordkassette, 1 = Galeone (tief, d-Moll, langsam), 2 = Walfall (hoch, schwebend, viel Raum)
  const TR = [
    { ch: CH, L: 8, pad: 950, padV: 0.0065, bass: 0.06, n: 10, gap: 0.75, skip: 0.3, type: 'triangle', oct: 0, rel: 1.6, vol: 0.022, send: 1 },
    { ch: [[38, [50, 53, 57, 60, 64]], [34, [46, 50, 53, 57, 60]], [31, [43, 46, 50, 53, 57]], [33, [45, 49, 52, 55, 57]], [38, [50, 53, 57, 62, 65]], [36, [48, 52, 55, 59, 62]], [34, [50, 53, 58, 62, 65]], [33, [45, 49, 52, 57, 61]]], L: 11, pad: 620, padV: 0.0085, bass: 0.075, n: 5, gap: 1.9, skip: 0.2, type: 'sine', oct: 0, rel: 3.2, vol: 0.032, send: 1 },
    { ch: [[41, [57, 60, 64, 67, 71]], [43, [59, 62, 67, 69, 74]], [36, [55, 60, 64, 67, 74]], [38, [57, 62, 65, 69, 72]], [41, [60, 64, 69, 71, 76]], [36, [59, 60, 64, 67, 72]]], L: 12, pad: 1500, padV: 0.0045, bass: 0.035, n: 6, gap: 1.7, skip: 0.35, type: 'sine', oct: 12, rel: 4.5, vol: 0.02, send: 2.2 },
  ];
  let trk = 0;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function musicSetup() {
    const out = gain(inside ? 1 : 0.45), lp = filt('lowpass', inside ? 3600 : 700, 0.5), ws = ctx.createWaveShaper(), cv = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; cv[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } ws.curve = cv;
    const bus = gain(0), dl = ctx.createDelay(1.5), fb = gain(0.38), dlf = filt('lowpass', 1800, 0.5), send = gain(0.35); dl.delayTime.value = 0.56;
    chain(bus, ws, lp, out); out.connect(BUS.kassette); chain(send, dl, dlf, fb, dl); dlf.connect(bus);
    const wow = ctx.createOscillator(), wg = gain(7); wow.frequency.value = 0.55; wow.connect(wg); wow.start();
    const flut = ctx.createOscillator(), fg = gain(2.5); flut.frequency.value = 6.3; flut.connect(fg); flut.start();
    const hs = noise(1), hb = filt('highpass', 4500, 0.5), hg = gain(0); chain(hs, hb, hg, bus);
    const inp = gain(1); inp.connect(bus);
    mus = { out, lp, bus, in: inp, send, wg, fg, hg, next: 0, step: 0, on: false };
  }
  function note(type, f, t0, att, dur, rel, vol, dest, det = 0) {
    const o = ctx.createOscillator(), g = gain(0); o.type = type; o.frequency.value = f; o.detune.value = det; mus.wg.connect(o.detune); mus.fg.connect(o.detune);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + att); g.gain.setValueAtTime(vol, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + rel);
    chain(o, g, dest); o.start(t0); o.stop(t0 + dur + rel + 0.05);
  }
  function chord(t0) {
    const tr = TR[trk] || TR[0], [root, ns] = tr.ch[mus.step % tr.ch.length], L = tr.L, pad = filt('lowpass', tr.pad, 0.6); pad.connect(mus.in);
    for (const m of ns.slice(0, 4)) for (const d of [-8, 7]) note('sawtooth', hz(m), t0, 2.6, L - 1.2, 3.2, tr.padV, pad, d);
    note('sine', hz(root), t0, 0.8, L - 1, 2.5, tr.bass, mus.in); note('triangle', hz(root + 12), t0, 1.5, L - 1.5, 2.5, 0.012, mus.in);
    for (let k = 0; k < tr.n; k++) { if (Math.random() < tr.skip) continue; const m = ns[(k * 2 + mus.step) % ns.length] + tr.oct + (k % 4 === 3 ? 12 : 0), t = t0 + 0.4 + k * tr.gap + (Math.random() - 0.5) * 0.04, f = filt('lowpass', 2200, 0.7), sg = gain(tr.send); f.connect(mus.in); f.connect(sg); sg.connect(mus.send); note(tr.type, hz(m), t, tr.type === 'sine' ? 0.03 : 0.008, 0.05, tr.rel, tr.vol, f); }
    mus.step++; return L;
  }
  /** welche Kassette im Deck liegt; beim Wechsel beginnt das Stück von vorn */
  A.tapeTrack = (i) => { i = TR[i] ? i : 0; if (i === trk) return; trk = i; if (mus && ctx) { const t = ctx.currentTime, o = mus.in; o.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => { try { o.disconnect(); } catch (e) { /* egal */ } }, 1500); mus.in = gain(1); mus.in.connect(mus.bus); mus.step = 0; mus.next = t + 0.6; } };
  A.tape = (on) => {
    if (!ctx) return; if (!mus) musicSetup(); const t = ctx.currentTime; mus.on = on;
    mus.bus.gain.cancelScheduledValues(t); mus.bus.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.4 : 0.15); mus.hg.gain.setTargetAtTime(on ? 0.004 : 0, t, 0.2);
    if (on) { mus.next = t + 0.3; mus.wg.gain.setValueAtTime(40, t); mus.wg.gain.linearRampToValueAtTime(7, t + 0.7); }        // Band läuft an: kurzes Leiern
    click(0.4);
  };
  function click(v = 0.3) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const g = gain(0), t = ctx.currentTime, f = filt('bandpass', 2600, 1.5); g.gain.setValueAtTime(v * 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); chain(s, f, g, BUS.kabine); s.start(t, Math.random(), 0.06); }
  A.click = (v) => { if (ctx) click(v); };
  A.pour = () => { if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const g = gain(0), t = ctx.currentTime, f = filt('bandpass', 900, 1.2); f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1500, t + 2.2); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.2); g.gain.setValueAtTime(0.05, t + 2.0); g.gain.linearRampToValueAtTime(0, t + 2.4); chain(s, f, g, BUS.kabine); s.start(t, Math.random(), 2.6); };
  /** Kessel: 0 = kalt, steigt beim Erhitzen; ab 0.85 brodelt und pfeift er leise */
  A.kettle = (b) => {
    if (!ctx) return; const t = ctx.currentTime;
    if (!whistle) { const o = ctx.createOscillator(), v = ctx.createOscillator(), vg = gain(18), g = gain(0), bf = filt('bandpass', 400, 0.8), bg = gain(0); o.frequency.value = 1750; v.frequency.value = 5.5; chain(v, vg, o.frequency); chain(o, g, BUS.kabine); chain(noise(0.6), bf, bg, BUS.kabine); o.start(); v.start(); whistle = { g, bg, o }; }
    whistle.g.gain.setTargetAtTime(b > 0.85 ? 0.006 + (b - 0.85) * 0.06 : 0, t, 0.4); whistle.o.frequency.setTargetAtTime(1500 + b * 300, t, 0.5); whistle.bg.gain.setTargetAtTime(b > 0.3 ? (b - 0.3) * 0.05 : 0, t, 0.5);
  };
  // ---------- Walgesänge: ferne Rufe aus der Weite, live erzeugt; Gleittöne, Vibrato, Knurren, langer Hall ----------
  // cfg.gap: mittlerer Abstand in Sekunden, cfg.vol: Lautstärke (1 = normal, bis 2), cfg.on
  A.whaleCfg = { gap: 13, vol: 1, on: true };
  let whaleT = 12, wBus = null;
  function whaleSetup() {
    const il = Math.floor(ctx.sampleRate * 6.5), ir = ctx.createBuffer(2, il, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < il; i++) { lp = lp * 0.8 + (Math.random() * 2 - 1) * 0.2; d[i] = lp * Math.pow(1 - i / il, 1.8) * (i < 2400 ? i / 2400 : 1); } }
    const cv = ctx.createConvolver(); cv.buffer = ir; const wet = gain(1.6), dry = gain(0.32), lp = filt('lowpass', 1900, 0.5), out = gain(1);
    chain(out, lp); lp.connect(dry); lp.connect(cv); chain(cv, wet, master); dry.connect(master); wBus = out;
  }
  // ein Laut: Grundton mit Obertönen, Tonhöhe folgt einer Kurve aus [Zeit, Hz]-Punkten
  function wUnit(t0, curve, vol, dest, opt = {}) {
    const dur = curve[curve.length - 1][0], o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), g = gain(0), g2 = gain(opt.h2 === undefined ? 0.32 : opt.h2), g3 = gain(opt.h3 === undefined ? 0.1 : opt.h3);
    o.type = 'sine'; o2.type = 'sine'; o3.type = 'triangle';
    o.frequency.setValueAtTime(curve[0][1], t0); o2.frequency.setValueAtTime(curve[0][1] * 2.01, t0); o3.frequency.setValueAtTime(curve[0][1] * 3, t0);
    for (const [t, f] of curve.slice(1)) { o.frequency.linearRampToValueAtTime(f, t0 + t); o2.frequency.linearRampToValueAtTime(f * 2.01, t0 + t); o3.frequency.linearRampToValueAtTime(f * 3, t0 + t); }
    const vib = ctx.createOscillator(), vg = gain(opt.vib || 0); vib.frequency.value = opt.vibRate || 4.5; chain(vib, vg); vg.connect(o.detune); vg.connect(o2.detune); vg.connect(o3.detune);
    const bp = filt('bandpass', opt.formant || 700, 0.6), mix = gain(1); o.connect(mix); chain(o2, g2, mix); chain(o3, g3, bp, mix);
    let src = mix;
    if (opt.growl) { const am = ctx.createOscillator(), ag = gain(0.5), amg = gain(0.5); am.frequency.value = opt.growl; chain(am, ag, amg.gain); mix.connect(amg); src = amg; am.start(t0); am.stop(t0 + dur + 0.2); }
    const att = Math.min(opt.att || 0.35, dur * 0.4), rel = Math.min(opt.rel || 0.6, dur * 0.5);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + att); g.gain.setValueAtTime(vol, t0 + dur - rel); g.gain.linearRampToValueAtTime(0, t0 + dur);
    chain(src, g, dest); for (const n of [o, o2, o3, vib]) { n.start(t0); n.stop(t0 + dur + 0.1); }
    return dur;
  }
  // Bausteine eines Gesangs; k verschiebt die Tonlage (jeder Wal klingt etwas anders)
  const W = {
    moan: (t, k, v, d) => wUnit(t, [[0, 150 * k], [0.9, 205 * k], [2.2, 215 * k], [3.4, 120 * k]], v, d, { vib: 18, vibRate: 3.8, att: 0.6, rel: 1.0, formant: 480 }),
    whoop: (t, k, v, d) => wUnit(t, [[0, 95 * k], [0.55, 380 * k], [0.9, 360 * k]], v * 0.9, d, { att: 0.15, rel: 0.3, vib: 8, formant: 900 }),
    cry: (t, k, v, d) => wUnit(t, [[0, 560 * k], [0.5, 760 * k], [1.6, 820 * k], [2.4, 520 * k]], v * 0.55, d, { vib: 30, vibRate: 5.5, att: 0.3, rel: 0.7, h2: 0.18, h3: 0.05, formant: 1400 }),
    groan: (t, k, v, d) => wUnit(t, [[0, 70 * k], [1.2, 82 * k], [2.4, 58 * k]], v * 1.1, d, { growl: 22 + Math.random() * 12, att: 0.3, rel: 0.6, h2: 0.6, h3: 0.35, formant: 320 }),
    chirps: (t, k, v, d) => { let x = 0; const n = 3 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) { wUnit(t + x, [[0, 280 * k], [0.16, 640 * k], [0.2, 600 * k]], v * 0.5, d, { att: 0.03, rel: 0.08, h2: 0.2, formant: 1100 }); x += rnd(0.22, 0.34); } return x; },
    fall: (t, k, v, d) => wUnit(t, [[0, 420 * k], [0.5, 440 * k], [3.0, 115 * k]], v * 0.8, d, { vib: 12, vibRate: 3.2, att: 0.4, rel: 0.9, formant: 650 }),
  };
  const WK = Object.keys(W);
  /** ein Gesang: ein kurzes Motiv aus 2 bis 4 Lauten, oft einmal wiederholt; leise und dumpf, wenn der Wal weiter weg ist */
  A.whale = (force) => {
    if (!ctx || !master) return; if (!wBus) whaleSetup();
    const t = ctx.currentTime + 0.1, far = force ? rnd(0.75, 1) : rnd(0.3, 1), k = rnd(0.82, 1.2), pan = rnd(-0.75, 0.75), vol = 0.175 * far * A.whaleCfg.vol;
    const lp = filt('lowpass', 500 + far * 1300, 0.6), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1); if (pn.pan) pn.pan.value = pan; chain(lp, pn, wBus);
    const motif = []; const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) motif.push(WK[Math.floor(Math.random() * WK.length)]);
    let x = 0; const reps = Math.random() < 0.55 ? 2 : 1;
    for (let r = 0; r < reps; r++) for (const u of motif) { x += W[u](t + x, k * (r ? rnd(0.97, 1.03) : 1), vol, lp) + rnd(0.5, 1.8); }
  };
  A.update = (dt, thrust, speed) => {
    if (!ctx || !eng) return; const t = ctx.currentTime;
    if (mus && mus.on && t > mus.next - 0.4) { const t0 = Math.max(mus.next, t + 0.05); mus.next = t0 + chord(t0); }
    if (glow) glow.gain.setTargetAtTime(inside ? 0.012 : 0, t, 0.6);
    eng.o1.frequency.setTargetAtTime(44 + thrust * 15, t, 0.6); eng.o2.frequency.setTargetAtTime(66.4 + thrust * 22.6, t, 0.6);
    eng.eg.gain.setTargetAtTime((0.045 + thrust * 0.1) * (inside ? 1.7 : 1), t, 0.5); eng.elp.frequency.setTargetAtTime(140 + thrust * 90, t, 0.5);
    eng.rg.gain.setTargetAtTime(speed * speed * 0.06, t, 0.4); eng.rf.frequency.setTargetAtTime(200 + speed * 260, t, 0.4);
    bubT -= dt * (0.5 + thrust * 2.5);
    if (bubT <= 0) { bubT = rnd(0.25, 1.3); const f = rnd(320, 760), n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) tone('sine', f * (1 + i * 0.12), f * 2.1 * (1 + i * 0.12), 0.006, rnd(0.05, 0.09), rnd(0.006, 0.02), 0.25, i * rnd(0.05, 0.09), BUS.blasen); }
    groanT -= dt;
    if (A.whaleCfg.on) { whaleT -= dt; if (whaleT <= 0) { whaleT = A.whaleCfg.gap * rnd(0.5, 1.5); A.whale(); } }
    if (groanT <= 0) {
      groanT = rnd(20, 50);
      if (Math.random() < 0.6) { const f = rnd(48, 80); tone('sine', f, f * 0.72, 1.6, 4.5, 0.075, 0.7, 0, BUS.grollen); tone('triangle', f * 1.5, f * 1.02, 2.0, 3.5, 0.02, 0.7, 0.3, BUS.grollen); }
      else { const f = rnd(170, 260); tone('sine', f, f * 1.35, 1.2, 1.8, 0.016, 1.0, 0, BUS.grollen); tone('sine', f * 1.35, f * 0.8, 0.8, 2.6, 0.013, 1.0, 2.6, BUS.grollen); }
    }
  };
  return A;
}
