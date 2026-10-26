/* =========================================================
   visuals/placeholder-guns.js — low-poly placeholder weapon
   meshes for the Zombies mode: rifle, SMG, shotgun. Built from
   BoxGeometry / CylinderGeometry only. Every model names its
   barrel / mag / stock child meshes so muzzle attachment points
   and reload animation hooks can find them by name.
   ========================================================= */

const PlaceholderGuns = {
  _mat:null,

  _mats() {
    if (this._mat) return this._mat;
    this._mat = {
      body:  new THREE.MeshStandardMaterial({ color:0x2b2f33, metalness:0.55, roughness:0.55 }),
      dark:  new THREE.MeshStandardMaterial({ color:0x14161a, metalness:0.45, roughness:0.65 }),
      metal: new THREE.MeshStandardMaterial({ color:0x53595e, metalness:0.85, roughness:0.35 }),
      wood:  new THREE.MeshStandardMaterial({ color:0x4a3320, metalness:0.05, roughness:0.9 }),
      accent:new THREE.MeshStandardMaterial({ color:0x8a6a30, metalness:0.7, roughness:0.4 })
    };
    return this._mat;
  },

  /* Shared primitive helpers. Each returns a named mesh so callers can
     traverse the model and find "barrel", "mag", "stock", etc. */
  _box(name, w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this._root).add(m);
    return m;
  },
  _cyl(name, rt, rb, h, mat, x, y, z, parent, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = true;
    (parent || this._root).add(m);
    return m;
  },

  /* Build a placeholder weapon by id ('rifle' | 'smg' | 'shotgun').
     Returns a THREE.Group whose userData records muzzle position and the
     named parts. The gun points down -Z (muzzle at negative Z) so it can be
     parented straight under the camera like the real viewmodels. */
  build(kind) {
    const M = this._mats();
    const g = new THREE.Group();
    g.name = 'placeholder-gun-' + kind;
    const parts = {};

    const add = (name, mesh) => { parts[name] = mesh; g.add(mesh); return mesh; };

    if (kind === 'smg') {
      // compact receiver
      const rec = this._box('receiver', 0.07, 0.09, 0.30, M.body, 0, 0, -0.05, g);
      add('receiver', rec);
      // barrel (named) — short cylinder poking out the front
      const bar = this._cyl('barrel', 0.014, 0.014, 0.16, M.metal, 0, 0.01, -0.26, g, 8);
      bar.rotation.x = Math.PI / 2;
      add('barrel', bar);
      // mag (named)
      const mag = this._box('mag', 0.05, 0.14, 0.07, M.dark, 0, -0.10, 0.02, g);
      add('mag', mag);
      // stock (named) — folding wire stock
      const stock = this._box('stock', 0.05, 0.05, 0.16, M.dark, 0, -0.01, 0.14, g);
      add('stock', stock);
      // grip + sight rail
      add('grip', this._box('grip', 0.045, 0.11, 0.06, M.dark, 0, -0.08, 0.06, g));
      add('rail', this._box('rail', 0.03, 0.02, 0.20, M.metal, 0, 0.05, -0.06, g));
      g.userData = { muzzle:{ x:0, y:0.01, z:-0.34 }, kind:'smg', parts };
    } else if (kind === 'shotgun') {
      const rec = this._box('receiver', 0.08, 0.10, 0.28, M.body, 0, 0, -0.02, g);
      add('receiver', rec);
      // long barrel (named)
      const bar = this._cyl('barrel', 0.020, 0.020, 0.44, M.metal, 0, 0.02, -0.30, g, 10);
      bar.rotation.x = Math.PI / 2;
      add('barrel', bar);
      // pump / mag tube under barrel (named as mag for the reload hook)
      const pump = this._box('mag', 0.05, 0.05, 0.16, M.wood, 0, -0.03, -0.24, g);
      add('mag', pump);
      // wooden stock (named)
      const stock = this._box('stock', 0.06, 0.10, 0.24, M.wood, 0, -0.02, 0.18, g);
      add('stock', stock);
      add('grip', this._box('grip', 0.05, 0.09, 0.05, M.wood, 0, -0.07, 0.05, g));
      g.userData = { muzzle:{ x:0, y:0.02, z:-0.52 }, kind:'shotgun', parts };
    } else {
      // 'rifle' default — assault rifle profile
      const rec = this._box('receiver', 0.07, 0.09, 0.34, M.body, 0, 0, -0.05, g);
      add('receiver', rec);
      const bar = this._cyl('barrel', 0.013, 0.013, 0.34, M.metal, 0, 0.012, -0.32, g, 8);
      bar.rotation.x = Math.PI / 2;
      add('barrel', bar);
      // handguard around the barrel
      add('handguard', this._box('handguard', 0.06, 0.06, 0.22, M.dark, 0, 0.005, -0.22, g));
      // mag (named) — angled STANAG-style
      const mag = this._box('mag', 0.045, 0.15, 0.07, M.dark, 0, -0.10, -0.02, g);
      mag.rotation.x = -0.18;
      add('mag', mag);
      // stock (named)
      add('stock', this._box('stock', 0.055, 0.075, 0.20, M.dark, 0, -0.005, 0.17, g));
      add('grip', this._box('grip', 0.045, 0.11, 0.06, M.dark, 0, -0.08, 0.06, g));
      add('rail', this._box('rail', 0.03, 0.02, 0.24, M.metal, 0, 0.05, -0.08, g));
      add('sight', this._box('sight', 0.02, 0.03, 0.04, M.accent, 0, 0.065, 0.02, g));
      g.userData = { muzzle:{ x:0, y:0.012, z:-0.49 }, kind:'rifle', parts };
    }

    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return g;
  },

  /* Fetch a named part from a built gun (null when missing). */
  part(gun, name) {
    if (!gun) return null;
    return gun.getObjectByName(name) || (gun.userData && gun.userData.parts && gun.userData.parts[name]) || null;
  },

  /* World-space muzzle position of a built gun (for VFXManager.muzzleFlash). */
  muzzleWorld(gun, out) {
    out = out || new THREE.Vector3();
    if (!gun) return out.set(0, 0, 0);
    const u = gun.userData && gun.userData.muzzle;
    if (!u) return out.set(0, 0, 0);
    out.set(u.x, u.y, u.z);
    gun.localToWorld(out);
    return out;
  },

  /* Apply a camo id to the whole gun via visuals/camo.js (no-op without it). */
  applyCamo(gun, camoId) {
    if (!gun || typeof applyCamo !== 'function') return gun;
    gun.traverse(o => { if (o.isMesh) applyCamo(o.material, camoId); });
    return gun;
  }
};
