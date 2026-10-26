/* =========================================================
   visuals/interactables.js — procedural Zombies interactable
   models: perk machine, Mystery Box, Pack-a-Punch, buyable door
   and power-up drops. Every builder returns a THREE.Group with
   a named anchor Object3D so interaction logic can attach to it.
   All materials are procedural (colors + canvas emissive faces);
   no logos, no licensed art.
   ========================================================= */

const KinoInteractables = {
  _mats:null,

  _matSet() {
    if (this._mats) return this._mats;
    this._mats = {
      perkRed:   new THREE.MeshStandardMaterial({ color:0x8e1b16, roughness:0.5, metalness:0.35 }),
      perkDark:  new THREE.MeshStandardMaterial({ color:0x241012, roughness:0.6, metalness:0.3 }),
      perkScreen:new THREE.MeshStandardMaterial({ color:0x0a1418, emissive:0x1ad0c8, emissiveIntensity:1.4, roughness:0.4, metalness:0.4 }),
      wood:      new THREE.MeshStandardMaterial({ color:0x6a4a2e, roughness:0.9, metalness:0.05 }),
      woodDark:  new THREE.MeshStandardMaterial({ color:0x3f2a18, roughness:0.92, metalness:0.05 }),
      metal:     new THREE.MeshStandardMaterial({ color:0x37424a, roughness:0.4, metalness:0.8 }),
      metalDark: new THREE.MeshStandardMaterial({ color:0x1c2328, roughness:0.45, metalness:0.75 }),
      glowBlue:  new THREE.MeshStandardMaterial({ color:0x0a1016, emissive:0x2f8fff, emissiveIntensity:1.2, roughness:0.35, metalness:0.6 }),
      glowGold:  new THREE.MeshStandardMaterial({ color:0x1a1408, emissive:0xffc040, emissiveIntensity:1.1, roughness:0.4, metalness:0.5 }),
      doorWood:  new THREE.MeshStandardMaterial({ color:0x5b3f2a, roughness:0.92, metalness:0.04 }),
      signDark:  new THREE.MeshStandardMaterial({ color:0x1a0e0c, roughness:0.7, metalness:0.1 })
    };
    return this._mats;
  },

  /* Small canvas-text label plate (procedural text, no images). */
  _labelMesh(text, sub, w, h, bg, fg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(4, 4, 248, 120);
    x.fillStyle = fg;
    x.font = 'bold 44px Segoe UI, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 52);
    if (sub) { x.font = 'bold 20px Segoe UI, Arial'; x.fillText(sub, 128, 96); }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshBasicMaterial({ map:tex });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  },

  /* ------------------------------------------------------------
     PERK MACHINE — red vending-machine box with a glowing screen
     and a "perkAnchor" Object3D at interaction height.
     ------------------------------------------------------------ */
  buildPerkMachine(def) {
    const M = this._matSet();
    const g = new THREE.Group();
    g.name = 'perk-machine';

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.9), M.perkRed);
    body.position.y = 1.15; body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.2, 1.05), M.perkDark);
    top.position.y = 2.35; top.castShadow = true; g.add(top);

    // glowing front screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.06), M.perkScreen);
    screen.position.set(0, 1.55, 0.47); g.add(screen);

    // base kick-plate
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.25, 0.94), M.perkDark);
    base.position.y = 0.12; g.add(base);

    // label plate above the screen
    const label = this._labelMesh((def && def.name) || 'PERK', (def && def.desc) || '', 0.85, 0.42, '#0d1a1c', '#4ff0e0');
    label.position.set(0, 2.05, 0.5); g.add(label);

    const anchor = new THREE.Object3D();
    anchor.name = 'perkAnchor';
    anchor.position.set(0, 1.4, 0.55);
    g.add(anchor);

    g.userData = { kind:'perk', anchor, screen };
    return g;
  },

  /* ------------------------------------------------------------
     MYSTERY BOX — wooden crate with an animated lid. Exposes a
     spin hook (startSpin/stopSpin) that the interaction logic can
     drive; update(dt) animates the lid bob + sparkle while spinning.
     ------------------------------------------------------------ */
  buildMysteryBox(def) {
    const M = this._matSet();
    const g = new THREE.Group();
    g.name = 'mystery-box';

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.05), M.wood);
    body.position.y = 0.45; body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // corner trim
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.1), M.woodDark);
      post.position.set(sx * 0.72, 0.47, sz * 0.52); post.castShadow = true; g.add(post);
    }

    // lid — hinged at the back edge (z = -0.525) so it flips up
    const lidPivot = new THREE.Object3D();
    lidPivot.position.set(0, 0.9, -0.525);
    g.add(lidPivot);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.12, 1.09), M.woodDark);
    lid.position.set(0, 0.06, 0.525); lid.castShadow = true;
    lidPivot.add(lid);

    // glowing "?" plate on the front
    const plate = this._labelMesh('?', 'SUPPLY', 0.9, 0.9, '#071016', '#62d8ff');
    plate.position.set(0, 0.5, 0.53); g.add(plate);

    const anchor = new THREE.Object3D();
    anchor.name = 'boxAnchor';
    anchor.position.set(0, 1.15, 0.55);
    g.add(anchor);

    const box = {
      group:g, lidPivot, plate,
      spinning:false, spinT:0,
      startSpin() { this.spinning = true; this.spinT = 0; },
      stopSpin()  { this.spinning = false; this.lidPivot.rotation.x = 0; },
      update(dt, vfxFn) {
        if (!this.spinning) return;
        this.spinT += dt;
        // lid flutters open while the "roll" happens
        this.lidPivot.rotation.x = -0.5 - Math.sin(this.spinT * 8) * 0.15;
        if (vfxFn && typeof vfxFn === 'function') vfxFn(this.spinT);
      }
    };
    g.userData = { kind:'box', anchor, box };
    return g;
  },

  /* ------------------------------------------------------------
     PACK-A-PUNCH — metal upgrade machine with a glowing slot.
     ------------------------------------------------------------ */
  buildPackAPunch(def) {
    const M = this._matSet();
    const g = new THREE.Group();
    g.name = 'pack-a-punch';

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.6, 1.0), M.metal);
    body.position.y = 0.8; body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 1.3), M.metalDark);
    cap.position.y = 1.65; cap.castShadow = true; g.add(cap);

    // glowing upgrade slot
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.08), M.glowBlue);
    slot.position.set(0, 0.85, 0.51); g.add(slot);

    // glowing ring around the slot
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 20), M.glowBlue);
    ring.position.set(0, 0.85, 0.55); g.add(ring);

    const label = this._labelMesh('UPGRADE', 'STATION', 1.1, 0.5, '#0a1016', '#7fb4d8');
    label.position.set(0, 1.45, 0.51); g.add(label);

    const anchor = new THREE.Object3D();
    anchor.name = 'papAnchor';
    anchor.position.set(0, 1.1, 0.55);
    g.add(anchor);

    g.userData = { kind:'pap', anchor, slot, ring };
    return g;
  },

  /* ------------------------------------------------------------
     DOOR — wooden door slab with a cost sign and a hinge anchor
     (doorHinge Object3D at the left edge so it can swing open).
     ------------------------------------------------------------ */
  buildDoor(def) {
    const M = this._matSet();
    const g = new THREE.Group();
    g.name = 'kino-door';

    const w = (def && def.w) || 3.0;
    const h = (def && def.h) || 2.8;

    const hinge = new THREE.Object3D();
    hinge.name = 'doorHinge';
    hinge.position.set(-w / 2, 0, 0);
    g.add(hinge);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), M.doorWood);
    slab.position.set(w / 2, h / 2, 0); slab.castShadow = true; slab.receiveShadow = true;
    hinge.add(slab);

    // handle
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), M.metalDark);
    handle.position.set(w - 0.2, h * 0.5, 0.14); hinge.add(handle);

    // cost sign above the door
    const cost = (def && def.cost) || 0;
    const sign = this._labelMesh((def && def.label) || 'DOOR', cost ? cost + ' PTS' : 'FREE', 1.4, 0.55, '#1a0e0c', '#e8b060');
    sign.position.set(0, h + 0.4, 0.12); g.add(sign);

    const anchor = new THREE.Object3D();
    anchor.name = 'doorAnchor';
    anchor.position.set(0, 1.5, 0.2);
    g.add(anchor);

    const door = {
      group:g, hinge, slab, sign, open:false, openT:0,
      open() { this.open = true; },
      update(dt) {
        if (!this.open) return;
        this.openT = Math.min(1, this.openT + dt * 1.5);
        this.hinge.rotation.y = -this.openT * Math.PI * 0.5;
      }
    };
    g.userData = { kind:'door', anchor, hinge, door };
    return g;
  },

  /* ------------------------------------------------------------
     POWER-UP DROPS — Max Ammo, Insta-Kill, Nuke. Simple glowing
     octahedron with a colored emissive core + a canvas icon plate.
     ------------------------------------------------------------ */
  buildPowerup(type) {
    const g = new THREE.Group();
    g.name = 'powerup-' + type;
    let color = 0xffe066, label = 'POWER-UP', icon = 'P';
    if (type === 'maxammo')    { color = 0x62d8ff; label = 'MAX AMMO';   icon = 'MA'; }
    else if (type === 'instakill') { color = 0xff5a3c; label = 'INSTA-KILL'; icon = 'IK'; }
    else if (type === 'nuke')  { color = 0xffe066; label = 'NUKE';       icon = 'N'; }

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3, 0),
      new THREE.MeshStandardMaterial({ color:0x0a0a0a, emissive:color, emissiveIntensity:1.6, roughness:0.4, metalness:0.4 })
    );
    g.add(core);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 8),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending, depthWrite:false })
    );
    g.add(halo);

    const plate = this._labelMesh(icon, label, 0.9, 0.45, '#0a0a0a', '#' + color.toString(16).padStart(6, '0'));
    plate.position.set(0, 0.6, 0); g.add(plate);

    const anchor = new THREE.Object3D();
    anchor.name = 'windowSpawn';      // reuse the anchor name for pickup logic
    anchor.position.set(0, 0, 0);
    g.add(anchor);

    g.userData = { kind:'powerup', type, core, halo, plate, anchor };
    return g;
  },

  /* Convenience: build a powerup by id and place it in the scene with a
     gentle bob/spin driven by update(dt, group). */
  spawnPowerup(scene, type, pos) {
    const g = this.buildPowerup(type);
    if (pos) g.position.copy(pos);
    scene.add(g);
    g.userData._t = Math.random() * 6;
    return g;
  }
};

/* Animate any interactable group that exposes userData.box / userData.door
   or a powerup group built above. Safe no-op for unknown groups. */
function updateKinoInteractable(group, dt, vfxFn) {
  if (!group || !group.userData) return;
  const ud = group.userData;
  if (ud.box) ud.box.update(dt, vfxFn);
  if (ud.door) ud.door.update(dt);
  if (ud.kind === 'powerup') {
    ud._t = (ud._t || 0) + dt;
    group.rotation.y += dt * 2.0;
    group.position.y = (group.userData._baseY != null ? group.userData._baseY : group.position.y) +
                       Math.sin(ud._t * 3) * 0.1;
  }
}
