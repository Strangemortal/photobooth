/* ============================================================
   ui.js
   Shared UI utilities: toast, flash, button press feedback,
   easing helpers, pointer event normalization.
   ============================================================ */

export const ease = {
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutHeavy: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

export function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function tween({ duration, ease: e = ease.inOutCubic, onUpdate, onComplete }) {
  return new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = e(t);
      if (onUpdate) onUpdate(eased, t);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        if (onComplete) onComplete();
        resolve(1);
      }
    }
    requestAnimationFrame(frame);
  });
}

export function pulseButton(btn) {
  if (!btn) return;
  btn.classList.add('is-pressed');
  setTimeout(() => btn.classList.remove('is-pressed'), 220);
}

export function pointerPos(ev, target) {
  const rect = target.getBoundingClientRect();
  const isTouch = ev.touches && ev.touches.length;
  const cx = isTouch ? ev.touches[0].clientX : ev.clientX;
  const cy = isTouch ? ev.touches[0].clientY : ev.clientY;
  return { x: cx - rect.left, y: cy - rect.top, clientX: cx, clientY: cy };
}

export function disableSelection() { document.body.style.userSelect = 'none'; }
export function enableSelection() { document.body.style.userSelect = ''; }
