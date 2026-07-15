/* ============================================================
   countdown.js
   Visual countdown — numbers scale while transitioning.
   Resolves when finished; can be cancelled.
   ============================================================ */

window.Countdown = (function () {

  const root = () => document.getElementById('countdown');
  const numEl = () => document.getElementById('countdownNum');

  let cancelled = false;
  let currentTimer = null;

  function cancel() {
    cancelled = true;
    if (currentTimer) {
      clearTimeout(currentTimer);
      currentTimer = null;
    }
    const el = root();
    if (el) el.hidden = true;
  }

  /* Run a countdown from `seconds` down to 1.
     onTick(n) is called each second with the current number. */
  function run(seconds, onTick) {
    cancel();
    cancelled = false;
    const el = root();
    const num = numEl();
    el.hidden = false;

    return new Promise(async (resolve) => {
      for (let n = seconds; n >= 1; n--) {
        if (cancelled) { el.hidden = true; resolve(false); return; }
        num.textContent = String(n);
        // Restart the scale animation
        num.style.animation = 'none';
        void num.offsetWidth;
        num.style.animation = 'countdown-num 1s var(--ease-soft) both';
        if (onTick) onTick(n);
        await UI.wait(1000);
      }
      el.hidden = true;
      resolve(true);
    });
  }

  return { run, cancel };
})();
