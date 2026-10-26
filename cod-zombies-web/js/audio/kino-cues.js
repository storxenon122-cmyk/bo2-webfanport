/* =========================================================
   audio/kino-cues.js — procedural WebAudio cues for the Zombies
   mode. Everything is synthesized from oscillators and a shared
   noise buffer (no external audio files, no sampled loops).
   Reuses AudioFX's context when available so master volume /
   mute from Settings applies automatically.

   Cues: roundStart, roundEnd, boxJingle, perkJingle, pickup.
   ========================================================= */

const KinoCues = {
  _ctx:null, _master:null, _noise:null, _ready:false,

  /* Hook into AudioFX's context if it exists; otherwise create our own. */
  init() {
    if (this._ready) return;
    if (typeof AudioFX !== 'undefined' && AudioFX.ctx && AudioFX.master) {
      this._ctx = AudioFX.ctx;
      this._master = AudioFX.master;
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.6;
      this._master.connect(this._ctx.destination);
    }
    // shared white-noise buffer
    const len = this._ctx.sampleRate * 2;
    const buf = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    this._ready = true;
  },

  _now() { return this._ctx ? this._ctx.currentTime : 0; },
  _resume() { if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume(); },

  _src(dur, when) {
    const s = this._ctx.createBufferSource();
    s.buffer = this._noise; s.loop = true;
    s.start(when); s.stop(when + dur + 0.05);
    return s;
  },

  /* A single oscillator tone with an exponential envelope. */
  _tone(freq, dur, type, vol, when, glideTo) {
    const t = when != null ? when : this._now();
    const o = this._ctx.createOscillator();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._master);
    o.start(t); o.stop(t + dur + 0.02);
    return { o, g };
  },

  /* A short filtered-noise burst (impact / swell). */
  _noiseBurst(dur, freq, q, vol, when, type) {
    const t = when != null ? when : this._now();
    const n = this._src(dur, t);
    const f = this._ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 1;
    const g = this._ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(this._master);
    return { n, f, g };
  },

  /* ------------------------------------------------------------
     ROUND START — rising two-note horn stinger + low sub swell.
     ------------------------------------------------------------ */
  roundStart() {
    if (!this._ready) this.init();
    if (!this._ready) return;
    this._resume();
    const t = this._now();
    // sub swell
    this._tone(60, 0.6, 'sine', 0.35, t, 120);
    // rising minor stinger (root -> fifth)
    this._tone(196, 0.35, 'sawtooth', 0.12, t + 0.05);          // G3
    this._tone(294, 0.45, 'sawtooth', 0.12, t + 0.25);          // D4
    this._tone(392, 0.6, 'sawtooth', 0.10, t + 0.45);           // G4
    // metallic noise hit
    this._noiseBurst(0.25, 3200, 2, 0.18, t + 0.05);
  },

  /* ------------------------------------------------------------
     ROUND END — falling three-note release + airy tail.
     ------------------------------------------------------------ */
  roundEnd() {
    if (!this._ready) this.init();
    if (!this._ready) return;
    this._resume();
    const t = this._now();
    this._tone(392, 0.3, 'sawtooth', 0.10, t);                 // G4
    this._tone(294, 0.35, 'sawtooth', 0.10, t + 0.18);         // D4
    this._tone(196, 0.6, 'sawtooth', 0.11, t + 0.36);          // G3
    this._tone(98, 0.8, 'sine', 0.28, t + 0.36, 60);           // sub resolve
    this._noiseBurst(0.5, 900, 1, 0.10, t + 0.36, 'lowpass');
  },

  /* ------------------------------------------------------------
     MYSTERY BOX jingle — rolling arpeggio that "lands" on a note.
     ------------------------------------------------------------ */
  boxJingle() {
    if (!this._ready) this.init();
    if (!this._ready) return;
    this._resume();
    const t = this._now();
    const scale = [523, 587, 659, 784, 880, 1047];   // C-major sparkle
    for (let i = 0; i < 6; i++) {
      this._tone(scale[i], 0.14, 'square', 0.07, t + i * 0.09);
    }
    // landing note with vibrato-ish glide
    this._tone(1047, 0.5, 'triangle', 0.12, t + 0.6, 1319);
    this._noiseBurst(0.2, 4000, 3, 0.08, t + 0.6);
  },

  /* ------------------------------------------------------------
     PERK jingle — warm two-chord "cha-ching" style flourish.
     ------------------------------------------------------------ */
  perkJingle() {
    if (!this._ready) this.init();
    if (!this._ready) return;
    this._resume();
    const t = this._now();
    // rising perfect fifth then a bell
    this._tone(330, 0.2, 'triangle', 0.13, t);
    this._tone(494, 0.25, 'triangle', 0.13, t + 0.12);
    this._tone(659, 0.5, 'sine', 0.16, t + 0.26);
    this._tone(988, 0.5, 'sine', 0.08, t + 0.28);   // shimmer overtone
    this._noiseBurst(0.15, 5000, 4, 0.06, t + 0.26);
  },

  /* ------------------------------------------------------------
     POWER-UP PICKUP — quick bright ping with a descending tail.
     ------------------------------------------------------------ */
  pickup() {
    if (!this._ready) this.init();
    if (!this._ready) return;
    this._resume();
    const t = this._now();
    this._tone(880, 0.1, 'square', 0.12, t);
    this._tone(1320, 0.12, 'square', 0.10, t + 0.06);
    this._tone(660, 0.3, 'triangle', 0.10, t + 0.16, 440);
    this._noiseBurst(0.12, 3000, 3, 0.08, t);
  }
};
