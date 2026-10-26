/* =========================================================
   weapons.js — procedural first-person weapon viewmodels
   built from Three.js primitives, with procedural animation:
   recoil kick, sway, bob, ADS, reload, sprint tilt, melee,
   inspect. Fully original low-poly "Black Ops 2 style" guns.
   ========================================================= */

/* ---------- procedural textures (no binary assets) ---------- */
function texCanvas(draw, w=256, h=256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
function noise(ctx, w, h, oct=4, persist=0.5) {
  // simple value-noise-ish fill for grain
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const rnd = () => Math.random() * 255;
  for (let i = 0; i < d.length; i += 4) {
    let n = 0, amp = 1, max = 0, f = 1;
    for (let o = 0; o < oct; o++) {
      n += Math.sin((i/4 + performance.now()*0) * 0.01 * f) * amp;
      max += amp; amp *= persist; f *= 2;
    }
    const v = 128 + (n / max) * 127;
    d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
/* ---------- seamless noise helpers for the camo patterns ---------- */
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* value noise on a WRAPPED lattice — sampling with integer period `p` over
   x,y in [0,p) tiles perfectly, which lets the camo textures UV-scroll. */
function vnoise(x, y, p) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => {
    const n = ((a % p) + p) % p, m = ((b % p) + p) % p;
    let t = (Math.imul(n, 374761393) + Math.imul(m, 668265263)) | 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967295;
  };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, p, oct, gain) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  const g = gain === undefined ? 0.5 : gain;
  for (let i = 0; i < oct; i++) {
    s += amp * vnoise(x * f, y * f, p * f);
    norm += amp; amp *= g; f *= 2;
  }
  return s / norm;
}
/* hard-edged organic blotches, drawn 3x3 so shapes wrap the seam */
function blotch(ctx, w, h, layers) {
  const rnd = mulberry(0x5eed17);
  for (const L of layers) {
    ctx.fillStyle = L.c;
    for (let i = 0; i < L.n; i++) {
      const x = rnd() * w, y = rnd() * h;
      const r = L.r[0] + rnd() * (L.r[1] - L.r[0]);
      const pts = [];
      for (let a = 0; a < 14; a++) {
        const ang = a / 14 * Math.PI * 2;
        const rr = r * (0.42 + 0.95 * rnd());
        pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
      }
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          ctx.beginPath();
          ctx.moveTo(x + ox * w + pts[0][0], y + oy * h + pts[0][1]);
          for (const p of pts) ctx.lineTo(x + ox * w + p[0], y + oy * h + p[1]);
          ctx.closePath(); ctx.fill();
        }
    }
  }
}
/* fine surface grain so flat colours don't look like plastic */
function grain(ctx, w, h, amt) {
  const a = amt === undefined ? 0.08 : amt;
  ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
  for (let i = 0; i < w * 2.2; i++)
    ctx.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1);
}
const TEX = {
  brushedMetal: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#3a4148'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random()*w, 0);
      ctx.lineTo(Math.random()*w, h);
      ctx.stroke();
    }
  }),
  woodGrain: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#6b4a35'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.random()*h);
      ctx.bezierCurveTo(w*0.3, Math.random()*h, w*0.7, Math.random()*h, w, Math.random()*h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, Math.random()*h);
      ctx.lineTo(w, Math.random()*h);
      ctx.stroke();
    }
  }),
  leather: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#3d2a20'; ctx.fillRect(0,0,w,h);
    noise(ctx, w, h, 3, 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 200; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*w, Math.random()*h, 0.5 + Math.random()*1.5, 0, Math.PI*2);
      ctx.fill();
    }
  }),
  carbon: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(80,80,80,0.5)'; ctx.lineWidth = 2;
    const s = 24;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x+s, y+s);
        ctx.moveTo(x+s, y); ctx.lineTo(x, y+s);
        ctx.stroke();
      }
    }
  }),
  cerakote: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#2a2e34'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 80; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1, Math.random()*40+4);
  }),
  parkerized: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#24282c'; ctx.fillRect(0,0,w,h);
    noise(ctx, w, h, 4, 0.5);
    ctx.fillStyle = 'rgba(120,130,140,0.12)';
    for (let i = 0; i < 300; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 1,1);
  }),
  oliveDrab: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#4a5d3a'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(30,40,25,0.35)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*w, Math.random()*h, Math.random()*14+4, 0, Math.PI*2);
      ctx.fill();
    }
  }),
  desertTan: texCanvas((ctx, w, h) => {
    ctx.fillStyle = '#8b7a5a'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(120,100,70,0.3)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(Math.random()*w, Math.random()*h, Math.random()*10+3, 0, Math.PI*2);
      ctx.fill();
    }
  }),
  /* ================= CAMO PATTERNS (512², seamless) ================= */
  camoWoodlandPat: texCanvas((ctx, w, h) => {
    /* M81 woodland — hard-edged four-colour blotches over olive drab */
    ctx.fillStyle = '#3f4a2c'; ctx.fillRect(0, 0, w, h);
    blotch(ctx, w, h, [
      { c:'#6f6a45', n:15, r:[26, 60] },
      { c:'#2b3420', n:19, r:[20, 48] },
      { c:'#585c33', n:21, r:[18, 44] },
      { c:'#141810', n:15, r:[13, 34] },
      { c:'#7d7550', n: 9, r:[ 7, 20] }
    ]);
    grain(ctx, w, h, 0.10);
  }, 512, 512),
  camoDesertPat: texCanvas((ctx, w, h) => {
    /* 3-colour desert — sand base, brown + dark earth blotches */
    ctx.fillStyle = '#b0a184'; ctx.fillRect(0, 0, w, h);
    blotch(ctx, w, h, [
      { c:'#8d7c5c', n:16, r:[24, 56] },
      { c:'#6a5a44', n:14, r:[18, 44] },
      { c:'#c8bb9c', n:18, r:[16, 40] },
      { c:'#4e422f', n: 8, r:[ 8, 22] }
    ]);
    grain(ctx, w, h, 0.07);
  }, 512, 512),
  camoDigitalPat: texCanvas((ctx, w, h) => {
    /* MARPAT-style: 4px pixels whose colour comes from a smooth noise field,
       so the pixels cluster into organic macro shapes instead of TV static */
    const pal = ['#5a5f3c', '#7c7454', '#3a3f27', '#8a8060', '#24281a', '#6a6b45'];
    const p = 4;
    for (let y = 0; y < h; y += p) {
      for (let x = 0; x < w; x += p) {
        const n = fbm(x / w * 6, y / h * 6, 6, 4, 0.55);
        const m = fbm(x / w * 14 + 3.1, y / h * 14 + 7.7, 14, 3, 0.5);
        let idx = Math.floor((n * 0.72 + m * 0.28) * pal.length * 1.4);
        if (idx < 0) idx = 0;
        if (idx >= pal.length) idx = pal.length - 1;
        ctx.fillStyle = pal[idx];
        ctx.fillRect(x, y, p, p);
      }
    }
    grain(ctx, w, h, 0.05);
  }, 512, 512),
  camoGoldPat: texCanvas((ctx, w, h) => {
    /* polished 24k gold — warm gradient body, machining lines, engraved scroll */
    const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
    g.addColorStop(0.00, '#7a5410');
    g.addColorStop(0.22, '#c9942a');
    g.addColorStop(0.45, '#ffe9a8');
    g.addColorStop(0.62, '#e0b23c');
    g.addColorStop(0.82, '#a97a1c');
    g.addColorStop(1.00, '#f2d271');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,240,190,0.10)'; ctx.lineWidth = 1;
    for (let i = 0; i < 240; i++) {                      // brushed machining
      const y = Math.random() * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 4); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {                       // engraved scrollwork
      const y0 = (i + 0.5) / 14 * h;
      ctx.strokeStyle = 'rgba(92,60,4,0.55)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += w / 16)
        ctx.quadraticCurveTo(x + w / 32, y0 + Math.sin(x * 0.055 + i) * 13, x + w / 16, y0);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,215,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y0 + 2.2);
      for (let x = 0; x <= w; x += w / 16)
        ctx.quadraticCurveTo(x + w / 32, y0 + 2.2 + Math.sin(x * 0.055 + i) * 13, x + w / 16, y0 + 2.2);
      ctx.stroke();
    }
    grain(ctx, w, h, 0.04);
  }, 512, 512),
  camoDiamondPat: texCanvas((ctx, w, h) => {
    /* BO2 DIAMOND — bright ice-blue cut gems tiling the whole surface with
       silver bezels, radial facet shading (light from upper-left) and
       glitter sparkle. Diamonds tile the plane exactly, so it stays seamless. */
    ctx.fillStyle = '#0d1a26'; ctx.fillRect(0, 0, w, h);        // dark bezel gaps
    const s = 64, half = s / 2;
    for (let y = -s; y <= h; y += s) {
      for (let x = -s; x <= w; x += s) {
        const cx = x + half, cy = y + half;
        // gem body — radial highlight toward upper-left like a real cut stone
        const g = ctx.createRadialGradient(cx - 15, cy - 17, 4, cx, cy, half * 1.18);
        g.addColorStop(0.00, '#f4feff');
        g.addColorStop(0.28, '#c2ecfd');
        g.addColorStop(0.58, '#6cc2ec');
        g.addColorStop(0.82, '#2f86c0');
        g.addColorStop(1.00, '#185a8a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, y); ctx.lineTo(x + s, cy);
        ctx.lineTo(cx, y + s); ctx.lineTo(x, cy);
        ctx.closePath(); ctx.fill();
        // silver bezel edge
        ctx.strokeStyle = 'rgba(238,250,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        // inner table facet
        const t = half * 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - t); ctx.lineTo(cx + t, cy);
        ctx.lineTo(cx, cy + t); ctx.lineTo(cx - t, cy);
        ctx.closePath(); ctx.stroke();
        // facet spokes from table to the girdle corners
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, y);          ctx.lineTo(cx, cy - t);
        ctx.moveTo(x + s, cy);      ctx.lineTo(cx + t, cy);
        ctx.moveTo(cx, y + s);      ctx.lineTo(cx, cy + t);
        ctx.moveTo(x, cy);          ctx.lineTo(cx - t, cy);
        ctx.stroke();
        // glitter sparkle on a random subset of gems
        const a = Math.random();
        if (a > 0.68) {
          const sx = cx + (Math.random() - 0.5) * half;
          const sy = cy + (Math.random() - 0.5) * half;
          ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + a * 0.4).toFixed(2) + ')';
          ctx.fillRect(sx - 3, sy, 7, 1);
          ctx.fillRect(sx, sy - 3, 1, 7);
        }
      }
    }
    grain(ctx, w, h, 0.04);
  }, 512, 512),
  camoDarkPat: texCanvas((ctx, w, h) => {
    /* BO3 DARK MATTER — a cosmic nebula: deep violet void with hot magenta /
       electric-blue / ember filaments and drifting star dust. Seamless so the
       material can UV-scroll it every frame (the flowing animation). */
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w * 8, v = y / h * 8;
        const wx = fbm(u + 1.7, v + 9.2, 8, 4, 0.5);          // domain warp
        const wy = fbm(u + 8.3, v + 3.1, 8, 4, 0.5);
        const n  = fbm(u + wx * 2.2, v + wy * 2.2, 8, 5, 0.55);
        let ridge = 1 - Math.abs(n * 2 - 1);
        ridge = ridge * ridge * ridge * ridge * ridge;         // thin filaments
        const hueF = fbm(u * 0.7 + 5.5, v * 0.7 + 2.5, 8, 3, 0.5);
        let r, g2, b;
        if (hueF < 0.40)      { r = 255 * ridge; g2 = 40 * ridge; b = 210 * ridge; }  // magenta
        else if (hueF < 0.74) { r =  70 * ridge; g2 = 155 * ridge; b = 255 * ridge; } // electric blue
        else                  { r = 255 * ridge; g2 = 62 * ridge; b = 48 * ridge; }   // ember core
        const base = 12 + 30 * n;
        const i4 = (y * w + x) * 4;
        d[i4]     = Math.min(255, base * 0.85 + r);
        d[i4 + 1] = Math.min(255, base * 0.45 + g2);
        d[i4 + 2] = Math.min(255, base * 1.65 + b);
        d[i4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 300; i++) {                            // star dust
      const a = Math.random();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.22 + a * 0.62).toFixed(3) + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, a > 0.94 ? 2 : 1, a > 0.94 ? 2 : 1);
    }
  }, 512, 512),
};
/* Dark Matter is UV-scrolled, so it must wrap */
TEX.camoDarkPat.wrapS = TEX.camoDarkPat.wrapT = THREE.RepeatWrapping;
TEX.camoDarkPat.needsUpdate = true;
/* colour maps must be sRGB or they wash out */
for (const k of ['camoWoodlandPat','camoDesertPat','camoDigitalPat',
                 'camoGoldPat','camoDiamondPat','camoDarkPat'])
  TEX[k].encoding = THREE.sRGBEncoding;

