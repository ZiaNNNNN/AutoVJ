import { parseLRC } from '../lyrics/parser.js';

const WS_URL = 'ws://localhost:3456';
const RECONNECT_DELAY = 3000;

export class SeratoSync {
  constructor() {
    this.ws = null;
    this.connected = false;

    // Deck state
    this.decks = new Map(); // deck -> { name, artist, title, lyrics, coverUrl, playing, startTime, bpm }
    this.activeDeck = null; // which deck controls lyrics/cover

    // Callbacks
    this.onTrackChange = null;      // (trackInfo) - active deck changed track
    this.onCoverReady = null;       // (coverUrl)
    this.onConnectionChange = null; // (connected)
    this.onPlayStateChange = null;  // (deck, playing) - for lyrics start/pause
    this.onActiveDeckSwitch = null; // (deck, trackInfo) - when active deck switches
    this.onMoodReady = null;        // (analysis) - AI mood analysis received
  }

  connect() {
    this._attemptConnect();
  }

  _attemptConnect() {
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[SeratoSync] Connected');
      this.onConnectionChange?.(true);
    };

    this.ws.onmessage = (event) => {
      try {
        this._handleMessage(JSON.parse(event.data));
      } catch (err) {
        console.warn('[SeratoSync] Bad message:', err);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.onConnectionChange?.(false);
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {};
  }

  _scheduleReconnect() {
    setTimeout(() => this._attemptConnect(), RECONNECT_DELAY);
  }

  _handleMessage(data) {
    switch (data.type) {
      case 'track': {
        const lyrics = data.lyrics ? parseLRC(data.lyrics) : [];
        const trackInfo = {
          deck: data.deck,
          name: data.name,
          artist: data.artist,
          title: data.title,
          bpm: data.bpm,
          playing: data.playing,
          startTime: data.startTime,
          lyrics,
          coverUrl: data.coverUrl,
        };

        this.decks.set(data.deck, trackInfo);

        // Priority logic: auto-switch to this deck if it's playing,
        // or if no deck is currently active
        if (data.playing || !this.activeDeck) {
          this._setActiveDeck(data.deck);
        }

        console.log(`[SeratoSync] Deck ${data.deck}: ${data.name} (${data.playing ? 'playing' : 'loaded'})`);
        break;
      }

      case 'playstate': {
        const existing = this.decks.get(data.deck);
        if (existing) {
          existing.playing = data.playing;
        }

        // When a deck starts playing, switch lyrics to it
        if (data.playing) {
          this._setActiveDeck(data.deck);
          this.onPlayStateChange?.(data.deck, true, data.estimatedPosition);
        } else {
          this.onPlayStateChange?.(data.deck, false, 0);
        }

        console.log(`[SeratoSync] Deck ${data.deck}: ${data.playing ? 'PLAY' : 'PAUSE'}`);
        break;
      }

      case 'cover': {
        const existing = this.decks.get(data.deck);
        if (existing) {
          existing.coverUrl = data.coverUrl;
        }
        if (data.deck === this.activeDeck) {
          this.onCoverReady?.(data.coverUrl);
        }
        break;
      }

      case 'mood': {
        if (data.deck === this.activeDeck && data.analysis) {
          console.log(`[SeratoSync] Mood: ${data.analysis.mood}, ${data.analysis.keywords?.length} keywords`);
          this.onMoodReady?.(data.analysis);
        }
        break;
      }

      case 'unload': {
        this.decks.delete(data.deck);
        // If the active deck was unloaded, switch to another
        if (data.deck === this.activeDeck) {
          const remaining = this._findPlayingDeck() || this._findAnyDeck();
          if (remaining) {
            this._setActiveDeck(remaining);
          } else {
            this.activeDeck = null;
          }
        }
        break;
      }
    }
  }

  _setActiveDeck(deck) {
    if (deck === this.activeDeck) return;

    this.activeDeck = deck;
    const info = this.decks.get(deck);
    if (info) {
      this.onTrackChange?.(info);
      if (info.coverUrl) {
        this.onCoverReady?.(info.coverUrl);
      }
      this.onActiveDeckSwitch?.(deck, info);
    }
  }

  _findPlayingDeck() {
    for (const [deck, info] of this.decks) {
      if (info.playing) return deck;
    }
    return null;
  }

  _findAnyDeck() {
    for (const [deck] of this.decks) return deck;
    return null;
  }

  // Manual switch to a specific deck
  setActiveDeck(deck) {
    if (this.decks.has(deck)) {
      this._setActiveDeck(deck);
    }
  }

  // Toggle between deck 1 and 2
  toggleActiveDeck() {
    const decks = [...this.decks.keys()];
    if (decks.length < 2) return;
    const current = this.activeDeck;
    const next = decks.find(d => d !== current) || decks[0];
    this._setActiveDeck(next);
    return next;
  }
}
