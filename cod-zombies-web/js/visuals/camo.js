/* =========================================================
   visuals/camo.js — procedural camo pattern generator.
   Builds 512x512 seamless CanvasTextures for a small set of
   original camo finishes (Digital, Dragon Scale, Gold) and a
   helper applyCamo(material, camoId) that stamps a pattern
   onto an existing material. Purely procedural: no binary
   assets, no external images. Add new finishes by dropping a
   painter function into CamoGenerator.painters.
   ========================================================= */

const CamoGenerator = {
  _tex:{},          // camoId -> THREE.CanvasTexture (cached)
  _mat:{},          // camoId -> THREE.MeshStandardMaterial (cached)
  _installed:false,

  /* ---------- tiny canvas helpers (self-contained) ---------- */
  _canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size || 512;
    return c;
  },
  _rng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  _grain(ctx, w, h, amt) {
    const a = amt == null ? 0.05 : amt;
    ctx.fillStyle = 'rgba(0,0,0,' + a + ')';
    for (let i = 0; i < w * 2; i++)
      ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1);
  },

  /* ---------- painters: each fills a size x size canvas ---------- */
  painters:{
    /* DIGITAL — clustered 4px pixels driven by a smooth noise field so the
       flecks group into organic macro shapes instead of random TV static. */
    digital(ctx, w, h) {
      const pal = ['#2c3a24', '#4a5236', '#6b6a48', '#8a8560', '#1c2418', '#57603f'];
      const p = 4;
      const rnd = CamoGenerator._rng(0x0d17a1);
      // cheap value noise sampled on a wrapped lattice for seamless tiling
      const lat = 12, grid = [];
      for (let i = 0; i < lat * lat; i++) grid.push(rnd());
      const samp = (x, y) => {
        const xi = Math.floor(x) % lat, yi = Math.floor(y) % lat;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const g = (a, b) => grid[(((a % lat) + lat) % lat) * lat + (((b % lat) + lat) % lat)];
        const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
      };
      for (let y = 0; y < h; y += p) {
        for (let x = 0; x < w; x += p) {
          const n = samp(x / w * lat, y / h * lat) * 0.7 +
                    samp(x / w * lat * 2 + 3, y / h * lat * 2 + 7) * 0.3;
          let idx = (n * pal.length * 1.3) | 0;
          if (idx < 0) idx = 0;
          if (idx >= pal.length) idx = pal.length - 1;
          ctx.fillStyle = pal[idx];
          ctx.fillRect(x, y, p, p);
        }
      }
      CamoGenerator._grain(ctx, w, h, 0.05);
    },

    /* DRAGON SCALE — overlapping metallic scales with a rim highlight, laid
       on a brick-offset lattice so they tile seamlessly. */
    dragon(ctx, w, h) {
      ctx.fillStyle = '#1a1410'; ctx.fillRect(0, 0, w, h);
      const s = 46, half = s / 2;
      for (let y = -s; y <= h + s; y += half) {
        const off = (((y / half) | 0) % 2) ? half : 0;
        for (let x = -s; x <= w + s; x += s) {
          const cx = x + off + half, cy = y + half;
          const g = ctx.createRadialGradient(cx - 10, cy - 12, 3, cx, cy, half * 1.2);
          g.addColorStop(0.00, '#7fe6b0');
          g.addColorStop(0.35, '#3fae7a');
          g.addColorStop(0.72, '#1f7a52');
          g.addColorStop(1.00, '#0c3a26');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(cx, cy - half);
          ctx.quadraticCurveTo(cx + half, cy - half * 0.2, cx, cy + half);
          ctx.quadraticCurveTo(cx - half, cy - half * 0.2, cx, cy - half);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(180,255,215,0.45)'; ctx.lineWidth = 1.4; ctx.stroke();
        }
      }
      CamoGenerator._grain(ctx, w, h, 0.04);
    },

    /* GOLD — warm gradient body, brushed machining lines, engraved scroll. */
    gold(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, w * 0.6, h);
      g.addColorStop(0.00, '#7a5410');
      g.addColorStop(0.24, '#c9942a');
      g.addColorStop(0.46, '#ffe9a8');
      g.addColorStop(0.64, '#e0b23c');
      g.addColorStop(0.84, '#a97a1c');
      g.addColorStop(1.00, '#f2d271');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,240,190,0.10)'; ctx.lineWidth = 1;
      for (let i = 0; i < 240; i++) {
        const y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 4); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const y0 = (i + 0.5) / 12 * h;
        ctx.strokeStyle = 'rgba(92,60,4,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += w / 16)
          ctx.quadraticCurveTo(x + w / 32, y0 + Math.sin(x * 0.05 + i) * 12, x + w / 16, y0);
        ctx.stroke();
      }
      CamoGenerator._grain(ctx, w, h, 0.03);
    }
  },

  /* Material presets per camo (metalness / roughness / emissive). */
  presets:{
    digital:{ metalness:0.10, roughness:0.70, emissive:0x000000, emissiveIntensity:0 },
    dragon: { metalness:0.55, roughness:0.42, emissive:0x0a2a1c, emissiveIntensity:0.25 },
    gold:   { metalness:1.00, roughness:0.24, emissive:0x000000, emissiveIntensity:0 }
  },

  /* Build (and cache) the 512x512 CanvasTexture for a camo id. */
  texture(camoId) {
    if (this._tex[camoId]) return this._tex[camoId];
    const painter = this.painters[camoId];
    if (!painter) return null;
    const size = 512;
    const c = this._canvas(size);
    painter(c.getContext('2d'), size, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    t.needsUpdate = true;
    this._tex[camoId] = t;
    return t;
  },

  /* Build (and cache) a ready-to-assign MeshStandardMaterial for a camo id. */
  material(camoId) {
    if (this._mat[camoId]) return this._mat[camoId];
    const tex = this.texture(camoId);
    if (!tex) return null;
    const p = this.presets[camoId] || { metalness:0.2, roughness:0.6, emissive:0x000000, emissiveIntensity:0 };
    const m = new THREE.MeshStandardMaterial({
      map:tex, color:0xffffff,
      metalness:p.metalness, roughness:p.roughness,
      emissive:p.emissive, emissiveIntensity:p.emissiveIntensity
    });
    this._mat[camoId] = m;
    return m;
  },

  /* Register this module's camos into the engine's CAMO_MATS table (if the
     weapons module is loaded) so Viewmodel.setWeapon(id, att, camoId) can
     resolve 'digital' / 'dragon' / 'gold' like any native finish. Safe to
     call repeatedly. */
  install() {
    if (this._installed) return;
    this._installed = true;
    if (typeof CAMO_MATS === 'undefined' || !CAMO_MATS) return;
    for (const id in this.painters) {
      const m = this.material(id);
      if (m) CAMO_MATS[id] = m;
    }
  },

  /* List of available camo ids (for menus / debug). */
  ids() { return Object.keys(this.painters); }
};

/* Stamp a camo pattern onto an existing material (mutates + returns it).
   If the id is unknown the material is left untouched. Works on any
   MeshStandardMaterial, including the shared gun materials. */
function applyCamo(material, camoId) {
  if (!material || !camoId || camoId === 'default') return material;
  const tex = CamoGenerator.texture(camoId);
  if (!tex) return material;
  const p = CamoGenerator.presets[camoId] || {};
  material.map = tex;
  if (p.metalness != null) material.metalness = p.metalness;
  if (p.roughness != null) material.roughness = p.roughness;
  if (p.emissive != null && material.emissive) material.emissive.setHex(p.emissive);
  if (p.emissiveIntensity != null && material.emissiveIntensity !== undefined)
    material.emissiveIntensity = p.emissiveIntensity;
  material.needsUpdate = true;
  return material;
}
