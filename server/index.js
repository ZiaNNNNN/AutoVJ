import 'dotenv/config';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join } from 'path';
import { homedir } from 'os';
import { SeratoWatcher } from './seratoWatcher.js';
import { LrcIndex } from './lrcIndex.js';
import { CoverFetcher } from './coverFetcher.js';
import { SongAnalyzer } from './songAnalyzer.js';

const PORT = 3456;
// Add your music folders here. External drives mount at /Volumes/DriveName/
const MUSIC_DIRS = [
  join(homedir(), 'Music/网易云音乐'),
  // '/Volumes/你的硬盘名/Library',  ← uncomment and rename
];

// Initialize components
const serato = new SeratoWatcher();
const lrcIndex = new LrcIndex(MUSIC_DIRS);
const coverFetcher = new CoverFetcher(MUSIC_DIRS);
const songAnalyzer = new SongAnalyzer();

// Scan LRC files and local covers
lrcIndex.scan();
await coverFetcher.scanLocalCovers();

// Express app for serving cover images
const app = express();

// CORS for frontend dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Serve local meta/ cover images
for (const dir of MUSIC_DIRS) {
  app.use('/meta', express.static(join(dir, 'meta')));
}

// Serve cached cover images
app.use('/covers', express.static(join(import.meta.dirname, '.cache', 'covers')));

// Serve same-name covers from music directories
for (const dir of MUSIC_DIRS) {
  app.use('/music-covers', express.static(dir));
}

// API: get current state
app.get('/api/state', (req, res) => {
  res.json({
    decks: serato.getCurrentDecks(),
    connected: !!serato.db,
  });
});

// API: rescan LRC files
app.post('/api/rescan', (req, res) => {
  const count = lrcIndex.scan();
  res.json({ count });
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
    if (ws.readyState === 1) { // OPEN
      ws.send(msg);
    }
  }
}

async function sendTrackInfo(ws, deck, info) {
  const trackName = info.name;
  const artist = info.artist;

  // Find lyrics
  const lrcContent = lrcIndex.findLyrics(trackName);

  // Fetch cover (async, will send update when ready)
  const searchTerms = [artist, trackName].filter(Boolean).join(' - ');
  // Parse artist from track name if not in artist field
  // Serato often stores "Artist - Title" in the name field
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

  // Send immediately with lyrics (cover will follow)
  const sendFn = ws ? (data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  } : broadcast;

  sendFn(msg);

  // Fetch cover: 1) same-name file → 2) NetEase local → 3) iTunes API
  let coverPath = lrcIndex.findCover(trackName); // same-name .jpg/.png
  if (!coverPath) {
    coverPath = await coverFetcher.fetchCover(searchArtist, searchTitle);
  }
  if (coverPath) {
    let coverUrl;
    if (coverPath.includes('/meta/')) {
      const filename = coverPath.split('/').pop();
      coverUrl = `http://localhost:${PORT}/meta/${filename}`;
    } else if (coverPath.includes('.cache')) {
      const filename = coverPath.split('/').pop();
      coverUrl = `http://localhost:${PORT}/covers/${filename}`;
    } else {
      // Same-name cover: serve from music dir
      coverUrl = `http://localhost:${PORT}/music-covers/${encodeURIComponent(coverPath.split('/').pop())}`;
    }
    sendFn({
      type: 'cover',
      deck,
      name: trackName,
      coverUrl,
    });
  }

  // AI mood analysis in background
  if (lrcContent) {
    const analysis = await songAnalyzer.analyze(trackName, lrcContent);
    sendFn({
      type: 'mood',
      deck,
      name: trackName,
      analysis,
    });
  }
}

// Handle Serato track changes
serato.onTrackChange = (deck, info) => {
  sendTrackInfo(null, deck, info);
};

serato.onPlayStateChange = (deck, playing) => {
  broadcast({
    type: 'playstate',
    deck,
    playing,
    // Send estimated position: now - start_time
    estimatedPosition: playing ? (Date.now() / 1000 - serato.currentDecks.get(deck)?.startTime || 0) : 0,
  });
};

serato.onTrackRemove = (deck) => {
  broadcast({ type: 'unload', deck });
};

// Start everything
server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket on ws://localhost:${PORT}`);

  const connected = serato.start();
  if (!connected) {
    console.warn('[Server] Serato not detected - will retry when available');
  }
});
