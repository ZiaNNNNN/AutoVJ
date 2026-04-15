import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Professional VJ-grade fragment shader
const fragmentShader = `
precision highp float;

uniform sampler2D uTexture;
uniform sampler2D uPrevTexture;  // previous cover for crossfade
uniform float uHasPrevTexture;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform vec2 uResolution;
uniform float uHasTexture;
uniform vec3 uMoodColor1;
uniform vec3 uMoodColor2;
uniform vec3 uMoodColor3;
uniform float uMoodEnergy;
uniform float uMoodBeatReact;
uniform float uMoodDistortion;
uniform float uKick;
uniform float uTransition; // 0=normal, 0→0.5=fade out, 0.5→1=fade in
uniform vec3 uEffectIds;
uniform vec3 uEffectIntensities;
uniform float uSongSeed;

varying vec2 vUv;

// ---- Noise functions ----
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5000 * noise(p); p *= 2.01;
  f += 0.2500 * noise(p); p *= 2.02;
  f += 0.1250 * noise(p); p *= 2.03;
  f += 0.0625 * noise(p);
  return f;
}

// ---- Aspect-ratio-correct sampling ----
// Keeps the square cover centered, fills sides with blurred edge color
vec2 fitCover(vec2 uv) {
  float aspect = uResolution.x / uResolution.y;
  // Image is 1:1, screen is wider → letterbox sides
  vec2 scaled = uv;
  scaled.x = (uv.x - 0.5) * aspect + 0.5;
  return scaled;
}

bool isInBounds(vec2 uv) {
  return uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
}

// Sample with blurred edge falloff for out-of-bounds areas
vec3 sampleWithBleed(vec2 uv, vec2 rawUv) {
  if (isInBounds(uv)) {
    return texture2D(uTexture, uv).rgb;
  }
  // Bleed: sample the nearest edge pixel and blur it
  vec2 clamped = clamp(uv, 0.01, 0.99);
  vec3 edgeColor = texture2D(uTexture, clamped).rgb;
  // Darken and desaturate as we go further from bounds
  float dist = max(
    max(-uv.x, uv.x - 1.0),
    max(-uv.y, uv.y - 1.0)
  );
  dist = smoothstep(0.0, 0.3, dist);
  float luma = dot(edgeColor, vec3(0.299, 0.587, 0.114));
  edgeColor = mix(edgeColor, vec3(luma) * 0.3, dist * 0.7);
  edgeColor *= 1.0 - dist * 0.8;
  // Add subtle noise to prevent banding
  edgeColor += (hash(rawUv * 500.0 + uTime) - 0.5) * 0.02;
  return edgeColor;
}

// ---- Professional Effects ----

// Smooth organic displacement (replaces hard glitch)
vec2 fxDisplace(vec2 uv, float t, float intensity) {
  float n1 = fbm(uv * 3.0 + t * 0.5 + uSongSeed);
  float n2 = fbm(uv * 3.0 + t * 0.5 + 100.0 + uSongSeed);
  return uv + vec2(n1 - 0.5, n2 - 0.5) * intensity * 0.12;
}

// Smooth zoom drift to a focus point
vec2 fxDrift(vec2 uv, float t, float intensity) {
  vec2 focus = vec2(
    0.5 + sin(t * 0.3 + uSongSeed * 6.28) * 0.2,
    0.5 + cos(t * 0.4 + uSongSeed * 3.14) * 0.15
  );
  float zoom = 1.0 + intensity * 0.4;
  return (uv - focus) / zoom + focus;
}

// Organic swirl/vortex
vec2 fxVortex(vec2 uv, float t, float intensity) {
  vec2 center = vec2(0.5);
  vec2 d = uv - center;
  float dist = length(d);
  float angle = intensity * 0.8 * smoothstep(0.5, 0.0, dist);
  float s = sin(angle);
  float c = cos(angle);
  d = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
  return center + d;
}

// Smooth kaleidoscope
vec2 fxKaleidoscope(vec2 uv, float t, float intensity) {
  vec2 p = uv - 0.5;
  float angle = atan(p.y, p.x);
  float segments = 3.0 + floor(intensity * 4.0);
  angle = mod(angle + t * 0.1, 6.2832 / segments);
  angle = abs(angle - 3.1416 / segments);
  float r = length(p);
  return vec2(cos(angle), sin(angle)) * r + 0.5;
}

// Ripple / water surface
vec2 fxRipple(vec2 uv, float t, float intensity) {
  vec2 center = vec2(0.5);
  float dist = length(uv - center);
  float wave = sin(dist * 20.0 - t * 4.0) * intensity * 0.02;
  vec2 dir = normalize(uv - center + 0.001);
  return uv + dir * wave * smoothstep(0.5, 0.0, dist);
}

// Smooth horizontal scan displacement
vec2 fxScan(vec2 uv, float t, float intensity) {
  float scanPos = fract(t * 0.3);
  float scanWidth = 0.15;
  float d = abs(uv.y - scanPos);
  float mask = smoothstep(scanWidth, 0.0, d);
  float offset = (noise(vec2(uv.y * 20.0, t * 5.0)) - 0.5) * mask * intensity * 0.08;
  return uv + vec2(offset, 0.0);
}

// Morph / elastic deformation
vec2 fxMorph(vec2 uv, float t, float intensity) {
  float n = fbm(uv * 2.0 + t * 0.2);
  float n2 = fbm(uv.yx * 2.0 + t * 0.15 + 50.0);
  vec2 offset = vec2(
    sin(n * 6.28 + t) * intensity * 0.06,
    cos(n2 * 6.28 + t * 0.7) * intensity * 0.06
  );
  return uv + offset;
}

// Fragment/shatter (smooth version)
vec2 fxFragment(vec2 uv, float t, float intensity) {
  float grid = 4.0 + intensity * 4.0;
  vec2 cell = floor(uv * grid);
  vec2 cellUv = fract(uv * grid);
  float seed = floor(t * 1.5);
  float angle = (hash(cell + seed) - 0.5) * intensity * 0.6;
  vec2 centered = cellUv - 0.5;
  float s = sin(angle);
  float c = cos(angle);
  centered = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
  float scale = 1.0 - intensity * 0.15 * hash(cell + seed + 7.0);
  centered *= scale;
  return (cell + centered + 0.5) / grid;
}

// Double/triple vision - offset ghost copies
vec2 fxGhost(vec2 uv, float t, float intensity) {
  float angle = t * 0.3 + intensity;
  vec2 offset = vec2(cos(angle), sin(angle)) * intensity * 0.04;
  return uv + offset;
}

// Slow cinematic pan (Ken Burns)
vec2 fxPan(vec2 uv, float t, float intensity) {
  float panX = sin(t * 0.15) * intensity * 0.08;
  float panY = cos(t * 0.12) * intensity * 0.05;
  float zoom = 1.0 + sin(t * 0.08) * intensity * 0.15;
  return (uv - 0.5 - vec2(panX, panY)) / zoom + 0.5;
}

// Radial blur from center
vec2 fxRadialBlur(vec2 uv, float t, float intensity) {
  vec2 center = vec2(0.5);
  vec2 dir = uv - center;
  float blur = intensity * 0.03;
  return uv + dir * blur * sin(t * 2.0 + length(dir) * 8.0);
}

// Prismatic split - subtle RGB channel offset
vec2 fxPrism(vec2 uv, float t, float intensity) {
  float wave = sin(uv.y * 15.0 + t * 2.0) * intensity * 0.015;
  return uv + vec2(wave, 0.0);
}

// Breathing zoom - slow in/out
vec2 fxBreathe(vec2 uv, float t, float intensity) {
  float breath = sin(t * 0.8) * intensity * 0.06;
  return (uv - 0.5) * (1.0 - breath) + 0.5;
}

// Apply effect by ID (0-12)
vec2 applyEffect(vec2 uv, float id, float intensity, float t) {
  if (intensity < 0.01) return uv;
  if (id < 0.5) return fxDisplace(uv, t, intensity);    // 0: subtle noise warp
  if (id < 1.5) return fxDrift(uv, t, intensity);       // 1: drift zoom
  if (id < 2.5) return fxVortex(uv, t, intensity);      // 2: swirl
  if (id < 3.5) return fxKaleidoscope(uv, t, intensity);// 3: kaleidoscope (rare)
  if (id < 4.5) return fxRipple(uv, t, intensity);      // 4: water ripple
  if (id < 5.5) return fxScan(uv, t, intensity);        // 5: scan lines
  if (id < 6.5) return fxMorph(uv, t, intensity);       // 6: elastic morph
  if (id < 7.5) return fxFragment(uv, t, intensity);    // 7: shatter (rare)
  if (id < 8.5) return fxGhost(uv, t, intensity);       // 8: ghost double vision
  if (id < 9.5) return fxPan(uv, t, intensity);         // 9: cinematic pan
  if (id < 10.5) return fxRadialBlur(uv, t, intensity); // 10: radial blur
  if (id < 11.5) return fxPrism(uv, t, intensity);      // 11: prismatic split
  return fxBreathe(uv, t, intensity);                    // 12: breathing zoom
}

// ---- Color grading (cinematic) ----
vec3 colorGrade(vec3 color, float intensity) {
  // Lift-gamma-gain style grading
  vec3 lift = uMoodColor1 * 0.1;
  vec3 gamma = mix(vec3(1.0), uMoodColor2, 0.15);
  vec3 gain = mix(vec3(1.0), uMoodColor3, 0.2);

  color = color * gain + lift;
  color = pow(max(color, 0.0), gamma);

  // Subtle cross-process look
  color.r = mix(color.r, pow(color.r, 0.9), intensity * 0.3);
  color.b = mix(color.b, pow(color.b, 1.1), intensity * 0.3);

  return color;
}

// Film grain
float filmGrain(vec2 uv, float t) {
  return (hash(uv * 1000.0 + fract(t * 100.0)) - 0.5) * 0.06;
}

void main() {
  vec2 uv = vUv;
  float t = uTime;

  // ---- Aspect ratio correction ----
  vec2 coverUv = fitCover(uv);

  // ---- Organic breathing (always on, subtle) ----
  float breathe = sin(t * 0.5) * 0.008 * uMoodEnergy;
  coverUv += vec2(sin(t * 0.7) * breathe, cos(t * 0.5) * breathe * 0.7);

  // ---- KICK / BASS PUNCH ----
  // Zoom pulse: image zooms in on kick, snaps back
  float kickPunch = uKick * 0.08 + uBass * 0.04;
  coverUv = (coverUv - 0.5) * (1.0 - kickPunch) + 0.5;

  // Shake: horizontal jitter on kick
  float shake = uKick * 0.015;
  coverUv.x += sin(t * 50.0) * shake;
  coverUv.y += cos(t * 43.0) * shake * 0.5;

  // Warp: bass-driven bulge from center
  vec2 toCenter = coverUv - 0.5;
  float dist = length(toCenter);
  float warp = uBass * 0.06 * smoothstep(0.5, 0.0, dist);
  coverUv += toCenter * warp;

  // ---- Apply 3 effect layers ----
  coverUv = applyEffect(coverUv, uEffectIds.x, uEffectIntensities.x, t);
  coverUv = applyEffect(coverUv, uEffectIds.y, uEffectIntensities.y, t + 1.7);
  coverUv = applyEffect(coverUv, uEffectIds.z, uEffectIntensities.z, t + 3.3);

  // ---- Sample with edge bleed ----
  vec3 color;
  if (uHasTexture > 0.5) {
    color = sampleWithBleed(coverUv, uv);

    // Chromatic aberration (smooth, organic)
    float totalFx = uEffectIntensities.x + uEffectIntensities.y + uEffectIntensities.z;
    float aberration = uBeat * 0.004 + totalFx * 0.003 + uKick * 0.01;
    vec2 abDir = normalize(coverUv - 0.5 + 0.001) * aberration;
    float r = sampleWithBleed(coverUv + abDir, uv).r;
    float b = sampleWithBleed(coverUv - abDir, uv).b;
    color = vec3(r, color.g, b);

    // Kick/bass brightness flash
    color *= 1.0 + uKick * 0.4 + uBeat * uMoodBeatReact * 0.2;

  } else {
    // Abstract generative background when no texture
    vec2 p = (uv - 0.5) * 2.0;
    float n = fbm(p * 2.0 + t * 0.2 + uSongSeed);
    float n2 = fbm(p * 3.0 - t * 0.15 + 50.0);
    color = uMoodColor1 * n + uMoodColor2 * n2 * 0.5;
    color *= 0.5 + uBeat * 0.3;
  }

  // ---- Cinematic color grading ----
  color = colorGrade(color, uMoodEnergy);

  // ---- Bloom / glow on bright areas ----
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  float bloom = smoothstep(0.6, 1.0, luma) * 0.15 * (1.0 + uBeat * 0.5);
  color += bloom * mix(uMoodColor1, vec3(1.0), 0.5);

  // ---- Film grain ----
  color += filmGrain(uv, t) * (0.8 + uMoodEnergy * 0.4);

  // ---- Vignette (soft, cinematic) ----
  float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.8;
  vig = smoothstep(0.0, 0.8, vig);
  color *= vig;

  // ---- Subtle scanlines (CRT feel) ----
  float scanline = sin(vUv.y * uResolution.y * 0.5) * 0.015;
  color -= scanline * 0.5;

  // ---- Song transition: crossfade with beat-reactive effects (3-5s) ----
  if (uTransition > 0.01 && uTransition < 0.99 && uHasPrevTexture > 0.5) {
    float t = uTransition; // 0→1 over ~4 seconds

    // Sample previous cover (with its own distortion for visual interest)
    vec2 prevUv = fitCover(vUv);
    // Reverse-drift the old cover (zooming out as it fades)
    prevUv = (prevUv - 0.5) * (1.0 + t * 0.3) + 0.5;
    vec3 prevColor = sampleWithBleed(prevUv, vUv);

    // Crossfade blend curve (S-curve for smooth transition)
    float blend = t * t * (3.0 - 2.0 * t); // smoothstep

    // Beat-reactive transition effects
    float beatPunch = uBeat * (1.0 - abs(t - 0.5) * 2.0); // strongest in the middle

    // Effect 1: Diagonal wipe with noise edge (random per transition)
    float wipeAngle = uSongSeed * 6.28;
    float wipeDir = dot(vUv - 0.5, vec2(cos(wipeAngle), sin(wipeAngle)));
    float wipeEdge = fbm(vUv * 5.0 + uTime) * 0.15;
    float wipe = smoothstep(-0.3, 0.3, wipeDir - (t - 0.5) * 1.5 + wipeEdge);

    // Effect 2: Radial reveal from center on beat
    float radial = length(vUv - 0.5);
    float radialReveal = smoothstep(t * 1.2, t * 1.2 - 0.15, radial);

    // Mix the two transition styles based on song seed
    float styleMix = fract(uSongSeed * 7.3);
    float transBlend;
    if (styleMix < 0.33) {
      transBlend = wipe; // diagonal wipe
    } else if (styleMix < 0.66) {
      transBlend = mix(blend, radialReveal, 0.5); // radial blend
    } else {
      transBlend = mix(wipe, blend, 0.5 + beatPunch * 0.3); // beat-modulated hybrid
    }

    // Apply the crossfade
    color = mix(prevColor, color, clamp(transBlend, 0.0, 1.0));

    // Chromatic aberration burst during transition
    float transAberration = sin(t * 3.14159) * 0.012;
    vec2 transAbDir = normalize(vUv - 0.5 + 0.001) * transAberration;
    vec3 mixedR = mix(
      sampleWithBleed(prevUv + transAbDir, vUv),
      sampleWithBleed(coverUv + transAbDir, vUv),
      clamp(transBlend, 0.0, 1.0)
    );
    vec3 mixedB = mix(
      sampleWithBleed(prevUv - transAbDir, vUv),
      sampleWithBleed(coverUv - transAbDir, vUv),
      clamp(transBlend, 0.0, 1.0)
    );
    color.r = mix(color.r, mixedR.r, 0.5);
    color.b = mix(color.b, mixedB.b, 0.5);

    // Subtle flash at midpoint
    float flash = pow(1.0 - abs(t - 0.5) * 2.0, 4.0) * 0.2 * (1.0 + beatPunch);
    color += flash;
  }

  // Clamp
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class CoverArtVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.textureLoader = new THREE.TextureLoader();
    this.currentTexture = null;
    this.prevTexture = null; // previous cover for crossfade

    // Transition state
    this.transition = 0;
    this.transitioning = false;
    this._pendingUrl = null;

    // 3-layer beat effect state
    this.layers = [
      { effectId: 0, intensity: 0 },
      { effectId: 0, intensity: 0 },
      { effectId: 0, intensity: 0 },
    ];
    this.songSeed = Math.random();
    this.lastBeat = false;
    this.beatCounter = 0;

    // Configurable: 0.0 = mostly original, 1.0 = heavy effects
    // Adjust with + / - keys
    this.effectMix = 0.4;

    // Weighted effect table: [id, weight]
    // Higher weight = more likely to be chosen
    // Subtle effects (keep image recognizable) have higher weight
    this.effectWeights = [
      [0,  3],  // displace (subtle)
      [1,  2],  // drift zoom
      [2,  1],  // vortex
      [3,  1.0],// kaleidoscope (occasional)
      [4,  3],  // ripple (subtle)
      [5,  2],  // scan
      [6,  3],  // morph (subtle)
      [7,  0.8],// fragment/shatter (occasional)
      [8,  3],  // ghost double vision (subtle)
      [9,  3],  // cinematic pan (subtle)
      [10, 2],  // radial blur
      [11, 3],  // prismatic (subtle)
      [12, 4],  // breathing zoom (very subtle, most common)
    ];
    this._totalWeight = this.effectWeights.reduce((s, w) => s + w[1], 0);

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: null },
        uPrevTexture: { value: null },
        uHasPrevTexture: { value: 0 },
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeat: { value: 0 },
        uResolution: { value: new THREE.Vector2(1920, 1080) },
        uHasTexture: { value: 0 },
        uMoodColor1: { value: new THREE.Color().setHSL(260 / 360, 0.6, 0.4) },
        uMoodColor2: { value: new THREE.Color().setHSL(200 / 360, 0.5, 0.3) },
        uMoodColor3: { value: new THREE.Color().setHSL(320 / 360, 0.7, 0.35) },
        uMoodEnergy: { value: 0.5 },
        uMoodBeatReact: { value: 0.6 },
        uMoodDistortion: { value: 0.3 },
        uKick: { value: 0 },
        uTransition: { value: 0 }, // 0=normal, 0.5=peak flash, 1=normal (new cover)
        uEffectIds: { value: new THREE.Vector3(0, 0, 0) },
        uEffectIntensities: { value: new THREE.Vector3(0, 0, 0) },
        uSongSeed: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setCoverImage(url) {
    if (!url) {
      this.material.uniforms.uHasTexture.value = 0;
      this.material.uniforms.uTexture.value = null;
      if (this.currentTexture) { this.currentTexture.dispose(); this.currentTexture = null; }
      return;
    }

    if (this.currentTexture) {
      // Move current texture to prevTexture for crossfade
      if (this.prevTexture) this.prevTexture.dispose();
      this.prevTexture = this.currentTexture;
      this.currentTexture = null;
      this.material.uniforms.uPrevTexture.value = this.prevTexture;
      this.material.uniforms.uHasPrevTexture.value = 1;

      // Start transition
      this.transitioning = true;
      this.transition = 0;

      // Load new texture
      this._loadTexture(url);
    } else {
      // First load: just load directly
      this._loadTexture(url);
    }
  }

  _loadTexture(url) {
    this.songSeed = Math.random();
    this.material.uniforms.uSongSeed.value = this.songSeed;
    this.beatCounter = 0;
    this._frameCount = 0;

    this.textureLoader.load(url, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      this.currentTexture = texture;
      this.material.uniforms.uTexture.value = texture;
      this.material.uniforms.uHasTexture.value = 1;
    });
  }

  update(analyzer, time) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBass.value = analyzer.bass;
    u.uMid.value = analyzer.mid;
    u.uTreble.value = analyzer.treble;
    u.uBeat.value = analyzer.beatIntensity;
    u.uKick.value = analyzer.kick || 0;

    // --- Transition animation (~4 seconds) ---
    if (this.transitioning) {
      this.transition += 0.004; // ~0.004 per frame at 60fps ≈ 4 seconds
      u.uTransition.value = this.transition;

      // Transition complete
      if (this.transition >= 1.0) {
        this.transitioning = false;
        this.transition = 0;
        u.uTransition.value = 0;
        // Clean up prev texture
        if (this.prevTexture) {
          this.prevTexture.dispose();
          this.prevTexture = null;
          u.uPrevTexture.value = null;
          u.uHasPrevTexture.value = 0;
        }
      }
    }

    // --- Effect trigger: on beat OR periodically ---
    const isBeatEdge = analyzer.isBeat && !this.lastBeat;
    this.lastBeat = analyzer.isBeat;

    // Periodic trigger: fixed interval, not random per frame
    this._frameCount = (this._frameCount || 0) + 1;
    // Trigger every 150-200 frames (~2.5-3.3s at 60fps)
    const periodicInterval = 150 + Math.floor(this.songSeed * 50);
    const periodicTrigger = this._frameCount % periodicInterval === 0;

    if (isBeatEdge || periodicTrigger) {
      this.beatCounter++;

      // Trigger strength scaled by effectMix
      const baseStrength = isBeatEdge
        ? 0.3 + analyzer.beatIntensity * 0.5
        : 0.15 + analyzer.volume * 0.2;
      const triggerStrength = baseStrength * (0.3 + this.effectMix * 0.7);

      // Replace the weakest layer
      let slot = 0;
      let minIntensity = this.layers[0].intensity;
      for (let i = 1; i < 3; i++) {
        if (this.layers[i].intensity < minIntensity) {
          minIntensity = this.layers[i].intensity;
          slot = i;
        }
      }

      // Weighted random effect selection
      const newEffect = this._pickWeightedEffect(slot);
      this.layers[slot].effectId = newEffect;
      this.layers[slot].intensity = triggerStrength;
    }

    // --- Boost existing layers on beat (even without replacing) ---
    if (isBeatEdge) {
      for (const layer of this.layers) {
        if (layer.intensity > 0.05) {
          layer.intensity = Math.min(1.0, layer.intensity + analyzer.beatIntensity * 0.15);
        }
      }
    }

    // --- Slow decay: effects last 5-10 seconds instead of 2 ---
    // 0.995^60 = 0.74 after 1s, 0.995^300 = 0.22 after 5s
    this.layers[0].intensity *= 0.995;
    this.layers[1].intensity *= 0.993;
    this.layers[2].intensity *= 0.991;

    // --- Minimum floor: subtle effect always on, scaled by effectMix ---
    const floor = 0.03 + this.effectMix * 0.06;
    if (this.layers[0].intensity < floor) {
      this.layers[0].intensity = floor;
    }

    u.uEffectIds.value.set(
      this.layers[0].effectId,
      this.layers[1].effectId,
      this.layers[2].effectId,
    );
    u.uEffectIntensities.value.set(
      this.layers[0].intensity,
      this.layers[1].intensity,
      this.layers[2].intensity,
    );
  }

  _pickWeightedEffect(slot) {
    const rand = this._seededRandom(this.songSeed * 2000 + this.beatCounter + slot * 77);
    let cumulative = 0;
    for (const [id, weight] of this.effectWeights) {
      cumulative += weight / this._totalWeight;
      if (rand < cumulative) {
        // Avoid duplicating an active effect
        if (this.layers.some((l, i) => i !== slot && l.intensity > 0.1 && l.effectId === id)) {
          continue;
        }
        return id;
      }
    }
    return 12; // fallback: breathing
  }

  setEffectMix(value) {
    this.effectMix = Math.max(0, Math.min(1, value));
    console.log(`Effect mix: ${(this.effectMix * 100).toFixed(0)}%`);
  }

  adjustEffectMix(delta) {
    this.setEffectMix(this.effectMix + delta);
  }

  _seededRandom(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  setMoodParams(palette, energy, beatReactivity, distortion) {
    const u = this.material.uniforms;
    if (palette[0]) u.uMoodColor1.value.setHSL(palette[0].hue / 360, palette[0].sat, palette[0].light);
    if (palette[1]) u.uMoodColor2.value.setHSL(palette[1].hue / 360, palette[1].sat, palette[1].light);
    if (palette[2]) u.uMoodColor3.value.setHSL(palette[2].hue / 360, palette[2].sat, palette[2].light);
    u.uMoodEnergy.value = energy;
    u.uMoodBeatReact.value = beatReactivity;
    u.uMoodDistortion.value = distortion;
  }

  setResolution(w, h) {
    this.material.uniforms.uResolution.value.set(w, h);
  }

  dispose() {
    this.material.dispose();
    if (this.currentTexture) this.currentTexture.dispose();
  }
}
