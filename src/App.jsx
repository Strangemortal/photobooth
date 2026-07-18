import React, { useState, useEffect, useRef } from 'react';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import OutsideScene from './components/OutsideScene/OutsideScene';
import InsideScene from './components/InsideScene/InsideScene';
import CountdownOverlay from './components/CountdownOverlay/CountdownOverlay';
import FlashOverlay from './components/FlashOverlay/FlashOverlay';
import Toast from './components/Toast/Toast';
import StripPreview from './components/StripPreview/StripPreview';
import ThemeToggle from './components/OutsideScene/ThemeToggle';
import ClawMachineModal from './components/ClawMachine/ClawMachineModal';

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
import './styles/responsive.css';

export default function App() {
  const [loadingDone, setLoadingDone] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('photobooth-theme') || 'light');
  const [currentScene, setCurrentScene] = useState('outside');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isZoomingIn, setIsZoomingIn] = useState(false);
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
  const [stripClaimed, setStripClaimed] = useState(false);

  // Strip Customizer Preview Modal State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewName, setPreviewName] = useState('');
  const [previewDate, setPreviewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeDate, setIncludeDate] = useState(false);
  const [includeTime, setIncludeTime] = useState(false);
  const [filterStyle, setFilterStyle] = useState('vintage');
  const [canDownload, setCanDownload] = useState(true);

  // Claw Machine Modal State
  const [showClawModal, setShowClawModal] = useState(false);

  // Refs
  const cameraRigRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const slotCanvasRef = useRef(null);

  // Theme Syncing
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('photobooth-theme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingDone(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard Shortcuts (ESC & Space)
  useEffect(() => {
    const handleKeyDown = (ev) => {
      if (ev.key === 'Escape') {
        if (showClawModal) {
          setShowClawModal(false);
        } else if (previewVisible) {
          setPreviewVisible(false);
          clearSlotBin();
        } else if (currentScene === 'inside' && !isBusy) {
          handleExitInside();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentScene, isBusy, previewVisible, showClawModal]);

  const showToast = (message, duration = 3000) => {
    setToastState({ visible: true, message });
    setTimeout(() => setToastState({ visible: false, message: '' }), duration);
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const clearSlotBin = () => {
    if (slotCanvasRef.current) {
      const ctx = slotCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, slotCanvasRef.current.width, slotCanvasRef.current.height);
    }
  };

  /* ============================================================
     SCENE TRANSITIONS
     ============================================================ */
  const enterBooth = () => {
    if (isTransitioning) return;

    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
      setIsTransitioning(true);
      setIsZoomingIn(true);
      setInteriorDarkVisible(true);

      setTimeout(async () => {
        setCurrentScene('inside');
        setVeilVisible(true);

        setTimeout(() => {
          setVeilVisible(false);
          setInteriorDarkVisible(false);
          setIsTransitioning(false);
          setIsZoomingIn(false);
        }, 300);

        try {
          await startCamera(videoRef.current);
        } catch (err) {
          console.warn('Camera failed on enter, continuing in demo mode:', err);
        }
      }, 400);
      return;
    }

    setIsTransitioning(true);
    setIsZoomingIn(true);
    setInteriorDarkVisible(true);

    setTimeout(async () => {
      setCurrentScene('inside');
      setVeilVisible(true);

      setTimeout(() => {
        setVeilVisible(false);
        setInteriorDarkVisible(false);
        setIsTransitioning(false);
        setIsZoomingIn(false);
      }, 500);

      // Request camera permission after entering Camera mode inside scene
      try {
        await startCamera(videoRef.current);
      } catch (err) {
        console.warn('Camera failed on enter, continuing in demo mode:', err);
      }
    }, 700);
  };

  const handleExitInside = () => {
    if (isTransitioning || isBusy) return;

    const isMobile = window.innerWidth <= 600;
    if (isMobile) {
      setIsTransitioning(true);
      setVeilVisible(true);
      stopCamera(videoRef.current);

      setTimeout(() => {
        setCurrentScene('outside');
        setVeilVisible(false);
        setIsTransitioning(false);
      }, 300);
      return;
    }

    setIsTransitioning(true);
    setVeilVisible(true);
    stopCamera(videoRef.current);

    setTimeout(() => {
      setCurrentScene('outside');
      setInteriorDarkVisible(false);
      setTimeout(() => {
        setVeilVisible(false);
        setIsTransitioning(false);
      }, 500);
    }, 500);
  };

  /* ============================================================
     PHOTO CAPTURE SESSION
     ============================================================ */
  const triggerFlash = () => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 300);
  };

  const runSingleCountdown = (seconds = 3) => {
    return new Promise((resolve) => {
      setCountdownNum(seconds);
      setCountdownVisible(true);
      let remaining = seconds;

      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdownNum(remaining);
        } else {
          clearInterval(timer);
          setCountdownVisible(false);
          resolve();
        }
      }, 1000);
    });
  };

  const startCaptureSession = async () => {
    if (isBusy) return;
    setIsBusy(true);

    const targetCount = captureMode === 'single' ? 1 : 3;
    const newCaptures = [];

    for (let i = 0; i < targetCount; i++) {
      await runSingleCountdown(3);
      triggerFlash();

      const imgData = captureFrame(videoRef.current, captureCanvasRef.current);
      if (imgData) {
        newCaptures.push(imgData);
      }
      setCaptures([...newCaptures]);

      if (i < targetCount - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setIsBusy(false);
    showToast(`PHOTO TAKEN! PRINTING IN BIN...`);

    // Transition back outside to print directly in bin slot
    handleExitInside();

    // Print immediately without delay!
    printStripInSlot(newCaptures);
  };

  /* ============================================================
     REAL-TIME SLOT BIN PRINTING
     ============================================================ */
  const printStripInSlot = (capturedImages) => {
    if (!capturedImages || !capturedImages.length) return;

    setIsPrinting(true);
    setPrinterLampStatus('printing');
    setMotorActive(true);
    setInstructionText('PRINTING...');
    setStripClaimed(false);

    // Build temporary canvas strip passing capturedImages array as 1st arg!
    const tempCanvas = buildStrip(capturedImages, {
      filterStyle: filterStyle || 'vintage',
      paperStyle: 'vintage',
      timestamp: { enabled: true, date: new Date() },
      maxWidth: 500
    });

    const slotCanvas = slotCanvasRef.current;
    if (!slotCanvas || !tempCanvas) return;

    const drawWidth = 110;
    const targetStripHeight = Math.round(drawWidth * (tempCanvas.height / tempCanvas.width));

    slotCanvas.width = 140;
    slotCanvas.height = Math.max(160, Math.min(280, targetStripHeight));
    const offsetX = (slotCanvas.width - drawWidth) / 2;

    const ctx = slotCanvas.getContext('2d');
    ctx.clearRect(0, 0, slotCanvas.width, slotCanvas.height);

    let progress = 0;
    const totalSteps = 25; // 25 steps * 30ms = 750ms fast print emergence!
    const printInterval = setInterval(() => {
      progress += 1;
      const revealRatio = progress / totalSteps;

      ctx.clearRect(0, 0, slotCanvas.width, slotCanvas.height);
      const drawHeight = targetStripHeight * revealRatio;

      ctx.drawImage(
        tempCanvas,
        0, 0, tempCanvas.width, tempCanvas.height * revealRatio,
        offsetX, 0, drawWidth, drawHeight
      );

      if (progress >= totalSteps) {
        clearInterval(printInterval);
        setIsPrinting(false);
        setPrinterLampStatus('ready');
        setMotorActive(false);
        setInstructionText('CLICK TO CLAIM');
      }
    }, 30);
  };

  const detachStripFromSlot = () => {
    if (isPrinting || printerLampStatus !== 'ready') return;
    setStripClaimed(true);
    setPrinterLampStatus('idle');
    setInstructionText('');
    setPreviewVisible(true);

    // Render current strip into modal preview canvas
    setTimeout(() => {
      handleApplyDetails();
    }, 50);
  };

  /* ============================================================
     STRIP CUSTOMIZER ACTIONS
     ============================================================ */
  const handleApplyDetails = () => {
    if (!previewCanvasRef.current || !captures.length) return;

    const paperCanvas = buildStrip(captures, {
      filterStyle: filterStyle,
      paperStyle: 'vintage',
      timestamp: { enabled: includeDate || includeTime, date: new Date(previewDate) },
      maxWidth: 600
    });

    const pCtx = previewCanvasRef.current.getContext('2d');
    previewCanvasRef.current.width = paperCanvas.width;
    previewCanvasRef.current.height = paperCanvas.height;
    pCtx.clearRect(0, 0, paperCanvas.width, paperCanvas.height);
    pCtx.drawImage(paperCanvas, 0, 0);
  };

  useEffect(() => {
    if (previewVisible && captures.length > 0) {
      handleApplyDetails();
    }
  }, [previewName, previewDate, includeDate, includeTime, filterStyle, previewVisible]);

  const handleDownload = () => {
    if (!previewCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `photobooth-strip-${Date.now()}.png`;
    link.href = previewCanvasRef.current.toDataURL('image/png');
    link.click();
    showToast('PHOTO STRIP DOWNLOADED!');
  };

  const handleNewPhoto = () => {
    setPreviewVisible(false);
    clearSlotBin();
    setCaptures([]);
    enterBooth();
  };

  const handleClosePreview = () => {
    setPreviewVisible(false);
    clearSlotBin();
  };

  return (
    <>
      <LoadingScreen isDone={loadingDone} />

      {loadingDone && currentScene === 'outside' && !previewVisible && !showClawModal && (
        <ThemeToggle theme={theme} onToggleTheme={handleToggleTheme} />
      )}

      <div id="world" className="world">
        <div ref={cameraRigRef} id="cameraRig" className={`camera-rig ${isZoomingIn ? 'is-zooming-in' : ''}`}>
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
            onPlayClawGame={() => setShowClawModal(true)}
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

      {showClawModal && (
        <ClawMachineModal onClose={() => setShowClawModal(false)} />
      )}
    </>
  );
}