const MAT = {
  gunmetal: new THREE.MeshStandardMaterial({ color:0x23272a, metalness:0.85, roughness:0.35 }),
  dark:     new THREE.MeshStandardMaterial({ color:0x14171a, metalness:0.7, roughness:0.45 }),
  polymer:  new THREE.MeshStandardMaterial({ color:0x1e2226, metalness:0.10, roughness:0.88 }),
  tan:      new THREE.MeshStandardMaterial({ color:0x6a5a41, metalness:0.25, roughness:0.72 }),
  accent:   new THREE.MeshStandardMaterial({ color:0xd8721c, metalness:0.45, roughness:0.48,
              emissive:0x2a1200, emissiveIntensity:0.6 }),
  grip:     new THREE.MeshStandardMaterial({ color:0x101214, metalness:0.08, roughness:0.95 }),
  scope:    new THREE.MeshStandardMaterial({ color:0x0a1a22, metalness:0.92, roughness:0.08 }),
  skin:     new THREE.MeshStandardMaterial({ color:0xb98b66, metalness:0.0, roughness:0.88 }),
  glove:    new THREE.MeshStandardMaterial({ color:0x1b1e21, metalness:0.08, roughness:0.92 }),
  sight:    new THREE.MeshStandardMaterial({ color:0xff3b1e, emissive:0xff3b1e, emissiveIntensity:2.4 }),
  rdBody:   new THREE.MeshStandardMaterial({ color:0x1a1d20, metalness:0.72, roughness:0.28 }),
  rdLens:   new THREE.MeshStandardMaterial({ color:0xff3b1e, emissive:0xff3b1e, emissiveIntensity:3.2 }),
  acogBody: new THREE.MeshStandardMaterial({ color:0x1a1d20, metalness:0.72, roughness:0.28 }),
  acogLens: new THREE.MeshStandardMaterial({ color:0x0a1a22, metalness:0.9, roughness:0.1 }),
  suppBody: new THREE.MeshStandardMaterial({ color:0x1a1d20, metalness:0.82, roughness:0.18 }),
  suppBaffle: new THREE.MeshStandardMaterial({ color:0x2a2d32, metalness:0.55, roughness:0.58 }),
  extBarrel: new THREE.MeshStandardMaterial({ color:0x23272a, metalness:0.85, roughness:0.35 }),
  chrome:   new THREE.MeshStandardMaterial({ color:0x9aa5ae, metalness:1.0, roughness:0.08 }),
  /* --- gunsmith palette (used by the part kit) --- */
  rail:     new THREE.MeshStandardMaterial({ color:0x1b1e21, metalness:0.90, roughness:0.36 }),
  steel:    new THREE.MeshStandardMaterial({ color:0x6d747a, metalness:1.00, roughness:0.28 }),
  blued:    new THREE.MeshStandardMaterial({ color:0x1c2024, metalness:0.95, roughness:0.30 }),
  rubber:   new THREE.MeshStandardMaterial({ color:0x0e1012, metalness:0.00, roughness:0.96 }),
  glass:    new THREE.MeshStandardMaterial({ color:0x10202c, metalness:0.60, roughness:0.08,
              emissive:0x0a2230, emissiveIntensity:0.55 }),
  fde:      new THREE.MeshStandardMaterial({ color:0x7a6a4f, metalness:0.12, roughness:0.72 }),
  olive:    new THREE.MeshStandardMaterial({ color:0x49513f, metalness:0.10, roughness:0.80 }),
  leather:  new THREE.MeshStandardMaterial({ map: TEX.leather, color:0x3d2a20, metalness:0.02, roughness:0.95 }),
  wood:     new THREE.MeshStandardMaterial({ map: TEX.woodGrain, color:0x6b4a35, metalness:0.02, roughness:0.9 }),
  matBrushed: new THREE.MeshStandardMaterial({ map: TEX.brushedMetal, color:0x3a4148, metalness:0.85, roughness:0.3 }),
  matCarbon: new THREE.MeshStandardMaterial({ map: TEX.carbon, color:0x1a1a1a, metalness:0.35, roughness:0.4 }),
  matCerakote: new THREE.MeshStandardMaterial({ map: TEX.cerakote, color:0x2a2e34, metalness:0.6, roughness:0.4 }),
  matParkerized: new THREE.MeshStandardMaterial({ map: TEX.parkerized, color:0x24282c, metalness:0.75, roughness:0.5 }),
  /* Camo is PAINT on metal — keep it near-dielectric and matte so the pattern
     actually reads. Gold / diamond / dark matter are the prestige finishes:
     those are metallic and need the IBL probe from applyGunEnv(), otherwise a
     metalness≈1 material renders pure black with nothing to reflect. */
  camoWoodland: new THREE.MeshStandardMaterial({ map: TEX.camoWoodlandPat, color:0xffffff, metalness:0.10, roughness:0.66 }),
  camoDesert:   new THREE.MeshStandardMaterial({ map: TEX.camoDesertPat,   color:0xffffff, metalness:0.10, roughness:0.66 }),
  camoDigital:  new THREE.MeshStandardMaterial({ map: TEX.camoDigitalPat,  color:0xffffff, metalness:0.10, roughness:0.66 }),
  camoGold:     new THREE.MeshStandardMaterial({ map: TEX.camoGoldPat,     color:0xffffff, metalness:1.00, roughness:0.22,
               envMapIntensity:1.25, emissive:0x2a1c00, emissiveIntensity:0.25 }),
  camoDiamond:  new THREE.MeshStandardMaterial({ map: TEX.camoDiamondPat,  color:0xffffff, metalness:0.85, roughness:0.12,
               envMapIntensity:1.35, emissive:0x1a5a80, emissiveIntensity:0.38 }),
  /* BO3 DARK MATTER — the nebula is both albedo and emissive glow, and the
     material UV-scrolls it every frame in Viewmodel.update(). */
  camoDarkMatter: new THREE.MeshStandardMaterial({ map: TEX.camoDarkPat, emissiveMap: TEX.camoDarkPat,
               color:0xffffff, emissive:0xffffff, emissiveIntensity:0.85,
               metalness:0.50, roughness:0.34, envMapIntensity:0.9 }),
};

/* camo id (as used by loadouts/menus) -> material. Explicit table because
   ids are all-lowercase ('darkmatter') while MAT keys are camelCase. */
const CAMO_MATS = {
  woodland: MAT.camoWoodland, desert: MAT.camoDesert, digital: MAT.camoDigital,
  gold: MAT.camoGold, diamond: MAT.camoDiamond, darkmatter: MAT.camoDarkMatter
};

/* =========================================================
   Gun IBL probe.
   Barrels, rails and the gold / diamond / dark-matter camos are all
   metalness≈1 — with nothing to reflect they render pure black. So the
   weapon materials get a small procedural sky/ground probe. Scoped to the
   guns only (scene.environment is deliberately NOT set) so the maps keep
   exactly the look they had.
   ========================================================= */
const GUN_ENV_METALS = ['gunmetal','dark','rail','steel','blued','scope','suppBody','suppBaffle',
  'extBarrel','matBrushed','matParkerized','matCerakote','camoGold','camoDiamond','camoDarkMatter'];
