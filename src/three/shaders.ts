/* GLSL for the background. Colours are authored in sRGB and written as-is. */

export const particleVertex = /* glsl */ `
uniform float uTime;
uniform vec4 uW;          // weights: singularity, atom, sakura, galaxy
uniform float uW4;        // weight: portal
uniform float uSize;
uniform float uPixelRatio;
uniform vec2 uMouse;      // pointer in NDC
uniform float uMouseStrength;
uniform float uAspect;
uniform float uBurst;
uniform float uTurb;
uniform float uIntro;
uniform float uDim;
uniform vec3 uRingAxis0;
uniform vec3 uRingAxis1;
uniform vec3 uRingAxis2;

attribute vec4 aP0;
attribute vec4 aP1;
attribute vec4 aP2;
attribute vec4 aP3;
attribute vec4 aP4;
attribute vec4 aC0;
attribute vec4 aC1;
attribute vec4 aC2;
attribute vec4 aC3;
attribute vec4 aC4;
attribute vec4 aData;     // x random, y size, z phase, w easing

varying vec3 vColor;

mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 rotX(vec3 p, float a) { p.yz = rot2(a) * p.yz; return p; }
vec3 rotAxis(vec3 p, vec3 axis, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}
vec3 swirl(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.7 + t) + sin(p.z * 2.3 - t * 0.7),
    sin(p.z * 1.9 + t * 0.8) + sin(p.x * 2.1 + t * 0.6),
    sin(p.x * 1.5 - t * 0.9) + sin(p.y * 2.7 + t * 0.5)
  ) * 0.5;
}

vec3 singularity(vec4 p, float t) {
  vec3 q = p.xyz;
  float k = p.w;
  if (k < 0.5) {               // accretion disk: inner orbits spin faster
    float r = length(q.xz);
    q.xz = rot2(t * 0.6 / pow(max(r, 0.9), 1.5)) * q.xz;
    q = rotX(q, 0.3);
  } else if (k < 1.5) {        // photon ring shimmer
    q.xy = rot2(t * 0.2) * q.xy;
    q *= 1.0 + 0.01 * sin(t * 3.0 + atan(q.y, q.x) * 6.0);
  } else if (k < 2.5) {        // jets pulse outward
    q.y *= 1.0 + 0.05 * sin(t * 2.0 - abs(q.y) * 2.5);
    q = rotX(q, 0.3);
  } else {
    q.xz = rot2(t * 0.03) * q.xz;
  }
  return q;
}

vec3 atom(vec4 p, float t) {
  vec3 q = p.xyz;
  float k = p.w;
  if (k > 0.5 && k < 1.5) q = rotAxis(q, uRingAxis0, t * 0.8);
  else if (k > 1.5 && k < 2.5) q = rotAxis(q, uRingAxis1, t * 1.0);
  else if (k > 2.5 && k < 3.5) q = rotAxis(q, uRingAxis2, t * 1.2);
  else if (k < 0.5) {           // nucleus: slow spin and a nervous jiggle
    q = rotAxis(q, vec3(0.0, 1.0, 0.0), t * 0.35);
    q += 0.012 * sin(vec3(t * 9.0 + q.y * 30.0, t * 7.0 + q.z * 30.0, t * 8.0 + q.x * 30.0));
  } else {
    q = rotAxis(q, normalize(vec3(0.3, 1.0, 0.1)), t * 0.12);
  }
  return q;
}

vec3 sakura(vec4 p, float t) {
  vec3 q = p.xyz;
  float k = floor(p.w);
  float ph = fract(p.w);
  if (k < 1.5) {               // flower + stamens
    q.xy = rot2(t * 0.05) * q.xy;
    q *= 1.0 + 0.015 * sin(t * 1.3);
    q.z += 0.035 * sin(t * 1.6 + length(q.xy) * 3.0);
  } else if (k < 2.5) {        // falling petals (a whole petal shares one phase)
    float speed = 0.22 + ph * 0.2;
    q.y = mod(q.y - t * speed + 4.4, 8.8) - 4.4;
    q.x += sin(t * 0.6 + ph * 6.2831) * 0.4;
    q.z += cos(t * 0.5 + ph * 4.0) * 0.25;
  } else {
    q.xy = rot2(t * 0.02) * q.xy;
  }
  return q;
}

vec3 galaxy(vec4 p, float t) {
  vec3 q = p.xyz;
  q.xz = rot2(t * (p.w < 0.5 ? 0.1 : 0.16)) * q.xz;
  q = rotX(q, 1.02);
  q.xy = rot2(0.32) * q.xy;
  return q;
}

vec3 portal(vec4 p, float t) {
  vec3 q = p.xyz;
  float k = p.w;
  if (k < 0.5) q.xy = rot2(t * 0.28) * q.xy;
  else if (k < 1.5) {
    float r = length(q.xy);
    q.xy = rot2(t * (0.35 + 1.5 * (1.0 - r / 1.9))) * q.xy;
  } else q.xy = rot2(-t * 0.08) * q.xy;
  return rotX(q, -0.22 + 0.06 * sin(t * 0.4));
}

void main() {
  float t = uTime;
  float rnd = aData.x;

  // Per-particle easing makes morphs feel staggered instead of uniform.
  float e = mix(0.6, 1.9, aData.w);
  vec4 w = pow(max(uW, vec4(0.0)), vec4(e));
  float w4 = pow(max(uW4, 0.0), e);

  vec3 pos = vec3(0.0);
  vec4 col = vec4(0.0);
  float sum = 0.0;
  if (w.x > 0.001) { pos += w.x * singularity(aP0, t); col += w.x * aC0; sum += w.x; }
  if (w.y > 0.001) { pos += w.y * atom(aP1, t);        col += w.y * aC1; sum += w.y; }
  if (w.z > 0.001) { pos += w.z * sakura(aP2, t);      col += w.z * aC2; sum += w.z; }
  if (w.w > 0.001) { pos += w.w * galaxy(aP3, t);      col += w.w * aC3; sum += w.w; }
  if (w4 > 0.001)  { pos += w4 * portal(aP4, t);       col += w4 * aC4;  sum += w4; }
  sum = max(sum, 1e-4);
  pos /= sum;
  col /= sum;

  // While shapes blend, particles swirl through a flow field.
  float settled = max(max(uW.x, uW.y), max(max(uW.z, uW.w), uW4));
  float chaos = clamp(1.0 - settled, 0.0, 1.0);
  pos += swirl(pos * 0.7 + rnd * 3.0, t * 0.8) * (chaos * 1.7 + uTurb * 0.3);
  pos += swirl(pos * 1.6 + 10.0, t * 0.35) * 0.018;

  // Click burst and intro "big bang" out of a single point.
  pos += normalize(pos + vec3(1e-4)) * uBurst * (0.35 + rnd * 1.3);
  float intro = smoothstep(rnd * 0.55, rnd * 0.55 + 0.45, uIntro);
  pos *= intro;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Push particles away from the pointer (in screen space).
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float dist = length(d);
  float force = smoothstep(0.38, 0.0, dist) * uMouseStrength;
  mv.xy += (d / max(dist, 1e-3)) * force * 0.5 * (0.6 + rnd * 0.8);

  gl_Position = projectionMatrix * mv;

  float size = uSize * aData.y * col.a;
  gl_PointSize = clamp(size * uPixelRatio * (8.0 / -mv.z), 1.0, 40.0 * uPixelRatio);

  float twinkle = 0.82 + 0.18 * sin(t * 2.1 + aData.z);
  float depthFade = smoothstep(20.0, 5.0, -mv.z);
  vColor = col.rgb * twinkle * uDim * (0.5 + 0.5 * depthFade) * (0.25 + 0.75 * intro);
}
`;

export const particleFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 7.0);
  float halo = exp(-d * d * 2.2) * 0.22;
  gl_FragColor = vec4(vColor * (core + halo), 1.0);
}
`;

export const starsVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uDim;
attribute vec3 aColor;
attribute vec2 aData; // size, phase
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aData.x * uPixelRatio;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aData.y) * 1.6) + aData.y * 6.2831);
  vColor = aColor * tw * (0.45 + 0.55 * uDim);
}
`;

export const starsFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor * exp(-d * d * 5.0), 1.0);
}
`;

export const nebulaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const nebulaFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uDim;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vUv - 0.5;
  p.x *= uAspect;
  float d = length(p - uCenter);
  float n = fbm(p * 2.4 + vec2(uTime * 0.012, -uTime * 0.008));
  float glow = exp(-d * d * 3.4) * (0.5 + 0.5 * n);
  vec3 col = vec3(0.0196, 0.0157, 0.0392);
  col += uColA * glow * 0.2 * (0.35 + 0.65 * uDim);
  col += uColB * pow(n, 3.0) * 0.07;
  col *= smoothstep(1.35, 0.3, length(vUv - 0.5) * 1.7);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0; // dither away banding
  gl_FragColor = vec4(col, 1.0);
}
`;
