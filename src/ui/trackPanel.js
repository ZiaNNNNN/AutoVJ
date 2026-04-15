export class TrackPanel {
  constructor() {
    this.visible = false;
    this.onFileSelect = null; // callback(FileList)
    this.onTrackClick = null; // callback(index)
    this.tracks = [];

    this._createDOM();
  }

  _createDOM() {
    // Panel container
    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position: 'fixed',
      right: '-320px',
      top: '0',
      bottom: '0',
      width: '320px',
      background: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(10px)',
      borderLeft: '1px solid #222',
      zIndex: '60',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      color: '#ccc',
      transition: 'right 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });
    document.body.appendChild(this.panel);

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '16px',
      borderBottom: '1px solid #222',
      fontSize: '13px',
      letterSpacing: '2px',
      color: '#888',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });
    header.textContent = 'TRACKS';
    this.panel.appendChild(header);

    // Load folder button
    const loadBtn = document.createElement('button');
    Object.assign(loadBtn.style, {
      background: 'transparent',
      border: '1px solid #444',
      color: '#aaa',
      padding: '4px 12px',
      fontSize: '11px',
      cursor: 'pointer',
      letterSpacing: '1px',
      fontFamily: 'inherit',
    });
    loadBtn.textContent = 'LOAD';
    loadBtn.addEventListener('click', () => this._openFilePicker());
    header.appendChild(loadBtn);

    // Hidden file input
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.webkitdirectory = true;
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this.onFileSelect?.(e.target.files);
      }
    });
    this.panel.appendChild(this.fileInput);

    // Also support single LRC file drop
    this.lrcInput = document.createElement('input');
    this.lrcInput.type = 'file';
    this.lrcInput.accept = '.lrc';
    this.lrcInput.multiple = true;
    this.lrcInput.style.display = 'none';
    this.panel.appendChild(this.lrcInput);

    // Track list container
    this.listEl = document.createElement('div');
    Object.assign(this.listEl.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '8px 0',
    });
    this.panel.appendChild(this.listEl);

    // Info footer
    this.footer = document.createElement('div');
    Object.assign(this.footer.style, {
      padding: '12px 16px',
      borderTop: '1px solid #222',
      fontSize: '10px',
      color: '#555',
      letterSpacing: '1px',
    });
    this.footer.textContent = 'Tab: toggle | Enter: start lyrics | \u2191\u2193: switch';
    this.panel.appendChild(this.footer);
  }

  _openFilePicker() {
    this.fileInput.click();
  }

  toggle() {
    this.visible = !this.visible;
    this.panel.style.right = this.visible ? '0' : '-320px';
    this.panel.style.pointerEvents = this.visible ? 'auto' : 'none';
  }

  updateTrackList(tracks, currentIndex) {
    this.tracks = tracks;
    this.listEl.innerHTML = '';

    tracks.forEach((track, i) => {
      const item = document.createElement('div');
      const isActive = i === currentIndex;
      Object.assign(item.style, {
        padding: '10px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: isActive ? 'rgba(255,0,110,0.1)' : 'transparent',
        borderLeft: isActive ? '2px solid #ff006e' : '2px solid transparent',
        transition: 'all 0.2s',
        fontSize: '12px',
      });

      // Cover thumbnail
      if (track.coverUrl) {
        const thumb = document.createElement('img');
        thumb.src = track.coverUrl;
        Object.assign(thumb.style, {
          width: '36px',
          height: '36px',
          objectFit: 'cover',
          borderRadius: '3px',
          flexShrink: '0',
        });
        item.appendChild(thumb);
      } else {
        const placeholder = document.createElement('div');
        Object.assign(placeholder.style, {
          width: '36px',
          height: '36px',
          background: '#1a1a1a',
          borderRadius: '3px',
          flexShrink: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          color: '#444',
        });
        placeholder.textContent = '\u266B';
        item.appendChild(placeholder);
      }

      // Track info
      const info = document.createElement('div');
      Object.assign(info.style, {
        flex: '1',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: isActive ? '#ff006e' : '#aaa',
      });
      info.textContent = track.name;
      item.appendChild(info);

      // Lyrics count badge
      if (track.lyrics.length > 0) {
        const badge = document.createElement('span');
        Object.assign(badge.style, {
          fontSize: '9px',
          color: '#666',
          background: '#1a1a1a',
          padding: '2px 6px',
          borderRadius: '8px',
          flexShrink: '0',
        });
        badge.textContent = `${track.lyrics.length}`;
        item.appendChild(badge);
      }

      item.addEventListener('click', () => this.onTrackClick?.(i));
      item.addEventListener('mouseenter', () => {
        if (i !== currentIndex) item.style.background = 'rgba(255,255,255,0.03)';
      });
      item.addEventListener('mouseleave', () => {
        if (i !== currentIndex) item.style.background = 'transparent';
      });

      this.listEl.appendChild(item);
    });
  }

  setActiveTrack(index) {
    this.updateTrackList(this.tracks, index);
  }
}
