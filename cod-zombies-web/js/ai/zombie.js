/* =========================================================
   ai/zombie.js — Kino zombie AI + object-pooled spawner.
   States: SPAWNING, BREACHING_BARRICADE, CHASING, ATTACKING,
   DYING, DESPAWN. Exposes the same rayHit/damage/chest
   interface the weapon code already uses for bots.
   ========================================================= */

const ZOMBIE_MAX = 14;
const ZOMBIE_GEO = {};
const ZOMBIE_MAT = {};

function initZombieAssets() {
  if (ZOMBIE_GEO.torso) return;
  ZOMBIE_GEO.torso  = new THREE.BoxGeometry(0.52, 0.68, 0.28);
  ZOMBIE_GEO.head   = new THREE.BoxGeometry(0.25, 0.28, 0.25);
  ZOMBIE_GEO.jaw    = new THREE.BoxGeometry(0.18, 0.09, 0.20);
  ZOMBIE_GEO.arm    = new THREE.BoxGeometry(0.12, 0.56, 0.13);
  ZOMBIE_GEO.leg    = new THREE.BoxGeometry(0.16, 0.58, 0.18);
  ZOMBIE_GEO.boot   = new THREE.BoxGeometry(0.18, 0.14, 0.24);
  ZOMBIE_GEO.eye    = new THREE.SphereGeometry(0.035, 6, 5);
  ZOMBIE_GEO.rag    = new THREE.BoxGeometry(0.56, 0.16, 0.3);

  ZOMBIE_MAT.coat = new THREE.MeshStandardMaterial({ color:0x3d3a2a, roughness:0.96, metalness:0.02 });
  ZOMBIE_MAT.skin = new THREE.MeshStandardMaterial({ color:0x9c8e76, roughness:0.92, metalness:0.0 });
  ZOMBIE_MAT.pants= new THREE.MeshStandardMaterial({ color:0x2b2b25, roughness:0.97, metalness:0.0 });
  ZOMBIE_MAT.boot = new THREE.MeshStandardMaterial({ color:0x17181a, roughness:0.95, metalness:0.05 });
  ZOMBIE_MAT.blood= new THREE.MeshStandardMaterial({ color:0x53110d, roughness:0.9, metalness:0.0 });
  ZOMBIE_MAT.eye  = new THREE.MeshStandardMaterial({ color:0xff5533, emissive:0xff2200,
    emissiveIntensity:2.4, roughness:0.4 });
}

class Zombie {
  constructor(scene, index) {
    initZombieAssets();
    this.scene = scene;
    this.index = index;
    this.active = false;
    this.alive = false;
    this.state = 'DESPAWN';
    this.feet = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.half = new THREE.Vector3(0.34, 0.86, 0.34);
    this.animT = Math.random() * 6;
    this.deadT = 0;
    this.spawnT = 0;
    this.tearCd = 0;
    this.attackCd = 0;
    this.slowT = 0;
    this.blindT = 0;
    this.hitFlash = 0;
    this.killAwarded = false;
    this.windowId = null;
    this.windowDef = null;
    this.attackDamage = 24;
    this._avoidSide = Math.random() < 0.5 ? 1 : -1;

    const g = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };

    this.legL = new THREE.Group(); this.legL.position.set(-0.13, 0.76, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.13, 0.76, 0);
    const ll = new THREE.Mesh(ZOMBIE_GEO.leg, ZOMBIE_MAT.pants); ll.position.y = -0.29;
    const lr = new THREE.Mesh(ZOMBIE_GEO.leg, ZOMBIE_MAT.pants); lr.position.y = -0.29;
    const bl = new THREE.Mesh(ZOMBIE_GEO.boot, ZOMBIE_MAT.boot); bl.position.y = -0.64;
    const br = new THREE.Mesh(ZOMBIE_GEO.boot, ZOMBIE_MAT.boot); br.position.y = -0.64;
    ll.castShadow = lr.castShadow = bl.castShadow = br.castShadow = true;
    this.legL.add(ll, bl); this.legR.add(lr, br);
    g.add(this.legL, this.legR);