let _gunEnvDone = false;
function applyGunEnv(renderer) {
  if (_gunEnvDone || !renderer || typeof THREE.PMREMGenerator !== 'function') return;
  _gunEnvDone = true;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.00, '#4e6a84');    // zenith
  g.addColorStop(0.40, '#66727d');    // sky
  g.addColorStop(0.50, '#3d3b37');    // horizon haze
  g.addColorStop(1.00, '#131211');    // ground
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 128);
  const s = ctx.createRadialGradient(74, 30, 0, 74, 30, 30);   // sun
  s.addColorStop(0, 'rgba(255,255,255,0.85)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(30, 0, 96, 66);
  ctx.fillStyle = 'rgba(24,30,24,0.28)';                      // structure bands
  for (let i = 0; i < 7; i++) ctx.fillRect(0, 62 + i * 6, 256, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  let env = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
  } catch (e) { env = null; }
  tex.dispose();
  if (!env) return;
  for (const k of GUN_ENV_METALS) {
    const m = MAT[k];
    if (!m) continue;
    m.envMap = env;
    if (m.envMapIntensity === undefined) m.envMapIntensity = 0.5;
    m.needsUpdate = true;
  }
}

/* =========================================================
   Gun part kit.
   NOTE: every long part is built along the Z axis with the
   muzzle at -Z.  `wtube()` lays its cylinder onto Z — before
   it existed every barrel / scope / muzzle device / suppressor
   was an UNROTATED cylinder, i.e. a vertical peg floating in
   front of the gun (the "detached parts on the sniper" bug).
   ========================================================= */
function box(w,h,d,mat,x,y,z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x||0, y||0, z||0);
  return m;
}
function cyl(rt,rb,h,mat,x,y,z,seg, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||10), mat);
  m.position.set(x||0, y||0, z||0);
  if (rx) m.rotation.x = rx;
  if (ry) m.rotation.y = ry;
  if (rz) m.rotation.z = rz;
  return m;
}
/* cyl()/box() only build — they do NOT parent. Use these when the mesh
   should be added straight away (bare cyl() calls used to be silently lost). */
function cylIn(grp, rt,rb,h,mat,x,y,z,seg, rx, ry, rz) {
  const m = cyl(rt,rb,h,mat,x,y,z,seg, rx, ry, rz);
  grp.add(m);
  return m;
}
function wbox(grp, w,h,d, mat, x,y,z, camo) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x||0, y||0, z||0);
  if (camo) m.userData.camo = true;
  grp.add(m); return m;
}
function wtube(grp, rt,rb,len, mat, x,y,z, seg, camo) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,len,seg||14), mat);
  m.position.set(x||0, y||0, z||0);
  m.rotation.x = Math.PI / 2;                 // lay the cylinder along Z
  if (camo) m.userData.camo = true;
  grp.add(m); return m;
}
function wsub(grp, x,y,z, rx,ry,rz) {
  const s = new THREE.Group();
  s.position.set(x||0, y||0, z||0);
  if (rx) s.rotation.x = rx;
  if (ry) s.rotation.y = ry;
  if (rz) s.rotation.z = rz;
  grp.add(s); return s;
}
function wring(grp, x,y,z, r, mat) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.0055, 6, 16), mat || MAT.rail);
  m.position.set(x||0, y||0, z||0);
  grp.add(m); return m;
}

/* ---------- composite parts ---------- */

/* picatinny top/side rail: base bar + evenly spaced cross ridges */
function wRail(g, len, x, y, z, w, mat, camo) {
  w = w || 0.030;
  const m = mat || MAT.rail;
  wbox(g, w, 0.007, len, m, x, y, z, camo);
  const n = Math.max(2, Math.round(len / 0.021));
  const step = len / n;
  for (let i = 0; i < n; i++)
    wbox(g, w + 0.005, 0.011, step * 0.42, m, x, y + 0.007, z - len/2 + step * (i + 0.5), camo);
}

/* raked pistol grip with beavertail + finger grooves */
function wGrip(g, x, y, z, h, mat, rake) {
  const s = wsub(g, x, y, z, rake === undefined ? -0.24 : rake);
  const m = mat || MAT.grip;
  wbox(s, 0.041, h, 0.056, m, 0, 0, 0, true);
  for (let i = -1; i <= 1; i++)
    wbox(s, 0.0445, 0.005, 0.010, MAT.rubber, 0, i * h * 0.26, -0.025);
  wbox(s, 0.033, 0.015, 0.044, m, 0, h * 0.47, 0.019, true);      // beavertail
  return s;
}

/* trigger guard + trigger (steel, never camo'd) */
function wTrigger(g, x, y, z, w, h, mat) {
  const s = wsub(g, x, y, z);
  wbox(s, 0.009, h, 0.011, MAT.rail, 0, -h * 0.5, -w * 0.5);
  wbox(s, 0.009, 0.010, w, MAT.rail, 0, -h, 0);
  wbox(s, 0.009, h * 0.55, 0.011, MAT.rail, 0, -h * 0.72, w * 0.5);
  const tr = wbox(s, 0.006, h * 0.6, 0.010, mat || MAT.steel, 0, -h * 0.44, -w * 0.06);
  tr.rotation.x = 0.16;
  return s;
}

/* curved box magazine (3 linked segments + floor plate) */
function wMag(g, x, y, z, w, h, d, mat, curve) {
  const s = wsub(g, x, y, z);
  const segs = 3, sh = h / segs;
  let py = -sh / 2, pz = 0, ang = 0;
  const c = curve === undefined ? -0.09 : curve;
  for (let i = 0; i < segs; i++) {
    const seg = wsub(s, 0, py, pz, ang);
    wbox(seg, w, sh + 0.004, d, mat || MAT.polymer, 0, 0, 0, true);
    ang += c;
    py -= Math.cos(ang) * sh;
    pz -= Math.sin(ang) * sh;
  }
  const fp = wsub(s, 0, py, pz, ang);
  wbox(fp, w + 0.007, 0.013, d + 0.007, MAT.grip, 0, -0.004, 0, true);   // matte floor plate
  return s;
}

/* round drum / box-fed magazine body */
function wDrumMag(g, x, y, z, r, d, mat) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r, d, mat || MAT.polymer, 0, 0, 0, 18, true);
  wtube(s, r * 1.06, r * 0.94, 0.012, MAT.dark, 0, 0, -d * 0.5 - 0.005, 18, true);
  wbox(s, 0.03, 0.05, 0.05, mat || MAT.polymer, 0, r * 0.9, 0.01, true);
  return s;
}

/* ---------- stocks ---------- */
function wStockFixed(g, x, y, z, len, mat) {         // solid rifle stock
  const s = wsub(g, x, y, z);
  const m = mat || MAT.polymer;
  wbox(s, 0.05, 0.07, len, m, 0, 0, 0, true);
  wbox(s, 0.044, 0.055, len * 0.5, m, 0, -0.038, len * 0.18, true);   // toe
  wbox(s, 0.046, 0.018, 0.03, MAT.rubber, 0, -0.005, len * 0.5 + 0.012); // butt pad
  wbox(s, 0.042, 0.014, len * 0.45, MAT.dark, 0, 0.037, -len * 0.12, true); // cheek riser
  return s;
}
function wStockCollapse(g, x, y, z, len, mat) {      // M4-style buffer tube + butt
  const s = wsub(g, x, y, z);
  const m = mat || MAT.polymer;
  wtube(s, 0.017, 0.017, len * 0.62, MAT.rail, 0, 0, -len * 0.14, 14);   // buffer tube
  for (let i = 0; i < 4; i++) wbox(s, 0.012, 0.010, 0.008, MAT.dark, 0, -0.018, -len*0.34 + i * 0.022);
  wbox(s, 0.048, 0.075, len * 0.52, m, 0, -0.004, len * 0.22, true);     // butt body
  wbox(s, 0.043, 0.030, len * 0.34, m, 0, -0.045, len * 0.30, true);     // lower toe
  wbox(s, 0.05, 0.020, 0.028, MAT.rubber, 0, -0.004, len * 0.5);         // butt pad
  wbox(s, 0.040, 0.020, len * 0.22, m, 0, 0.040, len * 0.12, true);      // cheek riser
  return s;
}
function wStockSkeleton(g, x, y, z, len, mat) {      // folding wire/strut stock
  const s = wsub(g, x, y, z);
  const m = mat || MAT.rail;
  for (const sx of [-1, 1]) {
    const arm = wbox(s, 0.010, 0.012, len, m, sx * 0.020, 0.004, len * 0.5);
    arm.rotation.x = -0.05;
    wbox(s, 0.010, 0.030, 0.012, m, sx * 0.020, -0.018, len * 0.92);
  }
  wbox(s, 0.050, 0.052, 0.016, mat || MAT.polymer, 0, -0.008, len * 0.95, true);  // butt plate
  wbox(s, 0.034, 0.014, 0.03, m, 0, 0.030, 0.02);                                  // hinge block
  return s;
}
function wStockSniper(g, x, y, z, len, mat) {        // adjustable chassis stock
  const s = wsub(g, x, y, z);
  const m = mat || MAT.polymer;
  wbox(s, 0.046, 0.062, len * 0.55, m, 0, -0.006, len * 0.24, true);
  wbox(s, 0.040, 0.020, len * 0.40, MAT.dark, 0, -0.040, len * 0.30);          // lower skeleton
  wbox(s, 0.042, 0.020, 0.026, MAT.rubber, 0, -0.008, len * 0.52);             // butt pad
  wbox(s, 0.036, 0.026, len * 0.34, m, 0, 0.040, len * 0.22, true);            // cheek riser
  for (let i = 0; i < 2; i++) wtube(s, 0.007, 0.007, 0.014, MAT.steel, 0.024, 0.010 - i*0.03, len*0.36, 8); // cheek-riser adjusters
  return s;
}

