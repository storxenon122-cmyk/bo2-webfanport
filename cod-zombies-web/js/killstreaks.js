/* =========================================================
   killstreaks.js — UAV (radar sweep), Hunter Killer drone,
   Care Package (parachute crate with random reward), Attack
   Chopper, Hellstorm Missile (guided camera missile with
   cluster bomblets), Lodestar (circling remote gunship cam,
   mouse-aimed strikes), VTOL Warship (autonomous heavy
   gunship). Tactical Nuke.
   ========================================================= */

const Killstreaks = {
  uavTimer:0, drones:[], packages:[], scene:null,
  camMode:null,          // null | 'hellstorm' | 'lodestar' (camera takeover)
  hellstorm:null, lodestar:null,
  vtols:[], bomblets:[], strikes:[],   // strikes = in-flight Lodestar missiles
  hsPuffs:[], hsPuffPool:[],     // pooled smoke trail puffs (allocated once)
  _missilePool:null, _missileGeo:null, _missileMat:null,

  init(scene) {
    this.scene = scene; this.uavTimer = 0; this.drones = []; this.packages = [];
    this.camMode = null; this.hellstorm = null; this.lodestar = null;
    this.vtols = []; this.bomblets = []; this.strikes = [];
    /* pooled smoke puffs for the Hellstorm trail — created once, reused, so a
       6 s missile flight no longer allocates ~185 throwaway meshes (the main
       per-launch hitch on integrated laptop graphics). */
    if (this.hsPuffs.length === 0) {
      const geo = new THREE.SphereGeometry(0.22, 6, 5);
      const mat = new THREE.MeshBasicMaterial({ color:0xcfcfc4, transparent:true,
        opacity:0.55, depthWrite:false });
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false; m.renderOrder = 4;
        scene.add(m);
        this.hsPuffs.push({ mesh:m, active:false });
        this.hsPuffPool.push(m);
      }
    }
    /* pooled Lodestar strike missiles — small glowing shells that FLY from
       the gunship down to the aim point (replaces the old static tracer
       beams that looked like frozen white lines). Created once, reused. */
    if (!this._missilePool || this._missilePool.length === 0) {
      this._missileGeo = new THREE.ConeGeometry(0.38, 1.7, 6);
      this._missileGeo.rotateX(Math.PI / 2);   // tip points +Z so lookAt() aims it
      this._missileMat = new THREE.MeshBasicMaterial({ color:0xffc46a });
      this._missilePool = [];
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(this._missileGeo, this._missileMat);
        m.visible = false; m.renderOrder = 5;
        scene.add(m);
        this._missilePool.push(m);
      }
    }
    if (typeof HUD !== 'undefined') HUD.streakCam(false);
  },

  canActivate(id, game) {
    const def = STREAKS[id];
    if (!def || id === 'none') return false;
    if (id === 'uav') return game.streakCounts.uav > 0 && this.uavTimer <= 0;   // can't stack UAVs
    if (id === 'hunter') return game.streakCounts.hunter > 0;
    if (id === 'carepackage') return game.streakCounts.carepackage > 0;
    if (id === 'sentry') return game.streakCounts.sentry > 0;
    if (id === 'hellstorm') return game.streakCounts.hellstorm > 0;
    if (id === 'chopper') return game.streakCounts.chopper > 0;
    if (id === 'lodestar') return game.streakCounts.lodestar > 0;
    if (id === 'vtol') return game.streakCounts.vtol > 0;
    if (id === 'nuke') return game.streakCounts.nuke > 0;
    return false;
  },

  activate(id, game) {
    if (!this.canActivate(id, game)) return false;
    game.streakCounts[id]--;
    /* reset ONLY this streak's earn bar — any other streaks you have
       unlocked keep their own progress untouched */
    if (game.streakScore) game.streakScore[id] = 0;

    if (id === 'uav') {
      if (this.uavTimer > 0) return false;   // UAV already in the sky — wait for it to expire
      this.uavTimer = 30;
      AudioFX.announce();
      game.hud.announce('UAV ONLINE', 'ENEMY POSITIONS VISIBLE 30s');
      game.hud.killfeed('<span class="hs">UAV</span> DEPLOYED');
    }

    if (id === 'hunter') {
      AudioFX.announce();
      game.hud.announce('HUNTER KILLER', 'DRONE AWAY');
      this._spawnDrone(game);
    }

    if (id === 'carepackage') {
      AudioFX.announce();
      game.hud.announce('CARE PACKAGE', 'INBOUND');
      this._spawnPackage(game);
    }

    if (id === 'hellstorm') {
      AudioFX.announce();
      game.hud.announce('HELLSTORM MISSILE', 'GUIDANCE ONLINE');
      this._launchHellstorm(game);
    }

    if (id === 'chopper') {
      AudioFX.announce();
      game.hud.announce('ATTACK CHOPPER', 'GUNSHIP INBOUND');
      this._spawnChopper(game);
    }

    if (id === 'lodestar') {
      AudioFX.announce();
      game.hud.announce('LODESTAR', 'REMOTE GUNSHIP ONLINE');
      this._launchLodestar(game);
    }

    if (id === 'vtol') {
      AudioFX.announce();
      game.hud.announce('VTOL WARSHIP', 'HEAVY GUNSHIP INBOUND');
      this._spawnVtol(game);
    }

    if (id === 'nuke') {
      AudioFX.announce();
      game.hud.announce('TACTICAL NUKE', 'INCOMING');
      this._detonateNuke(game);
    }
    return true;
  },

  /* mouse look while a streak camera is up — Game routes input here */
  steer(look, firing, game) {
    const sens = 0.0016 * Settings.data.sensitivity;
    if (this.camMode === 'hellstorm' && this.hellstorm) {
      const h = this.hellstorm;
      h.yaw   -= look.x * sens;
      h.pitch -= look.y * sens;
      h.pitch = THREE.MathUtils.clamp(h.pitch, -1.45, -0.15);
    } else if (this.camMode === 'lodestar' && this.lodestar) {
      const L = this.lodestar;
      L.yaw   -= look.x * sens;
      L.pitch -= look.y * sens;
      L.pitch = THREE.MathUtils.clamp(L.pitch, -1.48, -0.30);
    }
  },

  /* ---------------- ATTACK CHOPPER ---------------- */
  _spawnDrone(game) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color:0x2b3036, roughness:0.5, metalness:0.6 }));
    g.add(body);
    const armMat = new THREE.MeshStandardMaterial({ color:0x17191c, roughness:0.7 });
    const rotorMat = new THREE.MeshStandardMaterial({ color:0x8b939a, roughness:0.4, metalness:0.7,
      transparent:true, opacity:0.55 });
    const rotors = [];
    for (const [x, z] of [[-0.35,-0.3],[0.35,-0.3],[-0.35,0.3],[0.35,0.3]]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.08), armMat);
      arm.position.set(x * 0.55, 0.02, z * 0.55);
      arm.rotation.y = Math.atan2(z, x);
      g.add(arm);
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8), rotorMat);
      rotor.position.set(x, 0.08, z);
      g.add(rotor); rotors.push(rotor);
    }
    const light = new THREE.PointLight(0xff3b1e, 2.5, 8, 2);
    light.position.y = -0.1; g.add(light);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.MeshBasicMaterial({ color:0xff3b1e }));
    led.position.set(0, -0.1, -0.26); g.add(led);

    const start = game.player.pos.clone();
    start.x += (Math.random() - 0.5) * 4;
    start.z += (Math.random() - 0.5) * 4;
    start.y = game.player.pos.y + 1;
    g.position.copy(start);
    this.scene.add(g);

    this.drones.push({
      group:g, rotors, pos:g.position, vel:new THREE.Vector3(),
      state:'rise', t:0, target:null, light, led, life:0
    });
    AudioFX.blip(300, 0.3, 'sawtooth', 0.12);
  },

  _updateDrones(dt, game) {
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      d.t += dt; d.life += dt;
      for (const r of d.rotors) r.rotation.y += dt * 40;
      d.led.visible = Math.sin(d.t * 14) > 0;

      if (d.state === 'rise') {
        d.pos.y += dt * 9;
        if (d.pos.y > game.player.pos.y + 6) {
          d.state = 'seek';
          d.target = BotManager.nearest(game.player.pos, 100);
        }
      } else if (d.state === 'seek') {
        if (!d.target || !d.target.alive || d.target.removed) {
          d.target = BotManager.nearest(game.player.pos, 100);
          if (!d.target) { d.state = 'return'; }
        }
        if (d.target) {
          const goal = d.target.chest.clone();
          const dir = goal.sub(d.pos);
          const dist = dir.length();
          if (dist < 1.6) {
            // BOOM
            Effects.explosion(d.pos.clone(), 5);
            this._areaDamage(d.pos.clone(), 5, 160, game, null);
            AudioFX.blip(1400, 0.15, 'square', 0.12);
            this.scene.remove(d.group);
            this.drones.splice(i, 1);
            continue;
          }
          dir.normalize().multiplyScalar(17);
          d.vel.lerp(dir, Math.min(1, dt * 3.2));
          d.pos.addScaledVector(d.vel, dt);
          // bank
          d.group.rotation.y = Math.atan2(d.vel.x, d.vel.z) + Math.PI;
          d.group.rotation.z = THREE.MathUtils.clamp(-d.vel.x * 0.02, -0.5, 0.5);
        }
      } else if (d.state === 'return') {
        const goal = game.player.eye.clone().add(new THREE.Vector3(0, 1, 0));
        const dir = goal.sub(d.pos); const dist = dir.length();
        if (dist < 1.5) { this.scene.remove(d.group); this.drones.splice(i, 1); continue; }
        dir.normalize().multiplyScalar(15);
        d.vel.lerp(dir, Math.min(1, dt * 3));
        d.pos.addScaledVector(d.vel, dt);
        d.group.rotation.y = Math.atan2(d.vel.x, d.vel.z) + Math.PI;
      }
      if (d.life > 30) { this.scene.remove(d.group); this.drones.splice(i, 1); }
    }
  },

  _areaDamage(pos, radius, dmg, game, excludeBot, cause) {
    const c = cause || 'hunter';
    // bots
    for (const b of BotManager.bots) {
      if (!b.alive || b === excludeBot) continue;
      const d = b.chest.distanceTo(pos);
      if (d < radius) {
        const falloff = 1 - (d / radius) * 0.6;
        const killed = b.damage(dmg * falloff, false);
        if (killed) game.onBotKilled(b, false, c);
      }
    }
    // player
    const pd = game.player.eye.distanceTo(pos);
    if (pd < radius && game.player.alive) {
      const falloff = 1 - (pd / radius) * 0.7;
      const perk = game.hasPerk('flak') ? 0.45 : 1;
      game.onPlayerHit(dmg * falloff * 0.7 * perk, pos, true);
    }
  },

  /* ---------------- CARE PACKAGE ---------------- */
  _spawnPackage(game) {
    // find a clear-ish deck spot near the player — it has to land on
    // something the player can actually walk to, so keep it at the
    // player's own level instead of on top of a container or a roof
    const p = game.player.pos.clone();
    const ceil = p.y + 1.0;
    let spot = null;
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 14;
      const x = THREE.MathUtils.clamp(p.x + Math.cos(a) * r, -42, 50);
      const z = THREE.MathUtils.clamp(p.z + Math.sin(a) * r, -8.5, 8.5);
      const ground = MapData.groundAt(x, ceil, z);
      if (ground > -900 && ground > p.y - 3.0) { spot = new THREE.Vector3(x, ground, z); break; }
    }
    if (!spot) {
      const x = THREE.MathUtils.clamp(p.x + 6, -42, 50);
      const z = THREE.MathUtils.clamp(p.z + 4, -8.5, 8.5);
      let g = MapData.groundAt(x, ceil, z);
      if (g <= -900) g = 0;
      spot = new THREE.Vector3(x, g, z);
    }

    const g = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3),
      new THREE.MeshStandardMaterial({ color:0x4d5a3c, roughness:0.85, metalness:0.1 }));
    crate.castShadow = true;
    g.add(crate);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.2, 1.34),
      new THREE.MeshStandardMaterial({ color:0xe8801c, emissive:0x4a2000, emissiveIntensity:0.8 }));
    stripe.position.y = 0.3; g.add(stripe);
    // parachute
    const chute = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color:0x9aa4ac, roughness:0.9, side:THREE.DoubleSide }));
    chute.position.y = 4.5;
    g.add(chute);
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1, 3.9, -1), new THREE.Vector3(-0.5, 0.55, -0.5),
        new THREE.Vector3(1, 3.9, -1), new THREE.Vector3(0.5, 0.55, -0.5),
        new THREE.Vector3(-1, 3.9, 1), new THREE.Vector3(-0.5, 0.55, 0.5),
        new THREE.Vector3(1, 3.9, 1), new THREE.Vector3(0.5, 0.55, 0.5)
      ]),
      new THREE.LineBasicMaterial({ color:0x333333 }));
    g.add(lines);

    g.position.copy(spot).setY(spot.y + 16);
    this.scene.add(g);
    this.packages.push({ group:g, chute, spot, landed:false, life:45 });
    AudioFX.blip(700, 0.1, 'square', 0.14);
    setTimeout(() => AudioFX.blip(900, 0.1, 'square', 0.14), 220);
  },

  _updatePackages(dt, game) {
    for (let i = this.packages.length - 1; i >= 0; i--) {
      const p = this.packages[i];
      p.life -= dt;
      if (!p.landed) {
        p.group.position.y -= dt * 5.5;
        p.group.position.x += Math.sin(p.life * 1.5) * dt * 0.6;
        p.chute.rotation.y += dt * 0.5;
        if (p.group.position.y <= p.spot.y + 0.55) {
          p.group.position.y = p.spot.y + 0.55;
          p.landed = true;
          p.chute.visible = false;
          AudioFX.explosion(p.group.position.clone(), false);
          Effects.impact(p.group.position.clone(), new THREE.Vector3(0,1,0), false, false);
          game.hud.announce('CARE PACKAGE', 'PICK IT UP [F] / WALK OVER');
        }
      } else {
        p.group.rotation.y += dt * 0.6;
        p.group.position.y = p.spot.y + 0.55 + Math.sin(p.life * 3) * 0.04;
        // pickup
        if (game.player.alive &&
            game.player.pos.distanceTo(p.group.position) < 2.2) {
          this._grantReward(game);
          this.scene.remove(p.group);
          this.packages.splice(i, 1);
          continue;
        }
        if (p.life <= 0) {
          this.scene.remove(p.group);
          this.packages.splice(i, 1);
        }
      }
    }
  },

  _grantReward(game) {
    AudioFX.pickup();
    const roll = Math.random();
    if (roll < 0.35) {
      game.streakCounts.uav++;
      game.hud.announce('CARE PACKAGE', '+1 UAV');
      game.hud.killfeed('CARE PACKAGE: <span class="hs">UAV</span>');
    } else if (roll < 0.65) {
      game.streakCounts.hunter++;
      game.hud.announce('CARE PACKAGE', '+1 HUNTER KILLER');
      game.hud.killfeed('CARE PACKAGE: <span class="hs">HUNTER KILLER</span>');
    } else if (roll < 0.85) {
      game.refillAmmo();
      game.hud.announce('CARE PACKAGE', 'FULL AMMO');
      game.hud.killfeed('CARE PACKAGE: <span class="hs">FULL AMMO</span>');
    } else {
      game.refillGrenades();
      game.streakCounts.carepackage++;
      game.hud.announce('CARE PACKAGE', '+1 CARE PACKAGE + NADES');
      game.hud.killfeed('CARE PACKAGE: <span class="hs">SUPPLIES</span>');
    }
    game.addScore(50);
  },

  update(dt, game) {
    if (this.uavTimer > 0) this.uavTimer -= dt;
    this._updateDrones(dt, game);
    this._updateChopper(dt, game);
    this._updatePackages(dt, game);
    this._updateHellstorm(dt, game);
    this._updateLodestar(dt, game);
    this._updateStrikes(dt);
    this._updateBomblets(dt, game);
    this._updateVtols(dt, game);
  },

  /* ---------------- ATTACK CHOPPER ---------------- */
  _spawnChopper(game) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.2),
      new THREE.MeshStandardMaterial({ color:0x2b3036, roughness:0.5, metalness:0.6 }));
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.2),
      new THREE.MeshStandardMaterial({ color:0x2b3036, roughness:0.5, metalness:0.6 }));
    tail.position.set(0, 0.1, 1.0); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 12),
      new THREE.MeshStandardMaterial({ color:0x8b939a, roughness:0.4, metalness:0.7, transparent:true, opacity:0.55 }));
    rotor.position.y = 0.35; g.add(rotor);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color:0x17191c, roughness:0.7 }));
    skidL.position.set(-0.5, -0.3, 0); g.add(skidL);
    const skidR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.6),
      new THREE.MeshStandardMaterial({ color:0x17191c, roughness:0.7 }));
    skidR.position.set(0.5, -0.3, 0); g.add(skidR);
    const light = new THREE.PointLight(0xff3b1e, 3, 12, 2);
    light.position.set(0, -0.2, -0.8); g.add(light);

    const start = game.player.pos.clone();
    start.x += (Math.random() - 0.5) * 12;
    start.z += (Math.random() - 0.5) * 12;
    start.y = game.player.pos.y + 25;
    g.position.copy(start);
    this.scene.add(g);

    this.drones.push({
      group:g, rotor, pos:g.position, vel:new THREE.Vector3(),
      state:'patrol', t:0, target:null, light, life:0,
      patrolCenter: start.clone(), patrolAngle: Math.random() * Math.PI * 2
    });
    AudioFX.blip(300, 0.3, 'sawtooth', 0.12);
  },

  _updateChopper(dt, game) {
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i];
      if (!d.rotor) continue; // hunter killer, skip
      d.t += dt; d.life += dt;
      d.rotor.rotation.y += dt * 50;
      d.light.visible = Math.sin(d.t * 10) > 0;

      if (d.state === 'patrol') {
        d.patrolAngle += dt * 0.5;
        const r = 18;
        const goal = d.patrolCenter.clone().add(new THREE.Vector3(Math.cos(d.patrolAngle)*r, 0, Math.sin(d.patrolAngle)*r));
        goal.y = game.player.pos.y + 20 + Math.sin(d.t * 0.7) * 3;
        const dir = goal.sub(d.pos); const dist = dir.length();
        dir.normalize().multiplyScalar(10);
        d.vel.lerp(dir, Math.min(1, dt * 2));
        d.pos.addScaledVector(d.vel, dt);
        d.group.rotation.y = Math.atan2(d.vel.x, d.vel.z) + Math.PI;

        // strafe shoot at nearest bot
        d.shootCd = (d.shootCd || 0) - dt;
        if (d.shootCd <= 0) {
          d.shootCd = 1.2;
          const target = BotManager.nearest(game.player.pos, 60);
          if (target && target.alive) {
            const from = d.pos.clone().add(new THREE.Vector3(0, -1, -1));
            const to = target.chest.clone();
            const dir = to.sub(from);
            const dist = dir.length();
            dir.normalize();
            const wallHit = MapData.rayTest(from, dir, dist);
            if (!wallHit || wallHit.dist > dist - 0.5) {
              const dmg = 60 + Math.random() * 40;
              const killed = target.damage(dmg, false);
              if (killed) game.onBotKilled(target, false, 'chopper');
              Effects.tracer(from, to, 0xff3b1e);
              AudioFX.shot('bot', from, 0.3);
            }
          }
        }
      }
      if (d.life > 45) { this.scene.remove(d.group); this.drones.splice(i, 1); }
    }
  },

  /* ---------------- TACTICAL NUKE ---------------- */
  _detonateNuke(game) {
    const p = game.player;
    const pos = p.pos.clone();
    Effects.explosion(pos, 40);
    if (game.shake) game.shake(0.8);
    // kill all bots
    for (const b of BotManager.bots) {
      if (!b.alive) continue;
      b.damage(9999, false);
      game.onBotKilled(b, false, 'nuke');
    }
    // huge damage to player (nuke is a "you lose" streak in this mode, but fun)
    game.onPlayerHit(999, pos, true);
    game.hud.announce('NUCLEAR STRIKE', 'EVERYTHING DIES');
    game.hud.killfeed('<span class="hs">TACTICAL NUKE</span> DETONATED');
    game.addScore(500);
  },

  /* ---------------- HELLSTORM MISSILE (guided camera missile) ---------------- */
  _launchHellstorm(game) {
    const p = game.player;
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color:0x4a5248, roughness:0.5, metalness:0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 1.4, 10), bodyMat);
    body.rotation.x = Math.PI / 2;          // body along Z, nose toward -Z
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 10),
      new THREE.MeshStandardMaterial({ color:0x8a2a22, roughness:0.5, metalness:0.4 }));
    nose.rotation.x = -Math.PI / 2; nose.position.z = -0.95; g.add(nose);
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.42), bodyMat);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      fin.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.55);
      fin.rotation.z = a; g.add(fin);
    }
    // launched high above the player, diving down toward where they aim
    const pos = p.eye.clone().addScaledVector(fwd, -6);
    pos.y = p.eye.y + 60;
    g.position.copy(pos);
    this.scene.add(g);

    this.hellstorm = {
      group:g, pos:g.position, trail:[], trailT:0,
      yaw:p.yaw, pitch:THREE.MathUtils.clamp(p.pitch - 0.5, -1.35, -0.2),
      speed:14, t:0          // slow initial boost, accelerates in _updateHellstorm
    };
    this.camMode = 'hellstorm';
    game.hud.streakCam(true, 'HELLSTORM // STEER WITH MOUSE');
    game.hud.setCrosshair(999, true);
    AudioFX.blip(240, 0.5, 'sawtooth', 0.2);
  },

  _updateHellstorm(dt, game) {
    const h = this.hellstorm;
    if (!h) return;
    h.t += dt;
    // two-stage speed: slow initial boost -> powerful cruise (heavy missile feel)
    h.speed = Math.min(60, h.speed + dt * 10);
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(h.pitch, h.yaw, 0, 'YXZ'));
    const hit = MapData.rayTest(h.pos, dir, h.speed * dt + 0.5);
    const ground = MapData.groundAt(h.pos.x, h.pos.y + 1, h.pos.z);
    h.pos.addScaledVector(dir, h.speed * dt);
    h.group.rotation.set(h.pitch, h.yaw, 0, 'YXZ');

    // smoke trail — pooled puffs (no per-frame mesh allocation). Spawn rate
    // lowered (0.035s → 0.09s) and growth slowed so the trail no longer
    // allocates ~185 meshes per launch or hammers fill rate on laptop GPUs.
    h.trailT = (h.trailT || 0) - dt;
    if (h.trailT <= 0) {
      h.trailT = 0.09;
      const m = this.hsPuffPool.pop();
      if (m) {
        m.position.copy(h.pos);
        m.scale.setScalar(1);
        m.material.opacity = 0.55;
        m.visible = true;
        h.trail.push({ mesh:m, life:0.7 });
      }
    }
    for (let i = h.trail.length - 1; i >= 0; i--) {
      const s = h.trail[i];
      s.life -= dt;
      s.mesh.scale.multiplyScalar(1 + dt * 2.0);
      s.mesh.material.opacity = Math.max(0, s.life) * 0.75;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.hsPuffPool.push(s.mesh);
        h.trail.splice(i, 1);
      }
    }

    // chase camera behind the missile
    const cam = game.camera;
    const back = h.pos.clone().addScaledVector(dir, -4.4).add(new THREE.Vector3(0, 1.2, 0));
    cam.position.lerp(back, Math.min(1, dt * 14));
    cam.lookAt(h.pos.clone().addScaledVector(dir, 8));
    if (Math.abs(cam.fov - 70) > 0.1) { cam.fov = 70; cam.updateProjectionMatrix(); }
    game.hud.streakCam(true, 'HELLSTORM // ' + Math.max(0, 6.5 - h.t).toFixed(1) + 's');

    if (hit || h.pos.y <= ground + 0.4 || h.t > 6.5) {
      this._detonateHellstorm(h.pos.clone(), game);
    }
  },

  _detonateHellstorm(pos, game) {
    const h = this.hellstorm;
    if (!h) return;
    const gy = MapData.groundAt(pos.x, pos.y + 3, pos.z);
    if (gy > -900) pos.y = Math.max(pos.y, gy + 0.3);
    this.scene.remove(h.group);
    for (const s of h.trail) { s.mesh.visible = false; this.hsPuffPool.push(s.mesh); }
    h.trail = [];
    this.hellstorm = null;

    // main warhead + cluster bomblets rain around the impact
    Effects.explosion(pos.clone(), 6);
    AudioFX.explosion(pos.clone(), true);
    this._areaDamage(pos.clone(), 6, 200, game, null, 'hellstorm');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const r = 2.5 + Math.random() * 3.5;
      const bx = pos.x + Math.cos(a) * r, bz = pos.z + Math.sin(a) * r;
      let by = MapData.groundAt(bx, pos.y + 3, bz);
      if (by <= -900) by = pos.y;
      this.bomblets.push({ pos:new THREE.Vector3(bx, by + 0.35, bz), t:0.28 + i * 0.06,
                           dmg:150, radius:4.5, cause:'hellstorm' });
    }
    this._endCamMode(game);
  },

  /* ---------------- LOSTEDAR (orbiting gunship camera) ---------------- */
  _launchLodestar(game) {
    const p = game.player;
    const angle = Math.random() * Math.PI * 2;
    const center = p.pos.clone();
    const camPos = new THREE.Vector3(center.x + Math.cos(angle) * 34, center.y + 38,
                                     center.z + Math.sin(angle) * 34);
    // look from the orbit position down at the player's feet
    const d = center.clone().sub(camPos).normalize();
    this.lodestar = {
      t:0, dur:25, angle, center,
      yaw: Math.atan2(-d.x, d.z), pitch: Math.asin(d.y),
      fireCd:0, aim:center.clone()
    };
    this.camMode = 'lodestar';
    game.hud.streakCam(true, 'LODESTAR // CLICK: STRIKE // 25s');
    game.hud.setCrosshair(999, true);
    AudioFX.blip(180, 0.6, 'sawtooth', 0.18);
  },

  _updateLodestar(dt, game) {
    const L = this.lodestar;
    if (!L) return;
    L.t += dt;
    const cam = game.camera;

    // slow orbit high above the battlefield
    L.angle += dt * 0.14;
    const camPos = new THREE.Vector3(L.center.x + Math.cos(L.angle) * 34,
      L.center.y + 38, L.center.z + Math.sin(L.angle) * 34);
    cam.position.copy(camPos);
    cam.rotation.set(L.pitch, L.yaw, 0, 'YXZ');
    if (Math.abs(cam.fov - 52) > 0.1) { cam.fov = 52; cam.updateProjectionMatrix(); }

    // aim point: ray under the on-screen reticle
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(L.pitch, L.yaw, 0, 'YXZ'));
    const aimHit = MapData.rayTest(camPos, fwd, 300);
    if (aimHit) L.aim.copy(aimHit.point);
    else if (fwd.y < -0.01) {
      const t = (L.center.y - camPos.y) / fwd.y;
      if (t > 0 && t < 300) L.aim.copy(camPos).addScaledVector(fwd, t);
    }

    // volley of strike missiles at the aim point
    L.fireCd -= dt;
    if (Input.fire() && L.fireCd <= 0 && L.t < L.dur) {
      L.fireCd = 0.5;
      for (let k = 0; k < 2; k++) {
        const target = L.aim.clone();
        target.x += (Math.random() - 0.5) * 2.4;
        target.z += (Math.random() - 0.5) * 2.4;
        this._spawnStrike(camPos.clone(), target, k * 0.16);
      }
      AudioFX.shot('launcher', camPos.clone(), 0.5);
    }

    const left = Math.max(0, L.dur - L.t);
    game.hud.streakCam(true, 'LODESTAR // CLICK: STRIKE // ' + left.toFixed(0) + 's');
    if (L.t > L.dur || !game.player.alive) this._endCamMode(game);
  },

  _endCamMode(game) {
    this.camMode = null;
    this.hellstorm = null;
    this.lodestar = null;
    game.hud.streakCam(false);
    // bring the player's gun / arms back now that the remote camera is gone
    if (typeof Viewmodel !== 'undefined' && Viewmodel.root)
      Viewmodel.root.visible = true;
    if (game.camera) {
      game.camera.fov = Settings.data.fov;
      game.camera.updateProjectionMatrix();
    }
  },

  /* one Lodestar strike missile: a pooled shell that flies from the gunship
     down to the aim point, then hands off to the usual bomblet explosion */
  _spawnStrike(from, to, delay) {
    const m = (this._missilePool && this._missilePool.pop()) || null;
    if (!m) {   // pool exhausted — impact immediately rather than drop the shot
      this.bomblets.push({ pos:to, t:0.05, dmg:160, radius:5, cause:'lodestar' });
      return;
    }
    m.position.copy(from);
    m.lookAt(to);            // geometry tip is +Z, so the nose points at target
    m.visible = true;
    this.strikes.push({ mesh:m, from:from.clone(), to:to.clone(),
                        t:-(delay || 0), dur:0.55 });
  },

  _updateStrikes(dt) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      if (s.t < 0) continue;                    // launch stagger delay
      const k = Math.min(1, s.t / s.dur);
      s.mesh.position.lerpVectors(s.from, s.to, k);
      if (k >= 1) {
        s.mesh.visible = false;
        if (this._missilePool) this._missilePool.push(s.mesh);
        this.bomblets.push({ pos:s.to, t:0.02, dmg:160, radius:5, cause:'lodestar' });
        this.strikes.splice(i, 1);
      }
    }
  },

  /* delayed cluster/strike impacts */
  _updateBomblets(dt, game) {
    for (let i = this.bomblets.length - 1; i >= 0; i--) {
      const b = this.bomblets[i];
      b.t -= dt;
      if (b.t <= 0) {
        Effects.explosion(b.pos.clone(), 3.5, { particles: 2, smoke: 0 });
        AudioFX.explosion(b.pos.clone(), false);
        this._areaDamage(b.pos.clone(), b.radius || 4.5, b.dmg || 150, game, null,
                         b.cause || 'hellstorm');
        this.bomblets.splice(i, 1);
      }
    }
  },

  /* ---------------- VTOL WARSHIP (autonomous heavy gunship) ---------------- */
  _spawnVtol(game) {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color:0x333a40, roughness:0.45, metalness:0.65 });
    const darkMat = new THREE.MeshStandardMaterial({ color:0x1c2024, roughness:0.6, metalness:0.5 });
    const fanMat  = new THREE.MeshStandardMaterial({ color:0x8b939a, roughness:0.4, metalness:0.7,
                                                     transparent:true, opacity:0.6 });
    const fus = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 7.5), hullMat); g.add(fus);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.0, 8), hullMat);
    nose.rotation.x = -Math.PI / 2; nose.position.z = -4.6; g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 2.2), hullMat);
    wing.position.set(0, 0.2, 0.6); g.add(wing);
    const fans = [];
    for (const [x, z] of [[-3.6, 0.6], [3.6, 0.6], [-1.4, 2.9], [1.4, 2.9]]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.0, 10), darkMat);
      pod.position.set(x, 0.1, z); g.add(pod);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), fanMat);
      fan.position.set(x, 0.65, z); g.add(fan); fans.push(fan);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.4, 1.6), hullMat);
    tail.position.set(0, 0.9, 3.4); g.add(tail);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.0), hullMat);
    stab.position.set(0, 0.2, 3.6); g.add(stab);
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.0), darkMat);
    turret.position.set(0, -0.85, -3.2); g.add(turret);
    const light = new THREE.PointLight(0xff3b1e, 3, 14, 2);
    light.position.set(0, -0.4, 3.6); g.add(light);

    const start = game.player.pos.clone();
    start.y += 30;
    g.position.copy(start);
    this.scene.add(g);
    this.vtols.push({
      group:g, fans, pos:g.position, vel:new THREE.Vector3(), light,
      t:0, life:0, shootCd:1.5, burst:0,
      center:start.clone(), angle:Math.random() * Math.PI * 2
    });
    AudioFX.blip(200, 0.6, 'sawtooth', 0.2);
  },

  _updateVtols(dt, game) {
    for (let i = this.vtols.length - 1; i >= 0; i--) {
      const v = this.vtols[i];
      v.t += dt; v.life += dt;
      for (const f of v.fans) f.rotation.y += dt * 30;
      v.light.visible = Math.sin(v.t * 8) > 0;

      // wide slow orbit
      v.angle += dt * 0.22;
      const goal = new THREE.Vector3(
        v.center.x + Math.cos(v.angle) * 24,
        v.center.y - 4 + Math.sin(v.t * 0.6) * 2,
        v.center.z + Math.sin(v.angle) * 24);
      const dir = goal.sub(v.pos);
      dir.normalize().multiplyScalar(14);
      v.vel.lerp(dir, Math.min(1, dt * 2));
      v.pos.addScaledVector(v.vel, dt);
      v.group.rotation.y = Math.atan2(v.vel.x, v.vel.z) + Math.PI;
      v.group.rotation.z = THREE.MathUtils.clamp(-v.vel.x * 0.012, -0.4, 0.4);

      // 3-round chain-gun bursts with explosive rounds
      v.shootCd -= dt;
      if (v.shootCd <= 0) {
        const target = BotManager.nearest(game.player.pos, 70);
        if (target && target.alive) {
          const from = v.pos.clone().add(new THREE.Vector3(0, -0.9, -3));
          const to = target.chest.clone();
          const d = to.clone().sub(from);
          const dist = d.length();
          d.normalize();
          const wallHit = MapData.rayTest(from, d, dist);
          if (!wallHit || wallHit.dist > dist - 0.5) {
            Effects.tracer(from, to, 0xffc46a);
            Effects.explosion(to.clone(), 2.6, { particles: 2, smoke: 0 });
            AudioFX.explosion(to.clone(), false);
            this._areaDamage(to.clone(), 3.2, 110, game, null, 'vtol');
            v.burst = (v.burst + 1) % 3;
            v.shootCd = v.burst === 0 ? 1.6 : 0.14;
          } else v.shootCd = 0.6;
        } else v.shootCd = 0.8;
      }
      if (v.life > 55) { this.scene.remove(v.group); this.vtols.splice(i, 1); }
    }
  },

  clear() {
    this.uavTimer = 0;
    for (const d of this.drones) if (d.group.parent) d.group.parent.remove(d.group);
    for (const p of this.packages) if (p.group.parent) p.group.parent.remove(p.group);
    this.drones = []; this.packages = [];
    // camera streaks die with the life they were called on
    if (this.hellstorm) {
      if (this.hellstorm.group.parent) this.hellstorm.group.parent.remove(this.hellstorm.group);
      for (const s of this.hellstorm.trail) { s.mesh.visible = false; this.hsPuffPool.push(s.mesh); }
      this.hellstorm.trail = [];
    }
    for (const v of this.vtols) if (v.group.parent) v.group.parent.remove(v.group);
    if (this.camMode) {
      this.camMode = null;
      if (typeof HUD !== 'undefined') HUD.streakCam(false);
      if (typeof Viewmodel !== 'undefined' && Viewmodel.root)
        Viewmodel.root.visible = true;
      if (typeof Game !== 'undefined' && Game.camera && typeof Settings !== 'undefined') {
        Game.camera.fov = Settings.data.fov;
        Game.camera.updateProjectionMatrix();
      }
    }
    this.hellstorm = null; this.lodestar = null;
    this.vtols = []; this.bomblets = [];
    // recycle any strike missiles still in the air
    for (const s of this.strikes) {
      s.mesh.visible = false;
      if (this._missilePool) this._missilePool.push(s.mesh);
    }
    this.strikes = [];
  },

  /* how far each streak's own earn bar has filled (for HUD fill).
     Optional `game` lets it honour the Hardline perk's cheaper cost. */
  progress(id, score, game) {
    const def = STREAKS[id];
    if (!def || id === 'none') return { pct:0, ready:false, active:false };
    if (id === 'uav' && this.uavTimer > 0) return { pct:1, ready:true, active:true };
    if (id === 'hellstorm' && this.camMode === 'hellstorm')
      return { pct:1, ready:true, active:true };
    if (id === 'lodestar' && this.camMode === 'lodestar')
      return { pct:1, ready:true, active:true };
    const cost = (game && game.streakCost) ? game.streakCost(id) : def.cost;
    if (score < cost) return { pct: Math.max(0, score / cost), ready:false, active:false };
    return { pct:1, ready:true, active:false };
  }
};