    const coatMat = ZOMBIE_MAT.coat.clone();   // per-zombie so hit flash is isolated
    this.torso = add(ZOMBIE_GEO.torso, coatMat, 0, 1.08, 0);
    add(ZOMBIE_GEO.rag, coatMat, 0, 0.79, 0);
    const stain = add(ZOMBIE_GEO.rag, ZOMBIE_MAT.blood, 0, 1.16, -0.15);
    stain.scale.set(0.75, 0.55, 0.12);
    stain.castShadow = false;

    this.head = add(ZOMBIE_GEO.head, ZOMBIE_MAT.skin, 0, 1.58, 0);
    const jaw = add(ZOMBIE_GEO.jaw, ZOMBIE_MAT.blood, 0, 1.44, -0.1);
    jaw.castShadow = false;
    const eyeL = new THREE.Mesh(ZOMBIE_GEO.eye, ZOMBIE_MAT.eye);
    const eyeR = new THREE.Mesh(ZOMBIE_GEO.eye, ZOMBIE_MAT.eye);
    eyeL.position.set(-0.06, 1.62, -0.125);
    eyeR.position.set(0.06, 1.62, -0.125);
    g.add(eyeL, eyeR);

    this.armL = new THREE.Group(); this.armL.position.set(-0.34, 1.30, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.34, 1.30, 0);
    const al = new THREE.Mesh(ZOMBIE_GEO.arm, coatMat); al.position.y = -0.25;
    const ar = new THREE.Mesh(ZOMBIE_GEO.arm, coatMat); ar.position.y = -0.25;
    al.castShadow = ar.castShadow = true;
    this.armL.add(al); this.armR.add(ar);
    g.add(this.armL, this.armR);

