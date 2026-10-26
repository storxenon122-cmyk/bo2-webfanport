/* =========================================================
   maps/kino-der-toten.js — data-only definition of the
   vertical slice + a builder that turns it into MapData
   colliders, spawns, named interaction anchors and props.
   Starting room (foyer) + adjacent room (theater), two
   barricaded windows, one buyable door, perk machine,
   mystery box and Pack-a-Punch anchor.
   ========================================================= */

/* Every position below is world space (feet / anchor points). */
const KinoMapDefinition = {
  id: 'kino_der_toten',
  name: 'KINO DER TOTEN',
  subtitle: 'THEATER OF THE DEAD',

  bounds: { minX:-16, maxX:16, minZ:-32, maxZ:12 },

  rooms: [
    { id:'foyer',   name:'FOYER',   cx:0, cz:0,   w:22, d:20, h:5.2 },
    { id:'theater', name:'THEATER', cx:0, cz:-20, w:24, d:20, h:7.0 }
  ],

  player: { pos:{ x:0, y:0.4, z:4 }, yaw:0 },

  door: {
    id:'door_theater',
    label:'THEATER DOOR',
    cost:750,
    x:0, z:-10, w:3.0, h:2.8, d:0.28,
    anchor:{ x:0, y:1.5, z:-9.55 }
  },

  windows: [
    {
      id:'win_west', name:'WEST WINDOW', wall:'w',
      anchor:{ x:-10.72, y:0, z:2 },
      spawn:{ x:-14.2, y:0.3, z:2 },
      approach:{ x:-12.35, y:0.3, z:2 },
      inside:{ x:-8.4, y:0.3, z:2 },
      boards:6, tearRate:1.15
    },
    {
      id:'win_east', name:'EAST WINDOW', wall:'e',
      anchor:{ x:10.72, y:0, z:2 },
      spawn:{ x:14.2, y:0.3, z:2 },
      approach:{ x:12.35, y:0.3, z:2 },
      inside:{ x:8.4, y:0.3, z:2 },
      boards:6, tearRate:1.15
    }
  ],

  perk: {
    id:'ironhide', name:'IRON HIDE', cost:500,
    desc:'+50 MAX HEALTH',
    x:7.4, z:-26.4,
    anchor:{ x:7.4, y:1.4, z:-25.85 }
  },

  mysteryBox: {
    id:'mystery_box', label:'MYSTERY BOX', cost:950,
    x:-7.4, z:-26.4,
    anchor:{ x:-7.4, y:1.3, z:-25.85 },
    pool:['smg','ar','shotgun','lmg','marksman','smg3']
  },

  packAPunch: {
    id:'pack_a_punch', label:'UPGRADE STATION', cost:5000,
    x:0, z:-29.0, available:false,
    anchor:{ x:0, y:1.5, z:-28.4 }
  },

  economy: {
    starting:500,
    awards:{ hit:10, kill:60, headshotKill:100, boardRepair:10 }
  }
};

/* =========================================================
   Runtime map builder (consumes the data above; no gameplay
   logic lives here beyond removing the door collider).
   ========================================================= */
