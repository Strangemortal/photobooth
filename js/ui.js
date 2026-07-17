/* ============================================================
   ui.js
   Shared UI utilities: toast, flash, develop screen, button
   press feedback, easing helpers, pointer event normalization.
   ============================================================ */

window.UI = (function () {

  /* ---------- Easing helpers (heavy, mechanical) ---------- */
  const ease = {
    inOutCubic: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2,
    outCubic:   t => 1 - Math.pow(1 - t, 3),
    inOutQuad:  t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2,
    outBack:    t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t-1, 3) + c1 * Math.pow(t-1, 2); },
    inOutHeavy: t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2,
  };

  /* ---------- Promise-based delay ---------- */
  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  /* ---------- rAF-based tween ---------- */
  function tween({ duration, ease: e = ease.inOutCubic, onUpdate, onComplete }) {
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

  /* ---------- Toast ---------- */
  const toastEl = () => document.getElementById('toast');
  const toastTextEl = () => document.getElementById('toastText');

  function toast(message, duration = 3200) {
    const el = toastEl();
    if (!el) return;
    toastTextEl().textContent = message;
    el.hidden = false;
    // Force reflow so the transition runs
    void el.offsetWidth;
    el.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => { el.hidden = true; }, 400);
    }, duration);
  }

  /* ---------- Flash ---------- */
  function flash(duration = 140) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.classList.remove('is-flashing');
    void el.offsetWidth; // reflow
    el.classList.add('is-flashing');
    return wait(duration);
  }

  /* ---------- Develop screen ---------- */
  const developEl = () => document.getElementById('developScreen');
  const developFill = () => document.getElementById('developFill');
  const developStatus = () => document.getElementById('developStatus');

  function showDevelop() {
    const el = developEl();
    if (!el) return;
    el.hidden = false;
    developFill().style.width = '0%';
    developStatus().textContent = 'PROCESSING…';
  }

  function hideDevelop() {
    const el = developEl();
    if (el) el.hidden = true;
  }

  async function runDevelop(progressStages) {
    showDevelop();
    for (const stage of progressStages) {
      developStatus().textContent = stage.label;
      developFill().style.width = stage.pct + '%';
      await wait(stage.dur);
    }
    hideDevelop();
  }

  /* ---------- Button press feedback ---------- */
  function pulseButton(btn) {
    if (!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 220);
  }

  /* ---------- Pointer normalization ---------- */
  function pointerPos(ev, target) {
    const rect = target.getBoundingClientRect();
    const isTouch = ev.touches && ev.touches.length;
    const cx = isTouch ? ev.touches[0].clientX : ev.clientX;
    const cy = isTouch ? ev.touches[0].clientY : ev.clientY;
    return { x: cx - rect.left, y: cy - rect.top, clientX: cx, clientY: cy };
  }

  /* ---------- Loading screen done ---------- */
  function dismissLoading() {
    const el = document.getElementById('loading');
    if (!el) return;
    el.classList.add('is-done');
    setTimeout(() => { el.style.display = 'none'; }, 700);
  }

  /* ---------- Disable text selection globally during drags ---------- */
  function disableSelection() { document.body.style.userSelect = 'none'; }
  function enableSelection()  { document.body.style.userSelect = ''; }

  return {
    ease,
    wait,
    tween,
    toast,
    flash,
    showDevelop,
    hideDevelop,
    runDevelop,
    pulseButton,
    pointerPos,
    dismissLoading,
    disableSelection,
    enableSelection,
  };
})();
