/* ============================================================
   scenes.js
   Scene orchestration:
   - Builds and renders the outside scene's Matter.js bodies
     (curtains, neon sign, hanging sign).
   - Drives the Enter / Exit sequences (cameraRig motion,
     curtain close/open, scene swap).
   ============================================================ */

window.Scenes = (function () {

  const { M } = window.Physics;
  const { Bodies, Body, Constraint, Composite, Mouse, MouseConstraint } = M;

  /* State */
  let curtain = null;
  let neonBody = null;
  let neonConstraint = null;
  let curtainMouseConstraint = null;

  let curtainRenderLoop = null;
  let outsideRenderLoop = null;
  let currentScene = 'outside';
  let isTransitioning = false;

  /* ---------- Initialize the outside scene ---------- */
  function initOutside() {
    _buildCurtains();
    _buildNeonSign();
    _startOutsideRenderLoop();
    Physics.start();
  }

  /* ---------- Curtains ---------- */
  function _buildCurtains() {
    const canvas = document.getElementById('curtainCanvas');
    if (!canvas) return;

    // Make sure canvas resolution matches its display size
    _resizeCurtainCanvas();

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Single curtain optimized for mobile devices (fewer columns/particles total)
    const cols = 22;
    const rows = 48;
    const spacing = Math.min(w / (cols * 1.05), (h * 0.94) / rows);

    // Single curtain covering the entire frame width
    curtain = new Cloth(canvas, {
      cols, rows, spacing,
      anchorY: 4,
      offsetX: 0,
      baseColor: '#5a1226',
      deepColor:   '#2a0712',
      lightColor:  '#8a1f3a',
      highlightColor: 'rgba(255,210,180,0.10)',
      stiffness: 0.88,
      damping: 0.18,
      mass: 0.006,
      closeDX: -(w * 0.96), // pull all the way left to reveal the entry
    });

    curtain.attach();

    const mouse = Mouse.create(canvas);
    curtainMouseConstraint = MouseConstraint.create(Physics.engine, {
      mouse,
      constraint: {
        stiffness: 0.94,
        angularStiffness: 0,
        render: { visible: false }
      }
    });
    Composite.add(Physics.engine.world, curtainMouseConstraint);

    // Pointer events for dragging the curtain
    _bindCurtainDrag(canvas);

    // Resize handling
    window.addEventListener('resize', () => {
      _resizeCurtainCanvas();
      curtain && curtain.resize();
    });
  }

  function _resizeCurtainCanvas() {
    const canvas = document.getElementById('curtainCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function _bindCurtainDrag(canvas) {
    let dragging = false;
    let startX = 0;
    let pullDistance = 0;

    const onDown = (ev) => {
      if (isTransitioning || currentScene !== 'outside') return;
      const pos = UI.pointerPos(ev, canvas);
      startX = pos.x;
      pullDistance = 0;
      const c = curtain.handlePointerDown(pos.x, pos.y);
      dragging = !!c;
      if (dragging) {
        ev.preventDefault();
        UI.disableSelection();
      }
    };
    const onMove = (ev) => {
      if (!dragging) return;
      const pos = UI.pointerPos(ev, canvas);
      pullDistance = Math.max(pullDistance, Math.abs(pos.x - startX));
      curtain.handlePointerMove(pos.x, pos.y);
      ev.preventDefault();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      curtain.handlePointerUp();
      UI.enableSelection();
      if (pullDistance > Math.max(90, canvas.clientWidth * 0.28)) enterBooth();
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  function _closeCurtains() {
    curtain && curtain.close('in');
  }

  function _openCurtains() {
    curtain && curtain.close('out');
  }

  /* ---------- Neon sign (Matter.js pendulum) ---------- */
  function _buildNeonSign() {
    const el = document.getElementById('neonSign');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement.getBoundingClientRect();

    // Center of the sign element relative to viewport
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Anchor point (top of chains) — slightly above the sign
    const ax = cx;
    const ay = rect.top - 6;

    // Create the body at the sign's position
    neonBody = Bodies.rectangle(cx, cy, rect.width, rect.height, {
      label: 'neon-sign',
      isStatic: true,
      collisionFilter: { group: -1, category: 0, mask: 0 }
    });

    Physics.add(neonBody);

    // Hover increases glow (CSS handles via :hover)
    // Click triggers flicker + a swing impulse
    el.addEventListener('click', () => {
      el.classList.add('is-flickering');
      setTimeout(() => el.classList.remove('is-flickering'), 1200);
    });
  }

  /* ---------- Outside render loop ---------- */
  function _startOutsideRenderLoop() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Clear the curtain canvas ONCE per frame, then draw both cloths.
      // (Each Cloth.draw() no longer clears — see cloth.js.)
      if (curtain) {
        const canvas = document.getElementById('curtainCanvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
      }

      // Curtains
      if (curtain) curtain.tick(dt);

      // Sync sign elements to their Matter.js bodies
      _syncSign('neonSign', neonBody);

      outsideRenderLoop = requestAnimationFrame(frame);
    }
    outsideRenderLoop = requestAnimationFrame(frame);
  }

  function _syncSign(id, body) {
    if (!body) return;
    const el = document.getElementById(id);
    if (!el) return;
    // The element's CSS already has transform: translateX(-50%) ...
    // We apply rotation based on the body angle, plus a small position offset
    // relative to the body's home.
    const dx = body.position.x - body.positionPrev.x;
    // Just rotate (the constraint keeps position roughly fixed)
    el.style.transform = `translateX(-50%) rotate(${body.angle}rad)`;
  }

  /* ---------- Enter sequence ---------- */
  async function enterBooth() {
    if (isTransitioning) return;
    if (currentScene !== 'outside') return;
    isTransitioning = true;

    const rig = document.getElementById('cameraRig');
    const outside = document.getElementById('sceneOutside');
    const inside = document.getElementById('sceneInside');
    const veil = document.getElementById('interiorVeil');
    const interiorDark = document.getElementById('interiorDark');

    // 1. Curtains begin closing (parallel with camera move)
    _closeCurtains();

    // 2. Camera slowly moves forward — scale up the rig (zoom into booth entrance)
    const tweenPromise = UI.tween({
      duration: 2200,
      ease: UI.ease.inOutHeavy,
      onUpdate: (e) => {
        const scale = 1 + 1.6 * e;
        const ty = 8 * e;
        rig.style.transform = `scale(${scale}) translateY(${ty}%)`;
      }
    });

    // 3. Interior dark (entrance frame) fades in as curtains close
    await UI.wait(900);
    interiorDark && interiorDark.classList.add('is-visible');

    // 4. World veil fades in to mask the upcoming scene swap
    await UI.wait(700);
    veil.classList.add('is-visible');

    // 5. Wait for the scale tween to finish
    await tweenPromise;

    // 6. Swap scenes (hidden by the veil)
    outside.hidden = true;
    inside.hidden = false;
    currentScene = 'inside';

    // 7. Reset cameraRig transform instantly (hidden by veil)
    rig.style.transition = 'none';
    rig.style.transform = 'scale(1)';
    void rig.offsetWidth;
    rig.style.transition = '';

    // 8. Curtains stay closed (they will reopen during the next exit sequence).
    //    Interior dark is no longer needed — the inside scene has its own walls.
    interiorDark && interiorDark.classList.remove('is-visible');

    // 9. Brief settle, then fade veil to reveal inside
    await UI.wait(150);
    veil.classList.remove('is-visible');
    await UI.wait(500);

    isTransitioning = false;

    // Notify app that we're inside
    document.dispatchEvent(new CustomEvent('scene:entered'));
  }

  /* ---------- Exit sequence ---------- */
  async function exitBooth() {
    if (isTransitioning) return;
    if (currentScene !== 'inside') return;
    isTransitioning = true;

    const rig = document.getElementById('cameraRig');
    const outside = document.getElementById('sceneOutside');
    const inside = document.getElementById('sceneInside');
    const veil = document.getElementById('interiorVeil');
    const interiorDark = document.getElementById('interiorDark');

    // 1. Veil fades in (stepping back through the curtain)
    veil.classList.add('is-visible');
    await UI.wait(500);

    // 2. Swap scenes (hidden by veil). Outside scene is now shown but
    //    cameraRig is at scale 1 — we need to set it to "zoomed in"
    //    to match the end-state of the enter sequence.
    inside.hidden = true;
    outside.hidden = false;
    currentScene = 'outside';

    // 3. Set rig transform to the "just entered" state instantly (hidden by veil)
    rig.style.transition = 'none';
    rig.style.transform = 'scale(2.6) translateY(8%)';
    void rig.offsetWidth;
    rig.style.transition = '';

    // 4. Curtains are still closed (from enter sequence). Now we reopen them
    //    as the camera pulls back.
    _openCurtains();
    interiorDark && interiorDark.classList.add('is-visible');

    // 5. Fade veil out
    veil.classList.remove('is-visible');

    // 6. Camera moves backward — tween rig from scale 2.6 back to 1
    await UI.tween({
      duration: 2200,
      ease: UI.ease.inOutHeavy,
      onUpdate: (e) => {
        const scale = 2.6 - 1.6 * e;
        const ty = 8 - 8 * e;
        rig.style.transform = `scale(${scale}) translateY(${ty}%)`;
      }
    });

    // 7. Interior dark fades out (curtains fully open)
    interiorDark && interiorDark.classList.remove('is-visible');

    isTransitioning = false;

    // Notify app — printer can activate
    document.dispatchEvent(new CustomEvent('scene:exited'));
  }

  /* ---------- Public getters ---------- */
  function isInside() { return currentScene === 'inside'; }
  function isOutside() { return currentScene === 'outside'; }
  function getScene() { return currentScene; }

  return {
    initOutside,
    enterBooth,
    exitBooth,
    isInside,
    isOutside,
    getScene,
    get isTransitioning() { return isTransitioning; }
  };
})();
