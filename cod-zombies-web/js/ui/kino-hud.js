/* =========================================================
   ui/kino-hud.js — Zombies reskin of the existing HUD.
   Keeps the engine ammo panel / health bar / minimap and adds
   points, round, threats, perk icons, interaction prompt and
   the power-up timer placeholder.
   ========================================================= */

const KinoHUD = {
  el:null,
  _lc:{ points:-1, round:-1, threats:-1, prompt:'', progress:-1, power:'', perks:'' },
  _promptT:0,

  /* Create the Zombies HUD nodes once (no-op on later runs). */
  init() {
    if (document.getElementById('kino-hud')) { this.el = document.getElementById('kino-hud'); return; }

    const root = document.createElement('div');
    root.id = 'kino-hud';
    root.className = 'hidden';
    root.innerHTML =
      '<div id="kino-round">ROUND 1</div>' +
      '<div id="kino-threats">HOSTILES 0</div>' +
      '<div id="kino-points"><span class="kp-label">POINTS</span><span id="kino-points-val">500</span></div>' +
      '<div id="kino-perks"></div>' +
      '<div id="kino-powerup" class="hidden">' +
        '<span class="kp-label">POWER-UP</span>' +
        '<span id="kino-powerup-label"></span>' +
        '<span id="kino-powerup-time"></span>' +
      '</div>' +
      '<div id="kino-prompt" class="hidden">' +
        '<div class="kp-text"></div>' +
        '<div class="kp-bar"><i></i></div>' +
      '</div>';
    document.getElementById('hud').appendChild(root);

    this.el = root;
    this._pointsEl = document.getElementById('kino-points-val');
    this._roundEl = document.getElementById('kino-round');
    this._threatsEl = document.getElementById('kino-threats');
    this._perksEl = document.getElementById('kino-perks');
    this._powerEl = document.getElementById('kino-powerup');
    this._powerLabel = document.getElementById('kino-powerup-label');
    this._powerTime = document.getElementById('kino-powerup-time');
    this._promptEl = document.getElementById('kino-prompt');
    this._promptText = this._promptEl.querySelector('.kp-text');
    this._promptBar = this._promptEl.querySelector('.kp-bar i');
  },

  /* Show/hide the Zombies HUD and swap the underlying theme class. */
  show(v) {
    if (!this.el) this.init();
    const hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('zombies', !!v);
    if (this.el) this.el.classList.toggle('hidden', !v);
    if (v) {
      this._lc = { points:-1, round:-1, threats:-1, prompt:'', progress:-1, power:'', perks:'' };
    } else {
      this.setPrompt('', 0);
    }
  },

  /* Update points / round / threats / perks / power-up (change-detected). */
  update(dt, game) {
    if (!this.el || this.el.classList.contains('hidden')) return;
    const points = Math.max(0, Math.round(PointsEconomy.total));
    if (this._lc.points !== points) {
      this._lc.points = points;
      this._pointsEl.textContent = points;
    }
    const round = RoundManager.round || 1;
    if (this._lc.round !== round) {
      this._lc.round = round;
      this._roundEl.textContent = 'ROUND ' + round;
    }
    const threats = RoundManager.remaining ? RoundManager.remaining() : 0;
    if (this._lc.threats !== threats) {
      this._lc.threats = threats;
      this._threatsEl.textContent = 'HOSTILES ' + threats;
    }

    /* perk icons */
    const perks = (game && game.zombiePerks) ? Object.keys(game.zombiePerks).filter(k => game.zombiePerks[k]) : [];
    const perkKey = perks.join(',');
    if (this._lc.perks !== perkKey) {
      this._lc.perks = perkKey;
      this._perksEl.innerHTML = '';
      for (const id of perks) {
        const d = (typeof KinoMapDefinition !== 'undefined' && KinoMapDefinition.perk &&
                   KinoMapDefinition.perk.id === id) ? KinoMapDefinition.perk : null;
        const icon = document.createElement('div');
        icon.className = 'kino-perk';
        icon.title = d ? d.name : id;
        icon.textContent = (d ? d.name : id).slice(0, 2).toUpperCase();
        this._perksEl.appendChild(icon);
      }
    }

    /* power-up timer placeholder */
    const t = (typeof Zombies !== 'undefined') ? Zombies.powerTimer : 0;
    const powerKey = t > 0 ? (Zombies.powerLabel + '|' + Math.ceil(t)) : '';
    if (this._lc.power !== powerKey) {
      this._lc.power = powerKey;
      this._powerEl.classList.toggle('hidden', t <= 0);
      if (t > 0) {
        this._powerLabel.textContent = Zombies.powerLabel || 'POWER-UP';
        this._powerTime.textContent = Math.ceil(t) + 's';
      }
    }
  },

  /* Set the centre-bottom interaction prompt + hold progress (0..1). */
  setPrompt(text, progress) {
    if (!this.el) this.init();
    if (!this._promptEl) return;
    const t = text || '';
    if (this._lc.prompt !== t) {
      this._lc.prompt = t;
      this._promptText.textContent = t;
      this._promptEl.classList.toggle('hidden', !t);
    }
    const p = Math.max(0, Math.min(1, progress || 0));
    const pct = Math.round(p * 100);
    if (this._lc.progress !== pct) {
      this._lc.progress = pct;
      this._promptBar.style.width = pct + '%';
    }
  },

  /* Small pulse on the round label when a new round starts. */
  roundBanner(n) {
    if (!this._roundEl) return;
    this._roundEl.classList.remove('pulse');
    void this._roundEl.offsetWidth;      // retrigger the CSS animation
    this._roundEl.classList.add('pulse');
  }
};
