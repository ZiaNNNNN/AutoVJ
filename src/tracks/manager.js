import { parseLRC } from '../lyrics/parser.js';

// Represents a track with its lyrics and cover art
class Track {
  constructor(name, lrcContent, coverBlob) {
    this.name = name; // display name (e.g. "Juice WRLD - All Girls Are The Same")
    this.lyrics = lrcContent ? parseLRC(lrcContent) : [];
    this.coverUrl = coverBlob ? URL.createObjectURL(coverBlob) : null;
    this.coverBlob = coverBlob;
  }

  dispose() {
    if (this.coverUrl) {
      URL.revokeObjectURL(this.coverUrl);
      this.coverUrl = null;
    }
  }
}

export class TrackManager {
  constructor() {
    this.tracks = [];
    this.currentIndex = -1;
    this.onTrackChange = null; // callback(track, index)
  }

  get currentTrack() {
    return this.currentIndex >= 0 ? this.tracks[this.currentIndex] : null;
  }

  // Load files from a folder selection (via webkitdirectory)
  async loadFromFiles(fileList) {
    const fileMap = new Map(); // baseName -> { lrc, cover, name }

    for (const file of fileList) {
      const path = file.webkitRelativePath || file.name;
      const name = file.name;

      if (name.endsWith('.lrc')) {
        const baseName = name.replace(/\.lrc$/, '');
        if (!fileMap.has(baseName)) fileMap.set(baseName, {});
        const text = await file.text();
        fileMap.get(baseName).lrc = text;
        fileMap.get(baseName).name = baseName;
      }

      if (/\.(jpg|jpeg|png|webp)$/i.test(name)) {
        // Cover images can be in meta/ folder or same level
        // Try to match by parent folder structure
        // NetEase format: meta/track-{ID}.jpg - harder to match
        // Same level: "Artist - Title.jpg" - easy to match
        const baseName = name.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        if (!fileMap.has(baseName)) fileMap.set(baseName, {});
        fileMap.get(baseName).cover = file;
        if (!fileMap.get(baseName).name) fileMap.get(baseName).name = baseName;
      }
    }

    // Build tracks from matched files
    const newTracks = [];
    for (const [baseName, data] of fileMap) {
      if (data.lrc) {
        // Only create tracks that have lyrics
        newTracks.push(new Track(
          data.name || baseName,
          data.lrc,
          data.cover || null,
        ));
      }
    }

    // Sort alphabetically
    newTracks.sort((a, b) => a.name.localeCompare(b.name));

    // Dispose old tracks
    this.tracks.forEach((t) => t.dispose());
    this.tracks = newTracks;
    this.currentIndex = newTracks.length > 0 ? 0 : -1;

    if (this.currentTrack) {
      this.onTrackChange?.(this.currentTrack, this.currentIndex);
    }

    return newTracks.length;
  }

  // Load a single LRC file
  async loadSingleLRC(file) {
    const text = await file.text();
    const baseName = file.name.replace(/\.lrc$/, '');
    const track = new Track(baseName, text, null);
    this.tracks.push(track);
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
      this.onTrackChange?.(this.currentTrack, 0);
    }
    return track;
  }

  select(index) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentIndex = index;
      this.onTrackChange?.(this.currentTrack, this.currentIndex);
    }
  }

  next() {
    if (this.tracks.length === 0) return;
    this.select((this.currentIndex + 1) % this.tracks.length);
  }

  prev() {
    if (this.tracks.length === 0) return;
    this.select((this.currentIndex - 1 + this.tracks.length) % this.tracks.length);
  }
}
