/* =========================================================
   effects.js — muzzle flash, dynamic lights, tracers, sparks,
   bullet-hole decals, smoke, shell casings, explosions.
   Pooled for performance (no per-frame allocations).
   ========================================================= */

function makeGlowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64,64,2,64,64,62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, outer);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0,0,128,128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

const Effects = {
  scene:null, colliders:[],
  texFlash:null, texSpark:null, texSmoke:null, texHole:null,

  init(scene, colliders) {
    if (this.scene === scene && this.flashes) { this.setColliders(colliders); return; }
    this.scene = scene;
    this.colliders = colliders || [];
    this.texFlash = makeGlowTexture('rgba(255,255,235,1)', 'rgba(255,140,30,0.9)');
    this.texSpark = makeGlowTexture('rgba(255,255,200,1)', 'rgba(255,140,30,0.7)');
    this.texSmoke = makeGlowTexture('rgba(200,200,200,0.5)', 'rgba(100,100,100,0.15)');

    // ---- pools ----
    this.flashes = []; this.lights = []; this.tracers = [];
    this.particles = []; this.decals = []; this.shells = [];
    this.smokePuffs = [];

    const flashGeo = new THREE.PlaneGeometry(1,1);
    for (let i=0;i<6;i++) {
      const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({
        map:this.texFlash, transparent:true, blending:THREE.AdditiveBlending,
        depthWrite:false, side:THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 5;
      scene.add(m); this.flashes.push({ mesh:m, life:0 });
    }
    for (let i=0;i<3;i++) {
      const l = new THREE.PointLight(0xffa640, 0, 14, 2);
      l.visible = false; scene.add(l);
      this.lights.push({ light:l, life:0 });
    }
    // muzzle smoke puffs
    const smokeGeo = new THREE.CircleGeometry(0.5, 8);
    const smokeMat = new THREE.MeshBasicMaterial({
      map:this.texSmoke, transparent:true, blending:THREE.NormalBlending,
      depthWrite:false, side:THREE.DoubleSide });
    for (let i=0;i<8;i++) {
      const m = new THREE.Mesh(smokeGeo, smokeMat.clone());
      m.visible = false; m.renderOrder = 4;
      scene.add(m); this.smokePuffs.push({ mesh:m, life:0, vel:new THREE.Vector3() });
    }

    const tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    const tracerMat = new THREE.MeshBasicMaterial({
      color:0xffd080, transparent:true, opacity:0.9,
      blending:THREE.AdditiveBlending, depthWrite:false });
    for (let i=0;i<48;i++) {
      const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
      m.visible = false; scene.add(m);
      this.tracers.push({ mesh:m, life:0, max:0.09 });
    }

    // particles (sparks / blood / debris)
    const pGeo = new THREE.PlaneGeometry(0.09, 0.09);
    // Soft radial dot. Without a map every particle is a hard-edged square,
    // and a square this close to the camera reads as a big pink box artifact
    // (that's what blood spurt used to look like when you were hit).
    this.texDot = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0.00, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.72)');
      grad.addColorStop(1.00, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    for (let i=0;i<140;i++) {
      const mat = new THREE.MeshBasicMaterial({ color:0xffc060, map:this.texDot, transparent:true,
        blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
      const m = new THREE.Mesh(pGeo, mat);
      m.visible = false; scene.add(m);
      this.particles.push({ mesh:m, life:0, vel:new THREE.Vector3(), grav:9, spin:0 });
    }

    // decals (bullet holes)
    const holeTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32,32,2,32,32,30);
      grad.addColorStop(0,'rgba(0,0,0,0.95)');
      grad.addColorStop(0.5,'rgba(10,10,10,0.75)');
      grad.addColorStop(1,'rgba(20,20,20,0)');
      g.fillStyle = grad; g.beginPath(); g.arc(32,32,30,0,7); g.fill();
      // scuff marks
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      for (let i=0;i<8;i++) {
        const a = Math.random()*Math.PI*2, r1 = 8+Math.random()*6, r2 = 20+Math.random()*9;
        g.lineWidth = 1+Math.random()*1.5;
        g.beginPath(); g.moveTo(32+Math.cos(a)*r1, 32+Math.sin(a)*r1);
        g.lineTo(32+Math.cos(a)*r2, 32+Math.sin(a)*r2); g.stroke();
      }
      return new THREE.CanvasTexture(c);
    })();
    this.texHole = holeTex;
    const holeGeo = new THREE.PlaneGeometry(0.16,0.16);
    for (let i=0;i<70;i++) {
      const m = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({
        map:holeTex, transparent:true, depthWrite:false,
        polygonOffset:true, polygonOffsetFactor:-4, opacity:0.95 }));
      m.visible = false; scene.add(m);
      this.decals.push({ mesh:m, life:0 });
    }

    // shell casings
    const shellGeo = new THREE.CylinderGeometry(0.012,0.012,0.045,5);
    const shellMat = new THREE.MeshStandardMaterial({ color:0xc9a13b, metalness:0.8, roughness:0.35 });
    for (let i=0;i<34;i++) {
      const m = new THREE.Mesh(shellGeo, shellMat);
      m.visible = false; scene.add(m);
      this.shells.push({ mesh:m, life:0, vel:new THREE.Vector3(), spin:new THREE.Vector3() });
    }

    // explosion sphere
    this.explosions = [];
    const exGeo = new THREE.SphereGeometry(1, 14, 10);
    for (let i=0;i<5;i++) {
      const m = new THREE.Mesh(exGeo, new THREE.MeshBasicMaterial({
        color:0xffb050, transparent:true, opacity:0.9,
        blending:THREE.AdditiveBlending, depthWrite:false }));
      m.visible = false; scene.add(m);
      const l = new THREE.PointLight(0xffa040, 0, 30, 2);
      l.visible = false; scene.add(l);
      this.explosions.push({ mesh:m, light:l, life:0 });
    }
  },

  setColliders(c) { this.colliders = c; },

  /* ---------- MUZZLE FLASH ---------- */
  muzzleFlash(pos, scale) {
    const f = this.flashes.find(f => f.life <= 0) || this.flashes[0];
    f.mesh.position.copy(pos);
    f.mesh.scale.setScalar((scale || 0.42) * (0.9 + Math.random()*0.3));
    f.mesh.rotation.z = Math.random()*Math.PI*2;
    f.mesh.visible = true; f.mesh.material.opacity = 1;
    f.life = 0.06;
    const cam = this.scene.userData.mainCamera;
    if (cam) f.mesh.lookAt(cam.position);
    const L = this.lights.find(l => l.life <= 0);
    if (L) {
      L.light.position.copy(pos);
      L.light.intensity = 7;
      L.light.visible = true;
      L.life = 0.08;
    }
    // small smoke puff from muzzle
    const s = this.smokePuffs.find(s => s.life <= 0);
    if (s) {
      s.mesh.position.copy(pos);
      s.mesh.scale.setScalar(0.05 + Math.random()*0.03);
      s.mesh.visible = true; s.mesh.material.opacity = 0.5;
      s.life = 0.4;
      s.vel.set((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6 + 0.4, (Math.random()-0.5)*0.6);
    }
  },

  /* ---------- TRACER ---------- */
  tracer(from, to, color) {
    const t = this.tracers.find(t => t.life <= 0);
    if (!t) return;
    const dist = from.distanceTo(to);
    if (dist < 0.5) return;
    t.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.material.color.setHex(color || 0xffd080);
    t.mesh.material.opacity = 0.9;
    t.mesh.visible = true;
    t.life = t.max;
  },

  /* ---------- IMPACT ---------- */
  impact(pos, normal, metallic, blood) {
    // sparks
    const n = blood ? 5 : 8;
    for (let i=0;i<n;i++) {
      const p = this.particles.find(p => p.life <= 0);
      if (!p) break;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(blood ? 0x9b1710 : (metallic ? 0xffd070 : 0xffb060));
      // blood is DARK and non-glowing — additive red in the player's face
      // rendered as a translucent pink box
      p.mesh.material.blending = blood ? THREE.NormalBlending : THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(blood ? 1.1 : 1);
      p.mesh.visible = true;
      p.vel.set(
        normal.x * (1+Math.random()*3) + (Math.random()-0.5)*4,
        normal.y * (1+Math.random()*3) + (Math.random()-0.5)*4,
        normal.z * (1+Math.random()*3) + (Math.random()-0.5)*4
      );
      p.grav = 12; p.life = (blood ? 0.16 : 0.22) + Math.random()*0.2;
    }
    if (!blood) this.decal(pos, normal);
    // small dust puff
    const d = this.particles.find(p => p.life <= 0);
    if (d) {
      d.mesh.position.copy(pos).addScaledVector(normal, 0.06);
      d.mesh.material.color.setHex(metallic ? 0x9aa0a6 : 0xb0a89a);
      d.mesh.material.blending = THREE.NormalBlending;
      d.mesh.material.opacity = 0.5;
      d.mesh.scale.setScalar(1.5);
      d.vel.set(0, 0.6, 0);
      d.grav = -0.4; d.life = 0.5;
      // NOTE: blending is restored by Effects.update() when the particle
      // expires — a setTimeout here would mutate a recycled particle's
      // material after it may have been reused for a different effect.
    }
  },

  decal(pos, normal) {
    const d = this.decals.find(d => !d.mesh.visible) || this.decals[0];
    d.mesh.position.copy(pos).addScaledVector(normal, 0.012);
    d.mesh.lookAt(pos.clone().add(normal));
    d.mesh.rotation.z = Math.random()*Math.PI*2;
    d.mesh.scale.setScalar(0.75 + Math.random()*0.6);
    d.mesh.visible = true;
    d.life = 14;
  },

  smoke(pos, scale, dur) {
    const p = this.particles.find(p => p.life <= 0);
    if (!p) return;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(0x8a8f94);
    p.mesh.material.blending = THREE.NormalBlending;
    p.mesh.material.opacity = 0.42;
    p.mesh.scale.setScalar(scale || 1.6);
    p.mesh.visible = true;
    p.vel.set((Math.random()-0.5)*0.6, 1.1 + Math.random()*0.7, (Math.random()-0.5)*0.6);
    p.grav = -0.25; p.life = dur || 1.4;
    setTimeout(() => { p.mesh.material.blending = THREE.AdditiveBlending; }, (dur||1.4)*1000 + 60);
  },

  /* ---------- SHELL CASING ---------- */
  shell(pos, right, up) {
    const s = this.shells.find(s => s.life <= 0);
    if (!s) return;
    s.mesh.position.copy(pos);
    s.mesh.visible = true;
    s.mesh.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    s.vel.copy(right).multiplyScalar(2.0 + Math.random()*1.2)
      .addScaledVector(up, 1.8 + Math.random())
      .add(new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)));
    s.spin.set((Math.random()-0.5)*20, (Math.random()-0.5)*20, (Math.random()-0.5)*20);
    s.life = 2.6;
  },

  /* ---------- EXPLOSION ---------- */
  // `opts.particles` / `opts.smoke` let callers (killstreaks) dial down the
  // per-explosion cost — killstreak bomblets / VTOL bursts fire many
  // explosions at once, so they use the minimal counts to avoid lag spikes.
  explosion(pos, radius, opts) {
    opts = opts || {};
    const e = this.explosions.find(e => e.life <= 0) || this.explosions[0];
    e.mesh.position.copy(pos);
    e.mesh.scale.setScalar(0.4);
    e.mesh.material.opacity = 0.95;
    e.mesh.visible = true;
    e.light.position.copy(pos);
    e.light.intensity = 22;
    e.light.distance = radius * 5;
    e.light.visible = true;
    e.life = 0.5; e.radius = radius;
    AudioFX.explosion(pos, radius > 5);
    // debris & smoke — kept deliberately light
    const smokeCount = opts.smoke !== undefined ? opts.smoke : 1;
    const particleCount = opts.particles !== undefined ? opts.particles : 4;
    for (let i = 0; i < smokeCount; i++) this.smoke(pos.clone().add(new THREE.Vector3(
      (Math.random()-0.5)*radius*0.6, Math.random()*1.4, (Math.random()-0.5)*radius*0.6)),
      2.6 + Math.random()*2, 1.6);
    for (let i = 0; i < particleCount; i++) {
      const p = this.particles.find(p => p.life <= 0);
      if (!p) break;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(0xffc060);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(1.4);
      p.mesh.visible = true;
      p.vel.set((Math.random()-0.5)*12, Math.random()*8, (Math.random()-0.5)*12);
      p.grav = 9; p.life = 0.4 + Math.random()*0.3;
    }
    return e;
  },

  /* ---------- UPDATE ---------- */
  update(dt) {
    const cam = this.scene.userData.mainCamera;
    for (const f of this.flashes) if (f.life > 0) {
      f.life -= dt;
      f.mesh.material.opacity = Math.max(0, f.life / 0.06);
      if (f.life <= 0) f.mesh.visible = false;
      else if (cam) f.mesh.lookAt(cam.position);
    }
    for (const L of this.lights) if (L.life > 0) {
      L.life -= dt;
      L.light.intensity = Math.max(0, L.life / 0.08) * 7;
      if (L.life <= 0) L.light.visible = false;
    }
    for (const s of this.smokePuffs) if (s.life > 0) {
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.vel.y -= 0.5 * dt;
      s.mesh.scale.setScalar(Math.max(0, s.life / 0.4) * 1.5);
      s.mesh.material.opacity = Math.max(0, s.life / 0.4 * 0.5);
      if (cam) s.mesh.lookAt(cam.position);
      if (s.life <= 0) s.mesh.visible = false;
    }
    for (const t of this.tracers) if (t.life > 0) {
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const p of this.particles) if (p.life > 0) {
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = Math.min(1, p.life * 2.4);
      if (cam) p.mesh.lookAt(cam.position);
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.material.blending = THREE.AdditiveBlending;
        p.mesh.material.needsUpdate = true;
      }
    }
    for (const d of this.decals) if (d.life > 0) {
      d.life -= dt;
      if (d.life <= 0) d.mesh.visible = false;
    }
    for (const s of this.shells) if (s.life > 0) {
      s.life -= dt;
      s.vel.y -= 14 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
      // rest the casing on the floor — but only while it's settling (slow,
      // close to the ground). While a casing is flying the full per-collider
      // scan is pure waste; running it for every live casing every frame is
      // the main per-shot hitch / freeze during automatic fire. Throttle the
      // scan to ~20 Hz per casing so a mag dump doesn't stall the loop.
      const settled = Math.abs(s.vel.y) < 1.0 && s.mesh.position.y < 2.0;
      s._gt = (s._gt || 0) + dt;
      if (settled && s._gt >= 0.05) {
        s._gt = 0;
        let top = -999;
        for (const c of this.colliders) {
          if (s.mesh.position.x > c.min.x-0.05 && s.mesh.position.x < c.max.x+0.05 &&
              s.mesh.position.z > c.min.z-0.05 && s.mesh.position.z < c.max.z+0.05 &&
              c.max.y <= s.mesh.position.y + 0.05 && c.max.y > top) top = c.max.y;
        }
        if (top > -900 && s.mesh.position.y <= top + 0.03) {
          s.mesh.position.y = top + 0.03;
          s.vel.multiplyScalar(0.25); s.vel.y = Math.abs(s.vel.y) * 0.3;
          if (s.vel.y < 0.4) s.vel.set(0,0,0);
        }
      }
      if (s.mesh.position.y < -8 || s.life <= 0) s.mesh.visible = false;
    }
    for (const e of this.explosions) if (e.life > 0) {
      e.life -= dt;
      const k = 1 - e.life / 0.5;
      e.mesh.scale.setScalar(0.4 + k * e.radius * 1.15);
      e.mesh.material.opacity = Math.max(0, (1-k) * 0.95);
      e.light.intensity = Math.max(0, (1-k)) * 22;
      if (e.life <= 0) { e.mesh.visible = false; e.light.visible = false; }
    }
  },

  clear() {
    for (const f of (this.flashes || [])) { f.life = 0; f.mesh.visible = false; }
    for (const t of (this.tracers || [])) { t.life = 0; t.mesh.visible = false; }
    for (const p of (this.particles || [])) { p.life = 0; p.mesh.visible = false;
      p.mesh.material.blending = THREE.AdditiveBlending; }
    for (const d of (this.decals || [])) { d.life = 0; d.mesh.visible = false; }
    for (const s of (this.shells || [])) { s.life = 0; s.mesh.visible = false; }
    for (const sp of (this.smokePuffs || [])) { sp.life = 0; sp.mesh.visible = false; }
    for (const e of (this.explosions || [])) { e.life = 0; e.mesh.visible = false; e.light.visible = false; }
  }
};
