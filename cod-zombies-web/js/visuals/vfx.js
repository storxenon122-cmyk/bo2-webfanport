/* =========================================================
   visuals/vfx.js — pooled particle VFX manager for the Zombies
   mode. Owns its own particle pool (capped at 50 live particles)
   plus a screen-flash overlay for round start/end and purchase
   feedback. All procedural — no textures loaded from disk; the
   soft dot sprite is drawn on a canvas once and reused.
   ========================================================= */

const VFXManager = {
  MAX_PARTICLES:50,
  scene:null,
  _pool:[],
  _geo:null,
  _tex:null,
  _flashEl:null,
  _flash:{ t:0, dur:0, max:0, color:'#ffffff' },

  /* Create the pool + flash overlay once; re-parent on scene change. */
  init(scene) {
    this.scene = scene;
    if (!this._tex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      grad.addColorStop(0.00, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.72)');
      grad.addColorStop(1.00, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      this._tex = new THREE.CanvasTexture(c);
    }
    if (!this._geo) this._geo = new THREE.PlaneGeometry(0.12, 0.12);

    if (this._pool.length === 0) {
      for (let i = 0; i < this.MAX_PARTICLES; i++) {
        const mat = new THREE.MeshBasicMaterial({
          map:this._tex, transparent:true, depthWrite:false,
          blending:THREE.AdditiveBlending, side:THREE.DoubleSide, color:0xffffff
        });
        const m = new THREE.Mesh(this._geo, mat);
        m.visible = false; m.renderOrder = 7;
        scene.add(m);
        this._pool.push({ mesh:m, life:0, max:1, vel:new THREE.Vector3(), grav:0, spin:0, baseScale:1 });
      }
    } else {
      for (const p of this._pool) {
        if (p.mesh.parent !== scene) scene.add(p.mesh);
        p.life = 0; p.mesh.visible = false;
      }
    }
    this._initFlash();
  },

  /* Lazily create the fullscreen flash div (a simple tinted overlay). */
  _initFlash() {
    if (this._flashEl && this._flashEl.parentNode) return;
    const el = document.createElement('div');
    el.id = 'kino-vfx-flash';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;' +
      'opacity:0;transition:none;background:#ffffff;mix-blend-mode:screen;';
    document.body.appendChild(el);
    this._flashEl = el;
  },

  /* Grab a free particle (recycles the oldest when the pool is exhausted). */
  _take() {
    let best = null;
    for (const p of this._pool) if (p.life <= 0) { best = p; break; }
    if (!best) {
      best = this._pool[0];
      for (const p of this._pool) if (p.life < best.life) best = p;
    }
    return best;
  },

  /* ---------- MUZZLE FLASH ---------- */
  muzzleFlash(pos, scale) {
    if (!this.scene || !pos) return;
    const p = this._take();
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(0xffd070);
    p.mesh.material.blending = THREE.AdditiveBlending;
    p.mesh.material.opacity = 1;
    p.baseScale = (scale || 0.4) * (0.9 + Math.random() * 0.3);
    p.mesh.scale.setScalar(p.baseScale);
    p.mesh.rotation.z = Math.random() * Math.PI * 2;
    p.mesh.visible = true;
    p.life = p.max = 0.06;
    p.vel.set(0, 0, 0); p.grav = 0;
    const cam = this.scene.userData.mainCamera;
    if (cam) p.mesh.lookAt(cam.position);
  },

  /* ---------- IMPACT SPARKS ---------- */
  impactSparks(pos, normal, metallic) {
    if (!this.scene || !pos) return;
    const n = normal || new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i++) {
      const p = this._take();
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(metallic ? 0xffd880 : 0xffb060);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
      p.baseScale = 0.7 + Math.random() * 0.4;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
      p.life = p.max = 0.18 + Math.random() * 0.18;
      p.vel.set(
        n.x * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 3.5,
        n.y * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 3.5,
        n.z * (1 + Math.random() * 2.5) + (Math.random() - 0.5) * 3.5
      );
      p.grav = 11;
    }
  },

  /* ---------- BLOOD MIST ---------- */
  bloodMist(pos, dir) {
    if (!this.scene || !pos) return;
    const d = dir || new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 7; i++) {
      const p = this._take();
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(0x7a1410);
      // blood reads better as normal (non-glowing) mist
      p.mesh.material.blending = THREE.NormalBlending;
      p.mesh.material.opacity = 0.85;
      p.baseScale = 1.1 + Math.random() * 0.6;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
      p.life = p.max = 0.22 + Math.random() * 0.2;
      p.vel.set(
        d.x * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2.5,
        d.y * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2.5 + 0.6,
        d.z * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2.5
      );
      p.grav = 7;
    }
  },

  /* ---------- ROUND START / END SCREEN FLASH ---------- */
  roundFlash(kind) {
    this._initFlash();
    if (!this._flashEl) return;
    // start = bright white pop; end = softer orange fade
    if (kind === 'end') { this._flash.color = '#ff9a3c'; this._flash.max = 0.5; this._flash.dur = 0.7; }
    else                { this._flash.color = '#ffffff'; this._flash.max = 0.85; this._flash.dur = 0.5; }
    this._flash.t = this._flash.dur;
    this._flashEl.style.background = this._flash.color;
  },

  /* ---------- MYSTERY BOX SPIN SPARKLE ---------- */
  boxSparkle(pos, duration) {
    if (!this.scene || !pos) return;
    for (let i = 0; i < 5; i++) {
      const p = this._take();
      p.mesh.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));
      p.mesh.material.color.setHex(0x62d8ff);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
      p.baseScale = 0.6 + Math.random() * 0.5;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
      p.life = p.max = duration || 0.5;
      p.vel.set((Math.random() - 0.5) * 1.5, 1.0 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5);
      p.grav = -1.2;
    }
  },

  /* ---------- PERK PURCHASE FLASH ---------- */
  perkFlash(pos) {
    if (!this.scene || !pos) return;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p = this._take();
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(0x4ff0e0);
      p.mesh.material.blending = THREE.AdditiveBlending;
      p.mesh.material.opacity = 1;
      p.baseScale = 0.8;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
      p.life = p.max = 0.4;
      p.vel.set(Math.cos(a) * 3.2, 1.4, Math.sin(a) * 3.2);
      p.grav = 4;
    }
  },

  /* ---------- POWER-UP ICON GLOW ---------- */
  powerupGlow(pos) {
    if (!this.scene || !pos) return;
    const p = this._take();
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(0xffe066);
    p.mesh.material.blending = THREE.AdditiveBlending;
    p.mesh.material.opacity = 1;
    p.baseScale = 1.4;
    p.mesh.scale.setScalar(p.baseScale);
    p.mesh.visible = true;
    p.life = p.max = 0.3;
    p.vel.set(0, 1.5, 0); p.grav = -2;
  },

  /* ---------- PER-FRAME UPDATE ---------- */
  update(dt) {
    if (!this.scene) return;
    const cam = this.scene.userData.mainCamera;
    for (const p of this._pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.z += p.spin * dt;
      p.mesh.material.opacity = Math.min(1, Math.max(0, p.life / p.max));
      p.mesh.scale.setScalar(p.baseScale * Math.min(1, p.life / p.max + 0.2));
      if (cam) p.mesh.lookAt(cam.position);
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.material.blending = THREE.AdditiveBlending;
        p.mesh.material.needsUpdate = true;
      }
    }
    // decay the screen flash
    if (this._flash.t > 0 && this._flashEl) {
      this._flash.t = Math.max(0, this._flash.t - dt);
      const k = this._flash.dur > 0 ? this._flash.t / this._flash.dur : 0;
      this._flashEl.style.opacity = (k * this._flash.max).toFixed(3);
    } else if (this._flashEl && this._flashEl.style.opacity !== '0') {
      this._flashEl.style.opacity = '0';
    }
  },

  /* Hide every live particle and reset the flash (quit / restart). */
  clear() {
    for (const p of this._pool) { p.life = 0; p.mesh.visible = false; }
    this._flash.t = 0;
    if (this._flashEl) this._flashEl.style.opacity = '0';
  }
};
