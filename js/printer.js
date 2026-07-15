/* ============================================================
   printer.js
   Handles the printing sequence (motor → emerge → stop → bounce)
   and the Matter.js-driven strip that the user pulls out.

   Public API:
     Printer.show(stripCanvas)   — reveal the printer stage
     Printer.startPrinting()     — begin the print sequence (Promise)
     Printer.enablePull(onReady) — enable Matter.js drag-to-pull
     Printer.hide()              — tear down
     Printer.onDownload(cb)      — register download handler
   ============================================================ */

window.Printer = (function () {

  const stage = () => document.getElementById('printerStage');
  const lamp = () => document.getElementById('printerLamp');
  const motor = () => document.getElementById('printerMotor');
  const instr = () => document.getElementById('printerInstruction');
  const downloadBtn = () => document.getElementById('downloadBtn');
  const stripCanvasEl = () => document.getElementById('stripCanvas');
  const preview = () => document.getElementById('stripPreview');
  const previewCanvas = () => document.getElementById('previewCanvas');
  const nameInput = () => document.getElementById('previewName');
  const dateInput = () => document.getElementById('previewDateInput');
  const applyDetailsBtn = () => document.getElementById('applyDetailsBtn');

  let stripImage = null;     // the finished strip canvas (image source)
  let baseStripImage = null; // untouched strip used for detail edits
  let stripBody = null;
  let stripConstraint = null;  // anchor at slot
  let pullActive = false;
  let detached = false;
  let dragBody = null;
  let renderLoop = null;
  let downloadCb = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- Show / hide ---------- */
  function show(stripCanvas) {
    stripImage = stripCanvas;
    baseStripImage = stripCanvas;
    const s = stage();
    s.hidden = false;
    // Reset state
    detached = false;
    pullActive = false;
    stage().classList.remove('is-preview');
    if (preview()) preview().hidden = true;
    if (nameInput()) nameInput().value = '';
    if (dateInput()) dateInput().value = '';
    downloadBtn().classList.remove('is-ready');
    downloadBtn().disabled = true;
    document.getElementById('newPhotoBtn').classList.remove('is-ready');
    instr().textContent = 'PRINTING…';
    instr().classList.remove('is-prompt');
  }

  function hide() {
    _stopRender();
    _teardownStrip();
    const s = stage();
    if (s) s.hidden = true;
    if (preview()) preview().hidden = true;
  }

  /* ---------- Printing sequence ---------- */
  async function startPrinting() {
    lamp().classList.add('is-active');
    instr().textContent = 'PRINTING…';
    instr().classList.remove('is-prompt');

    // Motor hum
    motor().classList.add('is-active');
    await UI.wait(300);

    // The strip slowly emerges — done via Matter.js body translation
    _setupStrip();
    _startRender();

    // Emerge animation: move the strip downward from its hidden start position
    // to its "hang partially outside" position.
    const targetY = _emergeTargetY();
    await _emergeStrip(targetY, 2200);

    // Mechanical stop + small bounce
    motor().classList.remove('is-active');
    await _bounceStrip();

    // Lamp steady
    lamp().classList.remove('is-active');

    instr().textContent = 'PULL STRIP DOWN TO REMOVE';
    instr().classList.add('is-prompt');
  }

  /* ---------- Enable drag-to-pull ---------- */
  function enablePull(onReady) {
    pullActive = true;
    downloadCb = onReady;

    const canvas = stripCanvasEl();
    if (!canvas) return;

    const onDown = (ev) => {
      if (!pullActive || detached) return;
      ev.preventDefault();
      const pos = UI.pointerPos(ev, canvas);
      // Try to grab the strip body if pointer is over it
      if (_isOverStrip(pos.x, pos.y)) {
        dragBody = stripBody;
        UI.disableSelection();
      }
    };
    const onMove = (ev) => {
      if (!dragBody) return;
      ev.preventDefault();
      const pos = UI.pointerPos(ev, canvas);
      // Move body toward pointer
      const { Body } = Physics.M;
      Body.setPosition(stripBody, { x: pos.x, y: pos.y });
      Body.setVelocity(stripBody, { x: 0, y: 0 });
      Body.setAngularVelocity(stripBody, 0);

      // Check detach threshold
      if (stripBody.position.y > _detachThreshold()) {
        _detach();
      }
    };
    const onUp = () => {
      dragBody = null;
      UI.enableSelection();
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // Stash for cleanup
    _cleanup = () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }

  let _cleanup = () => {};

  /* ---------- Internal: setup Matter.js strip body ---------- */
  function _setupStrip() {
    const { M } = Physics;
    const { Bodies, Body, Constraint } = M;

    const canvas = stripCanvasEl();
    _resizeCanvas();

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Strip dimensions in canvas-local px
    const stripW = Math.min(180, w * 0.32);
    const stripH = stripImage ? (stripW * stripImage.height / stripImage.width) : stripW * 3;

    // Start the strip hidden above the slot (y is negative)
    const startX = w / 2;
    const startY = -stripH / 2 + 8; // only the very tip is in the slot

    stripBody = Bodies.rectangle(startX, startY, stripW, stripH, {
      frictionAir: 0.04,
      density: 0.0012,
      mass: 0.05,
      label: 'photo-strip',
      isStatic: false,
      collisionFilter: { group: -1, category: 0, mask: 0 }
    });
    Body.setStatic(stripBody, true); // hold during emerge

    // Anchor to slot top — pointB is in world space at slot center
    stripConstraint = Constraint.create({
      bodyA: stripBody,
      pointA: { x: 0, y: -stripH / 2 },
      pointB: { x: startX, y: 14 }, // just below slot lip
      stiffness: 0.9,
      damping: 0.2,
      length: 0,
      render: { visible: false }
    });

    Physics.add(stripBody);
    Physics.add(stripConstraint);
  }

  function _teardownStrip() {
    if (stripConstraint) { Physics.remove(stripConstraint); stripConstraint = null; }
    if (stripBody)       { Physics.remove(stripBody); stripBody = null; }
    _cleanup();
    _cleanup = () => {};
  }

  /* ---------- Internal: emerge animation ---------- */
  function _emergeTargetY() {
    const canvas = stripCanvasEl();
    const h = canvas.clientHeight;
    // Hang about 55% of the strip below the slot
    return h * 0.32;
  }

  function _detachThreshold() {
    const canvas = stripCanvasEl();
    return canvas.clientHeight * 0.7;
  }

  async function _emergeStrip(targetY, duration) {
    const { Body } = Physics.M;
    const startY = stripBody.position.y;
    await UI.tween({
      duration,
      ease: UI.ease.inOutCubic,
      onUpdate: (e) => {
        const y = startY + (targetY - startY) * e;
        Body.setPosition(stripBody, { x: stripBody.position.x, y });
      }
    });
  }

  async function _bounceStrip() {
    const { Body } = Physics.M;
    const y = stripBody.position.y;
    // Quick down-up-down wiggle
    await UI.tween({
      duration: 180,
      ease: UI.ease.outCubic,
      onUpdate: e => Body.setPosition(stripBody, { x: stripBody.position.x, y: y + 6 * e })
    });
    await UI.tween({
      duration: 220,
      ease: UI.ease.outBack,
      onUpdate: e => Body.setPosition(stripBody, { x: stripBody.position.x, y: y + 6 - 6 * e })
    });
    Body.setPosition(stripBody, { x: stripBody.position.x, y });
  }

  /* ---------- Internal: detach ---------- */
  function _detach() {
    if (detached) return;
    detached = true;
    dragBody = null;
    // Release anchor
    if (stripConstraint) {
      Physics.remove(stripConstraint);
      stripConstraint = null;
    }
    // The physical strip has been pulled free. Remove its simulated body
    // instead of releasing it into gravity; the finished image becomes a
    // stable, zoomed preview immediately.
    _stopRender();
    if (stripBody) {
      Physics.remove(stripBody);
      stripBody = null;
    }

    instr().textContent = 'PRINT COMPLETE';
    instr().classList.remove('is-prompt');
    _showPreview();
    downloadBtn().disabled = false;
    downloadBtn().classList.add('is-ready');
    document.getElementById('newPhotoBtn').classList.add('is-ready');
  }

  function _showPreview() {
    const s = stage();
    const card = preview();
    const canvas = previewCanvas();
    if (!s || !card || !canvas || !stripImage) return;
    s.classList.add('is-preview');
    card.hidden = false;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const fit = Math.min(rect.width / stripImage.width, rect.height / stripImage.height);
    const w = stripImage.width * fit;
    const h = stripImage.height * fit;
    ctx.drawImage(stripImage, (rect.width - w) / 2, (rect.height - h) / 2, w, h);
  }

  function _applyDetails() {
    if (!baseStripImage) return;
    const name = nameInput()?.value.trim() || '';
    const rawDate = dateInput()?.value || '';
    if (!name && !rawDate) {
      UI.toast('Add a name or date first.');
      return;
    }

    const footerHeight = Math.max(84, Math.round(baseStripImage.width * 0.1));
    const detailed = document.createElement('canvas');
    detailed.width = baseStripImage.width;
    detailed.height = baseStripImage.height + footerHeight;
    const ctx = detailed.getContext('2d');
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(0, 0, detailed.width, detailed.height);
    ctx.drawImage(baseStripImage, 0, 0);
    ctx.fillStyle = '#292b35';
    ctx.fillRect(0, baseStripImage.height, detailed.width, 2);
    ctx.fillStyle = '#292b35';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.max(18, Math.round(baseStripImage.width * 0.035))}px Arial, sans-serif`;
    const dateText = rawDate ? new Date(`${rawDate}T00:00:00`).toLocaleDateString() : '';
    ctx.fillText([name, dateText].filter(Boolean).join('  ·  '), detailed.width / 2, baseStripImage.height + footerHeight / 2);
    stripImage = detailed;
    _showPreview();
    applyDetailsBtn().textContent = 'DETAILS ADDED';
  }

  /* ---------- Internal: render loop ---------- */
  function _startRender() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      _drawStrip();
      renderLoop = requestAnimationFrame(frame);
    }
    renderLoop = requestAnimationFrame(frame);
  }

  function _stopRender() {
    if (renderLoop) {
      cancelAnimationFrame(renderLoop);
      renderLoop = null;
    }
  }

  function _drawStrip() {
    const canvas = stripCanvasEl();
    if (!canvas || !stripBody) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Only draw the portion of the strip that is below the slot lip (y > 0)
    // We do this by clipping.
    ctx.beginPath();
    ctx.rect(0, 14, w, h - 14);
    ctx.clip();

    const pos = stripBody.position;
    const angle = stripBody.angle;
    const sw = stripBody.bounds.max.x - stripBody.bounds.min.x;
    const sh = stripBody.bounds.max.y - stripBody.bounds.min.y;

    if (stripImage) {
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      ctx.drawImage(
        stripImage,
        -sw / 2,
        -sh / 2,
        sw,
        sh
      );

      // Subtle drop shadow on the strip
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;
    }

    ctx.restore();
  }

  function _isOverStrip(x, y) {
    if (!stripBody) return false;
    // AABB check on body bounds
    const b = stripBody.bounds;
    return x >= b.min.x - 6 && x <= b.max.x + 6 && y >= b.min.y - 6 && y <= b.max.y + 6;
  }

  function _resizeCanvas() {
    const canvas = stripCanvasEl();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- Inline preview & developing animations ---------- */
  function showInline(stripCanvas) {
    stripImage = stripCanvas;
    baseStripImage = stripCanvas;
    
    const card = preview();
    if (!card) return;
    
    // Add the preview mode class to the inside scene to blur the background
    const insideScene = document.getElementById('sceneInside');
    if (insideScene) {
      insideScene.classList.add('is-preview');
    }
    
    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.hidden = false;
    
    card.hidden = false;
    
    // Reset inputs
    if (nameInput()) nameInput().value = '';
    if (dateInput()) dateInput().value = '';
    downloadBtn().disabled = true;
    downloadBtn().classList.remove('is-ready');
    document.getElementById('newPhotoBtn').classList.remove('is-ready');
    
    // Trigger the dynamic developing animation
    _drawDevelopingPolaroid();
  }

  function hideInline() {
    const card = preview();
    if (card) {
      card.hidden = true;
      card.classList.remove('is-magnified');
    }
    
    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.hidden = true;
    
    const insideScene = document.getElementById('sceneInside');
    if (insideScene) {
      insideScene.classList.remove('is-preview');
    }
    
    stripImage = null;
    baseStripImage = null;
  }

  function _drawDevelopingPolaroid() {
    const canvas = previewCanvas();
    const card = preview();
    if (!canvas || !stripImage || !card) return;
    
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    
    // Calculate display dimensions dynamically based on strip aspect ratio (foolproof against layout racing)
    const aspect = stripImage.height / stripImage.width;
    const isMobile = window.innerWidth <= 600;
    const displayWidth = isMobile ? Math.min(150, window.innerWidth * 0.40) : Math.min(230, window.innerWidth * 0.46);
    const displayHeight = displayWidth * aspect;
    
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.style.display = 'block';
    
    canvas.width = Math.round(displayWidth * scale);
    canvas.height = Math.round(displayHeight * scale);
    
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    
    // Click on canvas to toggle magnification zoom!
    if (!canvas.dataset.hasZoomListener) {
      canvas.addEventListener('click', () => {
        card.classList.toggle('is-magnified');
      });
      canvas.dataset.hasZoomListener = 'true';
    }
    
    let start = null;
    const duration = 1800; // 1.8 seconds developing time
    
    function drawStep(timestamp) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // 1. Draw paper substrate (blank white/vintage paper)
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Paper border stroke
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);
      
      // 2. Compute fading opacity: blank for first 0.35s (20% progress), then fade in!
      let opacity = 0;
      if (progress > 0.2) {
        opacity = (progress - 0.2) / 0.8;
        opacity = opacity * opacity; 
      }
      
      ctx.globalAlpha = opacity;
      ctx.drawImage(stripImage, 0, 0, displayWidth, displayHeight);
      ctx.globalAlpha = 1.0; // reset
      
      if (progress < 1) {
        requestAnimationFrame(drawStep);
      } else {
        // Developing is complete! Enable download and new photo buttons!
        downloadBtn().disabled = false;
        downloadBtn().classList.add('is-ready');
        document.getElementById('newPhotoBtn').classList.add('is-ready');
      }
    }
    
    requestAnimationFrame(drawStep);
  }

  /* ---------- Download button ---------- */
  function onDownload(cb) {
    downloadBtn().addEventListener('click', () => {
      cb(stripImage);
    });
  }

  /* ---------- New Photo button ---------- */
  function onNewPhoto(cb) {
    document.getElementById('newPhotoBtn').addEventListener('click', () => {
      hideInline();
      cb();
    });
  }

  /* ---------- Resize handler ---------- */
  window.addEventListener('resize', () => {
    if (stage() && !stage().hidden) _resizeCanvas();
  });

  applyDetailsBtn()?.addEventListener('click', _applyDetails);

  return {
    show,
    startPrinting,
    enablePull,
    hide,
    showInline,
    hideInline,
    onDownload,
    onNewPhoto,
  };
})();
