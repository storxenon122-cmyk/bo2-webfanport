/* =========================================================
   hud.js — HTML/CSS HUD: minimap radar, ammo panel, health,
   killfeed, killstreak slots, crosshair, hitmarkers, damage.
   ========================================================= */

const HUD = {
  el:{}, kmAmmoClip:0, _dmg:0, _flash:0, _annT:0,

  init() {
    const ids = ['hud','minimap','weapon-name','weapon-alias','ammo-clip','ammo-reserve',
      'frag-icon','tac-icon','health-fill','wave-info','score-info','streak-info',
      'killfeed','announce','damage-vignette','flash-overlay','crosshair','hitmarker',
      'sniper-scope','acog-scope','zoom-scope','streak-1','streak-2','streak-3','streak-4','sprint-vignette','motionblur-overlay',
      'streak-cam-overlay','streak-cam-label'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.ctx = this.el['minimap'].getContext('2d');
    this.size = 200;
    /* setStreaks() runs every frame — cache the slot sub-elements once
       instead of six querySelector() traversals per frame */
    this._slot = {};
    for (const id of ['streak-1','streak-2','streak-3','streak-4']) {
      const slot = this.el[id];
      this._slot[id] = { slot, name: slot.querySelector('.sname'), fill: slot.querySelector('.sfill') };
    }

    /* ---- enemy indicators (world-space dots above bot heads) ----
       DOM elements positioned each frame via world->screen projection.
       Visible when UAV is active or the bot recently fired; clamped to
       the screen edge when off-screen so the player always knows the
       direction of nearby threats. */
    this._indicators = {};
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'enemy-indicator';
      el.style.display = 'none';
      document.body.appendChild(el);
      this._indicators[i] = { el, active: false };
    }
    this._indNext = 0;
    /* last-written values: the per-frame setters below only touch the DOM
       when something actually changed (unconditional textContent/style writes
       six times a frame were constant layout invalidation) */
    this._lc = {};
  },

  show(v) { this.el.hud.classList.toggle('hidden', !v); },

  /* ---------- ammo ---------- */
  setWeapon(name, alias, clip, reserve, empty) {
    this.el['weapon-name'].textContent = name;
    this.el['weapon-alias'].textContent = alias;
    this.el['ammo-clip'].textContent = clip;
    this.el['ammo-reserve'].textContent = reserve;
    this.el['ammo-clip'].classList.toggle('empty', !!empty);
  },
  setEquipment(fragName, fragCount, tacName, tacCount) {
    const f = this.el['frag-icon'], t = this.el['tac-icon'];
    f.textContent = '● ' + fragName + (fragCount > 1 ? ' ×' + fragCount : '');
    t.textContent = '◇ ' + tacName + (tacCount > 1 ? ' ×' + tacCount : '');
    f.classList.toggle('off', fragCount <= 0);
    t.classList.toggle('off', tacCount <= 0);
  },

  /* ---------- health ---------- */
  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, Math.round(hp)));
    if (this._lc.hp === pct) return;
    this._lc.hp = pct;
    const fill = this.el['health-fill'];
    fill.style.width = pct + '%';
    fill.classList.toggle('low', pct < 35);
  },

  /* ---------- score ---------- */
  setScore(wave, score, streak, alive) {
    const a = 'DIFFICULTY ' + wave + (alive != null ? '  ·  HOSTILES ' + alive : '');
    const b = 'SCORE ' + score;
    const c = 'KILLSTREAK ' + streak;
    if (this._lc.wave !== a) { this._lc.wave = a; this.el['wave-info'].textContent = a; }
    if (this._lc.score !== b) { this._lc.score = b; this.el['score-info'].textContent = b; }
    if (this._lc.streak !== c) { this._lc.streak = c; this.el['streak-info'].textContent = c; }
  },

  /* ---------- streak slots ---------- */
  setStreaks(game) {
    const map = { 'streak-1':1, 'streak-2':2, 'streak-3':3, 'streak-4':4 };
    const ls = this._lc.streaks || (this._lc.streaks = {});
    for (const elId in map) {
      const e = this._slot[elId];
      const id = Loadout.current.streaks[map[elId] - 1];
      if (!id || !STREAKS[id]) {
        if (ls[elId] === 'none') continue;
        ls[elId] = 'none';
        e.name.textContent = 'EMPTY';
        e.slot.classList.remove('ready','active');
        e.fill.style.width = '0%';
        continue;
      }
      const def = STREAKS[id];
      if (id === 'none') {
        if (ls[elId] === 'none') continue;
        ls[elId] = 'none';
        e.name.textContent = 'EMPTY';
        e.slot.classList.remove('ready','active');
        e.fill.style.width = '0%';
        continue;
      }
      /* each streak has its OWN earn bar (game.streakScore[id]); it caps at
         the cost and resets only when that streak is used */
      const raw = (game.streakScore && game.streakScore[id]) || 0;
      const cost = (game.streakCost) ? game.streakCost(id) : def.cost;
      const p = Killstreaks.progress(id, raw, game);
      const owned = game.streakCounts[id] > 0;
      /* The FILL always mirrors the real earn score, clamped to the cost.
         progress() returns pct:1 while a streak is deployed, which made a bar
         sit at 100% next to a "0/950" label right after you used it — that's
         what the deploy state is for. */
      const pct = Math.round(Math.min(1, Math.max(0, raw / cost)) * 100);
      const ready = owned, active = !!p.active;
      /* min(raw,cost) — never shows over-cost */
      const label = def.name + (owned ? '' : ' ' + Math.floor(Math.min(raw, cost)) + '/' + cost);
      const key = label + '|' + pct + '|' + (ready ? 1 : 0) + (active ? 1 : 0);
      if (ls[elId] === key) continue;
      ls[elId] = key;
      e.name.textContent = label;
      e.fill.style.width = pct + '%';
      e.slot.classList.toggle('ready', ready);
      e.slot.classList.toggle('active', active);
    }
  },

  setMapName(name) {
    const el = document.getElementById('map-name');
    if (el) el.textContent = name;
  },

  /* ---------- feedback ---------- */
  killfeed(html) {
    const kf = this.el['killfeed'];
    const div = document.createElement('div');
    div.className = 'kf';
    div.innerHTML = html;
    kf.appendChild(div);
    while (kf.children.length > 5) kf.removeChild(kf.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 5000);
  },

  announce(title, sub) {
    const a = this.el['announce'];
    a.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
    a.classList.remove('show');
    // retrigger the banner animation without a forced sync layout reflow
    requestAnimationFrame(() => { a.classList.add('show'); });
  },

  hitmarker(kill) {
    const h = this.el['hitmarker'];
    h.classList.toggle('kill', !!kill);
    h.classList.remove('show');
    // retrigger the flash animation without a forced sync layout reflow
    requestAnimationFrame(() => { h.classList.add('show'); });
    if (kill) AudioFX.kill(); else AudioFX.hit();
  },

  damage() { this._dmg = 1; },
  flash(v) { this._flash = Math.max(this._flash, v); },
  /* clear transient screen effects (used on spawn/respawn so a frozen
     damage vignette from the death screen doesn't bleed into the new life) */
  resetFx() {
    this._dmg = 0; this._flash = 0;
    this.el['damage-vignette'].style.opacity = 0;
    this.el['flash-overlay'].style.opacity = 0;
    this.el['sprint-vignette'].style.opacity = 0;
    this._lc.sprint = 0;
    this.el['hitmarker'].classList.remove('show');
  },

  setCrosshair(gapPx, hidden) {
    const gap = Math.max(2, Math.round(gapPx)) + 'px';
    const hid = !!hidden;
    if (this._lc.gap === gap && this._lc.xh === hid) return;
    this._lc.gap = gap; this._lc.xh = hid;
    const c = this.el['crosshair'];
    c.style.setProperty('--gap', gap);
    c.style.opacity = hid ? 0 : 1;
  },
  setScope(type) { // 'sniper' | 'acog' | 'zoom' | false
    if (this._lc.scope === type) return;
    this._lc.scope = type;
    this.el['sniper-scope'].classList.add('hidden');
    this.el['acog-scope'].classList.add('hidden');
    this.el['zoom-scope'].classList.add('hidden');
    if (type) this.el[type + '-scope'].classList.remove('hidden');
  },
  setSprintVignette(on) {
    const v = on ? 1 : 0;
    if (this._lc.sprint === v) return;
    this._lc.sprint = v;
    this.el['sprint-vignette'].style.opacity = v;
  },

  /* streak camera overlay (Hellstorm / Lodestar views) */
  streakCam(on, label) {
    this.el['streak-cam-overlay'].classList.toggle('hidden', !on);
    if (label !== undefined) this.el['streak-cam-label'].textContent = label || '';
  },

  /* shared scratch vector for world->screen projection (avoid per-frame GC) */
  _indScratch: new THREE.Vector3(),

  update(dt) {
    if (this._dmg > 0) {
      this._dmg = Math.max(0, this._dmg - dt * 1.4);
      this.el['damage-vignette'].style.opacity = this._dmg;
    }
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 0.55);
      this.el['flash-overlay'].style.opacity = this._flash;
    }
    this._updateIndicators();
  },

  /* position enemy-indicator DOM elements above bot heads.
     visible when UAV is up or the bot recently fired; clamped to screen edge
     when off-screen so direction is always known. */
  _updateIndicators() {
    const cam = (typeof Game !== 'undefined' && Game.camera) ? Game.camera : null;
    if (!cam) return;
    const uav = (typeof Killstreaks !== 'undefined' && Killstreaks.uavTimer > 0);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const margin = 90;

    // camera basis in world space — used to compute the true direction to each
    // bot so off-screen / behind-camera indicators point at the correct edge.
    // project() flips 180° for points behind the camera plane, which used to
    // put indicators on the wrong side of the screen.
    const camPos = cam.position;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);

    // hide all, then show only the ones we need
    for (const ind of Object.values(this._indicators)) {
      ind.el.style.display = 'none';
      ind.active = false;
    }

    let idx = 0;
    const bots = (typeof BotManager !== 'undefined') ? BotManager.bots : [];
    for (const b of bots) {
      if (!b.alive || idx >= this._indicators.length) continue;
      if (!uav && !b.recentlyFired) continue;

      const ind = this._indicators[idx];
      const v = this._indScratch.copy(b.eye).project(cam);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (1 - (v.y * 0.5 + 0.5)) * height;

      // true world-space direction from camera to bot
      const toBot = new THREE.Vector3().subVectors(b.eye, camPos);
      const angle = Math.atan2(toBot.dot(right), toBot.dot(fwd));
      const behind = toBot.dot(fwd) < 0;

      const onScreen =
        !behind &&
        v.z >= 0 && v.z <= 1 &&
        x >= margin && x <= width - margin &&
        y >= margin && y <= height - margin;

      let nx = x, ny = y;
      if (!onScreen) {
        // clamp to screen edge using the real world angle
        const maxDistX = cx - margin;
        const maxDistY = cy - margin;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const tx = ca === 0 ? Infinity : maxDistX / Math.abs(ca);
        const ty = sa === 0 ? Infinity : maxDistY / Math.abs(sa);
        const maxR = Math.min(tx, ty);
        nx = cx + ca * maxR;
        ny = cy + sa * maxR;
        ind.el.className = 'enemy-indicator offscreen';
      } else {
        ind.el.className = 'enemy-indicator onscreen';
      }

      ind.el.style.left = nx + 'px';
      ind.el.style.top = ny + 'px';
      ind.el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      ind.el.style.display = 'block';
      ind.active = true;
      idx++;
    }
  },

  /* ---------- MINIMAP ---------- */
  drawMinimap(game) {
    const ctx = this.ctx, S = this.size;
    const scale = 1.85;                 // px per meter
    const cx = S / 2, cy = S / 2;
    // per-map framing: each map builder stores MapData.minimap = {cx,cz,outline}.
    // (Used to hardcode the Cargo-17 hull on every map.)
    const mm = MapData.minimap || { cx:0, cz:0, outline:[[-40,-30],[40,-30],[40,30],[-40,30]] };
    const wx = mm.cx, wz = mm.cz;
    const mapX = (x) => cx + (x - wx) * scale;
    const mapZ = (z) => cy + (z - wz) * scale;

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(6,9,12,0.85)';
    ctx.fillRect(0, 0, S, S);

    // map boundary outline
    ctx.strokeStyle = 'rgba(150,165,175,0.55)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(60,70,78,0.35)';
    ctx.beginPath();
    const pts = mm.outline;
    ctx.moveTo(mapX(pts[0][0]), mapZ(pts[0][1]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(mapX(pts[i][0]), mapZ(pts[i][1]));
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // structures
    ctx.fillStyle = 'rgba(140,155,165,0.45)';
    for (const f of MapData.footprints) {
      if (!f.tall) continue;
      ctx.fillRect(mapX(f.x - f.w/2), mapZ(f.z - f.d/2), f.w * scale, f.d * scale);
    }

    // care packages
    ctx.fillStyle = '#e8801c';
    for (const p of Killstreaks.packages) {
      const px = mapX(p.group.position.x), pz = mapZ(p.group.position.z);
      ctx.fillRect(px - 3, pz - 3, 6, 6);
    }

    // enemies
    const uav = Killstreaks.uavTimer > 0;
    ctx.fillStyle = '#ff4b3a';
    for (const b of BotManager.bots) {
      if (!b.alive) continue;
      const show = uav || b.recentlyFired;
      if (!show) continue;
      const px = mapX(b.feet.x), pz = mapZ(b.feet.z);
      ctx.beginPath(); ctx.arc(px, pz, 3.2, 0, Math.PI * 2); ctx.fill();
      // blink for fired-recently
      if (!uav) {
        ctx.strokeStyle = 'rgba(255,75,58,0.5)';
        ctx.beginPath(); ctx.arc(px, pz, 5.5, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // drone
    for (const d of Killstreaks.drones) {
      ctx.fillStyle = '#ffd050';
      const px = mapX(d.pos.x), pz = mapZ(d.pos.z);
      ctx.fillRect(px - 2, pz - 2, 4, 4);
    }

    // player arrow
    const p = game.player;
    const px = mapX(p.pos.x), pz = mapZ(p.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    ctx.rotate(Math.atan2(fz, fx));
    ctx.fillStyle = '#7ee08a';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // UAV sweep line
    if (uav) {
      const t = (performance.now() / 1400) % (Math.PI * 2);
      ctx.strokeStyle = 'rgba(126,224,138,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(px + Math.cos(t) * S, pz + Math.sin(t) * S);
      ctx.stroke();
    }

    // frame labels
    ctx.fillStyle = 'rgba(232,128,28,0.85)';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(MapRotation.get().name, 8, S - 8);
    if (uav) {
      ctx.fillText('UAV ' + Math.ceil(Killstreaks.uavTimer) + 's', S - 54, S - 8);
    }
  }
};