/* ---------- sights ---------- */
function wFrontSight(g, x, y, z, h, hooded) {
  const s = wsub(g, x, y, z);
  wbox(s, 0.024, h, 0.018, MAT.rail, 0, 0, 0);
  wbox(s, 0.006, h * 0.7, 0.007, MAT.steel, 0, h * 0.16, 0);            // post
  const dot = wbox(s, 0.005, 0.005, 0.005, MAT.sight, 0, h * 0.30, 0);  // tritium dot
  dot.material = MAT.sight;
  if (hooded) {
    wbox(s, 0.006, h * 0.9, 0.016, MAT.rail, -0.013, h * 0.1, 0);
    wbox(s, 0.006, h * 0.9, 0.016, MAT.rail,  0.013, h * 0.1, 0);
    wbox(s, 0.030, 0.006, 0.016, MAT.rail, 0, h * 0.52, 0);
  }
  s.traverse(o => { o.userData.sights = true; });   // hidden when an optic fits
  return s;
}
function wRearSight(g, x, y, z) {
  const s = wsub(g, x, y, z);
  wbox(s, 0.030, 0.016, 0.020, MAT.rail, 0, 0, 0);
  wbox(s, 0.006, 0.017, 0.012, MAT.rail, -0.012, 0.014, 0);
  wbox(s, 0.006, 0.017, 0.012, MAT.rail,  0.012, 0.014, 0);
  wtube(s, 0.005, 0.005, 0.012, MAT.dark, 0, 0.014, 0, 10);            // aperture
  s.traverse(o => { o.userData.sights = true; });   // hidden when an optic fits
  return s;
}

/* ---------- optics ---------- */
function wScope(g, x, y, z, len, r, style) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r, len, MAT.blued, 0, 0, 0, 20);                          // main tube
  wtube(s, r * 1.30, r * 1.30, len * 0.24, MAT.blued, 0, 0, -len * 0.40, 20); // objective bell
  wtube(s, r * 1.16, r * 1.16, len * 0.20, MAT.blued, 0, 0,  len * 0.40, 20); // eyepiece
  wtube(s, r * 1.24, r * 1.24, 0.013, MAT.rubber, 0, 0,  len * 0.495, 20);    // eyecup
  wtube(s, r * 1.12, r * 1.12, 0.008, MAT.glass, 0, 0, -len * 0.525, 24);    // objective lens
  wtube(s, r * 0.98, r * 0.98, 0.007, MAT.glass, 0, 0,  len * 0.455, 20);    // ocular lens
  // adjustment turrets (these really are vertical — a Y-aligned cyl is correct)
  cylIn(s, r * 0.50, r * 0.55, 0.026, MAT.rail, 0, r * 1.15, -len * 0.04, 14);
  cylIn(s, r * 0.50, r * 0.55, 0.026, MAT.rail, r * 1.15, 0, -len * 0.04, 14,
        14, 0, 0, Math.PI / 2);
  wtube(s, r * 0.56, r * 0.56, 0.010, MAT.dark, 0, r * 1.27, -len * 0.04, 14);
  // mount rings + base
  if (style !== 'noring') {
    for (const zz of [-len * 0.22, len * 0.20]) {
      wring(s, 0, 0, zz, r, MAT.rail);
      wbox(s, 0.016, 0.024, 0.018, MAT.rail, 0, -r - 0.012, zz);
      wbox(s, 0.026, 0.008, 0.026, MAT.rail, 0, -r - 0.024, zz);
    }
  }
  // tagged so a fitted optic can swap the built-in scope out
  s.traverse(o => { o.userData.scope = true; });
  return s;
}

/* ---------- handguards / barrels ---------- */
function wHandguard(g, x, y, z, len, w, h, mat, camo) {
  const s = wsub(g, x, y, z);
  const m = mat || MAT.polymer;
  wbox(s, w, h, len, m, 0, 0, 0, camo);
  const n = Math.max(2, Math.round(len / 0.048));
  const step = len / n;
  for (let i = 0; i < n; i++) {
    const zz = -len / 2 + step * (i + 0.5);
    wbox(s, w + 0.003, h * 0.30, step * 0.48, MAT.dark, 0, -h * 0.18, zz);   // side rib/vent
    wbox(s, w * 0.55, 0.005, step * 0.42, MAT.dark, 0,  h / 2 - 0.001, zz);  // top vent
  }
  return s;
}
function wBarrel(g, x, y, z, len, r, muzzle, mat) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r * 1.06, len, mat || MAT.blued, 0, 0, -len / 2, 16, true);   // barrel runs to -Z
  if (muzzle === 'brake')   wBrake(s, 0, 0, -len - 0.022, r * 1.7, 0.048);
  else if (muzzle === 'flash') wFlashHider(s, 0, 0, -len - 0.018, r * 1.55, 0.042);
  else if (muzzle === 'crown') wtube(s, r * 1.25, r * 1.25, 0.014, MAT.dark, 0, 0, -len - 0.005, 16);
  return s;
}
function wFlashHider(g, x, y, z, r, len) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r * 0.94, len, MAT.blued, 0, 0, 0, 14);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    const prong = wbox(s, 0.005, r * 1.35, len * 0.62, MAT.dark, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, -len * 0.08);
    prong.rotation.z = a;
  }
  wtube(s, r * 1.14, r * 1.14, 0.009, MAT.rail, 0, 0, len * 0.46, 14);
  return s;
}
function wBrake(g, x, y, z, r, len) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r, len, MAT.blued, 0, 0, 0, 14);
  for (let i = 0; i < 3; i++)
    wbox(s, r * 2.1, r * 0.62, len * 0.15, MAT.dark, 0, 0, -len * 0.28 + i * len * 0.28);
  wtube(s, r * 1.16, r * 1.16, 0.009, MAT.rail, 0, 0, len * 0.46, 14);
  return s;
}
function wSuppressor(g, x, y, z, r, len) {
  const s = wsub(g, x, y, z);
  wtube(s, r, r, len, MAT.suppBody, 0, 0, 0, 18);
  for (let i = 0; i < 4; i++)
    wtube(s, r * 1.05, r * 1.05, 0.006, MAT.suppBaffle, 0, 0, -len * 0.42 + i * len * 0.26, 18);
  wtube(s, r * 1.08, r * 0.9, 0.012, MAT.dark, 0, 0, -len * 0.5, 18);
  return s;
}
function wBipod(g, x, y, z, spread, len) {
  const s = wsub(g, x, y, z);
  wbox(s, 0.034, 0.024, 0.034, MAT.rail, 0, 0, 0);                 // clamp on the barrel
  wbox(s, 0.044, 0.012, 0.022, MAT.rail, 0, 0.015, 0);              // upper bracket
  for (const sx of [-1, 1]) {
    const leg = wsub(s, sx * spread * 0.34, -0.012, 0, 0.10, 0, sx * 0.34);
    cylIn(leg, 0.0085, 0.007, len, MAT.steel, 0, -len * 0.5, 0, 8); // runs straight DOWN
    wbox(leg, 0.015, 0.010, 0.028, MAT.rubber, 0, -len, 0.016);     // foot
  }
  return s;
}
function wChargingHandle(g, x, y, z, side) {
  const s = wsub(g, x, y, z);
  wbox(s, 0.010, 0.014, 0.042, MAT.rail, 0, 0, 0);
  wbox(s, 0.008, 0.010, 0.018, MAT.rail, side * 0.008, 0, 0.014);
  return s;
}
function wSelector(g, x, y, z) {
  const s = wsub(g, x, y, z);
  cylIn(s, 0.008, 0.008, 0.010, MAT.rail, 0, 0, 0, 12, 0, 0, Math.PI / 2);
  const lvl = wbox(s, 0.007, 0.007, 0.022, MAT.steel, 0.006, 0.002, 0.008);
  lvl.rotation.x = -0.5;
  return s;
}
function wEjectionPort(g, x, y, z, w, h) {          // recessed port + dust cover
  const s = wsub(g, x, y, z);
  wbox(s, 0.004, h, w, MAT.dark, 0, 0, 0);
  wbox(s, 0.005, h * 0.55, w * 0.8, MAT.steel, 0.001, -h * 0.1, 0);
  return s;
}

/* ---- build individual guns (barrel along -Z, muzzle at -Z) ----
   Each gun sets g.userData.muzzleZ so the muzzle flash / tracer
   origin follows the model instead of a hardcoded lookup table. */
