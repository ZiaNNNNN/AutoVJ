import { getLyricIndexAtTime } from './parser.js';

export class LyricsRenderer {
  constructor() {
    this.lyrics = [];
    this.currentIndex = -1;
    this.startTime = 0;
    this.elapsed = 0;
    this.running = false;
    this.visible = true;
    this.offset = 0; // manual time offset

    this._createDOM();
  }

  _createDOM() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: '40',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
    });
    document.body.appendChild(this.container);

    // Previous lyric (fading out above)
    this.prevEl = document.createElement('div');
    Object.assign(this.prevEl.style, {
      fontSize: '20px',
      color: 'rgba(255,255,255,0.25)',
      marginBottom: '16px',
      transition: 'all 0.4s ease-out',
      textAlign: 'center',
      maxWidth: '80%',
      letterSpacing: '1px',
    });
    this.container.appendChild(this.prevEl);

    // Current lyric (main display)
    this.currentEl = document.createElement('div');
    Object.assign(this.currentEl.style, {
      fontSize: '42px',
      fontWeight: '600',
      color: '#fff',
      textShadow: '0 0 30px rgba(255,0,110,0.5), 0 0 60px rgba(131,56,236,0.3)',
      transition: 'all 0.15s ease-out',
      textAlign: 'center',
      maxWidth: '85%',
      lineHeight: '1.3',
      letterSpacing: '2px',
    });
    this.container.appendChild(this.currentEl);

    // Next lyric (fading in below)
    this.nextEl = document.createElement('div');
    Object.assign(this.nextEl.style, {
      fontSize: '18px',
      color: 'rgba(255,255,255,0.15)',
      marginTop: '16px',
      transition: 'all 0.4s ease-out',
      textAlign: 'center',
      maxWidth: '80%',
      letterSpacing: '1px',
    });
    this.container.appendChild(this.nextEl);
  }

  setLyrics(lyrics) {
    this.lyrics = lyrics || [];
    this.currentIndex = -1;
    this.elapsed = 0;
    this.offset = 0;
    this.prevEl.textContent = '';
    this.currentEl.textContent = '';
    this.nextEl.textContent = '';
  }

  start() {
    this.startTime = performance.now() / 1000;
    this.elapsed = 0;
    this.offset = 0;
    this.running = true;
    this.currentIndex = -1;
  }

  stop() {
    this.running = false;
  }

  restart() {
    this.start();
  }

  adjustOffset(delta) {
    this.offset += delta;
  }

  toggleVisibility() {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? 'flex' : 'none';
  }

  update(analyzer) {
    if (!this.running || !this.lyrics.length) return;

    this.elapsed = performance.now() / 1000 - this.startTime + this.offset;

    const newIndex = getLyricIndexAtTime(this.lyrics, this.elapsed);

    if (newIndex !== this.currentIndex) {
      this.currentIndex = newIndex;
      this._updateDisplay();
    }

    // Beat-reactive effects on current lyric
    if (analyzer.isBeat && this.currentEl.textContent) {
      const scale = 1 + analyzer.beatIntensity * 0.08;
      this.currentEl.style.transform = `scale(${scale})`;
      const hue = (performance.now() / 5000 * 360) % 360;
      this.currentEl.style.textShadow =
        `0 0 30px hsla(${hue},80%,60%,0.6), 0 0 60px hsla(${(hue + 60) % 360},70%,50%,0.3)`;
    } else {
      this.currentEl.style.transform = 'scale(1)';
    }

    // Bass-driven subtle sway
    const sway = Math.sin(this.elapsed * 2) * analyzer.bass * 3;
    this.currentEl.style.marginLeft = `${sway}px`;
  }

  _updateDisplay() {
    const idx = this.currentIndex;
    const lyrics = this.lyrics;

    // Previous line
    this.prevEl.textContent = idx > 0 ? lyrics[idx - 1].text : '';

    // Current line
    if (idx >= 0 && idx < lyrics.length) {
      this.currentEl.textContent = lyrics[idx].text;
      this.currentEl.style.opacity = '1';
      // Trigger entrance animation
      this.currentEl.style.transform = 'scale(1.1)';
      requestAnimationFrame(() => {
        this.currentEl.style.transform = 'scale(1)';
      });
    } else {
      this.currentEl.textContent = '';
    }

    // Next line
    this.nextEl.textContent = idx + 1 < lyrics.length ? lyrics[idx + 1].text : '';
  }
}
