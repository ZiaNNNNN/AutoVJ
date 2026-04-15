// Simulates audio analysis data for demo/testing when no mic is available
export class DemoAnalyzer {
  constructor() {
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.volume = 0;
    this.isBeat = false;
    this.beatIntensity = 0;
    this.kick = 0;
    this.subBass = 0;
    this.bufferLength = 1024;

    this._nextBeat = 0;
    this._bpm = 128;
    this._freqArray = new Float32Array(this.bufferLength);
    this._waveArray = new Float32Array(this.bufferLength);
  }

  update(time) {
    // Simulate a pulsing beat at ~128 BPM
    const beatInterval = 60 / this._bpm;
    const phase = (time % beatInterval) / beatInterval;

    // Bass peaks on beat
    this.bass = 0.2 + Math.pow(Math.max(0, 1 - phase * 4), 2) * 0.7;
    // Mid follows bass with slight delay
    this.mid = 0.15 + Math.pow(Math.max(0, 1 - Math.max(0, phase - 0.05) * 5), 2) * 0.5;
    // Treble has hi-hat pattern (every half beat)
    const halfPhase = (time % (beatInterval / 2)) / (beatInterval / 2);
    this.treble = 0.1 + Math.pow(Math.max(0, 1 - halfPhase * 6), 2) * 0.4;

    this.volume = (this.bass + this.mid + this.treble) / 3;

    // Add some slow variation
    const slow = Math.sin(time * 0.2) * 0.5 + 0.5;
    this.bass *= 0.7 + slow * 0.3;
    this.mid *= 0.8 + Math.sin(time * 0.3) * 0.2;

    // Beat detection
    if (phase < 0.08 && time > this._nextBeat) {
      this.isBeat = true;
      this.beatIntensity = 0.6 + Math.random() * 0.4;
      this.kick = 0.7 + Math.random() * 0.3;
      this._nextBeat = time + beatInterval * 0.5;
    } else {
      this.isBeat = false;
      this.beatIntensity *= 0.92;
      this.kick *= 0.85; // fast decay for kick
    }
    this.subBass = this.bass * 1.2;

    // Generate fake frequency data
    for (let i = 0; i < this.bufferLength; i++) {
      const freq = i / this.bufferLength;
      let val = 0;
      // Bass region
      if (freq < 0.1) val = this.bass * (1 - freq * 10) + Math.random() * 0.05;
      // Mid region
      else if (freq < 0.4) val = this.mid * 0.6 * Math.sin(freq * 20 + time * 3) + 0.1;
      // Treble region
      else val = this.treble * 0.3 * (1 + Math.sin(freq * 50 + time * 5)) * 0.5;

      this._freqArray[i] = Math.max(0, Math.min(1, val));
    }

    // Generate fake waveform
    for (let i = 0; i < this.bufferLength; i++) {
      const t = i / this.bufferLength;
      this._waveArray[i] =
        Math.sin(t * Math.PI * 4 + time * 8) * this.bass * 0.5 +
        Math.sin(t * Math.PI * 12 + time * 15) * this.treble * 0.3 +
        Math.sin(t * Math.PI * 2 + time * 3) * this.mid * 0.2;
    }
  }

  getFrequencyArray() {
    return this._freqArray;
  }

  getWaveformArray() {
    return this._waveArray;
  }
}
