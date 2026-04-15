import * as THREE from 'three';
import { AudioCapture } from './audio/capture.js';
import { AudioAnalyzer } from './audio/analyzer.js';
import { DemoAnalyzer } from './audio/demoAnalyzer.js';
import { VisualManager } from './visuals/manager.js';
import { LyricsRenderer } from './lyrics/renderer.js';
import { TrackManager } from './tracks/manager.js';
import { SeratoSync } from './tracks/seratoSync.js';
import { SongMood } from './lyrics/songMood.js';
import { Overlay } from './ui/overlay.js';
import { TrackPanel } from './ui/trackPanel.js';

let capture, analyzer, manager, overlay, renderer;
let lyricsRenderer, trackManager, trackPanel, seratoSync, songMood;
let debugHud = null;
let startTime = 0;
let isDemo = false;

async function init() {
  document.getElementById('start-screen').style.display = 'none';

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  renderer.domElement.style.background = '#000';
  document.body.appendChild(renderer.domElement);

  // Audio capture
  try {
    capture = new AudioCapture();
    const analyserNode = await capture.start();
    analyzer = new AudioAnalyzer(analyserNode);
  } catch (err) {
    console.warn('Audio capture unavailable, using demo mode:', err.message);
    analyzer = new DemoAnalyzer();
    isDemo = true;
  }

  // Visual manager
  manager = new VisualManager(renderer);

  // Lyrics renderer (hidden by default, L to toggle)
  lyricsRenderer = new LyricsRenderer();
  lyricsRenderer.toggleVisibility(); // start hidden

  // Song mood (AI-driven visual parameters)
  songMood = new SongMood();

  // Track manager (for manual file loading)
  trackManager = new TrackManager();
  trackManager.onTrackChange = onManualTrackChange;

  // Serato sync (auto track detection)
  seratoSync = new SeratoSync();
  seratoSync.onTrackChange = onSeratoTrackChange;
  seratoSync.onCoverReady = (coverUrl) => {
    // Only apply cover if the active deck is actually playing
    const activeDeckInfo = seratoSync.decks.get(seratoSync.activeDeck);
    if (activeDeckInfo && activeDeckInfo.playing) {
      manager.setCoverImage(coverUrl);
    }
  };
  seratoSync.onConnectionChange = (connected) => {
    // Silent connection status
  };
  seratoSync.onPlayStateChange = (deck, playing, estimatedPosition) => {
    if (playing && deck === seratoSync.activeDeck) {
      // Track started playing on active deck → NOW switch cover + start lyrics
      const info = seratoSync.decks.get(deck);
      if (info) {
        if (info.coverUrl) manager.setCoverImage(info.coverUrl);
        lyricsRenderer.setLyrics(info.lyrics);
        lyricsRenderer.start();
        if (estimatedPosition > 0) {
          lyricsRenderer.adjustOffset(estimatedPosition);
        }
      }
    }
  };
  seratoSync.onActiveDeckSwitch = (deck, info) => {
    // Active deck switched (e.g. crossfade) → transition to new cover
    if (info && info.playing && info.coverUrl) {
      manager.setCoverImage(info.coverUrl);
      lyricsRenderer.setLyrics(info.lyrics);
      lyricsRenderer.start();
    }
  };
  seratoSync.onMoodReady = (analysis) => {
    songMood.setMood(analysis);
    manager.setKeywords(analysis.keywords || []);
    // Silent mood update
  };
  seratoSync.connect();

  // Expose for debugging
  window.__autovj = { lyricsRenderer, trackManager, manager, seratoSync };

  // Track panel UI
  trackPanel = new TrackPanel();
  trackPanel.onFileSelect = async (files) => {
    const count = await trackManager.loadFromFiles(files);
    trackPanel.updateTrackList(trackManager.tracks, trackManager.currentIndex);
    overlay.showMessage(`Loaded ${count} tracks`);
  };
  trackPanel.onTrackClick = (index) => {
    trackManager.select(index);
    trackPanel.setActiveTrack(index);
  };

  // Overlay UI
  overlay = new Overlay();
  overlay.setMode(manager.currentName, manager.currentIndex);
  if (isDemo) overlay.showMessage('DEMO MODE - no audio input');

  manager.onModeChange = (name, index) => overlay.setMode(name, index);

  // Event listeners
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);

  startTime = performance.now() / 1000;
  animate();
}

// Called when Serato detects a new track loaded on the ACTIVE deck
// This fires on load - we prepare lyrics but DON'T switch cover yet
function onSeratoTrackChange(trackInfo) {
  // Only prepare lyrics (lightweight, no visual change)
  lyricsRenderer.setLyrics(trackInfo.lyrics);
  // Don't start lyrics or switch cover here - wait for playback
}

