# AutoVJ

Real-time audio-reactive visual engine for DJs. Automatically syncs with Serato DJ Pro, displays album artwork with beat-driven shader effects, and uses AI to create unique visual atmospheres for each song.

![AutoVJ Demo](docs/demo.gif)

> **Record your own demo**: Start DJing with AutoVJ, then run `./scripts/record-demo.sh` (requires ffmpeg: `brew install ffmpeg`)

## What It Does

- **Serato Auto-Sync**: Monitors Serato DJ Pro's database in real-time. Detects which track is playing on which deck, automatically loads matching cover art and lyrics.
- **Beat-Reactive Visuals**: Album artwork comes alive with 13 different shader effects (displacement, vortex, kaleidoscope, ripple, morph, etc.) that layer and blend based on kick/bass/beat energy.
- **AI Song Atmosphere**: Claude API analyzes each song's lyrics to generate a unique color palette, energy level, and visual mood. Dark songs get dark visuals, party songs get vibrant colors.
- **Smart Cover Matching**: Matches covers by filename first, then NetEase track ID, then iTunes Search API as fallback.
- **DJ-Friendly**: No manual sync needed. Transitions happen when tracks actually start playing (not when loaded). Dual-deck priority follows whichever deck is live.

## Architecture

```
Serato DJ Pro ──> master.sqlite ──> Node.js Server (port 3456)
                                         |
DJ Controller ──> Browser Audio Capture  |──> WebSocket ──> Browser (port 5173)
                                         |
                                    Claude API ──> Song mood analysis
                                    Lyrics & Covers folder ──> LRC + JPG matching
```

## Quick Start

### Prerequisites

- **Node.js 20+** (`brew install node@22`)
- **Serato DJ Pro** (for automatic track detection)
- A DJ controller with audio output (e.g., DDJ-FLX4)

### Install

```bash
git clone https://github.com/ZiaNNNNN/AutoVJ.git
cd AutoVJ
npm install
```

### Configure AI (optional but recommended)

```bash
# Claude API key for AI mood analysis
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env

# Pre-analyze all songs in your library (avoids 2-3s delay on first play)
npm run analyze
```

Without an API key, AutoVJ still works - all songs use a default visual atmosphere.

### Run

```bash
./start.sh
```

Open `http://localhost:5173` in Chrome, click **Start**, and begin DJing.

## Music Library Setup

### Folder Structure

AutoVJ matches songs by **filename**. Your lyrics (`.lrc`) and cover art (`.jpg`/`.png`) go in one folder. MP3 files can be anywhere - Serato tells AutoVJ what's playing, AutoVJ finds the matching lyrics and cover by name.

```
~/Desktop/dj/
├── 1st practice/                    ← MP3s here (Serato loads from here)
│   ├── Juice WRLD - All Girls Are The Same.mp3
│   ├── Bazzi - Focus.mp3
│   └── ...
└── lyrics_and_covers/               ← Lyrics & covers here (AutoVJ reads this)
    ├── Juice WRLD - All Girls Are The Same.lrc
    ├── Juice WRLD - All Girls Are The Same.jpg
    ├── Bazzi - Focus.lrc
    ├── Bazzi - Focus.jpg
    └── ...
```

**Rule**: `.lrc` and `.jpg` files must have the **same name** as the MP3 (minus extension).

### Adding Your Folder

**Option A** (recommended): Click **"Add Lyrics & Covers Folder"** on the start screen. Select your folder. Done.

**Option B**: If using NetEase Cloud Music with `meta/track-{ID}.jpg` covers, run the organizer script to rename them:

```bash
node scripts/organize-library.js ~/path/to/your/music/folder
```

This resolves track IDs via the NetEase API and copies covers with the correct song names.

### Cover Art Matching Priority

1. **Same-name file** - `Song.jpg` alongside `Song.lrc` (fastest, most reliable)
2. **NetEase local** - `meta/track-{ID}.jpg` resolved via API
3. **iTunes Search** - Auto-downloads from iTunes and caches locally

## Audio Setup

AutoVJ captures audio directly from your DJ controller (DDJ-FLX4, etc.) via the browser's Web Audio API. It auto-detects the controller as an input device.

**Alternative: BlackHole** (if no controller audio input available)

1. `brew install blackhole-2ch` (reboot required)
2. Open **Audio MIDI Setup** → create **Multi-Output Device** (BlackHole 2ch + your speakers)
3. Check **Drift Correction** on BlackHole only
4. Set system sound output to the Multi-Output Device
5. AutoVJ will auto-detect BlackHole as input

## Controls

### Visual Modes

