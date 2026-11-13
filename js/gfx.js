// gfx.js – gemeinsames Licht- und Wassermodell für alles unter Wasser, Wasserhintergrund, Nachbearbeitung
import { T } from './util.js';

export const SUN = new T.Vector3(0.22, 0.74, 0.56).normalize();      // Richtung, aus der das Licht von oben einfällt
export const U = {
  uTime: { value: 0 }, uNoise: { value: null }, uSunDir: { value: SUN }, uDeep: { value: 1 }, uFogK: { value: 0.021 },
  uSubPos: { value: new T.Vector3() }, uWarmPos: { value: new T.Vector3() }, uLampPos: { value: new T.Vector3() }, uLampDir: { value: new T.Vector3(0, 0, 1) }, uLampOn: { value: 1 },
  uGlow: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] }, uGlowCol: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()] },
  uPing: { value: new T.Vector4(0, 0, 0, -1) }, uPingFade: { value: 0 },
};
export const uni = (extra) => Object.assign({}, U, extra || {});

export const COMMON = /* glsl */ `
uniform float uTime, uDeep, uFogK, uLampOn, uPingFade; uniform sampler2D uNoise; uniform vec3 uSunDir, uSubPos, uWarmPos, uLampPos, uLampDir; uniform vec4 uGlow[4]; uniform vec3 uGlowCol[4]; uniform vec4 uPing;
// Farbe des Wassers in Blickrichtung: unten fast schwarz, waagrecht tiefes Blau, oben helles Türkis
vec3 waterCol(vec3 d) {
  vec3 c = mix(vec3(0.001, 0.016, 0.050), vec3(0.012, 0.205, 0.375), smoothstep(-0.75, 0.08, d.y));
  c = mix(c, vec3(0.040, 0.39, 0.60), smoothstep(0.0, 0.8, d.y));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(0.030, 0.30, 0.40) * s * s * 0.95 + vec3(0.14, 0.34, 0.34) * pow(s, 12.0) * 0.5;
  return c * uDeep;
}
float caustic(vec2 p) {
  float a = texture2D(uNoise, p * 0.031 + vec2(uTime * 0.011, uTime * 0.006)).r, b = texture2D(uNoise, p * 0.047 - vec2(uTime * 0.009, -uTime * 0.012)).g;
  return smoothstep(0.5, 1.0, 1.0 - abs(a + b - 1.0) * 3.4);
}
vec3 lights(vec3 wp, vec3 N) {
  vec3 dl = wp - uLampPos; float dist = length(dl); vec3 dn = dl / max(dist, 0.001);
  float cone = smoothstep(0.84, 0.97, dot(dn, uLampDir));
  vec3 l = vec3(0.50, 0.80, 0.92) * cone * (0.25 + 0.75 * max(dot(N, -dn), 0.0)) * uLampOn * 6.0 / (3.0 + dist * dist * 0.04);
  vec3 wv = uWarmPos - wp; float wr = length(wv); l += vec3(1.0, 0.50, 0.20) * (0.35 + 0.65 * max(dot(N, wv / max(wr, 0.001)), 0.0)) * min(1.1, 1.7 / (1.0 + wr * wr * 0.16));
  for (int i = 0; i < 4; i++) { vec3 g = uGlow[i].xyz - wp; float r = length(g); l += uGlowCol[i] * (0.3 + 0.7 * max(dot(N, g / max(r, 0.001)), 0.0)) * uGlow[i].w / (1.0 + r * r * 0.06); }
  return l;
}
// gemalte Flächen: Licht kommt von oben, nimmt mit der Tiefe ab, in wenigen weichen Stufen
vec3 shade(vec3 base, vec3 N, vec3 wp) {
  float lk = exp(wp.y * 0.0125), top = max(N.y, 0.0);
  top = (floor(top * 3.0) + smoothstep(0.3, 0.7, fract(top * 3.0))) / 3.0;
  float side = max(dot(N, uSunDir), 0.0);
  vec3 amb = vec3(0.020, 0.105, 0.225) * (0.45 + 0.55 * N.y) * (0.35 + 0.65 * lk);
  vec3 sun = vec3(0.10, 0.56, 0.95) * (top * 0.85 + side * 0.35) * lk * 1.15 * (0.75 + 1.05 * caustic(wp.xz + wp.y * 0.3) * smoothstep(0.15, 0.6, N.y) * (0.35 + 0.65 * smoothstep(-70.0, -25.0, wp.y)));
  return base * (amb + sun + lights(wp, N));
}
vec3 pingGlow(vec3 wp) {
  if (uPing.w <= 0.0) return vec3(0.0);
  float d = distance(wp, uPing.xyz), band = 1.0 - smoothstep(0.0, 1.5, abs(d - uPing.w)), trail = smoothstep(uPing.w - 36.0, uPing.w, d) * step(d, uPing.w);
  float lines = smoothstep(0.41, 0.5, abs(fract(wp.y * 0.33) - 0.5));
  return vec3(0.14, 1.0, 0.40) * (band * 0.8 + trail * trail * (lines * 0.85 + 0.03)) * uPingFade;
}
vec3 fog(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition; float d = length(v), f = 1.0 - exp(-d * uFogK);
  return mix(col, waterCol(v / d), f) + pingGlow(wp) * (1.0 - f * 0.5);
}`;
export const VERT = `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`;

