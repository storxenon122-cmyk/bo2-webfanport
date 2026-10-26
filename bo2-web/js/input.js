/* =========================================================
   input.js — keyboard + mouse (Pointer Lock).
   Desktop build: no touch layer, no gyro/tilt aiming.
   ========================================================= */

const Input = {
  keys:{}, edges:{}, codes:{}, _upEdges:{},
  mouse:{ left:false, right:false, dx:0, dy:0, wheel:0 },
  locked:false,
  _onLockChange:null, _onPause:null,

  init(canvas, opts) {
    this._onLockChange = opts && opts.onLockChange;
    this._onPause = opts && opts.onPause;
    this.rebind();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // remapping capture handled in menu.js via captureKey
      if (this._capture) { this._capture(e.code); e.preventDefault(); return; }
      this.keys[e.code] = true;
      // a code can be bound to several actions (1/2/3 are both weapon
      //  slots and killstreak slots) — flag every one of them
      const acts = this.codes[e.code];
      if (acts) for (const a of acts) this.edges[a] = true;
      if (['Space','Tab','F1','F3','F5'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') { if (this._onPause) this._onPause(); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; this._upEdges[e.code] = true; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.left = true;
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive:true });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = (document.pointerLockElement === canvas);
      if (this._onLockChange) this._onLockChange(this.locked);
    });
  },

  rebind() {
    // NOTE: a key may be bound to more than one action (Digit1 is both
    // weapon1 and streak1). Keep a LIST per code so the result doesn't
    // depend on the order the binds happen to be stored in.
    this.codes = {};
    for (const action in Settings.data.binds) {
      const code = Settings.data.binds[action];
      if (!code) continue;
      if (!this.codes[code]) this.codes[code] = [];
      if (this.codes[code].indexOf(action) < 0) this.codes[code].push(action);
    }
  },

  codeToAction(code) {
    const a = this.codes[code];
    return a ? a[0] : null;
  },
  actionsFor(code) { return this.codes[code] || []; },

  requestLock(canvas) {
    if (canvas.requestPointerLock) {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(()=>{});
    }
  },
  exitLock() { if (document.exitPointerLock) document.exitPointerLock(); },

  captureNext(cb) { this._capture = (code) => { this._capture = null; cb(code); }; },
  cancelCapture() { this._capture = null; },

  /* ---------- queries ---------- */
  down(action) {
    return !!this.keys[Settings.bind(action)];
  },
  pressed(action) {
    if (this.edges[action]) { this.edges[action] = false; return true; }
    return false;
  },
  up(action) {
    const r = this._upEdges[action] || false;
    this._upEdges[action] = false;
    return r;
  },
  clearEdges() { this.edges = {}; },
  /* clear every held-key / mouse state so a key held at death can't
     carry over into the next life (auto-movement after respawn). */
  reset() {
    this.keys = {};
    this.edges = {};
    this._upEdges = {};
    this.mouse.left = false;
    this.mouse.right = false;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
  },
  fire() { return this.mouse.left; },
  ads() { return this.mouse.right; },
  lookDelta() {
    const dx = this.mouse.dx, dy = this.mouse.dy;
    this.mouse.dx = 0; this.mouse.dy = 0;
    return { x:dx, y:dy };
  },
  moveAxis() {
    let x = 0, y = 0;
    if (this.down('forward')) y += 1;
    if (this.down('back')) y -= 1;
    if (this.down('right')) x += 1;
    if (this.down('left')) x -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  },
  consumeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; }
};
