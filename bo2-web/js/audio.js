/* =========================================================
   audio.js — fully synthesized sound design (Web Audio API).
   No external audio files needed. 3D positional audio via
   PannerNode for bot gunfire, explosions, pickups.
   ========================================================= */

const AudioFX = {
  ctx:null, master:null, ready:false,
  _ambient:null, _noiseBuf:null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    // shared white-noise buffer
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i=0;i<len;i++) d[i] = Math.random()*2-1;
    this._noiseBuf = buf;
    this.ready = true;
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  now() { return this.ctx ? this.ctx.currentTime : 0; },

  /* Tear a finished sound's nodes down.
     Every sound used to leave its PannerNode / filters / gains wired into
     the master bus forever — the graph grew by ~10 nodes per gunshot until
     the page stalled and the game froze mid-match. */
  _free(src, nodes, ms) {
    let done = false;
    const kill = () => {
      if (done) return;
      done = true;
      for (const n of nodes) { try { n.disconnect(); } catch (e) {} }
    };
    if (src) src.onended = kill;
    setTimeout(kill, (ms || 400) + 300);
  },

  _noise(dur, when) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf; s.loop = true;
    s.start(when); s.stop(when + dur + 0.05);
    return s;
  },

  /* Position helper: returns a PannerNode chain to master */
  panner(pos) {
    if (!this.ctx || !pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 3; p.maxDistance = 140; p.rolloffFactor = 1.1;
    if (p.positionX) {
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    } else { p.setPosition(pos.x, pos.y, pos.z); }
    p.connect(this.master);
    return p;
  },

  /* ---------- GUNSHOTS ---------- */
  shot(type, pos, volume, suppressed) {
    if (!this.ready) return;
    const t = this.now(), out = this.panner(pos);
    let vol = (volume == null ? 1 : volume);
    const cfg = {
      smg:     { body:1500, tail:0.20, punch:0.85, sub:110, subG:0.55, hp:2600 },
      ar:      { body:1150, tail:0.26, punch:1.00, sub:92,  subG:0.75, hp:2200 },
      lmg:     { body:980,  tail:0.34, punch:1.10, sub:78,  subG:0.9,  hp:1900 },
      sniper:  { body:760,  tail:0.55, punch:1.35, sub:62,  subG:1.25, hp:1500 },
      pistol:  { body:1750, tail:0.16, punch:0.7,  sub:130, subG:0.45, hp:3000 },
      launcher:{ body:520,  tail:0.6,  punch:1.2,  sub:55,  subG:1.4,  hp:1100 },
      bot:     { body:1250, tail:0.22, punch:0.7,  sub:95,  subG:0.6,  hp:2400 }
    }[type] || { body:1200, tail:0.25, punch:0.9, sub:90, subG:0.7, hp:2200 };
    if (suppressed) {
      // suppressor: quieter, no supersonic crack (lower bandpass), no sub-bass,
      // shorter tail — the "pfft" of a silenced weapon
      vol *= 0.40;
      cfg.hp *= 0.42;
      cfg.punch *= 0.5;
      cfg.subG *= 0.10;
      cfg.tail *= 0.55;
    }

    // transient crack: bandpassed noise sweeping down
    const n = this._noise(cfg.tail + 0.1, t);
    const bp = this.ctx.createBiquadFilter();
    bp.type='bandpass'; bp.frequency.setValueAtTime(cfg.hp, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(180, cfg.body*0.35), t + cfg.tail*0.7);
    bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * cfg.punch * vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + cfg.tail);
    n.connect(bp); bp.connect(g); g.connect(out);

    // low-end thump
    const o = this.ctx.createOscillator();
    o.type='sine';
    o.frequency.setValueAtTime(cfg.sub*2.2, t);
    o.frequency.exponentialRampToValueAtTime(cfg.sub, t + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.75 * cfg.subG * vol, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(og); og.connect(out);
    o.start(t); o.stop(t + 0.2);

    // tail (reverb-ish noise)
    const n2 = this._noise(cfg.tail * 1.8, t + 0.01);
    const lp = this.ctx.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + cfg.tail*1.6);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.28 * vol, t + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + cfg.tail*1.7);
    n2.connect(lp); lp.connect(g2); g2.connect(out);

    // tear the whole chain down when the tail finishes, otherwise the
    // master bus accumulates dead filters/gains until the page stalls
    this._free(n2, [out, n, bp, g, o, og, n2, lp, g2], cfg.tail * 1800);
  },

  /* ---------- UI / FEEDBACK ---------- */
  blip(freq, dur, type, vol) {
    if (!this.ready) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = type || 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.14, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.08));
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + (dur||0.08) + 0.02);
    this._free(o, [o, g], (dur || 0.08) * 1000);
  },
  ui()       { this.blip(880, 0.05, 'square', 0.08); },
  uiBack()   { this.blip(520, 0.06, 'square', 0.08); },
  hit()      { this.blip(1500, 0.05, 'sine', 0.16); this.blip(2100, 0.05, 'sine', 0.10); },
  kill()     { this.blip(900, 0.07, 'sine', 0.2); setTimeout(()=>this.blip(1350,0.12,'sine',0.2), 70); },
  pickup()   { this.blip(660, 0.06, 'triangle', 0.18); setTimeout(()=>this.blip(990,0.09,'triangle',0.16), 70); },
  empty()    { this.blip(240, 0.05, 'square', 0.1); },
  streakReady(){ [660,880,1100].forEach((f,i)=>setTimeout(()=>this.blip(f,0.1,'square',0.14), i*90)); },
  announce() { [440,554,659].forEach((f,i)=>setTimeout(()=>this.blip(f,0.14,'sawtooth',0.08), i*110)); },

  /* ---------- RELOAD ---------- */
  reloadCycle(dur, dexBonus) {
    if (!this.ready) return;
    const d = dexBonus ? dur * 0.78 : dur;
    const click = (off, f) => setTimeout(()=>{
      if (!this.ready) return;
      const t = this.now();
      const o = this.ctx.createOscillator(); o.type='square'; o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.22, t+0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.05);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.07);
      // metallic tick noise
      const n = this._noise(0.04, t);
      const bp = this.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = 3800; bp.Q.value = 3;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.16, t); ng.gain.exponentialRampToValueAtTime(0.0001, t+0.05);
      n.connect(bp); bp.connect(ng); ng.connect(this.master);
      this._free(n, [o, g, n, bp, ng], 120);
    }, off*1000);
    click(0.06, 700); click(d*0.45, 520); click(d*0.88, 900);
    return d;
  },

  /* ---------- IMPACTS ---------- */
  impact(pos, metallic) {
    if (!this.ready) return;
    const t = this.now(), out = this.panner(pos);
    const n = this._noise(0.12, t);
    const bp = this.ctx.createBiquadFilter();
    bp.type='bandpass';
    bp.frequency.value = metallic ? 4200 : 1600;
    bp.Q.value = 2.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    n.connect(bp); bp.connect(g); g.connect(out);
    const nodes = [out, n, bp, g];
    if (metallic) {
      const o = this.ctx.createOscillator(); o.type='triangle';
      o.frequency.setValueAtTime(2600 + Math.random()*900, t);
      o.frequency.exponentialRampToValueAtTime(1400, t+0.1);
      const og = this.ctx.createGain();
      og.gain.setValueAtTime(0.1, t); og.gain.exponentialRampToValueAtTime(0.0001, t+0.1);
      o.connect(og); og.connect(out); o.start(t); o.stop(t+0.12);
      nodes.push(o, og);
    }
    this._free(n, nodes, 200);
  },

  explosion(pos, big) {
    if (!this.ready) return;
    const t = this.now(), out = this.panner(pos);
    const dur = big ? 1.1 : 0.7;
    const n = this._noise(dur, t);
    const lp = this.ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(big?1800:1200, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(big?1.4:0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp); lp.connect(g); g.connect(out);
    // sub boom
    const o = this.ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(big?120:90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + dur*0.8);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(big?1.2:0.8, t+0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + dur + 0.1);
    this._free(o, [out, n, lp, g, o, og], (dur + 0.1) * 1000);
  },

  footstep(vol) {
    if (!this.ready) return;
    const t = this.now();
    const n = this._noise(0.09, t);
    const lp = this.ctx.createBiquadFilter();
    lp.type='lowpass'; lp.frequency.value = 480 + Math.random()*200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((vol||0.14), t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.09);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    this._free(n, [n, lp, g], 200);
  },

  flashbang() {
    if (!this.ready) return;
    const t = this.now();
    const o = this.ctx.createOscillator(); o.type='sine';
    o.frequency.value = 3200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+1.6);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+1.7);
    const n = this._noise(0.5, t);
    const bp = this.ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=5000; bp.Q.value=1;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.4, t); ng.gain.exponentialRampToValueAtTime(0.0001, t+0.5);
    n.connect(bp); bp.connect(ng); ng.connect(this.master);
    this._free(o, [o, g, n, bp, ng], 1700);
  },

  /* ---------- AMBIENT: ocean + engine ---------- */
  startAmbient() {
    if (!this.ready || this._ambient) return;
    const t = this.now();
    const chain = this.ctx.createGain(); chain.gain.value = 1; chain.connect(this.master);

    // ocean: filtered noise + slow LFO on cutoff
    const n = this._noise(9999, t);
    const lp = this.ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
    const ng = this.ctx.createGain(); ng.gain.value = 0.16;
    n.connect(lp); lp.connect(ng); ng.connect(chain);
    const lfo = this.ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value = 0.09;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 210;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(t);
    const lfo2 = this.ctx.createOscillator(); lfo2.type='sine'; lfo2.frequency.value = 0.14;
    const lfo2G = this.ctx.createGain(); lfo2G.gain.value = 0.05;
    lfo2.connect(lfo2G); lfo2G.connect(ng.gain); lfo2.start(t);

    // engine rumble
    const e1 = this.ctx.createOscillator(); e1.type='sawtooth'; e1.frequency.value = 46;
    const e2 = this.ctx.createOscillator(); e2.type='sawtooth'; e2.frequency.value = 47.4;
    const eLP = this.ctx.createBiquadFilter(); eLP.type='lowpass'; eLP.frequency.value = 160;
    const eG = this.ctx.createGain(); eG.gain.value = 0.09;
    e1.connect(eLP); e2.connect(eLP); eLP.connect(eG); eG.connect(chain);
    e1.start(t); e2.start(t);

    // occasional seagull-ish chirp
    const gullTimer = setInterval(() => {
      if (!this.ready) return;
      const tt = this.now();
      const o = this.ctx.createOscillator(); o.type='sine';
      const f = 900 + Math.random()*500;
      o.frequency.setValueAtTime(f, tt);
      o.frequency.linearRampToValueAtTime(f*0.7, tt+0.3);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.03, tt+0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, tt+0.35);
      o.connect(g); g.connect(chain); o.start(tt); o.stop(tt+0.4);
    }, 9000);

    this._ambient = { chain, nodes:[n,lfo,lfo2,e1,e2], gullTimer };
  },

  stopAmbient() {
    if (!this._ambient) return;
    clearInterval(this._ambient.gullTimer);
    const t = this.now();
    try {
      this._ambient.chain.gain.setTargetAtTime(0, t, 0.4);
      const nodes = this._ambient.nodes;
      setTimeout(()=>{ nodes.forEach(n=>{ try{n.stop();}catch(e){} }); try{this._ambient.chain.disconnect();}catch(e){} }, 1500);
    } catch(e) {}
    this._ambient = null;
  },

  /* update listener position each frame */
  listener(pos, fwd, up) {
    if (!this.ready || !pos) return;
    // a single NaN here would throw inside setTargetAtTime and take the
    // whole game loop down with it — never feed the audio API garbage
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z) ||
        !isFinite(fwd.x) || !isFinite(fwd.y) || !isFinite(fwd.z) ||
        !isFinite(up.x)   || !isFinite(up.y)   || !isFinite(up.z)) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      const t = this.now();
      L.positionX.setTargetAtTime(pos.x, t, 0.02);
      L.positionY.setTargetAtTime(pos.y, t, 0.02);
      L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02);
      L.forwardY.setTargetAtTime(fwd.y, t, 0.02);
      L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02);
      L.upY.setTargetAtTime(up.y, t, 0.02);
      L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      L.setPosition(pos.x, pos.y, pos.z);
      L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }
};
