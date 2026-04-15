import * as THREE from 'three';
import { CoverArtVisual } from './coverArt.js';
import { WordParticlesVisual } from './wordParticles.js';

const MODE_NAMES = ['Cover Art', 'Word Cloud'];

export class VisualManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.coverArt = new CoverArtVisual();
    this.wordParticles = new WordParticlesVisual();
    this.modes = [
      this.coverArt,
      this.wordParticles,
    ];
    this.currentIndex = 0;

    this.renderer.setClearColor(0x000000);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 3);

    this.onModeChange = null;
  }

  get currentMode() {
    return this.modes[this.currentIndex];
  }

  get currentName() {
    return MODE_NAMES[this.currentIndex];
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.modes.length;
    this.onModeChange?.(this.currentName, this.currentIndex);
  }

  select(index) {
    if (index >= 0 && index < this.modes.length) {
      this.currentIndex = index;
      this.onModeChange?.(this.currentName, this.currentIndex);
    }
  }

  setCoverImage(url) {
    this.coverArt.setCoverImage(url);
  }

  setMoodParams(songMood) {
    const palette = songMood.getPalette();
    const energy = songMood.getEnergy();

    this.coverArt.setMoodParams(
      palette,
      energy,
      songMood.getBeatReactivity(),
      songMood.getDistortion(),
    );

    this.wordParticles.setPalette(palette);
    this.wordParticles.setEnergy(energy);
  }

  setKeywords(keywords) {
    this.wordParticles.setKeywords(keywords);
  }

  update(analyzer, time) {
    this.currentMode.update(analyzer, time);
  }

  render() {
    const mode = this.currentMode;
    const camera = mode.camera || this.camera;
    if (mode.flashColor) {
      this.renderer.setClearColor(mode.flashColor, 1);
    } else {
      this.renderer.setClearColor(0x000000, 1);
    }
    this.renderer.render(mode.scene, camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.coverArt.setResolution(w, h);
  }

  dispose() {
    this.modes.forEach((m) => m.dispose());
  }
}
