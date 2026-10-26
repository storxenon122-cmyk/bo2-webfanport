/* =========================================================
   menu.js — all UI: boot, main menu, loadout, settings,
   pause, game over, exit screens + pointer lock handling.
   ========================================================= */

const Menu = {
  context:'main',        // where SETTINGS returns to: main | pause
  loadoutReturn:'none',  // where LOADOUT returns to: none | pause | gameover
  current:'boot',

  $(id) { return document.getElementById(id); },

  show(id) {
    const screens = document.querySelectorAll('.menu-screen');
    screens.forEach(s => s.classList.add('hidden'));
    if (id) this.$(id).classList.remove('hidden');
    this.current = id || 'none';
  },

  init() {
    const $ = this.$;

    /* ---------- BOOT ---------- */
    $('boot-screen').addEventListener('click', () => {
      AudioFX.init(); AudioFX.resume(); AudioFX.ui();
      this.show('main-menu');
    });

    /* ---------- MAIN MENU ---------- */
    $('btn-singleplayer').onclick = () => {
      AudioFX.ui();
      this.show('map-select-screen');
    };
    $('btn-map-back').onclick = () => { AudioFX.uiBack(); this.show('main-menu'); };
    $('btn-map-cargo17').onclick = () => { this._startMap('cargo17'); };
    $('btn-map-downtown').onclick = () => { this._startMap('downtown'); };
    $('btn-map-blacksite').onclick = () => { this._startMap('blacksite'); };
    $('btn-map-mirage').onclick = () => { this._startMap('mirage'); };
    $('btn-map-nuketown').onclick = () => { this._startMap('nuketown'); };
    $('btn-multiplayer').onclick = () => { AudioFX.ui(); this.show('soon-screen'); };
    $('btn-loadout').onclick = () => { AudioFX.ui(); this.context = 'main'; this.openLoadout(); };
    $('btn-settings').onclick = () => { AudioFX.ui(); this.context = 'main'; this.openSettings(); };
    $('btn-exit').onclick = () => { AudioFX.ui(); this.show('exit-screen'); };
    $('btn-exit-back').onclick = () => { AudioFX.uiBack(); this.show('main-menu'); };
    $('btn-soon-back').onclick = () => { AudioFX.uiBack(); this.show('main-menu'); };

    /* ---------- LOADOUT ---------- */
    $('btn-lo-back').onclick = () => {
      AudioFX.uiBack();
      Loadout.save();
      if (this.loadoutReturn === 'pause') {
        this.loadoutReturn = 'none';
        this.show('pause-screen');
      } else if (this.loadoutReturn === 'gameover') {
        this.loadoutReturn = 'none';
        Game.restartRespawnTimer();
        this.show('gameover-screen');
      } else {
        this.show('main-menu');
      }
    };
    this.buildLoadout();

    /* ---------- SETTINGS ---------- */
    $('btn-set-back').onclick = () => {
      AudioFX.uiBack();
      if (this.context === 'pause') { this.show('pause-screen'); }
      else this.show('main-menu');
    };
    $('btn-set-reset').onclick = () => {
      Settings.reset();
      Input.rebind();
      this.refreshSettings();
      AudioFX.uiBack();
    };
    this.buildSettings();

    /* ---------- PAUSE ---------- */
    $('btn-resume').onclick = () => { AudioFX.ui(); Game.resume(); };
    $('btn-pause-loadout').onclick = () => { AudioFX.ui(); this.loadoutReturn = 'pause'; this.openLoadout(); };
    $('btn-pause-settings').onclick = () => { AudioFX.ui(); this.context = 'pause'; this.openSettings(); };
    $('btn-quit').onclick = () => {
      AudioFX.uiBack();
      Game.quit();
      this.show('main-menu');
    };

    /* ---------- GAME OVER ---------- */
    $('btn-retry').onclick = () => {
      AudioFX.ui();
      $('gameover-screen').classList.add('hidden');
      Game.respawn();
      setTimeout(() => { if (Game.state === 'playing') Input.requestLock(Game.renderer.domElement); }, 60);
    };
    $('btn-go-loadout').onclick = () => {
      AudioFX.ui();
      if (Game._goTimer) { clearTimeout(Game._goTimer); Game._goTimer = null; }
      this.loadoutReturn = 'gameover';
      this.openLoadout();
    };
    $('btn-go-menu').onclick = () => {
      AudioFX.uiBack();
      $('gameover-screen').classList.add('hidden');
      Game.quit();
      this.show('main-menu');
    };
  },

  openLoadout() {
    this.syncLoadout();
    this.show('loadout-screen');
  },
  openSettings() {
    this.refreshSettings();
    this.show('settings-screen');
  },

  /* ================= LOADOUT UI ================= */
  buildLoadout() {
    const $ = this.$;
    // class tabs
    const tabs = $('class-tabs');
    tabs.innerHTML = '';
    Loadout.classes.forEach((c, i) => {
      const b = document.createElement('div');
      b.className = 'class-tab';
      b.textContent = 'CLASS ' + (i + 1);
      b.onclick = () => {
        Loadout.active = i;
        Loadout.save();
        this.syncLoadout();
        AudioFX.ui();
      };
      tabs.appendChild(b);
    });

    const fill = (selId, items, valueKey) => {
      const sel = $(selId);
      sel.innerHTML = '';
      for (const it of items) {
        const o = document.createElement('option');
        o.value = it.id;
        let label = it.name;
        if (it.sub) label += '  —  ' + it.sub;
        o.textContent = label;
        sel.appendChild(o);
      }
    };

    fill('lo-primary', [
      { id:'smg', name:'PDW-77', sub:'SMG · fast fire, close range' },
      { id:'smg3', name:'VECTOR', sub:'SMG · 45 ACP, ultra fast' },
      { id:'ar', name:'AN-94', sub:'ASSAULT RIFLE · balanced' },
      { id:'ar2', name:'M27', sub:'ASSAULT RIFLE · IAR platform' },
      { id:'lmg', name:'LSAT', sub:'LMG · 75 rounds, heavy' },
      { id:'lmg2', name:'HAMR', sub:'LMG · 100 rounds' },
      { id:'sniper', name:'DSR-50', sub:'SNIPER · one shot' },
      { id:'sniper2', name:'BARRETT', sub:'SNIPER · .50 CAL' },
      { id:'shotgun', name:'M1216', sub:'SHOTGUN · 8 pellets, close' },
      { id:'shotgun2', name:'KSG', sub:'SHOTGUN · pump action' },
      { id:'marksman', name:'SVU-AS', sub:'MARKSMAN · semi-auto' }
    ]);
    fill('lo-secondary', [
      { id:'pistol', name:'FIVE-SEVEN', sub:'PISTOL' },
      { id:'pistol2', name:'G18', sub:'PISTOL · full auto' },
      { id:'knife', name:'COMBAT KNIFE', sub:'MELEE' },
      { id:'launcher', name:'SMAW', sub:'LAUNCHER · explosive' },
      { id:'revolver', name:'TITAN', sub:'REVOLVER · hard hit' },
      { id:'smg2', name:'MP7', sub:'SMG · fast fire' },
      { id:'shotgun3', name:'M1014', sub:'SHOTGUN · semi-auto' }
    ]);
    fill('lo-lethal', [
      { id:'frag', name:'FRAG', sub:'bouncing fuse grenade' },
      { id:'semtex', name:'SEMTIX', sub:'sticky explosive' },
      { id:'claymore', name:'CLAYMORE', sub:'proximity mine' }
    ]);
    fill('lo-tactical', [
      { id:'flash', name:'FLASHBANG', sub:'blinds enemies & you' },
      { id:'stun', name:'STUN GRENADE', sub:'slows enemies' },
      { id:'smoke', name:'SMOKE GRENADE', sub:'visual cover' }
    ]);
    const perks = Object.keys(PERKS).map(k => ({ id:k, name:PERKS[k].name, sub:PERKS[k].desc }));
    fill('lo-perk1', perks); fill('lo-perk2', perks); fill('lo-perk3', perks);
    const streaks = [
      { id:'uav', name:'UAV · 425 PTS', sub:'radar sweep' },
      { id:'hunter', name:'HUNTER KILLER · 525', sub:'seeking drone' },
      { id:'carepackage', name:'CARE PACKAGE · 700', sub:'random reward' },
      { id:'sentry', name:'SENTRY GUN · 875', sub:'auto turret' },
      { id:'hellstorm', name:'HELLSTORM MISSILE · 950', sub:'guided cluster missile' },
      { id:'chopper', name:'ATTACK CHOPPER · 1200', sub:'gunship strafing' },
      { id:'lodestar', name:'LODESTAR · 1400', sub:'remote missile strikes' },
      { id:'vtol', name:'VTOL WARSHIP · 1750', sub:'heavy gunship' },
      { id:'nuke', name:'TACTICAL NUKE · 3000', sub:'ends the match' },
      { id:'none', name:'NONE', sub:'' }
    ];
    fill('lo-streak1', streaks); fill('lo-streak2', streaks); fill('lo-streak3', streaks); fill('lo-streak4', streaks);

    const bind = (selId, get, set) => {
      $(selId).onchange = (e) => { set(e.target.value); Loadout.save(); AudioFX.ui(); };
    };
    bind('lo-primary', null, v => { Loadout.current.primary = v; this.refreshGunsmith(); });
    bind('lo-secondary', null, v => Loadout.current.secondary = v);
    bind('lo-lethal', null, v => Loadout.current.lethal = v);
    bind('lo-tactical', null, v => Loadout.current.tactical = v);
    bind('lo-perk1', null, v => Loadout.current.perk1 = v);
    bind('lo-perk2', null, v => Loadout.current.perk2 = v);
    bind('lo-perk3', null, v => Loadout.current.perk3 = v);
    bind('lo-streak1', null, v => Loadout.current.streaks[0] = v);
    bind('lo-streak2', null, v => Loadout.current.streaks[1] = v);
    bind('lo-streak3', null, v => Loadout.current.streaks[2] = v);
    bind('lo-streak4', null, v => Loadout.current.streaks[3] = v);

    // attachment dropdowns (Gunsmith) — options filtered to what the
    // selected PRIMARY weapon actually supports (game.js clamps again)
    this.refreshGunsmith();
    bind('lo-optic', null, v => { Loadout.current.attachments = Loadout.current.attachments || {}; Loadout.current.attachments.optic = v; Loadout.save(); AudioFX.ui(); });
    bind('lo-barrel', null, v => { Loadout.current.attachments = Loadout.current.attachments || {}; Loadout.current.attachments.barrel = v; Loadout.save(); AudioFX.ui(); });

    // camo dropdown
    const camos = [
      { id:'default', name:'DEFAULT' },
      { id:'woodland', name:'WOODLAND CAMO' },
      { id:'desert', name:'DESERT CAMO' },
      { id:'digital', name:'DIGITAL CAMO' },
      { id:'gold', name:'GOLD CAMO' },
      { id:'diamond', name:'DIAMOND CAMO' },
      { id:'darkmatter', name:'DARK MATTER CAMO' }
    ];
    fill('lo-camo', camos);
    bind('lo-camo', null, v => { Loadout.current.camo = v; Loadout.save(); AudioFX.ui(); });

    this.syncLoadout();
  },

  /* Gunsmith: refill an attachment dropdown with only the options the
     current primary weapon allows; resets an invalid saved pick to none */
  _attFill(cat, selId) {
    const sel = this.$(selId);
    if (!sel) return;
    const allow = (WEAPONS[Loadout.current.primary] || {}).attachments || {};
    const list = allow[cat] || ['none'];
    Loadout.current.attachments = Loadout.current.attachments || {};
    const prev = Loadout.current.attachments[cat] || 'none';
    sel.innerHTML = '';
    for (const k of list) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = ATTACHMENTS[cat][k].name;
      sel.appendChild(o);
    }
    const keep = list.indexOf(prev) >= 0 ? prev : 'none';
    sel.value = keep;
    Loadout.current.attachments[cat] = keep;
  },
  refreshGunsmith() {
    this._attFill('optic', 'lo-optic');
    this._attFill('barrel', 'lo-barrel');
  },

  syncLoadout() {
    const $ = this.$;
    const c = Loadout.current;
    document.querySelectorAll('.class-tab').forEach((t, i) => {
      t.classList.toggle('active', i === Loadout.active);
      t.textContent = 'CLASS ' + (i + 1) + ' · ' + Loadout.classes[i].name;
    });
    $('lo-primary').value = c.primary;
    $('lo-secondary').value = c.secondary;
    $('lo-lethal').value = c.lethal;
    $('lo-tactical').value = c.tactical;
    $('lo-perk1').value = c.perk1;
    $('lo-perk2').value = c.perk2;
    $('lo-perk3').value = c.perk3;
    $('lo-streak1').value = c.streaks[0];
    $('lo-streak2').value = c.streaks[1];
    $('lo-streak3').value = c.streaks[2];
    $('lo-streak4').value = c.streaks[3];
    this.refreshGunsmith();          // refills + keeps valid optic/barrel picks
    $('lo-camo').value = c.camo || 'default';
  },

  /* ================= SETTINGS UI ================= */
  buildSettings() {
    const $ = this.$;
    const upd = () => {
      $('set-sens').value = Settings.data.sensitivity;
      $('val-sens').textContent = Number(Settings.data.sensitivity).toFixed(2);
      $('set-fov').value = Settings.data.fov;
      $('val-fov').textContent = Settings.data.fov;
      $('set-bright').value = Settings.data.brightness;
      $('val-bright').textContent = Number(Settings.data.brightness).toFixed(2);
      $('set-blur').textContent = Settings.data.motionBlur ? 'ON' : 'OFF';
      $('set-blur').classList.toggle('on', !!Settings.data.motionBlur);
      $('set-quality').value = Settings.data.quality;
      $('set-preset').value = Settings.data.preset;
      document.querySelectorAll('.keybind').forEach(b => {
        b.textContent = this.keyLabel(Settings.bind(b.dataset.action));
        b.classList.remove('listening');
      });
    };
    this.refreshSettings = upd;

    $('set-sens').oninput = e => {
      Settings.data.sensitivity = parseFloat(e.target.value);
      $('val-sens').textContent = Settings.data.sensitivity.toFixed(2);
      Settings.apply();
    };
    $('set-fov').oninput = e => {
      Settings.data.fov = parseInt(e.target.value);
      $('val-fov').textContent = Settings.data.fov;
      Settings.apply();
      if (Game.camera) { Game.camera.fov = Settings.data.fov; Game.camera.updateProjectionMatrix(); }
    };
    $('set-bright').oninput = e => {
      Settings.data.brightness = parseFloat(e.target.value);
      $('val-bright').textContent = Settings.data.brightness.toFixed(2);
      Settings.apply();
      Main.applyBrightness();
    };
    $('set-blur').onclick = () => {
      Settings.data.motionBlur = !Settings.data.motionBlur;
      Settings.apply(); upd(); AudioFX.ui();
    };
    $('set-quality').onchange = e => {
      Settings.data.quality = e.target.value;
      Settings.apply();
      Main.applyQuality();
      upd(); AudioFX.ui();
    };
    $('set-preset').onchange = e => {
      Settings.data.preset = e.target.value;
      Settings.data.binds = {};          // start preset binds fresh
      Settings.apply();
      Input.rebind();
      upd(); AudioFX.ui();
    };

    // key rebinding
    document.querySelectorAll('.keybind').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.keybind').forEach(b => b.classList.remove('listening'));
        btn.classList.add('listening');
        btn.textContent = 'PRESS KEY…';
        AudioFX.ui();
        Input.captureNext((code) => {
          if (code !== 'Escape') {
            Settings.data.binds[btn.dataset.action] = code;
            Settings.apply();
            Input.rebind();
          }
          btn.classList.remove('listening');
          upd();
        });
      };
    });

    upd();
  },

  keyLabel(code) {
    if (!code) return '—';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
    const map = {
      ControlLeft:'L-CTRL', ControlRight:'R-CTRL', ShiftLeft:'L-SHIFT', ShiftRight:'R-SHIFT',
      AltLeft:'L-ALT', AltRight:'R-ALT', Space:'SPACE', Escape:'ESC', Tab:'TAB',
      CapsLock:'CAPS', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→',
      Mouse0:'LMB', Mouse2:'RMB', Enter:'ENTER', Backspace:'BKSP'
    };
    return map[code] || code.toUpperCase();
  },

  _startMap(mapId) {
    AudioFX.ui();
    MapRotation.set(mapId);
    this.show(null);
    Game.start();
    setTimeout(() => { if (Game.state === 'playing') Input.requestLock(Game.renderer.domElement); }, 60);
  }
};