/** Fels und Meeresgrund */
export function rockMaterial(flat) {
  return new T.ShaderMaterial({ uniforms: uni(), vertexShader: VERT, defines: { FLATK: flat ? '0.72' : '0.45' }, extensions: { derivatives: true }, fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN;
    void main(){
      vec3 N = normalize(vN);
      N = normalize(mix(N, normalize(cross(dFdx(vW), dFdy(vW))), FLATK));
      float n = texture2D(uNoise, vW.xz * 0.019 + vW.y * 0.011).r, st = texture2D(uNoise, vec2(vW.y * 0.04 + n * 0.35, 0.3 + vW.x * 0.002)).g;
      float fl = smoothstep(0.8, 0.96, N.y);
      vec3 base = mix(vec3(0.20, 0.30, 0.46), vec3(0.44, 0.58, 0.74), st * 0.65 + n * 0.35);
      // Grund: Sandflächen, dazwischen dunklere Geröllfelder mit Steinchen und Bewuchsflecken
      float pt = texture2D(uNoise, vW.xz * 0.045 + 3.7).g, gravel = smoothstep(0.45, 0.62, pt + n * 0.25 - 0.1);
      float sp = texture2D(uNoise, vW.xz * 0.9).b, sp2 = texture2D(uNoise, vW.xz * 0.37 + 1.3).b;
      vec3 sand = vec3(0.50, 0.66, 0.80) * (0.9 + 0.2 * n), grav = vec3(0.24, 0.34, 0.47) * (0.85 + 0.3 * sp2);
      vec3 flo = mix(sand, grav, gravel * 0.85);
      flo *= 1.0 - 0.32 * smoothstep(0.72, 0.9, sp) * (0.35 + 0.65 * gravel) - 0.18 * smoothstep(0.8, 0.95, sp2);
      flo = mix(flo, vec3(0.13, 0.26, 0.30), smoothstep(0.6, 0.75, texture2D(uNoise, vW.xz * 0.021 - 5.1).r) * 0.45 * (1.0 - gravel));
      base = mix(base, flo, fl * 0.85);
      N = normalize(N + vec3(sin(vW.x * 1.1 + n * 9.0 + vW.z * 0.3), 0.0, 0.0) * 0.16 * fl * (1.0 - gravel));          // Sandrippel
      gl_FragColor = vec4(fog(shade(base, N, vW), vW), 1.0);
    }` });
}

/** bemalte Modelle (Boot, Wrack): Farbe je Eckpunkt, aShade = Eigenleuchten, aWind = Glas */
export function paintMaterial(side) {
  return new T.ShaderMaterial({ uniforms: uni(), vertexColors: true, side: side || T.FrontSide,
    vertexShader: `attribute float aWind, aShade; varying vec3 vW, vN, vC; varying float vE, vG;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = mat3(modelMatrix) * normal; vC = color; vE = aShade; vG = aWind; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vW, vN, vC; varying float vE, vG;
      void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) N = -N; float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 base = vC; float glass = max(vG, 0.0);
        if (vG < -0.5) {   // Holz: Maserung, dunkle Flecken, oben Bewuchs
          float gr = texture2D(uNoise, vec2((vW.x + vW.z) * 0.09, vW.y * 1.1 + vW.x * 0.35)).g, bl = texture2D(uNoise, vW.xz * 0.06 + vW.y * 0.05).r, sp = texture2D(uNoise, vW.xz * 0.7 + vW.y * 0.6).b;
          base *= (0.62 + 0.6 * gr) * (1.0 - 0.25 * smoothstep(0.75, 0.95, sp));
          base = mix(base, vec3(0.09, 0.27, 0.25) * (0.7 + 0.6 * gr), smoothstep(0.42, 0.68, bl) * (0.22 + 0.5 * max(N.y, 0.0)));
        }
        vec3 lit = shade(base, N, vW) * 1.3 + base * (0.05 + 0.05 * max(N.y, 0.0)) + waterCol(reflect(-V, N)) * fr * 0.3 * (1.0 + min(vG, 0.0) * 0.7);
        vec3 c = mix(lit, vC * vE, min(vE, 1.0)) + waterCol(reflect(-V, N)) * fr * glass * 0.7;
        gl_FragColor = vec4(fog(c, vW), 1.0); }` });
}

/** Teilchen als kleine, zur Kamera gedrehte Flächen statt Punkt-Sprites (die manche Grafikchips mit Kantenglättung als Raster zeichnen).
 *  Nimmt eine Punkt-Geometrie und ein Punkt-Material; im Shader wird gl_PointSize zur Flächengröße, gl_PointCoord zu vPC. */
export function quadPoints(src, mat) {
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('aCorner', new T.BufferAttribute(new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]), 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
  let n = 0;
  for (const k in src.attributes) {
    const a = src.attributes[k];
    if (a.isInterleavedBufferAttribute) { const ib = a.data; if (!ib.__inst) ib.__inst = new T.InstancedInterleavedBuffer(ib.array, ib.stride, 1); g.setAttribute(k, new T.InterleavedBufferAttribute(ib.__inst, a.itemSize, a.offset)); n = ib.count; }
    else { const ia = new T.InstancedBufferAttribute(a.array, a.itemSize); g.setAttribute(k, ia); a.__inst = ia; n = a.count; }
  }
  g.instanceCount = n; if (src.boundingSphere) g.boundingSphere = src.boundingSphere;
  if (!mat.__quad) { mat.__quad = true;
  let vs = mat.vertexShader; vs = 'attribute vec2 aCorner; varying vec2 vPC;\n' + vs;
  vs = vs.replace('gl_PointSize =', 'float pSize =').replace(/gl_Position = projectionMatrix \* mv;/, 'mv.xy += aCorner * pSize * max(-mv.z, 0.01) / uPx; vPC = aCorner + 0.5; gl_Position = projectionMatrix * mv;');
  mat.vertexShader = vs; mat.fragmentShader = 'varying vec2 vPC;\n' + mat.fragmentShader.replace(/gl_PointCoord/g, 'vPC').replace('precision highp float;', '');
  mat.fragmentShader = 'precision highp float;\n' + mat.fragmentShader; }
  const m = new T.Mesh(g, mat); m.frustumCulled = !!src.boundingSphere;
  m.userData.src = src; return m;
}

/** Wasser als Hintergrund: Kugel um die Kamera, oben schimmert die Oberfläche */
export function createBackdrop(scene) {
  const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.ShaderMaterial({ uniforms: uni(), side: T.BackSide, depthTest: false, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} varying vec3 vD;
      void main(){ vec3 d = normalize(vD); vec3 c = waterCol(d);
        vec2 q = d.xz / max(d.y, 0.05); float r = texture2D(uNoise, q * 0.06 + uTime * 0.01).r * texture2D(uNoise, q * 0.11 - uTime * 0.013).g;
        c += vec3(0.30, 0.62, 0.68) * smoothstep(0.2, 0.55, r) * smoothstep(0.25, 0.9, d.y) * 0.6 * uDeep;
        gl_FragColor = vec4(c, 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = -10; scene.add(m); return m;
}

/** Nachbearbeitung: Leuchten um helle Dinge, leichte Farbkorrektur, dunkle Ränder, feines Korn */
export function createPost(renderer) {
  const gl = renderer.getContext(), gl2 = renderer.capabilities.isWebGL2, hf = gl2 && !!renderer.extensions.get('EXT_color_buffer_float');
  let main = null, a = null, b = null, c = null, w = 0, h = 0, ms = -1;
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new T.Mesh(new T.PlaneGeometry(2, 2), null), sc = new T.Scene(); sc.add(quad); quad.frustumCulled = false;
  const mk = (fs, u) => new T.ShaderMaterial({ uniforms: u, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`, fragmentShader: 'precision highp float; varying vec2 vUv;\n' + fs, depthTest: false, depthWrite: false });
  const UM = { value: 0 };   // Menü: 0 = klares Bild, 1 = ganz weichgezeichnet
  const mBright = mk(`uniform sampler2D t; uniform float m; void main(){ vec3 c = texture2D(t, vUv).rgb; if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = vec3(0.0); c = clamp(c, 0.0, 64.0); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(mix(min(c * max(l - 0.62, 0.0) / max(l, 0.001), vec3(5.0)), min(c, vec3(4.0)), m), 1.0); }`, { t: { value: null }, m: UM });
  const mBlur = mk(`uniform sampler2D t; uniform vec2 d; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + d * 1.385).rgb + texture2D(t, vUv - d * 1.385).rgb) * 0.316; c += (texture2D(t, vUv + d * 3.231).rgb + texture2D(t, vUv - d * 3.231).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }`, { t: { value: null }, d: { value: new T.Vector2() } });
  const UO = { t: { value: null }, b1: { value: null }, b2: { value: null }, time: U.uTime, m: UM };
  const mOut = mk(`uniform sampler2D t, b1, b2; uniform float time, m;
    void main(){ vec3 c0 = texture2D(t, vUv).rgb; if (!(c0.r == c0.r && c0.g == c0.g && c0.b == c0.b)) c0 = vec3(0.0); vec3 c = clamp(c0, 0.0, 64.0) + (texture2D(b1, vUv).rgb * 0.75 + texture2D(b2, vUv).rgb * 0.9) * (1.0 - m); c = mix(c, texture2D(b2, vUv).rgb * 0.82, m);
      vec3 hi = max(c - 0.8, 0.0); c = min(c, 0.8) + hi / (1.0 + hi * 2.2);
      c = pow(max(c, 0.0), vec3(0.94)); c = (c - 0.5) * 1.06 + 0.5; vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.75;
      c += (fract(sin(dot(vUv * 913.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.014;
      gl_FragColor = vec4(c, 1.0); }`, UO);
  const depthOnly = new T.MeshBasicMaterial({ colorWrite: false, side: T.DoubleSide });
  let stOn = null;
  function stencilWorld(scene, on) {   // alle Materialien der Welt: zeichnen nur, wo die Kabine nichts markiert hat
    if (!on && stOn === false) return; stOn = on;
    scene.traverse((o) => { const m = o.material; if (!m || m.__st === on) return; m.__st = on; m.stencilWrite = on; m.stencilFunc = T.NotEqualStencilFunc; m.stencilRef = 1; m.stencilZPass = T.KeepStencilOp; m.stencilFail = T.KeepStencilOp; m.stencilZFail = T.KeepStencilOp; });
  }
  const P = {
    set blur(v) { UM.value = v; }, get blur() { return UM.value; },
    resize(pw, ph, msaa) {
      if (pw === w && ph === h && msaa === ms && main) return; w = pw; h = ph; ms = msaa;
      for (const r of [main, a, b, c]) if (r) r.dispose();
      const o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true, stencilBuffer: false };
      const mkMain = (ty, sm) => { const oo = Object.assign({}, o, { type: ty, stencilBuffer: true }); let r; if (gl2 && sm > 0) { r = new T.WebGLMultisampleRenderTarget(w, h, oo); r.samples = sm; } else r = new T.WebGLRenderTarget(w, h, oo);
        renderer.setRenderTarget(r); const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; renderer.setRenderTarget(null); if (!ok) { r.dispose(); return null; } return r; };
      main = (hf && mkMain(T.HalfFloatType, msaa)) || mkMain(T.UnsignedByteType, msaa) || mkMain(T.UnsignedByteType, 0);
      P.stencil = false; try { renderer.setRenderTarget(main); const bits = gl2 ? gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE) : gl.getParameter(gl.STENCIL_BITS); P.stencil = bits >= 1; renderer.setRenderTarget(null); } catch (e) { renderer.setRenderTarget(null); }
      const ty = main.texture.type, o2 = Object.assign({}, o, { depthBuffer: false, type: ty });
      a = new T.WebGLRenderTarget(Math.max(2, w >> 2), Math.max(2, h >> 2), o2); b = new T.WebGLRenderTarget(a.width, a.height, o2); c = new T.WebGLRenderTarget(Math.max(2, w >> 3), Math.max(2, h >> 3), o2);
    },
    render(scene, camera, scene2, camera2) {
      renderer.setRenderTarget(main);
      if (scene2 && P.stencil) {
        // drinnen: erst die Kabine (markiert ihre Pixel), dann die Welt nur dort, wo nichts von der Kabine ist (Fenster),
        // dann die Tiefe der Kabine nachtragen und ihre durchsichtigen Teile (Glas, Dampf, Staub) obenauf
        renderer.autoClear = false; renderer.clear(true, true, true);
        camera2.layers.set(0); renderer.render(scene2, camera2);
        stencilWorld(scene, true); renderer.clearDepth(); renderer.render(scene, camera);
        renderer.clearDepth(); scene2.overrideMaterial = depthOnly; renderer.render(scene2, camera2); scene2.overrideMaterial = null;
        camera2.layers.set(1); renderer.render(scene2, camera2); camera2.layers.set(0); renderer.autoClear = true;
      } else {
        stencilWorld(scene, false); renderer.render(scene, camera);
        if (scene2) { renderer.autoClear = false; renderer.clearDepth(); camera2.layers.enableAll(); renderer.render(scene2, camera2); renderer.autoClear = true; }   // Kabine über die Welt, mit eigener Tiefe
      }
      const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); };
      mBright.uniforms.t.value = main.texture; pass(mBright, a);
      const blur = (src, dst, dx, dy) => { mBlur.uniforms.t.value = src.texture; mBlur.uniforms.d.value.set(dx, dy); pass(mBlur, dst); };
      blur(a, b, 1.5 / a.width, 0); blur(b, a, 0, 1.5 / a.height);                 // enges Leuchten
      blur(a, c, 2.0 / c.width, 0); blur(c, b, 0, 4.0 / a.height); blur(b, c, 3.0 / c.width, 0);   // weiter Schein
      if (UM.value > 0.005) { blur(c, b, 0, 7.0 / a.height); blur(b, c, 5.0 / c.width, 0); blur(c, b, 0, 4.0 / a.height); blur(b, c, 3.0 / c.width, 0); }   // Menü: ganzes Bild weich
      UO.t.value = main.texture; UO.b1.value = a.texture; UO.b2.value = c.texture; pass(mOut, null);
    },
  };
  return P;
}