function buildGunModel(id) {
  const g = new THREE.Group();
  const MZ = (v, boreY) => {
    g.userData.muzzleZ = v;
    if (boreY !== undefined) g.userData.boreY = boreY;   // bore height (pistols sit high)
  };

  switch (id) {
    /* ---------- SMG : PDW-77 ---------- */
    case 'smg': {
      wbox(g, 0.052, 0.058, 0.30, MAT.gunmetal, 0, 0.004, -0.05, true);      // upper receiver
      wbox(g, 0.048, 0.040, 0.22, MAT.gunmetal, 0, -0.030, -0.02, true);     // lower receiver
      wbox(g, 0.050, 0.048, 0.062, MAT.gunmetal, 0, -0.052, -0.030, true);   // magwell
      wEjectionPort(g, 0.027, 0.010, -0.010, 0.055, 0.030);
      wHandguard(g, 0, 0.002, -0.245, 0.155, 0.048, 0.052, MAT.polymer, true);
      wBarrel(g, 0, 0.006, -0.315, 0.145, 0.0095, 'flash');
      wRail(g, 0.30, 0, 0.037, -0.05);
      wFrontSight(g, 0, 0.049, -0.255, 0.022, true);
      wRearSight(g, 0, 0.050, 0.070);
      wGrip(g, 0, -0.076, 0.093, 0.100);
      wTrigger(g, 0, -0.046, 0.043, 0.056, 0.034);
      wMag(g, 0, -0.056, -0.032, 0.042, 0.105, 0.052, MAT.polymer, -0.07);
      wStockSkeleton(g, 0, 0.004, 0.115, 0.155);
      wChargingHandle(g, 0.030, 0.020, 0.070, 1);
      wSelector(g, -0.028, -0.020, 0.030);
      MZ(-0.505);
      break;
    }
    /* ---------- SMG2 : MP7 ---------- */
    case 'smg2': {
      wbox(g, 0.048, 0.052, 0.26, MAT.gunmetal, 0, 0.004, -0.03, true);      // receiver
      wbox(g, 0.045, 0.038, 0.20, MAT.gunmetal, 0, -0.028, -0.01, true);     // lower
      wbox(g, 0.047, 0.042, 0.055, MAT.gunmetal, 0, -0.050, -0.020, true);   // magwell
      wEjectionPort(g, 0.025, 0.008, -0.005, 0.045, 0.026);
      wHandguard(g, 0, 0.002, -0.205, 0.115, 0.044, 0.046, MAT.polymer, true);
      wBarrel(g, 0, 0.006, -0.265, 0.125, 0.0085, 'flash');
      wRail(g, 0.26, 0, 0.033, -0.03);
      wFrontSight(g, 0, 0.045, -0.215, 0.020, true);
      wRearSight(g, 0, 0.046, 0.075);
      wGrip(g, 0, -0.072, 0.088, 0.092);
      wTrigger(g, 0, -0.044, 0.040, 0.052, 0.032);
      wMag(g, 0, -0.054, -0.022, 0.038, 0.100, 0.046, MAT.polymer, -0.06);
      wStockSkeleton(g, 0, 0.006, 0.105, 0.135);
      wChargingHandle(g, 0.026, 0.016, 0.060, 1);
      MZ(-0.425);
      break;
    }
    /* ---------- SMG3 : VECTOR ---------- */
    case 'smg3': {
      wbox(g, 0.050, 0.086, 0.34, MAT.gunmetal, 0, 0.020, -0.07, true);      // tall upper
      wbox(g, 0.047, 0.036, 0.24, MAT.gunmetal, 0, -0.030, -0.04, true);     // lower
      wEjectionPort(g, 0.026, 0.024, -0.030, 0.050, 0.032);
      wHandguard(g, 0, 0.006, -0.290, 0.150, 0.046, 0.050, MAT.polymer, true);
      wBarrel(g, 0, 0.008, -0.360, 0.140, 0.009, 'brake');
      wRail(g, 0.34, 0, 0.066, -0.07);
      wFrontSight(g, 0, 0.078, -0.300, 0.022, true);
      wRearSight(g, 0, 0.078, 0.080);
      wGrip(g, 0, -0.078, 0.086, 0.100);                                    // mag lives in the grip
      wMag(g, 0, -0.090, 0.086, 0.040, 0.115, 0.050, MAT.polymer, -0.05);
      wTrigger(g, 0, -0.048, 0.038, 0.054, 0.034);
      wStockSkeleton(g, 0, 0.010, 0.110, 0.150);
      wChargingHandle(g, 0.028, 0.030, 0.060, 1);
      MZ(-0.545);
      break;
    }
    /* ---------- AR : AN-94 ---------- */
    case 'ar': {
      wbox(g, 0.056, 0.056, 0.34, MAT.gunmetal, 0, 0.006, -0.04, true);      // upper receiver
      wbox(g, 0.052, 0.046, 0.26, MAT.gunmetal, 0, -0.028, -0.02, true);     // lower receiver
      wbox(g, 0.054, 0.050, 0.070, MAT.gunmetal, 0, -0.056, -0.030, true);   // magwell
      wEjectionPort(g, 0.029, 0.010, -0.010, 0.060, 0.032);
      wHandguard(g, 0, 0.004, -0.295, 0.235, 0.052, 0.054, MAT.polymer, true);
      wBarrel(g, 0, 0.008, -0.415, 0.195, 0.0105, 'brake');
      wRail(g, 0.42, 0, 0.039, -0.155);
      wFrontSight(g, 0, 0.052, -0.360, 0.026, true);
      wRearSight(g, 0, 0.052, 0.090);
      wGrip(g, 0, -0.080, 0.095, 0.108);
      wTrigger(g, 0, -0.048, 0.045, 0.058, 0.036);
      wMag(g, 0, -0.060, -0.030, 0.048, 0.130, 0.060, MAT.polymer, -0.10);
      wStockCollapse(g, 0, 0.004, 0.150, 0.175);
      wChargingHandle(g, 0.031, 0.022, 0.090, 1);
      wSelector(g, -0.030, -0.020, 0.030);
      MZ(-0.685);
      break;
    }
    /* ---------- AR2 : M27 IAR ---------- */
    case 'ar2': {
      wbox(g, 0.058, 0.058, 0.36, MAT.gunmetal, 0, 0.006, -0.04, true);
      wbox(g, 0.054, 0.047, 0.27, MAT.gunmetal, 0, -0.028, -0.02, true);
      wbox(g, 0.056, 0.051, 0.070, MAT.gunmetal, 0, -0.057, -0.030, true);
      wEjectionPort(g, 0.030, 0.010, -0.010, 0.062, 0.033);
      wHandguard(g, 0, 0.004, -0.320, 0.275, 0.055, 0.057, MAT.polymer, true);
      wBarrel(g, 0, 0.008, -0.455, 0.190, 0.0105, 'flash');
      wRail(g, 0.46, 0, 0.040, -0.175);
      wFrontSight(g, 0, 0.053, -0.390, 0.026, true);
      wRearSight(g, 0, 0.053, 0.100);
      wGrip(g, 0, -0.081, 0.098, 0.108);
      wTrigger(g, 0, -0.049, 0.046, 0.058, 0.036);
      wMag(g, 0, -0.061, -0.030, 0.048, 0.130, 0.060, MAT.polymer, -0.10);
      wStockCollapse(g, 0, 0.004, 0.158, 0.178);
      wChargingHandle(g, 0.032, 0.022, 0.096, 1);
      wSelector(g, -0.031, -0.020, 0.030);
      MZ(-0.720);
      break;
    }
    /* ---------- LMG : LSAT ---------- */
    case 'lmg': {
      wbox(g, 0.070, 0.070, 0.40, MAT.gunmetal, 0, 0.006, -0.02, true);      // receiver
      wbox(g, 0.062, 0.050, 0.30, MAT.gunmetal, 0, -0.032, -0.02, true);     // lower
      wbox(g, 0.058, 0.030, 0.30, MAT.gunmetal, 0, 0.045, -0.04, true);      // top cover
      wEjectionPort(g, 0.036, 0.012, 0.000, 0.060, 0.034);
      wHandguard(g, 0, 0.004, -0.320, 0.220, 0.058, 0.062, MAT.polymer, true);
      wBarrel(g, 0, 0.008, -0.430, 0.240, 0.0125, 'brake');
      wRail(g, 0.40, 0, 0.063, -0.140);
      wFrontSight(g, 0, 0.076, -0.400, 0.026, true);
      wRearSight(g, 0, 0.076, 0.110);
      wGrip(g, 0, -0.084, 0.115, 0.110);
      wTrigger(g, 0, -0.052, 0.062, 0.060, 0.038);
      wbox(g, 0.115, 0.115, 0.130, MAT.polymer, 0, -0.098, -0.060, true);    // box mag
      wbox(g, 0.121, 0.014, 0.136, MAT.dark, 0, -0.152, -0.060, true);
      wStockFixed(g, 0, 0.006, 0.215, 0.190);
      wBipod(g, 0, -0.034, -0.380, 0.070, 0.090);
      MZ(-0.760);
      break;
    }
    /* ---------- LMG2 : HAMR ---------- */
    case 'lmg2': {
      wbox(g, 0.072, 0.072, 0.42, MAT.gunmetal, 0, 0.006, -0.02, true);
      wbox(g, 0.064, 0.052, 0.31, MAT.gunmetal, 0, -0.033, -0.02, true);
      wEjectionPort(g, 0.037, 0.012, 0.000, 0.062, 0.034);
      wHandguard(g, 0, 0.004, -0.330, 0.230, 0.060, 0.064, MAT.polymer, true);
      wBarrel(g, 0, 0.008, -0.445, 0.255, 0.013, 'brake');
      wRail(g, 0.42, 0, 0.041, -0.150);
      wFrontSight(g, 0, 0.054, -0.410, 0.026, true);
      wRearSight(g, 0, 0.054, 0.120);
      wGrip(g, 0, -0.086, 0.120, 0.112);
      wTrigger(g, 0, -0.054, 0.066, 0.060, 0.038);
      wDrumMag(g, 0, -0.100, -0.070, 0.062, 0.062, MAT.polymer);
      wStockFixed(g, 0, 0.006, 0.225, 0.190);
      wBipod(g, 0, -0.035, -0.395, 0.070, 0.090);
      MZ(-0.790);
      break;
    }
    /* ---------- SNIPER : DSR-50 ---------- */
    case 'sniper': {
      wbox(g, 0.052, 0.062, 0.42, MAT.gunmetal, 0, 0.002, -0.02, true);      // receiver
      wbox(g, 0.046, 0.040, 0.30, MAT.gunmetal, 0, -0.030, -0.04, true);     // chassis underside
      wEjectionPort(g, 0.027, 0.010, 0.010, 0.060, 0.034);
      wBarrel(g, 0, 0.010, -0.230, 0.300, 0.0135, 'brake');                  // long heavy barrel
      wbox(g, 0.044, 0.052, 0.120, MAT.gunmetal, 0, -0.014, -0.230, true);   // forend/balance weight
      wRail(g, 0.44, 0, 0.036, -0.030);
      wScope(g, 0, 0.098, -0.020, 0.300, 0.024);                             // big optic
      wGrip(g, 0, -0.082, 0.115, 0.108);
      wTrigger(g, 0, -0.050, 0.062, 0.058, 0.036);
      wMag(g, 0, -0.058, -0.060, 0.046, 0.100, 0.062, MAT.polymer, -0.06);
      const boltH = wsub(g, 0.036, -0.006, 0.055, 0, 0, 0);                  // bolt handle
      wbox(boltH, 0.030, 0.014, 0.016, MAT.steel, 0, 0, 0);
      cylIn(boltH, 0.011, 0.011, 0.022, MAT.steel, 0.014, -0.020, 0, 10, 0, 0, Math.PI / 2);
      wStockSniper(g, 0, 0.002, 0.205, 0.200);
      wBipod(g, 0, -0.040, -0.265, 0.075, 0.095);
      MZ(-0.610);
      break;
    }
    /* ---------- SNIPER2 : BARRETT ---------- */
    case 'sniper2': {
      wbox(g, 0.060, 0.072, 0.46, MAT.gunmetal, 0, 0.004, -0.02, true);      // heavy receiver
      wbox(g, 0.054, 0.046, 0.34, MAT.gunmetal, 0, -0.036, -0.04, true);
      wEjectionPort(g, 0.032, 0.012, 0.010, 0.070, 0.040);
      wBarrel(g, 0, 0.012, -0.250, 0.330, 0.0155, 'brake');
      wbox(g, 0.050, 0.060, 0.150, MAT.gunmetal, 0, -0.016, -0.250, true);   // forend
      wBrake(g, 0, 0.012, -0.640, 0.030, 0.075);                             // huge arrow brake
      wRail(g, 0.46, 0, 0.041, -0.030);
      wScope(g, 0, 0.108, -0.030, 0.320, 0.026);
      wGrip(g, 0, -0.088, 0.128, 0.112);
      wTrigger(g, 0, -0.055, 0.070, 0.060, 0.038);
      wbox(g, 0.048, 0.110, 0.120, MAT.polymer, 0, -0.070, -0.060, true);    // box mag
      wbox(g, 0.053, 0.012, 0.126, MAT.dark, 0, -0.124, -0.060, true);
      wStockSniper(g, 0, 0.004, 0.230, 0.200);
      wBipod(g, 0, -0.044, -0.295, 0.080, 0.100);
      MZ(-0.715);
      break;
    }
    /* ---------- SHOTGUN : M1216 ---------- */
    case 'shotgun': {
      wbox(g, 0.062, 0.066, 0.32, MAT.gunmetal, 0, 0.004, -0.03, true);      // receiver
      wbox(g, 0.056, 0.046, 0.24, MAT.gunmetal, 0, -0.030, -0.02, true);
      wEjectionPort(g, 0.032, 0.010, -0.005, 0.055, 0.032);
      wHandguard(g, 0, 0.006, -0.270, 0.180, 0.052, 0.056, MAT.polymer, true);
      wtube(g, 0.019, 0.019, 0.360, MAT.blued, 0, -0.030, -0.310, 16, true); // mag tube under barrel
      wBarrel(g, 0, 0.012, -0.290, 0.300, 0.0135, 'crown');
      wbox(g, 0.028, 0.024, 0.020, MAT.rail, 0, -0.030, -0.470);             // tube cap
      wRail(g, 0.30, 0, 0.041, -0.110);
      wFrontSight(g, 0, 0.054, -0.390, 0.024, true);
      wRearSight(g, 0, 0.054, 0.090);
      wGrip(g, 0, -0.080, 0.100, 0.108);
      wTrigger(g, 0, -0.048, 0.048, 0.058, 0.036);
      wStockFixed(g, 0, 0.004, 0.170, 0.180);
      MZ(-0.610);
      break;
    }
    /* ---------- SHOTGUN2 : KSG (bullpup) ---------- */
    case 'shotgun2': {
      wbox(g, 0.064, 0.072, 0.46, MAT.gunmetal, 0, 0.004, 0.00, true);       // long receiver
      wbox(g, 0.058, 0.050, 0.34, MAT.gunmetal, 0, -0.032, -0.02, true);
      wEjectionPort(g, 0.033, 0.010, -0.060, 0.050, 0.030);
      wHandguard(g, 0, 0.006, -0.290, 0.240, 0.056, 0.060, MAT.polymer, true);
      wBarrel(g, 0, 0.010, -0.300, 0.310, 0.0145, 'crown');
      wRail(g, 0.40, 0, 0.043, -0.180);
      wFrontSight(g, 0, 0.056, -0.400, 0.024, true);
      wRearSight(g, 0, 0.056, 0.090);
      wGrip(g, 0, -0.078, 0.075, 0.106);                                     // grip forward of mag
      wTrigger(g, 0, -0.046, 0.028, 0.056, 0.035);
      wbox(g, 0.052, 0.115, 0.130, MAT.polymer, 0, -0.078, 0.145, true);     // bullpup mag (rear)
      wbox(g, 0.057, 0.012, 0.136, MAT.dark, 0, -0.132, 0.145, true);
      wStockFixed(g, 0, 0.004, 0.235, 0.150);
      MZ(-0.630);
      break;
    }
    /* ---------- SHOTGUN3 : M1014 ---------- */
    case 'shotgun3': {
      wbox(g, 0.060, 0.064, 0.30, MAT.gunmetal, 0, 0.004, -0.02, true);
      wbox(g, 0.054, 0.045, 0.22, MAT.gunmetal, 0, -0.029, -0.01, true);
      wEjectionPort(g, 0.031, 0.010, -0.005, 0.052, 0.031);
      wHandguard(g, 0, 0.006, -0.250, 0.170, 0.050, 0.054, MAT.polymer, true);
      wtube(g, 0.017, 0.017, 0.320, MAT.blued, 0, -0.028, -0.285, 16, true);
      wBarrel(g, 0, 0.011, -0.265, 0.270, 0.0125, 'crown');
      wbox(g, 0.026, 0.022, 0.018, MAT.rail, 0, -0.028, -0.435);
      wRail(g, 0.28, 0, 0.040, -0.100);
      wFrontSight(g, 0, 0.052, -0.350, 0.023, true);
      wRearSight(g, 0, 0.052, 0.085);
      wGrip(g, 0, -0.079, 0.098, 0.106);
      wTrigger(g, 0, -0.047, 0.046, 0.056, 0.035);
      wStockFixed(g, 0, 0.004, 0.165, 0.175);
      MZ(-0.575);
      break;
    }
    /* ---------- MARKSMAN : SVU-AS (bullpup DMR) ---------- */
    case 'marksman': {
      wbox(g, 0.052, 0.062, 0.44, MAT.gunmetal, 0, 0.004, 0.00, true);       // long receiver
      wbox(g, 0.046, 0.042, 0.32, MAT.gunmetal, 0, -0.030, -0.02, true);
      wEjectionPort(g, 0.027, 0.010, -0.070, 0.050, 0.030);
      wHandguard(g, 0, 0.006, -0.250, 0.170, 0.048, 0.052, MAT.polymer, true);
      wBarrel(g, 0, 0.010, -0.270, 0.240, 0.0115, 'brake');
      wRail(g, 0.40, 0, 0.037, -0.120);
      wScope(g, 0, 0.092, -0.110, 0.260, 0.021);
      wGrip(g, 0, -0.078, 0.070, 0.104);
      wTrigger(g, 0, -0.046, 0.024, 0.054, 0.034);
      wbox(g, 0.046, 0.100, 0.110, MAT.polymer, 0, -0.070, 0.150, true);     // bullpup mag
      wbox(g, 0.051, 0.012, 0.116, MAT.dark, 0, -0.118, 0.150, true);
      wStockFixed(g, 0, 0.004, 0.225, 0.140);
      MZ(-0.545);
      break;
    }
    /* ---------- PISTOL : FIVE-SEVEN ---------- */
    case 'pistol': {
      wbox(g, 0.026, 0.038, 0.200, MAT.gunmetal, 0, 0.026, -0.060, true);    // slide
      wbox(g, 0.024, 0.012, 0.150, MAT.dark, 0, 0.046, -0.070, true);        // slide serrations / top
      for (let i = 0; i < 5; i++) wbox(g, 0.028, 0.026, 0.005, MAT.dark, 0, 0.026, 0.010 - i * 0.014);
      wbox(g, 0.025, 0.030, 0.150, MAT.polymer, 0, -0.002, -0.050, true);    // frame
      wtube(g, 0.0075, 0.0075, 0.030, MAT.blued, 0, 0.026, -0.150, 12);      // barrel hood
      wGrip(g, 0, -0.062, 0.040, 0.098, MAT.polymer, -0.28);
      wTrigger(g, 0, -0.026, -0.010, 0.048, 0.030);
      wFrontSight(g, 0, 0.050, -0.145, 0.012, false);
      wbox(g, 0.020, 0.012, 0.012, MAT.rail, 0, 0.052, 0.010);              // rear notch
      wbox(g, 0.026, 0.010, 0.030, MAT.rail, 0, -0.012, 0.052);             // beavertail
      MZ(-0.175, 0.026);
      break;
    }
    /* ---------- PISTOL2 : G18 ---------- */
    case 'pistol2': {
      wbox(g, 0.027, 0.040, 0.215, MAT.gunmetal, 0, 0.026, -0.065, true);
      wbox(g, 0.025, 0.012, 0.160, MAT.dark, 0, 0.048, -0.075, true);
      for (let i = 0; i < 6; i++) wbox(g, 0.029, 0.028, 0.005, MAT.dark, 0, 0.026, 0.014 - i * 0.014);
      wbox(g, 0.026, 0.032, 0.160, MAT.polymer, 0, -0.002, -0.055, true);
      wtube(g, 0.008, 0.008, 0.030, MAT.blued, 0, 0.026, -0.158, 12);
      wGrip(g, 0, -0.064, 0.044, 0.100, MAT.polymer, -0.26);
      wTrigger(g, 0, -0.026, -0.008, 0.048, 0.030);
      wFrontSight(g, 0, 0.052, -0.152, 0.013, false);
      wbox(g, 0.021, 0.012, 0.012, MAT.rail, 0, 0.054, 0.012);
      wbox(g, 0.027, 0.010, 0.030, MAT.rail, 0, -0.012, 0.056);
      MZ(-0.182, 0.026);
      break;
    }
    /* ---------- REVOLVER : TITAN ---------- */
    case 'revolver': {
      wbox(g, 0.030, 0.050, 0.170, MAT.gunmetal, 0, 0.010, -0.020, true);    // frame
      const cylGrp = wsub(g, 0, 0.006, -0.020);
      wtube(cylGrp, 0.026, 0.026, 0.052, MAT.blued, 0, 0, 0, 16, true);      // cylinder
      for (let i = 0; i < 6; i++) {                                          // chamber flutes
        const a = i / 6 * Math.PI * 2;
        wtube(cylGrp, 0.0055, 0.0055, 0.054, MAT.dark, Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0, 8);
      }
      wtube(g, 0.011, 0.011, 0.170, MAT.blued, 0, 0.008, -0.140, 14);        // barrel
      wtube(g, 0.014, 0.014, 0.016, MAT.dark, 0, 0.008, -0.222, 14);         // crown
      wbox(g, 0.016, 0.014, 0.030, MAT.rail, 0, 0.024, -0.200);              // front sight ramp
      wbox(g, 0.006, 0.010, 0.014, MAT.steel, 0, 0.034, -0.208);
      const ham = wbox(g, 0.014, 0.030, 0.018, MAT.rail, 0, 0.040, 0.060);   // hammer
      ham.rotation.x = -0.3;
      wGrip(g, 0, -0.062, 0.052, 0.105, MAT.wood, -0.34);
      wTrigger(g, 0, -0.024, 0.006, 0.046, 0.030);
      MZ(-0.230);
      break;
    }
    /* ---------- LAUNCHER : SMAW ---------- */
    case 'launcher': {
      wtube(g, 0.036, 0.036, 0.560, MAT.dark, 0, 0.020, -0.150, 18, true);   // main tube
      wtube(g, 0.044, 0.044, 0.050, MAT.gunmetal, 0, 0.020, -0.430, 18, true); // muzzle bell
      wtube(g, 0.040, 0.040, 0.014, MAT.rail, 0, 0.020, -0.400, 18);
      wtube(g, 0.042, 0.042, 0.070, MAT.gunmetal, 0, 0.020, 0.150, 18, true);  // rear venturi
      wtube(g, 0.034, 0.034, 0.030, MAT.dark, 0, 0.020, 0.200, 18);
      wbox(g, 0.040, 0.048, 0.120, MAT.polymer, 0, -0.010, -0.120, true);    // top furniture
      wGrip(g, 0, -0.068, 0.020, 0.098);
      wTrigger(g, 0, -0.036, -0.020, 0.050, 0.032);
      wbox(g, 0.034, 0.030, 0.070, MAT.polymer, 0, -0.020, 0.120, true);     // shoulder rest
      wbox(g, 0.026, 0.036, 0.040, MAT.rail, 0, 0.070, -0.060);              // sight housing
      wtube(g, 0.012, 0.012, 0.020, MAT.glass, 0, 0.070, -0.078, 12);
      wRail(g, 0.16, 0, 0.048, -0.150);
      MZ(-0.455, 0.020);
      break;
    }
    /* ---------- KNIFE ---------- */
    case 'knife': {
      const steel = new THREE.MeshStandardMaterial({ color:0x9aa3aa, metalness:0.98, roughness:0.18 });
      const bladeGeo = new THREE.BoxGeometry(0.014, 0.06, 0.26);
      const pos = bladeGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const t = (0.13 - z) / 0.26;
        pos.setX(i, pos.getX(i) * (1 - t * 0.75));
        pos.setY(i, pos.getY(i) * (1 - t * 0.55));
      }
      bladeGeo.computeVertexNormals();
      const blade = new THREE.Mesh(bladeGeo, steel);
      blade.position.set(0, 0.025, -0.13);
      g.add(blade);
      g.add(box(0.005, 0.018, 0.24, steel, 0.006, 0.038, -0.14));
      g.add(box(0.005, 0.018, 0.22, steel, -0.006, 0.018, -0.13));
      g.add(box(0.055, 0.025, 0.035, MAT.dark, 0, 0.04, 0.0));               // guard
      g.add(box(0.055, 0.025, 0.035, MAT.dark, 0, 0.005, 0.0));
      g.add(box(0.036, 0.052, 0.10, MAT.grip, 0, -0.015, 0.055));            // handle
      g.add(box(0.038, 0.054, 0.03, MAT.dark, 0, -0.017, 0.088));
      g.add(box(0.038, 0.054, 0.03, MAT.dark, 0, -0.017, 0.028));
      g.add(box(0.04, 0.056, 0.05, MAT.dark, 0, -0.015, 0.13));              // pommel
      g.add(box(0.006, 0.006, 0.012, MAT.steel, 0.017, -0.017, 0.09));
      g.add(box(0.006, 0.006, 0.012, MAT.steel, -0.017, -0.017, 0.09));
      MZ(-0.320);
      break;
    }
    default: {
      wbox(g, 0.05, 0.06, 0.30, MAT.gunmetal, 0, 0, -0.05, true);
      MZ(-0.45);
    }
  }
  if (!g.userData.muzzleZ) g.userData.muzzleZ = -0.60;
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}

