/* =========================================================
   map.js — Custom maps: Cargo 17 (boat), Downtown (dusk city
   with enterable multi-story buildings + interiors + roofs),
   Blacksite (night military compound), Mirage (sunlit desert
   town). Each map has real buildings, stairs, roofs, props and
   its own atmospheric lighting. Every visual box registers an
   AABB collider for movement, bullets, LOS and bot navigation.
   ========================================================= */

/* ---------- procedural map textures (no binary assets) ---------- */
function mapTex(draw, w=256, h=256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const MAP_TEX = {
  woodPlank: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#3a2e24'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < h; i += 30) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i + (Math.random()-0.5)*2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 128) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
    for (let i = 0; i < 120; i++) {
      ctx.strokeStyle = 'rgba(90,70,50,'+(0.1+Math.random()*0.2)+')'; ctx.lineWidth = 1;
      const y = Math.random()*h; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w, y+(Math.random()-0.5)*4); ctx.stroke();
    }
  }),
  concrete: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#6a7076'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 500; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 400; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = 'rgba(0,0,0,'+(0.04+Math.random()*0.08)+')';
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 8+Math.random()*22, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(Math.random()*w, 0); ctx.lineTo(Math.random()*w, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Math.random()*h); ctx.lineTo(w, Math.random()*h); ctx.stroke();
    }
  }),
  concretePanel: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#747a80'; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = 'rgba(255,255,255,'+(Math.random()*0.05)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
      ctx.fillStyle = 'rgba(0,0,0,'+(Math.random()*0.08)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    }
    ctx.strokeStyle = 'rgba(20,24,28,0.5)'; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w-4, h-4);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, w-10, h-10);
    ctx.fillStyle = 'rgba(30,34,38,0.6)';
    for (const [px,py] of [[14,14],[w-14,14],[14,h-14],[w-14,h-14]]) {
      ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI*2); ctx.fill();
    }
  }),
  rustMetal: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(120,80,40,0.5)';
    for (let i = 0; i < 220; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*3+1, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(70,40,20,0.4)';
    for (let i = 0; i < 120; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*6+2, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(200,120,40,0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath(); ctx.moveTo(0, Math.random()*h); ctx.lineTo(w, Math.random()*h); ctx.stroke();
    }
  }),
  corrugated: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#5a6068'; ctx.fillRect(0,0,w,h);
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x+16, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, h);
    }
    ctx.fillStyle = 'rgba(90,50,20,0.30)';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*4+1, 0, Math.PI*2); ctx.fill();
    }
  }),
  asphalt: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#2c2f33'; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < 2400; i++) {
      const v = Math.random();
      ctx.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.10)';
      ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = Math.random()*w, y = Math.random()*h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (Math.random()-0.5)*60; y += (Math.random()-0.5)*60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,180,80,0.10)';
    ctx.fillRect(0, h*0.46, w, 5);
  }),
  tilePlaza: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#8a8378'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(40,36,32,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i <= h; i += 32) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }
    for (let i = 0; i <= w; i += 32) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(255,255,255,'+(Math.random()*0.05)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
      ctx.fillStyle = 'rgba(0,0,0,'+(Math.random()*0.06)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    }
  }),
  brickRed: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#8a5a44'; ctx.fillRect(0,0,w,h);
    const bh = 22, bw = 54;
    ctx.strokeStyle = 'rgba(224,214,200,0.7)'; ctx.lineWidth = 3;
    for (let y = 0; y <= h; y += bh) {
      const off = (y / bh) % 2 === 0 ? 0 : bw/2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = -bw + off; x < w; x += bw) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+bh); ctx.stroke();
      }
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = 'rgba(60,30,20,'+(Math.random()*0.2)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 3+Math.random()*6, 2+Math.random()*3);
    }
  }),
  brickTan: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#b0956e'; ctx.fillRect(0,0,w,h);
    const bh = 20, bw = 50;
    ctx.strokeStyle = 'rgba(240,232,214,0.7)'; ctx.lineWidth = 3;
    for (let y = 0; y <= h; y += bh) {
      const off = (y / bh) % 2 === 0 ? 0 : bw/2;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = -bw + off; x < w; x += bw) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+bh); ctx.stroke();
      }
    }
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = 'rgba(120,90,50,'+(Math.random()*0.18)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 2+Math.random()*5, 2+Math.random()*3);
    }
  }),
  sandstone: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#c8b187'; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = 'rgba(140,110,70,'+(Math.random()*0.16)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 2, 1);
      ctx.fillStyle = 'rgba(255,248,224,'+(Math.random()*0.12)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 2, 1);
    }
    ctx.strokeStyle = 'rgba(120,95,60,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, Math.random()*h); ctx.lineTo(w, Math.random()*h); ctx.stroke();
    }
  }),
  stucco: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#d8c8a8'; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = 'rgba(150,130,95,'+(Math.random()*0.14)+')';
      ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
    }
    ctx.fillStyle = 'rgba(90,70,45,0.14)';
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 10+Math.random()*30, 0, Math.PI*2); ctx.fill();
    }
  }),
  grass: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#3f5f3a'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 500; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1, Math.random()*2+1);
    ctx.fillStyle = 'rgba(0,60,0,0.25)';
    for (let i = 0; i < 34; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*6+2, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(90,120,60,0.25)';
    for (let i = 0; i < 20; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*4+1, 0, Math.PI*2); ctx.fill();
    }
  }),
  sand: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#d8c8a4'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(160,140,100,0.35)';
    for (let i = 0; i < 600; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
    ctx.fillStyle = 'rgba(200,180,140,0.4)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*3+1, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(180,160,120,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = 0, y = Math.random()*h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += w/8; y += (Math.random()-0.5)*20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }),
  gravel: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#565a5e'; ctx.fillRect(0,0,w,h);
    for (let i = 0; i < 900; i++) {
      const g = 60 + Math.random()*80;
      ctx.fillStyle = 'rgba('+g+','+g+','+(g+4)+',0.8)';
      ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, Math.random()*2.6+0.6, 0, Math.PI*2); ctx.fill();
    }
  }),
  metalPlate: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#565c64'; ctx.fillRect(0,0,w,h);
    for (let x = 0; x < w; x += 64) {
      const g = ctx.createLinearGradient(x, 0, x+64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.5, 'rgba(0,0,0,0.10)');
      g.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 64, h);
    }
    ctx.strokeStyle = 'rgba(20,24,28,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
    ctx.fillStyle = 'rgba(220,226,232,0.5)';
    for (const [px,py] of [[10,10],[w/2-10,10],[w/2+10,10],[w-10,10],[10,h-10],[w-10,h-10]]) {
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI*2); ctx.fill();
    }
  }),
  fence: mapTex((ctx, w, h) => {
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(150,160,170,0.85)'; ctx.lineWidth = 2;
    for (let i = -h; i < w+h; i += 18) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i+h, 0); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,96,104,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(w, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h-2); ctx.lineTo(w, h-2); ctx.stroke();
  }, 256, 128),
  woodDoor: mapTex((ctx, w, h) => {
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 42) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 42) { ctx.beginPath(); ctx.moveTo(x+2,0); ctx.lineTo(x+2,h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(200,160,60,0.8)';
    ctx.beginPath(); ctx.arc(w-34, h/2, 7, 0, Math.PI*2); ctx.fill();
  }),
};