// Called when user manually selects a track from the panel
function onManualTrackChange(track, index) {
  lyricsRenderer.setLyrics(track.lyrics);
  lyricsRenderer.stop();
  manager.setCoverImage(track.coverUrl);
  overlay.showMessage(track.name);
  trackPanel.setActiveTrack(index);
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now() / 1000 - startTime;

  analyzer.update(time);

  // Update AI mood interpolation + pass to visuals
  songMood.update();
  manager.setMoodParams(songMood);

  manager.update(analyzer, time);
  manager.render();

  lyricsRenderer.update(analyzer);

  overlay.updateBeat(analyzer.isBeat);
  overlay.updateFps();

  // Debug HUD (toggle with ` key)
  if (debugHud) {
    const ca = manager.coverArt;
    const L = ca.layers;
    const effectNames = ['displace','drift','vortex','kaleido','ripple','scan','morph','fragment','ghost','pan','radBlur','prism','breathe'];
    const gain = analyzer._peakLevel ? (1 / analyzer._peakLevel).toFixed(1) : 'demo';
    const sens = analyzer.sensitivity?.toFixed(1) || '1.0';
    const react = analyzer.reactivity?.toFixed(1) || '1.0';
    const src = isDemo ? 'DEMO' : (capture?.deviceName || '?');
    const ctx = capture?.audioContext?.state || 'demo';
    debugHud.textContent =
      `src: ${src}  ctx: ${ctx}\n` +
      `mix[+/-]: ${(ca.effectMix * 100).toFixed(0)}%  amp[←→]: ${sens}x  freq[<>]: ${react}x  gain: ${gain}x\n` +
      `bass: ${analyzer.bass.toFixed(2)}  kick: ${(analyzer.kick||0).toFixed(2)}  beat: ${analyzer.beatIntensity.toFixed(2)}  raw: ${(analyzer._rawBass||0).toFixed(3)}\n` +
      `L0: ${effectNames[L[0].effectId]||'?'} ${L[0].intensity.toFixed(3)}  ` +
      `L1: ${effectNames[L[1].effectId]||'?'} ${L[1].intensity.toFixed(3)}  ` +
      `L2: ${effectNames[L[2].effectId]||'?'} ${L[2].intensity.toFixed(3)}` +
      (ca.transitioning ? `  TRANSITION ${(ca.transition*100).toFixed(0)}%` : '');
  }
}

function onKeyDown(e) {
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      manager.next();
      break;
    case 'Digit1': manager.select(0); break; // Cover Art
    case 'Digit2': manager.select(1); break; // Word Cloud
    case 'KeyF':
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      break;

    // Deck toggle
    case 'KeyD': {
      const newDeck = seratoSync.toggleActiveDeck();
      if (newDeck) overlay.showMessage(`Switched to Deck ${newDeck}`);
      break;
    }

    // Track / Lyrics controls
    case 'Tab':
      e.preventDefault();
      trackPanel.toggle();
      break;
    case 'Enter':
      e.preventDefault();
      lyricsRenderer.restart();
      overlay.showMessage('Lyrics started');
      break;
    case 'BracketLeft':
      lyricsRenderer.adjustOffset(-5);
      overlay.showMessage('Lyrics -5s');
      break;
    case 'BracketRight':
      lyricsRenderer.adjustOffset(5);
      overlay.showMessage('Lyrics +5s');
      break;
    case 'ArrowUp':
      e.preventDefault();
      trackManager.prev(); // manual track switch (if using file loader)
      break;
    case 'ArrowDown':
      e.preventDefault();
      trackManager.next();
      break;
    case 'Equal': // + key: effect mix
      manager.coverArt.adjustEffectMix(0.1);
      break;
    case 'Minus': // - key: effect mix
      manager.coverArt.adjustEffectMix(-0.1);
      break;
    case 'ArrowRight': // →: sensitivity (amplitude) up
      e.preventDefault();
      analyzer.sensitivity = Math.min(3.0, analyzer.sensitivity + 0.2);
      break;
    case 'ArrowLeft': // ←: sensitivity (amplitude) down
      e.preventDefault();
      analyzer.sensitivity = Math.max(0.2, analyzer.sensitivity - 0.2);
      break;
    case 'Period': // >: reactivity (frequency) up
      analyzer.reactivity = Math.min(2.0, analyzer.reactivity + 0.2);
      break;
    case 'Comma': // <: reactivity (frequency) down
      analyzer.reactivity = Math.max(0.2, analyzer.reactivity - 0.2);
      break;
    case 'Backquote': // ` key - toggle debug HUD
      if (debugHud) {
        debugHud.remove();
        debugHud = null;
      } else {
        debugHud = document.createElement('pre');
        Object.assign(debugHud.style, {
          position: 'fixed', bottom: '10px', left: '10px',
          color: '#0f0', fontSize: '12px', fontFamily: 'monospace',
          background: 'rgba(0,0,0,0.7)', padding: '8px 12px',
          borderRadius: '4px', zIndex: '999', pointerEvents: 'none',
        });
        document.body.appendChild(debugHud);
      }
      break;
    case 'KeyL':
      lyricsRenderer.toggleVisibility();
      break;
  }
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  manager.resize(w, h);
}

document.getElementById('start-btn').addEventListener('click', init);

// Folder picker: uses webkitdirectory to get the folder path
document.getElementById('folder-btn').addEventListener('click', async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true;
  input.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    // Extract the folder path from the first file's webkitRelativePath
    const firstPath = files[0].webkitRelativePath;
    const folderName = firstPath.split('/')[0];

    const statusEl = document.getElementById('folder-status');
    statusEl.textContent = `Scanning ${folderName}...`;

    try {
      // Send the folder path to the backend
      // The backend needs the absolute path, but the browser only gives relative paths.
      // We'll send the files directly to the backend to process.
      const formData = new FormData();
      for (const file of files) {
        if (/\.(lrc|jpg|jpeg|png|webp)$/i.test(file.name)) {
          formData.append('files', file, file.webkitRelativePath);
        }
      }

      const res = await fetch('http://localhost:3456/api/upload-folder', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      statusEl.textContent = `Loaded ${data.count} tracks from ${folderName}`;
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
    }
  });
  input.click();
});
