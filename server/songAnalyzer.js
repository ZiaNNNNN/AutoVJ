import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const CACHE_DIR = join(import.meta.dirname, '.cache', 'analysis');
mkdirSync(CACHE_DIR, { recursive: true });

const DEFAULT_ANALYSIS = {
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

export class SongAnalyzer {
  constructor() {
    this.client = null;
    this.pending = new Map();

    try {
      this.client = new Anthropic();
      console.log('[AI] Anthropic client initialized');
    } catch (err) {
      console.warn('[AI] No API key found, using default mood analysis');
    }
  }

  async analyze(trackName, lyricsText) {
    if (!lyricsText) return DEFAULT_ANALYSIS;

    const hash = createHash('md5').update(trackName + lyricsText).digest('hex');
    const cachePath = join(CACHE_DIR, `${hash}.json`);

    // Check cache
    if (existsSync(cachePath)) {
      try {
        const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
        console.log(`[AI] Cache hit: ${trackName}`);
        return cached;
      } catch { /* corrupt cache, re-analyze */ }
    }

    // Deduplicate
    if (this.pending.has(hash)) return this.pending.get(hash);

    if (!this.client) return DEFAULT_ANALYSIS;

    const promise = this._callClaude(trackName, lyricsText, cachePath);
    this.pending.set(hash, promise);

    try {
      return await promise;
    } finally {
      this.pending.delete(hash);
    }
  }

  async _callClaude(trackName, lyricsText, cachePath) {
    try {
      console.log(`[AI] Analyzing: ${trackName}`);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this song's lyrics for VJ visual generation. Return ONLY valid JSON, no other text.

Song: ${trackName}
Lyrics:
${lyricsText}

Return this exact JSON structure:
{
  "mood": "one or two words describing the overall mood",
  "energy": <0.0-1.0 float, how energetic/intense>,
  "palette": [
    {"hue": <0-360>, "sat": <0.0-1.0>, "light": <0.0-1.0>},
    {"hue": <0-360>, "sat": <0.0-1.0>, "light": <0.0-1.0>},
    {"hue": <0-360>, "sat": <0.0-1.0>, "light": <0.0-1.0>}
  ],
  "keywords": ["15-20 visual/emotional keywords extracted from lyrics, single words only, mix of original language and english"],
  "beatReactivity": <0.0-1.0 float, how much visuals should react to beat>,
  "distortionLevel": <0.0-1.0 float, how distorted/glitchy the visuals should be>
}

Choose colors that match the song's emotional atmosphere. Dark/moody songs get dark saturated colors, happy songs get bright warm colors, aggressive songs get high-contrast reds/blacks.`
        }],
      });

      const text = response.content[0].text.trim();
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[AI] No JSON in response');
        return DEFAULT_ANALYSIS;
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!analysis.palette || !analysis.keywords) {
        console.warn('[AI] Invalid analysis structure');
        return DEFAULT_ANALYSIS;
      }

      // Cache result
      writeFileSync(cachePath, JSON.stringify(analysis, null, 2));
      console.log(`[AI] Analyzed: ${trackName} → mood="${analysis.mood}", ${analysis.keywords.length} keywords`);

      return analysis;
    } catch (err) {
      console.warn(`[AI] Analysis failed for ${trackName}:`, err.message);
      return DEFAULT_ANALYSIS;
    }
  }
}
