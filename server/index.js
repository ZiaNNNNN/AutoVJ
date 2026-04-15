import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { SeratoWatcher } from './seratoWatcher.js';
import { LrcIndex } from './lrcIndex.js';
import { CoverFetcher } from './coverFetcher.js';
import { SongAnalyzer } from './songAnalyzer.js';
import { MidiListener } from './midiListener.js';

const PORT = 3456;

// Default music folders (add more paths here if needed)
const MUSIC_DIRS = [
  join(homedir(), 'Desktop/dj/lyrics_and_covers'),
  join(homedir(), 'Music/网易云音乐'),
].filter(d => existsSync(d));

console.log(`[Config] Music folders: ${MUSIC_DIRS.join(', ')}`);

// Initialize components
const serato = new SeratoWatcher();
const lrcIndex = new LrcIndex(MUSIC_DIRS);
const coverFetcher = new CoverFetcher(MUSIC_DIRS);
const songAnalyzer = new SongAnalyzer();

// Scan LRC files and local covers
lrcIndex.scan();
await coverFetcher.scanLocalCovers();

// Express app
const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Serve frontend static files (built with `npm run build`)
const distDir = join(import.meta.dirname, '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  console.log('[Server] Serving frontend from dist/');
}

// Serve local meta/ cover images
for (const dir of MUSIC_DIRS) {
  app.use('/meta', express.static(join(dir, 'meta')));
}

// Serve cached cover images (iTunes downloads)
app.use('/covers', express.static(join(import.meta.dirname, '.cache', 'covers')));

// Serve cover files by numeric ID (handles all path/encoding edge cases)
const coverRegistry = new Map();
let coverIdCounter = 0;

function registerCover(filePath) {
  for (const [id, path] of coverRegistry) {
    if (path === filePath) return id;
  }
  const id = ++coverIdCounter;
  coverRegistry.set(id, filePath);
  return id;
}

app.get('/cover/:id', (req, res) => {
  const filePath = coverRegistry.get(Number(req.params.id));
  if (filePath) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('not found');
  }
});

// API: get current state
app.get('/api/state', (req, res) => {
  res.json({
    decks: serato.getCurrentDecks(),
    connected: !!serato.db,
  });
});

// API: rescan LRC files + re-broadcast current decks
app.post('/api/rescan', async (req, res) => {
  const count = lrcIndex.scan();
  const decks = serato.getCurrentDecks();
  for (const [deck, info] of Object.entries(decks)) {
    sendTrackInfo(null, deck, info);
  }
  res.json({ count });
});

// API: list current folders
app.get('/api/folders', (req, res) => {
  res.json({ folders: [...lrcIndex.musicDirs] });
});

const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);

  // Send current state on connect
  const decks = serato.getCurrentDecks();
  for (const [deck, info] of Object.entries(decks)) {
    sendTrackInfo(ws, deck, info);
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (${clients.size} total)`);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

async function sendTrackInfo(ws, deck, info) {
  const trackName = info.name;
  const artist = info.artist;

  // Find lyrics
  const lrcContent = lrcIndex.findLyrics(trackName);

  // Parse artist from track name if not in artist field
  let searchArtist = artist;
  let searchTitle = trackName;
  const dashSplit = trackName.split(/\s*-\s*/);
  if (!artist && dashSplit.length >= 2) {
    searchArtist = dashSplit[0].trim();
    searchTitle = dashSplit.slice(1).join('-').trim();
  }

  const msg = {
    type: 'track',
    deck,
    name: trackName,
    artist: searchArtist,
    title: searchTitle,
    bpm: info.bpm,
    startTime: info.startTime,
    playing: info.played,
    lyrics: lrcContent || null,
    coverUrl: null,
  };

  const sendFn = ws ? (data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  } : broadcast;

  sendFn(msg);

  // Fetch cover: same-name file → NetEase local → iTunes API
  let coverPath = lrcIndex.findCover(trackName);
  if (!coverPath) {
    coverPath = await coverFetcher.fetchCover(searchArtist, searchTitle);
  }
  if (coverPath) {
    const coverId = registerCover(coverPath);
    const coverUrl = `http://localhost:${PORT}/cover/${coverId}`;
    console.log(`[Cover] Sending: ${coverPath.split('/').pop()}`);
    sendFn({ type: 'cover', deck, name: trackName, coverUrl });
  }

  // AI mood analysis
  if (lrcContent) {
    const analysis = await songAnalyzer.analyze(trackName, lrcContent);
    sendFn({ type: 'mood', deck, name: trackName, analysis });
  }
}

// Handle Serato events
serato.onTrackChange = (deck, info) => {
  sendTrackInfo(null, deck, info);
};

serato.onPlayStateChange = (deck, playing) => {
  broadcast({
    type: 'playstate',
    deck,
    playing,
    estimatedPosition: playing ? (Date.now() / 1000 - serato.currentDecks.get(deck)?.startTime || 0) : 0,
  });
};

serato.onTrackRemove = (deck) => {
  broadcast({ type: 'unload', deck });
};

// MIDI listener for fader positions
const midi = new MidiListener();
midi.onDeckSwitch = (dominantDeck) => {
  broadcast({ type: 'deck-switch', deck: dominantDeck });
};

// Start
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket on ws://localhost:${PORT}`);

  const connected = serato.start();
  if (!connected) {
    console.warn('[Server] Serato not detected - will retry when available');
  }

  midi.start();
});
