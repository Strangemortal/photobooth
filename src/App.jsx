import React, { useState, useEffect, useRef } from 'react';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import OutsideScene from './components/OutsideScene/OutsideScene';
import InsideScene from './components/InsideScene/InsideScene';
import CountdownOverlay from './components/CountdownOverlay/CountdownOverlay';
import FlashOverlay from './components/FlashOverlay/FlashOverlay';
import Toast from './components/Toast/Toast';
import StripPreview from './components/StripPreview/StripPreview';
import ThemeToggle from './components/OutsideScene/ThemeToggle';

import * as UI from './utils/ui';
import { startCamera, stopCamera, captureFrame, isCameraActive } from './utils/camera';
import { buildStrip } from './utils/strip';

import './styles/style.css';
import './styles/core.css';
import './styles/animations.css';
import './styles/outside.css';
import './styles/curtain.css';
import './styles/booth.css';
import './styles/inside.css';
import './styles/controls.css';
import './styles/printer.css';
import './styles/theme-japanese-light.css';
import './styles/toggle.css';

export default function App() {
  const [loadingDone, setLoadingDone] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('photobooth-theme') || 'light');
  const [currentScene, setCurrentScene] = useState('outside');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [interiorDarkVisible, setInteriorDarkVisible] = useState(false);
  const [veilVisible, setVeilVisible] = useState(false);

  const [captureMode, setCaptureMode] = useState('single');
  const [isBusy, setIsBusy] = useState(false);
  const [captures, setCaptures] = useState([]);

  // Countdown & Flash
  const [countdownNum, setCountdownNum] = useState(3);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);

  // Toast
  const [toastState, setToastState] = useState({ visible: false, message: '' });

  // In-machine Photo Bin Printing State
  const [isPrinting, setIsPrinting] = useState(false);
  const [printerLampStatus, setPrinterLampStatus] = useState('idle'); // 'idle' | 'printing' | 'ready'
  const [motorActive, setMotorActive] = useState(false);
  const [instructionText, setInstructionText] = useState('');

  // Preview / Customizer state (Date and Time off by default)
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewName, setPreviewName] = useState('');
  const [previewDate, setPreviewDate] = useState('');
  const [includeDate, setIncludeDate] = useState(false);
  const [includeTime, setIncludeTime] = useState(false);
  const [filterStyle, setFilterStyle] = useState('vintage');
  const [canDownload, setCanDownload] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const cameraRigRef = useRef(null);
  const slotCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const capturesRef = useRef(captures);
  capturesRef.current = captures;
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;
  const captureSessionRef = useRef(null);

  const stripImageRef = useRef(null);
  const baseStripCanvasRef = useRef(null);
  const pullAnimFrameRef = useRef(null);

  // Apply root theme attribute
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('photobooth-theme', theme);
  }, [theme]);

  // Loading screen timer
  useEffect(() => {
    const timer = setTimeout(() => setLoadingDone(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (message, duration = 3200) => {
    setToastState({ visible: true, message });
    setTimeout(() => {
      setToastState({ visible: false, message: '' });
    }, duration);
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Scene transitions
  const enterBooth = async () => {
    if (isTransitioning || currentScene !== 'outside') return;
    setIsTransitioning(true);

    const rig = cameraRigRef.current;

    const tweenPromise = UI.tween({
      duration: 2200,
      ease: UI.ease.inOutHeavy,
      onUpdate: (e) => {
        if (rig) {
          const scale = 1 + 1.6 * e;
          const ty = 8 * e;
          rig.style.transform = `scale(${scale}) translateY(${ty}%)`;
        }
      }
    });

    await UI.wait(900);
    setInteriorDarkVisible(true);

    await UI.wait(700);
    setVeilVisible(true);

    await tweenPromise;

    setCurrentScene('inside');
    setInteriorDarkVisible(false);

    if (rig) {
      rig.style.transition = 'none';
      rig.style.transform = 'scale(1)';
      void rig.offsetWidth;
      rig.style.transition = '';
    }

    await UI.wait(150);
    setVeilVisible(false);
    await UI.wait(500);

    setIsTransitioning(false);

    // Auto-start camera when entering booth
    await startCamera(videoRef.current, (err) => showToast(err));
  };

  const exitBooth = async () => {
    if (isTransitioning || currentScene !== 'inside') return;
    setIsTransitioning(true);

    setVeilVisible(true);
    await UI.wait(500);

    setCurrentScene('outside');
    stopCamera(videoRef.current);

    const rig = cameraRigRef.current;
    if (rig) {
      rig.style.transition = 'none';
      rig.style.transform = 'scale(2.6) translateY(8%)';
      void rig.offsetWidth;
      rig.style.transition = '';
    }

    setInteriorDarkVisible(true);
    setVeilVisible(false);

    await UI.tween({
      duration: 2200,
      ease: UI.ease.inOutHeavy,
      onUpdate: (e) => {
        if (rig) {
          const scale = 2.6 - 1.6 * e;
          const ty = 8 - 8 * e;
          rig.style.transform = `scale(${scale}) translateY(${ty}%)`;
        }
      }
    });

    setInteriorDarkVisible(false);
    setIsTransitioning(false);
  };

  // Countdown runner
  const runCountdown = (seconds) => {
    return new Promise((resolve) => {
      let cancelled = false;
      captureSessionRef.current = { stopRequested: false, cancel: () => { cancelled = true; } };

      setCountdownVisible(true);

      const step = async (n) => {
        if (n < 1 || cancelled || captureSessionRef.current?.stopRequested) {
          setCountdownVisible(false);
          resolve(!cancelled && !captureSessionRef.current?.stopRequested);
          return;
        }
        setCountdownNum(n);
        await UI.wait(1000);
        step(n - 1);
      };

      step(seconds);
    });
  };

  // Photo session
  const startCaptureSession = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setCaptures([]);

    if (!isCameraActive()) {
      await startCamera(videoRef.current, (err) => showToast(err));
    }

    const frameCount = captureMode === 'single' ? 1 : 3;
    const newCaptures = [];

    for (let i = 0; i < frameCount; i++) {
      const completed = await runCountdown(3);
      if (!completed) break;

      setIsFlashing(true);
      await UI.wait(140);
      setIsFlashing(false);

      const frame = captureFrame(videoRef.current, { aspect: 3 / 4, maxWidth: 1200 });
      if (frame) {
        newCaptures.push(frame);
        setCaptures([...newCaptures]);
      }
      await UI.wait(240);
    }

    if (newCaptures.length > 0) {
      stopCamera(videoRef.current);
      await exitBooth();
      await startPrintingInBin(newCaptures);
    } else {
      setIsBusy(false);
    }
  };

  // Printing sequence directly in machine's Photo Bin slot
  const startPrintingInBin = async (capturedFrames) => {
    setIsBusy(true);

    const initialStrip = buildStrip(capturedFrames, {
      paperStyle: 'vintage',
      aspectRatio: '3x4',
      filterStyle,
      timestamp: { enabled: includeDate || includeTime }
    });

    baseStripCanvasRef.current = initialStrip;
    stripImageRef.current = initialStrip;

    setIsPrinting(true);
    setPrinterLampStatus('printing');
    setMotorActive(true);
    setInstructionText('PRINTING...');

    await UI.wait(100);

    // Emerge animation directly on the photo bin slot canvas
    await animateEmergeInSlot(initialStrip);

    setIsPrinting(false);
    setMotorActive(false);
    setPrinterLampStatus('ready');
    setInstructionText('TAP TO TAKE STRIP');

    enableSlotPull(initialStrip, capturedFrames);
  };

  const animateEmergeInSlot = (stripCanvas) => {
    return new Promise((resolve) => {
      const canvas = slotCanvasRef.current;
      if (!canvas) { resolve(); return; }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const canvasW = (rect.width || 140);
      const canvasH = (rect.height || 140);

      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      const ctx = canvas.getContext('2d');

      const sw = Math.round(canvasW * 0.75);
      const sh = Math.round(sw * (stripCanvas.height / stripCanvas.width));
      const emergeTarget = Math.max(sh * 0.82, canvasH - 10);

      let printTime = 0;

      function step() {
        printTime += 16.67;
        const rawProgress = Math.min(1, printTime / 2400);
        const progress = 1 - Math.pow(1 - rawProgress, 3);
        const stripY = progress * emergeTarget;
        const swayX = Math.sin(printTime * 0.05) * 1.0 * (1 - rawProgress);

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasW, canvasH);

        const midX = canvasW / 2 + swayX;
        const topY = 10 + stripY - sh;

        ctx.drawImage(stripCanvas, midX - sw / 2, topY, sw, sh);
        ctx.restore();

        if (rawProgress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  };

  const enableSlotPull = (stripCanvas, capturedFrames) => {
    const canvas = slotCanvasRef.current;
    if (!canvas) return;

    let time = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const canvasW = (rect.width || 140);
    const canvasH = (rect.height || 140);

    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');

    const sw = Math.round(canvasW * 0.75);
    const sh = Math.round(sw * (stripCanvas.height / stripCanvas.width));
    const emergeTarget = Math.max(sh * 0.82, canvasH - 10);

    const renderLoop = () => {
      time += 0.03;
      const swayX = Math.sin(time * 2) * 1.2;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvasW, canvasH);

      const midX = canvasW / 2 + swayX;
      const topY = 10 + emergeTarget - sh;

      ctx.drawImage(stripCanvas, midX - sw / 2, topY, sw, sh);
      ctx.restore();

      pullAnimFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  const clearSlotBin = () => {
    if (pullAnimFrameRef.current) {
      cancelAnimationFrame(pullAnimFrameRef.current);
    }
    setPrinterLampStatus('idle');
    setInstructionText('');

    // Clear photo from machine's physical photo bin slot
    const canvas = slotCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const detachStripFromSlot = () => {
    clearSlotBin();
    showPreview(stripImageRef.current || baseStripCanvasRef.current);
    setIsBusy(false);
  };

  const showPreview = (stripCanvas) => {
    setPreviewVisible(true);
    setCanDownload(true);

    setTimeout(() => {
      renderPreviewCanvas(stripCanvas);
    }, 60);
  };

  const renderPreviewCanvas = (stripCanvas) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !stripCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderW = Math.min(260, window.innerWidth * 0.7);
    const renderH = renderW * (stripCanvas.height / stripCanvas.width);

    canvas.width = renderW * dpr;
    canvas.height = renderH * dpr;
    canvas.style.width = `${renderW}px`;
    canvas.style.height = `${renderH}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.drawImage(stripCanvas, 0, 0, renderW, renderH);
  };

  const handleApplyDetails = (overrideOpts = {}) => {
    if (!captures.length && !baseStripCanvasRef.current) return;

    const activeFilter = overrideOpts.filterStyle || filterStyle;
    const activeIncludeDate = overrideOpts.includeDate !== undefined ? overrideOpts.includeDate : includeDate;
    const activeIncludeTime = overrideOpts.includeTime !== undefined ? overrideOpts.includeTime : includeTime;
    const activeName = overrideOpts.name !== undefined ? overrideOpts.name : previewName;
    const activeDateStr = overrideOpts.date !== undefined ? overrideOpts.date : previewDate;

    let customDate = activeDateStr ? new Date(activeDateStr) : new Date();

    const timestampEnabled = activeIncludeDate || activeIncludeTime;
    let format = 'DMY_HM';
    if (activeIncludeDate && !activeIncludeTime) format = 'DMY';
    if (!activeIncludeDate && activeIncludeTime) format = 'HM';

    const updatedStrip = buildStrip(captures.length ? captures : [baseStripCanvasRef.current], {
      paperStyle: 'vintage',
      aspectRatio: '3x4',
      filterStyle: activeFilter,
      timestamp: {
        enabled: timestampEnabled,
        format: format,
        date: customDate
      }
    });

    if (activeName.trim()) {
      const ctx = updatedStrip.getContext('2d');
      ctx.save();
      ctx.font = `bold ${Math.round(updatedStrip.width * 0.05)}px "Nority", "Space Grotesk", sans-serif`;
      ctx.fillStyle = 'rgba(120,70,20,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(activeName.toUpperCase(), updatedStrip.width / 2, updatedStrip.height - 25);
      ctx.restore();
    }

    stripImageRef.current = updatedStrip;
    renderPreviewCanvas(updatedStrip);
  };

  const handleDownload = () => {
    const stripCanvas = stripImageRef.current || baseStripCanvasRef.current;
    if (!stripCanvas) return;

    stripCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photobooth-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  };

  const handleNewPhoto = () => {
    clearSlotBin();
    setCaptures([]);
    setPreviewVisible(false);
    setPreviewName('');
    setPreviewDate('');
    setIsBusy(false);
  };

  const handleClosePreview = () => {
    clearSlotBin();
    setPreviewVisible(false);
    setIsBusy(false);
  };

  const handleExitInside = async () => {
    if (isBusy) return;
    stopCamera(videoRef.current);
    await exitBooth();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (ev) => {
      if (ev.key === 'Escape' || ev.code === 'Escape') {
        if (previewVisible) {
          handleClosePreview();
        } else if (currentScene === 'inside') {
          handleExitInside();
        }
      }
      if (ev.code === 'Space' || ev.code === 'Enter') {
        const target = ev.target;
        if (target?.tagName === 'BUTTON' || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        ev.preventDefault();
        if (currentScene === 'inside' && !isBusyRef.current) {
          startCaptureSession();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScene, previewVisible]);

  return (
    <>
      <LoadingScreen isDone={loadingDone} />

      {/* Top Right Animated Day / Night Toggle Switch (Only on main outside screen) */}
      {loadingDone && currentScene === 'outside' && !previewVisible && (
        <ThemeToggle theme={theme} onToggleTheme={handleToggleTheme} />
      )}

      <div id="world" className="world">
        <div ref={cameraRigRef} id="cameraRig" className="camera-rig">
          <OutsideScene
            hidden={currentScene !== 'outside'}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onEnterBooth={enterBooth}
            currentScene={currentScene}
            isTransitioning={isTransitioning}
            interiorDarkVisible={interiorDarkVisible}
            slotCanvasRef={slotCanvasRef}
            lampStatus={printerLampStatus}
            motorActive={motorActive}
            instructionText={instructionText}
            onDetachSlot={detachStripFromSlot}
          />

          <InsideScene
            hidden={currentScene !== 'inside'}
            videoRef={videoRef}
            captureCanvasRef={captureCanvasRef}
            captureMode={captureMode}
            isBusy={isBusy}
            onTakePhoto={startCaptureSession}
            onToggleMode={() => setCaptureMode(prev => (prev === 'single' ? 'triple' : 'single'))}
            onExitBooth={handleExitInside}
          />
        </div>

        <div id="interiorVeil" className={`interior-veil ${veilVisible ? 'is-visible' : ''}`}></div>

        <CountdownOverlay countdownNumber={countdownNum} isVisible={countdownVisible} />

        <FlashOverlay isFlashing={isFlashing} />

        <Toast toastState={toastState} />
      </div>

      <StripPreview
        isVisible={previewVisible}
        previewCanvasRef={previewCanvasRef}
        name={previewName}
        setName={setPreviewName}
        date={previewDate}
        setDate={setPreviewDate}
        includeDate={includeDate}
        setIncludeDate={setIncludeDate}
        includeTime={includeTime}
        setIncludeTime={setIncludeTime}
        filterStyle={filterStyle}
        setFilterStyle={setFilterStyle}
        onApplyDetails={handleApplyDetails}
        onDownload={handleDownload}
        onNewPhoto={handleNewPhoto}
        onClose={handleClosePreview}
        canDownload={canDownload}
      />
    </>
  );
}
