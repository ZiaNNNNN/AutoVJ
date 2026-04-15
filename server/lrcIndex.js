import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

export class LrcIndex {
  constructor(musicDirs) {
    this.musicDirs = Array.isArray(musicDirs) ? musicDirs : [musicDirs];
    this.index = new Map(); // normalized name -> { path, content, originalName, coverPath }
  }

  scan() {
    this.index.clear();

    for (const dir of this.musicDirs) {
      try {
        this._scanDir(dir);
      } catch (err) {
        console.warn(`[LRC] Failed to scan ${dir}:`, err.message);
      }
    }

    const withCover = [...this.index.values()].filter(v => v.coverPath).length;
    console.log(`[LRC] Indexed ${this.index.size} lyric files (${withCover} with same-name covers)`);
    return this.index.size;
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
        const dirPath = dirname(fullPath);

        // Look for same-name cover image
        let coverPath = null;
        for (const ext of IMAGE_EXTS) {
          const candidate = join(dirPath, name + ext);
          if (existsSync(candidate)) {
            coverPath = candidate;
            break;
          }
        }

        this.index.set(this._normalize(name), {
          path: fullPath,
          content,
          originalName: name,
          coverPath,
        });
      }
    }
  }

  // Find lyrics for a track name (fuzzy match)
  findLyrics(trackName) {
    const entry = this._findEntry(trackName);
    return entry ? entry.content : null;
  }

  // Find same-name cover for a track name
  findCover(trackName) {
    const entry = this._findEntry(trackName);
    return entry ? entry.coverPath : null;
  }

  _findEntry(trackName) {
    if (!trackName) return null;

    const normalized = this._normalize(trackName);

    // Exact match
    if (this.index.has(normalized)) {
      return this.index.get(normalized);
    }

    // Substring match
    for (const [key, value] of this.index) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Artist - Title split match
    const parts = trackName.split(/\s*-\s*/);
    if (parts.length >= 2) {
      const title = this._normalize(parts.slice(1).join('-'));
      const artist = this._normalize(parts[0]);

      for (const [key, value] of this.index) {
        if (key.includes(title) || title.includes(key)) {
          return value;
        }
        if (key.includes(artist) && key.includes(title)) {
          return value;
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