    this.group = g;
    g.visible = false;
    scene.add(g);
  }

  /* Eye-level world position (weapon hit fallback / AI). */
  get eye() {
    return new THREE.Vector3(this.feet.x, this.feet.y + 1.62, this.feet.z);
  }
  /* Chest-level world position (damage/attack origin). */
  get chest() {
    return new THREE.Vector3(this.feet.x, this.feet.y + 1.15, this.feet.z);
  }
  /* Zombies never expose minimap "recently fired" state. */
  get recentlyFired() { return false; }

  /* Bring a pooled zombie to life at a window spawn point. */
  activate(windowDef, round, healthScale) {
    this.active = true;
    this.alive = true;
    this.state = 'SPAWNING';
    this.windowId = windowDef.id;
    this.windowDef = windowDef;
    this.killAwarded = false;
    this.deadT = 0;
    this.spawnT = 0.65 + Math.random() * 0.5;
    this.tearCd = 0.6 + Math.random() * 0.4;
    this.attackCd = 0.35 + Math.random() * 0.4;
    this.slowT = 0;
    this.blindT = 0;
    this.hitFlash = 0;
    this.animT = Math.random() * 6;
    this._avoidSide = Math.random() < 0.5 ? 1 : -1;

    const hpBase = 90 + round * 26;
    this.maxHp = hpBase * (healthScale || 1);
    this.hp = this.maxHp;
    this.speed = 2.0 + Math.min(1.7, round * 0.09) + Math.random() * 0.35;
    this.attackDamage = 22 + round * 2.2;

    this.feet.set(windowDef.spawn.x, windowDef.spawn.y, windowDef.spawn.z);
    this.vel.set(0, 0, 0);
    this.group.position.copy(this.feet);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(0.45);
    this.group.visible = true;
    this._face(windowDef.approach.x - this.feet.x, windowDef.approach.z - this.feet.z, 1);
  }

  /* Return this instance to the pool (hidden, inert). */
  deactivate() {
    this.active = false;
    this.alive = false;
    this.state = 'DESPAWN';
    this.group.visible = false;
    this.vel.set(0, 0, 0);
  }

  /* Ray query used by the existing gun/melee/explosion code. */
  rayHit(origin, dir, maxDist) {
    if (!this.alive) return null;
    const hb = {
      min:new THREE.Vector3(this.feet.x - 0.18, this.feet.y + 1.42, this.feet.z - 0.18),
      max:new THREE.Vector3(this.feet.x + 0.18, this.feet.y + 1.76, this.feet.z + 0.18)
    };
    const th = rayBox(origin, dir, hb, maxDist);
    if (th != null) return { dist:th, head:true };
    const bb = {
      min:new THREE.Vector3(this.feet.x - 0.35, this.feet.y, this.feet.z - 0.35),
      max:new THREE.Vector3(this.feet.x + 0.35, this.feet.y + 1.42, this.feet.z + 0.35)
    };
    const tb = rayBox(origin, dir, bb, maxDist);
    if (tb != null) return { dist:tb, head:false };
    return null;
  }

  /* Apply damage; returns true when this hit killed the zombie. */
  damage(amount, headshot) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'DYING';
      this.deadT = 0;
      this.vel.set(0, 0, 0);
      return true;
    }
    // keep spawning/breaching zombies committed to the window; otherwise a
    // non-lethal hit would strand them outside the wall in CHASING
    if (this.state !== 'ATTACKING' && this.state !== 'BREACHING_BARRICADE' &&
        this.state !== 'SPAWNING') this.state = 'CHASING';
    return false;
  }

  /* Per-frame AI + physics + procedural animation. */
  update(dt, player, game) {
    if (!this.active) return;

    if (!this.alive) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.55);
      this.group.rotation.x = -k * Math.PI / 2 * 0.94;
      this.group.position.y = this.feet.y - k * 0.12;
      this.group.position.x = this.feet.x;
      this.group.position.z = this.feet.z;
      if (this.deadT > 2.3) this.deactivate();
      return;
    }

    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.slowT > 0) this.slowT -= dt;

    this._think(dt, player, game);
    this._physics(dt);
    this._animate(dt, player);
  }

  /* -------- internals -------- */

  _think(dt, player, game) {
    const def = this.windowDef;
    if (!def) { this.state = 'CHASING'; return; }

    if (this.state === 'SPAWNING') {
      this.group.scale.setScalar(Math.min(1, 0.45 + (1 - this.spawnT) * 0.8));
      const d = this._steerTo(def.approach, this.speed * 0.7, dt);
      this.spawnT -= dt;
      if (d < 0.55 || this.spawnT <= 0) {
        this.feet.set(def.approach.x, def.approach.y, def.approach.z);
        this.vel.set(0, 0, 0);
        this.state = (typeof BarricadeSystem !== 'undefined' &&
                      BarricadeSystem.boards(def.id) > 0) ? 'BREACHING_BARRICADE' : 'CHASING';
        if (this.state === 'CHASING') this._enter();
      }
      return;
    }

    if (this.state === 'BREACHING_BARRICADE') {
      const boards = (typeof BarricadeSystem !== 'undefined') ? BarricadeSystem.boards(def.id) : 0;
      if (boards <= 0) { this._enter(); return; }
      this.vel.x *= 0.6; this.vel.z *= 0.6;
      this.tearCd -= dt;
      if (this.tearCd <= 0) {
        this.tearCd = def.tearRate || 1.15;
        if (typeof BarricadeSystem !== 'undefined') BarricadeSystem.tear(def.id);
        this.animT += 1.4;
      }
      this._face(def.inside.x - this.feet.x, def.inside.z - this.feet.z, dt * 6);
      return;
    }

    if (!player || !player.alive) { this.vel.x *= 0.85; this.vel.z *= 0.85; return; }

    const dx = player.pos.x - this.feet.x;
    const dz = player.pos.z - this.feet.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === 'ATTACKING') {
      this._face(dx, dz, dt * 9);
      this.vel.x *= 0.5; this.vel.z *= 0.5;
      this.attackCd -= dt;
      if (dist > 2.9) { this.state = 'CHASING'; return; }
      if (this.attackCd <= 0 && dist < 2.5 && MapData.losClear(this.chest, player.eye)) {
        this.attackCd = 0.85 + Math.random() * 0.25;
        if (typeof game !== 'undefined' && game.onPlayerHit) {
          game.onPlayerHit(this.attackDamage, this.chest, false);
        }
        if (typeof Effects !== 'undefined') {
          Effects.impact(player.eye.clone().add(new THREE.Vector3(0, -0.15, 0)),
            new THREE.Vector3(0, 0, 1), false, true);
        }
        if (typeof AudioFX !== 'undefined' && AudioFX.blip)
          AudioFX.blip(85, 0.18, 'sawtooth', 0.11);
        // lunge shove
        const n = dist > 0.001 ? 1 / dist : 0;
        this.vel.x += dx * n * 2.4;
        this.vel.z += dz * n * 2.4;
      }
      return;
    }

    /* CHASING */
    if (dist < 1.95 && MapData.losClear(this.chest, player.eye)) {
      this.state = 'ATTACKING'; this.attackCd = Math.min(this.attackCd, 0.2); return;
    }
    this._steerTo(player.pos, this.speed, dt);
  }

  _enter() {
    const def = this.windowDef;
    if (!def) return;
    this.feet.set(def.inside.x, def.inside.y, def.inside.z);
    this.vel.set(0, 0, 0);
    this.state = 'CHASING';
    this.group.scale.setScalar(1);
    if (typeof AudioFX !== 'undefined' && AudioFX.blip)
      AudioFX.blip(220, 0.2, 'sawtooth', 0.07);
  }

  _steerTo(target, speed, dt) {
    const dx = target.x - this.feet.x;
    const dz = target.z - this.feet.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    let nx = dx / d, nz = dz / d;

    /* cheap wall avoidance: probe ahead, then fan left/right */
    const from = new THREE.Vector3(this.feet.x, this.feet.y + 1.0, this.feet.z);
    const fwd = new THREE.Vector3(nx, 0, nz);
    if (MapData.rayTest(from, fwd, 1.25)) {
      const base = this._avoidSide;
      let chosen = null;
      for (const off of [0.7, -0.7, 1.3, -1.3]) {
        const a = base * off;
        const cx = nx * Math.cos(a) - nz * Math.sin(a);
        const cz = nx * Math.sin(a) + nz * Math.cos(a);
        if (!MapData.rayTest(from, new THREE.Vector3(cx, 0, cz), 1.2)) {
          chosen = { x:cx, z:cz };
          break;
        }
      }
      if (!chosen) {
        this._avoidSide *= -1;
        const a = this._avoidSide * 1.5;
        chosen = { x:nx * Math.cos(a) - nz * Math.sin(a), z:nx * Math.sin(a) + nz * Math.cos(a) };
      }
      nx = chosen.x; nz = chosen.z;
    }

    const spd = speed * (this.slowT > 0 ? 0.45 : 1);
    const accel = 7;
    this.vel.x += (nx * spd - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (nz * spd - this.vel.z) * Math.min(1, dt * accel);
    this._face(nx, nz, dt * 7);
    return d;
  }

  _face(nx, nz, k) {
    if (Math.abs(nx) + Math.abs(nz) < 0.0001) return;
    const yawT = Math.atan2(nx, nz) + Math.PI;
    let dy = yawT - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, k);
  }

  _physics(dt) {
    this.vel.y -= 22 * dt;
    if (this.vel.y < -30) this.vel.y = -30;
    this.center.copy(this.feet).add(this.half);
    this.center.addScaledVector(this.vel, dt);
    const res = resolveCollision(this.center, this.half, MapData.colliders, 0.55,
      { x:this.vel.x, y:this.vel.y, z:this.vel.z });
    if (res.grounded && this.vel.y < 0) this.vel.y = 0;
    if (res.ceiling && this.vel.y > 0) this.vel.y = 0;
    if (res.pushX < 0 && this.vel.x > 0) this.vel.x = 0;
    if (res.pushX > 0 && this.vel.x < 0) this.vel.x = 0;
    if (res.pushZ < 0 && this.vel.z > 0) this.vel.z = 0;
    if (res.pushZ > 0 && this.vel.z < 0) this.vel.z = 0;
    this.feet.copy(this.center).sub(this.half);

    if (res.grounded && this.vel.y <= 0.01) {
      const g = MapData.groundAt(this.feet.x, this.feet.y + 0.05, this.feet.z);
      if (g > -900 && this.feet.y - g > 0.005 && this.feet.y - g <= 0.6) this.feet.y = g;
    }
    if (this.feet.y < -3) this.damage(999, false);
  }

  _animate(dt, player) {
    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.animT += dt * (2.6 + planar * 1.8);
    const sw = Math.sin(this.animT) * 0.62;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;

    const claw = this.state === 'ATTACKING' ? 1 : (this.state === 'BREACHING_BARRICADE' ? 0.8 : 0.45);
    this.armL.rotation.x = -1.15 - claw * 0.6 + Math.sin(this.animT * 1.7) * 0.28;
    this.armR.rotation.x = -1.15 - claw * 0.6 - Math.sin(this.animT * 1.7) * 0.28;
    this.armL.rotation.z = 0.16;
    this.armR.rotation.z = -0.16;
    this.head.rotation.z = Math.sin(this.animT * 0.8) * 0.12;

    if (this.hitFlash > 0) {
      const f = Math.max(0, this.hitFlash / 0.12);
      this.torso.material.emissive = this.torso.material.emissive || new THREE.Color();
      this.torso.material.emissive.setRGB(f * 0.5, f * 0.05, f * 0.02);
    } else if (this.torso.material.emissive) {
      this.torso.material.emissive.setRGB(0, 0, 0);
    }

    this.group.position.set(this.feet.x, this.feet.y, this.feet.z);
  }
}

