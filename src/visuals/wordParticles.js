import * as THREE from 'three';

const MAX_PARTICLES = 5000;
const WORD_LIFETIME = 4; // seconds per word display

export class WordParticlesVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.keywords = [];
    this.palette = [
      { hue: 260, sat: 0.6, light: 0.4 },
      { hue: 200, sat: 0.5, light: 0.3 },
      { hue: 320, sat: 0.7, light: 0.35 },
    ];
    this.energy = 0.5;
    this.currentWordIndex = 0;
    this.wordTimer = 0;
    this.phase = 0; // 0=forming, 1=display, 2=exploding
    this.phaseTime = 0;

    // Canvas for text rendering
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 512;
    this.textCanvas.height = 256;
    this.textCtx = this.textCanvas.getContext('2d');

    // Background plane
    const bgGeo = new THREE.PlaneGeometry(100, 100);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.z = -20;
    this.scene.add(bg);

    this._createParticles();
    this._targetPositions = new Float32Array(MAX_PARTICLES * 3);
    this._randomPositions = new Float32Array(MAX_PARTICLES * 3);
    this._initRandomPositions();
  }

  _createParticles() {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    const alphas = new Float32Array(MAX_PARTICLES);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      sizes[i] = Math.random() * 2 + 1;
      alphas[i] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uBeat: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uBeat;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (1.0 + uBeat * 0.5) * (40.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * glow, vAlpha * glow);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.scene.add(this.points);
    this.activeCount = 0;
  }

  _initRandomPositions() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._randomPositions[i * 3] = (Math.random() - 0.5) * 10;
      this._randomPositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      this._randomPositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
  }

  setKeywords(keywords) {
    this.keywords = keywords || [];
    this.currentWordIndex = 0;
    if (this.keywords.length > 0) {
      this._prepareWord(this.keywords[0]);
    }
  }

  setPalette(palette) {
    this.palette = palette || this.palette;
  }

  setEnergy(energy) {
    this.energy = energy;
  }

  _prepareWord(word) {
    const ctx = this.textCtx;
    const w = this.textCanvas.width;
    const h = this.textCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';

    // Auto-size font to fit
    let fontSize = 120;
    ctx.font = `bold ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    while (ctx.measureText(word).width > w * 0.9 && fontSize > 20) {
      fontSize -= 5;
      ctx.font = `bold ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, w / 2, h / 2);

    // Extract pixel positions
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    const points = [];

    const step = 2; // sample every 2 pixels
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        if (pixels[idx + 3] > 128) {
          // Map canvas coords to 3D space (-3..3 x, -1.5..1.5 y)
          points.push({
            x: (x / w - 0.5) * 6,
            y: -(y / h - 0.5) * 3,
          });
        }
      }
    }

    // Assign target positions
    this.activeCount = Math.min(points.length, MAX_PARTICLES);
    for (let i = 0; i < this.activeCount; i++) {
      this._targetPositions[i * 3] = points[i].x;
      this._targetPositions[i * 3 + 1] = points[i].y;
      this._targetPositions[i * 3 + 2] = 0;
    }

    // Reset phase
    this.phase = 0;
    this.phaseTime = 0;
    this._initRandomPositions();
  }

  update(analyzer, time) {
    if (this.keywords.length === 0) return;

    this.phaseTime += 0.016; // ~60fps
    this.material.uniforms.uBeat.value = analyzer.beatIntensity;

    const positions = this.points.geometry.attributes.position.array;
    const colors = this.points.geometry.attributes.color.array;
    const alphas = this.points.geometry.attributes.alpha.array;

    const formDuration = 0.8;
    const displayDuration = WORD_LIFETIME - formDuration - 0.5;

    // Phase transitions
    if (this.phase === 0 && this.phaseTime > formDuration) {
      this.phase = 1;
      this.phaseTime = 0;
    } else if (this.phase === 1 && this.phaseTime > displayDuration) {
      this.phase = 2;
      this.phaseTime = 0;
    } else if (this.phase === 2 && this.phaseTime > 0.5) {
      // Next word
      this.currentWordIndex = (this.currentWordIndex + 1) % this.keywords.length;
      this._prepareWord(this.keywords[this.currentWordIndex]);
    }

    // Choose a palette color for this word
    const palColor = this.palette[this.currentWordIndex % this.palette.length];
    const hue = palColor.hue / 360;
    const col = new THREE.Color().setHSL(hue, palColor.sat, palColor.light);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const i3 = i * 3;

      if (i < this.activeCount) {
        let t;
        if (this.phase === 0) {
          // Forming: lerp from random to target
          t = Math.min(this.phaseTime / formDuration, 1);
          t = t * t * (3 - 2 * t); // smoothstep
          positions[i3] = lerp(this._randomPositions[i3], this._targetPositions[i3], t);
          positions[i3 + 1] = lerp(this._randomPositions[i3 + 1], this._targetPositions[i3 + 1], t);
          positions[i3 + 2] = lerp(this._randomPositions[i3 + 2], 0, t);
          alphas[i] = t * 0.8;
        } else if (this.phase === 1) {
          // Display: hold position with beat jitter
          const jitter = analyzer.beatIntensity * 0.05;
          positions[i3] = this._targetPositions[i3] + (Math.random() - 0.5) * jitter;
          positions[i3 + 1] = this._targetPositions[i3 + 1] + (Math.random() - 0.5) * jitter;
          positions[i3 + 2] = (Math.random() - 0.5) * jitter * 0.5;
          alphas[i] = 0.8;

          // Pulse on beat
          if (analyzer.isBeat) {
            positions[i3] += (Math.random() - 0.5) * 0.15 * analyzer.beatIntensity;
            positions[i3 + 1] += (Math.random() - 0.5) * 0.15 * analyzer.beatIntensity;
          }
        } else {
          // Exploding: fly outward
          const explodeT = this.phaseTime / 0.5;
          const dx = positions[i3] * 0.1 + (Math.random() - 0.5) * 0.2;
          const dy = positions[i3 + 1] * 0.1 + (Math.random() - 0.5) * 0.2;
          positions[i3] += dx * this.energy;
          positions[i3 + 1] += dy * this.energy;
          positions[i3 + 2] += (Math.random() - 0.5) * 0.1;
          alphas[i] = Math.max(0, 0.8 * (1 - explodeT));
        }

        colors[i3] = col.r;
        colors[i3 + 1] = col.g;
        colors[i3 + 2] = col.b;
      } else {
        alphas[i] = 0;
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
