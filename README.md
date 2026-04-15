# AutoVJ

Real-time audio-reactive visual engine for DJs. Automatically syncs with Serato DJ Pro, displays album artwork with beat-driven shader effects, and uses AI to create unique visual atmospheres for each song.

![AutoVJ Demo](docs/demo.gif)

## Features

- **Serato Auto-Sync** — Monitors Serato DJ Pro in real-time. Detects which track is playing on which deck, automatically loads matching cover art and lyrics.
- **Beat-Reactive Visuals** — 13 layered shader effects driven by kick/bass/beat energy. Effects include displacement, vortex, kaleidoscope, ripple, morph, ghost vision, cinematic pan, and more.
- **AI Song Atmosphere** — Claude API analyzes each song's lyrics to generate a unique color palette, energy level, and mood. Every song gets its own visual world.
- **Smart Cover Matching** — Matches by filename, NetEase track ID, or iTunes Search API.
- **DJ Controller Audio** — Captures audio directly from DDJ-FLX4 or similar controllers. Auto-gain normalization ensures consistent reactivity.
- **One-Click Launch** — Double-click `AutoVJ.app` or run `./start.sh`. Opens browser automatically.

## Quick Start

### 1. Install

```bash
git clone https://github.com/ZiaNNNNN/AutoVJ.git
cd AutoVJ
npm install
npm run build
```

### 2. Configure AI (optional)

```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
npm run analyze    # pre-analyze all songs
```

Without an API key, everything works — songs just use a default visual atmosphere.

### 3. Launch

**Double-click `AutoVJ.app`** — browser opens automatically.

Or from terminal:

```bash
./start.sh
```

Then:
1. Click **Start** (or first click **"Add Lyrics & Covers"** to load a folder from an external drive)
2. Play music in Serato DJ Pro
3. Visuals appear automatically on `http://localhost:3456`
4. Press `F` for fullscreen, drag to second screen

## Music Library

### Folder Structure

Put `.lrc` (lyrics) and `.jpg` (cover art) files in one folder with the **same name** as your MP3s:

```
lyrics_and_covers/
├── Juice WRLD - All Girls Are The Same.lrc
├── Juice WRLD - All Girls Are The Same.jpg
├── Bazzi - Focus.lrc
├── Bazzi - Focus.jpg
└── ...
```

MP3s can be anywhere — Serato reports the song name, AutoVJ finds matching lyrics and cover.

### Loading Your Library

**Pre-configured folder**: Add your path to `MUSIC_DIRS` in `server/index.js`. Scanned automatically on startup.

**External drive / other machine**: Click **"Add Lyrics & Covers"** on the start screen → select folder → click **Start**.

### NetEase Cloud Music

If your covers are `meta/track-{ID}.jpg`, rename them to match song names:

```bash
node scripts/organize-library.js ~/Music/网易云音乐
```

### Cover Matching Priority

1. Browser local (loaded via folder picker)
2. Same-name file on server (`Song.jpg` next to `Song.lrc`)
3. NetEase `meta/track-{ID}.jpg` (resolved via API)
4. iTunes Search API (auto-downloaded)

## Audio Setup

AutoVJ auto-detects your DJ controller (DDJ-FLX4, etc.) as the audio input. If no controller is found, it falls back to BlackHole or the default microphone.

**BlackHole setup** (if no controller audio input):

1. `brew install blackhole-2ch` (reboot)
2. Audio MIDI Setup → Multi-Output Device (BlackHole + Speakers)
3. Drift Correction on BlackHole only
4. System output → Multi-Output Device

## Controls

| Key | Function |
|-----|----------|
| `1` | Cover Art mode (default) |
| `2` | Word Cloud mode |
| `Space` | Cycle modes |
| `F` | Fullscreen |
| `` ` `` | Debug panel |
| `+` / `-` | Effect intensity |
| `←` / `→` | Amplitude (shake/pulse strength) |
| `<` / `>` | Reactivity (beat trigger sensitivity) |
| `D` | Switch active deck |
| `L` | Toggle lyrics overlay |

## AI Mood Analysis

Each song's lyrics are analyzed once and cached:

```json
{
  "mood": "melancholic-aggressive",
  "energy": 0.7,
  "palette": [
    { "hue": 280, "sat": 0.8, "light": 0.3 },
    { "hue": 340, "sat": 0.9, "light": 0.4 }
  ],
  "keywords": ["brain", "love", "insane", "devil"],
  "beatReactivity": 0.8,
  "distortionLevel": 0.6
}
```

Pre-analyze your library: `npm run analyze`

## Shader Effects

13 effects layer up to 3 simultaneously:

| Effect | Style | Frequency |
|--------|-------|-----------|
| Displace | Organic noise warp | Common |
| Drift | Cinematic zoom | Common |
| Vortex | Spiral swirl | Occasional |
| Kaleidoscope | Mirror symmetry | Occasional |
| Ripple | Water surface | Common |
| Scan | Horizontal displacement | Common |
| Morph | Elastic deformation | Common |
| Fragment | Smooth shatter | Occasional |
| Ghost | Double vision | Common |
| Pan | Ken Burns motion | Common |
| Radial Blur | Center pulse | Common |
| Prism | RGB split | Common |
| Breathe | Slow zoom | Very common |

Plus always-on: film grain, CRT scanlines, vignette, chromatic aberration, bass zoom punch, kick shake.

## Project Structure

```
AutoVJ/
├── AutoVJ.app/              # Double-click to launch
├── start.sh                 # Terminal launcher
├── dist/                    # Built frontend (auto-generated)
├── server/
│   ├── index.js             # Express + WebSocket + static serving
│   ├── seratoWatcher.js     # Serato database monitor
│   ├── lrcIndex.js          # LRC + cover scanner
│   ├── coverFetcher.js      # Cover fetcher (NetEase + iTunes)
│   ├── songAnalyzer.js      # Claude API mood analyzer
│   └── preanalyze.js        # Batch analysis script
├── src/
│   ├── main.js              # App entry + controls
│   ├── audio/               # Audio capture + FFT + beat detection
│   ├── visuals/             # Cover art shader + word particles
│   ├── lyrics/              # LRC parser + mood interpolation
│   ├── tracks/              # Serato sync + track management
│   └── ui/                  # Overlay + track panel
├── scripts/
│   ├── organize-library.js  # Rename NetEase covers
│   └── record-demo.sh       # Screen → GIF recorder
└── .env                     # ANTHROPIC_API_KEY
```

## Tech Stack

Three.js · GLSL Shaders · Web Audio API · Node.js · Express · WebSocket · SQLite · Anthropic Claude API

## License

MIT
