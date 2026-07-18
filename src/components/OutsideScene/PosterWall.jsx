import React, { useEffect, useRef } from 'react';

const POSTERS = Array.from({ length: 15 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return `./assets/poster-${num}.png`;
});

export default function PosterWall() {
  const columnRef = useRef(null);

  const randomizePosters = () => {
    if (!columnRef.current) return;
    const posters = Array.from(columnRef.current.querySelectorAll('.booth-poster'));
    if (!posters.length) return;

    const panel = columnRef.current.querySelector('.booth__panel--riveted') || columnRef.current;
    posters.forEach(p => p.style.display = 'block');

    const firstPoster = posters[0];
    const posterW = firstPoster.offsetWidth || 56;
    const posterH = firstPoster.offsetHeight || 80;
    const panelW = panel.offsetWidth || 200;
    const panelH = panel.offsetHeight || 450;

    const wPct = (posterW / panelW) * 100;
    const hPct = (posterH / panelH) * 100;
    const pad = 2;

    const shuffled = [...posters];
    const placed = [];
    let attemptsCount = 0;
    let visibleCount = 0;

    while (attemptsCount < 8) {
      placed.length = 0;
      visibleCount = 0;

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
  };

  useEffect(() => {
    randomizePosters();

    const column = columnRef.current;
    if (!column) return;

    const posters = column.querySelectorAll('.booth-poster');
    const cleanups = [];

    posters.forEach((poster) => {
      poster.style.pointerEvents = 'auto';
      poster.style.cursor = 'grab';

      let isDragging = false;
      let startX = 0;
      let startY = 0;

      const handlePointerDown = (ev) => {
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

      const handlePointerMove = (ev) => {
        if (!isDragging) return;

        const ox = poster._dragOffsetX || 0;
        const oy = poster._dragOffsetY || 0;

        const x = ev.clientX - startX;
        const y = ev.clientY - startY;

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

      const stopDrag = (ev) => {
        if (!isDragging) return;
        isDragging = false;
        poster.style.cursor = 'grab';
        poster.style.zIndex = '';
        try {
          poster.releasePointerCapture(ev.pointerId);
        } catch (e) {}
      };

      poster.addEventListener('pointerdown', handlePointerDown);
      poster.addEventListener('pointermove', handlePointerMove);
      poster.addEventListener('pointerup', stopDrag);
      poster.addEventListener('pointercancel', stopDrag);

      cleanups.push(() => {
        poster.removeEventListener('pointerdown', handlePointerDown);
        poster.removeEventListener('pointermove', handlePointerMove);
        poster.removeEventListener('pointerup', stopDrag);
        poster.removeEventListener('pointercancel', stopDrag);
      });
    });

    const handleResize = () => randomizePosters();
    window.addEventListener('resize', handleResize);

    return () => {
      cleanups.forEach(c => c());
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={columnRef} className="booth__column booth__column--left">
      <div className="booth__panel booth__panel--riveted">
        <div className="booth__posters" aria-hidden="true">
          {POSTERS.map((src, idx) => (
            <article key={idx} className="booth-poster">
              <img src={src} alt={`Poster ${idx + 1}`} />
            </article>
          ))}
        </div>
      </div>
      <div className="booth__vent">
        <span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span>
      </div>
      <button
        id="randomizePostersBtn"
        className="booth__btn-randomize"
        type="button"
        aria-label="Randomize posters"
        onClick={randomizePosters}
      >
        <span className="booth__btn-randomize-icon">🎲</span>
        <span>RANDOMIZE</span>
      </button>
    </div>
  );
}
