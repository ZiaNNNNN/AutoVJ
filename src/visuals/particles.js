import * as THREE from 'three';

const PARTICLE_COUNT = 3000;

export class ParticlesVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.colorOffset = 0;
    // Black background plane (prevents alpha bleedthrough)
    const bgGeo = new THREE.PlaneGeometry(100, 100);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.z = -20;
    this.scene.add(bg);
    this._createParticles();
  }

  _createParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      sizes[i] = Math.random() * 3 + 0.5;
      const c = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    this.velocities = velocities;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBeat: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uBeat;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (1.0 + uBeat * 1.5) * (30.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d) * 0.6;
          gl_FragColor = vec4(vColor * 0.7, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.scene.add(this.points);
  }

  update(analyzer, time) {
    this.colorOffset += 0.001;
    const positions = this.points.geometry.attributes.position.array;
    const colors = this.points.geometry.attributes.color.array;
    const vel = this.velocities;
    const bass = analyzer.bass;
    const treble = analyzer.treble;

    // On beat: burst particles outward
    if (analyzer.isBeat) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const scale = analyzer.beatIntensity * 0.08;
        vel[i * 3] += (Math.random() - 0.5) * scale;
        vel[i * 3 + 1] += (Math.random() - 0.5) * scale;
        vel[i * 3 + 2] += (Math.random() - 0.5) * scale;
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Apply velocity
      positions[i3] += vel[i3];
      positions[i3 + 1] += vel[i3 + 1];
      positions[i3 + 2] += vel[i3 + 2];

      // Damping
      vel[i3] *= 0.98;
      vel[i3 + 1] *= 0.98;
      vel[i3 + 2] *= 0.98;

      // Attract back to center gently
      positions[i3] += -positions[i3] * 0.003;
      positions[i3 + 1] += -positions[i3 + 1] * 0.003;
      positions[i3 + 2] += -positions[i3 + 2] * 0.002;

      // Swirl with bass
      const angle = bass * 0.05;
      const x = positions[i3];
      const z = positions[i3 + 2];
      positions[i3] += (-z * angle);
      positions[i3 + 2] += (x * angle);

      // Update colors
      const hue = (i / PARTICLE_COUNT + this.colorOffset + treble) % 1;
      const c = new THREE.Color().setHSL(hue, 0.9, 0.25 + bass * 0.2);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.material.uniforms.uTime.value = time;
    this.points.material.uniforms.uBeat.value = analyzer.beatIntensity;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
