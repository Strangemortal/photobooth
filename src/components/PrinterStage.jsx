import React, { useEffect, useRef, useState } from 'react';

export default function PrinterStage({
  visible,
  stripCanvas,
  onPullComplete,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const loopRef = useRef(null);

  // Status states
  const [lampColor, setLampColor] = useState('#ff3b30'); // red during print
  const [lampPulse, setLampPulse] = useState(true);
  const [motorActive, setMotorActive] = useState(false);
  const [instruction, setInstruction] = useState('PRINTING STRIP...');
  const [instructionClass, setInstructionClass] = useState('is-prompt');

  // Physics refs
  const stripY = useRef(0);
  const stripX = useRef(0);
  const stripAngle = useRef(0);
  const angleVelocity = useRef(0);
  const emergeProgress = useRef(0);
  const isPrinting = useRef(false);
  const isDragging = useRef(false);
  const detached = useRef(false);
  const pullActive = useRef(false);

  const dragStartMouseY = useRef(0);
  const dragStartStripY = useRef(0);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Resize function
  const resizeCanvas = (canvas) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  useEffect(() => {
    if (!visible || !stripCanvas) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas(canvas);

    // Reset physics state variables
    stripY.current = 0;
    stripX.current = 0;
    stripAngle.current = 0;
    angleVelocity.current = 0;
    emergeProgress.current = 0;
    isPrinting.current = true;
    isDragging.current = false;
    detached.current = false;
    pullActive.current = false;

    // Reset status elements
    setLampColor('#ff3b30');
    setLampPulse(true);
    setMotorActive(true);
    setInstruction('PRINTING PHOTO STRIP...');
    setInstructionClass('is-prompt');

    const canvasH = canvas.height / dpr;
    const canvasW = canvas.width / dpr;
    const sw = Math.round(canvasW * 0.65);
    const sh = Math.round(sw * 2.5);
    const emergeTarget = Math.max(sh * 0.8, canvasH - 44 + sh / 2);

    let printTime = 0;
    let lastTime = performance.now();

    // 1. Emerge Animation Loop
    const runEmerge = (now) => {
      if (!isPrinting.current) return;

      printTime += 16.67;
      const rawProgress = Math.min(1, printTime / 3000);
      emergeProgress.current = 1 - Math.pow(1 - rawProgress, 3);
      
      stripY.current = emergeProgress.current * emergeTarget;
      
      // Motor gears jitter
      stripX.current = Math.sin(printTime * 0.05) * 1.2 * (1 - rawProgress);

      if (rawProgress < 1) {
        requestAnimationFrame(runEmerge);
      } else {
        // Printing complete
        isPrinting.current = false;
        setMotorActive(false);
        setLampColor('#34c759'); // green
        setLampPulse(false);
        
        // Enable pull instruction
        pullActive.current = true;
        setInstruction('PULL STRIP TO DETACH');
        setInstructionClass('is-prompt is-pulse');
      }
    };

    requestAnimationFrame(runEmerge);

    // 2. Physics & Draw Render Loop
    const renderLoop = (now) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      if (w <= 0 || h <= 0) return;

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Clip drawing area below slot lip (y = 14)
      ctx.beginPath();
      ctx.rect(0, 14, w, h - 14);
      ctx.clip();

      // Gravity pendulum calculations when hanging or dragging
      if (!isDragging.current && !detached.current && !isPrinting.current) {
        const sw2 = Math.round(w * 0.65);
        const sh2 = Math.round(sw2 * 2.5);
        const finalY = Math.max(sw2 * 0.8, h - 44 + sh2 / 2);
        
        // Ease back to target hanging position
        stripY.current += (finalY - stripY.current) * 0.16;

        const springK = -1.2;
        const dampingForce = -0.92;
        const torque = springK * stripAngle.current;
        angleVelocity.current += torque * dt;
        angleVelocity.current *= dampingForce;
        stripAngle.current += angleVelocity.current * dt * 45;
      } else if (isDragging.current) {
        // Sway based on dragging
        stripAngle.current = -Math.sin(performance.now() * 0.005) * 0.035;
      }

      const sw_draw = Math.round(w * 0.65);
      const sh_draw = Math.round(sw_draw * 2.5);
      const cx = w / 2 + stripX.current;
      const cy = 14 + stripY.current - sh_draw / 2;

      if (stripCanvas) {
        ctx.translate(cx, cy);
        ctx.rotate(stripAngle.current);

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;

        ctx.drawImage(stripCanvas, -sw_draw / 2, -sh_draw / 2, sw_draw, sh_draw);
      }

      ctx.restore();
      loopRef.current = requestAnimationFrame(renderLoop);
    };

    loopRef.current = requestAnimationFrame(renderLoop);

    // 3. Pointer event handlers for dragging/tearing
    const onDown = (ev) => {
      if (!pullActive.current || detached.current) return;

      const rect = canvas.getBoundingClientRect();
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const clickX = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
      const clickY = clientY - rect.top;

      // Click boundary check
      const midX = rect.width / 2;
      const stripWidth = 140;
      if (clickX < midX - stripWidth / 2 - 10 || clickX > midX + stripWidth / 2 + 10 || clickY < 14) {
        return;
      }

      isDragging.current = true;
      dragStartMouseY.current = clientY;
      dragStartStripY.current = stripY.current;

      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    };

    const onMove = (ev) => {
      if (!isDragging.current) return;
      ev.preventDefault();

      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const deltaY = clientY - dragStartMouseY.current;

      if (deltaY > 0) {
        stripY.current = dragStartStripY.current + deltaY;

        // Pulling past 340px detaches it completely
        if (stripY.current > 340) {
          detachStrip();
        }
      }
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };

    const detachStrip = () => {
      if (detached.current) return;
      detached.current = true;
      isDragging.current = false;
      pullActive.current = false;

      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);

      const finalH = canvas.height / dpr;
      const targetY = stripY.current + finalH + 200;

      setInstruction('SAVED TO HAND');
      setInstructionClass('is-success');

      // Tearing fall physics animation
      let t = 0;
      const fallLoop = () => {
        t += 0.04;
        stripY.current += (targetY - stripY.current) * 0.16;
        stripAngle.current += 0.08 * Math.sin(t);
        
        if (stripY.current < targetY - 1) {
          requestAnimationFrame(fallLoop);
        } else {
          // Finished falling, callback to show inline preview
          if (onPullComplete) {
            onPullComplete();
          }
        }
      };

      requestAnimationFrame(fallLoop);
    };

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('touchstart', onDown, { passive: false });

    const handleResize = () => {
      resizeCanvas(canvas);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(loopRef.current);
      isPrinting.current = false;
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [visible, stripCanvas]);

  if (!visible) return null;

  return (
    <div id="printerStage" className="printer-stage" ref={containerRef}>
      <div className="printer-stage__panel">
        <div className="printer-stage__header">
          <div 
            id="printerLamp" 
            className={`printer-stage__lamp ${lampPulse ? 'is-printing' : ''}`}
            style={{ backgroundColor: lampColor }}
          />
          <div className="printer-stage__title">PHOTO PRINTER EST. 1958</div>
        </div>
        
        {/* The slot & mechanical roller */}
        <div className="printer-stage__mouth">
          <div className="printer-stage__lip"></div>
          <div id="printerMotor" className={`printer-stage__motor ${motorActive ? 'is-active' : ''}`} />
        </div>
        
        {/* Instructions */}
        <div id="printerInstruction" className={`printer-stage__instruction ${instructionClass}`}>
          {instruction}
        </div>

        {/* Viewport viewport */}
        <div className="printer-stage__viewport">
          <canvas ref={canvasRef} id="stripCanvas" className="strip-physics-canvas"></canvas>
        </div>
      </div>
    </div>
  );
}
