import React, { useEffect, useRef, useState } from 'react';
import Cloth from '../utils/cloth.js';

export default function OutsideScene({
  visible,
  theme,
  onToggleTheme,
  onEnterRequest,
  curtainState, // 'closed' | 'open'
  printerSlotRef,
  onPrinterSlotClick,
}) {
  const containerRef = useRef(null);
  const curtainCanvasRef = useRef(null);
  const neonSignRef = useRef(null);
  const clothRef = useRef(null);
  const [neonFlicker, setNeonFlicker] = useState(false);

  // 1. Double curtain Three.js simulation effect
  useEffect(() => {
    if (!visible) return;
    const canvas = curtainCanvasRef.current;
    if (!canvas) return;

    // Measure and set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();

    // Create the Three.js cloth simulation
    const curtain = new Cloth(canvas, {
      cols: 30,
      rows: 30,
      stiffness: 0.98,
      closeDX: -300
    });
    clothRef.current = curtain;
    curtain.attach();

    // Bind pointer events for pulling the curtain
    let startX = 0;
    let pullDistance = 0;
    let dragging = false;

    const onDown = (ev) => {
      // Don't drag if transitioning or curtain is already open
      if (curtainState === 'open') return;
      
      // Get pointer position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const isTouch = ev.touches && ev.touches.length;
      const clientX = isTouch ? ev.touches[0].clientX : ev.clientX;
      const clientY = isTouch ? ev.touches[0].clientY : ev.clientY;
      const posX = clientX - rect.left;
      const posY = clientY - rect.top;

      startX = posX;
      pullDistance = 0;
      
      const c = curtain.handlePointerDown(posX, posY);
      dragging = !!c;
      if (dragging) {
        ev.preventDefault();
        document.body.style.userSelect = 'none';
      }
    };

    const onMove = (ev) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const isTouch = ev.touches && ev.touches.length;
      const clientX = isTouch ? ev.touches[0].clientX : ev.clientX;
      const clientY = isTouch ? ev.touches[0].clientY : ev.clientY;
      const posX = clientX - rect.left;
      const posY = clientY - rect.top;

      const deltaX = posX - startX;

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

      curtain.handlePointerMove(posX, posY);
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      curtain.handlePointerUp();
      document.body.style.userSelect = '';
      
      // Require pulling either curtain at least 35% of total width to trigger entrance
      if (pullDistance > canvas.clientWidth * 0.35) {
        if (onEnterRequest) onEnterRequest();
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

    const onResize = () => {
      resizeCanvas();
      curtain.resize();
    };
    window.addEventListener('resize', onResize);

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('resize', onResize);
      curtain.detach();
      clothRef.current = null;
    };
  }, [visible, curtainState, onEnterRequest]);

  // Synchronize curtain bunching state (open/close) with prop
  useEffect(() => {
    if (clothRef.current) {
      clothRef.current.close(curtainState === 'open' ? 'in' : 'out');
    }
  }, [curtainState]);

  // 2. Custom neon sign pendulum physics loop
  useEffect(() => {
    if (!visible) return;
    const el = neonSignRef.current;
    if (!el) return;

    let neonAngle = 0;
    let neonAngularVelocity = 0;
    const neonDamping = 0.985;
    let last = performance.now();
    let loopId = null;

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Solve pendulum swing equation
      const torque = -0.06 * Math.sin(neonAngle);
      neonAngularVelocity += torque;
      neonAngularVelocity *= neonDamping;
      neonAngle += neonAngularVelocity * dt * 30;

      // Apply rotation transformation
      el.style.transform = `translateX(-50%) rotate(${neonAngle}rad)`;

      loopId = requestAnimationFrame(frame);
    };

    loopId = requestAnimationFrame(frame);

    const handleNeonClick = () => {
      setNeonFlicker(true);
      setTimeout(() => setNeonFlicker(false), 1200);
      
      // Inject impulse kick
      neonAngularVelocity += (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.15);
    };

    el.addEventListener('click', handleNeonClick);

    return () => {
      cancelAnimationFrame(loopId);
      if (el) el.removeEventListener('click', handleNeonClick);
    };
  }, [visible]);

  // 3. Three.js curtain tick rendering loop
  useEffect(() => {
    if (!visible) return;
    let last = performance.now();
    let animId = null;

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (clothRef.current) {
        clothRef.current.tick(dt);
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [visible]);

  // 4. Interactive draggable/throwable street posters
  useEffect(() => {
    if (!visible) return;
    const root = containerRef.current;
    if (!root) return;

    const columns = root.querySelectorAll('.booth__column');

    const randomizePosters = () => {
      columns.forEach(column => {
        const posters = Array.from(column.querySelectorAll('.booth-poster'));
        const n = posters.length;
        if (n === 0) return;

        const panel = column.querySelector('.booth__panel--riveted') || column;

        // Temporarily display posters to get client sizes
        posters.forEach(p => p.style.display = 'block');

        const firstPoster = posters[0];
        const posterW = firstPoster.offsetWidth || 56;
        const posterH = firstPoster.offsetHeight || 80;
        const panelW = panel.offsetWidth || 200;
        const panelH = panel.offsetHeight || 450;

        const wPct = (posterW / panelW) * 100;
        const hPct = (posterH / panelH) * 100;
        const pad = 2; // padding pct

        const shuffled = [...posters];
        const placed = [];

        let attemptsCount = 0;
        let visibleCount = 0;

        while (attemptsCount < 8) {
          placed.length = 0;
          visibleCount = 0;

          // Shuffle
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

              const l1 = leftPercent - pad;
              const r1 = leftPercent + wPct + pad;
              const t1 = topPercent - pad;
              const b1 = topPercent + hPct + pad;

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

          if (visibleCount >= 3) break;
          attemptsCount++;
        }

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

        shuffled.forEach((poster) => {
          poster._dragOffsetX = 0;
          poster._dragOffsetY = 0;

          if (poster._tempPos) {
            poster.style.display = 'block';
            poster.style.top = `${poster._tempPos.topPercent}%`;
            poster.style.left = `${poster._tempPos.leftPercent}%`;
            poster.dataset.rotation = `rotate(${poster._tempPos.rotateDeg}deg)`;
            poster.style.transform = `translate3d(0, 0, 0) rotate(${poster._tempPos.rotateDeg}deg)`;
          } else {
            poster.style.display = 'none';
          }
        });
      });
    };

    randomizePosters();

    const randomizeBtn = root.querySelector('#randomizePostersBtn');
    if (randomizeBtn) randomizeBtn.addEventListener('click', randomizePosters);

    window.addEventListener('resize', randomizePosters);

    // Draggable behaviors
    columns.forEach(column => {
      const posters = column.querySelectorAll('.booth-poster');
      posters.forEach((poster) => {
        poster.style.pointerEvents = 'auto';
        poster.style.cursor = 'grab';

        let isDragging = false;
        let startX = 0;
        let startY = 0;

        const onPointerDown = (ev) => {
          if (ev.button && ev.button !== 0) return;
          isDragging = true;
          poster.style.cursor = 'grabbing';
          poster.style.zIndex = '1000';
          poster.setPointerCapture(ev.pointerId);

          const ox = poster._dragOffsetX || 0;
          const oy = poster._dragOffsetY || 0;
          startX = ev.clientX - ox;
          startY = ev.clientY - oy;
          ev.stopPropagation();
        };

        const onPointerMove = (ev) => {
          if (!isDragging) return;

          const ox = poster._dragOffsetX || 0;
          const oy = poster._dragOffsetY || 0;

          let x = ev.clientX - startX;
          let y = ev.clientY - startY;

          const panel = column.querySelector('.booth__panel--riveted') || column;
          const containerRect = panel.getBoundingClientRect();
          const posterRect = poster.getBoundingClientRect();

          const currentLeft = posterRect.left - ox;
          const currentTop = posterRect.top - oy;

          const minX = containerRect.left - currentLeft;
          const maxX = containerRect.right - currentLeft - posterRect.width;
          const minY = containerRect.top - currentTop;
          const maxY = containerRect.bottom - currentTop - posterRect.height;

          poster._dragOffsetX = Math.max(minX, Math.min(maxX, x));
          poster._dragOffsetY = Math.max(minY, Math.min(maxY, y));

          const rot = poster.dataset.rotation || 'rotate(0deg)';
          poster.style.transform = `translate3d(${poster._dragOffsetX}px, ${poster._dragOffsetY}px, 0) ${rot}`;
          ev.stopPropagation();
        };

        const onPointerUp = (ev) => {
          if (!isDragging) return;
          isDragging = false;
          poster.style.cursor = 'grab';
          poster.style.zIndex = '';
          try {
            poster.releasePointerCapture(ev.pointerId);
          } catch(e) {}
        };

        poster.addEventListener('pointerdown', onPointerDown);
        poster.addEventListener('pointermove', onPointerMove);
        poster.addEventListener('pointerup', onPointerUp);
        poster.addEventListener('pointercancel', onPointerUp);
      });
    });

    return () => {
      if (randomizeBtn) randomizeBtn.removeEventListener('click', randomizePosters);
      window.removeEventListener('resize', randomizePosters);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <section 
      ref={containerRef}
      id="sceneOutside" 
      className="scene scene--outside" 
      aria-label="Outside the photobooth"
    >
      {/* Atmospheric backdrop */}
      <div className="outside__bg">
        <div className="outside__floor"></div>
        <div className="outside__wall"></div>
        <div className="outside__vignette"></div>
      </div>

      {/* Animated floating anime light particles */}
      <div className="anime-particle anime-particle--1" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--2" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--3" aria-hidden="true"></div>

      {/* The booth machine itself */}
      <div id="booth" className="booth">
        {/* Roof / cornice */}
        <div className="booth__cornice">
          <div className="booth__cornice-trim"></div>
        </div>

        {/* Neon sign */}
        <div 
          ref={neonSignRef}
          id="neonSign" 
          className={`neon ${neonFlicker ? 'is-flickering' : ''}`}
        >
          <div className="neon__tube">
            <span className="neon__title-main">PHOTOBOOTH</span>
          </div>
          <div className="neon__backplate"></div>
        </div>

        {/* Body of the machine */}
        <div className="booth__body">
          {/* Left column (decorative) */}
          <div className="booth__column booth__column--left">
            <div className="booth__panel booth__panel--riveted">
              {/* Interactive draggable posters */}
              <div className="booth__posters" aria-hidden="true">
                <article className="booth-poster"><img src="assets/poster-01.png" alt="Poster 1" /></article>
                <article className="booth-poster"><img src="assets/poster-02.png" alt="Poster 2" /></article>
                <article className="booth-poster"><img src="assets/poster-03.png" alt="Poster 3" /></article>
                <article className="booth-poster"><img src="assets/poster-04.png" alt="Poster 4" /></article>
                <article className="booth-poster"><img src="assets/poster-05.png" alt="Poster 5" /></article>
                <article className="booth-poster"><img src="assets/poster-06.png" alt="Poster 6" /></article>
                <article className="booth-poster"><img src="assets/poster-07.png" alt="Poster 7" /></article>
                <article className="booth-poster"><img src="assets/poster-08.png" alt="Poster 8" /></article>
                <article className="booth-poster"><img src="assets/poster-09.png" alt="Poster 9" /></article>
                <article className="booth-poster"><img src="assets/poster-10.png" alt="Poster 10" /></article>
                <article className="booth-poster"><img src="assets/poster-11.png" alt="Poster 11" /></article>
                <article className="booth-poster"><img src="assets/poster-12.png" alt="Poster 12" /></article>
                <article className="booth-poster"><img src="assets/poster-13.png" alt="Poster 13" /></article>
                <article className="booth-poster"><img src="assets/poster-14.png" alt="Poster 14" /></article>
                <article className="booth-poster"><img src="assets/poster-15.png" alt="Poster 15" /></article>
              </div>
            </div>
            <div className="booth__vent">
              <span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span>
            </div>
            <button id="randomizePostersBtn" className="booth__btn-randomize" type="button" aria-label="Randomize posters">RANDOMIZE</button>
          </div>

          {/* Center: curtain entrance */}
          <div className="booth__entrance">
            <div className="entrance__frame">
              <div className="entrance__dark"></div>
              <div className="curtain-hint">PULL CURTAIN<br /><span>TO ENTER</span></div>
              <canvas ref={curtainCanvasRef} id="curtainCanvas" className="curtain-canvas"></canvas>
              <div id="interiorDark" className="entrance__interior-dark"></div>
            </div>
          </div>

          {/* Right column (with slot + controls) */}
          <div className="booth__column booth__column--right">
            {/* Printer slot */}
            <div 
              ref={printerSlotRef}
              id="printerSlot" 
              className="printer-slot" 
              data-action="peek-strip"
              onClick={onPrinterSlotClick}
            >
              <div className="printer-slot__lip"></div>
              <div className="printer-slot__mouth"></div>
              <div className="printer-slot__label">PHOTO BIN</div>
            </div>

            {/* Theme toggle switch */}
            <button 
              id="themeToggle" 
              className="theme-toggle" 
              type="button" 
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={onToggleTheme}
            >
              <span className="theme-toggle__knob">
                {theme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
              </span>
            </button>

            {/* Vending machine decal sticker */}
            <div className="booth-vending-decal">
              <img src="assets/wending.png" alt="Vending Machine" />
            </div>
          </div>
        </div>

        {/* Base / feet */}
        <div className="booth__base">
          <div className="booth__foot booth__foot--left"></div>
          <div className="booth__foot booth__foot--right"></div>
        </div>

        {/* Tiny machine-vibration wrapper */}
        <div className="booth__vibe" aria-hidden="true"></div>
      </div>
    </section>
  );
}