const MapData = {
  colliders:[], spawns:[], footprints:[], worldGroup:null,
  water:null, waterBase:null, lights:[], beacons:[], animated:[],
  M:null,

  addBox(list, x, y, z, w, h, d, mat, opts) {
    opts = opts || {};
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    (opts.parent || this.worldGroup).add(mesh);
    if (opts.collide !== false) {
      const c = {
        min:new THREE.Vector3(x - w/2, y - h/2, z - d/2),
        max:new THREE.Vector3(x + w/2, y + h/2, z + d/2),
        metal: !!opts.metal, mesh
      };
      this.colliders.push(c);
      if (opts.footprint) this.footprints.push({ x, z, w, d, tall: opts.tall !== false });
    }
    return mesh;
  },

  /* cylinder helper (collider is an AABB around the base) */
  addCyl(list, x, y, z, rt, rb, h, mat, opts) {
    opts = opts || {};
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 12), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    (opts.parent || this.worldGroup).add(mesh);
    if (opts.collide !== false) {
      const r = Math.max(rt, rb);
      this.colliders.push({
        min:new THREE.Vector3(x - r, y - h/2, z - r),
        max:new THREE.Vector3(x + r, y + h/2, z + r),
        metal: !!opts.metal, mesh
      });
    }
    return mesh;
  },

  /* staircase: stepped boxes rising one step at a time (walkable).
     baseY lets upper floors start the flight at their own level. */
  addStairs(list, x0, z, w, steps, rise, run, dirX, mat, baseY) {
    const b = baseY || 0;
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise;
      const cx = x0 + dirX * (i * run + run/2);
      this.addBox(list, cx, b + top/2, z, run, top, w, mat, { cast:false });
    }
  },

  /* point lamp: emissive bulb + real point light */
  addLamp(list, x, y, z, color, intensity, dist) {
    const mat = new THREE.MeshStandardMaterial({
      color:0xffe8c0, emissive:color || 0xffb765, emissiveIntensity:2.2 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
    m.position.set(x, y, z); list.add(m);
    const l = new THREE.PointLight(color || 0xffb765, intensity || 3, dist || 24, 2);
    l.position.set(x, y, z); list.add(l); this.lights.push(l);
    return l;
  },

  /* pulsing beacon (red tower light etc.) */
  addBeacon(list, x, y, z, color, intensity, dist) {
    const mat = new THREE.MeshStandardMaterial({
      color:0x330000, emissive:color || 0xff2200, emissiveIntensity:2.5 });
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat);
    m.position.set(x, y, z); list.add(m);
    const l = new THREE.PointLight(color || 0xff2200, intensity || 2, dist || 20, 2);
    l.position.set(x, y, z); list.add(l);
    this.lights.push(l);
    this.beacons.push({ mesh:m, light:l, mat, phase:Math.random()*Math.PI*2 });
    return l;
  },

  /* sky dome + optional stars */
  addSky(scene, top, horizon, bottom) {
    const geo = new THREE.SphereGeometry(500, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side:THREE.BackSide,
      uniforms:{ top:{value:new THREE.Color(top)}, bottom:{value:new THREE.Color(bottom)},
                 horizon:{value:new THREE.Color(horizon)} },
      vertexShader:`varying vec3 vP; void main(){ vP = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader:`varying vec3 vP; uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon;
        void main(){ float h = normalize(vP).y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.5));
          gl_FragColor = vec4(c, 1.0); }`
    });
    const sky = new THREE.Mesh(geo, mat);
    scene.add(sky); this.sky = sky;
  },
  addStars(scene, count) {
    const geo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < (count || 500); i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(460);
      if (v.y > 10) pts.push(v.x, v.y, v.z);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color:0xcfe0ff, size:1.6, sizeAttenuation:false, transparent:true, opacity:0.85 }));
    scene.add(stars); this.stars = stars;
  },
  addSunDisc(scene, x, y, z, r, color) {
    const mat = new THREE.MeshBasicMaterial({ color:color || 0xffe8c0, fog:false });
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, y, z); scene.add(m);
    if (!this.animated) this.animated = [];
    return m;
  },

  /* standard shadow-casting sun/moon directional light */
  addSun(scene, x, y, z, color, intensity, shadowSize) {
    const d = new THREE.DirectionalLight(color, intensity);
    d.position.set(x, y, z);
    d.castShadow = true;
    const s = shadowSize || 55;
    d.shadow.mapSize.set(2048, 2048);
    d.shadow.camera.left = -s; d.shadow.camera.right = s;
    d.shadow.camera.top = s; d.shadow.camera.bottom = -s;
    d.shadow.camera.far = 240;
    d.shadow.bias = -0.0012;
    scene.add(d);
    return d;
  },

  /* ============================================================
     MULTI-STORY BUILDING with interior + stairs + roof access.
     Builds floor slabs, walls (with door gaps), interior stairs
     from ground to each floor, and a roof with parapet. Returns
     the roof-top Y so callers can place roof props.
     ============================================================ */
  addBuilding(list, cx, cz, w, d, floors, floorH, mats, opts) {
    opts = opts || {};
    const t = opts.wallT || 0.35;
    const doors = opts.doors || [];           // ['n','s','e','w'] sides with door gaps
    const doorW = opts.doorW || 1.6;
    const doorH = opts.doorH || 2.5;
    const stairSide = opts.stairSide || 'w';  // which wall the stairs hug
    const winMat = opts.winMat;
    const x0 = cx - w/2, x1 = cx + w/2, z0 = cz - d/2, z1 = cz + d/2;

    /* stair flights alternate sides per floor (switchback), so flights
       never stack in the same footprint. Flight k: floor k → k+1;
       the last flight (floors-1) tops out on the roof.
       Rise is aligned so the top step lands flush with the receiving
       slab's top surface, and every slab gets a stairwell hole over
       the flight below it (climber's head never meets the ceiling). */
    const runPer = 0.55, maxRise = 0.48;
    const stepsF = Math.ceil((floorH + 0.3) / maxRise);   // enough steps for roof flight too
    const flight = (k) => {
      const even = (k % 2) === 0;
      const dirX = even ? 1 : -1;
      const sx = even ? x0 + t + 0.4 : x1 - t - 0.4;         // start edge in x
      const sz = even ? cz - Math.min(4, d/4) : cz + Math.min(4, d/4);
      const base = k * floorH;
      const isRoof = (k === floors - 1);
      /* top of the receiving slab: floor slab = 0.2 thick, roof = 0.3 */
      const target = base + floorH + (isRoof ? 0.3 : 0.2);
      const rise = (target - base) / stepsF;
      const startX = dirX > 0 ? sx : sx - stepsF * runPer;
      /* steps span between startX and endX (signed by direction) */
      return { dirX, sx, sz, base, isRoof, rise, startX, endX: startX + dirX * stepsF * runPer };
    };
    const placeFlight = (k) => {
      const F = flight(k);
      const stairMat = mats.stair || mats.wall;
      this.addStairs(list, F.startX, F.sz, 1.6, stepsF, F.rise, runPer, F.dirX, stairMat, F.base);
      // decorative open-side railing (non-colliding), along the real step span
      const railZ = F.sz + (F.dirX > 0 ? 0.85 : -0.85);
      const midX = F.startX + F.dirX * (stepsF*runPer) / 2;
      this.addBox(list, midX, F.base + floorH*0.55, railZ, stepsF*runPer, 0.06, 0.06,
                  mats.rail || mats.wall, { collide:false, cast:false });
      for (let s = 0; s <= stepsF; s += 3) {
        this.addBox(list, F.startX + F.dirX*(s*runPer), F.base + floorH*0.28, railZ,
                    0.05, floorH*0.55, 0.05, mats.rail || mats.wall, { collide:false, cast:false });
      }
    };
    /* slab with a stairwell hole over the given flight */
    const slabWithHole = (yb, th, F, mat, ox, oz, ow, od) => {
      const ix0 = ox - ow/2, ix1 = ox + ow/2, iz0 = oz - od/2, iz1 = oz + od/2;
      const fx0 = Math.min(F.startX, F.endX), fx1 = Math.max(F.startX, F.endX);
      const hx0 = Math.max(ix0, fx0 - 0.15), hx1 = Math.min(ix1, fx1 + 0.15);
      const hz0 = Math.max(iz0, F.sz - 0.95), hz1 = Math.min(iz1, F.sz + 0.95);
      const y = yb + th/2;
      const quad = (a0, a1, b0, b1) => {
        if (a1 - a0 > 0.05 && b1 - b0 > 0.05)
          this.addBox(list, (a0+a1)/2, y, (b0+b1)/2, a1-a0, th, b1-b0, mat, { cast:false, footprint:true });
      };
      quad(ix0, hx0, iz0, iz1);            // strip before the hole
      quad(hx1, ix1, iz0, iz1);            // strip after the hole
      quad(hx0, hx1, iz0, hz0);            // strip on -z side of hole
      quad(hx0, hx1, hz1, iz1);            // strip on +z side of hole
    };

    for (let f = 0; f < floors; f++) {
      const yb = f * floorH;
      const yt = yb + floorH;

      /* floor slab (interior) with stairwell hole over the flight below;
         skip ground floor (map floor is there) */
      if (f > 0) {
        slabWithHole(yb, 0.2, flight(f - 1), mats.floor || mats.wall,
                     cx, cz, w - t*2, d - t*2);
      }

      /* --- walls --- */
      const wall = (wx, wz, ww, wd, hasDoor) => {
        if (!hasDoor) { this.addBox(list, wx, (yb+yt)/2, wz, ww, floorH, wd, mats.wall, {}); return; }
        // split wall around a door gap in the middle
        if (ww > wd) {  // wall runs along X
          const side = (ww - doorW) / 2;
          this.addBox(list, wx - (doorW+side)/2, (yb+yt)/2, wz, side, floorH, wd, mats.wall, {});
          this.addBox(list, wx + (doorW+side)/2, (yb+yt)/2, wz, side, floorH, wd, mats.wall, {});
          this.addBox(list, wx, yt - (floorH-doorH)/2, wz, doorW, floorH-doorH, wd, mats.wall, {});
        } else {        // wall runs along Z
          const side = (wd - doorW) / 2;
          this.addBox(list, wx, (yb+yt)/2, wz - (doorW+side)/2, ww, floorH, side, mats.wall, {});
          this.addBox(list, wx, (yb+yt)/2, wz + (doorW+side)/2, ww, floorH, side, mats.wall, {});
          this.addBox(list, wx, yt - (floorH-doorH)/2, wz, ww, floorH-doorH, doorW, mats.wall, {});
        }
      };
      // N (+z), S (-z) walls run along X; E (+x), W (-x) run along Z
      wall(cx, z1 - t/2, w, t, f === 0 && doors.includes('n'));
      wall(cx, z0 + t/2, w, t, f === 0 && doors.includes('s'));
      wall(x1 - t/2, cz, t, d, f === 0 && doors.includes('e'));
      wall(x0 + t/2, cz, t, d, f === 0 && doors.includes('w'));

      /* --- windows (decorative glass, non-colliding) --- */
      if (winMat) {
        const wy = yb + floorH*0.55;
        const winH = Math.min(1.5, floorH*0.45);
        const nX = Math.max(1, Math.floor(w / 4));
        const nZ = Math.max(1, Math.floor(d / 4));
        for (let i = 0; i < nX; i++) {
          const wx = x0 + (i+0.5) * (w / nX);
          if (Math.abs(wx - cx) < doorW && f === 0 && (doors.includes('n') || doors.includes('s'))) continue;
          this.addBox(list, wx, wy, z1 + 0.02, 1.5, winH, 0.06, winMat, { collide:false, cast:false });
          this.addBox(list, wx, wy, z0 - 0.02, 1.5, winH, 0.06, winMat, { collide:false, cast:false });
        }
        for (let i = 0; i < nZ; i++) {
          const wz = z0 + (i+0.5) * (d / nZ);
          if (Math.abs(wz - cz) < doorW && f === 0 && (doors.includes('e') || doors.includes('w'))) continue;
          this.addBox(list, x1 + 0.02, wy, wz, 0.06, winH, 1.5, winMat, { collide:false, cast:false });
          this.addBox(list, x0 - 0.02, wy, wz, 0.06, winH, 1.5, winMat, { collide:false, cast:false });
        }
      }

      /* --- interior stairs from this floor to the next --- */
      if (f < floors - 1) placeFlight(f);
    }

    /* --- roof access stairs (final flight: top floor → roof) --- */
    if (floors > 0) placeFlight(floors - 1);

    /* --- roof slab (with stairwell hole over the final flight) + parapet --- */
    const roofY = floors * floorH;
    slabWithHole(roofY, 0.3, flight(floors - 1), mats.roof || mats.wall,
                 cx, cz, w + 0.3, d + 0.3);
    /* parapet top sits 0.6 above roof surface → blocks step-up (>0.5) */
    const ph = 0.7;
    this.addBox(list, cx, roofY + 0.55, z1 + 0.1, w + 0.3, ph, 0.25, mats.wall, {});
    this.addBox(list, cx, roofY + 0.55, z0 - 0.1, w + 0.3, ph, 0.25, mats.wall, {});
    this.addBox(list, x1 + 0.1, roofY + 0.55, cz, 0.25, ph, d + 0.3, mats.wall, {});
    this.addBox(list, x0 - 0.1, roofY + 0.55, cz, 0.25, ph, d + 0.3, mats.wall, {});
    return roofY + 0.3;
  },

  /* chain-link fence run (posts + mesh panel) */
  addFence(list, x, z, len, alongX, mat) {
    const post = (px, pz) => this.addCyl(list, px, 1.1, pz, 0.07, 0.07, 2.2, this.M.metalPost, { seg:6 });
    const n = Math.max(2, Math.round(len / 4));
    for (let i = 0; i <= n; i++) {
      const off = -len/2 + i*(len/n);
      post(alongX ? x+off : x, alongX ? z : z+off);
    }
    // mesh panel (non-colliding visual) + low solid base collider
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 2.0),
      new THREE.MeshStandardMaterial({ map:MAP_TEX.fence, transparent:true, alphaTest:0.35,
        side:THREE.DoubleSide, metalness:0.6, roughness:0.5 }));
    panel.position.set(x, 1.1, z);
    if (!alongX) panel.rotation.y = Math.PI/2;
    panel.castShadow = false; panel.receiveShadow = true;
    list.add(panel);
    this.addBox(list, x, 0.9, z, alongX ? len : 0.14, 1.8, alongX ? 0.14 : len, mat || this.M.metalPost, { metal:true });
  },

  /* parked car: body + cabin + 4 wheels */
  addCar(list, x, z, ry, bodyMat, glassMat) {
    const g = new THREE.Group();
    const add = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz);
      m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    add(new THREE.BoxGeometry(1.9, 0.7, 4.4), bodyMat, 0, 0.62, 0);           // body
    add(new THREE.BoxGeometry(1.7, 0.62, 2.2), bodyMat, 0, 1.25, -0.1);       // cabin
    add(new THREE.BoxGeometry(1.72, 0.5, 0.1), glassMat, 0, 1.28, -1.18);     // windshield
    add(new THREE.BoxGeometry(1.72, 0.5, 0.1), glassMat, 0, 1.28, 0.98);      // rear glass
    add(new THREE.BoxGeometry(0.1, 0.5, 1.9), glassMat, -0.86, 1.28, -0.1);   // side glass L
    add(new THREE.BoxGeometry(0.1, 0.5, 1.9), glassMat, 0.86, 1.28, -0.1);    // side glass R
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    for (const [wx, wz] of [[-0.92,1.4],[0.92,1.4],[-0.92,-1.4],[0.92,-1.4]]) {
      const wm = new THREE.Mesh(wheelGeo, this.M.tyre);
      wm.rotation.z = Math.PI/2; wm.position.set(wx, 0.36, wz);
      wm.castShadow = true; g.add(wm);
    }
    g.position.set(x, 0, z); g.rotation.y = ry;
    list.add(g);
    // AABB collider matching the rotated footprint (bounding box of the
    // 1.9 x 4.4 body — the old logic had x/z swapped for every rotation)
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    this.addBox(list, x, 0.9, z, 1.9*c + 4.4*s, 1.5, 4.4*c + 1.9*s, bodyMat, { cast:false });
  },

  /* stack of wooden crates */
  addCrates(list, x, z, count) {
    let y = 0;
    for (let i = 0; i < count; i++) {
      const s = 0.9 + Math.random()*0.4;
      this.addBox(list, x + (Math.random()-0.5)*0.4, y + s/2, z + (Math.random()-0.5)*0.4,
                  s, s, s, this.M.crate, { footprint:i===0 });
      y += s;
    }
  },

  /* barrel cluster */
  addBarrels(list, x, z, count, mat) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.addCyl(list, x + Math.cos(a)*0.55, 0.55, z + Math.sin(a)*0.55,
                  0.36, 0.36, 1.1, mat || this.M.barrel, { seg:10, metal:true });
    }
  },

  reset() {
    this.colliders = []; this.spawns = []; this.footprints = [];
    this.lights = []; this.beacons = []; this.animated = [];
    this.worldGroup = null; this.M = null; this.minimap = null;
  },

  /* ---------- shared engine methods ---------- */
  update(t) {
    if (this.water && this.waterBase) {
      const pos = this.water.geometry.attributes.position;
      const b = this.waterBase;
      for (let i = 0; i < pos.count; i++) {
        const x = b[i*3], z = b[i*3+2];
        pos.array[i*3+1] = Math.sin(x*0.06 + t*1.1) * 0.5 +
                           Math.cos(z*0.08 + t*0.8) * 0.4 +
                           Math.sin((x+z)*0.03 + t*0.5) * 0.35;
      }
      pos.needsUpdate = true;
    }
    if (this.radar) this.radar.rotation.y = t * 1.4;
    for (const b of this.beacons) {
      const p = 0.5 + 0.5 * Math.sin(t * 3 + b.phase);
      b.mat.emissiveIntensity = 0.4 + p * 2.6;
      if (b.light) b.light.intensity = 0.4 + p * 2.2;
    }
  },

  rayTest(origin, dir, maxDist) {
    let best = maxDist, hitC = null, hitN = null;
    const inv = { x:1/dir.x, y:1/dir.y, z:1/dir.z };
    for (const c of this.colliders) {
      let tmin = -Infinity, tmax = Infinity;
      if (Math.abs(dir.x) < 1e-9) {
        if (origin.x < c.min.x || origin.x > c.max.x) continue;
      } else {
        let t1 = (c.min.x - origin.x) * inv.x, t2 = (c.max.x - origin.x) * inv.x;
        if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      }
      if (Math.abs(dir.y) < 1e-9) {
        if (origin.y < c.min.y || origin.y > c.max.y) continue;
      } else {
        let t1 = (c.min.y - origin.y) * inv.y, t2 = (c.max.y - origin.y) * inv.y;
        if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      }
      if (Math.abs(dir.z) < 1e-9) {
        if (origin.z < c.min.z || origin.z > c.max.z) continue;
      } else {
        let t1 = (c.min.z - origin.z) * inv.z, t2 = (c.max.z - origin.z) * inv.z;
        if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      }
      if (tmax >= Math.max(0, tmin)) {
        const t = tmin >= 0 ? tmin : tmax;
        if (t >= 0 && t < best) {
          best = t;
          hitC = c;
          const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
          hitN = new THREE.Vector3();
          const e = 0.01;
          if (Math.abs(px - c.min.x) < e) hitN.set(-1,0,0);
          else if (Math.abs(px - c.max.x) < e) hitN.set(1,0,0);
          else if (Math.abs(py - c.min.y) < e) hitN.set(0,-1,0);
          else if (Math.abs(py - c.max.y) < e) hitN.set(0,1,0);
          else if (Math.abs(pz - c.min.z) < e) hitN.set(0,0,-1);
          else hitN.set(0,0,1);
        }
      }
    }
    if (hitC) return { dist:best, collider:hitC, normal:hitN,
      point:new THREE.Vector3().copy(origin).addScaledVector(dir, best) };
    return null;
  },

  losClear(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const dist = dir.length();
    if (dist < 0.001) return true;
    dir.divideScalar(dist);
    const hit = this.rayTest(a, dir, dist - 0.05);
    return !hit;
  },

  groundAt(x, y, z, margin) {
    let top = -1000;
    const m = margin || 0.02;
    for (const c of this.colliders) {
      if (x > c.min.x - m && x < c.max.x + m && z > c.min.z - m && z < c.max.z + m &&
          c.max.y <= y + 0.35 && c.max.y > top) top = c.max.y;
    }
    return top;
  },

  dispose(scene) {
    if (this.worldGroup) {
      this.worldGroup.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      scene.remove(this.worldGroup);
    }
    if (this.water) { this.water.geometry.dispose(); this.water.material.dispose(); scene.remove(this.water); }
    if (this.sky) { this.sky.geometry.dispose(); this.sky.material.dispose(); scene.remove(this.sky); }
    if (this.stars) { this.stars.geometry.dispose(); this.stars.material.dispose(); scene.remove(this.stars); }
    if (this.sun) { scene.remove(this.sun); this.sun = null; }
    if (this.hemi) { scene.remove(this.hemi); this.hemi = null; }
    if (this.amb) { scene.remove(this.amb); this.amb = null; }
    this.colliders = []; this.spawns = []; this.footprints = [];
    this.lights = []; this.beacons = []; this.animated = [];
    this.worldGroup = null; this.water = null; this.sky = null; this.stars = null;
  },

  /* ============================================================
     CARGO 17 — cargo ship at night: hull, decks, bridge tower,
     container corridors, cabin interior, cranes, water.
     ============================================================ */
  buildCargo17(scene) {
    this.reset();
    const g = new THREE.Group();
    this.worldGroup = g;
    scene.add(g);

    const M = {
      deck:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x2d343a, roughness:0.9, metalness:0.15 }),
      deck2: new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x242a2f, roughness:0.95, metalness:0.1 }),
      hull:  new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x1d2226, roughness:0.8, metalness:0.3 }),
      wall:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x474f57, roughness:0.85, metalness:0.15 }),
      wallD: new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x3c4348, roughness:0.85, metalness:0.2 }),
      rail:  new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x8a9298, roughness:0.5, metalness:0.7 }),
      red:   new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x8c2f22, roughness:0.7, metalness:0.3 }),
      blue:  new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x2a4a68, roughness:0.75, metalness:0.3 }),
      green: new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x2f5844, roughness:0.75, metalness:0.3 }),
      yel:   new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x8a7328, roughness:0.75, metalness:0.3 }),
      crate: new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x6b5a3e, roughness:0.95, metalness:0.05 }),
      metal: new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x70787e, roughness:0.4, metalness:0.85 }),
      dark:  new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x191d21, roughness:0.7, metalness:0.4 }),
      glass: new THREE.MeshStandardMaterial({ color:0x223344, roughness:0.1, metalness:0.9,
                transparent:true, opacity:0.5, emissive:0x3a4a3a, emissiveIntensity:0.5 }),
      metalPost: new THREE.MeshStandardMaterial({ color:0x70787e, roughness:0.5, metalness:0.7 }),
      tyre:  new THREE.MeshStandardMaterial({ color:0x14161a, roughness:0.9 }),
      barrel:new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x6a4030, roughness:0.7, metalness:0.4 }),
    };
    this.M = M;

    /* ============ HULL & MAIN DECK ============ */
    this.addBox(g, 0, -1.2, 0, 90, 2.4, 20, M.hull, { collide:false });
    this.addBox(g, 0, -0.1, 0, 90, 0.2, 19, M.deck, { cast:false });
    this.addBox(g, 0, -1.95, 0, 90, 3.9, 20, M.hull, { collide:true, cast:false });

    /* stepped pointed bow */
    this.addBox(g, 47, -1.2, 0, 4, 2.4, 15, M.hull, { cast:false });
    this.addBox(g, 50.4, -1.2, 0, 3, 2.4, 9, M.hull, { cast:false });
    this.addBox(g, 53, -1.2, 0, 2.6, 2.4, 4, M.hull, { cast:false });
    this.addBox(g, 47, -0.1, 0, 4, 0.2, 14, M.deck, { cast:false });
    this.addBox(g, 50.4, -0.1, 0, 3, 0.2, 8, M.deck, { cast:false });
    this.addBox(g, 53, -0.1, 0, 2.6, 0.2, 3, M.deck, { cast:false });

    /* bulwark railings */
    this.addBox(g, 0, 0.55, 9.7, 90, 1.1, 0.5, M.rail, { metal:true, cast:false });
    this.addBox(g, 0, 0.55, -9.7, 90, 1.1, 0.5, M.rail, { metal:true, cast:false });
    this.addBox(g, -45, 0.55, 0, 0.5, 1.1, 20, M.rail, { metal:true, cast:false });
    this.addBox(g, 45, 0.55, 0, 0.5, 1.1, 14, M.rail, { metal:true, cast:false });
    this.addBox(g, 47, 0.55, 7, 4, 1.1, 0.5, M.rail, { metal:true, cast:false });
    this.addBox(g, 47, 0.55, -7, 4, 1.1, 0.5, M.rail, { metal:true, cast:false });
    this.addBox(g, 50.4, 0.55, 4.3, 3.2, 1.1, 0.5, M.rail, { metal:true, cast:false });
    this.addBox(g, 50.4, 0.55, -4.3, 3.2, 1.1, 0.5, M.rail, { metal:true, cast:false });

    /* ============ BRIDGE SUPERSTRUCTURE ============ */
    const H = 6;
    this.addBox(g, -33, H/2, -7.75, 14, H, 0.5, M.wall, {});
    this.addBox(g, -33, H/2, 7.75, 14, H, 0.5, M.wall, {});
    this.addBox(g, -39.75, H/2, 0, 0.5, H, 16, M.wall, {});
    this.addBox(g, -26.25, H/2, -5, 0.5, H, 6, M.wall, {});
    this.addBox(g, -26.25, H/2, 5, 0.5, H, 6, M.wall, {});
    this.addBox(g, -26.25, 4.75, 0, 0.5, 2.5, 4, M.wall, {});
    this.addBox(g, -33, H + 0.1, 0, 14.5, 0.25, 16.5, M.wallD, { footprint:true });
    this.addBox(g, -33, 0.0, 0, 13.5, 0.2, 15, M.deck2, { cast:false });
    this.addBox(g, -26.1, 5.1, 0, 0.2, 1.4, 12, M.dark, { collide:false });
    this.addBox(g, -33, H + 0.7, -8, 14.5, 1.0, 0.3, M.rail, { metal:true, cast:false });
    this.addBox(g, -33, H + 0.7, 8, 14.5, 1.0, 0.3, M.rail, { metal:true, cast:false });
    this.addBox(g, -40.2, H + 0.7, 0, 0.3, 1.0, 16, M.rail, { metal:true, cast:false });
    this.addBox(g, -36, H + 2.2, 0, 0.5, 4, 0.5, M.metal, { metal:true });
    const radar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 0.5), M.metal);
    radar.position.set(-36, H + 4.2, 0); g.add(radar); this.radar = radar;

    for (let i = 0; i < 13; i++) {
      const top = (i + 1) * 0.48;
      this.addBox(g, -27 - i * 0.5, top / 2, 8.75, 0.9, top, 1.4, M.wallD, { cast:false });
      this.addBox(g, -27 - i * 0.5, top + 0.45, 9.5, 0.9, 0.9, 0.18, M.rail, { metal:true, cast:false });
    }
    this.addBox(g, -34.6, 6.1, 8.75, 3.3, 0.25, 1.4, M.wallD, { cast:false });
    this.addBox(g, -34.6, 6.68, 9.5, 3.3, 0.9, 0.18, M.rail, { metal:true, cast:false });

    /* ============ CONTAINER CORRIDOR ============ */
    const contMats = [M.red, M.blue, M.green, M.yel];
    const cont = (x, y, z, mi) => this.addBox(
      g, x, y, z, 6.4, 2.6, 2.5, contMats[mi % 4], { metal:true, footprint:true });
    cont(-16, 1.3, -4.6, 0); cont(-8, 1.3, -4.6, 1); cont(0, 1.3, -4.6, 2); cont(8, 1.3, -4.6, 3);
    cont(-16, 1.3, 4.6, 2); cont(-8, 1.3, 4.6, 3); cont(0, 1.3, 4.6, 0); cont(8, 1.3, 4.6, 1);
    cont(-16, 3.9, -4.6, 1); cont(0, 3.9, -4.6, 3);
    cont(-8, 3.9, 4.6, 0);   cont(8, 3.9, 4.6, 2);
    this.addBox(g, -19.5, 1.3, -4.6, 0.6, 2.6, 2.5, M.dark, { metal:true });
    this.addBox(g, 11.5, 1.3, 4.6, 0.6, 2.6, 2.5, M.dark, { metal:true });

    for (let i = 0; i < 5; i++) {
      const t1 = (i + 1) * 0.48;
      this.addBox(g, -8, t1 / 2, -8.0 + i * 0.55, 2, t1, 0.9, M.wallD, { cast:false });
      this.addBox(g, 0, t1 / 2, 8.0 - i * 0.55, 2, t1, 0.9, M.wallD, { cast:false });
    }

    /* ============ MESS CABIN with interior ============ */
    const cw = 0.4, ch = 3.2;
    this.addBox(g, 21, ch/2, 8.8, 10, ch, cw, M.wall, {});
    this.addBox(g, 16.2, ch/2, 5.5, cw, ch, 6.2, M.wall, {});
    this.addBox(g, 25.8, ch/2, 5.5, cw, ch, 6.2, M.wall, {});
    this.addBox(g, 21, ch/2, 2.2, 4, ch, cw, M.wall, {});
    this.addBox(g, 21, ch/2, 8.2, 4, ch, cw, M.wall, {});
    this.addBox(g, 21, ch, 5.5, 10.4, 0.3, 7.4, M.wallD, { footprint:true });
    this.addBox(g, 21, 0.05, 5.5, 9.6, 0.1, 6.6, M.deck2, { cast:false });
    this.addBox(g, 16.15, 2.6, 5.5, 0.1, 1.6, 2.0, M.glass, { collide:false });

    /* ============ OPEN DECK PROPS ============ */
    const cratePos = [[30,-6.5],[33,-6.5],[31.5,-4.5],[-22,6.5],[-20,6.5],[12,-8],[14,-7],[38,5],[36,7]];
    for (const [x,z] of cratePos) {
      const s = 1.2 + Math.random()*0.5;
      this.addBox(g, x, s/2, z, s, s, s, M.crate, { footprint:false });
    }
    this.addBox(g, -24, 0.5, -7.5, 1.6, 1.0, 1.0, M.green, {});
    this.addBox(g, -24, 1.3, -7.5, 1.4, 0.6, 0.9, M.green, {});
    this.addBox(g, 43, 0.7, 0, 2.4, 1.4, 2.4, M.metal, { metal:true });
    this.addBox(g, -24, 0.9, 6, 2.2, 1.8, 2.2, M.dark, { metal:true });
    this.addBox(g, -24, 1.9, 6, 0.5, 0.5, 3, M.metal, { metal:true, cast:false });
    this.addBox(g, 40, 3.5, -7, 0.8, 7, 0.8, M.metal, { metal:true });
    this.addBox(g, 36.5, 6.8, -7, 7.5, 0.6, 0.6, M.metal, { metal:true });
    this.addBox(g, 33, 5.6, -7, 0.15, 2.4, 0.15, M.dark, { metal:true, cast:false });
    this.addBox(g, -42.5, 2, 0, 3, 4, 5, M.wallD, {});
    this.addBox(g, -42.5, 4.3, 0, 3.4, 0.6, 5.4, M.dark, { metal:true });

    /* ============ DECK LIGHTS ============ */
    this.addLamp(g, -25.5, 4.6, 0, 0xffb765, 4.5, 26);
    this.addLamp(g, -33, 5.9, -6, 0xffb765, 3, 22);
    this.addLamp(g, -14, 3.4, 0, 0xffb765, 3, 22);
    this.addLamp(g, 6, 3.4, 0, 0xffb765, 3, 22);
    this.addLamp(g, 21, 3.6, 8.4, 0xffb765, 3, 22);
    this.addLamp(g, 35, 3.2, 0, 0xffb765, 3, 22);
    this.addLamp(g, -43, 3.4, 0, 0xffb765, 3, 22);
    this.addBeacon(g, -36, H + 4.6, 0, 0xff2200, 2, 20);

    /* ============ SPAWNS ============ */
    const S = (x, z) => this.spawns.push(new THREE.Vector3(x, 0.2, z));
    S(12, -7); S(12, 7); S(30, 0); S(38, -5); S(20, 0); S(-20, 0);
    S(-24, -7); S(-30, 0); S(3, -8); S(3, 8); S(-14, 7); S(28, 7);
    S(42, 3); S(-43, -6); S(15, -2); S(-6, -2); S(24, -7);

    this.playerSpawn = new THREE.Vector3(-23, 0.3, 0);
    this.playerYaw = -Math.PI / 2;
    /* minimap framing — ship hull outline */
    this.minimap = { cx:4, cz:0, outline:[[-45,-10],[45,-10],[53,-2],[53,2],[45,10],[-45,10]] };

    /* ============ WATER ============ */
    const wGeo = new THREE.PlaneGeometry(700, 700, 24, 24);
    wGeo.rotateX(-Math.PI / 2);
    const wMat = new THREE.MeshStandardMaterial({
      color:0x0d2a38, roughness:0.22, metalness:0.55, transparent:true, opacity:0.96 });
    this.water = new THREE.Mesh(wGeo, wMat);
    this.water.position.y = -3.0;
    this.water.receiveShadow = false;
    scene.add(this.water);
    this.waterBase = Float32Array.from(wGeo.attributes.position.array);

    /* ============ SKY & LIGHTS ============ */
    this.addSky(scene, 0x0b1626, 0x4a4036, 0x2a3a4a);
    this.addStars(scene, 500);

    this.hemi = new THREE.HemisphereLight(0x44658c, 0x11161c, 0.42);
    scene.add(this.hemi);
    this.sun = this.addSun(scene, 60, 90, 40, 0xa8c4e8, 0.5, 60);
    this.amb = new THREE.AmbientLight(0x27313d, 0.22);
    scene.add(this.amb);
    scene.fog = new THREE.FogExp2(0x0a1218, 0.0075);
    scene.background = new THREE.Color(0x0a1218);
    return g;
  },

  /* ============================================================
     DOWNTOWN — dusk city block: brick buildings with enterable
     interiors, staircases to 2nd floors + roofs, a central plaza
     with fountain, parked cars, street lamps. Warm sunset light.
     ============================================================ */
  buildDowntown(scene) {
    this.reset();
    const g = new THREE.Group();
    this.worldGroup = g;
    scene.add(g);

    const M = {
      brick:  new THREE.MeshStandardMaterial({ map:MAP_TEX.brickRed, color:0xb08a72, roughness:0.9, metalness:0.05 }),
      brickD: new THREE.MeshStandardMaterial({ map:MAP_TEX.brickRed, color:0x8a6a56, roughness:0.9, metalness:0.05 }),
      brick2: new THREE.MeshStandardMaterial({ map:MAP_TEX.brickTan, color:0xc8b090, roughness:0.9, metalness:0.05 }),
      panel:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concretePanel, color:0x9aa0a6, roughness:0.8, metalness:0.1 }),
      roof:   new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x3c3f44, roughness:0.9, metalness:0.1 }),
      floor:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x6a5844, roughness:0.85, metalness:0.05 }),
      road:   new THREE.MeshStandardMaterial({ map:MAP_TEX.asphalt, color:0x6a6e74, roughness:0.95, metalness:0.05 }),
      walk:   new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x8a8e92, roughness:0.9, metalness:0.05 }),
      plaza:  new THREE.MeshStandardMaterial({ map:MAP_TEX.tilePlaza, color:0xa89880, roughness:0.8, metalness:0.05 }),
      stone:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x7a7e82, roughness:0.85, metalness:0.1 }),
      fountain:new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x9a9ea2, roughness:0.7, metalness:0.15 }),
      water:  new THREE.MeshStandardMaterial({ color:0x2a6a8a, roughness:0.15, metalness:0.4, transparent:true, opacity:0.8 }),
      car1:   new THREE.MeshStandardMaterial({ color:0x8a2a2a, roughness:0.4, metalness:0.6 }),
      car2:   new THREE.MeshStandardMaterial({ color:0x2a4a8a, roughness:0.4, metalness:0.6 }),
      car3:   new THREE.MeshStandardMaterial({ color:0x2a2a2e, roughness:0.4, metalness:0.6 }),
      car4:   new THREE.MeshStandardMaterial({ color:0xc8c8cc, roughness:0.35, metalness:0.7 }),
      glass:  new THREE.MeshStandardMaterial({ color:0x88aacc, roughness:0.05, metalness:0.9,
                transparent:true, opacity:0.5, emissive:0xffb060, emissiveIntensity:0.4 }),
      winLit: new THREE.MeshStandardMaterial({ color:0xffe0a0, roughness:0.2, metalness:0.3,
                emissive:0xffb060, emissiveIntensity:1.4 }),
      awning: new THREE.MeshStandardMaterial({ color:0x7a3030, roughness:0.85, metalness:0.05 }),
      metalPost: new THREE.MeshStandardMaterial({ color:0x3c4046, roughness:0.5, metalness:0.7 }),
      tyre:   new THREE.MeshStandardMaterial({ color:0x14161a, roughness:0.9 }),
      crate:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x6b5a3e, roughness:0.95, metalness:0.05 }),
      barrel: new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x5a6a4a, roughness:0.7, metalness:0.4 }),
      door:   new THREE.MeshStandardMaterial({ map:MAP_TEX.woodDoor, color:0x8a6a4a, roughness:0.8, metalness:0.05 }),
    };
    this.M = M;

    /* ============ GROUND: road base + sidewalks + plaza ============ */
    this.addBox(g, 0, -1.0, 0, 92, 2.0, 92, M.road, { collide:true, cast:false });
    this.addBox(g, 0, 0.02, 0, 88, 0.06, 88, M.road, { collide:false, cast:false });
    // central plaza (raised sidewalk)
    this.addBox(g, 0, 0.12, 0, 30, 0.24, 30, M.plaza, { collide:true, cast:false });
    // sidewalk strips along building rows
    this.addBox(g, -22, 0.12, 0, 22, 0.24, 44, M.walk, { collide:true, cast:false });
    this.addBox(g, 22, 0.12, 0, 22, 0.24, 44, M.walk, { collide:true, cast:false });
    this.addBox(g, 0, 0.12, -22, 22, 0.24, 22, M.walk, { collide:true, cast:false });
    this.addBox(g, 0, 0.12, 22, 22, 0.24, 22, M.walk, { collide:true, cast:false });

    /* ============ FOUNTAIN (center of plaza) ============ */
    this.addBox(g, 0, 0.6, 0, 7, 1.2, 7, M.fountain, { footprint:true });
    this.addBox(g, 0, 1.25, 0, 6.2, 0.2, 6.2, M.stone, { collide:false });
    this.addBox(g, 0, 0.9, 0, 5.4, 0.15, 5.4, M.water, { collide:false, cast:false });
    this.addCyl(g, 0, 1.6, 0, 0.5, 0.7, 1.2, M.fountain, { seg:10 });
    this.addCyl(g, 0, 2.4, 0, 1.2, 0.2, 0.35, M.fountain, { seg:12, collide:false });

    /* ============ BUILDINGS (two rows, facing plaza) ============ */
    const winMat = M.winLit;
    // west row (x = -30): three buildings
    this.addBuilding(g, -33, -14, 18, 20, 2, 4.2,
      { wall:M.brick, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['e'], winMat });
    this.addBuilding(g, -33, 12, 18, 22, 3, 4.0,
      { wall:M.brick2, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['e'], winMat });
    // east row (x = +30)
    this.addBuilding(g, 33, -14, 18, 20, 3, 4.0,
      { wall:M.panel, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['w'], winMat });
    this.addBuilding(g, 33, 12, 18, 22, 2, 4.2,
      { wall:M.brickD, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['w'], winMat });
    // north strip building (z = +34), spans the middle
    this.addBuilding(g, 0, 34, 40, 16, 2, 4.0,
      { wall:M.brick, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['s'], winMat });
    // south strip building (z = -34)
    this.addBuilding(g, 0, -34, 40, 16, 2, 4.0,
      { wall:M.brick2, floor:M.floor, roof:M.roof, stair:M.stone, rail:M.metalPost },
      { doors:['n'], winMat });

    /* ============ AWNINGS over ground-floor doors ============ */
    this.addBox(g, -23.8, 3.0, -14, 0.3, 0.2, 3.0, M.awning, { collide:false });
    this.addBox(g, -23.8, 3.0, 12, 0.3, 0.2, 3.0, M.awning, { collide:false });
    this.addBox(g, 23.8, 3.0, -14, 0.3, 0.2, 3.0, M.awning, { collide:false });
    this.addBox(g, 23.8, 3.0, 12, 0.3, 0.2, 3.0, M.awning, { collide:false });

    /* ============ PARKED CARS along the streets ============ */
    this.addCar(g, -8, -20, 0, M.car1, M.glass);
    this.addCar(g, 8, -20, 0, M.car3, M.glass);
    this.addCar(g, -8, 20, 0, M.car2, M.glass);
    this.addCar(g, 8, 20, 0, M.car4, M.glass);
    this.addCar(g, -20, -6, Math.PI/2, M.car4, M.glass);
    this.addCar(g, 20, 6, Math.PI/2, M.car1, M.glass);

    /* ============ STREET PROPS ============ */
    this.addCrates(g, -25, -22, 3);
    this.addCrates(g, 25, 22, 2);
    this.addBarrels(g, -26, 20, 3, M.barrel);
    this.addBarrels(g, 26, -20, 3, M.barrel);
    // dumpsters
    this.addBox(g, -24, 0.6, -24, 2.4, 1.2, 1.6, M.metalPost, { metal:true });
    this.addBox(g, 24, 0.6, 24, 2.4, 1.2, 1.6, M.metalPost, { metal:true });

    /* ============ STREET LAMPS (warm) ============ */
    const lampPos = [[-15,-15],[15,-15],[-15,15],[15,15],[-15,0],[15,0],[0,-15],[0,15]];
    for (const [lx,lz] of lampPos) {
      this.addCyl(g, lx, 2.2, lz, 0.08, 0.1, 4.4, M.metalPost, { seg:6, collide:false });
      this.addLamp(g, lx, 4.5, lz, 0xffb765, 3.5, 24);
    }

    /* ============ PERIMETER: tall walls so players stay inside ============ */
    this.addBox(g, -45, 5, 0, 1, 10, 92, M.panel, {});
    this.addBox(g, 45, 5, 0, 1, 10, 92, M.panel, {});
    this.addBox(g, 0, 5, -45, 92, 10, 1, M.panel, {});
    this.addBox(g, 0, 5, 45, 92, 10, 1, M.panel, {});

    /* ============ SPAWNS ============ */
    const S = (x, z) => this.spawns.push(new THREE.Vector3(x, 0.3, z));
    S(-20,-14); S(-20,14); S(20,-14); S(20,14);
    S(-10,-24); S(10,-24); S(-10,24); S(10,24);
    S(0,-20); S(0,20); S(-20,0); S(20,0);
    S(-30,-24); S(30,-24); S(-30,24); S(30,24);

    this.playerSpawn = new THREE.Vector3(-18, 0.4, 0);
    this.playerYaw = -Math.PI / 2;
    this.minimap = { cx:0, cz:0, outline:[[-46,-46],[46,-46],[46,46],[-46,46]] };

    /* ============ SKY & LIGHTS (warm dusk) ============ */
    this.addSky(scene, 0x1a2030, 0xd07a3a, 0x3a2a28);
    this.addSunDisc(scene, 160, 12, -200, 26, 0xffd090);
    this.hemi = new THREE.HemisphereLight(0x6a5a6a, 0x2a2018, 0.5);
    scene.add(this.hemi);
    this.sun = this.addSun(scene, 80, 40, -60, 0xffb070, 0.7, 50);
    this.amb = new THREE.AmbientLight(0x3a3040, 0.35);
    scene.add(this.amb);
    scene.fog = new THREE.FogExp2(0x2a2430, 0.006);
    scene.background = new THREE.Color(0x1a2030);
    return g;
  },

  /* ============================================================
     BLACKSITE — night military compound: hangar, bunker blocks,
     watchtowers, containers, fences, floodlights. Cold moonlight.
     ============================================================ */
  buildBlacksite(scene) {
    this.reset();
    const g = new THREE.Group();
    this.worldGroup = g;
    scene.add(g);

    const M = {
      conc:   new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x5a6066, roughness:0.9, metalness:0.1 }),
      concD:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x474d53, roughness:0.9, metalness:0.1 }),
      panel:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concretePanel, color:0x6a7076, roughness:0.8, metalness:0.15 }),
      hangar: new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x5a6068, roughness:0.7, metalness:0.4 }),
      roof:   new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x3c4046, roughness:0.6, metalness:0.6 }),
      floor:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x4a4e52, roughness:0.9, metalness:0.05 }),
      ground: new THREE.MeshStandardMaterial({ map:MAP_TEX.gravel, color:0x5a5e62, roughness:1.0, metalness:0.0 }),
      metal:  new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x6a7076, roughness:0.5, metalness:0.7 }),
      metalPost: new THREE.MeshStandardMaterial({ color:0x4a4e52, roughness:0.5, metalness:0.7 }),
      green:  new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0x3a4a3a, roughness:0.7, metalness:0.3 }),
      sandbag:new THREE.MeshStandardMaterial({ map:MAP_TEX.sand, color:0x8a7a5a, roughness:0.95, metalness:0.0 }),
      glass:  new THREE.MeshStandardMaterial({ color:0x88aacc, roughness:0.1, metalness:0.9,
                transparent:true, opacity:0.4, emissive:0x60a0d0, emissiveIntensity:0.6 }),
      crate:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x5a5040, roughness:0.95, metalness:0.05 }),
      barrel: new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x4a5a3a, roughness:0.7, metalness:0.4 }),
      tyre:   new THREE.MeshStandardMaterial({ color:0x14161a, roughness:0.9 }),
      truck:  new THREE.MeshStandardMaterial({ color:0x3a4a3a, roughness:0.6, metalness:0.4 }),
    };
    this.M = M;

    /* ============ GROUND (gravel) ============ */
    this.addBox(g, 0, -1.0, 0, 96, 2.0, 96, M.ground, { collide:true, cast:false });
    this.addBox(g, 0, 0.02, 0, 92, 0.06, 92, M.ground, { collide:false, cast:false });

    /* ============ HANGAR (big open building, enterable) ============ */
    // 26 x 18, single tall floor (7m), open interior with door gaps on both ends
    const hx = 0, hz = -24, hw = 26, hd = 18, hh = 7;
    this.addBox(g, hx, hh/2, hz + hd/2 - 0.3, hw, hh, 0.6, M.hangar, { footprint:true });   // back wall
    this.addBox(g, hx - hw/2 + 0.3, hh/2, hz, 0.6, hh, hd, M.hangar, {});                   // left wall
    this.addBox(g, hx + hw/2 - 0.3, hh/2, hz, 0.6, hh, hd, M.hangar, {});                   // right wall
    // front wall with a big door gap (split into two side pieces + lintel)
    this.addBox(g, hx - hw/2 + 4, hh/2, hz - hd/2 + 0.3, 8, hh, 0.6, M.hangar, {});
    this.addBox(g, hx + hw/2 - 4, hh/2, hz - hd/2 + 0.3, 8, hh, 0.6, M.hangar, {});
    this.addBox(g, hx, hh - 1.5, hz - hd/2 + 0.3, hw - 16, 3, 0.6, M.hangar, {});
    this.addBox(g, hx, 0.05, hz, hw - 1, 0.1, hd - 1, M.floor, { cast:false });              // interior floor
    this.addBox(g, hx, hh + 0.3, hz, hw + 0.6, 0.6, hd + 0.6, M.roof, { footprint:true });  // roof
    // hangar interior: crates and a truck
    this.addCrates(g, hx - 8, hz + 4, 3);
    this.addCrates(g, hx + 7, hz - 3, 2);
    this.addBox(g, hx, 1.1, hz + 5, 2.6, 2.2, 6, M.truck, { metal:true });   // truck body
    this.addBox(g, hx, 2.6, hz + 3.2, 2.4, 1.4, 2.4, M.truck, {});           // truck cab
    this.addBox(g, hx, 2.6, hz + 2.0, 2.2, 1.0, 0.1, M.glass, { collide:false }); // windshield
    for (const [wx,wz] of [[-1.2,7],[1.2,7],[-1.2,3],[1.2,3]]) {
      const wm = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.4,10), M.tyre);
      wm.rotation.z = Math.PI/2; wm.position.set(hx+wx, 0.5, hz+wz); wm.castShadow = true; g.add(wm);
    }

    /* ============ BUNKER BLOCKS (two enterable) ============ */
    this.addBuilding(g, -28, 8, 16, 16, 2, 3.6,
      { wall:M.conc, floor:M.floor, roof:M.roof, stair:M.concD, rail:M.metalPost },
      { doors:['n'], winMat:M.glass });
    this.addBuilding(g, 28, 8, 16, 16, 2, 3.6,
      { wall:M.panel, floor:M.floor, roof:M.roof, stair:M.concD, rail:M.metalPost },
      { doors:['n'], winMat:M.glass });

    /* ============ WATCHTOWERS (four corners) ============ */
    const tower = (tx, tz) => {
      // legs
      for (const [lx,lz] of [[-1.4,-1.4],[1.4,-1.4],[-1.4,1.4],[1.4,1.4]]) {
        this.addBox(g, tx+lx, 3, tz+lz, 0.35, 6, 0.35, M.metalPost, { metal:true });
      }
      // platform
      this.addBox(g, tx, 6.2, tz, 4, 0.4, 4, M.metal, { metal:true, footprint:true });
      // hut
      this.addBox(g, tx, 7.4, tz - 1.7, 4, 2.2, 0.4, M.panel, {});
      this.addBox(g, tx - 1.8, 7.4, tz, 0.4, 2.2, 4, M.panel, {});
      this.addBox(g, tx + 1.8, 7.4, tz, 0.4, 2.2, 4, M.panel, {});
      this.addBox(g, tx, 8.6, tz, 4.2, 0.3, 4.2, M.roof, { collide:false });
      this.addBox(g, tx, 7.6, tz + 1.75, 2.4, 1.2, 0.1, M.glass, { collide:false });
      // stairs up
      const dirX = tx < 0 ? 1 : -1;
      this.addStairs(g, tx + dirX * 2.2 - (dirX>0?0:13*0.55), tz + 2.6, 1.4, 13, 0.48, 0.55, dirX, M.metal);
      this.addBeacon(g, tx, 9.0, tz, 0xff2200, 2.5, 24);
    };
    tower(-38, -36); tower(38, -36); tower(-38, 36); tower(38, 36);

    /* ============ CONTAINER MAZE (mid) ============ */
    const contMats = [M.green, M.metal, M.truck];
    const cont = (x, z, ry, mi) => this.addBox(
      g, x, 1.35, z, ry ? 2.5 : 6.4, 2.7, ry ? 6.4 : 2.5, contMats[mi % 3],
      { metal:true, footprint:true, ry:0 });
    cont(-14, -4, 0, 0); cont(-14, 0, 0, 1); cont(-14, 4, 0, 2);
    cont(14, -4, 0, 1); cont(14, 0, 0, 2); cont(14, 4, 0, 0);
    cont(-4, 22, 1, 0); cont(4, 22, 1, 1);
    cont(-4, -12, 1, 2); cont(4, -12, 1, 0);
    // stacked
    this.addBox(g, -14, 4.05, 0, 6.4, 2.7, 2.5, M.green, { metal:true, footprint:true });
    this.addBox(g, 14, 4.05, 0, 6.4, 2.7, 2.5, M.metal, { metal:true, footprint:true });

    /* ============ SANDBAG EMPLACEMENTS ============ */
    for (const [sx,sz] of [[0,8],[0,-6],[-20,-20],[20,-20],[-20,24],[20,24]]) {
      this.addBox(g, sx, 0.45, sz, 3.4, 0.9, 1.0, M.sandbag, { footprint:true });
      this.addBox(g, sx, 0.9, sz + 0.2, 3.2, 0.9, 0.9, M.sandbag, {});
    }

    /* ============ PROPS ============ */
    this.addCrates(g, -22, -8, 3);
    this.addCrates(g, 22, -8, 2);
    this.addBarrels(g, -8, 14, 4, M.barrel);
    this.addBarrels(g, 8, 14, 3, M.barrel);

    /* ============ FENCES (perimeter + inner) ============ */
    this.addFence(g, -44, 0, 88, false, M.metalPost);
    this.addFence(g, 44, 0, 88, false, M.metalPost);
    this.addFence(g, 0, 44, 88, true, M.metalPost);
    this.addFence(g, 0, -44, 88, true, M.metalPost);
    this.addFence(g, -20, 30, 22, true, M.metalPost);
    this.addFence(g, 20, 30, 22, true, M.metalPost);

    /* ============ FLOODLIGHTS ============ */
    const flood = (fx, fz) => {
      this.addCyl(g, fx, 3.5, fz, 0.1, 0.14, 7, M.metalPost, { seg:6, metal:true });
      this.addBox(g, fx, 7.2, fz, 1.2, 0.4, 0.6, M.metal, { metal:true, collide:false });
      this.addLamp(g, fx, 7.0, fz, 0xbcd4ff, 6, 40);
    };
    flood(-20, -14); flood(20, -14); flood(-20, 18); flood(20, 18); flood(0, 30);

    /* ============ SPAWNS ============ */
    const S = (x, z) => this.spawns.push(new THREE.Vector3(x, 0.3, z));
    S(-30,-30); S(30,-30); S(-30,30); S(30,30);
    S(-16,-16); S(16,-16); S(-16,16); S(16,16);
    S(0,-34); S(0,34); S(-34,0); S(34,0);
    S(-24,-2); S(24,-2); S(0,20); S(0,-8);

    this.playerSpawn = new THREE.Vector3(0, 0.4, 38);
    this.playerYaw = 0;                                   // facing into the compound (π faced the blank perimeter wall)
    this.minimap = { cx:0, cz:0, outline:[[-48,-48],[48,-48],[48,48],[-48,48]] };

    /* ============ SKY & LIGHTS (cold night) ============ */
    this.addSky(scene, 0x060a12, 0x121a26, 0x0a0e14);
    this.addStars(scene, 700);
    this.hemi = new THREE.HemisphereLight(0x2a3a50, 0x0a0e12, 0.4);
    scene.add(this.hemi);
    this.sun = this.addSun(scene, 60, 90, -30, 0x9ab4d8, 0.45, 55);
    this.amb = new THREE.AmbientLight(0x141a22, 0.3);
    scene.add(this.amb);
    scene.fog = new THREE.FogExp2(0x070a10, 0.009);
    scene.background = new THREE.Color(0x060a12);
    return g;
  },

  /* ============================================================
     MIRAGE — sunlit desert town: sandstone buildings with
     interiors, market stalls, well, archways, palms. Bright day.
     ============================================================ */
  buildMirage(scene) {
    this.reset();
    const g = new THREE.Group();
    this.worldGroup = g;
    scene.add(g);

    const M = {
      stone:  new THREE.MeshStandardMaterial({ map:MAP_TEX.sandstone, color:0xd8c098, roughness:0.9, metalness:0.05 }),
      stoneD: new THREE.MeshStandardMaterial({ map:MAP_TEX.sandstone, color:0xb89868, roughness:0.9, metalness:0.05 }),
      stucco: new THREE.MeshStandardMaterial({ map:MAP_TEX.stucco, color:0xe0d0b0, roughness:0.85, metalness:0.05 }),
      roof:   new THREE.MeshStandardMaterial({ map:MAP_TEX.sandstone, color:0xa88858, roughness:0.9, metalness:0.05 }),
      floor:  new THREE.MeshStandardMaterial({ map:MAP_TEX.sandstone, color:0xc8b088, roughness:0.9, metalness:0.05 }),
      ground: new THREE.MeshStandardMaterial({ map:MAP_TEX.sand, color:0xd8c8a0, roughness:1.0, metalness:0.0 }),
      path:   new THREE.MeshStandardMaterial({ map:MAP_TEX.sandstone, color:0xc8b890, roughness:0.95, metalness:0.05 }),
      wood:   new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x7a5a3a, roughness:0.9, metalness:0.05 }),
      metalPost: new THREE.MeshStandardMaterial({ color:0x8a7a5a, roughness:0.6, metalness:0.4 }),
      awning1:new THREE.MeshStandardMaterial({ color:0xa03a2a, roughness:0.85, metalness:0.0 }),
      awning2:new THREE.MeshStandardMaterial({ color:0x2a5a7a, roughness:0.85, metalness:0.0 }),
      awning3:new THREE.MeshStandardMaterial({ color:0x7a6a2a, roughness:0.85, metalness:0.0 }),
      glass:  new THREE.MeshStandardMaterial({ color:0x88aacc, roughness:0.1, metalness:0.9,
                transparent:true, opacity:0.4, emissive:0xffe0a0, emissiveIntensity:0.3 }),
      crate:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x8a6a44, roughness:0.95, metalness:0.05 }),
      barrel: new THREE.MeshStandardMaterial({ map:MAP_TEX.rustMetal, color:0x7a5a3a, roughness:0.8, metalness:0.3 }),
      water:  new THREE.MeshStandardMaterial({ color:0x2a6a8a, roughness:0.15, metalness:0.5, transparent:true, opacity:0.85 }),
      tyre:   new THREE.MeshStandardMaterial({ color:0x14161a, roughness:0.9 }),
      palmTrunk: new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x6a4a2a, roughness:0.9 }),
      palmLeaf:  new THREE.MeshStandardMaterial({ color:0x3a6a2a, roughness:0.9, metalness:0.0 }),
    };
    this.M = M;

    /* ============ GROUND (sand) ============ */
    this.addBox(g, 0, -1.0, 0, 96, 2.0, 96, M.ground, { collide:true, cast:false });
    this.addBox(g, 0, 0.02, 0, 92, 0.06, 92, M.ground, { collide:false, cast:false });
    // stone paths
    this.addBox(g, 0, 0.08, 0, 10, 0.16, 84, M.path, { collide:true, cast:false });
    this.addBox(g, 0, 0.08, 0, 84, 0.16, 10, M.path, { collide:true, cast:false });

    /* ============ CENTRAL WELL ============ */
    this.addCyl(g, 0, 0.6, 0, 1.6, 1.8, 1.2, M.stoneD, { seg:12 });
    this.addCyl(g, 0, 0.9, 0, 1.3, 1.3, 0.2, M.water, { seg:12, collide:false });
    this.addBox(g, -1.4, 2.2, 0, 0.2, 2.8, 0.2, M.wood, { collide:false });
    this.addBox(g, 1.4, 2.2, 0, 0.2, 2.8, 0.2, M.wood, { collide:false });
    this.addBox(g, 0, 3.5, 0, 3.2, 0.2, 1.2, M.wood, { collide:false });

    /* ============ BUILDINGS (four around the well) ============ */
    const winMat = M.glass;
    this.addBuilding(g, -26, -22, 20, 20, 2, 4.0,
      { wall:M.stone, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['n','e'], winMat });
    this.addBuilding(g, 26, -22, 20, 20, 2, 4.0,
      { wall:M.stucco, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['n','w'], winMat });
    this.addBuilding(g, -26, 24, 20, 18, 3, 3.8,
      { wall:M.stucco, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['s','e'], winMat });
    this.addBuilding(g, 26, 24, 20, 18, 2, 4.0,
      { wall:M.stone, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['s','w'], winMat });
    // low center strip buildings forming the market cross
    this.addBuilding(g, 0, -26, 22, 14, 1, 4.0,
      { wall:M.stoneD, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['n'], winMat });
    this.addBuilding(g, 0, 28, 22, 12, 2, 3.8,
      { wall:M.stone, floor:M.floor, roof:M.roof, stair:M.stoneD, rail:M.wood },
      { doors:['s'], winMat });

    /* ============ ARCHWAYS (mid streets) ============ */
    const arch = (ax, az, alongX) => {
      const len = alongX ? 0.6 : 6, tall = 5, gap = 4;
      if (alongX) {
        this.addBox(g, ax - 3, tall/2, az, 1.4, tall, 6, M.stoneD, {});
        this.addBox(g, ax + 3, tall/2, az, 1.4, tall, 6, M.stoneD, {});
        this.addBox(g, ax, tall - 0.8, az, 4.6, 1.6, 6, M.stoneD, {});
      } else {
        this.addBox(g, ax, tall/2, az - 3, 6, tall, 1.4, M.stoneD, {});
        this.addBox(g, ax, tall/2, az + 3, 6, tall, 1.4, M.stoneD, {});
        this.addBox(g, ax, tall - 0.8, az, 6, 1.6, 4.6, M.stoneD, {});
      }
    };
    arch(-16, 0, false); arch(16, 0, false);
    arch(0, -16, true); arch(0, 18, true);

    /* ============ MARKET STALLS ============ */
    const stall = (sx, sz, awn) => {
      this.addBox(g, sx, 0.55, sz, 2.8, 1.1, 1.6, M.wood, { footprint:true });  // table
      this.addBox(g, sx - 1.3, 2.0, sz, 0.12, 2.2, 0.12, M.metalPost, { collide:false });
      this.addBox(g, sx + 1.3, 2.0, sz, 0.12, 2.2, 0.12, M.metalPost, { collide:false });
      this.addBox(g, sx, 3.0, sz, 3.0, 0.15, 2.0, awn, { collide:false });     // awning
    };
    stall(-10, 10, M.awning1); stall(10, 10, M.awning2);
    stall(-10, -10, M.awning3); stall(10, -10, M.awning1);
    stall(-14, 4, M.awning2); stall(14, -4, M.awning3);

    /* ============ PALMS ============ */
    const palm = (px, pz) => {
      this.addCyl(g, px, 2.2, pz, 0.2, 0.3, 4.4, M.palmTrunk, { seg:8 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = this.addBox(g, px + Math.cos(a)*1.6, 4.6, pz + Math.sin(a)*1.6,
          2.4, 0.12, 0.6, M.palmLeaf, { collide:false });
        leaf.rotation.y = -a;
        leaf.rotation.z = 0.35;
      }
    };
    palm(-16, 16); palm(16, 16); palm(-16, -18); palm(18, -18);
    palm(-34, 0); palm(34, 2); palm(0, 38); palm(2, -38);

    /* ============ PROPS ============ */
    this.addCrates(g, -18, -8, 3);
    this.addCrates(g, 18, 8, 2);
    this.addCrates(g, -30, 12, 2);
    this.addBarrels(g, 16, 16, 3, M.barrel);
    this.addBarrels(g, -16, -24, 4, M.barrel);

    /* ============ PERIMETER WALL ============ */
    this.addBox(g, -45, 3.5, 0, 1.4, 7, 92, M.stoneD, {});
    this.addBox(g, 45, 3.5, 0, 1.4, 7, 92, M.stoneD, {});
    this.addBox(g, 0, 3.5, -45, 92, 7, 1.4, M.stoneD, {});
    this.addBox(g, 0, 3.5, 45, 92, 7, 1.4, M.stoneD, {});

    /* ============ SPAWNS ============ */
    const S = (x, z) => this.spawns.push(new THREE.Vector3(x, 0.3, z));
    S(-30,-30); S(30,-30); S(-30,30); S(30,30);
    S(-14,-14); S(14,-14); S(-14,14); S(14,14);
    S(0,-20); S(0,20); S(-20,0); S(20,0);
    S(-34,-8); S(34,-8); S(-8,34); S(8,-34);

    this.playerSpawn = new THREE.Vector3(0, 0.4, -16);
    this.playerYaw = 0;
    this.minimap = { cx:0, cz:0, outline:[[-48,-48],[48,-48],[48,48],[-48,48]] };

    /* ============ SKY & LIGHTS (bright day) ============ */
    this.addSky(scene, 0x3a7ac0, 0xc8d8b0, 0xa89868);
    this.addSunDisc(scene, -180, 200, 120, 30, 0xfff4d0);
    this.hemi = new THREE.HemisphereLight(0x88bbee, 0x8a7a5a, 0.6);
    scene.add(this.hemi);
    this.sun = this.addSun(scene, 60, 90, 40, 0xfff2d8, 1.0, 55);
    this.amb = new THREE.AmbientLight(0x6a6250, 0.35);
    scene.add(this.amb);
    scene.fog = new THREE.FogExp2(0xc8bfa0, 0.005);
    scene.background = new THREE.Color(0x3a7ac0);
    return g;
  },

  /* ============================================================
     NUKETOWN — bright suburban test-housing block: two facing
     two-story houses with interiors, stairs and roof access,
     attached garages, a central street with a bus and truck for
     cover, driveways, fenced backyards, sheds, hedges, lawns.
     Compact and symmetric — fast, chaotic, close-quarters.
     ============================================================ */
  buildNuketown(scene) {
    this.reset();
    const g = new THREE.Group();
    this.worldGroup = g;
    scene.add(g);

    const M = {
      grass: new THREE.MeshStandardMaterial({ map:MAP_TEX.grass, color:0x6e9450, roughness:1.0, metalness:0.0 }),
      hedge: new THREE.MeshStandardMaterial({ map:MAP_TEX.grass, color:0x3e6028, roughness:1.0, metalness:0.0 }),
      road:  new THREE.MeshStandardMaterial({ map:MAP_TEX.asphalt, color:0x5c5f64, roughness:0.95, metalness:0.05 }),
      line:  new THREE.MeshStandardMaterial({ color:0xc8a838, roughness:0.8 }),
      walk:  new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x9c9c94, roughness:0.9, metalness:0.05 }),
      drive: new THREE.MeshStandardMaterial({ map:MAP_TEX.concrete, color:0x86867e, roughness:0.95, metalness:0.05 }),
      brickN:new THREE.MeshStandardMaterial({ map:MAP_TEX.brickRed, color:0xb08a72, roughness:0.9, metalness:0.05 }),
      paintS:new THREE.MeshStandardMaterial({ map:MAP_TEX.stucco, color:0xd8c69c, roughness:0.92, metalness:0.0 }),
      trim:  new THREE.MeshStandardMaterial({ color:0xe8e4d8, roughness:0.85, metalness:0.0 }),
      roof:  new THREE.MeshStandardMaterial({ map:MAP_TEX.tilePlaza, color:0x565c64, roughness:0.9, metalness:0.1 }),
      floor: new THREE.MeshStandardMaterial({ map:MAP_TEX.concretePanel, color:0x8a8074, roughness:0.9, metalness:0.05 }),
      wood:  new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x7a6046, roughness:0.95, metalness:0.0 }),
      fenceW:new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x8a6a48, roughness:0.95, metalness:0.0 }),
      fenceP:new THREE.MeshStandardMaterial({ map:MAP_TEX.woodPlank, color:0x5f4830, roughness:0.95, metalness:0.0 }),
      glass: new THREE.MeshStandardMaterial({ color:0x3a4e62, roughness:0.08, metalness:0.9,
                transparent:true, opacity:0.45, emissive:0x2a3a4a, emissiveIntensity:0.35 }),
      metal: new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x70787e, roughness:0.4, metalness:0.8 }),
      busYel:new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0xc89a1c, roughness:0.55, metalness:0.35 }),
      busRoof:new THREE.MeshStandardMaterial({ color:0xa87e14, roughness:0.6, metalness:0.3 }),
      truckR:new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x9a3a30, roughness:0.55, metalness:0.4 }),
      white: new THREE.MeshStandardMaterial({ map:MAP_TEX.corrugated, color:0xd6d6ce, roughness:0.7, metalness:0.2 }),
      red:   new THREE.MeshStandardMaterial({ color:0xa03028, roughness:0.6, metalness:0.2 }),
      tyre:  new THREE.MeshStandardMaterial({ color:0x14161a, roughness:0.9 }),
      car1:  new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x8a2a22, roughness:0.35, metalness:0.6 }),
      car2:  new THREE.MeshStandardMaterial({ map:MAP_TEX.metalPlate, color:0x2a4a68, roughness:0.35, metalness:0.6 }),
      sofa:  new THREE.MeshStandardMaterial({ color:0x46586a, roughness:0.95 }),
    };
    this.M = M;

    /* ============ GROUND: grass base + street + sidewalks ============ */
    this.addBox(g, 0, -1.0, 0, 76, 2.0, 76, M.grass, { collide:true, cast:false });
    this.addBox(g, 0, 0.02, 0, 74, 0.06, 74, M.grass, { collide:false, cast:false });
    this.addBox(g, 0, 0.055, 0, 74, 0.11, 9, M.road, { collide:false, cast:false });       // street
    this.addBox(g, 0, 0.115, 0, 74, 0.02, 0.18, M.line, { collide:false, cast:false });     // center line
    this.addBox(g, 0, 0.075, 6.0, 74, 0.15, 3.0, M.walk, { collide:false, cast:false });    // sidewalks
    this.addBox(g, 0, 0.075, -6.0, 74, 0.15, 3.0, M.walk, { collide:false, cast:false });
    this.addBox(g, -11, 0.07, 10.0, 7.0, 0.14, 10.5, M.drive, { collide:false, cast:false }); // driveways
    this.addBox(g, 11, 0.07, -10.0, 7.0, 0.14, 10.5, M.drive, { collide:false, cast:false });

    /* ============ HOUSES (two facing across the street) ============ */
    const winMat = M.glass;
    const houseMatsN = { wall:M.brickN, floor:M.floor, roof:M.roof, stair:M.trim, rail:M.trim };
    const houseMatsS = { wall:M.paintS, floor:M.floor, roof:M.roof, stair:M.trim, rail:M.trim };
    // north house: front (-z) faces the street, rear door overlooks the backyard spawn
    this.addBuilding(g, 0, 18, 15, 13, 2, 3.4, houseMatsN, { doors:['s','w','n'], stairSide:'w', winMat });
    // south house: front (+z) faces the street, rear door faces the player spawn
    this.addBuilding(g, 0, -18, 15, 13, 2, 3.4, houseMatsS, { doors:['n','e','s'], stairSide:'w', winMat });
    // attached garages (1 floor + roof perch)
    this.addBuilding(g, -11, 19.5, 7, 9, 1, 3.0, houseMatsN, { doors:['s'], winMat });
    this.addBuilding(g, 11, -19.5, 7, 9, 1, 3.0, houseMatsS, { doors:['n'], winMat });

    /* front porches */
    const porch = (pz, dir) => {   // dir: -1 = north house (porch on -z side), +1 = south
      this.addBox(g, 0, 2.95, pz, 5.4, 0.14, 2.4, M.trim, { collide:false });
      this.addBox(g, -2.35, 1.45, pz + dir * 0.5, 0.16, 2.9, 0.16, M.trim, {});
      this.addBox(g, 2.35, 1.45, pz + dir * 0.5, 0.16, 2.9, 0.16, M.trim, {});
      this.addBox(g, 0, 0.11, pz, 5.4, 0.22, 2.4, M.walk, { collide:false, cast:false });  // porch slab
    };
    porch(10.4, -1); porch(-10.4, 1);

    /* ============ INTERIOR FURNITURE (cover on both floors) ============ */
    // north house
    this.addBox(g, 4.6, 0.45, 15.2, 2.2, 0.9, 1.1, M.wood, { footprint:true });      // dining table
    this.addBox(g, -6.2, 0.9, 21.5, 0.9, 1.8, 2.2, M.trim, { footprint:false });     // cabinet
    this.addBox(g, 0.5, 0.35, 23.2, 2.4, 0.7, 1.0, M.sofa, { footprint:false });     // sofa
    this.addBox(g, 4.6, 3.7, 16.8, 2.0, 0.6, 1.6, M.sofa, { footprint:false });      // upstairs bed
    this.addBox(g, -5.9, 4.2, 22.0, 1.0, 1.6, 1.4, M.trim, { footprint:false });     // upstairs wardrobe
    // south house (mirrored)
    this.addBox(g, -4.6, 0.45, -15.2, 2.2, 0.9, 1.1, M.wood, { footprint:true });
    this.addBox(g, 6.2, 0.9, -21.5, 0.9, 1.8, 2.2, M.trim, { footprint:false });
    this.addBox(g, -0.5, 0.35, -23.2, 2.4, 0.7, 1.0, M.sofa, { footprint:false });
    this.addBox(g, -4.6, 3.7, -16.8, 2.0, 0.6, 1.6, M.sofa, { footprint:false });
    this.addBox(g, 5.9, 4.2, -22.0, 1.0, 1.6, 1.4, M.trim, { footprint:false });

    /* ============ STREET VEHICLES (main cover) ============ */
    // bus along the street — hood at each end doubles as a step onto the roof
    const bus = (bx) => {
      this.addBox(g, bx, 0.95, 0, 11.5, 1.9, 2.5, M.busYel, { footprint:true });     // body (top 1.9)
      this.addBox(g, bx, 0.55, 0, 1.5, 1.1, 2.2, M.busYel, { collide:false });      // hood (step)
      this.addBox(g, bx, 2.0, 0, 11.3, 0.14, 2.4, M.busRoof, { collide:false });    // roof cap
      this.addBox(g, bx, 1.55, 1.27, 10.6, 0.7, 0.06, M.glass, { collide:false, cast:false });
      this.addBox(g, bx, 1.55, -1.27, 10.6, 0.7, 0.06, M.glass, { collide:false, cast:false });
      this.addBox(g, bx + 5.72, 1.55, 0, 0.06, 0.7, 2.2, M.glass, { collide:false, cast:false });
      const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
      for (const ox of [-4, 4]) for (const oz of [-1.15, 1.15]) {
        const wm = new THREE.Mesh(wheelGeo, M.tyre);
        wm.rotation.x = Math.PI/2; wm.position.set(bx + ox, 0.42, oz);
        wm.castShadow = true; g.add(wm);
      }
    };
    bus(-5);
    // box truck at the other end
    const truck = (tx, tz) => {
      this.addBox(g, tx, 1.6, tz, 5.4, 3.2, 2.6, M.white, { footprint:true });       // cargo (top 3.2)
      this.addBox(g, tx + 3.8, 1.15, tz, 2.2, 2.3, 2.4, M.truckR, {});              // cab
      this.addBox(g, tx + 4.92, 1.6, tz, 0.06, 0.8, 2.0, M.glass, { collide:false, cast:false });
      const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10);
      for (const ox of [-1.8, 3.6]) for (const oz of [-1.2, 1.2]) {
        const wm = new THREE.Mesh(wheelGeo, M.tyre);
        wm.rotation.x = Math.PI/2; wm.position.set(tx + ox, 0.45, tz + oz);
        wm.castShadow = true; g.add(wm);
      }
    };
    truck(13, 0.6);

    /* junked cars on the side streets */
    this.addCar(g, -22, 0.3, Math.PI/2, M.car1, M.glass);
    this.addCar(g, 24, -0.3, Math.PI/2, M.car2, M.glass);

    /* ============ BACKYARD SHEDS ============ */
    const shed = (sx, sz, doorZDir) => {   // door faces the house
      const w = 4.6, d = 3.6;
      const zw = sz - doorZDir * d/2;                                 // door-side wall z
      this.addBox(g, sx - 1.65, 1.2, zw, 1.3, 2.4, 0.18, M.wood, {});
      this.addBox(g, sx + 1.65, 1.2, zw, 1.3, 2.4, 0.18, M.wood, {});
      this.addBox(g, sx, 2.2, zw, 2.0, 0.4, 0.18, M.wood, {});        // lintel over door gap
      this.addBox(g, sx, 1.2, sz + doorZDir * d/2, w, 2.4, 0.18, M.wood, {});
      this.addBox(g, sx - w/2, 1.2, sz, 0.18, 2.4, d, M.wood, {});
      this.addBox(g, sx + w/2, 1.2, sz, 0.18, 2.4, d, M.wood, {});
      this.addBox(g, sx, 2.55, sz, w + 0.4, 0.3, d + 0.4, M.roof, { footprint:true });
    };
    shed(14, 29, -1);
    shed(-14, -29, 1);

    /* ============ HEDGES, FENCES, TREES ============ */
    // hedges flanking the driveways + along sidewalks
    this.addBox(g, -4.5, 0.55, 8.2, 7.0, 1.1, 0.8, M.hedge, { footprint:false });
    this.addBox(g, 4.5, 0.55, 8.2, 7.0, 1.1, 0.8, M.hedge, { footprint:false });
    this.addBox(g, -4.5, 0.55, -8.2, 7.0, 1.1, 0.8, M.hedge, { footprint:false });
    this.addBox(g, 4.5, 0.55, -8.2, 7.0, 1.1, 0.8, M.hedge, { footprint:false });
    // backyard hedges
    this.addBox(g, -8, 0.6, 27, 0.9, 1.2, 9.0, M.hedge, { footprint:false });
    this.addBox(g, 8, 0.6, -27, 0.9, 1.2, 9.0, M.hedge, { footprint:false });

    // wooden privacy fence helper (solid, no see-through gaps)
    const woodFence = (fx, fz, len, alongX) => {
      const n = Math.max(2, Math.round(len / 4));
      for (let i = 0; i <= n; i++) {
        const off = -len/2 + i * (len / n);
        this.addBox(g, alongX ? fx + off : fx, 1.3, alongX ? fz : fz + off,
                    0.2, 2.6, 0.2, M.fenceP, { cast:false });
      }
      this.addBox(g, fx, 1.15, fz, alongX ? len : 0.12, 2.3, alongX ? 0.12 : len, M.fenceW, { cast:false });
    };
    // perimeter
    woodFence(0, -37, 74, true); woodFence(0, 37, 74, true);
    woodFence(-37, 0, 74, false); woodFence(37, 0, 74, false);
    // backyards split from the side yards (with gate gaps at the ends)
    woodFence(-8.5, 30, 11, false); woodFence(8.5, 30, 11, false);
    woodFence(-8.5, -30, 11, false); woodFence(8.5, -30, 11, false);

    const tree = (tx, tz) => {
      this.addCyl(g, tx, 1.6, tz, 0.18, 0.28, 3.2, M.wood, { seg:8 });
      this.addBox(g, tx, 3.6, tz, 2.6, 1.6, 2.2, M.hedge, { collide:false });
      this.addBox(g, tx + 0.7, 4.4, tz + 0.4, 1.8, 1.2, 1.6, M.hedge, { collide:false });
    };
    tree(-16, 30); tree(17, 31); tree(16, -30); tree(-17, -31);
    tree(-31, 14); tree(31, -14);

    /* ============ STREET PROPS ============ */
    // basketball hoops by the driveways
    const hoop = (hx, hz, dir) => {
      this.addCyl(g, hx, 1.6, hz, 0.07, 0.09, 3.2, M.metal, { seg:8, metal:true });
      this.addBox(g, hx, 3.1, hz + dir * 0.55, 1.2, 0.85, 0.07, M.trim, { collide:false });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 6, 12), M.red);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(hx, 2.82, hz + dir * 0.95);
      rim.castShadow = true; g.add(rim);
    };
    hoop(-11, 7.5, -1); hoop(11, -7.5, 1);

    // mailboxes at the curbs
    const mailbox = (mx, mz, dir) => {
      this.addBox(g, mx, 0.6, mz, 0.12, 1.2, 0.12, M.fenceP, {});
      this.addBox(g, mx, 1.35, mz + dir * 0.12, 0.3, 0.32, 0.5, M.red, { collide:false });
    };
    mailbox(-16, 7.6, -1); mailbox(16, -7.6, 1);

    // planters by the porches
    this.addBox(g, -3.4, 0.35, 9.6, 1.2, 0.7, 0.6, M.wood, { footprint:false });
    this.addBox(g, -3.4, 0.78, 9.6, 1.0, 0.2, 0.45, M.hedge, { collide:false, cast:false });
    this.addBox(g, 3.4, 0.35, -9.6, 1.2, 0.7, 0.6, M.wood, { footprint:false });
    this.addBox(g, 3.4, 0.78, -9.6, 1.0, 0.2, 0.45, M.hedge, { collide:false, cast:false });

    // street lamps
    this.addCyl(g, -24, 2.2, 7.0, 0.08, 0.11, 4.4, M.metal, { seg:8, metal:true });
    this.addCyl(g, 24, 2.2, -7.0, 0.08, 0.11, 4.4, M.metal, { seg:8, metal:true });
    this.addLamp(g, -24, 4.5, 7.0, 0xffd09a, 3, 20);
    this.addLamp(g, 24, 4.5, -7.0, 0xffd09a, 3, 20);
    this.addLamp(g, 0, 2.6, 9.4, 0xffe0b0, 2, 12);    // porch lights
    this.addLamp(g, 0, 2.6, -9.4, 0xffe0b0, 2, 12);

    /* ============ SPAWNS ============ */
    const S = (x, z) => this.spawns.push(new THREE.Vector3(x, 0.3, z));
    S(-12, 31); S(12, 31); S(0, 28);                       // north backyard
    S(-12, -31); S(12, -31); S(0, -28);                    // south backyard
    S(-32, 2); S(32, -2);                                 // street ends
    S(-30, 14); S(30, -14); S(-30, -14); S(30, 14);        // side yards
    S(-18, 6.5); S(18, -6.5);                             // curbs
    S(-11, 13); S(11, -13);                               // driveways

    this.playerSpawn = new THREE.Vector3(0, 0.4, -30);
    this.playerYaw = Math.PI;                              // facing up the street
    this.minimap = { cx:0, cz:0, outline:[[-37,-37],[37,-37],[37,37],[-37,37]] };

    /* ============ SKY & LIGHTS (bright suburb afternoon) ============ */
    this.addSky(scene, 0x3f7ec8, 0xc2dbe8, 0x88a070);
    this.addSunDisc(scene, -150, 190, -90, 24, 0xfff6dc);
    this.hemi = new THREE.HemisphereLight(0x9ec8ff, 0x6a7a55, 0.6);
    scene.add(this.hemi);
    this.sun = this.addSun(scene, 50, 85, 30, 0xfff2d8, 1.05, 45);
    this.amb = new THREE.AmbientLight(0x708060, 0.3);
    scene.add(this.amb);
    scene.fog = new THREE.FogExp2(0xbcd4e6, 0.0035);
    scene.background = new THREE.Color(0x3f7ec8);
    return g;
  },
};

/* =========================================================
   resolveCollision — sweep an AABB (center + half) through a
   list of colliders, pushing it out along the least-penetration
   axis. Handles step-up (stepHeight), ground/ceiling/wall flags.
   Used by the player controller and bot AI.
   ========================================================= */
function resolveCollision(center, half, colliders, stepHeight, moveDir) {
  let grounded = false, ceiling = false, wall = false;
  let stepRise = 0, pushX = 0, pushZ = 0;
  const step = stepHeight || 0.5;
  /* only step up when moving horizontally while falling/resting — never
     during an upward jump (moveDir.y supplied by both call sites) */
  const canStep = !moveDir || moveDir.y === undefined || moveDir.y <= 0.02;

  for (let pass = 0; pass < 3; pass++) {
    for (const c of colliders) {
      /* AABB overlap test (strict: touching does not overlap) */
      if (center.x + half.x <= c.min.x || center.x - half.x >= c.max.x) continue;
      if (center.y + half.y <= c.min.y || center.y - half.y >= c.max.y) continue;
      if (center.z + half.z <= c.min.z || center.z - half.z >= c.max.z) continue;

      /* push-out distances per axis/direction */
      const dx1 = (c.max.x + half.x) - center.x;   // push +x (player on +x side)
      const dx2 = center.x - (c.min.x - half.x);   // push -x (player on -x side)
      const dy1 = (c.max.y + half.y) - center.y;   // push up   → sit on top
      const dy2 = center.y - (c.min.y - half.y);   // push down → duck below
      const dz1 = (c.max.z + half.z) - center.z;   // push +z
      const dz2 = center.z - (c.min.z - half.z);   // push -z
      const px = Math.min(dx1, dx2), py = Math.min(dy1, dy2), pz = Math.min(dz1, dz2);

      const feetY = center.y - half.y;
      const lift = c.max.y - feetY;   // >0 → feet are inside the box, below its top

      /* ---- step up onto low obstacles (curbs, stairs, crates) ---- */
      if (canStep && lift > 0 && lift <= step) {
        const horiz = Math.min(px, pz);
        /* horizontal blocking dominates (or is comparable) → try stepping first */
        if (horiz <= py + lift) {
          let clear = true;                       // headroom check for the lifted box
          const ny0 = feetY + lift, ny1 = ny0 + half.y * 2;
          for (const o of colliders) {
            if (o === c) continue;
            if (center.x + half.x <= o.min.x || center.x - half.x >= o.max.x) continue;
            if (ny1 <= o.min.y || ny0 >= o.max.y) continue;
            if (center.z + half.z <= o.min.z || center.z - half.z >= o.max.z) continue;
            clear = false; break;
          }
          if (clear) {
            center.y += lift;
            grounded = true;
            if (lift > stepRise) stepRise = lift;
            continue;
          }
        }
      }

      /* ---- resolve along the axis of least penetration ---- */
      if (py <= px && py <= pz) {
        if (dy1 <= dy2) { center.y += dy1; grounded = true; }   // standing on top
        else            { center.y -= dy2; ceiling = true; }    // hit head below
      } else if (px <= pz) {
        if (dx1 <= dx2) { center.x += dx1; pushX = dx1; }       // pushed +x
        else            { center.x -= dx2; pushX = -dx2; }      // pushed -x
        wall = true;
      } else {
        if (dz1 <= dz2) { center.z += dz1; pushZ = dz1; }       // pushed +z
        else            { center.z -= dz2; pushZ = -dz2; }      // pushed -z
        wall = true;
      }
    }
  }
  return { grounded, ceiling, wall, stepRise, pushX, pushZ };
}
