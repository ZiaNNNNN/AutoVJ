import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uVolume;
uniform vec2 uResolution;
uniform float uColorOffset;

varying vec2 vUv;

#define PI 3.14159265359

// Smooth noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * noise(p); p *= 2.01;
  f += 0.2500 * noise(p); p *= 2.02;
  f += 0.1250 * noise(p); p *= 2.03;
  f += 0.0625 * noise(p);
  return f;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;

  float t = uTime * 0.5;

  // Warped coordinates driven by audio
  vec2 q = vec2(
    fbm(p + t * 0.3 + uBass * 0.5),
    fbm(p + vec2(1.7, 9.2) + t * 0.2 + uMid * 0.3)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.15 + uTreble * 0.4),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.1 + uBass * 0.3)
  );

  float f = fbm(p + 4.0 * r);

  // Radial pulse on beat
  float dist = length(p);
  float pulse = sin(dist * 8.0 - uTime * 3.0) * uBeat * 0.3;
  f += pulse;

  // Kaleidoscope-like symmetry
  float angle = atan(p.y, p.x);
  float segments = 6.0 + uMid * 4.0;
  float kalei = sin(angle * segments + t + f * 3.0) * 0.2;
  f += kalei * uVolume;

  // Color mapping
  float hue = uColorOffset + f * 0.3 + uBass * 0.1;
  float sat = 0.6 + uTreble * 0.3;
  float light = 0.1 + f * 0.5 + uBeat * 0.15;

  // HSL to RGB
  float c = (1.0 - abs(2.0 * light - 1.0)) * sat;
  float x = c * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
  float m = light - c * 0.5;

  vec3 rgb;
  float h6 = mod(hue * 6.0, 6.0);
  if (h6 < 1.0) rgb = vec3(c, x, 0.0);
  else if (h6 < 2.0) rgb = vec3(x, c, 0.0);
  else if (h6 < 3.0) rgb = vec3(0.0, c, x);
  else if (h6 < 4.0) rgb = vec3(0.0, x, c);
  else if (h6 < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  rgb += m;

  // Vignette
  float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.5;
  rgb *= vig;

  gl_FragColor = vec4(rgb, 1.0);
}
`;

export class ShaderArtVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.colorOffset = 0;

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
        uVolume: { value: 0 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uColorOffset: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);

    // Orthographic camera for fullscreen quad
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  update(analyzer, time) {
    this.colorOffset += 0.0005;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBass.value = analyzer.bass;
    u.uMid.value = analyzer.mid;
    u.uTreble.value = analyzer.treble;
    u.uBeat.value = analyzer.beatIntensity;
    u.uVolume.value = analyzer.volume;
    u.uColorOffset.value = this.colorOffset;
  }

  setResolution(w, h) {
    this.material.uniforms.uResolution.value.set(w, h);
  }

  dispose() {
    this.material.dispose();
  }
}
