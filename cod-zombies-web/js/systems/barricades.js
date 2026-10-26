/* =========================================================
   systems/barricades.js — per-window board stacks (0..6).
   Boards are plain meshes parented to the map's named window
   anchors; zombies tear them, the player repairs them.
   ========================================================= */

const BarricadeSystem = {
  windows:{},
  scene:null,
  _geo:null,
  _mat:null,

  /* Build/reset all board stacks from the Kino data definition. */
  init(scene) {
    this.clear();
    this.scene = scene;
    if (typeof KinoMapDefinition === 'undefined' || typeof KinoMapRuntime === 'undefined') return;
    if (!this._geo) {
      this._geo = new THREE.BoxGeometry(0.85, 0.18, 0.1);
      this._mat = new THREE.MeshStandardMaterial({
        map: (typeof MAP_TEX !== 'undefined' && MAP_TEX.woodDoor) || null,
        color:0x7a5638, roughness:0.95, metalness:0.02
      });
    }
    for (const w of KinoMapDefinition.windows) {
      const anchor = KinoMapRuntime.windowAnchors[w.id];
      if (!anchor) continue;
      const max = w.boards || 6;
      const group = new THREE.Group();
      const meshes = [];
      for (let i = 0; i < max; i++) {
        const m = new THREE.Mesh(this._geo, this._mat);
        // three pairs of side planks: all six stay inside the opening and
        // leave a central eye-height slot for spotting/shooting the zombie
        const layer = Math.floor(i / 2);
        const side = (i % 2) ? 1 : -1;
        const y = 1.32 + layer * 0.37;
        m.position.set(side * 0.675 + (Math.random()-0.5) * 0.08, y, 0.08);
        m.rotation.z = (Math.random()-0.5) * 0.035;
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
        meshes.push(m);
      }
      anchor.add(group);
      this.windows[w.id] = {
        id:w.id, max, boards:max, meshes, group,
        tearRate:w.tearRate || 1.15, def:w
      };
    }
  },

  /* Current board count for a window (0 when unknown). */
  boards(id) {
    const w = this.windows[id];
    return w ? w.boards : 0;
  },

  /* True once a window has no boards left. */
  isOpen(id) {
    const w = this.windows[id];
    return !!w && w.boards <= 0;
  },

  /* Zombie tears one board from the top; returns the new count. */
  tear(id) {
    const w = this.windows[id];
    if (!w || w.boards <= 0) return 0;
    w.boards--;
    const mesh = w.meshes[w.boards];
    if (mesh) mesh.visible = false;
    if (typeof AudioFX !== 'undefined' && AudioFX.blip)
      AudioFX.blip(150, 0.16, 'sawtooth', 0.09);
    return w.boards;
  },

  /* Player nails one board back; returns the new count. */
  repair(id) {
    const w = this.windows[id];
    if (!w || w.boards >= w.max) return w ? w.boards : 0;
    const mesh = w.meshes[w.boards];
    if (mesh) mesh.visible = true;
    w.boards++;
    if (typeof AudioFX !== 'undefined' && AudioFX.blip)
      AudioFX.blip(520, 0.06, 'square', 0.08);
    return w.boards;
  },

  /* Nearest repairable window to a world point, or null. */
  nearestRepairable(pos, maxDist) {
    let best = null, bd = maxDist || 4;
    for (const id in this.windows) {
      const w = this.windows[id];
      if (!w.def || w.boards >= w.max) continue;
      const d = Math.hypot(pos.x - w.def.inside.x, pos.z - w.def.inside.z);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  },

  /* Per-frame hook kept for future board animation/parity. */
  update(dt) {},

  /* Unparent every board group and forget state. */
  clear() {
    for (const id in this.windows) {
      const w = this.windows[id];
      if (w.group && w.group.parent) w.group.parent.remove(w.group);
    }
    this.windows = {};
    /* geometry can be disposed with the old map — rebuild on next init */
    if (this._geo) { this._geo.dispose(); this._geo = null; }
    if (this._mat) { this._mat.dispose(); this._mat = null; }
  }
};
