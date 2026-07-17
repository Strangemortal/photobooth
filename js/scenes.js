/* ============================================================
   scenes.js
   Orchestrates the outside and inside scenes, transitions, and sways.
   Operates the Three.js curtains and the custom neon sign pendulum.
   ============================================================ */

window.Scenes = (function () {

  let currentScene = 'outside';
  let isTransitioning = false;

  let curtain = null;
  let outsideRenderLoop = null;

  // Custom pendulum variables for neon sign
  let neonAngle = 0;
  let neonAngularVelocity = 0;
  const neonDamping = 0.985; // Air resistance damping

  /* ---------- Initialize the outside scene ---------- */
  function initOutside() {
    _buildCurtains();
    _buildNeonSign();
    _startOutsideRenderLoop();
  }

  function _buildCurtains() {
    const canvas = document.getElementById('curtainCanvas');
    if (!canvas) return;

    _resizeCurtainCanvas();

    // Create the Three.js cloth instance
    curtain = new Cloth(canvas, {
      cols: 30,
      rows: 30,
      stiffness: 0.98,
      closeDX: -300
    });

    curtain.attach();
    _bindCurtainDrag(canvas);

    window.addEventListener('resize', () => {
      _resizeCurtainCanvas();
      if (curtain) curtain.resize();
    });
  }

  function _resizeCurtainCanvas() {
    const canvas = document.getElementById('curtainCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  /* Bind pointer events for pulling the curtain */
  function _bindCurtainDrag(canvas) {
    let startX = 0;
    let pullDistance = 0;
    let dragging = false;

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
      const deltaX = pos.x - startX;

      // Slide the correct curtain depending on which side was grabbed
      const dragSide = curtain.state.dragSide;
      if (dragSide === 'left' && deltaX < 0) {
        curtain.setAnchorOffset(deltaX);
        pullDistance = Math.abs(deltaX);
      } else if (dragSide === 'right' && deltaX > 0) {
        curtain.setAnchorOffset(deltaX);
        pullDistance = Math.abs(deltaX);
      } else {
        curtain.setAnchorOffset(0);
        pullDistance = 0;
      }

      curtain.handlePointerMove(pos.x, pos.y);
      ev.preventDefault();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      curtain.handlePointerUp();
      UI.enableSelection();
      
      // Require pulling either curtain at least 35% of the total width to open camera
      if (pullDistance > canvas.clientWidth * 0.35) {
        enterBooth();
      } else {
        curtain.close('out'); // Snap closed
      }
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

  /* ---------- Neon sign Pendulum ---------- */
  function _buildNeonSign() {
    const el = document.getElementById('neonSign');
    if (!el) return;

    // Hover triggers flicker and swing impulse
    el.addEventListener('click', () => {
      el.classList.add('is-flickering');
      setTimeout(() => el.classList.remove('is-flickering'), 1200);
      
      // Inject random angular velocity push
      neonAngularVelocity += (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.15);
    });
  }

  /* ---------- Outside render loop ---------- */
  function _startOutsideRenderLoop() {
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Curtains tick (Three.js handles canvas clearing itself)
      if (curtain) curtain.tick(dt);

      // Solve pendulum swing for neon sign
      const torque = -0.06 * Math.sin(neonAngle);
      neonAngularVelocity += torque;
      neonAngularVelocity *= neonDamping;
      neonAngle += neonAngularVelocity * dt * 30;

      // Sync neon sign rotation
      const el = document.getElementById('neonSign');
      if (el) {
        el.style.transform = `translateX(-50%) rotate(${neonAngle}rad)`;
      }

      outsideRenderLoop = requestAnimationFrame(frame);
    }
    outsideRenderLoop = requestAnimationFrame(frame);
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

    // 8. Curtains stay closed
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

    // 1. Veil fades in
    veil.classList.add('is-visible');
    await UI.wait(500);

    // 2. Swap scenes
    inside.hidden = true;
    outside.hidden = false;
    currentScene = 'outside';

    // 3. Set rig transform to the "just entered" state instantly (hidden by veil)
    rig.style.transition = 'none';
    rig.style.transform = 'scale(2.6) translateY(8%)';
    void rig.offsetWidth;
    rig.style.transition = '';

    // 4. Reopen curtains as the camera pulls back
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

    // Reset curtain simulation grid to ensure it is in its perfect original flat state
    if (curtain) curtain.reset();

    isTransitioning = false;

    // Notify app — printer can activate
    document.dispatchEvent(new CustomEvent('scene:exited'));
  }

  /* ---------- Public getters ---------- */
  function isInside() { return currentScene === 'inside'; }
  function isOutside() { return currentScene === 'outside'; }
  function getScene() { return currentScene; }

  function resetCurtains() {
    curtain && curtain.reset();
  }

  return {
    initOutside,
    enterBooth,
    exitBooth,
    isInside,
    isOutside,
    getScene,
    resetCurtains,
    get isTransitioning() { return isTransitioning; }
  };
})();
