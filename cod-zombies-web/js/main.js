/* =========================================================
   main.js — renderer setup, responsive canvas, game loop,
   quality/brightness application, pointer-lock pause flow,
   keyboard pause handling.
   ========================================================= */

const Main = {
  renderer:null, scene:null, camera:null,
  clock:null,

  boot() {
    if (typeof THREE === 'undefined') {
      const b = document.querySelector('#boot-screen .boot-hint');
      if (b) b.textContent = 'FAILED TO LOAD THREE.JS FROM CDN — CHECK YOUR INTERNET CONNECTION';
      return;
    }

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias:true, powerPreference:'high-performance' });
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    /* weapons are metalness-heavy; give them a tiny IBL probe so barrels,
       rails and the gold/diamond/dark-matter camos aren't rendered black */
    if (typeof applyGunEnv === 'function') applyGunEnv(this.renderer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Settings.data.fov,
      window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, 1.6, 0);
    this.scene.add(this.camera);            // REQUIRED: viewmodel is a camera child
    this.scene.userData.mainCamera = this.camera;

    this.applyQuality();
    this.applyBrightness();

    Game.init(this.renderer, this.scene, this.camera);
    HUD.init();
    SettingsManager.init();
    KinoHUD.init();

    /* ---------- input wiring ---------- */
    Input.init(canvas, {
      onLockChange: (locked) => {
        // Losing pointer lock while playing = pause
        if (!locked && Game.state === 'playing') Game.pause();
      },
      onPause: () => {
        // Escape key handling
        if (typeof MenuManager !== 'undefined' && MenuManager.onEscape()) return;
        if (Game.state === 'playing') Game.pause();
        else if (Game.state === 'paused') Game.resume();
        else if (Menu.current === 'settings-screen') Menu.show(
          Menu.context === 'pause' ? 'pause-screen' : 'main-menu');
        else if (Menu.current === 'loadout-screen') Menu.show('main-menu');
      }
    });

    // click canvas to (re)capture the mouse while playing
    canvas.addEventListener('click', () => {
      if (Game.state === 'playing' && !Input.locked) {
        Input.requestLock(canvas);
      }
    });
    canvas.addEventListener('mousedown', () => {
      if (Game.state === 'paused') Game.resume();
    });

    /* ---------- menu ---------- */
    Menu.init();
    MenuManager.init();

    /* ---------- resize ---------- */
    window.addEventListener('resize', () => this.resize());
    this.resize();

    /* ---------- resilience ---------- */
    this._initResilience(canvas);

    /* ---------- loop ---------- */
    this.clock = new THREE.Clock();
    let last = performance.now();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now();
      const frameMs = now - last;
      last = now;
      this._watchStall(frameMs);
      let dt = this.clock.getDelta();
      if (dt > 0.05) dt = 0.05;               // clamp big frame gaps
      try {
        Game.update(dt);
        this._errCount = 0;
      } catch (e) {
        console.error('Game loop error:', e);
        // A repeating error silently freezes the game (the canvas keeps
        // rendering but nothing advances). Break the cycle instead.
        this._errCount = (this._errCount || 0) + 1;
        if (this._errCount === 20) {
          if (Game.state === 'playing') Game.pause();
          this._showStall('THE GAME HIT AN ERROR',
            'The update loop failed repeatedly. Reload to continue.');
        }
      }
      try {
        // alternate-frame sun shadow update (see applyQuality) — skips the
        // full-scene depth pass on every other frame
        const sun = (typeof MapData !== 'undefined') ? MapData.sun : null;
        if (sun && sun.castShadow && this._shadowEvery > 1) {
          if (this._shadowTick === 0) { sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = true; }
          this._shadowTick = (this._shadowTick + 1) % this._shadowEvery;
        }
        this.renderer.render(this.scene, this.camera);
      } catch (e) {
        console.error('Render error:', e);
      }
    };
    loop();
  },

  /* If the frame loop stalls (GPU hang, runaway allocation) the page used
     to freeze silently — just a frozen image with no explanation. Pause the
     game and say what happened so it can be recovered. */
  _watchStall(frameMs) {
    if (frameMs > 1500) this._slowFrames = (this._slowFrames || 0) + 1;
    else this._slowFrames = 0;
    if (this._slowFrames >= 2 && !this._stalled) {
      this._stalled = true;
      if (Game.state === 'playing') Game.pause();
      this._showStall('THE GAME STOPPED RESPONDING', 'The frame loop stalled. Reload to continue.');
    }
  },

  _showStall(title, msg) {
    let el = document.getElementById('stall-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'stall-overlay';
      el.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(5,7,10,.94);' +
        'color:#e8eef2;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font:600 15px/1.6 system-ui,Segoe UI,sans-serif;letter-spacing:2px;text-align:center';
      const h = document.createElement('div');
      h.style.cssText = 'color:#e8801c;font-size:22px;letter-spacing:5px;margin-bottom:10px';
      h.textContent = title;
      const m = document.createElement('div');
      m.style.cssText = 'color:#9aa6ad;letter-spacing:1px;margin-bottom:22px';
      m.textContent = msg;
      const b = document.createElement('button');
      b.className = 'menu-btn';
      b.textContent = 'RELOAD';
      b.onclick = () => location.reload();
      el.appendChild(h); el.appendChild(m); el.appendChild(b);
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  },

  /* ---------- window / context events ---------- */
  _initResilience(canvas) {
    // pause when the tab is hidden: browsers throttle the frame loop in a
    // background tab, which used to look exactly like a frozen game
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && Game.state === 'playing') Game.pause();
    });
    window.addEventListener('blur', () => {
      if (Game.state === 'playing') Game.pause();
    });
    // graphics context loss — say so instead of showing a dead canvas
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this._showStall('GRAPHICS CONTEXT LOST', 'The browser dropped the WebGL context. Reload to continue.');
    }, false);
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  },

  applyBrightness() {
    const v = Settings.data.brightness;
    document.getElementById('game-canvas').style.filter = `brightness(${v})`;
  },

  applyQuality() {
    const q = Settings.data.quality;
    const dpr = window.devicePixelRatio || 1;
    let ratio, shadows, shadowSize;
    if (q === 'low')       { ratio = 1;                    shadows = false; shadowSize = 1024; }
    else if (q === 'medium'){ ratio = Math.min(dpr, 1.5);  shadows = true;  shadowSize = 2048; }
    else                    { ratio = Math.min(dpr, 2);    shadows = true;  shadowSize = 4096; }
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = shadows;
    /* The sun's shadow pass re-renders the ENTIRE scene (a second full depth
       pass — hundreds of draw calls) every single frame. On 'medium' we only
       feed it alternate frames (~30 Hz); shadows that fast are indistinguishable
       and it removes roughly one scene pass out of every two frames. */
    this._shadowEvery = (q === 'high') ? 1 : 2;
    this._shadowTick = 0;
    // every map builder stores its directional light as MapData.sun
    if (MapData.sun) {
      MapData.sun.castShadow = shadows;
      if (MapData.sun.shadow.mapSize.x !== shadowSize) {
        MapData.sun.shadow.mapSize.set(shadowSize, shadowSize);
        if (MapData.sun.shadow.map) {
          MapData.sun.shadow.map.dispose();
          MapData.sun.shadow.map = null;
        }
      }
    }
    // force material re-compile for shadow toggle
    this.scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  }
};

/* boot once DOM is ready (guard against double-boot) */
let _booted = false;
function _boot() {
  if (_booted) return;
  _booted = true;
  Main.boot();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
else _boot();
