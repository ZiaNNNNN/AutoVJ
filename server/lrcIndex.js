import { readdirSync, readFileSync } from 'fs';
import { join, extname, basename } from 'path';

export class LrcIndex {
  constructor(musicDirs) {
    this.musicDirs = Array.isArray(musicDirs) ? musicDirs : [musicDirs];
    this.index = new Map(); // normalized name -> { path, content }
  }

  scan() {
    this.index.clear();
    let count = 0;

    for (const dir of this.musicDirs) {
      try {
        this._scanDir(dir);
      } catch (err) {
        console.warn(`[LRC] Failed to scan ${dir}:`, err.message);
      }
    }

    count = this.index.size;
    console.log(`[LRC] Indexed ${count} lyric files`);
    return count;
  }

  _scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        this._scanDir(fullPath);
      } else if (extname(entry.name).toLowerCase() === '.lrc') {
        const name = basename(entry.name, '.lrc');
        const content = readFileSync(fullPath, 'utf-8');
        // Store under multiple keys for fuzzy matching
        this.index.set(this._normalize(name), { path: fullPath, content, originalName: name });
      }
    }
  }

  // Find lyrics for a track name (fuzzy match)
  findLyrics(trackName) {
    if (!trackName) return null;

    const normalized = this._normalize(trackName);

    // Exact match
    if (this.index.has(normalized)) {
      return this.index.get(normalized).content;
    }

    // Try matching by contained substring
    for (const [key, value] of this.index) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value.content;
      }
    }

    // Try matching individual parts (artist - title format)
    // Serato stores as "Artist1,Artist2 - Title"
    const parts = trackName.split(/\s*-\s*/);
    if (parts.length >= 2) {
      const title = this._normalize(parts.slice(1).join('-'));
      const artist = this._normalize(parts[0]);

      for (const [key, value] of this.index) {
        // Match by title part
        if (key.includes(title) || title.includes(key)) {
          return value.content;
        }
        // Match by artist + title
        if (key.includes(artist) && key.includes(title)) {
          return value.content;
        }
      }
    }

    return null;
  }

  _normalize(str) {
    return str
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()（）【】\[\]]/g, '')
      .replace(/[,，、]/g, '')
      .trim();
  }
}