/* =========================================================
   ZombieSpawner / manager
   ========================================================= */
const Zombies = {
  scene:null,
  pool:[],
  zombies:[],
  spawnTimer:0,
  spawnInterval:2.2,
  round:1,
  active:false,
  powerup:null,
  powerTimer:0,
  powerLabel:'',

  /* Create/reuse the object pool and reset all runtime state. */
  init(scene) {
    this.scene = scene;
    this.clear();
    if (this.pool.length === 0) {
      for (let i = 0; i < ZOMBIE_MAX; i++) {
        const z = new Zombie(scene, i);
        this.pool.push(z);
      }
    } else {
      for (const z of this.pool) {
        z.deactivate();
        if (z.group.parent !== scene) scene.add(z.group);
      }
    }
    this.zombies = this.pool;
    this.round = 1;
    this.active = false;
    this.spawnTimer = 0;
    this.spawnInterval = 2.2;
    this.powerTimer = 0;
    this.powerLabel = '';

    if (!this.powerup) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0),
        new THREE.MeshBasicMaterial({ color:0x6fe0ff, transparent:true, opacity:0.9 }));
      mesh.visible = false;
      mesh.renderOrder = 6;
      scene.add(mesh);
      this.powerup = { mesh, active:false, t:0, pos:new THREE.Vector3() };
    } else {
      this.powerup.active = false;
      this.powerup.mesh.visible = false;
      if (this.powerup.mesh.parent !== scene) scene.add(this.powerup.mesh);
    }
  },

  /* Begin spawning for a round (called by RoundManager). */
  beginRound(n, cfg) {
    cfg = cfg || {};
    this.round = n;
    this.active = true;
    this.spawnInterval = cfg.interval || Math.max(0.7, 1.6 - n * 0.05);
    this.spawnTimer = 1.1;
  },

  /* Alive (not dying) zombie count. */
  aliveCount() {
    let n = 0;
    for (const z of this.zombies) if (z.active && z.alive) n++;
    return n;
  },

  /* Spawn one zombie at a random window if budget allows. */
  spawn() {
    if (typeof KinoMapDefinition === 'undefined') return null;
    const defs = KinoMapDefinition.windows;
    if (!defs || defs.length === 0) return null;
    let slot = null;
    for (const z of this.pool) {
      if (!z.active) { slot = z; break; }
    }
    if (!slot) return null;
    const def = defs[Math.floor(Math.random() * defs.length)];
    slot.activate(def, this.round, RoundManager.healthScale);
    return slot;
  },

  /* Per-frame spawn pacing + AI updates + separation + power-up. */
  update(dt, player, game) {
    if (!this.scene) return;

    if (this.active && typeof RoundManager !== 'undefined' && RoundManager.canSpawn()) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        // never burn a budget slot unless the pool actually has a free body
        const free = this.pool.some(z => !z.active);
        if (free && RoundManager.consumeSpawn()) this.spawn();
        this.spawnTimer = this.spawnInterval * (0.7 + Math.random() * 0.6);
      }
    }

    for (const z of this.zombies) {
      try { z.update(dt, player, game); }
      catch (e) { console.error('zombie update error:', e); z.deactivate(); }
    }

    this._separate();
    this._updatePowerup(dt, game);
  },

  /* Award points/stats for a zombie kill (safe to call twice). */
  onKill(z, headshot, cause) {
    if (!z || z.killAwarded) return;
    z.killAwarded = true;
    if (typeof RoundManager !== 'undefined') RoundManager.notifyKill();
    if (typeof Game !== 'undefined') {
      Game.kills = (Game.kills || 0) + 1;
      if (headshot) Game.headshots = (Game.headshots || 0) + 1;
    }
    const pts = PointsEconomy.award('kill');
    let bonus = 0;
    if (headshot) bonus = PointsEconomy.award('headshotKill');
    if (typeof HUD !== 'undefined' && HUD.killfeed) {
      HUD.killfeed('YOU <span class="hs">' + (headshot ? 'HEADSHOT' : 'KILLED') + '</span> ZOMBIE' +
        (cause === 'melee' ? ' [KNIFE]' : cause && cause !== 'gun' ? ' [EXP]' : '') +
        ' <span class="hs">+' + (pts + bonus) + '</span>');
    }
    if (Math.random() < 0.10) this._dropPowerup(z.chest.clone());
  },

  /* Stop spawning and hide every pooled zombie. */
  clear() {
    for (const z of this.pool) z.deactivate();
    this.active = false;
    this.spawnTimer = 0;
    this.powerTimer = 0;
    if (this.powerup) {
      this.powerup.active = false;
      this.powerup.mesh.visible = false;
    }
  },

  /* -------- internals -------- */
  _separate() {
    const live = this.zombies.filter(z => z.active && z.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.feet.x - a.feet.x;
        const dz = b.feet.z - a.feet.z;
        const need = a.half.x + b.half.x;
        const ox = need - Math.abs(dx);
        const oz = need - Math.abs(dz);
        if (ox <= 0 || oz <= 0) continue;
        if (Math.abs(a.feet.y - b.feet.y) > 1.2) continue;
        if (ox < oz) {
          const s = (dx >= 0 ? 1 : -1) * ox * 0.45;
          a.feet.x -= s; b.feet.x += s;
        } else {
          const s = (dz >= 0 ? 1 : -1) * oz * 0.45;
          a.feet.z -= s; b.feet.z += s;
        }
      }
    }
  },

  _dropPowerup(pos) {
    if (!this.powerup || this.powerup.active) return;
    this.powerup.pos.copy(pos);
    this.powerup.pos.y = Math.max(1.0, pos.y);
    this.powerup.t = 0;
    this.powerup.active = true;
    this.powerup.mesh.position.copy(this.powerup.pos);
    this.powerup.mesh.visible = true;
  },

  _updatePowerup(dt, game) {
    if (this.powerTimer > 0) this.powerTimer = Math.max(0, this.powerTimer - dt);
    const p = this.powerup;
    if (!p || !p.active) return;
    p.t += dt;
    p.mesh.rotation.y += dt * 2.2;
    p.mesh.position.y = p.pos.y + Math.sin(p.t * 3) * 0.12;
    if (p.t > 20) { p.active = false; p.mesh.visible = false; return; }
    const pp = (typeof Game !== 'undefined') ? Game.player : null;
    const pickD = pp ? Math.hypot(pp.pos.x - p.mesh.position.x, pp.pos.z - p.mesh.position.z) : 999;
    if (pp && pp.alive && pickD < 1.6) {
      p.active = false;
      p.mesh.visible = false;
      if (Game.refillAmmo) Game.refillAmmo();
      this.powerTimer = 10;
      this.powerLabel = 'MAX AMMO';
      if (typeof HUD !== 'undefined' && HUD.announce) HUD.announce('MAX AMMO', 'POWER-UP');
      if (typeof AudioFX !== 'undefined' && AudioFX.pickup) AudioFX.pickup();
    }
  }
};
