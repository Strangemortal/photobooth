/* ============================================================
   printer.js
   Handles the printing sequence (motor → emerge → stop → bounce)
   and a custom physics-free 2D canvas simulation of the photo strip.
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
  let currentCaptures = null;
  let currentState = null;
  let pullActive = false;
  let detached = false;
  let hasDeveloped = false;
  let renderLoop = null;
  let downloadCb = null;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Simulation physics parameters
  let emergeProgress = 0; // 0 to 1 during automatic printing
  let isPrinting = false;
  let printTime = 0;

  let stripY = 0;         // current vertical position of the strip relative to the slot
  let targetStripY = 0;
  let stripX = 0;         // current horizontal displacement
  let stripAngle = 0;     // swing angle in radians
  let angleVelocity = 0;  // angular velocity for swaying
  
  let isDragging = false;
  let dragStartMouseY = 0;
  let dragStartStripY = 0;
  
  let onPullComplete = null;

  /* ---------- Show / hide ---------- */
  function show(stripCanvas, captures, state) {
    stripImage = stripCanvas;
    baseStripImage = stripCanvas;
    currentCaptures = captures;
    currentState = state;
    detached = false;
    pullActive = false;
    isPrinting = false;
    emergeProgress = 0;
    stripY = 0;
    targetStripY = 0;
    stripX = 0;
    stripAngle = 0;
    angleVelocity = 0;
    isDragging = false;

    // Reset instruction classes
    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'PRINTING PHOTO STRIP...';
      inEl.className = 'printer-stage__instruction is-prompt';
    }

    const st = stage();
    if (st) st.hidden = false;

    const lp = lamp();
    if (lp) {
      lp.style.backgroundColor = '#ff3b30'; // red during print
      lp.classList.add('is-printing');
    }

    _resizeCanvas();
    _startRender();
  }

  function hide() {
    _stopRender();
    const st = stage();
    if (st) st.hidden = true;

    const lp = lamp();
    if (lp) {
      lp.style.backgroundColor = '';
      lp.classList.remove('is-printing');
    }

    const mt = motor();
    if (mt) mt.classList.remove('is-active');

    stripImage = null;
    baseStripImage = null;
  }

  /* ---------- Printing emerge sequence ---------- */
  function startPrinting() {
    return new Promise((resolve) => {
      isPrinting = true;
      printTime = 0;
      emergeProgress = 0;

      const mt = motor();
      if (mt) mt.classList.add('is-active');

      // Compute emerge target from the canvas height so the strip actually comes out
      const canvas = stripCanvasEl();
      // The slot lip is at y=14. Strip starts with bottom at y=14 (entirely hidden).
      // It needs to travel until its bottom is near the canvas bottom.
      // canvasH / dpr gives the CSS pixel height. We want most of the strip visible.
      const canvasH = canvas ? (canvas.height / dpr) : 340;
      // sh (strip height in CSS px) = sw * 2.5 = (canvasW * 0.65) * 2.5
      const canvasW = canvas ? (canvas.width / dpr) : 280;
      const sw = Math.round(canvasW * 0.65);
      const sh = Math.round(sw * 2.5);
      // Strip center at emerge-end: cy = canvasH - 30
      // cy = 14 + emergeTarget - sh/2  =>  emergeTarget = canvasH - 30 - 14 + sh/2
      const emergeTarget = Math.max(sh * 0.8, canvasH - 44 + sh / 2);

      function step() {
        if (!isPrinting) return;
        
        // Emerge over 3.0 seconds with eased motion
        printTime += 16.67;
        const rawProgress = Math.min(1, printTime / 3000);
        // Ease-out cubic for natural deceleration
        emergeProgress = 1 - Math.pow(1 - rawProgress, 3);
        
        stripY = emergeProgress * emergeTarget;
        
        // Wiggle horizontally slightly to simulate motor gears printing
        stripX = Math.sin(printTime * 0.05) * 1.2 * (1 - rawProgress);

        if (rawProgress < 1) {
          requestAnimationFrame(step);
        } else {
          // Finish printing
          isPrinting = false;
          if (mt) mt.classList.remove('is-active');
          
          const lp = lamp();
          if (lp) {
            lp.style.backgroundColor = '#34c759'; // green when ready
            lp.classList.remove('is-printing');
          }

          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }

  /* ---------- Interactive dragging ---------- */
  function enablePull(onReady) {
    pullActive = true;
    onPullComplete = onReady;

    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'PULL STRIP TO DETACH';
      inEl.classList.add('is-pulse');
    }

    const canvas = stripCanvasEl();
    if (!canvas) return;

    // Remove existing if any
    canvas.onmousedown = null;
    canvas.ontouchstart = null;

    canvas.addEventListener('mousedown', _onPointerDown);
    canvas.addEventListener('touchstart', _onPointerDown, { passive: false });
  }

  function _onPointerDown(ev) {
    if (!pullActive || detached) return;
    
    ev.preventDefault();
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    
    // Bounds check to verify if the user clicked the strip
    const canvas = stripCanvasEl();
    const rect = canvas.getBoundingClientRect();
    const clickX = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const clickY = clientY - rect.top;

    // Check if click was roughly within the strip horizontal area and below the slot lip (y > 14)
    const midX = rect.width / 2;
    const stripWidth = 140; // width of strip on canvas
    if (clickX < midX - stripWidth / 2 - 10 || clickX > midX + stripWidth / 2 + 10 || clickY < 14) {
      return;
    }

    isDragging = true;
    dragStartMouseY = clientY;
    dragStartStripY = stripY;

    window.addEventListener('mousemove', _onPointerMove);
    window.addEventListener('touchmove', _onPointerMove, { passive: false });
    window.addEventListener('mouseup', _onPointerUp);
    window.addEventListener('touchend', _onPointerUp);
  }

  function _onPointerMove(ev) {
    if (!isDragging) return;
    ev.preventDefault();

    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const deltaY = clientY - dragStartMouseY;

    // Pulling down only (no pushing back into the machine)
    if (deltaY > 0) {
      stripY = dragStartStripY + deltaY;
      
      // Pulling past 340px detaches the strip completely
      if (stripY > 340) {
        _detachStrip();
      }
    }
  }

  function _onPointerUp() {
    isDragging = false;
    window.removeEventListener('mousemove', _onPointerMove);
    window.removeEventListener('touchmove', _onPointerMove);
    window.removeEventListener('mouseup', _onPointerUp);
    window.removeEventListener('touchend', _onPointerUp);
  }

  function _detachStrip() {
    if (detached) return;
    detached = true;
    isDragging = false;
    
    // Animate falling off — use canvas pixel height
    const canvas = stripCanvasEl();
    const canvasH = canvas ? (canvas.height / dpr) : 340;
    const targetY = stripY + canvasH + 200;

    const inEl = instr();
    if (inEl) {
      inEl.textContent = 'SAVED TO HAND';
      inEl.className = 'printer-stage__instruction is-success';
    }

    // Trigger download panel enable
    if (onPullComplete) {
      onPullComplete();
    }

    // Swings and slides down completely off screen
    let t = 0;
    function fall() {
      t += 0.04;
      stripY += (targetY - stripY) * 0.16;
      stripAngle += 0.08 * Math.sin(t);
      if (stripY < targetY - 1) {
        requestAnimationFrame(fall);
      } else {
        // Finished falling, hide printer screen and open inline preview
        hide();
        showInline(stripImage);
      }
    }
    requestAnimationFrame(fall);
  }

  /* ---------- Canvas rendering ---------- */
  function _showPreview(instant = false) {
    // Redraws the static canvas inside the details overlay
    _drawDevelopingPolaroid(instant);
  }

  function _rebuildAndShow() {
    if (!currentCaptures || !currentState) return;

    const filterEl = document.getElementById('filterSelect');
    const selectedFilter = filterEl?.value || 'vintage';

    // 1. Build the updated strip from captures with the chosen filterStyle!
    const newStrip = Strip.build(currentCaptures, {
      paperStyle: currentState.paperStyle,
      aspectRatio: currentState.aspectRatio,
      filterStyle: selectedFilter,
      timestamp: { enabled: false, format: 'DMY_HM', date: null },
      maxWidth: currentState.downloadQuality === 'high' ? 1200 : 720,
    });

    baseStripImage = newStrip;

    // 2. Re-apply name/date if already filled/submitted
    const name = nameInput()?.value.trim() || '';
    const rawDate = dateInput()?.value || '';

    if (name || rawDate) {
      const footerHeight = Math.max(84, Math.round(newStrip.width * 0.1));
      const detailed = document.createElement('canvas');
      detailed.width = newStrip.width;
      detailed.height = newStrip.height + footerHeight;
      
      const ctx = detailed.getContext('2d');
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(0, 0, detailed.width, detailed.height);
      ctx.drawImage(newStrip, 0, 0);
      ctx.fillStyle = '#292b35';
      ctx.fillRect(0, newStrip.height, detailed.width, 2);
      ctx.fillStyle = '#292b35';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(18, Math.round(newStrip.width * 0.035))}px Arial, sans-serif`;
      
      const dateText = rawDate ? new Date(`${rawDate}T00:00:00`).toLocaleDateString() : '';
      ctx.fillText([name, dateText].filter(Boolean).join('  ·  '), detailed.width / 2, newStrip.height + footerHeight / 2);
      
      stripImage = detailed;
    } else {
      stripImage = newStrip;
    }

    _showPreview(true);
  }

  function _applyDetails() {
    if (!currentCaptures) return;
    const name = nameInput()?.value.trim() || '';
    const rawDate = dateInput()?.value || '';
    if (!name && !rawDate) {
      UI.toast('Add a name or date first.');
      return;
    }
    _rebuildAndShow();
    if (applyDetailsBtn()) applyDetailsBtn().textContent = 'DETAILS ADDED';
  }

  /* ---------- Internal: render loop ---------- */
  function _startRender() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      _drawStrip(dt);
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

  function _drawStrip(dt) {
    const canvas = stripCanvasEl();
    if (!canvas) return;
    
    // Use the actual canvas pixel dimensions (set by _resizeCanvas)
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    if (w <= 0 || h <= 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.save();
    
    // Fill with transparent background (not white)
    ctx.clearRect(0, 0, w, h);

    // Only draw the portion of the strip that is below the slot lip (y > 14)
    ctx.beginPath();
    ctx.rect(0, 14, w, h - 14);
    ctx.clip();

    // If not dragging and not detached, snap to final emerge position
    if (!isDragging && !detached && !isPrinting) {
      const canvasH = h;
      const sw2 = Math.round(w * 0.65);
      const sh2 = Math.round(sw2 * 2.5);
      const finalY = Math.max(sw2 * 0.8, canvasH - 44 + sh2 / 2);
      stripY += (finalY - stripY) * 0.16;
    }

    // Pendulum swing swaying math
    if (!isDragging && !detached) {
      const springK = -1.2;
      const dampingForce = -0.92;
      const torque = springK * stripAngle;
      angleVelocity += torque * dt;
      angleVelocity *= dampingForce;
      stripAngle += angleVelocity * dt * 45;
    } else if (isDragging) {
      // Rotate based on dragging drag sways
      stripAngle = -Math.sin(performance.now() * 0.005) * 0.035;
    }

    // Scale strip display width to the canvas width
    const sw = Math.round(w * 0.65);
    const sh = Math.round(sw * 2.5); // photo strip is tall
    const cx = w / 2 + stripX;
    
    // Slot is at Y = 14. Top of strip starts emerging from Y=14
    const cy = 14 + stripY - sh / 2;

    if (stripImage) {
      ctx.translate(cx, cy);
      ctx.rotate(stripAngle);

      // Subtle drop shadow on the paper strip
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      ctx.drawImage(
        stripImage,
        -sw / 2,
        -sh / 2,
        sw,
        sh
      );
    }

    ctx.restore();
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
  function showInline(stripCanvas, captures, state) {
    if (stripCanvas) {
      stripImage = stripCanvas;
      baseStripImage = stripCanvas;
    }
    if (captures) currentCaptures = captures;
    if (state) currentState = state;
    hasDeveloped = false;
    
    const card = preview();
    if (!card) return;
    
    const overlay = document.getElementById('previewOverlay');
    if (overlay) overlay.hidden = false;
    
    card.hidden = false;
    
    // Reset inputs
    if (nameInput()) nameInput().value = '';
    if (dateInput()) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateInput().value = `${yyyy}-${mm}-${dd}`;
    }
    
    const filterEl = document.getElementById('filterSelect');
    if (filterEl) filterEl.value = 'vintage';

    // Download needs details first; New Photo is always available
    downloadBtn().disabled = true;
    downloadBtn().classList.remove('is-ready');
    applyDetailsBtn().textContent = 'ADD DETAILS';
    
    // newPhotoBtn is always immediately visible so user can restart
    const newBtn = document.getElementById('newPhotoBtn');
    if (newBtn) newBtn.classList.add('is-ready');
    
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
    
    stripImage = null;
    baseStripImage = null;
  }

  function _drawDevelopingPolaroid(instant = false) {
    const canvas = previewCanvas();
    const card = preview();
    if (!canvas || !stripImage || !card) return;
    
    const scale = Math.min(window.devicePixelRatio || 1, 2);
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
    
    if (!canvas.dataset.hasZoomListener) {
      canvas.addEventListener('click', () => {
        card.classList.toggle('is-magnified');
      });
      canvas.dataset.hasZoomListener = 'true';
    }
    
    if (instant || hasDeveloped) {
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(stripImage, 0, 0, displayWidth, displayHeight);
      
      downloadBtn().disabled = false;
      downloadBtn().classList.add('is-ready');
      document.getElementById('newPhotoBtn').classList.add('is-ready');
      return;
    }
    
    let start = null;
    const duration = 1800; // 1.8 seconds developing time
    
    function drawStep(timestamp) {
      if (hasDeveloped) return; // abort fade-in if instant redraw overrides it
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // 1. Draw paper substrate
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);
      
      // 2. Fading opacity
      let opacity = 0;
      if (progress > 0.2) {
        opacity = (progress - 0.2) / 0.8;
        opacity = opacity * opacity; 
      }
      
      ctx.globalAlpha = opacity;
      ctx.drawImage(stripImage, 0, 0, displayWidth, displayHeight);
      ctx.globalAlpha = 1.0;
      
      if (progress < 1) {
        requestAnimationFrame(drawStep);
      } else {
        hasDeveloped = true;
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

  /* ---------- Emerge from physical slot on the booth body ---------- */
  function emergeFromSlot(slotEl, stripCanvas, captures, state) {
    return new Promise(resolve => {
      if (!slotEl || !stripCanvas) { resolve(); return; }

      // Store for showInline later
      stripImage      = stripCanvas;
      baseStripImage  = stripCanvas;
      currentCaptures = captures;
      currentState    = state;

      // Find the dark mouth opening inside the slot
      const mouthEl = slotEl.querySelector('.printer-slot__mouth') || slotEl;
      const mouthRect = mouthEl.getBoundingClientRect();

      // Strip width = exact mouth width
      const stripW = Math.round(mouthRect.width);
      // Natural aspect ratio of the strip canvas
      const aspect  = stripCanvas.height / stripCanvas.width;
      const stripH  = Math.round(stripW * aspect);

      // ── Outer wrapper: clips to what's below the mouth ──────────────
      // Positioned right at the mouth bottom edge, full strip height but
      // overflow:hidden — so content starting at translateY(-100%) is invisible.
      const wrapper = document.createElement('div');
      wrapper.id = 'emergingStripWrapper';
      Object.assign(wrapper.style, {
        position:     'absolute',
        left:         '50%',
        transform:    'translateX(-50%)',
        top:          '100%',
        width:        '100%',
        height:       `${stripH}px`,
        overflow:     'hidden',
        zIndex:       '200',
        borderRadius: '0 0 3px 3px',
        boxShadow:    '2px 8px 20px rgba(0,0,0,0.6)',
        pointerEvents:'none',
      });

      // ── Inner strip image: starts fully above the wrapper (hidden) ──
      // translateY(-100%) means the whole image sits above the wrapper's top
      // which is hidden by overflow:hidden → looks like it's inside the machine
      const img = new Image();
      img.src = stripCanvas.toDataURL('image/png');
      Object.assign(img.style, {
        width:     '100%',
        height:    `${stripH}px`,
        display:   'block',
        transform: 'translateY(-100%)',
        // GPU-accelerated ease-out for smooth film feed
        transition: 'transform 3.6s cubic-bezier(0.25, 0.1, 0.1, 1.0)',
        willChange: 'transform',
      });

      wrapper.appendChild(img);
      mouthEl.appendChild(wrapper);

      // Slot shimmy while printing
      slotEl.classList.add('is-printing');

      // Trigger slide — must be after element is in DOM & painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          img.style.transform = 'translateY(0%)';
        });
      });

      // Resolve when transition ends (3.6s + 200ms buffer)
      const DURATION = 3800;
      setTimeout(() => {
        slotEl.classList.remove('is-printing');
        resolve(wrapper);
      }, DURATION);
    });
  }

  /* Cleanup any emerging strip wrapper */
  function removeEmergingStrip() {
    const el = document.getElementById('emergingStripWrapper');
    if (el) el.remove();
  }

  /* ---------- Resize handler ---------- */
  window.addEventListener('resize', () => {
    if (stage() && !stage().hidden) _resizeCanvas();
  });

  applyDetailsBtn()?.addEventListener('click', _applyDetails);
  document.getElementById('filterSelect')?.addEventListener('change', _rebuildAndShow);

  // Set default date input value to today's date in local timezone
  const dEl = dateInput();
  if (dEl) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dEl.value = `${yyyy}-${mm}-${dd}`;
  }

  return {
    show,
    startPrinting,
    enablePull,
    hide,
    showInline,
    hideInline,
    emergeFromSlot,
    removeEmergingStrip,
    onDownload,
    onNewPhoto,
  };
})();
