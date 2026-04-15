export class AudioAnalyzer {
  constructor(analyserNode) {
    this.analyser = analyserNode;
    this.bufferLength = analyserNode.frequencyBinCount;
    this.frequencyData = new Uint8Array(this.bufferLength);
    this.timeDomainData = new Uint8Array(this.bufferLength);

    // Beat detection state (uses RAW signal for contrast)
    this.energyHistory = new Float32Array(60);
    this.historyIndex = 0;
    this.lastBeatTime = 0;
    this.beatCooldown = 150;
    this.isBeat = false;
    this.beatIntensity = 0;

    // Output values (used by visuals)
    this.subBass = 0;
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.volume = 0;
    this.kick = 0;

    // Internal raw values (pre-gain, for beat detection)
    this._rawBass = 0;
    this._rawSubBass = 0;
    this._prevRawSubBass = 0;
    this._prevGainedSubBass = 0;

    // Auto-gain
    this._peakLevel = 0.01;
    this._gainAdaptSpeed = 0.005;

    // User-controllable parameters
    this.sensitivity = 1.0;  // visual amplitude multiplier (↑↓ arrows? or other keys)
    this.reactivity = 1.0;   // how often effects trigger (beat detection sensitivity)
  }

  update(_time) {
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);

    const len = this.bufferLength;
    const subBassEnd = Math.floor(len * 0.03);
    const bassEnd = Math.floor(len * 0.1);
    const midEnd = Math.floor(len * 0.4);

    let subBassSum = 0, bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < len; i++) {
      const v = this.frequencyData[i] / 255;
      if (i < subBassEnd) subBassSum += v;
      else if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
      else trebleSum += v;
    }

    // Raw band averages (NO gain applied)
    const rawSubBass = subBassSum / Math.max(subBassEnd, 1);
    const rawBass = (bassSum + subBassSum) / bassEnd;
    const rawMid = midSum / (midEnd - bassEnd);
    const rawTreble = trebleSum / (len - midEnd);

    // Store raw values for beat detection (preserves dynamic range)
    this._rawSubBass = rawSubBass;
    this._rawBass = rawBass;

    // --- Auto-gain for visual output only ---
    const currentPeak = Math.max(rawBass, rawMid, rawTreble);
    if (currentPeak > this._peakLevel) {
      this._peakLevel = this._peakLevel * 0.9 + currentPeak * 0.1;
    } else {
      this._peakLevel = this._peakLevel * (1 - this._gainAdaptSpeed) + currentPeak * this._gainAdaptSpeed;
    }
    this._peakLevel = Math.max(this._peakLevel, 0.01);

    // Apply gain + user sensitivity for visual output
    const gain = (1.0 / this._peakLevel) * this.sensitivity;
    const gainedSubBass = Math.min(rawSubBass * gain, 1.5);
    const gainedBass = Math.min(rawBass * gain, 1.5);
    const gainedMid = Math.min(rawMid * gain, 1.5);
    const gainedTreble = Math.min(rawTreble * gain, 1.5);

    // Smooth output values
    const smoothing = 0.3;
    const kickSmoothing = 0.5;
    this.subBass = this.subBass * (1 - kickSmoothing) + gainedSubBass * kickSmoothing;
    this.bass = this.bass * (1 - smoothing) + gainedBass * smoothing;
    this.mid = this.mid * (1 - smoothing) + gainedMid * smoothing;
    this.treble = this.treble * (1 - smoothing) + gainedTreble * smoothing;
    this.volume = (this.bass + this.mid + this.treble) / 3;

    // Kick detection from gained signal (visual punch)
    this.kick = Math.min(Math.max(0, this.subBass - this._prevGainedSubBass) * 4, 1.0);
    this._prevGainedSubBass = this.subBass;

    // Beat detection uses RAW signal (preserves dynamic contrast)
    this.detectBeat();
  }

  detectBeat() {
    // Use RAW bass for beat detection - not compressed by auto-gain
    const currentEnergy = this._rawBass;

    this.energyHistory[this.historyIndex] = currentEnergy;
    this.historyIndex = (this.historyIndex + 1) % this.energyHistory.length;

    let avgEnergy = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
      avgEnergy += this.energyHistory[i];
    }
    avgEnergy /= this.energyHistory.length;

    const now = performance.now();
    // Reactivity controls how easily beats trigger
    // Lower multiplier = more beats detected
    const thresholdMult = 1.5 - this.reactivity * 0.4; // reactivity 1.0 → mult 1.1
    const threshold = avgEnergy * thresholdMult + 0.01;

    if (currentEnergy > threshold && now - this.lastBeatTime > this.beatCooldown) {
      this.isBeat = true;
      // Scale beat intensity by sensitivity for visual impact
      this.beatIntensity = Math.min((currentEnergy - avgEnergy) / Math.max(avgEnergy, 0.01) * this.sensitivity, 1);
      this.lastBeatTime = now;
    } else {
      this.isBeat = false;
      this.beatIntensity *= 0.9;
    }
  }

  getFrequencyArray() {
    const arr = new Float32Array(this.bufferLength);
    const gain = (1.0 / this._peakLevel) * this.sensitivity;
    for (let i = 0; i < this.bufferLength; i++) {
      arr[i] = Math.min(this.frequencyData[i] / 255 * gain, 1);
    }
    return arr;
  }

  getWaveformArray() {
    const arr = new Float32Array(this.bufferLength);
    for (let i = 0; i < this.bufferLength; i++) {
      arr[i] = (this.timeDomainData[i] / 128) - 1;
    }
    return arr;
  }
}
