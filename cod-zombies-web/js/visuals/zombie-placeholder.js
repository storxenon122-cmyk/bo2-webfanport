/* =========================================================
   visuals/zombie-placeholder.js — low-poly humanoid zombie
   model + procedural animation, built from boxes and capsules
   (no rigging). Named limbs let logic or a future skinned rig
   hook in. animate() maps the ZombieAI states (SPAWNING,
   BREACHING_BARRICADE, CHASING, ATTACKING, DYING, DESPAWN) to
   shamble / lunge / attack / death poses. Works standalone or
   as a drop-in visual for js/ai/zombie.js.
   ========================================================= */

const ZombiePlaceholder = {
  _geo:null, _mat:null,

  _assets() {
    if (this._geo) return;
    this._geo = {
      torso: new THREE.BoxGeometry(0.52, 0.68, 0.28),
      head:  new THREE.BoxGeometry(0.25, 0.28, 0.25),
      jaw:   new THREE.BoxGeometry(0.18, 0.09, 0.20),
      arm:   new THREE.CapsuleGeometry(0.06, 0.44, 4, 8),
      leg:   new THREE.BoxGeometry(0.16, 0.58, 0.18),
      boot:  new THREE.BoxGeometry(0.18, 0.14, 0.24),
      eye:   new THREE.SphereGeometry(0.035, 6, 5),
      rag:   new THREE.BoxGeometry(0.56, 0.16, 0.3)
    };
    this._mat = {
      coat:  new THREE.MeshStandardMaterial({ color:0x3d3a2a, roughness:0.96, metalness:0.02 }),
      skin:  new THREE.MeshStandardMaterial({ color:0x9c8e76, roughness:0.92, metalness:0.0 }),
      pants: new THREE.MeshStandardMaterial({ color:0x2b2b25, roughness:0.97, metalness:0.0 }),
      boot:  new THREE.MeshStandardMaterial({ color:0x17181a, roughness:0.95, metalness:0.05 }),
      blood: new THREE.MeshStandardMaterial({ color:0x53110d, roughness:0.9, metalness:0.0 }),
      eye:   new THREE.MeshStandardMaterial({ color:0xff5533, emissive:0xff2200, emissiveIntensity:2.4, roughness:0.4 })
    };
  },

  /* Build a fresh zombie model. Returns a group whose userData records all
     named limbs so animation and logic can find them by name. */
  build(opts) {
    this._assets();
    opts = opts || {};
    const g = new THREE.Group();
    g.name = 'zombie-placeholder';

    // per-instance coat material so hit-flash emissive is isolated
    const coat = this._mat.coat.clone();

    const put = (geo, mat, x, y, z, name) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      if (name) m.name = name;
      g.add(m);
      return m;
    };

    // legs (pivot groups at the hip so they swing)
    const legL = new THREE.Group(); legL.position.set(-0.13, 0.76, 0); legL.name = 'legL';
    const legR = new THREE.Group(); legR.position.set(0.13, 0.76, 0);  legR.name = 'legR';
    const ll = new THREE.Mesh(this._geo.leg, this._mat.pants); ll.position.y = -0.29;
    const lr = new THREE.Mesh(this._geo.leg, this._mat.pants); lr.position.y = -0.29;
    const bl = new THREE.Mesh(this._geo.boot, this._mat.boot); bl.position.y = -0.64;
    const br = new THREE.Mesh(this._geo.boot, this._mat.boot); br.position.y = -0.64;
    ll.castShadow = lr.castShadow = bl.castShadow = br.castShadow = true;
    legL.add(ll, bl); legR.add(lr, br);
    g.add(legL, legR);

    const torso = put(this._geo.torso, coat, 0, 1.08, 0, 'torso');
    put(this._geo.rag, coat, 0, 0.79, 0, 'waistRag');
    const stain = put(this._geo.rag, this._mat.blood, 0, 1.16, -0.15, 'bloodStain');
    stain.scale.set(0.75, 0.55, 0.12); stain.castShadow = false;

    const head = put(this._geo.head, this._mat.skin, 0, 1.58, 0, 'head');
    put(this._geo.jaw, this._mat.blood, 0, 1.44, -0.1, 'jaw');
    const eyeL = new THREE.Mesh(this._geo.eye, this._mat.eye); eyeL.position.set(-0.06, 1.62, -0.125);
    const eyeR = new THREE.Mesh(this._geo.eye, this._mat.eye); eyeR.position.set(0.06, 1.62, -0.125);
    eyeL.name = 'eyeL'; eyeR.name = 'eyeR';
    g.add(eyeL, eyeR);

    // arms (pivot groups at the shoulder)
    const armL = new THREE.Group(); armL.position.set(-0.34, 1.30, 0); armL.name = 'armL';
    const armR = new THREE.Group(); armR.position.set(0.34, 1.30, 0);  armR.name = 'armR';
    const al = new THREE.Mesh(this._geo.arm, coat); al.position.y = -0.25;
    const ar = new THREE.Mesh(this._geo.arm, coat); ar.position.y = -0.25;
    al.castShadow = ar.castShadow = true;
    armL.add(al); armR.add(ar);
    g.add(armL, armR);

    g.userData = {
      kind:'zombie', coat,
      limbs:{ legL, legR, armL, armR, head, torso },
      t:Math.random() * 6, state:'IDLE'
    };
    if (opts.scale) g.scale.setScalar(opts.scale);
    return g;
  },

  /* Drive the model's pose from a ZombieAI state + a movement speed.
     `group` is a model built above (or a Zombie.group that contains the
     same named limbs). Safe no-op when limbs are missing. */
  animate(group, dt, state, planarSpeed) {
    if (!group || !group.userData) return;
    const L = group.userData.limbs;
    if (!L) return;
    const ud = group.userData;
    ud.state = state;
    const sw = Math.sin(ud.t) * 0.62;

    if (state === 'DYING') {
      // collapse backward — caller sets the group rotation/position for the
      // fall; here we just loosen the limbs so it reads as a ragdoll.
      L.legL.rotation.x = 0.4; L.legR.rotation.x = 0.2;
      L.armL.rotation.x = -0.5; L.armR.rotation.x = -0.6;
      L.head.rotation.z = 0.3;
      return;
    }

    if (state === 'SPAWNING') {
      // rising / staggered idle
      const k = Math.sin(ud.t * 2);
      L.legL.rotation.x = sw * 0.4; L.legR.rotation.x = -sw * 0.4;
      L.armL.rotation.x = -1.0 + k * 0.2; L.armR.rotation.x = -1.0 - k * 0.2;
      L.armL.rotation.z = 0.2; L.armR.rotation.z = -0.2;
      L.head.rotation.z = Math.sin(ud.t * 0.9) * 0.15;
      return;
    }

    if (state === 'BREACHING_BARRICADE') {
      // both arms hammer forward at the boards
      const hit = Math.sin(ud.t * 6);
      L.legL.rotation.x = 0.15; L.legR.rotation.x = -0.15;
      L.armL.rotation.x = -1.7 + hit * 0.4; L.armR.rotation.x = -1.7 + hit * 0.4;
      L.armL.rotation.z = 0.25; L.armR.rotation.z = -0.25;
      L.head.rotation.z = hit * 0.08;
      return;
    }

    if (state === 'ATTACKING') {
      // lunge + claw swipe cycle
      const swipe = Math.sin(ud.t * 9);
      L.legL.rotation.x = 0.25; L.legR.rotation.x = -0.25;
      L.armL.rotation.x = -1.9 + swipe * 0.6; L.armR.rotation.x = -1.9 - swipe * 0.6;
      L.armL.rotation.z = 0.3; L.armR.rotation.z = -0.3;
      L.head.rotation.z = swipe * 0.1;
      return;
    }

    // CHASING (default) — shamble walk, arms out front
    const pace = 2.6 + (planarSpeed || 0) * 1.8;
    ud.t += dt * (pace / 2.6);
    const s2 = Math.sin(ud.t) * 0.62;
    L.legL.rotation.x = s2; L.legR.rotation.x = -s2;
    L.armL.rotation.x = -1.35 + Math.sin(ud.t * 1.7) * 0.28;
    L.armR.rotation.x = -1.35 - Math.sin(ud.t * 1.7) * 0.28;
    L.armL.rotation.z = 0.16; L.armR.rotation.z = -0.16;
    L.head.rotation.z = Math.sin(ud.t * 0.8) * 0.12;
  },

  /* Advance the shared animation clock (call once per frame per model if you
     drive animate() via its own internal timer). */
  tick(group, dt) {
    if (group && group.userData) group.userData.t += dt;
  },

  /* Flash the coat emissive for a damage hit (0..1 intensity). */
  hitFlash(group, k) {
    if (!group || !group.userData || !group.userData.coat) return;
    const c = group.userData.coat;
    if (!c.emissive) c.emissive = new THREE.Color();
    c.emissive.setRGB(k * 0.5, k * 0.05, k * 0.02);
  },

  /* Map a Zombie.ai state string to the placeholder's anim state. */
  stateFor(aiState) {
    switch (aiState) {
      case 'SPAWNING': return 'SPAWNING';
      case 'BREACHING_BARRICADE': return 'BREACHING_BARRICADE';
      case 'CHASING': return 'CHASING';
      case 'ATTACKING': return 'ATTACKING';
      case 'DYING': return 'DYING';
      default: return 'CHASING';
    }
  }
};
