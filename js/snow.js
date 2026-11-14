// snow.js – Meeresschnee über der tiefen Ebene: große, langsam sinkende Flocken, dicht (Teil der Karte, nicht einstellbar); im Scheinwerfer leuchten sie auf
import { T, rng } from './util.js';
import { uni, quadPoints } from './gfx.js';

export function createSnow(scene) {
  const R = rng(4242), SNOW = { value: 0 }, PX = { value: 600 }, N = 13600, p = new Float32Array(N * 3), s = new Float32Array(N);
  for (let i = 0; i < N; i++) { p[i * 3] = R() * 40; p[i * 3 + 1] = R() * 40; p[i * 3 + 2] = R() * 40; s[i] = R(); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('aS', new T.BufferAttribute(s, 1));
  const m = quadPoints(g, new T.ShaderMaterial({ uniforms: uni({ uPx: PX, uSnow: SNOW }), transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute float aS; uniform float uTime, uPx, uSnow, uLampOn; uniform vec3 uLampPos, uLampDir; varying float vA;
      void main(){ float f = fract(aS * 13.7);
        vec3 p = position + vec3(sin(uTime * 0.23 + aS * 40.0) * 0.7 + uTime * 0.06, -uTime * (0.16 + 0.22 * f), cos(uTime * 0.19 + aS * 31.0) * 0.7 + uTime * 0.03);
        p = mod(p - cameraPosition, 40.0) - 20.0 + cameraPosition; vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
        vec3 lv = p - uLampPos; float ld = length(lv), cone = smoothstep(0.80, 0.97, dot(lv / max(ld, 0.001), uLampDir)) * uLampOn * 9.0 / (4.0 + ld * ld * 0.05);
        vA = uSnow * (1.0 - smoothstep(14.0, 20.0, d)) * smoothstep(0.5, 2.5, d) * (0.3 + 0.18 * f + cone);
        gl_PointSize = max(1.4, (0.055 + 0.085 * f) * uPx / max(d, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q), a = 1.0 - smoothstep(0.15, 0.5, r); gl_FragColor = vec4(vec3(0.78, 0.9, 0.96) * a * vA, 1.0); }` }));
  m.frustumCulled = false; m.renderOrder = 6; m.visible = false; scene.add(m);
  return { set(v, px) { SNOW.value = v; PX.value = px; m.visible = v > 0.01; } };
}
