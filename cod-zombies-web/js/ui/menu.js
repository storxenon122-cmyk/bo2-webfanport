/* =========================================================
   ui/menu.js — Zombies menu flow layered on top of the
   existing Menu. Adds Zombies / Kino entries, the Keybinds
   screen wiring, a Kino pause panel and a run-summary game
   over panel. Every screen releases pointer lock.
   ========================================================= */

const MenuManager = {
  current:null,

  /* Build the Zombies screens and wire their buttons once. */
  init() {
    this._buildZombiesMenu();
    this._buildPause();
    this._buildGameOver();
    this._bind();

    KeybindManager.bindUI('keybind-list');

    /* boot click transitions the state machine out of BOOT */
    const boot = document.getElementById('boot-screen');
    if (boot) {
      boot.addEventListener('click', () => {
        if (KinoGameState.is(KinoGameState.STATES.BOOT))
          KinoGameState.set(KinoGameState.STATES.MAIN_MENU);
      });
    }
  },

  /* Escape handling for Zombies-owned screens; returns true if handled. */
  onEscape() {
    if (this.current === 'zombies-menu') { this.showMainMenu(); return true; }
    if (this.current === 'keybinds-screen') { this.showMainMenu(); return true; }
    return false;
  },

  /* Hide every screen and release the mouse. */
  hideAll() {
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.add('hidden'));
    this.current = null;
    if (typeof Menu !== 'undefined') Menu.current = 'none';
    Input.exitLock();
  },

  /* Show the main menu (also resets the machine state). */
  showMainMenu() {
    if (typeof Game !== 'undefined' && Game.state !== 'idle') Game.quit();
    KinoGameState.set(KinoGameState.STATES.MAIN_MENU);
    Menu.show('main-menu');
    this.current = 'main-menu';
  },

  /* Show the Zombies submenu (Kino / Back). */
  showZombiesMenu() {
    this._show('zombies-menu');
  },

  /* Hide everything and return to the normal main menu. */
  showMain() {
    Menu.show('main-menu');
    this.current = 'main-menu';
  },

  /* Load and start a fresh Kino run. */
  startKino() {
    AudioFX.ui();
    this.hideAll();
    KinoGameState.set(KinoGameState.STATES.LOADING);
    HUD.show(false);
    Game.start({ mode:'zombies' });
    setTimeout(() => {
      if (Game.state === 'playing') Input.requestLock(Game.renderer.domElement);
    }, 60);
  },

  /* Restart the current Kino run from Round 1. */
  restartKino() {
    AudioFX.ui();
    this.hideAll();
    KinoGameState.set(KinoGameState.STATES.LOADING);
    Game.start({ mode:'zombies' });
    setTimeout(() => {
      if (Game.state === 'playing') Input.requestLock(Game.renderer.domElement);
    }, 60);
  },

  /* Show the in-run pause panel (pointer lock already released). */
  showPause() {
    this._show('kino-pause');
  },

  /* Hide the pause panel (Game.resume re-locks the pointer). */
  hidePause() {
    this.hideAll();
    this.current = null;
  },

  /* Show the Kino game-over summary with run stats. */
  showGameOver() {
    const $ = (id) => document.getElementById(id);
    if ($('kino-go-round')) $('kino-go-round').textContent = RoundManager.round || 1;
    if ($('kino-go-points')) $('kino-go-points').textContent = PointsEconomy.total;
    if ($('kino-go-kills')) $('kino-go-kills').textContent = Game.kills || 0;
    if ($('kino-go-heads')) $('kino-go-heads').textContent = Game.headshots || 0;
    this._show('kino-gameover');
  },

  /* Quit the run and go back to the main menu. */
  quitToMain() {
    AudioFX.uiBack();
    Game.quit();
    this.showMain();
  },

  /* -------- screen plumbing -------- */
  _show(id) {
    document.querySelectorAll('.menu-screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    this.current = id;
    if (typeof Menu !== 'undefined') Menu.current = id;
    Input.exitLock();
  },

  _bind() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };
    on('btn-zombies', () => { AudioFX.ui(); this.showZombiesMenu(); });
    on('btn-zombies-kino', () => this.startKino());
    on('btn-zombies-back', () => { AudioFX.uiBack(); this.showMainMenu(); });
    on('btn-keybinds', () => { AudioFX.ui(); KeybindManager.bindUI('keybind-list'); this._show('keybinds-screen'); });
    on('btn-keybinds-back', () => { AudioFX.uiBack(); this.showMainMenu(); });

    on('btn-kino-resume', () => { AudioFX.ui(); Game.resume(); });
    on('btn-kino-restart', () => this.restartKino());
    on('btn-kino-quit', () => this.quitToMain());
    on('btn-kino-go-restart', () => this.restartKino());
    on('btn-kino-go-menu', () => this.quitToMain());
  },

  _buildZombiesMenu() {
    if (document.getElementById('zombies-menu')) return;
    const el = document.createElement('div');
    el.id = 'zombies-menu';
    el.className = 'menu-screen hidden';
    el.innerHTML =
      '<div class="menu-bg"></div>' +
      '<div class="menu-header">' +
        '<div class="menu-title">ZOMBIES</div>' +
        '<div class="menu-subtitle">SURVIVAL HORROR</div>' +
      '</div>' +
      '<div class="menu-list">' +
        '<button class="menu-btn" id="btn-zombies-kino"><span class="num">01</span> KINO DER TOTEN <em>ROUND BASED</em></button>' +
        '<button class="menu-btn" id="btn-zombies-back"><span class="num">02</span> BACK</button>' +
      '</div>' +
      '<div class="menu-footer">ALL ASSETS ORIGINAL &bull; PLACEHOLDER AUDIO / MODELS</div>';
    document.body.appendChild(el);
  },

  _buildPause() {
    if (document.getElementById('kino-pause')) return;
    const el = document.createElement('div');
    el.id = 'kino-pause';
    el.className = 'menu-screen hidden';
    el.innerHTML =
      '<div class="menu-bg dim"></div>' +
      '<div class="panel narrow">' +
        '<div class="panel-title">PAUSED</div>' +
        '<div class="menu-list">' +
          '<button class="menu-btn" id="btn-kino-resume">RESUME</button>' +
          '<button class="menu-btn" id="btn-kino-restart">RESTART</button>' +
          '<button class="menu-btn" id="btn-kino-quit">MAIN MENU</button>' +
        '</div>' +
        '<div class="kino-hint">WASD MOVE &bull; SHIFT SPRINT &bull; F INTERACT &bull; HOLD E REPAIR &bull; X SWAP</div>' +
      '</div>';
    document.body.appendChild(el);
  },

  _buildGameOver() {
    if (document.getElementById('kino-gameover')) return;
    const el = document.createElement('div');
    el.id = 'kino-gameover';
    el.className = 'menu-screen hidden';
    el.innerHTML =
      '<div class="menu-bg dim"></div>' +
      '<div class="panel narrow">' +
        '<div class="panel-title" id="kino-go-title">GAME OVER</div>' +
        '<div class="go-stats">' +
          '<div><label>ROUND</label><span id="kino-go-round">1</span></div>' +
          '<div><label>POINTS</label><span id="kino-go-points">0</span></div>' +
          '<div><label>KILLS</label><span id="kino-go-kills">0</span></div>' +
          '<div><label>HEADSHOTS</label><span id="kino-go-heads">0</span></div>' +
        '</div>' +
        '<div class="menu-list">' +
          '<button class="menu-btn" id="btn-kino-go-restart">RESTART</button>' +
          '<button class="menu-btn" id="btn-kino-go-menu">MAIN MENU</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
  }
};
