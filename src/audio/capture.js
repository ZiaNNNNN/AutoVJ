export class AudioCapture {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    this.stream = null;
    this.deviceName = 'unknown';
  }

  async start() {
    // List available audio devices so user can verify
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    console.log('[Audio] Available inputs:', audioInputs.map(d => `${d.label || 'unnamed'} (${d.deviceId.slice(0,8)})`));

    // Priority: DDJ/DJ controller > BlackHole > any
    const djController = audioInputs.find(d => /ddj|dj|pioneer|controller/i.test(d.label));
    const blackhole = audioInputs.find(d => /blackhole/i.test(d.label));
    const preferred = djController || blackhole;

    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    if (preferred) {
      constraints.audio.deviceId = { exact: preferred.deviceId };
      console.log('[Audio] Using:', preferred.label);
    } else {
      console.warn('[Audio] No DJ controller or BlackHole found, using default input');
    }

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Log which device we actually got
    const track = this.stream.getAudioTracks()[0];
    const settings = track.getSettings();
    this.deviceName = track.label || settings.deviceId || 'unknown';
    console.log('[Audio] Capture started:', this.deviceName);

    this.audioContext = new AudioContext();
    console.log('[Audio] Context state:', this.audioContext.state, 'sampleRate:', this.audioContext.sampleRate);

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.sourceNode.connect(this.analyser);

    return this.analyser;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
