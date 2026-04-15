import easymidi from 'easymidi';

// Listens for MIDI CC messages to detect channel fader positions
// Note: DDJ-FLX4 in Serato mode doesn't send MIDI CC for faders.
// This works with controllers that DO send MIDI, or via IAC Driver.

export class MidiListener {
  constructor() {
    this.input = null;
    this.deck1Volume = 0; // 0-127
    this.deck2Volume = 0;

    // Configurable: which MIDI CC numbers map to deck faders
    // You'll set these when configuring Serato's MIDI output
    this.deck1CC = 0; // will be detected automatically
    this.deck2CC = 1;
    this.crossfaderCC = 2;
    this.crossfader = 64; // center = 64

    this.onDeckSwitch = null; // callback(dominantDeck: '1' | '2')
    this._lastDominant = null;
  }

  start() {
    const inputs = easymidi.getInputs();
    const iacPort = inputs.find(i => i.includes('IAC'));

    if (!iacPort) {
      console.warn('[MIDI] IAC Driver not found. Enable it in Audio MIDI Setup.');
      return false;
    }

    try {
      this.input = new easymidi.Input(iacPort);
      console.log(`[MIDI] Listening on: ${iacPort}`);

      // Listen for all CC messages and learn which ones are faders
      this.input.on('cc', (msg) => {
        // msg: { channel, controller, value }
        this._handleCC(msg.channel, msg.controller, msg.value);
      });

      return true;
    } catch (err) {
      console.warn('[MIDI] Failed to open:', err.message);
      return false;
    }
  }

  _handleCC(channel, cc, value) {
    // Serato MIDI output: channel faders are typically sent on different channels
    // Channel 0 = Deck 1, Channel 1 = Deck 2 (Serato convention)
    // Or they use different CC numbers on the same channel

    // Strategy: track all CC values, use channel to distinguish decks
    if (channel === 0) {
      this.deck1Volume = value;
    } else if (channel === 1) {
      this.deck2Volume = value;
    }

    // Check which deck is dominant
    this._checkDominant();
  }

  _checkDominant() {
    let dominant;

    if (this.deck1Volume > this.deck2Volume + 10) {
      dominant = '1';
    } else if (this.deck2Volume > this.deck1Volume + 10) {
      dominant = '2';
    } else {
      return; // too close to call, don't switch
    }

    if (dominant !== this._lastDominant) {
      this._lastDominant = dominant;
      console.log(`[MIDI] Dominant deck: ${dominant} (D1=${this.deck1Volume}, D2=${this.deck2Volume})`);
      this.onDeckSwitch?.(dominant);
    }
  }

  // Get current fader levels (for debug)
  getLevels() {
    return {
      deck1: this.deck1Volume,
      deck2: this.deck2Volume,
      crossfader: this.crossfader,
      dominant: this._lastDominant,
    };
  }

  stop() {
    if (this.input) {
      this.input.close();
      this.input = null;
    }
  }
}
