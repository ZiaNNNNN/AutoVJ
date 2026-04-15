export class Overlay {
  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      display: 'none', // hidden by default for clean visuals
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      padding: '16px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontSize: '12px',
      color: '#666',
      pointerEvents: 'none',
      zIndex: '50',
      letterSpacing: '1px',
      transition: 'opacity 0.5s',
    });
    document.body.appendChild(this.el);

    this.modeLabel = document.createElement('span');
    this.fpsLabel = document.createElement('span');
    this.beatIndicator = document.createElement('span');
    this.beatIndicator.textContent = '\u25CF';
    Object.assign(this.beatIndicator.style, { fontSize: '16px', transition: 'color 0.1s' });

    this.el.appendChild(this.modeLabel);
    this.el.appendChild(this.beatIndicator);
    this.el.appendChild(this.fpsLabel);

    this.frames = 0;
    this.lastFpsTime = performance.now();
    this.fps = 0;
    this.hideTimeout = null;

    this.show();
  }

  setMode(name, index) {
    this.modeLabel.textContent = `[${index + 1}] ${name}`;
    this.show();
  }

  updateBeat(isBeat) {
    this.beatIndicator.style.color = isBeat ? '#ff006e' : '#333';
  }

  updateFps() {
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastFpsTime = now;
      this.fpsLabel.textContent = `${this.fps} FPS`;
    }
  }

  showMessage(msg) {
    const msgEl = document.createElement('div');
    Object.assign(msgEl.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 20px',
      fontSize: '11px',
      color: '#888',
      letterSpacing: '2px',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      pointerEvents: 'none',
      zIndex: '50',
      transition: 'opacity 2s',
    });
    msgEl.textContent = msg;
    document.body.appendChild(msgEl);
    setTimeout(() => { msgEl.style.opacity = '0'; }, 5000);
    setTimeout(() => { msgEl.remove(); }, 7000);
  }

  show() {
    this.el.style.opacity = '1';
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      this.el.style.opacity = '0';
    }, 3000);
  }
}