| Key | Mode |
|-----|------|
| `1` | **Cover Art** (default) - Album artwork + shader effects |
| `2` | **Word Cloud** - Floating lyric keyword particles |
| `Space` | Cycle modes |
| `F` | Fullscreen (for second screen) |

### Live Tuning (press `` ` `` for debug panel)

| Key | Control | Description |
|-----|---------|-------------|
| `` ` `` | Debug panel | Show/hide real-time audio levels and effect state |
| `+` / `-` | Effect Mix | More effects vs. more original image (default 40%) |
| `←` / `→` | Amplitude | How hard the image shakes/pulses |
| `<` / `>` | Reactivity | How easily beats trigger new effects |

### Other

| Key | Function |
|-----|----------|
| `D` | Switch active deck (dual-deck priority) |
| `L` | Toggle lyrics text overlay |
| `Enter` | Restart lyrics timer |
| `[` / `]` | Lyrics offset -5s / +5s |

## Shader Effects

13 effects layer up to 3 simultaneously, triggered by beats:

| Effect | Style | Frequency |
|--------|-------|-----------|
| Displace | Organic noise warp | Common |
| Drift | Cinematic zoom pan | Common |
| Vortex | Spiral swirl | Occasional |
| Kaleidoscope | Mirror symmetry | Occasional |
| Ripple | Water surface | Common |
| Scan | Horizontal displacement | Common |
| Morph | Elastic deformation | Common |
| Fragment | Smooth shatter | Occasional |
| Ghost | Double vision offset | Common |
| Pan | Ken Burns slow motion | Common |
| Radial Blur | Center blur pulse | Common |
| Prism | RGB channel split | Common |
| Breathe | Slow zoom in/out | Very common |

Plus always-on: film grain, CRT scanlines, cinematic vignette, chromatic aberration, bass-driven zoom punch, kick shake.

## AI Mood Analysis

Each song's lyrics are analyzed once by Claude API and cached. The analysis drives the visual atmosphere:

```json
{
  "mood": "melancholic-aggressive",
  "energy": 0.7,
  "palette": [
    { "hue": 280, "sat": 0.8, "light": 0.3 },
    { "hue": 340, "sat": 0.9, "light": 0.4 },
    { "hue": 200, "sat": 0.5, "light": 0.2 }
  ],
  "keywords": ["brain", "love", "insane", "devil", "heart"],
  "beatReactivity": 0.8,
  "distortionLevel": 0.6
}
```

Different songs = different visual worlds. Results cached in `server/.cache/analysis/`.

```bash
# Pre-analyze entire library (recommended)
npm run analyze
```

## Project Structure

```
AutoVJ/
├── start.sh                 # One-click launcher
├── index.html               # Start screen with folder picker
├── scripts/
│   ├── record-demo.sh       # Screen record → GIF for README
│   └── organize-library.js  # Rename NetEase covers to song names
├── src/
│   ├── main.js              # App entry, keyboard controls
│   ├── audio/
│   │   ├── capture.js       # DJ controller / BlackHole / mic capture
│   │   ├── analyzer.js      # FFT, beat/kick detection, auto-gain
│   │   └── demoAnalyzer.js  # Simulated audio for testing
│   ├── visuals/
│   │   ├── manager.js       # Visual mode switching
│   │   ├── coverArt.js      # Cover art shader (13 effects, 3 layers)
│   │   └── wordParticles.js # Keyword particle system
│   ├── lyrics/
│   │   ├── parser.js        # LRC parser
│   │   ├── renderer.js      # Lyrics text overlay
│   │   └── songMood.js      # AI mood interpolation
│   ├── tracks/
│   │   ├── manager.js       # Manual track loading
│   │   └── seratoSync.js    # Serato WebSocket sync
│   └── ui/
│       ├── overlay.js       # Debug HUD
│       └── trackPanel.js    # Track selection panel
├── server/
│   ├── index.js             # Express + WebSocket + file upload
│   ├── seratoWatcher.js     # Serato database monitor
│   ├── lrcIndex.js          # LRC + cover scanner (same-name matching)
│   ├── coverFetcher.js      # Cover fetcher (local → NetEase → iTunes)
│   ├── songAnalyzer.js      # Claude API mood analyzer
│   └── preanalyze.js        # Batch pre-analysis
└── .env                     # ANTHROPIC_API_KEY
```

## Tech Stack

- **Frontend**: Three.js, custom GLSL shaders, Web Audio API
- **Backend**: Node.js, Express, WebSocket, better-sqlite3
- **AI**: Anthropic Claude API (song mood analysis)
- **Audio**: Web Audio API with auto-gain + kick detection
- **DJ Integration**: Serato DJ Pro SQLite database polling (300ms)

## License

MIT
