/* =========================================================
   systems/interaction.js — centre-screen aim picking with
   press / hold prompts. Buys doors, repairs barricades, buys
   the perk, spins the mystery box, inspects the PaP anchor.
   ========================================================= */

const InteractionSystem = {
  camera:null,
  items:[],
  target:null,
  holdItem:null,
  holdT:0,
  holdDur:1.15,
  _pos:null,
  _dir:null,
  _to:null,

  /* Build the interactable list for the current Kino run. */
  init(camera) {
    this.camera = camera;
    this.items = [];
    this.target = null;
    this.holdItem = null;
    this.holdT = 0;
    if (typeof KinoMapDefinition === 'undefined' || typeof KinoMapRuntime === 'undefined') return;
    const D = KinoMapDefinition;

    /* ---------- buyable theater door ---------- */
    this.items.push({
      id:'door', kind:'door', label:'BUY ' + D.door.label,
      cost:D.door.cost, hold:false, hideWhenDone:true,
      anchorId:D.door.id,
      enabled: () => !KinoMapRuntime.doorOpen,
      use: () => {
        KinoMapRuntime.openDoor();
        if (typeof HUD !== 'undefined' && HUD.announce)
          HUD.announce('THEATER UNLOCKED', 'DOOR PURCHASED');
        if (typeof AudioFX !== 'undefined' && AudioFX.blip)
          AudioFX.blip(300, 0.2, 'square', 0.1);
      }
    });

    /* ---------- barricade repair (hold) ---------- */
    for (const w of D.windows) {
      this.items.push({
        id:'repair:' + w.id, kind:'repair', label:'REPAIR BARRICADE',
        cost:0, hold:true, hideWhenDone:true, anchorId:'repair:' + w.id, windowId:w.id,
        enabled: () => BarricadeSystem.boards(w.id) < (w.boards || 6),
        use: () => {
          BarricadeSystem.repair(w.id);
          PointsEconomy.award('boardRepair');
          if (typeof HUD !== 'undefined' && HUD.killfeed)
            HUD.killfeed('+ <span class="hs">BOARD</span> +' + PointsEconomy.awards.boardRepair);
        }
      });
    }

    /* ---------- perk machine ---------- */
    const P = D.perk;
    this.items.push({
      id:P.id, kind:'perk', label:'BUY ' + P.name,
      cost:P.cost, hold:false, hideWhenDone:true, anchorId:P.id,
      enabled: () => !(Game.zombiePerks && Game.zombiePerks[P.id]),
      use: () => {
        Game.zombiePerks = Game.zombiePerks || {};
        Game.zombiePerks[P.id] = true;
        Game.player.maxHp = 150;
        Game.player.hp = 150;
        if (typeof HUD !== 'undefined') {
          if (HUD.setHealth) HUD.setHealth(100);
          if (HUD.announce) HUD.announce(P.name, P.desc);
        }
        if (typeof AudioFX !== 'undefined' && AudioFX.streakReady) AudioFX.streakReady();
      }
    });

    /* ---------- mystery box (hold) ---------- */
    const B = D.mysteryBox;
    this.items.push({
      id:B.id, kind:'box', label:'OPEN ' + B.label,
      cost:B.cost, hold:true, anchorId:B.id,
      enabled: () => true,
      use: () => {
        const pool = (B.pool && B.pool.length) ? B.pool : ['smg','ar','shotgun'];
        const current = (Game.arms && Game.arms.primary) ? Game.arms.primary.def.id : null;
        const options = pool.filter(id => id !== current);
        const usePool = options.length ? options : pool;
        const id = usePool[Math.floor(Math.random() * usePool.length)];
        if (Game.giveWeapon) Game.giveWeapon(id);
        if (typeof HUD !== 'undefined' && HUD.announce) {
          const def = (typeof WEAPONS !== 'undefined' && WEAPONS[id]) ? WEAPONS[id] : { name:id.toUpperCase() };
          HUD.announce('MYSTERY BOX', def.name);
        }
        if (typeof AudioFX !== 'undefined' && AudioFX.pickup) AudioFX.pickup();
      }
    });

    /* ---------- Pack-a-Punch placeholder anchor ---------- */
    const K = D.packAPunch;
    this.items.push({
      id:K.id, kind:'pap', label:K.label,
      cost:K.cost, hold:false, anchorId:K.id,
      enabled: () => !!K.available,
      use: () => {}
    });
  },

  /* Per-frame aim pick, prompt text and hold/press handling. */
  update(dt, game) {
    if (!this.camera || this.items.length === 0) return;
    if (typeof KinoGameState !== 'undefined' && !KinoGameState.isPlaying()) return;

    if (!this._pos) { this._pos = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._to = new THREE.Vector3(); }
    const camPos = this.camera.getWorldPosition(this._pos);
    const camDir = this.camera.getWorldDirection(this._dir);
    // consume both press edges every frame so a press made while not looking
    // at an anchor cannot fire later when the player turns toward one
    const pressInteract = KeybindManager.pressed('interact');
    const pressRepair = KeybindManager.pressed('repair');

    let best = null, bestScore = -1;
    for (const it of this.items) {
      if (it.hideWhenDone && it.enabled && !it.enabled()) continue;
      const anchor = KinoMapRuntime.anchors[it.anchorId];
      if (!anchor) continue;
      const p = anchor.getWorldPosition(this._to);
      const dx = p.x - camPos.x, dy = p.y - camPos.y, dz = p.z - camPos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 3.5 || dist < 0.05) continue;
      const dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / dist;
      if (dot < 0.82) continue;
      const score = dot - dist * 0.035;
      if (score > bestScore) { bestScore = score; best = it; }
    }
    this.target = best;

    if (!best) {
      this.holdItem = null;
      this.holdT = 0;
      if (typeof KinoHUD !== 'undefined') KinoHUD.setPrompt('', 0);
      return;
    }

    const enabled = best.enabled ? best.enabled() : true;
    const affordable = best.cost <= 0 || PointsEconomy.canAfford(best.cost);
    const action = best.kind === 'repair' ? 'repair' : 'interact';
    const key = this._keyLabel(action);

    let text;
    if (!enabled) {
      text = best.label + ' — OFFLINE';
    } else if (!affordable) {
      text = best.label + ' · ' + best.cost + ' PTS (NEED ' +
        Math.max(0, best.cost - PointsEconomy.total) + ' MORE)';
    } else if (best.kind === 'repair') {
      text = 'HOLD [' + key + '] TO REPAIR BARRICADE  ·  ' +
        BarricadeSystem.boards(best.windowId) + '/6';
    } else {
      text = (best.hold ? 'HOLD [' : 'PRESS [') + key + '] TO ' + best.label +
        (best.cost > 0 ? '  ·  ' + best.cost + ' PTS' : '');
    }

    /* ---------- press actions ---------- */
    if (!best.hold) {
      const press = action === 'repair' ? pressRepair : pressInteract;
      if (enabled && affordable && press) this._trigger(best, game);
      else if (enabled && !affordable && press) this._fail(best);
      if (typeof KinoHUD !== 'undefined') KinoHUD.setPrompt(text, 0);
      return;
    }

    /* ---------- hold actions ---------- */
    const holding = KeybindManager.down(action);
    if (holding && enabled && affordable) {
      if (this.holdItem !== best) { this.holdItem = best; this.holdT = 0; }
      this.holdT += dt;
      if (this.holdT >= this.holdDur) {
        this._trigger(best, game);
        this.holdT = 0;
        if (best.kind !== 'repair') this.holdItem = null;
      }
    } else {
      if (this.holdItem !== best) this.holdT = 0;
      this.holdItem = null;
    }

    if (typeof KinoHUD !== 'undefined')
      KinoHUD.setPrompt(text, this.holdItem === best ? Math.min(1, this.holdT / this.holdDur) : 0);
  },

  /* Clear the interactable list on quit/restart. */
  clear() {
    this.items = [];
    this.target = null;
    this.holdItem = null;
    this.holdT = 0;
    if (typeof KinoHUD !== 'undefined') KinoHUD.setPrompt('', 0);
  },

  /* -------- internals -------- */
  _trigger(item, game) {
    if (item.cost > 0) {
      const res = PointsEconomy.purchase(item.cost, item.label);
      if (!res.ok) { this._fail(item); return; }
    }
    this._fxFor(item, game);
    try { item.use(game); }
    catch (e) { console.error('interaction error (' + item.id + '):', e); }
  },

  /* Fire the matching procedural VFX + audio cue for an interaction kind.
     Additive only — safe no-op when the visual modules aren't loaded. */
  _fxFor(item, game) {
    const p = (game && game.player && game.player.pos) || null;
    const spot = (dy) => p ? new THREE.Vector3(p.x, p.y + (dy || 1.4), p.z - 1.2) : null;
    switch (item.kind) {
      case 'perk':
        if (typeof VFXManager !== 'undefined') VFXManager.perkFlash(spot(1.2));
        if (typeof KinoCues !== 'undefined') KinoCues.perkJingle();
        break;
      case 'box':
        if (typeof VFXManager !== 'undefined') VFXManager.boxSparkle(spot(1.0), 1.2);
        if (typeof KinoCues !== 'undefined') KinoCues.boxJingle();
        break;
      case 'pap':
        if (typeof VFXManager !== 'undefined') VFXManager.perkFlash(spot(1.2));
        if (typeof KinoCues !== 'undefined') KinoCues.perkJingle();
        break;
      case 'powerup':
        if (typeof VFXManager !== 'undefined') VFXManager.powerupGlow(spot(1.0));
        if (typeof KinoCues !== 'undefined') KinoCues.pickup();
        break;
      default:
        break;   // door / repair / spawn — no dedicated cue yet
    }
  },

  _fail(item) {
    if (typeof HUD !== 'undefined' && HUD.announce)
      HUD.announce('NOT ENOUGH POINTS', item.cost + ' PTS REQUIRED');
    if (typeof AudioFX !== 'undefined' && AudioFX.empty) AudioFX.empty();
  },

  _keyLabel(action) {
    const code = KeybindManager.resolve(action);
    return KeybindManager.keyLabel(code);
  }
};
