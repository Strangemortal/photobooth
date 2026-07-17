/* ============================================================
   app.js
   Main orchestrator for the physical booth experience.
   Entry is triggered by pulling the curtain; the inside panel
   only exposes capture, mode, and exit.
   ============================================================ */

(function () {
  let captures = [];
  let captureSession = null;
  let isBusy = false;
  const state = {
    captureMode: 'single',
    countdown: 3,
    paperStyle: 'vintage',
    aspectRatio: '3x4',
    downloadQuality: 'high',
  };

  const $ = id => document.getElementById(id);
  const frameCount = () => state.captureMode === 'single' ? 1 : 3;

  window.addEventListener('load', () => {
    _bindTheme();
    Scenes.initOutside();
    _bindInside();
    _bindPrinter();
    _updateReadout();
    _updateModeButton();
    initPostersDraggable();
    document.addEventListener('scene:entered', () => Camera.start());
    setTimeout(() => UI.dismissLoading(), 1100);
  });

  function _bindTheme() {
    const root = document.documentElement;
    const button = $('themeToggle');
    const saved = localStorage.getItem('photobooth-theme') || 'light';
    _applyTheme(saved);
    button?.addEventListener('click', () => {
      _applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  function _applyTheme(theme) {
    const root = document.documentElement;
    const button = $('themeToggle');
    root.dataset.theme = theme;
    localStorage.setItem('photobooth-theme', theme);
    if (button) {
      const dark = theme === 'dark';
      // Inline SVGs for Sun and Moon inside sliding knob
      button.innerHTML = `
        <span class="theme-toggle__knob">
          ${dark
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
          }
        </span>
      `;
      button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  function _bindInside() {
    $('captureBtn')?.addEventListener('click', () => {
      if (!isBusy) _startCaptureSession();
    });

    $('modeBtn')?.addEventListener('click', () => {
      if (isBusy) return;
      state.captureMode = state.captureMode === 'single' ? 'triple' : 'single';
      UI.pulseButton($('modeBtn'));
      _updateModeButton();
      _updateReadout();
    });

    $('exitBtn')?.addEventListener('click', async () => {
      if (captureSession) {
        _stopCaptureSession();
        await UI.wait(200);
      }
      if (Scenes.isTransitioning) return;
      UI.pulseButton($('exitBtn'));
      Camera.stop();
      Countdown.cancel();
      await Scenes.exitBooth();
      if (captures.length) await _startPrinting();
    });
  }

  function _updateModeButton() {
    const btn = $('modeBtn');
    if (!btn) return;
    const label = btn.querySelector('.machine-btn__label');
    const icon = btn.querySelector('.machine-btn__icon');
    const triple = state.captureMode === 'triple';
    label.textContent = triple ? '3 PHOTO STRIP' : '1 PHOTO';
    icon.textContent = triple ? '×3' : '1×';
    btn.setAttribute('aria-label', triple ? 'Switch to single photo' : 'Switch to three photo strip');
  }

  function _updateReadout() {
    const mode = $('readoutMode');
    const timer = $('readoutTimer');
    const frames = $('readoutFrames');
    if (mode) mode.textContent = state.captureMode === 'single' ? 'SINGLE' : 'TRIPLE';
    if (timer) timer.textContent = state.countdown + 's';
    if (frames) frames.textContent = captures.length + ' / ' + frameCount();
  }

  async function _startCaptureSession() {
    isBusy = true;
    captures = [];
    _updateReadout();

    if (!Camera.isActive() && !(await Camera.start())) {
      isBusy = false;
      return;
    }

    captureSession = { stopRequested: false };
    const captureBtn = $('captureBtn');
    captureBtn?.classList.add('is-disabled');

    for (let i = 0; i < frameCount(); i++) {
      if (captureSession.stopRequested) break;
      const completed = await _captureOne();
      if (!completed) break;
      _updateReadout();
    }

    captureBtn?.classList.remove('is-disabled');
    const stopped = captureSession.stopRequested;
    captureSession = null;

    if (!stopped && captures.length) await _finishCaptureBatch();
    isBusy = false;
  }

  function _stopCaptureSession() {
    if (captureSession) captureSession.stopRequested = true;
    Countdown.cancel();
  }

  async function _captureOne() {
    const completed = await Countdown.run(state.countdown);
    if (!completed || captureSession?.stopRequested) return false;

    await UI.flash(140);
    const frame = Camera.captureFrame({
      aspect: state.aspectRatio === 'square' ? 1 : state.aspectRatio === '2x3' ? 2 / 3 : 3 / 4,
      maxWidth: state.downloadQuality === 'high' ? 1200 : 720,
    });
    if (frame) captures.push(frame);
    await UI.wait(240);
    return !!frame;
  }

  async function _finishCaptureBatch() {
    isBusy = true;
    Camera.stop();
    
    // Immediately exit the booth and start printing on the outside slot
    await Scenes.exitBooth();
    if (captures.length) {
      await _startPrinting();
    } else {
      isBusy = false;
    }
  }

  async function _startPrinting() {
    isBusy = true;

    // 1. Build the high-quality photo strip from our captures
    const stripCanvas = Strip.build(captures, {
      paperStyle: state.paperStyle,
      aspectRatio: state.aspectRatio,
      timestamp: { enabled: false, format: 'DMY_HM', date: null },
      maxWidth: state.downloadQuality === 'high' ? 1200 : 720,
    });

    // 2. Get the physical printer slot on the booth exterior
    const slotEl = document.getElementById('printerSlot');

    // 3. Animate strip growing out of the slot
    await Printer.emergeFromSlot(slotEl, stripCanvas, captures, state);

    // 4. Strip fully emerged — remove it and show name/date/filter form
    await UI.wait(350);
    Printer.removeEmergingStrip();
    Printer.showInline(stripCanvas, captures, state);
    isBusy = false;
  }

  function _bindPrinter() {
    Printer.onDownload((stripCanvas) => {
      if (!stripCanvas) return;
      stripCanvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'photobooth-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }, 'image/png');
    });

    Printer.onNewPhoto(async () => {
      captures = [];
      _updateReadout();
      _updateModeButton();
      
      // Reset inline preview view state inside the booth
      document.getElementById('sceneInside')?.classList.remove('is-preview');
      Printer.hideInline();
      
      if (Scenes.isOutside()) {
        Printer.hide();
        Scenes.resetCurtains(); // Reset curtain in original place without duplicate event bindings
      } else {
        isBusy = true;
        if (await Camera.start()) {
          isBusy = false;
        }
      }
    });
  }

  function initPostersDraggable() {
    const columns = document.querySelectorAll('.booth__column');
    
    // Scatters and handles visibility of posters randomly and responsively
    function randomizePosters() {
      columns.forEach(column => {
        const posters = Array.from(column.querySelectorAll('.booth-poster'));
        const n = posters.length;
        if (n === 0) return;

        const panel = column.querySelector('.booth__panel--riveted') || column;

        // Temporarily display posters to get their actual rendered sizes in pixels
        posters.forEach(p => p.style.display = 'block');

        // Measure first visible poster size
        const firstPoster = posters[0];
        const posterW = firstPoster.offsetWidth || 56;
        const posterH = firstPoster.offsetHeight || 80;
        const panelW = panel.offsetWidth || 200;
        const panelH = panel.offsetHeight || 450;

        // Convert to percentages relative to panel dimensions
        const wPct = (posterW / panelW) * 100;
        const hPct = (posterH / panelH) * 100;
        const pad = 2; // padding percentage for visual separation

        const shuffled = [...posters];
        const placed = []; // Bounding boxes of already placed posters: {l, r, t, b}

        // Try up to 8 full layout attempts to satisfy the minimum 3 posters without overlaps
        let attemptsCount = 0;
        let visibleCount = 0;

        while (attemptsCount < 8) {
          placed.length = 0;
          visibleCount = 0;

          // Shuffle the posters array randomly each attempt
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          shuffled.forEach((poster) => {
            let success = false;
            let leftPercent = 0;
            let topPercent = 0;
            let rotateDeg = 0;

            const maxAttempts = 80;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              const maxL = Math.max(5, 95 - wPct);
              const maxT = Math.max(5, 95 - hPct);
              leftPercent = 4 + Math.random() * (maxL - 4);
              topPercent = 4 + Math.random() * (maxT - 4);
              rotateDeg = Math.round((Math.random() - 0.5) * 36);

              // Bounding box with padding
              const l1 = leftPercent - pad;
              const r1 = leftPercent + wPct + pad;
              const t1 = topPercent - pad;
              const b1 = topPercent + hPct + pad;

              // Check overlap with any already placed posters
              let overlap = false;
              for (const other of placed) {
                if (l1 < other.r && r1 > other.l && t1 < other.b && b1 > other.t) {
                  overlap = true;
                  break;
                }
              }

              if (!overlap) {
                placed.push({ l: l1, r: r1, t: t1, b: b1 });
                poster._tempPos = { leftPercent, topPercent, rotateDeg };
                success = true;
                visibleCount++;
                break;
              }
            }

            if (!success) {
              poster._tempPos = null;
            }
          });

          // If we successfully placed at least 3 posters, we are good!
          if (visibleCount >= 3) {
            break;
          }
          attemptsCount++;
        }

        // Fallback: If after all attempts we still placed less than 3, force place the first 3 (allowing overlaps)
        if (visibleCount < 3) {
          for (let i = 0; i < Math.min(3, shuffled.length); i++) {
            const poster = shuffled[i];
            if (!poster._tempPos) {
              const maxL = Math.max(5, 95 - wPct);
              const maxT = Math.max(5, 95 - hPct);
              const leftPercent = 4 + Math.random() * (maxL - 4);
              const topPercent = 4 + Math.random() * (maxT - 4);
              const rotateDeg = Math.round((Math.random() - 0.5) * 36);
              poster._tempPos = { leftPercent, topPercent, rotateDeg };
            }
          }
        }

        // Apply final positions and display flags
        shuffled.forEach((poster) => {
          poster._dragOffsetX = 0;
          poster._dragOffsetY = 0;

          if (poster._tempPos) {
            poster.style.display = 'block';
            poster.style.top = `${poster._tempPos.leftPercent}%`; // note: standard style mapping
            poster.style.top = `${poster._tempPos.topPercent}%`;
            poster.style.left = `${poster._tempPos.leftPercent}%`;
            poster.dataset.rotation = `rotate(${poster._tempPos.rotateDeg}deg)`;
            poster.style.transform = `translate3d(0, 0, 0) rotate(${poster._tempPos.rotateDeg}deg)`;
          } else {
            poster.style.display = 'none';
          }
        });
      });
    }

    // Run once on initialization
    randomizePosters();

    // Bind event listener to the randomize button below the vent
    const randomizeBtn = document.getElementById('randomizePostersBtn');
    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', () => {
        randomizePosters();
      });
    }

    // Handle responsiveness on window resize
    window.addEventListener('resize', () => {
      randomizePosters();
    });

    // Make posters draggable
    columns.forEach(column => {
      const posters = column.querySelectorAll('.booth-poster');
      posters.forEach((poster) => {
        // Enable pointer events on the poster
        poster.style.pointerEvents = 'auto';
        poster.style.cursor = 'grab';

        let isDragging = false;
        let startX = 0;
        let startY = 0;

        poster.addEventListener('pointerdown', (ev) => {
          if (ev.button && ev.button !== 0) return;
          isDragging = true;
          poster.style.cursor = 'grabbing';
          poster.style.zIndex = '1000'; // bring to front

          poster.setPointerCapture(ev.pointerId);

          const ox = poster._dragOffsetX || 0;
          const oy = poster._dragOffsetY || 0;

          startX = ev.clientX - ox;
          startY = ev.clientY - oy;
          ev.stopPropagation();
        });

        poster.addEventListener('pointermove', (ev) => {
          if (!isDragging) return;

          const ox = poster._dragOffsetX || 0;
          const oy = poster._dragOffsetY || 0;

          let x = ev.clientX - startX;
          let y = ev.clientY - startY;

          // Constraint strictly within the riveted panel container!
          const panel = column.querySelector('.booth__panel--riveted') || column;
          const containerRect = panel.getBoundingClientRect();
          const posterRect = poster.getBoundingClientRect();

          const currentLeft = posterRect.left - ox;
          const currentTop = posterRect.top - oy;

          const minX = containerRect.left - currentLeft;
          const maxX = containerRect.right - currentLeft - posterRect.width;
          const minY = containerRect.top - currentTop;
          const maxY = containerRect.bottom - currentTop - posterRect.height;

          // Clamp offsets
          poster._dragOffsetX = Math.max(minX, Math.min(maxX, x));
          poster._dragOffsetY = Math.max(minY, Math.min(maxY, y));

          const rot = poster.dataset.rotation || 'rotate(0deg)';
          poster.style.transform = `translate3d(${poster._dragOffsetX}px, ${poster._dragOffsetY}px, 0) ${rot}`;
          ev.stopPropagation();
        });

        const stopDrag = (ev) => {
          if (!isDragging) return;
          isDragging = false;
          poster.style.cursor = 'grab';
          poster.style.zIndex = '';
          try {
            poster.releasePointerCapture(ev.pointerId);
          } catch(e) {}
        };

        poster.addEventListener('pointerup', stopDrag);
        poster.addEventListener('pointercancel', stopDrag);
      });
    });
  }

  document.addEventListener('keydown', ev => {
    if (ev.code === 'Space' || ev.code === 'Enter') {
      const target = ev.target;
      if (target?.tagName === 'BUTTON' || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      ev.preventDefault();
      if (Scenes.isInside() && !isBusy) $('captureBtn')?.click();
    }
    if (ev.code === 'Escape' && Scenes.isInside() && !isBusy) $('exitBtn')?.click();
  });
})();
