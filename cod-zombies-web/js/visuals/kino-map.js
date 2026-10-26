/* =========================================================
   visuals/kino-map.js — modular Kino room visual builders.
   Each room builder returns a self-contained THREE.Group built
   entirely from Three.js primitives + CanvasTexture, decorated
   with named anchor Object3Ds so gameplay logic can attach to
   it without parsing geometry. Rooms are registered in a small
   registry so more Kino rooms (lobby lounge, projection booth,
   dressing rooms, alley) can be added later without touching
   the existing ones.

   This module is VISUAL ONLY — it registers no colliders and
   owns no gameplay state. It is intended to be layered over the
   structural shell built by js/maps/kino-der-toten.js, or used
   standalone to prototype a new room.

   Named anchors every room exposes (in group.userData.anchors):
     windowSpawn     — where zombies spawn outside a window
     barricadeBoards — the boarded window frame (array per window)
     doorHinge       — hinge point of the buyable door
     perkAnchor      — front face of the perk machine
     boxAnchor       — top of the Mystery Box
     papAnchor       — mouth of the Pack-a-Punch machine
   ========================================================= */

const KinoMapVisuals = {
  rooms:{},         // id -> builder(opts) => THREE.Group
  _tex:{},          // cached procedural textures

  /* ------------------------------------------------------------
     ROOM REGISTRY — add more Kino rooms later without editing
     the builders below. builder(opts) must return a THREE.Group.
     ------------------------------------------------------------ */
  registerRoom(id, builder) { this.rooms[id] = builder; },
  hasRoom(id) { return !!this.rooms[id]; },
  roomIds() { return Object.keys(this.rooms); },

  /* Build a registered room by id. opts: { x, z, ry, h, id } */
  buildRoom(id, opts) {
    const b = this.rooms[id];
    if (!b) { console.warn('KinoMapVisuals: unknown room', id); return null; }
    const g = b(opts || {});
    g.name = 'kino-room-' + id;
    if (opts) {
      g.position.x = opts.x || 0;
      g.position.z = opts.z || 0;
      if (opts.ry) g.rotation.y = opts.ry;
    }
    return g;
  },

  /* Build the default two-room Kino slice (starting room + adjacent). */
  buildDefaultSet() {
    const out = [];
    out.push(this.buildRoom('starting', { x:0, z:0, h:5.2 }));
    out.push(this.buildRoom('adjacent', { x:0, z:-20, h:7.0 }));
    return out;
  },

  /* ------------------------------------------------------------
     SHARED PROCEDURAL TEXTURES (cached, no binary assets)
     ------------------------------------------------------------ */
  _canvasTex(key, draw, w, h) {
    if (this._tex[key]) return this._tex[key];
    const c = document.createElement('canvas');
    c.width = w || 256; c.height = h || 256;
    draw(c.getContext('2d'), c.width, c.height);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    this._tex[key] = t;
    return t;
  },

  texCarpet() {
    return this._canvasTex('carpet', (x, w, h) => {
      x.fillStyle = '#5a0f10'; x.fillRect(0, 0, w, h);
      // woven fibers
      for (let i = 0; i < 4000; i++) {
        const a = 0.04 + Math.random() * 0.10;
        x.fillStyle = 'rgba(20,4,4,' + a.toFixed(3) + ')';
        x.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 2);
      }
      // gold runner border
      x.strokeStyle = 'rgba(210,170,80,0.7)'; x.lineWidth = 6;
      x.strokeRect(10, 10, w - 20, h - 20);
      x.strokeStyle = 'rgba(210,170,80,0.35)'; x.lineWidth = 2;
      x.strokeRect(20, 20, w - 40, h - 40);
    }, 256, 256);
  },

  texWoodWall() {
    return this._canvasTex('woodwall', (x, w, h) => {
      x.fillStyle = '#3a2a1c'; x.fillRect(0, 0, w, h);
      // vertical paneling
      for (let px = 0; px < w; px += 42) {
        const g = x.createLinearGradient(px, 0, px + 42, 0);
        g.addColorStop(0, 'rgba(90,66,40,0.6)');
        g.addColorStop(0.5, 'rgba(50,34,20,0.6)');
        g.addColorStop(1, 'rgba(90,66,40,0.6)');
        x.fillStyle = g; x.fillRect(px, 0, 42, h);
        x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke();
      }
      // grain streaks
      x.strokeStyle = 'rgba(255,230,180,0.06)'; x.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const gx = Math.random() * w;
        x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx + (Math.random() - 0.5) * 6, h); x.stroke();
      }
    }, 256, 256);
  },

  texCurtain() {
    return this._canvasTex('curtain', (x, w, h) => {
      x.fillStyle = '#4a0e10'; x.fillRect(0, 0, w, h);
      // vertical folds
      for (let px = 0; px < w; px += 16) {
        const g = x.createLinearGradient(px, 0, px + 16, 0);
        g.addColorStop(0, 'rgba(120,26,28,0.7)');
        g.addColorStop(0.5, 'rgba(30,6,8,0.7)');
        g.addColorStop(1, 'rgba(120,26,28,0.7)');
        x.fillStyle = g; x.fillRect(px, 0, 16, h);
      }
      // velvet noise
      for (let i = 0; i < 1500; i++) {
        x.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.12).toFixed(3) + ')';
        x.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1);
      }
    }, 256, 256);
  },

  /* Generic marquee / poster sign plate (procedural text). */
  signMesh(title, sub, w, h, bg, fg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg || '#160d0b'; x.fillRect(0, 0, 256, 128);
    // marquee bulbs border
    x.fillStyle = 'rgba(255,210,120,0.9)';
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      x.beginPath(); x.arc(12 + t * 232, 10, 4, 0, 7); x.fill();
      x.beginPath(); x.arc(12 + t * 232, 118, 4, 0, 7); x.fill();
    }
    x.strokeStyle = fg || '#e8b060'; x.lineWidth = 5; x.strokeRect(6, 6, 244, 116);
    x.fillStyle = fg || '#e8b060';
    x.font = 'bold 46px Segoe UI, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(title, 128, 54);
    if (sub) { x.font = 'bold 20px Segoe UI, Arial'; x.fillText(sub, 128, 96); }
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:tex }));
  },

  /* ------------------------------------------------------------
     MATERIAL SET (shared across rooms, cached)
     ------------------------------------------------------------ */
  _mats() {
    if (this._M) return this._M;
    this._M = {
      carpet:  new THREE.MeshStandardMaterial({ map:this.texCarpet(), roughness:0.98, metalness:0.0 }),
      woodWall:new THREE.MeshStandardMaterial({ map:this.texWoodWall(), roughness:0.92, metalness:0.03 }),
      curtain: new THREE.MeshStandardMaterial({ map:this.texCurtain(), roughness:0.95, metalness:0.0, side:THREE.DoubleSide }),
      floorTile:new THREE.MeshStandardMaterial({ color:0x6b6258, roughness:0.86, metalness:0.06 }),
      stageWood:new THREE.MeshStandardMaterial({ color:0x4d3326, roughness:0.92, metalness:0.03 }),
      trim:    new THREE.MeshStandardMaterial({ color:0x2a2320, roughness:0.8, metalness:0.25 }),
      seat:    new THREE.MeshStandardMaterial({ color:0x3a2020, roughness:0.95 }),
      metal:   new THREE.MeshStandardMaterial({ color:0x4c5257, roughness:0.45, metalness:0.75 }),
      lamp:    new THREE.MeshStandardMaterial({ color:0xffe0a8, emissive:0xffa040, emissiveIntensity:2.0 }),
      debris:  new THREE.MeshStandardMaterial({ color:0x5a4a3a, roughness:0.95 }),
      planks:  new THREE.MeshStandardMaterial({ color:0x7a5638, roughness:0.95, metalness:0.02 }),
      doorWood:new THREE.MeshStandardMaterial({ color:0x5b3f2a, roughness:0.92, metalness:0.04 }),
      board:   new THREE.MeshStandardMaterial({ color:0x8a6238, roughness:0.9 })
    };
    return this._M;
  },

  /* Small helpers */
  _box(w, h, d, mat, x, y, z, parent, cast) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast !== false;
    m.receiveShadow = true;
    (parent || this._root).add(m);
    return m;
  },
  _anchor(name, x, y, z, parent) {
    const a = new THREE.Object3D();
    a.name = name;
    a.position.set(x, y, z);
    (parent || this._root).add(a);
    return a;
  },

  /* ------------------------------------------------------------
     STARTING ROOM — theater lobby: red carpet, wooden walls,
     marquee sign, posters, dim ceiling lights, debris.
     ------------------------------------------------------------ */
  _buildStartingRoom(opts) {
    const M = this._mats();
    const g = new THREE.Group();
    const h = (opts && opts.h) || 5.2;
    const W = 22, D = 20;   // room footprint (matches KinoMapDefinition.rooms[0])
    const anchors = {};

    // ---- floor: red carpet runner down the middle ----
    this._box(W, 0.05, D, M.floorTile, 0, 0.03, 0, g, false);         // base tile
    this._box(8, 0.03, D - 1, M.carpet, 0, 0.07, 0, g, false);        // carpet runner

    // ---- walls (wood paneled) ----
    const wallT = 0.4;
    this._box(W, h, wallT, M.woodWall, 0, h / 2, -D / 2, g);          // north
    this._box(W, h, wallT, M.woodWall, 0, h / 2, D / 2, g);           // south
    this._box(wallT, h, D, M.woodWall, -W / 2, h / 2, 0, g);          // west
    this._box(wallT, h, D, M.woodWall, W / 2, h / 2, 0, g);           // east

    // wainscot chair-rail trim on all four walls
    for (const zz of [-D / 2 + 0.22, D / 2 - 0.22]) this._box(W, 0.12, 0.08, M.trim, 0, 1.26, zz, g, false);
    for (const xx of [-W / 2 + 0.22, W / 2 - 0.22]) this._box(0.08, 0.12, D, M.trim, xx, 1.26, 0, g, false);
    // baseboard
    for (const zz of [-D / 2 + 0.22, D / 2 - 0.22]) this._box(W, 0.32, 0.08, M.trim, 0, 0.16, zz, g, false);
    for (const xx of [-W / 2 + 0.22, W / 2 - 0.22]) this._box(0.08, 0.32, D, M.trim, xx, 0.16, 0, g, false);

    // ---- ceiling ----
    this._box(W, 0.3, D, M.woodWall, 0, h + 0.15, 0, g, false);
    // ceiling beams
    for (const z of [-6, -2, 2, 6]) this._box(W, 0.24, 0.3, M.trim, 0, h - 0.1, z, g, false);

    // ---- marquee sign over the theater door (north wall) ----
    const marquee = this.signMesh('KINO', 'TONIGHT ONLY', 4.2, 2.0, '#1a0e0c', '#e8b060');
    marquee.position.set(0, 3.6, -D / 2 + 0.35);
    g.add(marquee);
    // marquee backing box so it reads as a fixture
    this._box(4.6, 2.4, 0.2, M.trim, 0, 3.6, -D / 2 + 0.22, g, false);

    // ---- posters on side walls (original text, no licensed art) ----
    const posters = [
      ['KINO', 'THEATER', -W / 2 + 0.3, 3.0, 4.0, Math.PI / 2],
      ['NO EXIT', 'STAGE DOOR', -W / 2 + 0.3, 3.0, -4.0, Math.PI / 2],
      ['CREW', 'ONLY', W / 2 - 0.3, 3.0, 4.0, -Math.PI / 2],
      ['SILENCE', 'PLEASE', W / 2 - 0.3, 3.0, -4.0, -Math.PI / 2],
      ['TONIGHT', 'LIVE', 0, 3.2, D / 2 - 0.3, Math.PI]
    ];
    for (const [t, s, px, py, pz, ry] of posters) {
      const m = this.signMesh(t, s, 1.6, 0.9, '#160d0b', '#d9a05e');
      m.position.set(px, py, pz); m.rotation.y = ry;
      g.add(m);
    }

    // ---- dim ceiling lights (hanging fixtures with a soft glow) ----
    for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]]) {
      // chain
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), M.metal);
      chain.position.set(lx, h - 0.5, lz); g.add(chain);
      // shade
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 10, 1, true), M.trim);
      shade.position.set(lx, h - 0.95, lz); shade.rotation.x = Math.PI; g.add(shade);
      // glowing bulb
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.lamp);
      bulb.position.set(lx, h - 1.05, lz); g.add(bulb);
      const light = new THREE.PointLight(0xffb765, 1.4, 16, 2);
      light.position.set(lx, h - 1.0, lz); g.add(light);
    }

    // ---- debris scattered on the floor ----
    const debrisSpots = [[-7, 7, 0.3], [8, 5, -0.4], [-4, -7, 0.9], [5, -8, 0.2], [-9, 0, 1.4], [9, -3, -0.8]];
    for (const [dx, dz, ry] of debrisSpots) {
      const d = this._box(0.5 + Math.random() * 0.4, 0.25 + Math.random() * 0.2, 0.5, M.debris, dx, 0.2, dz, g);
      d.rotation.y = ry;
    }
    // a couple of toppled chairs
    for (const [cx, cz, ry] of [[-3, 8, 0.6], [4, 8, -0.9]]) {
      const c = this._box(0.5, 0.6, 0.5, M.seat, cx, 0.3, cz, g);
      c.rotation.set(1.2, ry, 0);
    }

    /* ---------- NAMED ANCHORS ---------- */
    // two barricaded windows on the east/west walls
    anchors.barricadeBoards = [];
    anchors.windowSpawn = [];
    const winDefs = [
      { wall:'w', x:-W / 2 + 0.3, z:2, ry:Math.PI / 2, spawnX:-W / 2 - 3.5 },
      { wall:'e', x:W / 2 - 0.3, z:2, ry:-Math.PI / 2, spawnX:W / 2 + 3.5 }
    ];
    for (const wd of winDefs) {
      // window frame
      const frame = new THREE.Group();
      frame.position.set(wd.x, 0, wd.z); frame.rotation.y = wd.ry;
      this._box(2.4, 0.16, 0.24, M.trim, 0, 0.4, 0, frame);      // sill
      this._box(2.4, 0.16, 0.24, M.trim, 0, 2.6, 0, frame);      // header
      this._box(0.16, 2.4, 0.24, M.trim, -1.2, 1.5, 0, frame);   // left jamb
      this._box(0.16, 2.4, 0.24, M.trim, 1.2, 1.5, 0, frame);    // right jamb
      // boarding planks (visual — BarricadeSystem owns the live count)
      const boards = new THREE.Group();
      boards.name = 'barricadeBoards';
      for (let i = 0; i < 6; i++) {
        const layer = Math.floor(i / 2), side = (i % 2) ? 1 : -1;
        const pl = this._box(0.9, 0.18, 0.1, M.planks, side * 0.62, 0.75 + layer * 0.42, 0.1, boards);
        pl.rotation.z = (Math.random() - 0.5) * 0.05;
      }
      frame.add(boards);
      g.add(frame);
      anchors.barricadeBoards.push(boards);
      // window spawn anchor outside the wall
      const sp = this._anchor('windowSpawn', wd.spawnX, 0.3, wd.z, g);
      anchors.windowSpawn.push(sp);
    }

    // buyable theater door on the north wall + hinge anchor
    const doorGrp = new THREE.Group();
    doorGrp.position.set(0, 0, -D / 2 + 0.3);
    const hinge = this._anchor('doorHinge', -1.5, 0, 0, doorGrp);
    const slab = this._box(3.0, 2.8, 0.16, M.doorWood, 1.5, 1.4, 0, hinge);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), M.metal);
    handle.position.set(2.7, 1.4, 0.14); hinge.add(handle);
    const doorSign = this.signMesh('THEATER', '750 PTS', 2.2, 0.9, '#1a0e0c', '#e8b060');
    doorSign.position.set(0, 3.4, 0.15); doorGrp.add(doorSign);
    g.add(doorGrp);
    anchors.doorHinge = hinge;

    // perk machine anchor (east wall alcove)
    anchors.perkAnchor = this._anchor('perkAnchor', W / 2 - 1.2, 1.4, -6, g);
    // mystery box anchor (west wall)
    anchors.boxAnchor = this._anchor('boxAnchor', -W / 2 + 1.2, 1.1, -6, g);
    // pack-a-punch anchor (north-east corner, powered off)
    anchors.papAnchor = this._anchor('papAnchor', W / 2 - 3, 1.5, -D / 2 + 2, g);

    g.userData = { kind:'room', id:'starting', anchors, footprint:{ w:W, d:D, h } };
    return g;
  },

  /* ------------------------------------------------------------
     ADJACENT ROOM — theater auditorium entrance: stage curtains,
     seats, stage lights.
     ------------------------------------------------------------ */
  _buildAdjacentRoom(opts) {
    const M = this._mats();
    const g = new THREE.Group();
    const h = (opts && opts.h) || 7.0;
    const W = 24, D = 20;   // matches KinoMapDefinition.rooms[1]
    const anchors = {};

    // ---- floor: wooden boards ----
    this._box(W, 0.05, D, M.stageWood, 0, 0.03, 0, g, false);
    // center aisle carpet
    this._box(2.4, 0.03, D - 2, M.carpet, 0, 0.07, 0, g, false);

    // ---- walls ----
    const wallT = 0.4;
    this._box(W, h, wallT, M.woodWall, 0, h / 2, -D / 2, g);          // south (stage end)
    this._box(wallT, h, D, M.woodWall, -W / 2, h / 2, 0, g);          // west
    this._box(wallT, h, D, M.woodWall, W / 2, h / 2, 0, g);           // east
    // north side is open toward the starting room (door gap)

    // ---- ceiling ----
    this._box(W, 0.3, D, M.woodWall, 0, h + 0.15, 0, g, false);
    for (const z of [-5, 0, 5]) this._box(W, 0.3, 0.34, M.trim, 0, h - 0.1, z, g, false);

    // ---- stage platform at the south end ----
    const stageZ = -D / 2 + 3.2;
    this._box(16, 0.5, 4.5, M.stageWood, 0, 0.25, stageZ, g);
    this._box(16.4, 0.16, 0.24, M.trim, 0, 0.55, stageZ + 2.3, g, false);  // stage lip

    // ---- stage curtains (heavy velvet drapes: back wall + side wings + valance) ----
    // back curtain
    const back = this._box(15, 6.2, 0.16, M.curtain, 0, 3.4, stageZ - 2.0, g, false);
    // side wings
    this._box(1.4, 6.4, 3.0, M.curtain, -8.0, 3.3, stageZ - 0.4, g, false);
    this._box(1.4, 6.4, 3.0, M.curtain, 8.0, 3.3, stageZ - 0.4, g, false);
    // valance across the top
    this._box(17.5, 1.2, 0.3, M.curtain, 0, 6.0, stageZ + 0.2, g, false);
    // curtain rod
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 17.5, 8), M.metal);
    rod.rotation.z = Math.PI / 2; rod.position.set(0, 6.5, stageZ + 0.2); g.add(rod);

    // ---- audience seats (rows facing the stage) ----
    for (let row = 0; row < 5; row++) {
      const sz = -2 + row * 2.6;   // seats march away from the stage
      for (let col = -4; col <= 4; col++) {
        const sx = col * 2.2;
        if (Math.abs(col) < 1) continue;   // leave the aisle open
        // seat base
        this._box(1.4, 0.5, 0.9, M.seat, sx, 0.35, sz, g);
        // seat back
        this._box(1.4, 0.85, 0.16, M.seat, sx, 0.85, sz + 0.38, g);
        // armrests
        this._box(0.12, 0.4, 0.8, M.trim, sx - 0.7, 0.5, sz, g, false);
        this._box(0.12, 0.4, 0.8, M.trim, sx + 0.7, 0.5, sz, g, false);
      }
    }

    // ---- stage lights (overhead cans on a truss, aimed at the stage) ----
    const trussZ = stageZ + 4.0;
    const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 18, 8), M.metal);
    truss.rotation.z = Math.PI / 2; truss.position.set(0, h - 1.0, trussZ); g.add(truss);
    for (const lx of [-6, -2, 2, 6]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.4, 10), M.metal);
      can.position.set(lx, h - 1.35, trussZ);
      can.rotation.x = 0.6;   // aim down toward the stage
      g.add(can);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12),
        new THREE.MeshStandardMaterial({ color:0xfff2d0, emissive:0xffdca0, emissiveIntensity:2.2 }));
      lens.position.set(lx, h - 1.5, trussZ + 0.18); lens.rotation.x = -0.9;
      g.add(lens);
      const spot = new THREE.SpotLight(0xffe4b0, 2.0, 30, 0.5, 0.5, 1.5);
      spot.position.set(lx, h - 1.35, trussZ);
      spot.target.position.set(lx * 0.3, 0.5, stageZ);
      g.add(spot); g.add(spot.target);
    }

    // ---- aisle wall sconces ----
    for (const zz of [-4, 2, 8]) {
      for (const xx of [-W / 2 + 0.4, W / 2 - 0.4]) {
        const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), M.lamp);
        sconce.position.set(xx, 2.6, zz); g.add(sconce);
        const gl = new THREE.PointLight(0xff9a40, 1.0, 10, 2);
        gl.position.set(xx, 2.6, zz); g.add(gl);
      }
    }

    /* ---------- NAMED ANCHORS (shared with the starting room) ---------- */
    // this room carries the same anchor kinds so an attached door/perk/box
    // can live here; logic picks whichever room it wired.
    anchors.doorHinge = this._anchor('doorHinge', 0, 0, D / 2 - 0.3, g);   // door back to the lobby
    anchors.perkAnchor = this._anchor('perkAnchor', -W / 2 + 1.2, 1.4, 4, g);
    anchors.boxAnchor = this._anchor('boxAnchor', W / 2 - 1.2, 1.1, 4, g);
    anchors.papAnchor = this._anchor('papAnchor', 0, 1.5, stageZ - 1.0, g); // PaP sits on stage
    anchors.barricadeBoards = [];
    anchors.windowSpawn = [];

    g.userData = { kind:'room', id:'adjacent', anchors, footprint:{ w:W, d:D, h }, stageZ };
    return g;
  }
};

/* Register the two built-in rooms. More rooms can be added with
   KinoMapVisuals.registerRoom('lounge', opts => { ... }) later. */
KinoMapVisuals.registerRoom('starting', o => KinoMapVisuals._buildStartingRoom(o));
KinoMapVisuals.registerRoom('adjacent', o => KinoMapVisuals._buildAdjacentRoom(o));

/* Flat convenience: build the default set and return all named anchors
   merged into one map (later rooms win on name collisions). */
function buildKinoVisualRooms(scene, opts) {
  const rooms = KinoMapVisuals.buildDefaultSet();
  const anchors = {};
  for (const g of rooms) {
    if (!g) continue;
    if (scene) scene.add(g);
    const a = (g.userData && g.userData.anchors) || {};
    for (const k in a) {
      if (Array.isArray(a[k])) {
        if (!anchors[k]) anchors[k] = [];
        anchors[k] = anchors[k].concat(a[k]);
      } else {
        anchors[k] = a[k];
      }
    }
  }
  return { rooms, anchors };
}
