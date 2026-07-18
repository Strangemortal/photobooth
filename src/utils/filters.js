/* ============================================================
   filters.js
   Vintage image processing — all canvas-based.
   ============================================================ */

export function vintage(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const liftBlacks    = opts.liftBlacks    ?? 18;
  const contrastMul   = opts.contrastMul   ?? 0.86;
  const warmTintR     = opts.warmTintR     ?? 1.06;
  const warmTintG     = opts.warmTintG     ?? 1.00;
  const warmTintB     = opts.warmTintB     ?? 0.86;
  const exposureShift = opts.exposureShift ?? 0;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = gray + (liftBlacks * (1 - gray / 255));
    gray = (gray - 128) * contrastMul + 128;
    gray += exposureShift;
    gray = Math.max(0, Math.min(255, gray));

    let nr = gray * warmTintR;
    let ng = gray * warmTintG;
    let nb = gray * warmTintB;

    d[i]   = Math.max(0, Math.min(255, nr));
    d[i+1] = Math.max(0, Math.min(255, ng));
    d[i+2] = Math.max(0, Math.min(255, nb));
  }

  ctx.putImageData(img, 0, 0);

  if (opts.blur !== false) {
    boxBlur(ctx, w, h, opts.blurRadius ?? 1);
  }
  if (opts.vignette !== false) {
    vignette(ctx, w, h, opts.vignetteStrength ?? 0.55);
  }
}

export function noir(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    gray = (gray - 128) * 1.25 + 128;
    gray = Math.max(0, Math.min(255, gray));
    d[i] = gray; d[i+1] = gray; d[i+2] = gray;
  }
  ctx.putImageData(img, 0, 0);
  if (opts.blur !== false) boxBlur(ctx, w, h, opts.blurRadius ?? 1);
  if (opts.vignette !== false) vignette(ctx, w, h, opts.vignetteStrength ?? 0.55);
}

export function warm(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    d[i] = Math.min(255, r * 1.15);
    d[i+1] = Math.min(255, g * 1.05);
    d[i+2] = Math.max(0, b * 0.82);
  }
  ctx.putImageData(img, 0, 0);
  if (opts.blur !== false) boxBlur(ctx, w, h, opts.blurRadius ?? 1);
  if (opts.vignette !== false) vignette(ctx, w, h, opts.vignetteStrength ?? 0.55);
}

export function cool(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    d[i] = Math.max(0, r * 0.82);
    d[i+1] = Math.min(255, g * 1.05);
    d[i+2] = Math.min(255, b * 1.25);
  }
  ctx.putImageData(img, 0, 0);
  if (opts.blur !== false) boxBlur(ctx, w, h, opts.blurRadius ?? 1);
  if (opts.vignette !== false) vignette(ctx, w, h, opts.vignetteStrength ?? 0.55);
}

export function neon(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];
    let gray = (r + g + b) / 3;
    if (gray > 128) {
      d[i] = 255; d[i+1] = Math.max(0, g * 0.4); d[i+2] = 180;
    } else {
      d[i] = 0; d[i+1] = Math.min(255, g * 1.3); d[i+2] = Math.min(255, b * 1.5);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (opts.blur !== false) boxBlur(ctx, w, h, opts.blurRadius ?? 1);
  if (opts.vignette !== false) vignette(ctx, w, h, opts.vignetteStrength ?? 0.55);
}

export function addGrain(ctx, w, h, intensity = 0.10) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let seed = (Math.random() * 1e9) | 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 0xffffffff);
  };

  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 255 * intensity;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function addDust(ctx, w, h, count = 80) {
  let seed = (Math.random() * 1e9) | 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 0xffffffff);
  };

  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const type = rnd();
    if (type < 0.4) {
      const r = rnd() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(255,240,210,${0.5 + rnd() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (type < 0.7) {
      const r = rnd() * 1.2 + 0.2;
      ctx.fillStyle = `rgba(20,10,5,${0.5 + rnd() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const len = 3 + rnd() * 12;
      const ang = rnd() * Math.PI;
      const dx = Math.cos(ang) * len;
      const dy = Math.sin(ang) * len;
      ctx.strokeStyle = `rgba(${30 + rnd()*60|0},${20 + rnd()*40|0},${10 + rnd()*20|0},${0.25 + rnd() * 0.35})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
  }
}

export function addScratches(ctx, w, h, count = 6) {
  let seed = (Math.random() * 1e9) | 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 0xffffffff);
  };

  for (let i = 0; i < count; i++) {
    const startX = rnd() * w;
    const startY = rnd() * h;
    const vertical = rnd() < 0.7;
    const length = h * (0.3 + rnd() * 0.7);
    const drift = (rnd() - 0.5) * w * 0.15;
    const endX = vertical ? startX + drift : startX + length;
    const endY = vertical ? startY + length : startY + drift;

    const isBright = rnd() < 0.5;
    const alpha = 0.15 + rnd() * 0.25;
    ctx.strokeStyle = isBright ? `rgba(255,240,220,${alpha})` : `rgba(20,10,5,${alpha})`;
    ctx.lineWidth = 0.4 + rnd() * 0.6;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    const cx = (startX + endX) / 2 + (rnd() - 0.5) * 8;
    const cy = (startY + endY) / 2 + (rnd() - 0.5) * 8;
    ctx.quadraticCurveTo(cx, cy, endX, endY);
    ctx.stroke();
  }
}

export function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.25,
    w / 2, h / 2, Math.max(w, h) * 0.75
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function paperize(ctx, w, h, opts = {}) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const paperTone = opts.paperTone ?? { r: 240, g: 227, b: 194 };
  const blend = opts.blend ?? 0.18;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i+1], b = d[i+2];
    d[i]   = r * (1 - blend) + paperTone.r * blend;
    d[i+1] = g * (1 - blend) + paperTone.g * blend;
    d[i+2] = b * (1 - blend) + paperTone.b * blend;
  }
  ctx.putImageData(img, 0, 0);

  edgeDarken(ctx, w, h, opts.edgeStrength ?? 0.35);
}

function boxBlur(ctx, w, h, radius) {
  if (radius < 1) return;
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src.length);

  blurH(src, out, w, h, radius);
  blurV(out, src, w, h, radius);

  ctx.putImageData(img, 0, 0);
}

function blurH(src, dst, w, h, r) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R=0, G=0, B=0, A=0, cnt=0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w-1, Math.max(0, x + k));
        const i = (y * w + xx) * 4;
        R += src[i]; G += src[i+1]; B += src[i+2]; A += src[i+3]; cnt++;
      }
      const o = (y * w + x) * 4;
      dst[o]   = R / cnt;
      dst[o+1] = G / cnt;
      dst[o+2] = B / cnt;
      dst[o+3] = A / cnt;
    }
  }
}

function blurV(src, dst, w, h, r) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let R=0, G=0, B=0, A=0, cnt=0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h-1, Math.max(0, y + k));
        const i = (yy * w + x) * 4;
        R += src[i]; G += src[i+1]; B += src[i+2]; A += src[i+3]; cnt++;
      }
      const o = (y * w + x) * 4;
      dst[o]   = R / cnt;
      dst[o+1] = G / cnt;
      dst[o+2] = B / cnt;
      dst[o+3] = A / cnt;
    }
  }
}

function edgeDarken(ctx, w, h, strength) {
  const g = ctx.createRadialGradient(
    w/2, h/2, Math.min(w,h)*0.3,
    w/2, h/2, Math.max(w,h)*0.6
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(40,20,5,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
