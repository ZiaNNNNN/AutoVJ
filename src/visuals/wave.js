import * as THREE from 'three';

export class WaveVisual {
  constructor() {
    this.scene = new THREE.Scene();
    this.barCount = 128;
    this.bars = [];
    this.wavePoints = [];
    this.colorOffset = 0;

    this._createBars();
    this._createWaveLine();
  }

  _createBars() {
    const geo = new THREE.PlaneGeometry(0.06, 1);
    for (let i = 0; i < this.barCount; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      const x = (i / this.barCount) * 4 - 2;
      mesh.position.set(x, 0, 0);
      mesh.scale.y = 0.01;
      this.scene.add(mesh);
      this.bars.push(mesh);
    }
  }

  _createWaveLine() {
    const points = [];
    for (let i = 0; i < 512; i++) {
      points.push(new THREE.Vector3((i / 512) * 4 - 2, 0, 0.1));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    this.waveLine = new THREE.Line(geometry, material);
    this.scene.add(this.waveLine);
  }

  update(analyzer, time) {
    this.colorOffset += 0.002;
    const freq = analyzer.getFrequencyArray();
    const wave = analyzer.getWaveformArray();

    // Update frequency bars
    const step = Math.floor(freq.length / this.barCount);
    for (let i = 0; i < this.barCount; i++) {
      const value = freq[i * step];
      const bar = this.bars[i];
      bar.scale.y = 0.01 + value * 2;
      bar.position.y = bar.scale.y * 0.5 - 0.5;

      // Color based on frequency band
      const hue = (i / this.barCount + this.colorOffset) % 1;
      bar.material.color.setHSL(hue, 0.8, 0.3 + value * 0.4);
    }

    // Update waveform line
    const positions = this.waveLine.geometry.attributes.position.array;
    const waveStep = Math.floor(wave.length / 512);
    for (let i = 0; i < 512; i++) {
      positions[i * 3 + 1] = wave[i * waveStep] * 0.8 + 0.8;
    }
    this.waveLine.geometry.attributes.position.needsUpdate = true;

    const hue = (this.colorOffset * 2) % 1;
    this.waveLine.material.color.setHSL(hue, 0.9, 0.6);

    // Flash on beat - store for renderer
    if (analyzer.isBeat) {
      this.flashColor = new THREE.Color().setHSL(hue, 0.5, 0.05 * analyzer.beatIntensity);
    } else {
      this.flashColor = null;
    }
  }

  dispose() {
    this.bars.forEach((b) => { b.geometry.dispose(); b.material.dispose(); });
    this.waveLine.geometry.dispose();
    this.waveLine.material.dispose();
  }
}
