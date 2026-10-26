/* =========================================================
   bots.js — enemy AI: humanoid low-poly bots with patrol /
   engage / flank states, obstacle avoidance, LOS checks,
   burst fire, procedural walk animation, death fall.
   ========================================================= */

const BOT_GEO = {};   // shared geometry (created once)

/* ---------- procedural bot textures (no binary assets) ---------- */
function botTex(draw, w=128, h=128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
const BOT_TEX = {
  camo: botTex((ctx, w, h) => {
    ctx.fillStyle = '#4a5040'; ctx.fillRect(0,0,w,h);
    const blob = (col, n, rmin, rmax) => {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        const x = Math.random()*w, y = Math.random()*h, r = Math.random()*(rmax-rmin)+rmin;
        ctx.moveTo(x+r, y);
        for (let a = 0; a < Math.PI*2; a += 0.5) ctx.lineTo(x+Math.cos(a)*(r*(0.6+Math.random()*0.6)), y+Math.sin(a)*(r*(0.6+Math.random()*0.6)));
        ctx.closePath(); ctx.fill();
      }
    };
    blob('#5a6048', 22, 6, 18);
    blob('#3a4030', 16, 4, 12);
    blob('#6a7050', 14, 4, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 300; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
  }),
  skin: botTex((ctx, w, h) => {
    ctx.fillStyle = '#a87b58'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(120,90,60,0.25)';
    for (let i = 0; i < 300; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    // stubble / shading
    ctx.fillStyle = 'rgba(80,55,35,0.2)';
    for (let i = 0; i < 120; i++) ctx.fillRect(Math.random()*w, Math.random()*h*0.4+h*0.6, 1,1);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random()*w, Math.random()*h); ctx.lineTo(Math.random()*w, Math.random()*h); ctx.stroke();
    }
  }),
  helmet: botTex((ctx, w, h) => {
    ctx.fillStyle = '#2c3129'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(60,70,60,0.3)';
    for (let i = 0; i < 200; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    // camo scrim strips
    ctx.strokeStyle = 'rgba(80,90,70,0.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random()*w, 0); ctx.lineTo(Math.random()*w, h); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random()*w, 0); ctx.lineTo(Math.random()*w, h); ctx.stroke();
    }
  }),
  vest: botTex((ctx, w, h) => {
    ctx.fillStyle = '#1d2124'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(40,45,48,0.25)';
    for (let i = 0; i < 300; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    // MOLLE webbing rows
    ctx.strokeStyle = 'rgba(20,24,26,0.7)'; ctx.lineWidth = 3;
    for (let y = 8; y < h; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    // pouches
    ctx.fillStyle = 'rgba(30,34,38,0.9)';
    for (let y = 12; y < h-8; y += 16) {
      for (let x = 6; x < w-10; x += 28) {
        ctx.fillRect(x, y, 18, 12);
        ctx.strokeStyle = 'rgba(50,56,60,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, 18, 12);
      }
    }
  }),
  boot: botTex((ctx, w, h) => {
    ctx.fillStyle = '#1a1c1e'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(40,42,44,0.3)';
    for (let i = 0; i < 200; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 8) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  }),
  pack: botTex((ctx, w, h) => {
    ctx.fillStyle = '#3a4030'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(20,24,18,0.5)'; ctx.lineWidth = 2;
    for (let y = 10; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(60,66,50,0.3)';
    for (let i = 0; i < 200; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
  }),
};

function initBotGeo() {
  if (BOT_GEO.torso) return;
  BOT_GEO.torso   = new THREE.BoxGeometry(0.56, 0.62, 0.30);
  BOT_GEO.vest    = new THREE.BoxGeometry(0.60, 0.44, 0.34);
  BOT_GEO.head    = new THREE.BoxGeometry(0.26, 0.26, 0.26);
  BOT_GEO.helmet  = new THREE.BoxGeometry(0.30, 0.16, 0.30);
  BOT_GEO.leg     = new THREE.BoxGeometry(0.17, 0.60, 0.19);
  BOT_GEO.boot    = new THREE.BoxGeometry(0.19, 0.18, 0.26);
  BOT_GEO.arm     = new THREE.BoxGeometry(0.13, 0.52, 0.15);
  BOT_GEO.gun     = new THREE.BoxGeometry(0.09, 0.12, 0.66);
  BOT_GEO.chestT  = new THREE.BoxGeometry(0.18, 0.22, 0.04);
  BOT_GEO.pack    = new THREE.BoxGeometry(0.40, 0.46, 0.16);
  BOT_GEO.pouch   = new THREE.BoxGeometry(0.10, 0.12, 0.06);
  BOT_GEO.glove   = new THREE.BoxGeometry(0.14, 0.12, 0.16);
}

const BOT_MAT = {};
function initBotMat() {
  if (BOT_MAT.fatigues) return;
  BOT_MAT.fatigues = new THREE.MeshStandardMaterial({ map:BOT_TEX.camo, color:0xffffff, roughness:0.9, metalness:0.05 });
  BOT_MAT.vest     = new THREE.MeshStandardMaterial({ map:BOT_TEX.vest, color:0xffffff, roughness:0.8, metalness:0.2 });
  BOT_MAT.skin     = new THREE.MeshStandardMaterial({ map:BOT_TEX.skin, color:0xffffff, roughness:0.85 });
  BOT_MAT.helmet   = new THREE.MeshStandardMaterial({ map:BOT_TEX.helmet, color:0xffffff, roughness:0.7, metalness:0.25 });
  BOT_MAT.gun      = new THREE.MeshStandardMaterial({ color:0x1a1d20, roughness:0.6, metalness:0.5 });
  BOT_MAT.mark     = new THREE.MeshStandardMaterial({ color:0xd33a22, roughness:0.6,
                         emissive:0x4a0d05, emissiveIntensity:0.8 });
  BOT_MAT.boot     = new THREE.MeshStandardMaterial({ map:BOT_TEX.boot, color:0xffffff, roughness:0.85, metalness:0.1 });
  BOT_MAT.pack     = new THREE.MeshStandardMaterial({ map:BOT_TEX.pack, color:0xffffff, roughness:0.9, metalness:0.05 });
  BOT_MAT.glove    = new THREE.MeshStandardMaterial({ color:0x1b1e21, roughness:0.9, metalness:0.05 });
  BOT_MAT.pouch    = new THREE.MeshStandardMaterial({ color:0x2a2e32, roughness:0.85, metalness:0.1 });
}

class Bot {
  constructor(scene, pos, wave) {
    initBotGeo(); initBotMat();
    this.scene = scene;
    this.feet = pos.clone();
    this.vel = new THREE.Vector3();
    this.center = new THREE.Vector3();          // AABB center (updated)
    this.half = new THREE.Vector3(0.34, 0.85, 0.34);
    this.maxHp = 90 + wave * 14;
    this.hp = this.maxHp;
    this.wave = wave;
    this.speed = 3.1 + Math.min(1.4, wave * 0.12) + Math.random() * 0.5;
    this.baseSpeed = this.speed;
    this.alive = true;
    this.deadT = 0;
    this.state = 'patrol';
    this.target = this._randomWaypoint();
    this.pauseT = Math.random() * 2;
    this.losTimer = 0; this.hasLos = false;
    this.lastKnown = new THREE.Vector3();
    this.burstLeft = 0; this.shootCd = 1 + Math.random() * 1.5;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.flankT = 0;
    this.flanking = false;
    this.blindT = 0;
    this.firedT = 0;
    this.slowT = 0;
    this.walkT = Math.random() * 6;
    this.moving = false;
    this.damageFlash = 0;
    /* stuck detection: tracks position over time; if the bot is "moving"
       but barely changing position for a few seconds, trigger unstuck. */
    this.stuckTimer = 0;
    this.stuckCheckPos = this.feet.clone();
    this.stuckRoamT = 0;

    /* ---- build mesh ---- */
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    this.legL = new THREE.Group(); this.legL.position.set(-0.13, 0.78, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.13, 0.78, 0);
    const ll = new THREE.Mesh(BOT_GEO.leg, BOT_MAT.fatigues); ll.position.y = -0.30;
    const lr = new THREE.Mesh(BOT_GEO.leg, BOT_MAT.fatigues); lr.position.y = -0.30;
    ll.castShadow = lr.castShadow = true;
    this.legL.add(ll); this.legR.add(lr);
    // boots at the bottom of each leg
    const bl = new THREE.Mesh(BOT_GEO.boot, BOT_MAT.boot); bl.position.y = -0.69;
    const br = new THREE.Mesh(BOT_GEO.boot, BOT_MAT.boot); br.position.y = -0.69;
    bl.castShadow = br.castShadow = true;
    this.legL.add(bl); this.legR.add(br);
    g.add(this.legL, this.legR);
    add(BOT_GEO.torso, BOT_MAT.fatigues, 0, 1.09, 0);
    this.vest = add(BOT_GEO.vest, BOT_MAT.vest.clone(), 0, 1.09, 0);
    add(BOT_GEO.chestT, BOT_MAT.mark, 0, 1.15, -0.18);      // red team patch
    // vest pouches
    add(BOT_GEO.pouch, BOT_MAT.pouch, -0.18, 0.98, -0.18);
    add(BOT_GEO.pouch, BOT_MAT.pouch, -0.06, 0.98, -0.18);
    add(BOT_GEO.pouch, BOT_MAT.pouch, 0.06, 0.98, -0.18);
    add(BOT_GEO.pouch, BOT_MAT.pouch, 0.18, 0.98, -0.18);
    // backpack
    add(BOT_GEO.pack, BOT_MAT.pack, 0, 1.12, 0.22);
    this.head = add(BOT_GEO.head, BOT_MAT.skin, 0, 1.55, 0);
    add(BOT_GEO.helmet, BOT_MAT.helmet, 0, 1.66, 0);
    this.armL = new THREE.Group(); this.armL.position.set(-0.34, 1.32, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.34, 1.32, 0);
    const al = new THREE.Mesh(BOT_GEO.arm, BOT_MAT.fatigues); al.position.y = -0.24;
    const ar = new THREE.Mesh(BOT_GEO.arm, BOT_MAT.fatigues); ar.position.y = -0.24;
    al.castShadow = ar.castShadow = true;
    this.armL.add(al); this.armR.add(ar);
    // gloves at the end of each arm
    const gl = new THREE.Mesh(BOT_GEO.glove, BOT_MAT.glove); gl.position.y = -0.52;
    const gr = new THREE.Mesh(BOT_GEO.glove, BOT_MAT.glove); gr.position.y = -0.52;
    this.armL.add(gl); this.armR.add(gr);
    g.add(this.armL, this.armR);
    this.gunMesh = add(BOT_GEO.gun, BOT_MAT.gun, 0.24, 1.22, -0.30);
    this.gunMesh.castShadow = false;
    // muzzle ref
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0.24, 1.22, -0.66);
    g.add(this.muzzle);

    this.group = g;
    g.position.copy(this.feet);
    scene.add(g);
    this._hurtMat = null;
  }

  get eye() {
    return new THREE.Vector3(this.feet.x, this.feet.y + 1.58, this.feet.z);
  }
  get recentlyFired() { return this.firedT > 0; }
  get chest() {
    return new THREE.Vector3(this.feet.x, this.feet.y + 1.15, this.feet.z);
  }

  _randomWaypoint() {
    const sp = MapData.spawns;
    return sp[Math.floor(Math.random() * sp.length)].clone();
  }

  /* ray against this bot; returns {dist, head} or null */
  rayHit(origin, dir, maxDist) {
    if (!this.alive) return null;
    // head box
    const hb = { min:new THREE.Vector3(this.feet.x-0.17, this.feet.y+1.44, this.feet.z-0.17),
                 max:new THREE.Vector3(this.feet.x+0.17, this.feet.y+1.74, this.feet.z+0.17) };
    const th = rayBox(origin, dir, hb, maxDist);
    if (th != null) return { dist:th, head:true };
    const bb = { min:new THREE.Vector3(this.feet.x-0.36, this.feet.y, this.feet.z-0.36),
                 max:new THREE.Vector3(this.feet.x+0.36, this.feet.y+1.44, this.feet.z+0.36) };
    const tb = rayBox(origin, dir, bb, maxDist);
    if (tb != null) return { dist:tb, head:false };
    return null;
  }

  damage(amount, headshot) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.damageFlash = 0.12;
    this.state = 'engage';
    if (this.hp <= 0) {
      this.alive = false;
      this.deadT = 0;
      this.state = 'dead';
      return true;
    }
    return false;
  }

  update(dt, player, game) {
    if (!this.alive) {
      // death fall
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.6);
      this.group.rotation.x = -k * Math.PI / 2 * 0.92;
      this.group.position.y = this.feet.y - k * 0.15;
      if (this.deadT > 6) this.dispose();
      return;
    }

    if (this.blindT > 0) this.blindT -= dt;
    if (this.firedT > 0) this.firedT -= dt;

    /* ---------- perception ---------- */
    this.losTimer -= dt;
    if (this.losTimer <= 0) {
      this.losTimer = 0.15 + Math.random() * 0.1;
      const from = this.eye;
      const to = player.eye;
      this.hasLos = (this.blindT <= 0) && player.alive && MapData.losClear(from, to);
      if (this.hasLos) this.lastKnown.copy(player.pos);
    }
    this.state = this.hasLos ? 'engage' : (this.state === 'engage' ? 'hunt' : 'patrol');

    /* ---------- steering ---------- */
    let slowMul = 1;
    if (this.slowT > 0) { this.slowT -= dt; slowMul = 0.45; }
    const speedBase = (this.state === 'engage' ? this.speed * 0.72 : this.speed) * slowMul;
    let desired = new THREE.Vector3();
    this.moving = false;

    const toP = new THREE.Vector3().subVectors(player.pos, this.feet); toP.y = 0;
    const distToPlayer = toP.length();

    if (this.state === 'engage') {
      // flank: occasionally circle wide around the player instead of strafing in place
      this.flankT -= dt;
      if (this.flankT <= 0) {
        this.flankT = 4 + Math.random() * 6;
        this.flanking = Math.random() < 0.35;
      }
      toP.normalize();
      const side = new THREE.Vector3(-toP.z, 0, toP.x);
      let strafeMul = this.flanking ? 0.4 : 0.85;
      if (this.flanking) {
        // run wide to the side, then close back in
        desired.copy(side).multiplyScalar(strafeMul);
        if (distToPlayer > 14) desired.addScaledVector(toP, 0.5);
      } else {
        desired.copy(side).multiplyScalar(strafeMul);
        if (distToPlayer > 26) desired.addScaledVector(toP, 1);
        else if (distToPlayer < 7) desired.addScaledVector(toP, -0.9);
      }
      // low health → fall back & take cover briefly
      if (this.hp < this.maxHp * 0.35 && distToPlayer < 16) {
        desired.addScaledVector(toP, -0.6);
        this.speed = this.baseSpeed * 0.7;   // fixed reduced speed (was compounding every frame → bot froze)
      } else this.speed = this.baseSpeed;
    } else if (this.state === 'hunt') {
      const toT = new THREE.Vector3().subVectors(this.lastKnown, this.feet); toT.y = 0;
      if (toT.length() < 1.5) { this.target = this._randomWaypoint(); this.state = 'patrol'; }
      else desired.copy(toT.normalize());
    } else {
      // patrol
      if (this.pauseT > 0) {
        this.pauseT -= dt;
        if (this.pauseT <= 0) this.target = this._randomWaypoint();
      } else {
        const toT = new THREE.Vector3().subVectors(this.target, this.feet); toT.y = 0;
        if (toT.length() < 1.6) { this.pauseT = 0.5 + Math.random() * 2.5; }
        else desired.copy(toT.normalize());
      }
    }

    /* obstacle avoidance: probe ahead (improved — multiple probes) */
    if (desired.lengthSq() > 0.01) {
      this.moving = true;
      const from = new THREE.Vector3(this.feet.x, this.feet.y + 1.0, this.feet.z);
      const fwd = desired.clone().normalize();
      const probe = 1.6;
      let hit = MapData.rayTest(from, fwd, probe);
      if (hit) {
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
        const left = right.clone().negate();
        // probe left/right/up-diagonal to find a clear path
        const hr = MapData.rayTest(from, right, probe * 1.2);
        const hl = MapData.rayTest(from, left, probe * 1.2);
        const hd = MapData.rayTest(from, new THREE.Vector3().copy(fwd).add(right).normalize(), probe * 0.9);
        const hs = MapData.rayTest(from, new THREE.Vector3().copy(fwd).add(left).normalize(), probe * 0.9);

        let steer = null;
        if (!hr && hl) steer = right;
        else if (!hl && hr) steer = left;
        else if (!hd) steer = new THREE.Vector3().copy(fwd).add(right).normalize().multiplyScalar(0.7);
        else if (!hs) steer = new THREE.Vector3().copy(fwd).add(left).normalize().multiplyScalar(0.7);
        else steer = (Math.random() < 0.5 ? right : left);

        if (steer) {
          desired = steer.multiplyScalar(0.85).addScaledVector(fwd, 0.4);
        }
      }
    }

    /* ---------- stuck detection ---------- */
    if (this.moving) {
      const dMoved = this.feet.distanceTo(this.stuckCheckPos);
      if (dMoved < 0.15) {
        this.stuckTimer += dt;
      } else {
        this.stuckTimer = 0;
        this.stuckCheckPos.copy(this.feet);
      }
      if (this.stuckTimer > 2.0) {
        // stuck for 2s while trying to move -> pick a new destination
        this.stuckTimer = 0;
        this.stuckCheckPos.copy(this.feet);
        this.target = this._randomWaypoint();
        // force it far enough to actually move somewhere
        const toT = new THREE.Vector3().subVectors(this.target, this.feet); toT.y = 0;
        if (toT.length() < 12) {
          // walker picked a nearby point; bias outward
          toT.normalize().multiplyScalar(12);
          this.target.copy(this.feet).add(toT);
        }
        this.state = 'patrol';
        this.flanking = false;
        this.strafeDir *= -1;
        this.stuckRoamT = 3 + Math.random() * 4;
      }
    } else {
      this.stuckTimer = 0;
      this.stuckCheckPos.copy(this.feet);
    }

    /* ---------- movement physics ---------- */
    const spd = speedBase;
    const targetVel = desired.multiplyScalar(spd);
    this.vel.x += (targetVel.x - this.vel.x) * Math.min(1, dt * 7);
    this.vel.z += (targetVel.z - this.vel.z) * Math.min(1, dt * 7);
    this.vel.y -= 22 * dt;                       // gravity
    if (this.vel.y < -30) this.vel.y = -30;

    this.center.copy(this.feet).add(this.half);
    this.center.addScaledVector(this.vel, dt);
    const res = resolveCollision(this.center, this.half, MapData.colliders, 0.55,
                                 { x: this.vel.x, y: this.vel.y, z: this.vel.z });
    if (res.grounded && this.vel.y < 0) this.vel.y = 0;
    if (res.ceiling && this.vel.y > 0) this.vel.y = 0;
    // stop pushing into whatever we hit (only the driving component)
    if (res.pushX < 0 && this.vel.x > 0) this.vel.x = 0;
    if (res.pushX > 0 && this.vel.x < 0) this.vel.x = 0;
    if (res.pushZ < 0 && this.vel.z > 0) this.vel.z = 0;
    if (res.pushZ > 0 && this.vel.z < 0) this.vel.z = 0;
    this.feet.copy(this.center).sub(this.half);

    // stick to the floor when walking down stairs/ramps
    if (res.grounded && this.vel.y <= 0.01) {
      const g = MapData.groundAt(this.feet.x, this.feet.y + 0.05, this.feet.z);
      if (g > -900 && this.feet.y - g > 0.005 && this.feet.y - g <= 0.6) this.feet.y = g;
    }

    // ---------- don't walk through the player ----------
    if (player && player.alive) {
      const pHalfX = 0.35, pHalfZ = 0.35;
      const pTop = player.pos.y + player.height;
      const pBot = player.pos.y;
      const dx = this.feet.x - player.pos.x;
      const dz = this.feet.z - player.pos.z;
      const ox = (this.half.x + pHalfX) - Math.abs(dx);
      const oz = (this.half.z + pHalfZ) - Math.abs(dz);
      const yOverlap = this.feet.y < pTop - 0.05 && this.feet.y + this.half.y * 2 > pBot + 0.05;
      if (ox > 0 && oz > 0 && yOverlap) {
        if (ox < oz) {
          this.feet.x += (dx >= 0 ? ox : -ox);
          this.vel.x *= 0.15;
        } else {
          this.feet.z += (dz >= 0 ? oz : -oz);
          this.vel.z *= 0.15;
        }
        this.center.copy(this.feet).add(this.half);
      }
    }

    /* fell off the map? */
    if (this.feet.y < -3) { this.damage(999, false); return; }

    /* ---------- shooting ---------- */
    if (this.hasLos && player.alive) {
      this.shootCd -= dt;
      if (this.shootCd <= 0) {
        if (this.burstLeft <= 0) {
          this.burstLeft = 3 + Math.floor(Math.random() * 3);
          this.shootCd = 0.09;
        } else {
          this.burstLeft--;
          this._fire(player, game);
          if (this.burstLeft === 0) {
            this.shootCd = 0.7 + Math.random() * 1.1;
          } else this.shootCd = 0.10;
        }
      }
    }

    /* ---------- animation ---------- */
    const planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.walkT += dt * (3 + planarSpeed * 1.7);
    const sw = this.moving ? Math.sin(this.walkT) * 0.55 : 0;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    const aimK = this.state === 'engage' || this.state === 'hunt' ? 1 : 0;
    this._aimK = (this._aimK || 0) + (aimK - (this._aimK || 0)) * Math.min(1, dt * 6);
    this.armL.rotation.x = -0.9 * this._aimK + sw * 0.3;
    this.armR.rotation.x = -1.25 * this._aimK - sw * 0.3;
    this.armL.rotation.z = 0.25 * (1 - this._aimK);
    this.armR.rotation.z = -0.2 * (1 - this._aimK);
    // body yaw toward target
    let yawT;
    if (this.state === 'engage') {
      yawT = Math.atan2(player.pos.x - this.feet.x, player.pos.z - this.feet.z) + Math.PI;
    } else if (this.state === 'hunt') {
      yawT = Math.atan2(this.lastKnown.x - this.feet.x, this.lastKnown.z - this.feet.z) + Math.PI;
    } else if (planarSpeed > 0.3) {
      yawT = Math.atan2(this.vel.x, this.vel.z) + Math.PI;
    } else yawT = this.group.rotation.y;
    // smooth yaw
    let dy = yawT - this.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.group.rotation.y += dy * Math.min(1, dt * 7);
    // slight bob
    this.group.position.set(this.feet.x, this.feet.y + (this.moving ? Math.abs(Math.sin(this.walkT)) * 0.04 : 0), this.feet.z);

    if (this.damageFlash > 0) {
      this.damageFlash -= dt;
      const f = Math.max(0, this.damageFlash / 0.12);
      if (!this.vest.material.emissive) this.vest.material.emissive = new THREE.Color();
      this.vest.material.emissive.setRGB(0.5 * f, 0.05 * f, 0.02 * f);
      if (f <= 0) this.vest.material.emissive.setRGB(0, 0, 0);
    }
  }

  _fire(player, game) {
    this.firedT = 4;
    const from = this.eye.clone();
    this.muzzle.getWorldPosition(this._mp || (this._mp = new THREE.Vector3()));
    const origin = this._mp;
    const to = player.eye.clone();
    const dist = from.distanceTo(to);

    // accuracy: better at close range, worse when flinched
    let acc = Math.max(0.35, 0.92 - dist * 0.016 - (this.wave > 4 ? 0.04 : 0));
    if (player.crouching || player.proning) acc -= 0.1;
    const hit = Math.random() < acc;

    const dir = to.sub(from).normalize();
    if (hit) {
      // aim directly at player
    } else {
      dir.x += (Math.random() - 0.5) * 0.16;
      dir.y += (Math.random() - 0.5) * 0.12;
      dir.z += (Math.random() - 0.5) * 0.16;
      dir.normalize();
    }

    AudioFX.shot('bot', origin, Math.min(1, 14 / Math.max(4, dist)));
    Effects.muzzleFlash(origin, 0.32);

    // trace until world or player
    let end;
    const wallHit = MapData.rayTest(origin, dir, 140);
    const wallDist = wallHit ? wallHit.dist : 140;
    const pHitDist = hit ? dist - 0.15 : 999;
    if (pHitDist < wallDist) {
      end = origin.clone().addScaledVector(dir, pHitDist);
      if (hit) {
        const dmg = 7 + Math.random() * 6 + this.wave * 0.5;
        game.onPlayerHit(dmg, from);
        Effects.impact(player.eye.clone().addScaledVector(dir, -0.7), dir.clone().negate(), false, true);
      } else {
        if (wallHit) { end = wallHit.point.clone(); Effects.impact(end, wallHit.normal, wallHit.collider.metal, false); }
      }
    } else if (wallHit) {
      end = wallHit.point.clone();
      Effects.impact(end, wallHit.normal, wallHit.collider.metal, false);
    } else {
      end = origin.clone().addScaledVector(dir, 140);
    }
    Effects.tracer(origin, end, 0xffb060);
  }

  dispose() {
    if (this.group && this.group.parent) this.group.parent.remove(this.group);
    this.removed = true;
  }
}

/* axis-aligned box ray test — returns t or null */
function rayBox(origin, dir, box, maxDist) {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [
    [origin.x, dir.x, box.min.x, box.max.x],
    [origin.y, dir.y, box.min.y, box.max.y],
    [origin.z, dir.z, box.min.z, box.max.z]
  ];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return null; }
    else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

const BotManager = {
  bots:[], scene:null,
  init(scene) { this.scene = scene; this.bots = []; },
  spawn(pos, wave) {
    const b = new Bot(this.scene, pos, wave);
    this.bots.push(b);
    return b;
  },
  update(dt, player, game) {
    for (let i = this.bots.length - 1; i >= 0; i--) {
      const b = this.bots[i];
      try {
        b.update(dt, player, game);
      } catch (e) {
        // one malfunctioning bot must never take the whole game loop down
        console.error('bot update error:', e);
        b.dispose();
      }
      if (b.removed) this.bots.splice(i, 1);
    }
    this._separate(player);
  },

  /* keep bots from occupying the same space (they used to stack up and
     walk through each other) */
  _separate(player) {
    const live = this.bots.filter(b => b.alive);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        const dx = b.feet.x - a.feet.x;
        const dz = b.feet.z - a.feet.z;
        const need = a.half.x + b.half.x;
        const ox = need - Math.abs(dx);
        const oz = need - Math.abs(dz);
        if (ox <= 0 || oz <= 0) continue;
        if (Math.abs(a.feet.y - b.feet.y) > 1.2) continue;   // different floors
        if (ox < oz) {
          const s = (dx >= 0 ? 1 : -1) * ox * 0.5;
          a.feet.x -= s; b.feet.x += s;
          a.vel.x *= 0.5; b.vel.x *= 0.5;
          a.center.copy(a.feet).add(a.half);
          b.center.copy(b.feet).add(b.half);
        } else {
          const s = (dz >= 0 ? 1 : -1) * oz * 0.5;
          a.feet.z -= s; b.feet.z += s;
          a.vel.z *= 0.5; b.vel.z *= 0.5;
          a.center.copy(a.feet).add(a.half);
          b.center.copy(b.feet).add(b.half);
        }
      }
    }
  },
  alive() { return this.bots.filter(b => b.alive); },
  clear() {
    for (const b of this.bots) b.dispose();
    this.bots = [];
  },
  /* nearest alive bot to a point */
  nearest(pos, maxDist) {
    let best = null, bd = maxDist || 1e9;
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = b.feet.distanceTo(pos);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
};
