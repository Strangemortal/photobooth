/* ============================================================
   strip.js
   Composes the final photo strip from captured frames + paper
   + vintage processing + grain + dust + scratches + timestamp.
   ============================================================ */

import { generatePaper, PAPER_STYLES } from './paper.js';
import * as Filters from './filters.js';

export const ASPECTS = {
  '3x4':    { w: 3, h: 4,  frames: [1, 3] },
  '2x3':    { w: 2, h: 3,  frames: [1, 2] },
  'square': { w: 1, h: 1,  frames: [1] },
};

export function buildStrip(captures, opts = {}) {
  if (!captures || !captures.length) {
    return document.createElement('canvas');
  }
  const paperStyle = opts.paperStyle || 'vintage';
  const aspectKey = opts.aspectRatio || '3x4';
  const aspect = ASPECTS[aspectKey] || ASPECTS['3x4'];
  const ts = Object.assign({ enabled: true, format: 'DMY_HM', date: new Date() }, opts.timestamp || {});
  const maxWidth = opts.maxWidth || 600;

  let n = captures.length;
  if (!aspect.frames.includes(n)) {
    n = aspect.frames.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a, aspect.frames[0]);
  }
  n = Math.max(1, n);

  const outW = Math.round(maxWidth);
  const padX = Math.round(outW * 0.08);
  const padTop = Math.round(outW * 0.08);
  const padBottom = ts.enabled ? Math.round(outW * 0.20) : Math.round(outW * 0.08);
  const gap = Math.round(outW * 0.04);

  const frameW = outW - padX * 2;
  const frameH = Math.round(frameW * (aspect.h / aspect.w));
  const outH = padTop + padBottom + n * frameH + (n - 1) * gap;

  const paper = generatePaper(outW, outH, paperStyle);
  const ctx = paper.getContext('2d', { willReadFrequently: true });

  for (let i = 0; i < n; i++) {
    const cap = captures[Math.min(i, captures.length - 1)];
    if (!cap) continue;

    const frame = document.createElement('canvas');
    frame.width = frameW;
    frame.height = frameH;
    const fctx = frame.getContext('2d', { willReadFrequently: true });

    const cw = cap.width, ch = cap.height;
    const car = cw / ch;
    const fr = frameW / frameH;
    let sx, sy, sw, sh;
    if (car > fr) {
      sh = ch;
      sw = Math.round(ch * fr);
      sx = Math.round((cw - sw) / 2);
      sy = 0;
    } else {
      sw = cw;
      sh = Math.round(cw / fr);
      sx = 0;
      sy = Math.round((ch - sh) / 2);
    }
    fctx.drawImage(cap, sx, sy, sw, sh, 0, 0, frameW, frameH);

    const variation = (Math.random() - 0.5) * 8;
    const filterStyle = opts.filterStyle || 'vintage';
    
    const filterOpts = {
      liftBlacks: 18 + (Math.random() - 0.5) * 6,
      contrastMul: 0.82 + Math.random() * 0.08,
      warmTintR: 1.04 + Math.random() * 0.06,
      warmTintG: 1.0,
      warmTintB: 0.82 + Math.random() * 0.08,
      exposureShift: variation,
      blurRadius: 1,
      vignetteStrength: 0.55 + Math.random() * 0.15,
    };

    if (filterStyle === 'vintage') {
      Filters.vintage(fctx, frameW, frameH, filterOpts);
    } else if (filterStyle === 'bw') {
      Filters.noir(fctx, frameW, frameH, filterOpts);
    } else if (filterStyle === 'warm') {
      Filters.warm(fctx, frameW, frameH, filterOpts);
    } else if (filterStyle === 'cool') {
      Filters.cool(fctx, frameW, frameH, filterOpts);
    } else if (filterStyle === 'neon') {
      Filters.neon(fctx, frameW, frameH, filterOpts);
    } else {
      if (filterOpts.blurRadius > 0) {
        Filters.vignette(fctx, frameW, frameH, filterOpts.vignetteStrength);
      }
    }

    fctx.globalCompositeOperation = 'source-over';
    const paperBase = (PAPER_STYLES[paperStyle] || PAPER_STYLES.vintage).base;
    Filters.paperize(fctx, frameW, frameH, {
      paperTone: paperBase,
      blend: 0.15 + Math.random() * 0.08,
      edgeStrength: 0.3,
    });

    Filters.addGrain(fctx, frameW, frameH, 0.10 + Math.random() * 0.04);
    Filters.addDust(fctx, frameW, frameH, 30 + Math.floor(Math.random() * 30));
    Filters.addScratches(fctx, frameW, frameH, 2 + Math.floor(Math.random() * 4));

    const fy = padTop + i * (frameH + gap);
    ctx.drawImage(frame, padX, fy);

    ctx.strokeStyle = 'rgba(40,20,5,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padX + 0.5, fy + 0.5, frameW - 1, frameH - 1);
  }

  Filters.addGrain(ctx, outW, outH, 0.05);
  Filters.addDust(ctx, outW, outH, 30 + Math.floor(Math.random() * 30));
  Filters.addScratches(ctx, outW, outH, 3 + Math.floor(Math.random() * 4));
  Filters.vignette(ctx, outW, outH, 0.35);

  if (ts.enabled) {
    drawTimestamp(ctx, outW, outH, padBottom, ts);
  }

  return paper;
}

function drawTimestamp(ctx, w, h, padBottom, ts) {
  const text = formatTimestamp(ts.date, ts.format);
  const [line1, line2] = text.split('\n');

  const cx = w / 2;
  const ty = h - padBottom * 0.55;

  ctx.save();
  ctx.font = `${Math.round(w * 0.045)}px "Special Elite", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(120,70,20,0.85)';
  if (line1) ctx.fillText(line1, cx + 1, ty + 1);
  if (line2) ctx.fillText(line2, cx + 1, ty + Math.round(w * 0.07) + 1);

  ctx.fillStyle = 'rgba(220,150,60,0.85)';
  if (line1) ctx.fillText(line1, cx, ty);
  if (line2) ctx.fillText(line2, cx, ty + Math.round(w * 0.07));
  ctx.restore();
}

function formatTimestamp(date, format) {
  if (!date) date = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = String(date.getDate()).padStart(2, '0');
  const m = months[date.getMonth()];
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');

  switch (format) {
    case 'DMY_HM':  return `${d} ${m} ${y}\n${hh}:${mm}`;
    case 'MDY_HM':  return `${m} ${d} ${y}\n${hh}:${mm}`;
    case 'YMD_HM':  return `${y} ${m} ${d}\n${hh}:${mm}`;
    case 'DMY':     return `${d} ${m} ${y}`;
    case 'TIME':    return `${hh}:${mm}`;
    default:        return `${d} ${m} ${y}\n${hh}:${mm}`;
  }
}