/* ========================================================= */
const Viewmodel = {
  camera:null, root:null, gun:null, arms:null,
  weaponId:null, camo:null,
  adsLerp:0, recoil:0, recoilVel:0, kickPitch:0, kickYaw:0,
  swayX:0, swayY:0, bobT:0, reloadT:-1, reloadDur:1,
  sprintLerp:0, meleeT:-1, inspectT:-1, fireFlash:0,

  init(camera) {
    if (this.root && this.camera === camera) { this.weaponId = null; return; }
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.renderOrder = 10;
    camera.add(this.root);

    // arms (always visible, hold the gun)
    this.arms = new THREE.Group();
    const forearmR = box(0.07,0.07,0.30, MAT.glove, 0.09,-0.16,0.16);
    forearmR.rotation.x = 0.25; forearmR.rotation.y = -0.18;
    const handR = box(0.075,0.09,0.09, MAT.glove, 0.055,-0.12,0.02);
    const forearmL = box(0.07,0.07,0.28, MAT.glove, -0.14,-0.17,0.20);
    forearmL.rotation.x = 0.3; forearmL.rotation.y = 0.45;
    const handL = box(0.075,0.09,0.09, MAT.glove, -0.04,-0.13,-0.10);
    const sleeveR = box(0.085,0.085,0.16, MAT.tan, 0.11,-0.175,0.28);
    const sleeveL = box(0.085,0.085,0.16, MAT.tan, -0.16,-0.185,0.31);
    this.arms.add(forearmR, handR, forearmL, handL, sleeveR, sleeveL);
    this.root.add(this.arms);
    this.hands = { handR, handL };

    this.setWeapon('smg');
  },

  setWeapon(id, att, camo) {
    if (this.weaponId === id && !att && !camo) return;
    if (this.gun) this.root.remove(this.gun);
    this.weaponId = id;
    this.camo = camo || 'default';
    this.gun = buildGunModel(id);
    // apply camo to the parts tagged camo-eligible (receiver, handguard,
    // stock, mag, grip panels…) — never to glass, steel or sight inserts
    const camoMat = CAMO_MATS[this.camo] || null;
    if (camoMat) {
      this.gun.traverse(o => {
        if (!o.isMesh) return;
        if (o.userData.camo || o.material === MAT.gunmetal || o.material === MAT.polymer ||
            o.material === MAT.dark || o.material === MAT.accent) {
          o.material = camoMat;
        }
      });
    }
    this.root.add(this.gun);
    this.adsLerp = 0; this.reloadT = -1; this.meleeT = -1; this.inspectT = -1;
    this.recoil = 0; this.recoilVel = 0;
    // muzzle reference object — each model stores its own muzzle depth
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.01,
      (this.gun.userData && this.gun.userData.muzzleZ !== undefined)
        ? this.gun.userData.muzzleZ : -0.60);
    this.gun.add(this.muzzle);

    /* ---------- attachment visuals ---------- */
    att = att || { optic:'none', barrel:'none' };
    this._addAttachment('optic', att.optic);
    this._addAttachment('barrel', att.barrel, camoMat);   // barrel wears the camo
  },

  _addAttachment(cat, id, camoMat) {
    if (!id || id === 'none') return;
    const g = new THREE.Group();
    /* Each model knows its own muzzle depth / bore height, so attachments
       clamp onto the real barrel instead of floating at a fixed offset. */
    const ud = this.gun.userData || {};
    const mz = ud.muzzleZ !== undefined ? ud.muzzleZ : -0.60;
    const by = ud.boreY !== undefined ? ud.boreY : 0.008;

    if (cat === 'optic') {
      /* OPTICS sit on the top-rail band every model shares; fitting one also
         swaps out the gun's own scope and iron sights (like real COD). */
      const clamp = (z, len) => {
        wbox(g, 0.030, 0.054, len, MAT.rail, 0, 0.050, z);
        wbox(g, 0.038, 0.010, len + 0.008, MAT.rail, 0, 0.026, z);
      };
      if (id === 'reddot') {
        clamp(-0.045, 0.050);
        wbox(g, 0.030, 0.036, 0.062, MAT.rdBody, 0, 0.094, -0.045);          // housing
        wtube(g, 0.017, 0.017, 0.012, MAT.rdBody, 0, 0.094, -0.072, 16);     // lens ring
        wtube(g, 0.0145, 0.0145, 0.004, MAT.rdLens, 0, 0.094, -0.075, 20);   // lens
        cylIn(g, 0.008, 0.008, 0.010, MAT.rail, 0.019, 0.094, -0.030, 10, 0, 0, Math.PI / 2);
      } else if (id === 'reflex') {
        clamp(-0.035, 0.045);
        wbox(g, 0.034, 0.010, 0.056, MAT.rdBody, 0, 0.076, -0.035);          // base
        wbox(g, 0.030, 0.032, 0.008, MAT.rdBody, 0, 0.098, -0.062);          // front frame
        wbox(g, 0.006, 0.032, 0.050, MAT.rdBody, -0.014, 0.098, -0.038);     // left frame
        wbox(g, 0.006, 0.032, 0.050, MAT.rdBody,  0.014, 0.098, -0.038);     // right frame
        wtube(g, 0.015, 0.015, 0.003, MAT.rdLens, 0, 0.098, -0.060, 20);     // glass
      } else if (id === 'acog') {
        clamp(-0.09, 0.070);
        wtube(g, 0.021, 0.021, 0.170, MAT.acogBody, 0, 0.094, -0.09, 18);    // tube
        wtube(g, 0.026, 0.026, 0.030, MAT.acogBody, 0, 0.094, -0.175, 18);   // objective bell
        wtube(g, 0.023, 0.023, 0.006, MAT.acogLens, 0, 0.094, -0.188, 20);   // lens
        wtube(g, 0.020, 0.020, 0.016, MAT.rubber, 0, 0.094, -0.004, 18);     // eyepiece
        cylIn(g, 0.010, 0.010, 0.016, MAT.acogBody, 0, 0.116, -0.09, 12);    // elevation turret
      } else if (id === 'variable_zoom') {
        clamp(-0.10, 0.080);
        wtube(g, 0.024, 0.024, 0.260, MAT.acogBody, 0, 0.098, -0.10, 20);
        wtube(g, 0.029, 0.029, 0.038, MAT.acogBody, 0, 0.098, -0.235, 20);
        wtube(g, 0.026, 0.026, 0.006, MAT.acogLens, 0, 0.098, -0.252, 22);
        wtube(g, 0.026, 0.026, 0.030, MAT.acogBody, 0, 0.098, 0.020, 20);
        wtube(g, 0.023, 0.023, 0.006, MAT.acogLens, 0, 0.098, 0.034, 20);
        wring(g, 0, 0.098, -0.02, 0.025, MAT.rail);
        wring(g, 0, 0.098, -0.18, 0.025, MAT.rail);
      }
      this.gun.traverse(o => {
        if (o.userData && (o.userData.scope || o.userData.sights)) o.visible = false;
      });
    } else if (cat === 'barrel') {
      /* BARREL ATTACHMENTS are built on the model's real muzzle position */
      if (id === 'suppressor') {
        wtube(g, 0.021, 0.021, 0.190, MAT.suppBody, 0, by, mz - 0.098, 18);
        for (let i = 0; i < 4; i++)
          wtube(g, 0.0225, 0.0225, 0.006, MAT.suppBaffle, 0, by, mz - 0.030 - i * 0.042, 18);
        wtube(g, 0.0235, 0.020, 0.014, MAT.dark, 0, by, mz - 0.190, 18);     // end cap
        wtube(g, 0.0245, 0.0245, 0.016, MAT.rail, 0, by, mz - 0.012, 18);    // mount collar
      } else if (id === 'extended') {
        wtube(g, 0.0115, 0.0115, 0.170, MAT.extBarrel, 0, by, mz - 0.062, 14);
        wtube(g, 0.0145, 0.0145, 0.020, MAT.rail, 0, by, mz - 0.012, 14);    // step collar
        wtube(g, 0.0125, 0.0105, 0.012, MAT.dark, 0, by, mz - 0.148, 14);    // crown
      }
      // barrel attachments follow the gun's camo (like real COD camo coverage)
      if (camoMat) g.traverse(o => { if (o.isMesh) o.material = camoMat; });
    }

    if (g.children.length > 0) {
      g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      this.gun.add(g);
    }
  },

  /* world-space position of the muzzle (for flash/tracer origin) */
  muzzleWorld(out) {
    if (!this.muzzle) return out.set(0,0,0);
    this.muzzle.getWorldPosition(out);
    return out;
  },

  kick(strength) {
    this.recoilVel += strength * 0.9;
    this.kickPitch += strength * 0.10;
  },

  startReload(dur) { this.reloadT = 0; this.reloadDur = dur; },
  cancelReload() { this.reloadT = -1; },
  meleeSwing() { this.meleeT = 0; },
  inspect() { if (this.reloadT < 0 && this.meleeT < 0) this.inspectT = 0; },

  /* state: { ads, sprint, moving, speed, lookX, lookY, crouch, w:WEAPON } */
  update(dt, s) {
    const w = s.w;
    const targetAds = (s.ads && this.reloadT < 0 && !s.sprint) ? 1 : 0;
    this.adsLerp += (targetAds - this.adsLerp) * Math.min(1, dt / (w.adsTime || 0.18) * 2.2);

    // recoil spring
    this.recoilVel -= this.recoil * 130 * dt;
    this.recoilVel *= Math.max(0, 1 - dt * 11);
    this.recoil += this.recoilVel * dt;
    this.kickPitch = Math.max(0, this.kickPitch - dt * (w.recoilRecover || 6) * 0.45);

    // sway from mouse
    this.swayX += ((-s.lookX * 0.00045) - this.swayX) * Math.min(1, dt * 9);
    this.swayY += ((-s.lookY * 0.00045) - this.swayY) * Math.min(1, dt * 9);

    // head bob / walk bob
    const moveAmt = Math.min(1, (s.speed || 0) / 6);
    this.bobT += dt * (7 + (s.speed||0) * 1.1);
    const bobAmp = moveAmt * (this.adsLerp > 0.5 ? 0.35 : 1);
    const bobX = Math.sin(this.bobT) * 0.010 * bobAmp;
    const bobY = Math.abs(Math.cos(this.bobT)) * 0.012 * bobAmp;

    // sprint blend
    const sprintT = (s.sprint && this.reloadT < 0) ? 1 : 0;
    this.sprintLerp += (sprintT - this.sprintLerp) * Math.min(1, dt * 8);

    /* ---------- base pose ---------- */
    const baseX = 0.20, baseY = -0.185, baseZ = -0.44;
    // Center the gun when ADS'd so shots go straight down the middle of the screen.
    const adsX  = 0.0,  adsY  = -0.075, adsZ  = -0.30;
    const adsAlign = { smg:[0.02,-0.075,0], ar:[0.0,-0.085,0], lmg:[0.0,-0.095,0],
      sniper:[0.0,-0.115,0], pistol:[0.02,-0.05,0], knife:[0.04,-0.06,0], launcher:[0.0,-0.06,0] }[this.weaponId] || [0,-0.08,0];
    const a = this.adsLerp;

    let px = THREE.MathUtils.lerp(baseX, adsX + adsAlign[0], a);
    let py = THREE.MathUtils.lerp(baseY, adsY + adsAlign[1], a) + bobY;
    let pz = THREE.MathUtils.lerp(baseZ, adsZ, a);

    // When fully scoped in, fade the whole viewmodel (gun + arms) out so nothing
    // blocks the sight picture. opacity is ignored unless material.transparent
    // is true, so flip that flag only when the fade state changes (a flip forces
    // a shader recompile via needsUpdate, so never do it per-frame).
    const vmAlpha = 1 - Math.min(1, Math.max(0, (a - 0.6) / 0.4));
    const wantFade = vmAlpha < 0.999;
    if (wantFade !== this._fading) {
      this._fading = wantFade;
      this.root.traverse(o => {
        if (o.isMesh) {
          o.material.transparent = wantFade;
          o.material.opacity = vmAlpha;
          o.material.needsUpdate = true;
        }
      });
    } else if (wantFade) {
      this.root.traverse(o => { if (o.isMesh) o.material.opacity = vmAlpha; });
    }

    /* ---------- reload anim ---------- */
    let rx = 0, ry = 0, rz = 0, roll = 0;
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      const p = Math.min(1, this.reloadT / this.reloadDur);
      const dip = Math.sin(Math.min(1, p*1.35) * Math.PI);
      py -= dip * 0.13;
      px -= dip * 0.03;
      rz += dip * 0.10;
      rx += dip * 0.35;
      roll = Math.sin(p * Math.PI * 2) * 0.18 - 0.12 * dip;
      const grab = (p > 0.2 && p < 0.75) ? Math.sin((p-0.2)/0.55*Math.PI) : 0;
      this.hands.handR.position.set(0.055 - grab*0.03, -0.12 - grab*0.14, 0.02 - grab*0.12);
      if (p >= 1) this.reloadT = -1;
    } else {
      this.hands.handR.position.lerp(new THREE.Vector3(0.055,-0.12,0.02), Math.min(1, dt*10));
    }

    /* ---------- melee swing ---------- */
    if (this.meleeT >= 0) {
      this.meleeT += dt;
      const p = this.meleeT / 0.34;
      if (p >= 1) { this.meleeT = -1; }
      else {
        const sw = Math.sin(p * Math.PI);
        px += sw * 0.10; pz -= sw * 0.35;
        ry -= sw * 0.9; rx -= sw * 0.5;
        roll += sw * 0.7;
      }
    }

    /* ---------- inspect ---------- */
    if (this.inspectT >= 0) {
      this.inspectT += dt;
      const p = this.inspectT / 2.0;
      if (p >= 1) this.inspectT = -1;
      else {
        const k = Math.sin(p * Math.PI);
        px -= k * 0.10; py += k * 0.05;
        roll += k * 1.5; ry += k * 0.5;
      }
    }

    /* ---------- sprint pose ---------- */
    const sp = this.sprintLerp;
    if (sp > 0.01) {
      px += sp * 0.06;
      py += sp * -0.04 + Math.sin(this.bobT*1.1) * 0.012 * sp;
      pz += sp * 0.10;
      ry += sp * 0.55;
      rx += sp * -0.25;
      roll += sp * 0.45;
    }

    /* ---------- recoil / sway / bob ---------- */
    pz += this.recoil * 0.05;
    rx += this.kickPitch * 0.8;
    px += this.swayX * (1 - a*0.7);
    py += this.swayY * (1 - a*0.7);
    px += bobX * (1 - a*0.5);
    ry += this.swayX * 2.2;
    rx += this.swayY * 2.2;

    // subtle idle breathing
    py += Math.sin(performance.now()*0.0013) * 0.0035 * (1-a);

    /* BO3 DARK MATTER animation — the nebula flows across the metal and the
       glow breathes. Both the albedo and the emissive map are the SAME shared
       texture, so one offset write drives everything (no per-frame traversal
       of the gun). Scroll rate is in UV repeats/ms — the old value moved the
       texture ~5px/s, which read as static; this is now clearly visible. */
    if (this.camo === 'darkmatter') {
      const t = performance.now();
      const dm = MAT.camoDarkMatter;
      dm.map.offset.set(t * 0.000045, t * 0.000026);              // flowing drift
      dm.emissiveIntensity = 1.05 + 0.5 * Math.sin(t * 0.0019);   // breathing glow
    }

    this.root.position.set(px, py, pz);
    this.root.rotation.set(rx, ry, roll);

    // hide arms/gun very close to walls to avoid clipping (rare)
    this.root.visible = true;
  },

  /* ADS FOV factor for camera */
  adsFov(w) { return THREE.MathUtils.lerp(1, w.adsFov, this.adsLerp); },

  isAds() { return this.adsLerp > 0.5; },
  isBusy() { return this.reloadT >= 0 || this.meleeT >= 0; }
};
