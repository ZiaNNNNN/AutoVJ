// Manages the current song's visual mood parameters
// Smoothly interpolates between moods when switching songs

const DEFAULT_MOOD = {
  mood: 'neutral',
  energy: 0.5,
  palette: [
    { hue: 260, sat: 0.6, light: 0.4 },
    { hue: 200, sat: 0.5, light: 0.3 },
    { hue: 320, sat: 0.7, light: 0.35 },
  ],
  keywords: [],
  beatReactivity: 0.6,
  distortionLevel: 0.3,
};

export class SongMood {
  constructor() {
    this.current = { ...DEFAULT_MOOD };
    this.target = { ...DEFAULT_MOOD };
    this.lerpSpeed = 0.02; // smooth transition speed
  }

  setMood(analysis) {
    if (!analysis) return;
    this.target = {
      mood: analysis.mood || 'neutral',
      energy: analysis.energy ?? 0.5,
      palette: analysis.palette || DEFAULT_MOOD.palette,
      keywords: analysis.keywords || [],
      beatReactivity: analysis.beatReactivity ?? 0.6,
      distortionLevel: analysis.distortionLevel ?? 0.3,
    };
  }

  // Call every frame to smoothly interpolate
  update() {
    const s = this.lerpSpeed;
    this.current.energy = lerp(this.current.energy, this.target.energy, s);
    this.current.beatReactivity = lerp(this.current.beatReactivity, this.target.beatReactivity, s);
    this.current.distortionLevel = lerp(this.current.distortionLevel, this.target.distortionLevel, s);

    // Interpolate palette colors
    for (let i = 0; i < 3; i++) {
      const c = this.current.palette[i] = this.current.palette[i] || { hue: 0, sat: 0.5, light: 0.3 };
      const t = this.target.palette[i] || DEFAULT_MOOD.palette[i];
      c.hue = lerpAngle(c.hue, t.hue, s);
      c.sat = lerp(c.sat, t.sat, s);
      c.light = lerp(c.light, t.light, s);
    }

    // Keywords switch instantly (no interpolation needed)
    this.current.keywords = this.target.keywords;
    this.current.mood = this.target.mood;
  }

  getEnergy() { return this.current.energy; }
  getBeatReactivity() { return this.current.beatReactivity; }
  getDistortion() { return this.current.distortionLevel; }
  getPalette() { return this.current.palette; }
  getKeywords() { return this.current.keywords; }
  getMood() { return this.current.mood; }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let diff = b - a;
  // Shortest path around the hue circle
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
}
