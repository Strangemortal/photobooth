/* ============================================================
   paper.js
   Procedural paper substrate generation. No texture images.
   ============================================================ */

export const STYLES = {
  vintage: {
    base: { r: 240, g: 227, b: 194 },
    varAmount: 18,
    fiberCount: 280,
    fiberColor: 'rgba(160, 120, 60, 0.10)',
    edgeDarken: 0.45,
    noiseAmount: 12,
    wrinkleStrength: 0.35,
    wrinkleCount: 7,
  },
  glossy: {
    base: { r: 252, g: 246, b: 230 },
    varAmount: 8,
    fiberCount: 80,
    fiberColor: 'rgba(160, 130, 80, 0.05)',
    edgeDarken: 0.15,
    noiseAmount: 6,
    wrinkleStrength: 0.05,
    wrinkleCount: 2,
  },
  aged: {
    base: { r: 218, g: 196, b: 148 },
    varAmount: 28,
    fiberCount: 360,
    fiberColor: 'rgba(120, 80, 30, 0.14)',
    edgeDarken: 0.6,
    noiseAmount: 22,
    wrinkleStrength: 0.5,
    wrinkleCount: 11,
  },
  bw: {
    base: { r: 232, g: 232, b: 226 },
    varAmount: 12,
    fiberCount: 200,
    fiberColor: 'rgba(80, 80, 80, 0.10)',
    edgeDarken: 0.4,
    noiseAmount: 14,
    wrinkleStrength: 0.3,
    wrinkleCount: 6,
  },
  polaroid: {
    base: { r: 248, g: 244, b: 232 },
    varAmount: 6,
    fiberCount: 50,
    fiberColor: 'rgba(160, 140, 100, 0.04)',
    edgeDarken: 0.10,
    noiseAmount: 5,
    wrinkleStrength: 0.04,
    wrinkleCount: 1,
  },
};

/* Seeded PRNG (LCG) — each paper is unique */
function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}

export function generate(w, h, styleName = 'vintage') {
  const style = STYLES[styleName] || STYLES.vintage;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rnd = makeRng((Math.random() * 1e9) | 0);

  /* 1. Base warm tone with brightness variation across the surface */
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  const v1 = 1 - style.varAmount / 255;
  const v2 = 1 + style.varAmount / 255;
  baseGrad.addColorStop(0, _rgb(style.base, v1));
  baseGrad.addColorStop(0.5, _rgb(style.base, 1));
  baseGrad.addColorStop(1, _rgb(style.base, v2));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  /* 2. Brightness blobs — subtle large-scale variation */
  const blobCount = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < blobCount; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = (0.2 + rnd() * 0.4) * Math.min(w, h);
    const bright = (rnd() - 0.5) * 2 * style.varAmount;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const tone = bright > 0
      ? `rgba(255,245,220,${bright / 255 * 0.4})`
      : `rgba(80,50,20,${-bright / 255 * 0.4})`;
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* 3. Procedural fibers — short thin lines */
  ctx.strokeStyle = style.fiberColor;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < style.fiberCount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = 3 + rnd() * 16;
    const ang = rnd() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  /* 4. Wrinkles — long soft bezier curves */
  ctx.lineWidth = 1.2;
  for (let i = 0; i < style.wrinkleCount; i++) {
    const x1 = rnd() * w;
    const y1 = rnd() * h;
    const x2 = rnd() * w;
    const y2 = rnd() * h;
    const cx = (x1 + x2) / 2 + (rnd() - 0.5) * w * 0.3;
    const cy = (y1 + y2) / 2 + (rnd() - 0.5) * h * 0.3;

    const isHighlight = rnd() < 0.4;
    ctx.strokeStyle = isHighlight
      ? `rgba(255,240,210,${style.wrinkleStrength * 0.4})`
      : `rgba(80,50,20,${style.wrinkleStrength * 0.6})`;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }

  /* 5. Surface noise — fine grain across the paper */
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * style.noiseAmount;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);

  /* 6. Edge darkening — vignette toward the borders */
  const eg = ctx.createRadialGradient(
    w/2, h/2, Math.min(w,h) * 0.3,
    w/2, h/2, Math.max(w,h) * 0.7
  );
  eg.addColorStop(0, 'rgba(0,0,0,0)');
  eg.addColorStop(1, `rgba(60,40,15,${style.edgeDarken})`);
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, w, h);

  /* 7. Subtle border toning — like the deckle edge of old paper */
  ctx.strokeStyle = `rgba(120,80,30,${style.edgeDarken * 0.6})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  return canvas;
}

function _rgb(base, mul) {
  return `rgb(${Math.floor(base.r * mul)},${Math.floor(base.g * mul)},${Math.floor(base.b * mul)})`;
}