const KinoMapRuntime = {
  anchors:{},
  windowAnchors:{},
  doorOpen:false,
  doorMesh:null,
  doorCollider:null,

  /* Build the Kino slice into MapData and return the world group. */
  build(scene) {
    MapData.reset();
    const D = KinoMapDefinition;
    const g = new THREE.Group();
    MapData.worldGroup = g;
    scene.add(g);

    this.anchors = {};
    this.windowAnchors = {};
    this.doorOpen = false;
    this.doorMesh = null;
    this.doorCollider = null;

    /* ---------- materials ---------- */
    const M = {
      wall:    new THREE.MeshStandardMaterial({ map:MAP_TEX.brickRed, color:0x6a4c42, roughness:0.95, metalness:0.04 }),
      wallIn:  new THREE.MeshStandardMaterial({ map:MAP_TEX.stucco, color:0x7c6a56, roughness:0.92, metalness:0.03 }),
      floor:   new THREE.MeshStandardMaterial({ map:MAP_TEX.tilePlaza, color:0x6b6258, roughness:0.86, metalness:0.06 }),
      floor2:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x5a4636, roughness:0.94, metalness:0.02 }),
      ceiling: new THREE.MeshStandardMaterial({ map:MAP_TEX.concretePanel, color:0x6e5f4e, roughness:0.95, metalness:0.02,
        emissive:0x201812, emissiveIntensity:0.45 }),
      trim:    new THREE.MeshStandardMaterial({ color:0x2a2320, roughness:0.8, metalness:0.25 }),
      stage:   new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x4d3326, roughness:0.92, metalness:0.03 }),
      curtain: new THREE.MeshStandardMaterial({ color:0x5e1714, roughness:0.95, metalness:0.0 }),
      rug:     new THREE.MeshStandardMaterial({ color:0x220b0a, roughness:0.98, metalness:0.0 }),
      wood:    new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x5b3f2a, roughness:0.95 }),
      metal:   new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x4c5257, roughness:0.45, metalness:0.75 }),
      glass:   new THREE.MeshStandardMaterial({ color:0x0a1016, roughness:0.15, metalness:0.7 }),
      seat:    new THREE.MeshStandardMaterial({ color:0x3a2020, roughness:0.95 }),
      lamp:    new THREE.MeshStandardMaterial({ color:0xffe0a8, emissive:0xffa040, emissiveIntensity:2.0 }),
      barrel:  new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x5a4a40, roughness:0.8, metalness:0.35 }),
      machine: new THREE.MeshStandardMaterial({ color:0x24343a, roughness:0.42, metalness:0.62 }),
      boxWood: new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x6a4a2e, roughness:0.9 }),
      pap:     new THREE.MeshStandardMaterial({ color:0x2c3a44, roughness:0.35, metalness:0.8 })
    };
    MapData.M = M;

    const add = (x,y,z,w,h,d,mat,opts) => MapData.addBox(g,x,y,z,w,h,d,mat,opts);
    const deco = (x,y,z,w,h,d,mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      m.position.set(x,y,z); m.castShadow = false; m.receiveShadow = true;
      g.add(m); return m;
    };
    /* Turn the bare bulb from MapData.addLamp into a hanging/pedestal fixture. */
    const lampFixture = (x,y,z,ceilY,pedestal) => {
      if (pedestal) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, y, 6), M.metal);
        post.position.set(x, y / 2, z); post.castShadow = false; g.add(post);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 10), M.metal);
        base.position.set(x, 0.03, z); base.receiveShadow = true; g.add(base);
      } else {
        const chainH = Math.max(0.08, ceilY - y);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, chainH, 6), M.metal);
        chain.position.set(x, y + chainH / 2, z); chain.castShadow = false; g.add(chain);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 14), M.metal);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y + 0.02, z);
      ring.castShadow = false; g.add(ring);
    };

    /* ---------- exterior ground + floors ---------- */
    add(0, -1.0, -10, 40, 2.0, 48, M.wallIn, { cast:false });            // walkable base
    deco(0, 0.02, 0, 22, 0.04, 20, M.floor);                              // foyer tiles
    deco(0, 0.02, -20, 24, 0.04, 20, M.floor2);                           // theater boards

    /* ---------- foyer shell ---------- */
    const FH = D.rooms[0].h;
    add(0, FH/2, 10, 22, FH, 0.5, M.wall);                                // north

    /* east/west walls are split around the two window openings
       (opening z 0.9..3.1; sill 1.15 m — too high to step or jump out,
       but tall enough to see and shoot a zombie standing outside) */
    const winSegs = [
      { z:-4.55, d:10.9 },   // -10 .. 0.9
      { z: 6.55, d:6.9 }     // 3.1 .. 10
    ];
    for (const s of winSegs) {
      add(-11, FH/2, s.z, 0.5, FH, s.d, M.wall);
      add( 11, FH/2, s.z, 0.5, FH, s.d, M.wall);
    }
    add(-11, 0.575, 2, 0.5, 1.15, 2.2, M.wall);                            // west sill
    add( 11, 0.575, 2, 0.5, 1.15, 2.2, M.wall);                            // east sill
    add(-11, 3.875, 2, 0.5, 2.65, 2.2, M.wall);                            // west lintel
    add( 11, 3.875, 2, 0.5, 2.65, 2.2, M.wall);                            // east lintel
    add(0, FH + 0.15, 0, 22.4, 0.3, 20.4, M.ceiling, { cast:false });      // ceiling

    /* shared wall at z=-10 with a 3 m door gap (opening 2.8 m high) */
    const SHH = D.rooms[1].h;
    add(-6.75, SHH/2, -10, 10.5, SHH, 0.5, M.wall);
    add(6.75, SHH/2, -10, 10.5, SHH, 0.5, M.wall);
    add(0, 4.0, -10, 3.0, 2.4, 0.5, M.wall);                              // lintel
    add(0, 0.14, -10, 3.0, 0.28, 0.56, M.trim, { cast:false });            // threshold

    /* ---------- theater shell ---------- */
    add(0, SHH/2, -30, 24, SHH, 0.5, M.wall);                             // south
    add(-12, SHH/2, -20, 0.5, SHH, 20, M.wall);                            // west
    add(12, SHH/2, -20, 0.5, SHH, 20, M.wall);                             // east
    add(0, SHH + 0.15, -20, 24.4, 0.3, 20.4, M.ceiling, { cast:false });   // ceiling

    /* ---------- interior trim + ceiling beams (hide the bare box look) ---------- */
    const trimRun = (x, y, z, w, d) => deco(x, y, z, w, 0.14, d, M.trim);
    // foyer: baseboard + chair rail + crown, split around the theater door
    deco(0, 0.16, 9.72, 21.7, 0.32, 0.06, M.trim);
    deco(0, 1.26, 9.72, 21.7, 0.12, 0.06, M.trim);
    deco(0, FH - 0.24, 9.72, 21.7, 0.16, 0.06, M.trim);
    deco(-6.65, 0.16, -9.72, 10.2, 0.32, 0.06, M.trim);
    deco( 6.65, 0.16, -9.72, 10.2, 0.32, 0.06, M.trim);
    deco(-6.65, 1.26, -9.72, 10.2, 0.12, 0.06, M.trim);
    deco( 6.65, 1.26, -9.72, 10.2, 0.12, 0.06, M.trim);
    deco(0, FH - 0.24, -9.72, 21.7, 0.16, 0.06, M.trim);
    deco(-10.72, 0.16, 0, 0.06, 0.32, 19.7, M.trim);
    deco( 10.72, 0.16, 0, 0.06, 0.32, 19.7, M.trim);
    // split the chair rail around the window holes so it cannot read as a bar
    for (const x of [-10.72, 10.72]) {
      deco(x, 1.26, -4.55, 0.06, 0.12, 10.8, M.trim);
      deco(x, 1.26,  6.55, 0.06, 0.12, 6.8, M.trim);
    }
    for (const z of [-7.4, -2.5, 2.5, 7.4]) trimRun(0, FH - 0.1, z, 21.5, 0.2);
    // theater: trim + three heavy ceiling beams
    deco(0, 0.16, -29.72, 23.7, 0.32, 0.06, M.trim);
    deco(0, 1.26, -29.72, 23.7, 0.12, 0.06, M.trim);
    deco(0, SHH - 0.24, -29.72, 23.7, 0.16, 0.06, M.trim);
    deco(-6.65, 0.16, -10.28, 10.2, 0.32, 0.06, M.trim);
    deco( 6.65, 0.16, -10.28, 10.2, 0.32, 0.06, M.trim);
    deco(-6.65, 1.26, -10.28, 10.2, 0.12, 0.06, M.trim);
    deco( 6.65, 1.26, -10.28, 10.2, 0.12, 0.06, M.trim);
    deco(-11.72, 0.16, -20, 0.06, 0.32, 19.7, M.trim);
    deco( 11.72, 0.16, -20, 0.06, 0.32, 19.7, M.trim);
    deco(-11.72, 1.26, -20, 0.06, 0.12, 19.7, M.trim);
    deco( 11.72, 1.26, -20, 0.06, 0.12, 19.7, M.trim);
    for (const z of [-15.0, -21.0, -27.0]) trimRun(0, SHH - 0.1, z, 23.5, 0.24);

    /* ---------- door (removable collider + mesh) ---------- */
    const doorMesh = add(D.door.x, D.door.h/2, D.door.z,
      D.door.w, D.door.h, D.door.d, M.wood, { cast:true });
    this.doorMesh = doorMesh;
    this.doorCollider = MapData.colliders.find(c => c.mesh === doorMesh) || null;
    deco(0, 1.45, -9.82, 0.12, 0.24, 0.12, M.metal);                      // handle
    deco(0.75, 1.45, -9.82, 1.0, 0.08, 0.1, M.trim);                      // push bar
    const doorAnchor = new THREE.Object3D();
    doorAnchor.position.set(D.door.anchor.x, D.door.anchor.y, D.door.anchor.z);
    g.add(doorAnchor);
    this.anchors[D.door.id] = doorAnchor;

    const doorSign = this.signMesh('THEATER', 'STAGE 1', 0x1a0e0c, 0xe8b060);
    doorSign.position.set(0, 3.42, -9.71);
    doorSign.scale.set(1.5, 0.6, 1);
    g.add(doorSign);

    /* ---------- windows + named barricade anchors ---------- */
    const frameMat = new THREE.MeshStandardMaterial({ color:0x35261c, roughness:0.9, metalness:0.05 });
    for (const w of D.windows) {
      const a = new THREE.Object3D();
      a.position.set(w.anchor.x, w.anchor.y, w.anchor.z);
      a.rotation.y = w.wall === 'w' ? Math.PI/2 : -Math.PI/2;
      g.add(a);
      this.windowAnchors[w.id] = a;
      this.anchors['window:' + w.id] = a;

      /* separate eye-height anchor used by the repair interaction */
      const repairAnchor = new THREE.Object3D();
      repairAnchor.position.set(w.inside.x, 1.35, w.inside.z);
      g.add(repairAnchor);
      this.anchors['repair:' + w.id] = repairAnchor;

      const put = (bw,bh,bd,lx,ly,lz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd), frameMat);
        m.position.set(lx,ly,lz); m.castShadow = true; m.receiveShadow = true;
        a.add(m); return m;
      };
      put(0.18, 2.5, 0.22, -1.22, 1.35, 0);
      put(0.18, 2.5, 0.22,  1.22, 1.35, 0);
      put(2.62, 0.18, 0.22, 0, 2.62, 0);
      put(2.62, 0.22, 0.34, 0, 0.32, 0.02);                                // sill

      /* opening stays see-through: the wall itself has a real hole and a
         1.15 m sill, so zombies outside are visible and shootable */
      put(0.14, 2.5, 0.3, -1.28, 1.35, -0.14);
      put(0.14, 2.5, 0.3,  1.28, 1.35, -0.14);
      put(2.75, 0.14, 0.3, 0, 2.58, -0.14);

      MapData.spawns.push(new THREE.Vector3(w.spawn.x, w.spawn.y, w.spawn.z));
    }

    /* ---------- theater dressing ---------- */
    // stage platform (0.44 m — one step, walkable) + side curtains
    add(0, 0.22, -28.45, 16, 0.44, 3.1, M.stage, { cast:false });
    deco(-8.2, 3.2, -28.6, 1.4, 6.4, 3.2, M.curtain);
    deco(8.2, 3.2, -28.6, 1.4, 6.4, 3.2, M.curtain);
    deco(0, 5.9, -25.4, 17.6, 1.2, 0.35, M.curtain);
    deco(0, 3.45, -29.62, 14.4, 6.1, 0.16, M.curtain);                    // back curtain
    deco(0, 6.38, -29.66, 14.7, 0.22, 0.22, M.trim);                       // curtain rod
    deco(0, 0.54, -29.6, 14.7, 0.16, 0.22, M.trim);                        // stage lip
    deco(0, 0.055, 3.1, 6.2, 0.035, 4.8, M.rug);                           // foyer rug
    deco(0, 0.055, -17.5, 2.4, 0.03, 10.5, M.rug);                         // center aisle

    // non-colliding seat rows (visual only — zombies path straight through)
    for (let row = 0; row < 4; row++) {
      for (let col = -3; col <= 3; col++) {
        const sx = col * 2.2;
        const sz = -15.5 - row * 3.1;
        deco(sx, 0.42, sz, 1.5, 0.72, 0.9, M.seat);
        deco(sx, 1.02, sz + 0.36, 1.5, 0.9, 0.16, M.seat);
      }
    }
    // aisle lights
    MapData.addLamp(g, -9.6, 0.5, -14.0, 0xff7a30, 1.6, 10);
    MapData.addLamp(g,  9.6, 0.5, -14.0, 0xff7a30, 1.6, 10);
    MapData.addLamp(g, -9.6, 0.5, -24.5, 0xff7a30, 1.6, 10);
    MapData.addLamp(g,  9.6, 0.5, -24.5, 0xff7a30, 1.6, 10);
    MapData.addLamp(g,  0,   5.2, 3.5, 0xffb765, 3.2, 22);       // foyer chandelier
    MapData.addLamp(g, -8.0, 4.4, 6.5, 0xffc890, 1.8, 14);
    MapData.addLamp(g,  8.0, 4.4, 6.5, 0xffc890, 1.8, 14);
    MapData.addLamp(g,  0,   5.8, -16.0, 0xffc080, 2.8, 26);     // theater chandeliers
    MapData.addLamp(g,  0,   5.8, -24.0, 0xffc080, 2.8, 26);
    lampFixture(0, 5.2, 3.5, 5.2, false);
    lampFixture(-8.0, 4.4, 6.5, 5.2, false);
    lampFixture(8.0, 4.4, 6.5, 5.2, false);
    lampFixture(0, 5.8, -16.0, 7.0, false);
    lampFixture(0, 5.8, -24.0, 7.0, false);
    for (const z of [-14.0, -24.5]) {
      lampFixture(-9.6, 0.5, z, 7.0, true);
      lampFixture( 9.6, 0.5, z, 7.0, true);
    }
    // cool window spill so the zombie standing outside the boards is readable
    for (const x of [-9.7, 9.7]) {
      const spill = new THREE.PointLight(0xa8c4e8, 1.5, 10, 2);
      spill.position.set(x, 2.65, 2);
      g.add(spill); MapData.lights.push(spill);
    }

    /* ---------- wall posters (procedural, original text) ---------- */
    const poster = (title, sub, x, y, z, ry, sx, sy) => {
      const s = this.signMesh(title, sub, 0x160d0b, 0xd9a05e);
      s.position.set(x, y, z); s.rotation.y = ry; s.scale.set(sx, sy, 1);
      g.add(s);
    };
    poster('KINO', 'TONIGHT', -5.4, 3.35, 9.70, Math.PI, 1.35, 0.68);
    poster('NO EXIT', 'STAGE DOOR', 5.4, 3.35, 9.70, Math.PI, 1.35, 0.68);
    poster('CREW', 'ONLY', -10.71, 2.7, -4.6, Math.PI/2, 1.0, 0.5);
    poster('SILENCE', 'PLEASE', 11.71, 2.7, -4.6, -Math.PI/2, 1.0, 0.5);
    poster('KINO', 'THEATER', 11.71, 3.2, -22.0, -Math.PI/2, 1.2, 0.6);

    /* ---------- perk machine placeholder ---------- */
    const P = D.perk;
    add(P.x, 1.25, P.z, 1.35, 2.5, 0.95, M.machine);
    deco(P.x, 1.85, P.z + 0.50, 1.05, 0.9, 0.06, (() => {
      const m = new THREE.MeshStandardMaterial({ color:0x0a1418, emissive:0x1ad0c8,
        emissiveIntensity:1.4, roughness:0.4, metalness:0.4 });
      return m;
    })());
    deco(P.x, 2.62, P.z, 1.5, 0.18, 1.1, M.trim);
    const perkSign = this.signMesh(P.name, P.desc, 0x0d1a1c, 0x4ff0e0);
    perkSign.position.set(P.x, 2.05, P.z + 0.545);
    perkSign.scale.set(0.85, 0.42, 1);
    g.add(perkSign);
    const perkAnchor = new THREE.Object3D();
    perkAnchor.position.set(P.anchor.x, P.anchor.y, P.anchor.z);
    g.add(perkAnchor);
    this.anchors[P.id] = perkAnchor;

    /* ---------- mystery box placeholder ---------- */
    const B = D.mysteryBox;
    add(B.x, 0.62, B.z, 1.6, 1.05, 1.1, M.boxWood);
    deco(B.x, 1.18, B.z, 1.68, 0.14, 1.18, M.trim);
    const boxSign = this.signMesh('?', 'SUPPLY', 0x071016, 0x62d8ff);
    boxSign.position.set(B.x, 0.68, B.z + 0.565);
    boxSign.scale.set(0.9, 0.9, 1);
    g.add(boxSign);
    const boxAnchor = new THREE.Object3D();
    boxAnchor.position.set(B.anchor.x, B.anchor.y, B.anchor.z);
    g.add(boxAnchor);
    this.anchors[B.id] = boxAnchor;

    /* ---------- Pack-a-Punch anchor placeholder ---------- */
    const K = D.packAPunch;
    add(K.x, 1.05, K.z, 2.4, 1.6, 1.1, M.pap);
    deco(K.x, 1.9, K.z, 3.0, 0.22, 1.5, M.trim);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 22),
      new THREE.MeshStandardMaterial({ color:0x3a5060, emissive:0x2f8fff,
        emissiveIntensity:1.1, roughness:0.35, metalness:0.7 }));
    ring.position.set(K.x, 1.45, K.z + 0.62);
    g.add(ring);
    const papSign = this.signMesh('UPGRADE', 'OFFLINE', 0x0a1016, 0x7fb4d8);
    papSign.position.set(K.x, 2.35, K.z + 0.62);
    papSign.scale.set(1.25, 0.5, 1);
    g.add(papSign);
    const papAnchor = new THREE.Object3D();
    papAnchor.position.set(K.anchor.x, K.anchor.y, K.anchor.z);
    g.add(papAnchor);
    this.anchors[K.id] = papAnchor;

    /* ---------- walls-side props ---------- */
    deco(-10.2, 0.55, -4.2, 0.9, 1.1, 0.9, M.wood);
    deco(10.2, 0.55, -4.2, 0.9, 1.1, 0.9, M.wood);
    MapData.addBarrels(g, -13.5, -2.0, 3, M.barrel);
    MapData.addBarrels(g, 13.5, -2.0, 3, M.barrel);
    MapData.addBarrels(g, -9.4, -28.0, 2, M.barrel);

    /* ---------- lighting / sky ---------- */
    MapData.addSky(scene, 0x05070b, 0x1a1310, 0x070604);
    this.hemi = new THREE.HemisphereLight(0x33465c, 0x1a1410, 0.35);
    scene.add(this.hemi);
    MapData.hemi = this.hemi;
    this.sun = MapData.addSun(scene, -18, 34, 16, 0xffd8b0, 0.32, 42);
    MapData.sun = this.sun;
    this.amb = new THREE.AmbientLight(0x3a3028, 0.5);
    scene.add(this.amb);
    MapData.amb = this.amb;
    scene.fog = new THREE.FogExp2(0x090b0d, 0.028);
    scene.background = new THREE.Color(0x05070b);

    /* ---------- map metadata ---------- */
    MapData.playerSpawn = new THREE.Vector3(D.player.pos.x, D.player.pos.y, D.player.pos.z);
    MapData.playerYaw = D.player.yaw;
    MapData.minimap = {
      cx:0, cz:-10,
      outline:[[-12,-30],[12,-30],[12,10],[-12,10]]
    };
    MapData.footprints.push({ x:0, z:-28.45, w:16, d:3.1, tall:true }); // stage
    MapData.footprints.push({ x:0, z:-10.0,  w:24, d:0.5, tall:true }); // shared wall

    return g;
  },

  /* Build a small canvas sign mesh (procedural, no asset files). */
  signMesh(title, sub, bg, fg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#' + bg.toString(16).padStart(6, '0');
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#' + fg.toString(16).padStart(6, '0');
    x.lineWidth = 6; x.strokeRect(4, 4, 248, 120);
    x.fillStyle = '#' + fg.toString(16).padStart(6, '0');
    x.font = 'bold 44px Segoe UI, Arial';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(title, 128, 55);
    x.font = 'bold 20px Segoe UI, Arial';
    x.fillText(sub, 128, 96);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    const mat = new THREE.MeshBasicMaterial({ map:tex, transparent:false });
    return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat);
  },

  /* Remove the theater door's collider + hide its mesh. */
  openDoor() {
    if (this.doorOpen) return false;
    this.doorOpen = true;
    if (this.doorCollider) {
      const i = MapData.colliders.indexOf(this.doorCollider);
      if (i >= 0) MapData.colliders.splice(i, 1);
      this.doorCollider = null;
    }
    if (this.doorMesh) this.doorMesh.visible = false;
    return true;
  },

  /* World position of a named anchor (or null when it does not exist). */
  anchorPos(id, out) {
    const a = this.anchors[id];
    if (!a) return null;
    const v = out || new THREE.Vector3();
    a.getWorldPosition(v);
    return v;
  }
};

/* Entry point used by Game.start({ mode:'zombies' }). */
function buildKinoDerToten(scene) {
  return KinoMapRuntime.build(scene);
}
