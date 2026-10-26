/* =========================================================
   game.js — core FPS gameplay: player controller (sprint,
   ADS, crouch, prone, jump, step-up, dolphin dive), weapon
   handling (hitscan fire, recoil, reload, swap, melee),
   grenades (frag cooking), rockets, pickups, continuous bot
   spawn, scorestreaks (points-based), attachments, health regen,
   scoring, pause/death.
   ========================================================= */

const Game = {
  state:'idle',            // idle | playing | paused | dead
  mode:'survival',         // survival | zombies
  scene:null, camera:null, renderer:null,
  hud:HUD, score:0, kills:0, headshots:0, streak:0,
  zombiePerks:{},          // Kino perk ownership (ironhide, ...)
  streakCounts:{ uav:0, hunter:0, carepackage:0, sentry:0, hellstorm:0, chopper:0, lodestar:0, vtol:0, nuke:0 },
  /* per-streak earn progress, independent per streak id. Fills 0→cost,
     caps at cost (never shows 105/100), and resets to 0 ONLY when that
     specific streak is activated. Other unlocked streaks keep their bars. */
  streakScore:{ uav:0, hunter:0, carepackage:0, sentry:0, hellstorm:0, chopper:0, lodestar:0, vtol:0, nuke:0 },
  streakGiven:{},

  player:{
    pos:new THREE.Vector3(),        // FEET position
    vel:new THREE.Vector3(),
    yaw:0, pitch:0,
    recoilPitch:0, recoilYaw:0,
    hp:100, maxHp:100, alive:true,
    eyeH:1.62, eyeHTarget:1.62,
    height:1.75, heightTarget:1.75,
    crouching:false, proning:false, diving:false,
    grounded:true, sprinting:false, ads:false,
    regenDelay:0, stamina:1,
    lastDamageFrom:null,
    camYOff:0,               // camera glide offset (smooths stair step-ups)
    diveT:0,                 // dolphin dive timer
    get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
  },

  arms:null,            // { primary:{def,mag,reserve,att}, secondary:{...} }
  slot:'primary',
  fireTimer:0, reloadT:-1, reloadDur:0,
  swapT:0, meleeCd:0, nadeCd:0, cookT:0,
  bloom:0, viewKick:0,
  shakeT:0, shakeAmp:0,
  throwables:{ frag:0, tac:0 }, throwNames:{},
  nades:[], rockets:[], pickups:[],
  spawnState:{ timer:0, time:0, difficulty:0 },
  _waveGivenAmmo:false,
  cooking:false,
  _burstRemaining:0,

  /* =====================================================
     LIFECYCLE
     ===================================================== */
  init(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    camera.rotation.order = 'YXZ';
    // HUD.init() is called once from main.js boot() — not here, to avoid
    // re-creating the enemy-indicator DOM elements on every init call.
  },

  /* Start a Kino run. This standalone build never exposes survival, so it
     always builds the Zombies map even if a legacy caller omits opts. */
  start(opts) {
    const kino = true;
    this.mode = 'zombies';
    this.zombiePerks = {};
    const cls = Loadout.current;
    if (this._goTimer) { clearTimeout(this._goTimer); this._goTimer = null; }
    document.getElementById('gameover-screen').classList.add('hidden');
    if (typeof MenuManager !== 'undefined' && MenuManager.current &&
        MenuManager.current.indexOf('kino-') === 0) MenuManager.hideAll();

    MapData.dispose(this.scene);   // clean any previous map before building
    if (kino) {
      buildKinoDerToten(this.scene);
    } else {
      const mapDef = MAPS[MapRotation.current];
      if (mapDef && MapData[mapDef.builder]) MapData[mapDef.builder](this.scene);
      else MapData.buildCargo17(this.scene);
    }

    Effects.init(this.scene, MapData.colliders);
    BotManager.init(this.scene);
    Killstreaks.init(this.scene);
    if (kino && typeof Zombies !== 'undefined') Zombies.init(this.scene);
    if (this.scene.userData.mainCamera !== this.camera)
      this.scene.userData.mainCamera = this.camera;

    /* ---------- weapons / ammo (apply attachments) ---------- */
    const clsAtt = cls.attachments || { optic:'none', barrel:'none' };
    const clsCamo = cls.camo || 'default';
    const mk = (id) => {
      const base = WEAPONS[id];
      // clamp attachments to this weapon's allow-lists (knife/launcher take
      // no optics — a stray class attachment must not leak onto them)
      const allow = base.attachments || { optic:['none'], barrel:['none'] };
      const att = {
        optic:  allow.optic.includes(clsAtt.optic)  ? clsAtt.optic  : 'none',
        barrel: allow.barrel.includes(clsAtt.barrel) ? clsAtt.barrel : 'none'
      };
      const o = ATTACHMENTS.optic[att.optic] || ATTACHMENTS.optic.none;
      const b = ATTACHMENTS.barrel[att.barrel] || ATTACHMENTS.barrel.none;
      return {
        def: Object.assign({}, base, {
          damage: base.damage * b.dmgMult,
          range: base.range * b.rangeMult,
          recoil: base.recoil * o.recoilMult * b.recoilMult,
          spread: base.spread * o.spreadMult,
          hipSpread: base.hipSpread * o.spreadMult,
          adsSpread: base.adsSpread * o.spreadMult,
          adsFov: base.adsFov * o.adsMult,
          adsTime: base.adsTime * o.adsMult
        }),
        mag: base.mag, reserve: base.reserve, att, camo: clsCamo
      };
    };
    this.arms = {
      primary: mk(cls.primary),
      secondary: mk(cls.secondary)
    };
    this.slot = 'primary';
    Viewmodel.init(this.camera);
    Viewmodel.weaponId = null;
    Viewmodel.setWeapon(cls.primary, this.arms.primary.att, clsCamo);

    /* ---------- player ---------- */
    const p = this.player;
    p.pos.copy(MapData.playerSpawn);
    p.vel.set(0,0,0);
    p.yaw = MapData.playerYaw; p.pitch = 0;
    p.recoilPitch = p.recoilYaw = 0;
    p.hp = p.maxHp = 100;
    p.alive = true;
    p.crouching = p.proning = p.diving = p.sprinting = p.ads = false;
    p.height = p.heightTarget = 1.75;
    p.eyeH = p.eyeHTarget = 1.62;
    p.stamina = 1;
    p.regenDelay = 0;
    p.camYOff = 0;
    p.diveT = 0;

    /* ---------- run state ---------- */
    this.score = 0; this.difficulty = 0; this.kills = 0; this.headshots = 0; this.streak = 0;
    for (const k in this.streakCounts) this.streakCounts[k] = 0;   // keys live in the object literal
    if (this.streakScore) for (const k in this.streakScore) this.streakScore[k] = 0;
    this._streakMarked = {};
    this.nades = []; this.rockets = []; this.pickups = [];
    this.reloadT = -1; this.fireTimer = 0; this.bloom = 0;
    this.meleeCd = 0; this.nadeCd = 0; this.shakeT = 0;
    this.throwNames = {
      frag: LETHALS[cls.lethal].name,
      tac: TACTICALS[cls.tactical].name
    };
    this.equipMax = { frag: LETHALS[cls.lethal].count + (this.hasPerk('bandolier') ? 1 : 0),
                      tac: TACTICALS[cls.tactical].count + (this.hasPerk('bandolier') ? 1 : 0) };
    this.throwables = { frag:this.equipMax.frag, tac:this.equipMax.tac };
    this.lethalId = cls.lethal; this.tacId = cls.tactical;
    this.spawnState = { timer:0, time:0, difficulty:0 };
    this.cooking = false;
    this._burstRemaining = 0;
    Effects.clear();

    /* ---------- HUD ---------- */
    HUD.show(true);
    HUD.resetFx();
    HUD.setScore(0, 0, 0, 0);
    HUD.setHealth(100);
    HUD.setStreaks(this);
    this._syncAmmoHUD();
    HUD.setEquipment(this.throwNames.frag, this.throwables.frag,
                     this.throwNames.tac, this.throwables.tac);
    if (kino) {
      if (typeof KinoHUD !== 'undefined') KinoHUD.show(true);
      HUD.setMapName(KinoMapDefinition.name);
    } else {
      if (typeof KinoHUD !== 'undefined') KinoHUD.show(false);
      HUD.setMapName(MapRotation.get().name);
    }

    /* ---------- audio ---------- */
    AudioFX.init(); AudioFX.resume();
    AudioFX.startAmbient();

    this.state = 'playing';

    if (kino) {
      /* ---------- Zombies run wiring ---------- */
      KinoGameState.set(KinoGameState.STATES.PLAYING);
      PointsEconomy.init(KinoMapDefinition.economy);
      BarricadeSystem.init(this.scene);
      InteractionSystem.init(this.camera);
      RoundManager.init();
      RoundManager.start();
      HUD.announce(KinoMapDefinition.name, 'SURVIVE THE ROUNDS');
      AudioFX.announce();
    } else {
      HUD.announce(MapRotation.get().name, 'SURVIVE');
      AudioFX.announce();
    }
  },

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.mode === 'zombies') {
      if (typeof KinoGameState !== 'undefined')
        KinoGameState.set(KinoGameState.STATES.PAUSED);
      if (typeof MenuManager !== 'undefined') MenuManager.showPause();
      Input.exitLock();
      return;
    }
    Input.exitLock();
    document.getElementById('pause-screen').classList.remove('hidden');
  },

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    AudioFX.resume();
    if (this.mode === 'zombies') {
      if (typeof KinoGameState !== 'undefined')
        KinoGameState.set(KinoGameState.STATES.PLAYING);
      if (typeof MenuManager !== 'undefined') MenuManager.hidePause();
      Input.requestLock(this.renderer.domElement);
      return;
    }
    document.getElementById('pause-screen').classList.add('hidden');
    Input.requestLock(this.renderer.domElement);
  },

  quit() {
    this.state = 'idle';
    HUD.show(false);
    if (typeof KinoHUD !== 'undefined') KinoHUD.show(false);
    Input.exitLock();
    AudioFX.stopAmbient();
    BotManager.clear();
    Killstreaks.clear();
    if (typeof Zombies !== 'undefined') Zombies.clear();
    if (typeof BarricadeSystem !== 'undefined') BarricadeSystem.clear();
    if (typeof InteractionSystem !== 'undefined') InteractionSystem.clear();
    for (const n of this.nades) if (n.group.parent) n.group.parent.remove(n.group);
    for (const r of this.rockets) if (r.group.parent) r.group.parent.remove(r.group);
    for (const p of this.pickups) if (p.group.parent) p.group.parent.remove(p.group);
    this.nades = []; this.rockets = []; this.pickups = [];
    MapData.dispose(this.scene);
    Effects.clear();
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('sniper-scope').classList.add('hidden');
    HUD.setScope(false);
    if (this.mode === 'zombies') {
      if (typeof KinoGameState !== 'undefined')
        KinoGameState.set(KinoGameState.STATES.MAIN_MENU);
      if (typeof MenuManager !== 'undefined') MenuManager.hideAll();
    }
    this.mode = 'survival';
  },

  die(cause, killer) {
    if (this.state !== 'playing') return;
    const p = this.player;
    p.alive = false;
    this.state = 'dead';
    Input.exitLock();
    Input.reset();          // clear held keys so no direction persists after death
    /* if the player dies while a remote streak cam is up, drop it now —
       otherwise respawn() would put them straight back into the frozen
       lodestar/hellstorm camera with no way to steer out */
    if (Killstreaks.camMode) {
      const h = Killstreaks.hellstorm;
      if (h) {
        if (h.group.parent) h.group.parent.remove(h.group);
        for (const s of h.trail) { s.mesh.visible = false; Killstreaks.hsPuffPool.push(s.mesh); }
        h.trail = [];
      }
      Killstreaks._endCamMode(this);
    }
    HUD.setScope(false);
    AudioFX.explosion(p.eye.clone(), false);
    AudioFX.stopAmbient();

    /* ---------- Zombies: no auto-respawn ---------- */
    if (this.mode === 'zombies') {
      if (typeof KinoGameState !== 'undefined') {
        KinoGameState.emit('player:downed', { round:RoundManager.round });
        KinoGameState.set(KinoGameState.STATES.GAME_OVER);
        KinoGameState.emit('game:over', {
          round: RoundManager.round,
          points: PointsEconomy.total,
          kills: this.kills,
          headshots: this.headshots
        });
      }
      if (typeof KinoHUD !== 'undefined') KinoHUD.setPrompt('', 0);
      if (typeof MenuManager !== 'undefined') MenuManager.showGameOver();
      return;
    }

    // show "RESPAWNING..." overlay instead of static gameover screen
    const go = document.getElementById('gameover-screen');
    go.classList.remove('hidden');
    document.getElementById('go-title').textContent = 'RESPAWNING…';
    document.getElementById('go-respawning').style.display = 'block';
    document.getElementById('btn-retry').style.display = 'none';
    document.getElementById('btn-go-loadout').style.display = 'inline-block';
    document.getElementById('btn-go-menu').style.display = 'inline-block';
    // show final score / kills / headshots on the death screen
    document.getElementById('go-score').textContent = this.score;
    document.getElementById('go-kills').textContent = this.kills;
    document.getElementById('go-wave').textContent = Math.floor(this.difficulty / 5) + 1;
    document.getElementById('go-head').textContent = this.headshots;
    // auto respawn after 3 seconds, keeping score/kills/streak
    this.restartRespawnTimer();
  },

  /* (re)start the 3-second auto-respawn countdown on the gameover screen.
     Used both on death and when returning from the loadout screen so the
     player isn't left stuck on "RESPAWNING…" forever. */
  restartRespawnTimer() {
    if (this._goTimer) clearTimeout(this._goTimer);
    const go = document.getElementById('gameover-screen');
    this._goTimer = setTimeout(() => {
      if (this.state === 'dead') {
        this.respawn();
        go.classList.add('hidden');
        document.getElementById('btn-retry').style.display = 'inline-block';
        document.getElementById('btn-go-loadout').style.display = 'inline-block';
        document.getElementById('btn-go-menu').style.display = 'inline-block';
        document.getElementById('go-title').textContent = 'K.I.A.';
        if (Input.locked || Game.state === 'playing') {
          setTimeout(() => Input.requestLock(this.renderer.domElement), 60);
        }
      }
    }, 3000);
  },

  respawn() {
    if (this._goTimer) { clearTimeout(this._goTimer); this._goTimer = null; }
    const cls = Loadout.current;

    /* ---------- re-apply weapons / ammo (apply attachments) ---------- */
    const clsAtt = cls.attachments || { optic:'none', barrel:'none' };
    const clsCamo = cls.camo || 'default';
    const mk = (id) => {
      const base = WEAPONS[id];
      // clamp attachments to this weapon's allow-lists (knife/launcher take
      // no optics — a stray class attachment must not leak onto them)
      const allow = base.attachments || { optic:['none'], barrel:['none'] };
      const att = {
        optic:  allow.optic.includes(clsAtt.optic)  ? clsAtt.optic  : 'none',
        barrel: allow.barrel.includes(clsAtt.barrel) ? clsAtt.barrel : 'none'
      };
      const o = ATTACHMENTS.optic[att.optic] || ATTACHMENTS.optic.none;
      const b = ATTACHMENTS.barrel[att.barrel] || ATTACHMENTS.barrel.none;
      return {
        def: Object.assign({}, base, {
          damage: base.damage * b.dmgMult,
          range: base.range * b.rangeMult,
          recoil: base.recoil * o.recoilMult * b.recoilMult,
          spread: base.spread * o.spreadMult,
          hipSpread: base.hipSpread * o.spreadMult,
          adsSpread: base.adsSpread * o.spreadMult,
          adsFov: base.adsFov * o.adsMult,
          adsTime: base.adsTime * o.adsMult
        }),
        mag: base.mag, reserve: base.reserve, att, camo: clsCamo
      };
    };
    this.arms = {
      primary: mk(cls.primary),
      secondary: mk(cls.secondary)
    };
    this.slot = 'primary';
    Viewmodel.weaponId = null;
    Viewmodel.setWeapon(cls.primary, this.arms.primary.att, clsCamo);

    this.reloadT = -1; this.fireTimer = 0; this.bloom = 0;
    this.meleeCd = 0; this.nadeCd = 0;
    this.throwNames = {
      frag: LETHALS[cls.lethal].name,
      tac: TACTICALS[cls.tactical].name
    };
    this.equipMax = { frag: LETHALS[cls.lethal].count + (this.hasPerk('bandolier') ? 1 : 0),
                      tac: TACTICALS[cls.tactical].count + (this.hasPerk('bandolier') ? 1 : 0) };
    this.throwables = { frag:this.equipMax.frag, tac:this.equipMax.tac };
    this.lethalId = cls.lethal; this.tacId = cls.tactical;
    this.cooking = false;
    this._burstRemaining = 0;
    Effects.clear();

    const p = this.player;
    p.pos.copy(MapData.playerSpawn);
    p.vel.set(0,0,0);
    p.yaw = MapData.playerYaw; p.pitch = 0;
    p.recoilPitch = p.recoilYaw = 0;
    p.hp = p.maxHp = 100;
    p.alive = true;
    p.crouching = p.proning = p.diving = p.sprinting = p.ads = false;
    p.height = p.heightTarget = 1.75;
    p.eyeH = p.eyeHTarget = 1.62;
    p.stamina = 1;
    p.regenDelay = 0;
    p.camYOff = 0;
    p.diveT = 0;
    this.state = 'playing';
    Input.reset();          // safety: force zero input on respawn
    HUD.setHealth(100);
    HUD.setScope(false);
    HUD.resetFx();
    this._syncAmmoHUD();
    HUD.setEquipment(this.throwNames.frag, this.throwables.frag,
                     this.throwNames.tac, this.throwables.tac);
  },

  /* =====================================================
     PERKS
     ===================================================== */
  hasPerk(id) { return Loadout.current.perk1 === id || Loadout.current.perk2 === id ||
                   Loadout.current.perk3 === id; },

  /* =====================================================
     INPUT / UPDATE
     ===================================================== */
  update(dt) {
    if (this.state !== 'playing') return;
    // safety: weapons must be initialized (via start()/respawn()) before the
    // loop can run. Guarding here prevents a crash if state is set to 'playing'
    // without arms being set (e.g. by test harnesses that bypass Game.start()).
    if (!this.arms) return;
    const p = this.player;

    /* ---------- killstreak camera takeover (Hellstorm / Lodestar): the
           player is pinned while the remote view is up; mouse look steers
           the streak camera and Killstreaks owns the camera for now ---------- */
    if (Killstreaks.camMode && this.mode === 'survival') {
      // pin the player: hide the viewmodel (gun + arms) so nothing blocks the
      // remote streak camera, then hand input + camera over to Killstreaks
      if (typeof Viewmodel !== 'undefined' && Viewmodel.root)
        Viewmodel.root.visible = false;
      Killstreaks.steer(Input.lookDelta(), Input.fire(), this);
      this.hud.setCrosshair(999, true);
      this.hud.setScope(false);
      try { Killstreaks.update(dt, this); } catch (e) { console.error('killstreak update error:', e); }
      /* keep the world ticking while the remote cam is up. Skipping these
         here froze every AI bot mid-stride AND never aged Effects, so
         tracer beams hung frozen in the air for the whole streak. */
      const wt = performance.now() / 1000;
      MapData.update(wt);
      Effects.update(dt);
      try { BotManager.update(dt, p, this); } catch (e) { console.error('bot update error:', e); }
      this._updateNades(dt);
      this._updateRockets(dt);
      this._updatePickups(dt);
      this._updateSpawns(dt);
      HUD.update(dt);
      return;
    }

    /* ---------- look ---------- */
    const look = Input.lookDelta();
    let sens = Settings.data.sensitivity * 0.0022;
    if (p.ads) sens *= (Viewmodel.isAds() ? 0.55 : 0.8);
    p.yaw -= look.x * sens;
    p.pitch -= look.y * sens;
    p.pitch = THREE.MathUtils.clamp(p.pitch, -1.52, 1.52);

    /* ---------- consume the jump edge ONCE: the dive check below and the
           regular jump check both need it, and Input.pressed() eats the
           edge on first read (double-read made normal jump impossible) --- */
    const jumpPressed = Input.pressed('jump');

    /* ---------- dolphin dive (crouch + jump while sprinting) ---------- */
    if (jumpPressed && p.sprinting && p.grounded && !p.proning && !p.diving &&
        Input.down('crouch')) {
      p.diving = true;
      p.diveT = 1.2;
      p.crouching = false;
      p.proning = false;
      p.grounded = false;
      const fwdX = -Math.sin(p.yaw), fwdZ = -Math.cos(p.yaw);
      const spd = Math.hypot(p.vel.x, p.vel.z);
      p.vel.x = fwdX * Math.max(spd, 10);
      p.vel.z = fwdZ * Math.max(spd, 10);
      p.vel.y = 2.0;
      AudioFX.footstep(0.3);
    }
    if (p.diving) {
      p.diveT -= dt;
      p.vel.y -= 22 * dt;
      if (p.vel.y < -40) p.vel.y = -40;
      p.vel.x *= Math.pow(0.95, dt * 30);
      p.vel.z *= Math.pow(0.95, dt * 30);
      if (p.diveT <= 0) {
        p.diving = false;
        p.proning = true;
        p._justDove = true;
        p.heightTarget = 0.72;
        p.eyeHTarget = 0.5;
      }
    }

    /* ---------- stance ---------- */
    if (!p.diving) {
      const wantCrouch = Input.down('crouch');
      const wantProne = Input.down('prone');
      if (wantProne && p.grounded && !p.sprinting) { p.proning = true; p.crouching = false; }
      else if (wantCrouch && p.grounded) { p.crouching = true; p.proning = false; }
      else if (!wantCrouch && !wantProne && !p._justDove) { p.crouching = false; p.proning = false; }
      p._justDove = false;
      if (p.proning) { p.heightTarget = 0.72; p.eyeHTarget = 0.5; }
      else if (p.crouching) { p.heightTarget = 1.15; p.eyeHTarget = 1.0; }
      else { p.heightTarget = 1.75; p.eyeHTarget = 1.62; }
    }
    p.height += (p.heightTarget - p.height) * Math.min(1, dt * 12);
    p.eyeH += (p.eyeHTarget - p.eyeH) * Math.min(1, dt * 12);

    /* ---------- movement ---------- */
    const axis = Input.moveAxis();
    const cur = this.curWeapon();
    const def = cur.def;
    p.ads = Input.ads() && !Viewmodel.isBusy() && !def.melee && !p.diving;

    const wantSprint = Input.down('sprint') && axis.y > 0.4 && !p.ads &&
                       !p.proning && !p.diving && p.stamina > 0.02;
    if (p.sprinting && (!wantSprint || axis.y <= 0.1)) p.sprinting = false;
    if (!p.sprinting && wantSprint && p.grounded) p.sprinting = true;
    if (p.sprinting && (p.ads || axis.y <= 0.1 || p.diving)) p.sprinting = false;

    const marathon = this.hasPerk('marathon');
    if (p.sprinting) {
      p.stamina -= dt / (marathon ? 1e9 : 3.6);
      if (p.stamina <= 0) { p.stamina = 0; p.sprinting = false; }
    } else {
      p.stamina = Math.min(1, p.stamina + dt / 2.4);
    }
    if (p.sprinting && this.reloadT >= 0) this._cancelReload();

    const lw = this.hasPerk('lightweight') ? 1.15 : 1;
    let speed = 5.7 * lw;
    if (p.sprinting) speed = 8.4 * lw;
    if (p.proning) speed = 1.7;
    else if (p.crouching) speed = 3.1;
    if (Viewmodel.isAds()) speed *= 0.52;
    else if (p.ads) speed *= 0.7;
    if (def.melee) speed *= 1.05;
    if (p.diving) speed = 0;

    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw),  rz = -Math.sin(p.yaw);
    const dvx = (fx * axis.y + rx * axis.x) * speed;
    const dvz = (fz * axis.y + rz * axis.x) * speed;

    const accel = p.grounded ? 12 : 3.5;
    if (!p.diving) {
      p.vel.x += (dvx - p.vel.x) * Math.min(1, dt * accel);
      p.vel.z += (dvz - p.vel.z) * Math.min(1, dt * accel);
    }

    // jump — always a regular jump, dolphin dive moved to crouch+jump
    if (jumpPressed && p.grounded && !p.proning && !p.diving) {
      p.vel.y = 7.0;
      p.grounded = false;
      AudioFX.footstep(0.1);
    }
    if (jumpPressed && p.proning) { p.proning = false; }
    if (!p.diving) {
      p.vel.y -= 22 * dt;
      if (p.vel.y < -40) p.vel.y = -40;
    }

    // integrate + collide
    const half = new THREE.Vector3(0.35, p.height / 2, 0.35);
    const moveDist = Math.hypot(p.vel.x * dt, p.vel.y * dt, p.vel.z * dt);
    const nsub = Math.min(8, Math.max(1, Math.ceil(moveDist / 0.22)));
    const sdt = dt / nsub;
    let grounded = false, ceiling = false;
    for (let s = 0; s < nsub; s++) {
      const center = new THREE.Vector3(p.pos.x, p.pos.y + half.y, p.pos.z);
      center.addScaledVector(p.vel, sdt);
      const res = resolveCollision(center, half, MapData.colliders, 0.5,
                                   { x: p.vel.x, y: p.vel.y, z: p.vel.z });
      if (res.stepRise > 0) p.camYOff += res.stepRise;
      if (res.pushX < 0 && p.vel.x > 0) p.vel.x = 0;
      if (res.pushX > 0 && p.vel.x < 0) p.vel.x = 0;
      if (res.pushZ < 0 && p.vel.z > 0) p.vel.z = 0;
      if (res.pushZ > 0 && p.vel.z < 0) p.vel.z = 0;
      if (res.grounded) grounded = true;
      if (res.ceiling) ceiling = true;
      p.pos.set(center.x, center.y - half.y, center.z);
    }

    // sanity: never let NaN positions break the loop (killstreak explosions,
    // bad collisions etc. can push NaN into the transform chain and freeze it)
    if (!isFinite(p.pos.x) || !isFinite(p.pos.y) || !isFinite(p.pos.z) ||
        !isFinite(p.vel.x) || !isFinite(p.vel.y) || !isFinite(p.vel.z)) {
      p.pos.copy(MapData.playerSpawn || new THREE.Vector3(0, 0.4, 0));
      p.vel.set(0, 0, 0);
      p.grounded = true;
    }

    if (grounded && p.vel.y <= 0.01 && !p.diving) {
      const g = MapData.groundAt(p.pos.x, p.pos.y + 0.05, p.pos.z);
      if (g > -900 && p.pos.y - g > 0.005 && p.pos.y - g <= 0.6) {
        p.pos.y = g;
      }
    }

    if (grounded && !p.diving) {
      if (p.vel.y < 0) p.vel.y = 0;
      p.grounded = true;
    } else if (!p.diving) p.grounded = false;
    if (ceiling && p.vel.y > 0) p.vel.y = 0;

    if (p.pos.y < -4) { this.onPlayerHit(999, p.pos, false); }

    // footsteps
    const planar = Math.hypot(p.vel.x, p.vel.z);
    if (p.grounded && planar > 1.4 && !p.diving) {
      this._stepT = (this._stepT || 0) + dt * planar * 0.62;
      if (this._stepT > 1) {
        this._stepT = 0;
        if (!this.hasPerk('deadSilence'))
          AudioFX.footstep(p.sprinting ? 0.2 : 0.12);
      }
    }

    /* ---------- weapon actions ---------- */
    this.fireTimer -= dt;
    this.meleeCd -= dt;
    this.nadeCd -= dt;
    if (this.swapT > 0) this.swapT -= dt;
    if (this.bloom > 0) this.bloom = Math.max(0, this.bloom - dt * 2.6);

    // frag cooking
    if (KeybindManager.down('frag') && this.throwables.frag > 0 && this.nadeCd <= 0 && !this.cooking) {
      this.cooking = true;
      this.cookT = 0;
    }
    if (this.cooking) {
      this.cookT += dt;
      if (KeybindManager.up('frag') || this.cookT >= LETHALS.frag.fuse) {
        this._throw('frag', this.cookT);
        this.cooking = false;
        this.cookT = 0;
      }
    }
    if (this.cooking && this.cookT >= LETHALS.frag.fuse) {
      this.cooking = false;
      this.cookT = 0;
      this._detonate({ pos: p.eye.clone(), isTac:false, id:'frag' });
      this.throwables.frag = Math.max(0, this.throwables.frag - 1);
      this._syncAmmoHUD();
    }

    // streak activation (digit keys 1/2/3)
    let digitUsed = false;
    for (let i = 1; i <= 4; i++) {
      const streakEdge = Input.pressed('streak' + i);
      const weaponEdge = Input.pressed('weapon' + i);
      if (!streakEdge && !weaponEdge) continue;
      digitUsed = true;
      const id = Loadout.current.streaks[i - 1];
      if (streakEdge && id !== 'none' && this.streakCounts[id] > 0) {
        Killstreaks.activate(id, this);
        HUD.setStreaks(this);
      } else if (i <= 2) {
        this._swap(i === 1 ? 'primary' : 'secondary');
      }
      break;
    }
    if (!digitUsed) {
      const wheel = Input.consumeWheel();
      if (wheel !== 0 && this.swapT <= 0 && !Viewmodel.isBusy())
        this._swap(this.slot === 'primary' ? 'secondary' : 'primary');
    }
    if (Input.pressed('weapon_swap') && this.swapT <= 0 && !Viewmodel.isBusy() && !p.sprinting)
      this._swap(this.slot === 'primary' ? 'secondary' : 'primary');

    // reload
    if (Input.pressed('reload')) this.reload();
    // melee
    if (Input.pressed('melee') && this.meleeCd <= 0 && !p.diving) this._melee();
    // throwables (only if not cooking)
    if (!this.cooking && Input.pressed('tactical') && this.nadeCd <= 0 && this.throwables.tac > 0) this._throw('tac');
    // inspect
    if (Input.pressed('inspect')) Viewmodel.inspect();

    // firing
    let wantFire = Input.fire() || Input.down('fire');
    if (def.melee) {
      if (wantFire && this.meleeCd <= 0 && !p.sprinting && !p.diving) this._melee();
    } else if (this.reloadT >= 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this._finishReload();
    } else if (this.swapT <= 0 && !p.sprinting && this.meleeCd <= 0 && !p.diving) {
      // burst fire handling
      if (this._burstRemaining > 0 && this.fireTimer <= 0 && cur.mag > 0) {
        this._burstShot(def);
        this._burstRemaining--;
        if (this._burstRemaining > 0) {
          this.fireTimer = def.burstDelay || 0.09;
        } else {
          this._burstRemaining = 0;
        }
      } else if (this._burstRemaining <= 0) {
        if (def.auto) {
          if (wantFire && this.fireTimer <= 0) this._burstShot(def);
        } else {
          if (wantFire && !this._firePrev && this.fireTimer <= 0) this._burstShot(def);
        }
        this._firePrev = wantFire;
      }
    } else {
      this._firePrev = false;
    }

    /* ---------- recoil recovery ---------- */
    const rec = (def.recoilRecover || 6);
    p.recoilPitch -= p.recoilPitch * Math.min(1, dt * rec);
    p.recoilYaw -= p.recoilYaw * Math.min(1, dt * rec);

    /* ---------- camera ---------- */
    const sprintKick = p.sprinting ? 6 : 0;
    const targetFov = (Settings.data.fov + sprintKick) * Viewmodel.adsFov(def);
    const cam = this.camera;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 10);
      cam.updateProjectionMatrix();
    }
    const eye = p.eye;
    p.camYOff *= Math.exp(-dt * 26);
    if (Math.abs(p.camYOff) < 0.001) p.camYOff = 0;
    let divePitch = 0;
    if (p.diving) divePitch = 0.6 * Math.sin(Math.PI * (1.2 - p.diveT) / 1.2);
    cam.position.set(eye.x, eye.y + p.camYOff + divePitch, eye.z);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeAmp);
      const t = performance.now() * 0.05;
      cam.position.x += Math.sin(t * 1.3) * 0.06 * k;
      cam.position.y += Math.cos(t * 1.7) * 0.06 * k;
    }
    cam.rotation.y = p.yaw + p.recoilYaw;
    cam.rotation.x = p.pitch + p.recoilPitch + divePitch;
    cam.rotation.z = 0;

    /* ---------- viewmodel ---------- */
    const sprintPose = p.sprinting && planar > 2;
    Viewmodel.update(dt, {
      w:def, ads:p.ads, sprint:sprintPose, moving:planar > 0.5,
      speed:planar, lookX:look.x, lookY:look.y, crouch:p.crouching
    });
    const spreadPx = this._crosshairGap(def);
    // hide the crosshair under ANY scope overlay — built-in sniper glass as
    // well as the acog / variable_zoom attachment overlays
    const scoped = !!(def.scope || cur.att.optic === 'acog' || cur.att.optic === 'variable_zoom');
    HUD.setCrosshair(spreadPx, p.ads && scoped);
    HUD.setScope((p.ads && Viewmodel.isAds()) ? (cur.att.optic === 'variable_zoom' ? 'zoom' : cur.att.optic === 'acog' ? 'acog' : (def.scope ? 'sniper' : false)) : false);
    HUD.setSprintVignette(p.sprinting && Settings.data.motionBlur);

    /* ---------- regen / damage state ---------- */
    if (p.alive && p.hp < p.maxHp) {
      p.regenDelay -= dt;
      if (p.regenDelay <= 0) p.hp = Math.min(p.maxHp, p.hp + 42 * dt);
      HUD.setHealth((p.hp / p.maxHp) * 100);
    }

    /* ---------- world updates ---------- */
    const t = performance.now() / 1000;
    MapData.update(t);
    Effects.update(dt);
    if (this.mode === 'zombies') {
      try { Zombies.update(dt, p, this); } catch (e) { console.error('zombie update error:', e); }
      try { BarricadeSystem.update(dt); } catch (e) { console.error('barricade update error:', e); }
      try { InteractionSystem.update(dt, this); } catch (e) { console.error('interaction update error:', e); }
      try { RoundManager.update(dt); } catch (e) { console.error('round update error:', e); }
    } else {
      try { BotManager.update(dt, p, this); } catch (e) { console.error('bot update error:', e); }
      try { Killstreaks.update(dt, this); } catch (e) { console.error('killstreak update error:', e); }
      this._updateSpawns(dt);
    }
    this._updateNades(dt);
    this._updateRockets(dt);
    this._updatePickups(dt);

    // audio listener
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0,1,0).applyQuaternion(cam.quaternion);
    AudioFX.listener(eye, fwd, up);

    // HUD
    HUD.update(dt);
    if (this.mode === 'zombies') {
      KinoHUD.update(dt, this);
    } else {
      HUD.setScore(Math.floor(this.score / 100) + 1, this.score, this.streak, BotManager.alive().length);
      HUD.setStreaks(this);
    }
    HUD.drawMinimap(this);

    const mb = document.getElementById('motionblur-overlay');
    if (mb && Settings.data.motionBlur) {
      mb.style.opacity = p.sprinting && planar > 4 ? 1 : 0;
    } else if (mb) mb.style.opacity = 0;

    if (p.hp <= 0 && p.alive) this.die();
  },

  _burstShot(def) {
    const cur = this.curWeapon();
    if (cur.mag <= 0) return;
    cur.mag--;
    this.fireTimer = 60 / def.rpm;
    this.bloom = Math.min(3.2, this.bloom + (def.recoil || 1) * 0.34);
    this._syncAmmoHUD();

    if (def.rocket) { this._fireRocket(def); }
    else { this._hitscan(def); }

    const adsMul = Viewmodel.isAds() ? 0.55 : 1;
    const k = def.kickPitch;
    this.player.recoilPitch += (k[0] + Math.random() * (k[1] - k[0])) * 0.011 * adsMul;
    this.player.recoilYaw += (Math.random() - 0.5) * (def.kickYaw || 0.5) * 0.014 * adsMul;
    Viewmodel.kick((def.recoil || 1) * adsMul);

    const suppressed = this.curWeapon().att.barrel === 'suppressor';
    AudioFX.shot(def.id === 'sniper' ? 'sniper' : def.id, this._camMuzzlePos(), 1, suppressed);
    const mz = new THREE.Vector3();
    Viewmodel.muzzleWorld(mz);
    Effects.muzzleFlash(mz, def.id === 'sniper' ? 0.55 : def.id === 'lmg' ? 0.5 : 0.42);
    this.shake(def.id === 'sniper' ? 0.09 : def.id === 'launcher' ? 0.3 : 0.05);

    const right = new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
    Effects.shell(mz.clone().addScaledVector(right, 0.12).addScaledVector(up, -0.05), right, up);
    if (Math.random() < 0.35) Effects.smoke(mz, 0.7, 0.7);
  },

  /* =====================================================
     WEAPONS
     ===================================================== */
  curWeapon() { return this.arms[this.slot]; },

  _swap(slot) {
    if (slot === this.slot) return;
    const other = this.arms[slot];
    if (!other) return;
    this._cancelReload();
    this.slot = slot;
    this.swapT = this.hasPerk('dexterity') ? 0.28 : 0.48;
    this.fireTimer = Math.max(this.fireTimer, this.swapT * 0.85);
    this.bloom = 0;
    Viewmodel.setWeapon(other.def.id, other.att, other.camo);
    AudioFX.reloadCycle(0.3, true);
    this._syncAmmoHUD();
  },

  reload() {
    if (this.state !== 'playing') return;
    const cur = this.curWeapon();
    const def = cur.def;
    if (def.melee || this.reloadT >= 0 || Viewmodel.isBusy()) return;
    if (cur.mag >= def.mag || cur.reserve <= 0) { if (cur.reserve <= 0) AudioFX.empty(); return; }
    this._cancelReload(true);
    const dex = this.hasPerk('dexterity');
    const dur = def.reload * (dex ? 0.78 : 1);
    this.reloadDur = dur;
    this.reloadT = dur;
    Viewmodel.startReload(dur);
    AudioFX.reloadCycle(dur, false);
  },

  _cancelReload(keepTimer) {
    if (this.reloadT >= 0 && !keepTimer) {
      this.reloadT = -1;
      Viewmodel.cancelReload();
    } else if (keepTimer) {
      this.reloadT = -1;
    }
  },

  _finishReload() {
    const cur = this.curWeapon();
    const def = cur.def;
    const need = def.mag - cur.mag;
    const take = Math.min(need, cur.reserve);
    cur.mag += take;
    cur.reserve -= take;
    this.reloadT = -1;
    this.bloom = 0;
    this._syncAmmoHUD();
  },

  _syncAmmoHUD() {
    const cur = this.curWeapon();
    if (!cur) return;
    HUD.setWeapon(cur.def.name, cur.def.alias + ' · ' + Loadout.current.name,
      cur.mag, cur.reserve, cur.mag === 0);
    HUD.setEquipment(this.throwNames.frag || '', this.throwables.frag,
                     this.throwNames.tac || '', this.throwables.tac);
  },

  _crosshairGap(def) {
    const spread = this._curSpread(def);
    const px = Math.tan(spread * Math.PI / 180) * 640;
    return 5 + px * 0.9 + this.bloom * 5;
  },

  _curSpread(def) {
    const p = this.player;
    let s;
    if (Viewmodel.isAds()) s = def.adsSpread;
    else if (p.ads) s = THREE.MathUtils.lerp(def.hipSpread, def.adsSpread, Viewmodel.adsLerp);
    else s = def.hipSpread;
    if (p.sprinting) s += 3.5;
    if (!p.grounded) s += 2;
    if (p.proning) s *= 0.7;
    if (p.diving) s *= 2;
    s += this.bloom * (def.spread || 1);
    return s;
  },

  _camMuzzlePos() {
    const v = new THREE.Vector3();
    Viewmodel.muzzleWorld(v);
    return v;
  },

  /* Enemies targeted by weapons for the current mode (bots or zombies). */
  enemies() {
    if (this.mode === 'zombies' && typeof Zombies !== 'undefined') return Zombies.zombies;
    return BotManager.bots;
  },

  /* Route a kill to survival scoring or to the Zombies economy. */
  _onEnemyKilled(enemy, headshot, cause) {
    if (this.mode === 'zombies') {
      if (typeof Zombies !== 'undefined') Zombies.onKill(enemy, headshot, cause);
      return;
    }
    this.onBotKilled(enemy, headshot, cause);
  },

  /* Replace the primary weapon with an existing definition (Mystery Box). */
  giveWeapon(id) {
    const base = WEAPONS[id];
    if (!base) return false;
    const clsAtt = Loadout.current.attachments || { optic:'none', barrel:'none' };
    const allow = base.attachments || { optic:['none'], barrel:['none'] };
    const att = {
      optic:  allow.optic.includes(clsAtt.optic)  ? clsAtt.optic  : 'none',
      barrel: allow.barrel.includes(clsAtt.barrel) ? clsAtt.barrel : 'none'
    };
    const camo = Loadout.current.camo || 'default';
    this.arms.primary = {
      def: Object.assign({}, base),
      mag: base.mag, reserve: base.reserve, att, camo
    };
    this.slot = 'primary';
    this.reloadT = -1;
    this.swapT = 0;
    this.bloom = 0;
    if (Viewmodel.cancelReload) Viewmodel.cancelReload();
    Viewmodel.setWeapon(id, att, camo);
    this._syncAmmoHUD();
    return true;
  },

  _hitscan(def) {
    const p = this.player;
    const origin = p.eye;
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);

    const spread = this._curSpread(def) * Math.PI / 180;
    if (spread > 0.0005) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const right = new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
      dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
    }

    const wallHit = MapData.rayTest(origin, dir, def.range * 3);
    const wallDist = wallHit ? wallHit.dist : def.range * 3;

    let botHit = null, botDist = Infinity;
    for (const b of this.enemies()) {
      const h = b.rayHit(origin, dir, Math.min(wallDist, def.range * 3));
      if (h && h.dist < botDist) { botDist = h.dist; botHit = { bot:b, head:h.head }; }
    }

    const muzzle = this._camMuzzlePos();
    let end;
    if (botHit && botDist < wallDist) {
      end = origin.clone().addScaledVector(dir, botDist);
      const dist = botDist;
      let dmg = def.damage;
      if (dist > def.range) {
        const over = Math.min(1, (dist - def.range) / def.range);
        dmg *= (1 - over * 0.45);
      }
      if (botHit.head) dmg *= def.headMul;
      const killed = botHit.bot.damage(dmg, botHit.head);
      Effects.impact(end, dir.clone().negate(), false, true);
      this.hud.hitmarker(killed);
      if (killed) this._onEnemyKilled(botHit.bot, botHit.head, 'gun');
      else if (botHit.bot.state === 'patrol') botHit.bot.state = 'hunt';
    } else if (wallHit) {
      const hitNorm = wallHit.normal;
      const dot = dir.dot(hitNorm);
      if (dot > -0.35 && dot < 0.35) {
        const reflect = dir.clone().addScaledVector(hitNorm, -2 * dot).normalize();
        const ricDist = def.range * 0.6;
        const ricHit = MapData.rayTest(wallHit.point, reflect, ricDist);
        Effects.tracer(muzzle, wallHit.point, def.tracer, 0x00ff00);
        AudioFX.impact(wallHit.point, wallHit.collider.metal, true);
        if (ricHit) {
          Effects.tracer(wallHit.point, ricHit.point, def.tracer, 0x00ff00);
          Effects.impact(ricHit.point, reflect.clone().negate(), false, true);
          for (const b of this.enemies()) {
            const h = b.rayHit(wallHit.point, reflect, ricDist);
            if (h && h.dist < ricDist) {
              const dmg = def.damage * 0.7;
              const killed = b.damage(dmg, h.head);
              this.hud.hitmarker(killed);
              if (killed) this._onEnemyKilled(b, h.head, 'gun');
              break;
            }
          }
        }
        return;
      }
      end = wallHit.point.clone();
      Effects.impact(end, wallHit.normal, wallHit.collider.metal, false);
      AudioFX.impact(end, wallHit.collider.metal);
    } else {
      end = origin.clone().addScaledVector(dir, 300);
    }
    Effects.tracer(muzzle, end, def.tracer);
  },

  _melee() {
    if (this.meleeCd > 0) return;
    const dex = this.hasPerk('dexterity');
    this.meleeCd = dex ? 0.45 : 0.7;
    Viewmodel.meleeSwing();
    AudioFX.impact(this._camMuzzlePos(), true);
    const p = this.player;
    const origin = p.eye;
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    let best = null, bd = WEAPONS.knife.range;
    for (const b of this.enemies()) {
      const h = b.rayHit(origin, dir, bd);
      if (h && h.dist < bd) { bd = h.dist; best = b; }
    }
    if (best) {
      const killed = best.damage(150, false);
      Effects.impact(origin.clone().addScaledVector(dir, bd), dir.clone().negate(), false, true);
      this.hud.hitmarker(killed);
      if (killed) this._onEnemyKilled(best, false, 'melee');
    }
  },

  _fireRocket(def) {
    const origin = this._camMuzzlePos();
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8),
      new THREE.MeshStandardMaterial({ color:0x5b6350, roughness:0.6, metalness:0.4 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const flame = new THREE.PointLight(0xff8030, 3, 8, 2);
    g.add(flame);
    g.position.copy(origin);
    g.lookAt(origin.clone().add(dir));
    this.scene.add(g);
    this.rockets.push({ group:g, pos:g.position, vel:dir.clone().multiplyScalar(42), life:4, def });
    this.shake(0.3);
  },

  _updateRockets(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.vel.y -= 3.5 * dt;
      const step = r.vel.clone().multiplyScalar(dt);
      const dist = step.length();
      const dir = step.clone().normalize();
      const hit = MapData.rayTest(r.pos, dir, dist + 0.2);
      let botHit = null, botDist = Infinity;
      for (const b of this.enemies()) {
        const h = b.rayHit(r.pos, dir, dist + 0.6);
        if (h && h.dist < botDist) { botDist = h.dist; botHit = b; }
      }
      if (botHit && botDist < (hit ? hit.dist : dist + 0.6) + 0.4) {
        this._explode(r.pos.clone(), 7, 180, r.def.id);
        this.scene.remove(r.group);
        this.rockets.splice(i, 1);
        continue;
      }
      if (hit) {
        this._explode(hit.point.clone(), 7, 180, r.def.id);
        this.scene.remove(r.group);
        this.rockets.splice(i, 1);
        continue;
      }
      r.pos.addScaledVector(r.vel, dt);
      if (Math.random() < 0.8) Effects.smoke(r.pos.clone(), 0.6, 0.5);
      if (r.life <= 0) {
        this._explode(r.pos.clone(), 6, 140, r.def.id);
        this.scene.remove(r.group);
        this.rockets.splice(i, 1);
      }
    }
  },

  _explode(pos, radius, dmg, cause) {
    Effects.explosion(pos, radius);
    this.shake(0.35);
    const flak = this.hasPerk('flak');
    for (const b of this.enemies()) {
      if (!b.alive) continue;
      const d = b.chest.distanceTo(pos);
      if (d < radius) {
        const fall = 1 - (d / radius) * 0.65;
        const killed = b.damage(dmg * fall, false);
        if (killed) this._onEnemyKilled(b, false, cause || 'explosive');
      }
    }
    const p = this.player;
    const pd = p.eye.distanceTo(pos);
    if (pd < radius && p.alive) {
      const fall = 1 - (pd / radius) * 0.75;
      this.onPlayerHit(dmg * fall * 0.8 * (flak ? 0.45 : 1), pos, true);
    }
  },

  shake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp * 0.5, amp);
    this.shakeT = Math.max(this.shakeT, amp);
  },

  /* =====================================================
     THROWABLES
     ===================================================== */
  _throw(kind, cookT = 0) {
    const p = this.player;
    const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
    const origin = p.eye.clone().addScaledVector(dir, 0.4);
    const speed = (this.hasPerk('fastHands') ? 16 : 13);
    const id = kind === 'frag' ? this.lethalId : this.tacId;
    const def = kind === 'frag' ? LETHALS[id] : TACTICALS[id];

    let fuse = def.fuse || (kind === 'tac' ? 1.6 : 3.2);
    if (kind === 'frag' && cookT > 0) {
      fuse = Math.max(0.3, def.fuse - cookT);
    }

    const g = new THREE.Group();
    const isTac = kind === 'tac';
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: isTac ? 0x3b6ea5 : (id === 'semtex' ? 0x8c3320 : 0x4a5040),
        roughness:0.7, metalness:0.3 }));
    g.add(body);
    g.position.copy(origin);
    this.scene.add(g);

    this.nades.push({
      group:g, pos:g.position,
      vel:dir.clone().multiplyScalar(speed).add(new THREE.Vector3(0, 2.2, 0)),
      fuse: fuse,
      kind, id, def, stuck:false,
      sticky: !!(def && def.sticky),
      isTac
    });

    this.throwables[kind]--;
    this.nadeCd = this.hasPerk('fastHands') ? 0.45 : 0.8;
    this._syncAmmoHUD();
    AudioFX.blip(400, 0.08, 'triangle', 0.1);
    HUD.setEquipment(this.throwNames.frag, this.throwables.frag,
                     this.throwNames.tac, this.throwables.tac);
  },

  _updateNades(dt) {
    const p = this.player;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.fuse -= dt;
      if (!n.stuck) {
        n.vel.y -= 14 * dt;
        const step = n.vel.clone().multiplyScalar(dt);
        const dist = step.length();
        if (dist > 0.0001) {
          const dir = step.clone().normalize();
          const hit = MapData.rayTest(n.pos, dir, dist + 0.1);
          if (hit) {
            n.pos.copy(hit.point).addScaledVector(hit.normal, 0.1);
            const dot = n.vel.dot(hit.normal);
            n.vel.addScaledVector(hit.normal, -2 * dot).multiplyScalar(0.45);
            if (Math.abs(dot) > 1 && n.sticky) { n.stuck = true; n.vel.set(0,0,0); }
            AudioFX.impact(hit.point, hit.collider.metal);
          } else {
            for (const b of this.enemies()) {
              if (!b.alive) continue;
              const h = b.rayHit(n.pos, dir, dist + 0.35);
              if (h) {
                if (n.sticky) {
                  n.stuck = true;
                  n.stickTo = b;
                  n.vel.set(0,0,0);
                } else {
                  n.vel.multiplyScalar(-0.35);
                }
                break;
              }
            }
            if (!n.stuck) n.pos.add(step);
          }
        }
        if (n.pos.y < -4) { this.scene.remove(n.group); this.nades.splice(i,1); continue; }
      } else if (n.stickTo) {
        if (n.stickTo.alive) n.pos.copy(n.stickTo.chest);
        else n.stickTo = null;
      }

      if (n.fuse <= 0) {
        if (n.id === 'claymore') {
          // claymore is a proximity mine — only detonate when enemy near
          let triggered = false;
          for (const b of this.enemies()) {
            if (!b.alive) continue;
            if (n.pos.distanceTo(b.chest) < 2.5) { triggered = true; break; }
          }
          if (!triggered) continue; // keep waiting
        }
        this._detonate(n);
        this.scene.remove(n.group);
        this.nades.splice(i, 1);
      } else {
        n.group.rotation.x += dt * 6;
        n.group.rotation.z += dt * 4;
      }
    }
  },

  _detonate(n) {
    const pos = n.pos.clone();
    if (n.isTac) {
      if (n.id === 'flash') {
        Effects.explosion(pos, 2.5);
        AudioFX.flashbang();
        const p = this.player;
        const toN = pos.clone().sub(p.eye);
        const d = toN.length();
        const dir = toN.normalize();
        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
        const facing = fwd.dot(dir);
        if (d < 22 && facing > 0.15) {
          const k = Math.min(1, (1 - d / 22) * facing * 1.6);
          HUD.flash(0.55 + k * 0.45);
        }
        for (const b of this.enemies()) {
          if (!b.alive) continue;
          if (b.eye.distanceTo(pos) < 14) {
            if (MapData.losClear(pos, b.eye)) b.blindT = 5.5;
          }
        }
      } else {
        Effects.explosion(pos, 2);
        AudioFX.flashbang();
        for (const b of this.enemies()) {
          if (!b.alive) continue;
          if (b.eye.distanceTo(pos) < 11 && MapData.losClear(pos, b.eye)) {
            b.slowT = 5;
            b.blindT = Math.max(b.blindT, 1.6);
          }
        }
      }
      return;
    }
    if (n.id === 'smoke') {
      // smoke screen — visual cover
      Effects.explosion(pos, 5);
      for (let i = 0; i < 20; i++) {
        Effects.smoke(pos.clone().add(new THREE.Vector3(
          (Math.random()-0.5)*4, Math.random()*3, (Math.random()-0.5)*4)),
          3 + Math.random()*2, 4 + Math.random()*3);
      }
      AudioFX.explosion(pos, false);
      return;
    }
    if (n.id === 'claymore') {
      // proximity mine — already sitting on ground, explode on trigger
      Effects.explosion(pos, 5);
      this._explode(pos, 5, 160, 'claymore');
      AudioFX.explosion(pos, true);
      return;
    }
    const dmg = n.id === 'semtex' ? 150 : 140;
    this._explode(pos, 6.5, dmg, n.id);
  },

  /* =====================================================
     PICKUPS (bot drops)
     ===================================================== */
  _spawnPickup(pos, type) {
    const g = new THREE.Group();
    const col = type === 'ammo' ? 0x3f7a4a : 0xb06a20;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color:col, roughness:0.7, metalness:0.2,
        emissive:col, emissiveIntensity:0.25 }));
    box.castShadow = true;
    g.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.1, 0.42),
      new THREE.MeshStandardMaterial({ color:0xe8e8e8, emissive:0x444444 }));
    stripe.position.y = 0.12; g.add(stripe);
    g.position.copy(pos).setY(pos.y + 0.45);
    this.scene.add(g);
    this.pickups.push({ group:g, type, life:12, t:Math.random()*6 });
  },

  _updatePickups(dt) {
    const p = this.player;
    // cap live pickups so killstreak spam (which drops a box per bot kill)
    // can never pile up enough groups/meshes to hitch the loop
    const MAX_PICKUPS = 24;
    while (this.pickups.length > MAX_PICKUPS) {
      const old = this.pickups.shift();
      if (old.group.parent) old.group.parent.remove(old.group);
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt; pk.t += dt;
      pk.group.rotation.y += dt * 1.4;
      pk.group.position.y += Math.sin(pk.t * 3) * dt * 0.14;
      if (pk.life < 6) pk.group.visible = Math.sin(pk.t * 12) > -0.3;
      if (p.alive && p.pos.distanceTo(pk.group.position) < 1.6) {
        if (pk.type === 'ammo') {
          const cur = this.curWeapon();
          const gain = Math.ceil(cur.def.reserve * (this.hasPerk('scavenger') ? 1 : 0.45));
          this.arms.primary.reserve = Math.min(this.arms.primary.def.reserve,
            this.arms.primary.reserve + Math.ceil(gain * 0.7));
          this.arms.secondary.reserve = Math.min(this.arms.secondary.def.reserve,
            this.arms.secondary.reserve + Math.ceil(gain * 0.5));
          HUD.killfeed('+ <span class="hs">AMMO</span>');
        } else {
          if (this.throwables.frag < this.equipMax.frag) this.throwables.frag++;
          if (this.throwables.tac < this.equipMax.tac) this.throwables.tac++;
          HUD.killfeed('+ <span class="hs">GRENADES</span>');
        }
        AudioFX.pickup();
        this._syncAmmoHUD();
        this.scene.remove(pk.group);
        this.pickups.splice(i, 1);
        continue;
      }
      if (pk.life <= 0) {
        this.scene.remove(pk.group);
        this.pickups.splice(i, 1);
      }
    }
  },

  refillAmmo() {
    this.arms.primary.mag = this.arms.primary.def.mag;
    this.arms.primary.reserve = this.arms.primary.def.reserve;
    this.arms.secondary.mag = this.arms.secondary.def.mag;
    this.arms.secondary.reserve = this.arms.secondary.def.reserve;
    this._syncAmmoHUD();
  },
  refillGrenades() {
    this.throwables.frag = this.equipMax.frag;
    this.throwables.tac = this.equipMax.tac;
    HUD.setEquipment(this.throwNames.frag, this.throwables.frag,
                     this.throwNames.tac, this.throwables.tac);
  },

  /* =====================================================
     CONTINUOUS SPAWN (no rounds / waves)
     ===================================================== */
  _updateSpawns(dt) {
    const s = this.spawnState;
    s.time += dt;
    s.difficulty += dt * 0.02;

    const alive = BotManager.bots.filter(b => b.alive).length;
    const cap = Math.min(3 + Math.floor(s.difficulty) + Math.floor(this.kills / 4), 10);
    const interval = Math.max(0.4, 1.0 - s.difficulty * 0.1);

    if (alive < cap && s.timer <= 0) {
      s.timer = interval;
      let best = null, bd = -1;
      for (const sp of MapData.spawns) {
        const d = sp.distanceTo(this.player.pos);
        if (d > 12 && d < 60) {
          const r = Math.random() * d;
          if (r > bd) { bd = r; best = sp; }
        }
      }
      if (!best) best = MapData.spawns[Math.floor(Math.random() * MapData.spawns.length)];
      const level = Math.floor(s.difficulty / 5) + 1;
      const bot = BotManager.spawn(best, level);
      AudioFX.shot('bot', best.clone(), 0.05);
    }
    if (s.timer > 0) s.timer -= dt;
  },

  /* =====================================================
     EVENTS
     ===================================================== */
  onBotKilled(bot, headshot, cause) {
    this.kills++;
    if (headshot) this.headshots++;
    const pts = (headshot ? SCORE.headshot : SCORE.kill);
    this.addScore(pts);
    this.streak++;
    HUD.killfeed('YOU <span class="hs">' + (headshot ? 'HEADSHOT' : 'KILLED') + '</span> BOT' +
      (cause === 'hunter' ? ' [HK]' : cause === 'hellstorm' ? ' [HSTM]' :
       cause === 'lodestar' ? ' [LODE]' : cause === 'vtol' ? ' [VTOL]' :
       cause === 'melee' ? ' [KNIFE]' : cause && cause !== 'gun' ? ' [EXP]' : ''));

    /* Per-streak earn bar. Each equipped streak fills its own bar by the
       points just earned and CAPS at its cost (display can't go 105/100).
       The bar only resets when that specific streak is activated, so using
       one streak never wipes progress on another you also have unlocked. */
    const hardline = this.hasPerk('hardline');
    if (!this.streakScore) this.streakScore = {};
    for (const sid of Loadout.current.streaks) {
      if (sid === 'none' || !STREAKS[sid]) continue;
      const def = STREAKS[sid];
      const cost = this.streakCost(sid);
      const before = this.streakScore[sid] || 0;
      if (before >= cost) continue;                    // banked & waiting to be used
      const next = Math.min(cost, before + pts);
      this.streakScore[sid] = next;
      if (next >= cost && before < cost) {             // just crossed the line
        this.streakCounts[sid]++;
        AudioFX.streakReady();
        HUD.announce(def.name + ' READY', 'PRESS ' + (Loadout.current.streaks.indexOf(sid) + 1) + ' TO DEPLOY');
      }
    }
    HUD.setStreaks(this);

    const scav = this.hasPerk('scavenger');
    const r = Math.random();
    if (scav || r < 0.22) this._spawnPickup(bot.chest.clone(), 'ammo');
    else if (r < 0.36) this._spawnPickup(bot.chest.clone(), 'grenade');
  },

  addScore(v) { this.score += v; },

  /* effective point cost of a streak (Hardline perk = 20% off) */
  streakCost(sid) {
    const def = STREAKS[sid];
    if (!def) return Infinity;
    return Math.max(1, Math.round(def.cost * (this.hasPerk('hardline') ? 0.8 : 1)));
  },

  onPlayerHit(dmg, from, explosive) {
    try {
      const p = this.player;
      if (!p.alive || this.state !== 'playing') return;
      const toughness = this.hasPerk('toughness');
      let real = dmg;
      if (explosive && this.hasPerk('flak')) real *= 0.45;
      p.hp -= real;
      p.regenDelay = 4;
      HUD.damage();
      HUD.setHealth(Math.max(0, (p.hp / p.maxHp) * 100));
      const flinch = (toughness ? 0.006 : 0.014) * Math.min(1, dmg / 12);
      p.recoilPitch -= flinch * (0.6 + Math.random() * 0.8);
      p.recoilYaw += (Math.random() - 0.5) * flinch * 1.2;
      if (p.hp <= 0) this.die();
    } catch (e) {
      console.error('damage error:', e);
    }
  }
};