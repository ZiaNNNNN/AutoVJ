import easymidi from 'easymidi';

// Listens for MIDI from DDJ-FLX4 for channel fader positions.
//
// IMPORTANT: DDJ-FLX4 in Serato mode does NOT send standard MIDI.
// Serato uses a proprietary HID protocol. MIDI data is only available
// when using Mixxx or other MIDI-compatible DJ software.
//
// This module is kept for future use with MIDI-compatible controllers
// or if Serato adds MIDI output support.
//
// DDJ-FLX4 MIDI CC map (from Mixxx source):
//   Deck 1 fader: ch0, CC 0x13 (MSB) + CC 0x33 (LSB)
//   Deck 2 fader: ch1, CC 0x13 (MSB) + CC 0x33 (LSB)
//   Crossfader:   ch6, CC 0x1F (MSB) + CC 0x3F (LSB)

export class MidiListener {
  constructor() {
    this.input = null;
    this.deck1Volume = 0;
    this.deck2Volume = 0;
    this.crossfader = 64;
    this.onDeckSwitch = null;
    this._lastDominant = null;
  }

  start() {
    const inputs = easymidi.getInputs();

    // Try IAC Driver first (for controllers that route through it)
    // Then try the DDJ directly (works when Serato is NOT running)
    const port = inputs.find(i => i.includes('IAC')) || inputs.find(i => i.includes('DDJ'));

    if (!port) {
      console.warn('[MIDI] No suitable MIDI input found');
      return false;
    }

    try {
      this.input = new easymidi.Input(port);
      console.log(`[MIDI] Listening on: ${port}`);

      this.input.on('cc', (msg) => {
        this._handleCC(msg.channel, msg.controller, msg.value);
      });

      return true;
    } catch (err) {
      console.warn('[MIDI] Failed to open:', err.message);
      return false;
    }
  }

  _handleCC(channel, cc, value) {
    // DDJ-FLX4 fader MSB values (CC 0x13 = 19)
    if (cc === 0x13) {
      if (channel === 0) this.deck1Volume = value;
      else if (channel === 1) this.deck2Volume = value;
      this._checkDominant();
    }
    // Crossfader MSB (CC 0x1F = 31) on channel 6
    if (cc === 0x1F && channel === 6) {
      this.crossfader = value;
      this._checkDominant();
    }
  }

  _checkDominant() {
    let dominant;
    if (this.deck1Volume > this.deck2Volume + 10) {
      dominant = '1';
    } else if (this.deck2Volume > this.deck1Volume + 10) {
      dominant = '2';
    } else {
      return;
    }

    if (dominant !== this._lastDominant) {
      this._lastDominant = dominant;
      console.log(`[MIDI] Dominant deck: ${dominant} (D1=${this.deck1Volume}, D2=${this.deck2Volume})`);
      this.onDeckSwitch?.(dominant);
    }
  }

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
