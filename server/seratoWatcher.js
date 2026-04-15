import Database from 'better-sqlite3';
import { statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SERATO_DB_PATH = join(homedir(), 'Library/Application Support/Serato/Library/master.sqlite');
const WAL_PATH = SERATO_DB_PATH + '-wal';
const POLL_INTERVAL = 300; // ms - faster polling for Pro

export class SeratoWatcher {
  constructor() {
    this.db = null;
    this.currentDecks = new Map(); // deck -> { name, artist, startTime, played, bpm }
    this.lastWalMtime = 0;
    this.pollTimer = null;
    this.onTrackChange = null;  // (deck, trackInfo) - new track loaded
    this.onTrackRemove = null;  // (deck) - track unloaded
    this.onPlayStateChange = null; // (deck, playing) - play/pause toggle
  }

  start() {
    try {
      this.db = new Database(SERATO_DB_PATH, { readonly: true });
      console.log('[Serato] Connected to database');
      this._checkForChanges();
      this.pollTimer = setInterval(() => this._pollWal(), POLL_INTERVAL);
      return true;
    } catch (err) {
      console.error('[Serato] Failed to connect:', err.message);
      return false;
    }
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.db) this.db.close();
  }

  _pollWal() {
    try {
      const stat = statSync(WAL_PATH);
      const mtime = stat.mtimeMs;
      if (mtime !== this.lastWalMtime) {
        this.lastWalMtime = mtime;
        this._checkForChanges();
      }
    } catch {
      this._checkForChanges();
    }
  }

  _checkForChanges() {
    try {
      if (this.db) this.db.close();
      this.db = new Database(SERATO_DB_PATH, { readonly: true });

      const rows = this.db.prepare(`
        SELECT deck, name, artist, start_time, end_time, played, bpm, length_ms
        FROM history_entry
        WHERE session_id = (SELECT MAX(id) FROM history_session)
        AND end_time = -1
        ORDER BY start_time DESC
      `).all();

      const newDecks = new Map();
      for (const row of rows) {
        newDecks.set(row.deck, {
          name: row.name || '',
          artist: row.artist || '',
          startTime: row.start_time,
          played: row.played === 1,
          bpm: row.bpm || 0,
          lengthMs: row.length_ms || 0,
        });
      }

      // Detect new tracks and play state changes
      for (const [deck, info] of newDecks) {
        const prev = this.currentDecks.get(deck);

        if (!prev || prev.name !== info.name || prev.startTime !== info.startTime) {
          // New track loaded
          console.log(`[Serato] Deck ${deck}: ${info.name} (${info.played ? 'playing' : 'loaded'})`);
          this.onTrackChange?.(deck, info);
        } else if (prev.played !== info.played) {
          // Play state changed (play/pause)
          console.log(`[Serato] Deck ${deck}: ${info.played ? 'PLAY' : 'PAUSE'}`);
          this.onPlayStateChange?.(deck, info.played);
        }
      }

      // Detect removals
      for (const deck of this.currentDecks.keys()) {
        if (!newDecks.has(deck)) {
          console.log(`[Serato] Deck ${deck}: unloaded`);
          this.onTrackRemove?.(deck);
        }
      }

      this.currentDecks = newDecks;
    } catch {
      // Database might be locked, skip
    }
  }

  // Get the currently playing deck (played=1), or most recent
  getActiveDeck() {
    for (const [deck, info] of this.currentDecks) {
      if (info.played) return deck;
    }
    // If nothing is playing, return most recently loaded
    let latest = null;
    let latestTime = 0;
    for (const [deck, info] of this.currentDecks) {
      if (info.startTime > latestTime) {
        latestTime = info.startTime;
        latest = deck;
      }
    }
    return latest;
  }

  getCurrentDecks() {
    return Object.fromEntries(this.currentDecks);
  }
}
