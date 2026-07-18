import React, { useEffect, useRef } from 'react';
import { Cloth } from '../../utils/cloth';
import * as UI from '../../utils/ui';

export default function CurtainCanvas({ onEnterBooth, currentScene, isTransitioning }) {
  const canvasRef = useRef(null);
  const clothRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };

    resizeCanvas();

    const cloth = new Cloth(canvas, {
      cols: 30,
      rows: 30,
      stiffness: 0.98,
      closeDX: -300
    });
    cloth.attach();
    clothRef.current = cloth;

    let animFrame = null;
    let last = performance.now();

    function renderLoop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cloth.tick(dt);
      animFrame = requestAnimationFrame(renderLoop);
    }
    animFrame = requestAnimationFrame(renderLoop);

    let startX = 0;
    let pullDistance = 0;
    let dragging = false;

    const onDown = (ev) => {
      if (isTransitioning || currentScene !== 'outside') return;
      const pos = UI.pointerPos(ev, canvas);
      startX = pos.x;
      pullDistance = 0;
      
      const c = cloth.handlePointerDown(pos.x, pos.y);
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

      const dragSide = cloth.state.dragSide;
      if (dragSide === 'left' && deltaX < 0) {
        cloth.setAnchorOffset(deltaX);
        pullDistance = Math.abs(deltaX);
      } else if (dragSide === 'right' && deltaX > 0) {
        cloth.setAnchorOffset(deltaX);
        pullDistance = Math.abs(deltaX);
      } else {
        cloth.setAnchorOffset(0);
        pullDistance = 0;
      }

      cloth.handlePointerMove(pos.x, pos.y);
      ev.preventDefault();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      cloth.handlePointerUp();
      UI.enableSelection();
      
      if (pullDistance > canvas.clientWidth * 0.35) {
        onEnterBooth();
      } else {
        cloth.close('out');
      }
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    const handleResize = () => {
      resizeCanvas();
      cloth.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('resize', handleResize);
      cloth.detach();
    };
  }, [currentScene, isTransitioning, onEnterBooth]);

  // Expose methods to parent if needed via ref or state updates
  return (
    <canvas id="curtainCanvas" ref={canvasRef} className="curtain-canvas"></canvas>
  );
}
