import * as THREE from 'three';

// Procedural canvas textures. Everything in the game is generated at load —
// no image assets — but layered noise, stains and grout lines keep surfaces
// reading as worn and real rather than flat-shaded.

function canvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function finalize(c, { repeat = [1, 1], srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Per-pixel value jitter over whatever is already painted. */
function grainOver(ctx, size, strength = 14, alpha = 0.6) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * strength * alpha;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Big soft blotches — water stains, discolouration, age. */
function stains(ctx, size, count = 10, dark = 'rgba(40,30,20,0.05)', light = 'rgba(255,250,235,0.04)') {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = size * (0.08 + Math.random() * 0.3);
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    const c = Math.random() < 0.6 ? dark : light;
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

// ---------- surfaces ----------

export function concreteTexture({ base = '#8d8a84', size = 512, repeat = [1, 1] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  stains(ctx, size, 16);
  // hairline cracks
  ctx.strokeStyle = 'rgba(30,28,26,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = Math.random() * size, y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s++) {
      x += (Math.random() - 0.5) * 70;
      y += (Math.random() - 0.3) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grainOver(ctx, size, 16);
  return finalize(c, { repeat });
}

export function plasterTexture({ base = '#cfc7b4', tint = 'rgba(120,110,90,0.06)', size = 512, repeat = [1, 1] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  stains(ctx, size, 12, tint);
  grainOver(ctx, size, 9);
  return finalize(c, { repeat });
}

export function wallpaperTexture({ base = '#c9b8a6', stripe = '#bda893', stripeW = 26, size = 512, repeat = [2, 1] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = stripe;
  for (let x = 0; x < size; x += stripeW * 2) ctx.fillRect(x, 0, stripeW, size);
  // faded damask dots
  ctx.fillStyle = 'rgba(90,75,60,0.10)';
  for (let y = 20; y < size; y += 64) {
    for (let x = ((y / 64) % 2) * 32 + 8; x < size; x += 64) {
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  stains(ctx, size, 10);
  grainOver(ctx, size, 7);
  return finalize(c, { repeat });
}

export function woodTexture({ base = '#7d5f45', dark = '#5d4430', plankW = 85, size = 512, repeat = [2, 2] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += plankW) {
    const shade = (Math.random() - 0.5) * 26;
    ctx.fillStyle = `rgba(${40 + shade},${28 + shade},${16 + shade},0.22)`;
    ctx.fillRect(x, 0, plankW - 3, size);
    ctx.fillStyle = dark;
    ctx.fillRect(x + plankW - 3, 0, 3, size);
    // grain lines
    ctx.strokeStyle = 'rgba(50,34,20,0.20)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      let gy = 0, gx = x + 6 + Math.random() * (plankW - 14);
      ctx.moveTo(gx, gy);
      while (gy < size) {
        gy += 24;
        gx += (Math.random() - 0.5) * 7;
        ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
  }
  stains(ctx, size, 6);
  grainOver(ctx, size, 8);
  return finalize(c, { repeat });
}

export function tileTexture({
  tile = '#9fc4c9', grout = '#e2ded2', tileSize = 64, size = 512,
  variation = 18, repeat = [4, 4], groutW = 5,
} = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, size, size);
  const col = new THREE.Color(tile);
  for (let y = 0; y < size; y += tileSize) {
    for (let x = 0; x < size; x += tileSize) {
      const v = (Math.random() - 0.5) * (variation / 255);
      const cc = col.clone().offsetHSL(0, 0, v);
      ctx.fillStyle = `#${cc.getHexString()}`;
      ctx.fillRect(x + groutW, y + groutW, tileSize - groutW * 2, tileSize - groutW * 2);
      // glaze highlight
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + groutW, y + groutW, tileSize - groutW * 2, (tileSize - groutW * 2) * 0.25);
    }
  }
  stains(ctx, size, 8, 'rgba(60,80,80,0.06)');
  grainOver(ctx, size, 6);
  return finalize(c, { repeat });
}

export function checkerTexture({ a = '#cfc8b8', b = '#8f9089', cell = 128, size = 512, repeat = [6, 6] } = {}) {
  const [c, ctx] = canvas(size);
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? a : b;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  stains(ctx, size, 14);
  grainOver(ctx, size, 10);
  return finalize(c, { repeat });
}

export function carpetTexture({ base = '#7a6a6d', size = 512, repeat = [4, 4] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 34;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  stains(ctx, size, 8);
  return finalize(c, { repeat });
}

export function grassTexture({ base = '#5e6d4a', size = 512, repeat = [8, 8] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const g = 90 + Math.random() * 70;
    ctx.strokeStyle = `rgba(${g * 0.75},${g},${g * 0.5},0.35)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 3 - Math.random() * 5);
    ctx.stroke();
  }
  stains(ctx, size, 8, 'rgba(30,40,20,0.08)');
  return finalize(c, { repeat });
}

export function ceilingTexture({ base = '#d8d4c8', cell = 160, size = 512, repeat = [4, 4] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(90,86,78,0.5)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= size; x += cell) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(size, x); ctx.stroke();
  }
  // speckle
  ctx.fillStyle = 'rgba(120,116,105,0.25)';
  for (let i = 0; i < 2600; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  stains(ctx, size, 10, 'rgba(110,90,60,0.10)');
  return finalize(c, { repeat });
}

export function asphaltTexture({ base = '#4a4a4e', size = 512, repeat = [4, 4] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  grainOver(ctx, size, 22, 1);
  stains(ctx, size, 12);
  return finalize(c, { repeat });
}

export function skyGradientTexture({ top = '#2e3550', mid = '#7a6a8a', bottom = '#c9a996', size = 512 } = {}) {
  const [c, ctx] = canvas(size);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finalize(c);
}

/** Canvas-drawn text on a transparent or papery background (signs, tags, plaques). */
export function textTexture({
  text, width = 512, height = 256, font = 'italic 36px Georgia',
  color = '#33302a', bg = null, align = 'center', lineHeight = 1.45, pad = 28,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    stains(ctx, Math.max(width, height), 5);
  }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const fs = parseInt(font.match(/(\d+)px/)?.[1] ?? '36', 10);
  const totalH = lines.length * fs * lineHeight;
  const x = align === 'center' ? width / 2 : align === 'left' ? pad : width - pad;
  lines.forEach((line, i) => {
    const y = height / 2 - totalH / 2 + (i + 0.5) * fs * lineHeight;
    ctx.fillText(line, x, y);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A subtle monochrome noise map for roughness/bump — kept linear. */
export function noiseMap({ size = 256, strength = 40, base = 128, repeat = [2, 2] } = {}) {
  const [c, ctx] = canvas(size);
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, size, size);
  grainOver(ctx, size, strength, 1);
  return finalize(c, { repeat, srgb: false });
}

// ---------- chalk & photographs (rooms XII, XV) ----------

/**
 * A chalk tally and a few chalk words on a concrete-coloured square.
 * The returned texture has .redraw({ tally, lines }) — planes sharing it change together.
 */
export function chalkTexture({ tally = 0, lines = [], size = 512, base = '#5a5852', chalk = '#e8e4d8' } = {}) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size / 2;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const jitter = (i, k) => (((i * 31 + k * 17) % 11) - 5) * 0.6;   // deterministic wobble
  const draw = ({ tally: n = tally, lines: ls = lines } = {}) => {
    const w = c.width, h = c.height;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    stains(ctx, w, 6);
    ctx.strokeStyle = chalk;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5), k = i % 5, sx = 30 + grp * 96;
      ctx.beginPath();
      if (k < 4) {
        ctx.moveTo(sx + k * 18 + jitter(i, 0), 34 + jitter(i, 1));
        ctx.lineTo(sx + k * 18 + jitter(i, 2), 92 + jitter(i, 3));
      } else {
        ctx.moveTo(sx - 8 + jitter(i, 0), 84 + jitter(i, 1));
        ctx.lineTo(sx + 66 + jitter(i, 2), 42 + jitter(i, 3));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = chalk;
    ctx.font = 'italic 44px Georgia';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ls.forEach((line, i) => ctx.fillText(line, 30, 150 + i * 56));
    ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  draw();
  tex.redraw = draw;
  return tex;
}

/** The photograph motif from rooms I and V: figures too blurred to name. */
export function blurredPhotoTexture({ figures = 2, width = 128, height = 96 } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#9b9184');
  g.addColorStop(1, '#6e675c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(60,55,48,0.55)';
  for (let f = 0; f < figures; f++) {
    const x = width * (0.5 + (f - (figures - 1) / 2) * 0.28);
    ctx.beginPath(); ctx.ellipse(x, height * 0.55, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, height * 0.33, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.filter = 'blur(2px)';
  ctx.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- material helper ----------

/**
 * Standard material with texture + bump for cheap tactile realism.
 * kind: concrete | plaster | wallpaper | wood | tile | checker | carpet |
 *       grass | ceiling | asphalt
 */
export function makeMat(kind, opts = {}) {
  const gens = {
    concrete: concreteTexture, plaster: plasterTexture, wallpaper: wallpaperTexture,
    wood: woodTexture, tile: tileTexture, checker: checkerTexture,
    carpet: carpetTexture, grass: grassTexture, ceiling: ceilingTexture,
    asphalt: asphaltTexture,
  };
  const map = gens[kind](opts);
  const rough = {
    concrete: 0.95, plaster: 0.9, wallpaper: 0.85, wood: 0.72, tile: 0.35,
    checker: 0.55, carpet: 1.0, grass: 1.0, ceiling: 0.95, asphalt: 0.98,
  }[kind];
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: opts.roughness ?? rough,
    metalness: 0.0,
    bumpMap: map,
    bumpScale: opts.bumpScale ?? (kind === 'tile' ? 0.5 : 1.2),
  });
  if (opts.color) mat.color.set(opts.color);
  return mat;
}
