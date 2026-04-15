import { existsSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

const CACHE_DIR = join(import.meta.dirname, '.cache', 'covers');

export class CoverFetcher {
  constructor(musicDirs) {
    mkdirSync(CACHE_DIR, { recursive: true });
    this.musicDirs = Array.isArray(musicDirs) ? musicDirs : [musicDirs];
    this.pending = new Map();
    // Maps: normalized song name → local cover file path
    this.localCovers = new Map();
    // Maps: track ID → song info from NetEase API
    this.trackIdMap = new Map();
  }

  // Scan meta/ folders for track-{ID}.jpg files and resolve via NetEase API
  async scanLocalCovers() {
    const trackIds = [];

    for (const dir of this.musicDirs) {
      const metaDir = join(dir, 'meta');
      if (!existsSync(metaDir)) continue;

      try {
        const files = readdirSync(metaDir);
        for (const file of files) {
          const match = file.match(/^track-(\d+)\.jpg$/);
          if (match) {
            const id = match[1];
            trackIds.push({ id, path: join(metaDir, file) });
          }
        }
      } catch (err) {
        console.warn(`[Cover] Failed to scan ${metaDir}:`, err.message);
      }
    }

    if (trackIds.length === 0) {
      console.log('[Cover] No local cover art found in meta/ folders');
      return;
    }

    console.log(`[Cover] Found ${trackIds.length} local cover files, resolving track IDs...`);

    // Query NetEase API for song details in batches
    const ids = trackIds.map(t => t.id);
    try {
      const url = `https://music.163.com/api/song/detail?ids=[${ids.join(',')}]`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok) {
        console.warn(`[Cover] NetEase API error: ${res.status}`);
        return;
      }

      const data = await res.json();
      if (!data.songs) {
        console.warn('[Cover] NetEase API returned no songs');
        return;
      }

      // Build mapping
      for (const song of data.songs) {
        const id = String(song.id);
        const artists = song.artists?.map(a => a.name).join(',') || '';
        const name = song.name || '';
        const fullName = artists ? `${artists} - ${name}` : name;

        this.trackIdMap.set(id, { artists, name, fullName });

        // Find the local file for this ID
        const trackFile = trackIds.find(t => t.id === id);
        if (trackFile) {
          // Store under multiple normalized keys for matching
          this._storeLocalCover(fullName, trackFile.path);
          this._storeLocalCover(name, trackFile.path);
          if (artists) this._storeLocalCover(artists + name, trackFile.path);
        }
      }

      console.log(`[Cover] Mapped ${this.localCovers.size} covers to song names`);
    } catch (err) {
      console.warn('[Cover] Failed to resolve track IDs:', err.message);
    }
  }

  _storeLocalCover(name, path) {
    const normalized = this._normalize(name);
    if (normalized) {
      this.localCovers.set(normalized, path);
    }
  }

  // Find cover for a track - first check local, then try iTunes
  async fetchCover(artist, title) {
    // Try local cover first
    const localPath = this._findLocalCover(artist, title);
    if (localPath) {
      console.log(`[Cover] Local cover found for: ${artist} - ${title}`);
      return localPath;
    }

    // Fall back to iTunes API
    return this._fetchFromItunes(artist, title);
  }

  _findLocalCover(artist, title) {
    const searchTerms = [
      `${artist} - ${title}`,
      `${artist}${title}`,
      title,
      artist,
    ].filter(Boolean);

    for (const term of searchTerms) {
      const normalized = this._normalize(term);
      if (this.localCovers.has(normalized)) {
        return this.localCovers.get(normalized);
      }

      // Fuzzy: check if any key contains or is contained by the search
      for (const [key, path] of this.localCovers) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return path;
        }
      }
    }

    return null;
  }

  async _fetchFromItunes(artist, title) {
    const searchTerm = [artist, title].filter(Boolean).join(' ');
    if (!searchTerm.trim()) return null;

    const hash = createHash('md5').update(searchTerm).digest('hex');
    const cachedPath = join(CACHE_DIR, `${hash}.jpg`);

    if (existsSync(cachedPath)) return cachedPath;
    if (this.pending.has(hash)) return this.pending.get(hash);

    const promise = this._downloadFromItunes(searchTerm, cachedPath);
    this.pending.set(hash, promise);

    try {
      return await promise;
    } finally {
      this.pending.delete(hash);
    }
  }

  async _downloadFromItunes(searchTerm, savePath) {
    try {
      const encoded = encodeURIComponent(searchTerm);
      const url = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=1`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.results?.length) {
        console.log(`[Cover] iTunes: no results for "${searchTerm}"`);
        return null;
      }

      let artworkUrl = data.results[0].artworkUrl100;
      if (!artworkUrl) return null;

      artworkUrl = artworkUrl.replace('100x100bb', '600x600bb');

      const imgRes = await fetch(artworkUrl);
      if (!imgRes.ok) return null;

      const buffer = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(savePath, buffer);

      console.log(`[Cover] iTunes: saved for "${searchTerm}"`);
      return savePath;
    } catch (err) {
      console.warn(`[Cover] iTunes error: ${err.message}`);
      return null;
    }
  }

  _normalize(str) {
    return str
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()（）【】\[\]]/g, '')
      .replace(/[,，、.]/g, '')
      .trim();
  }
}
