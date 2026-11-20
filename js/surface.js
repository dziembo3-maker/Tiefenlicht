// surface.js – die Wasseroberfläche von unten, überall im Spiel (aus der Testszene übernommen).
// Ein feines Gitter wandert mit der Kamera (im Shader auf ganze Meter eingerastet, damit die Wellen nicht mitrutschen) und trägt echte Wellen
// aus neun Richtungen und Größen, dazu feines Gekräusel. Im Snellius-Fenster (steiler als 48,6° zur Senkrechten) sieht man durch die
// gebrochene Fläche den hellen Himmel und die Sonne; außerhalb spiegelt sie das Wasser (Totalreflexion). Weil jede kleine Welle anders
// geneigt ist, zerfällt beides in ein Netz aus hellen Flecken und dunklen Rinnen. Der Nebel des Spiels liegt darüber: in der Tiefe
// verschwindet die Oberfläche von allein. Am Observatorium laufen Wellenringe um das Teleskoprohr.
import { T } from './util.js';
import { uni, COMMON } from './gfx.js';

const WAVES = /* glsl */ `
vec3 wave(vec2 p, out vec2 grad){
  vec2 D[9]; D[0]=vec2(1.0,0.25); D[1]=vec2(-0.35,1.0); D[2]=vec2(0.7,-0.75); D[3]=vec2(-1.0,-0.3); D[4]=vec2(0.2,1.0); D[5]=vec2(0.9,0.5); D[6]=vec2(-0.6,0.8); D[7]=vec2(0.4,-1.0); D[8]=vec2(-0.85,-0.6);
  float L[9]; L[0]=9.0; L[1]=6.5; L[2]=4.3; L[3]=3.1; L[4]=2.2; L[5]=1.6; L[6]=1.15; L[7]=0.8; L[8]=0.55;
  float h = 0.0; grad = vec2(0.0);
  for (int i = 0; i < 9; i++) { vec2 d = normalize(D[i]); float k = 6.2832 / L[i], a = 0.028 * L[i], w = sqrt(9.81 * k);
    float ph = dot(p, d) * k + uTime * w * 0.8 + float(i) * 1.7; h += a * sin(ph); grad += d * a * k * cos(ph); }
  vec2 dh = p - uHit; float dd = length(dh) + 1e-3, ring = exp(-dd * 0.16) * smoothstep(0.6, 1.2, dd);
  float ph = dd * 3.0 - uTime * 3.2; h += 0.06 * ring * sin(ph); grad += dh / dd * 0.18 * ring * cos(ph);
  return vec3(h, 0.0, dd);
}`;

export function createSurface(scene, hit) {
  const mat = new T.ShaderMaterial({ uniforms: uni({ uHit: { value: hit || new T.Vector2(1e5, 1e5) } }), transparent: true, side: T.DoubleSide, depthWrite: false,
    vertexShader: /* glsl */ `uniform float uTime; uniform vec2 uHit; varying vec3 vW; ${WAVES}
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); w.xz += floor(cameraPosition.xz); vec2 g; vec3 r = wave(w.xz, g); w.y += r.x; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `precision highp float; ${COMMON} uniform vec2 uHit; varying vec3 vW; ${WAVES}
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 g; vec3 r = wave(vW.xz, g);
        vec2 q = vW.xz * 1.6; float e = 0.05;
        float n0 = vn(q + uTime * vec2(0.35, 0.2)) + vn(q * 1.9 - uTime * vec2(0.25, -0.3)) * 0.6;
        float nx = vn(q + vec2(e, 0.0) + uTime * vec2(0.35, 0.2)) + vn((q + vec2(e, 0.0)) * 1.9 - uTime * vec2(0.25, -0.3)) * 0.6;
        float nz = vn(q + vec2(0.0, e) + uTime * vec2(0.35, 0.2)) + vn((q + vec2(0.0, e)) * 1.9 - uTime * vec2(0.25, -0.3)) * 0.6;
        g += vec2(nx - n0, nz - n0) / e * 0.05;
        float dist = length(vW - cameraPosition);
        g *= mix(0.35, 1.0, exp(-dist * 0.02));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y)), V = (vW - cameraPosition) / dist;
        float foam = smoothstep(1.3, 0.55, r.z) * (0.6 + 0.4 * sin(uTime * 4.0 + atan(vW.z - uHit.y, vW.x - uHit.x) * 7.0));
        vec3 Nd = -N, Rf = refract(V, Nd, 1.333), Rr = reflect(V, Nd);
        float up = clamp(-Rr.y, 0.0, 1.0);
        vec3 refl = mix(vec3(0.10, 0.42, 0.58), vec3(0.02, 0.17, 0.30), pow(up, 0.6));
        vec3 c = refl;
        if (dot(Rf, Rf) > 0.0) {
          float t = clamp(Rf.y, 0.0, 1.0);
          vec3 sky = mix(vec3(0.55, 0.84, 0.94), vec3(0.88, 0.97, 1.0), pow(t, 0.5));
          sky += vec3(1.0, 0.95, 0.8) * (pow(max(dot(Rf, uSunDir), 0.0), 220.0) * 7.0 + pow(max(dot(Rf, uSunDir), 0.0), 10.0) * 0.6);
          float cosI = dot(-V, N), tr = smoothstep(0.0, 0.25, 1.0 - (1.0 - cosI * cosI) * 1.777);
          c = mix(refl * 1.3, sky, tr);
        }
        float crest = smoothstep(0.02, 0.22, dot(g, normalize(vW.xz - cameraPosition.xz + 1e-3)));
        c *= 0.88 + 0.3 * crest;
        c += vec3(0.6, 0.85, 0.9) * foam * 0.45;
        gl_FragColor = vec4(fog(c, vW), 1.0); }` });
  const g = new T.PlaneGeometry(260, 260, 200, 200); g.rotateX(-Math.PI / 2);
  const m = new T.Mesh(g, mat); m.renderOrder = -5; m.frustumCulled = false; scene.add(m);
  const far = new T.RingGeometry(126, 900, 64, 1); far.rotateX(-Math.PI / 2); const m2 = new T.Mesh(far, mat); m2.renderOrder = -5; m2.frustumCulled = false; scene.add(m2);
  return { mesh: m, mat, setHit(v) { mat.uniforms.uHit.value.copy(v); } };
}
