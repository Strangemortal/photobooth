import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import Loading from './components/Loading.jsx';
import Toast from './components/Toast.jsx';
import CountdownOverlay from './components/CountdownOverlay.jsx';
import FlashOverlay from './components/FlashOverlay.jsx';
import OutsideScene from './components/OutsideScene.jsx';
import InsideScene from './components/InsideScene.jsx';
import PreviewOverlay from './components/PreviewOverlay.jsx';
import * as Camera from './utils/camera.js';
import * as Strip from './utils/strip.js';

export default function App() {
  // Global photobooth state
  const [theme, setTheme] = useState(() => localStorage.getItem('photobooth-theme') || 'light');
  const [scene, setScene] = useState('outside'); // 'outside' | 'inside'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  
  // Customization configuration
  const [captureMode, setCaptureMode] = useState('single'); // 'single' | 'triple'
  const [paperStyle, setPaperStyle] = useState('vintage');
  const [aspectRatio, setAspectRatio] = useState('3x4');
  const [downloadQuality, setDownloadQuality] = useState('high');

  // Captures & overlays state
  const [captures, setCaptures] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [flashActive, setFlashActive] = useState(false);
  const [countdown, setCountdown] = useState({ value: 3, visible: false });
  
  // Slide printing & preview states
  const [emergingStrip, setEmergingStrip] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [interiorDarkVisible, setInteriorDarkVisible] = useState(false);
  const [curtainState, setCurtainState] = useState('closed'); // 'closed' | 'open'
  const [stripCanvas, setStripCanvas] = useState(null);

  // References
  const cameraRigRef = useRef(null);
  const interiorVeilRef = useRef(null);
  const videoRef = useRef(null);
  const printerSlotRef = useRef(null);
  
  const captureSessionRef = useRef(null);
  const countdownCancelRef = useRef(null);

  // Sync theme database attribute
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('photobooth-theme', theme);
  }, [theme]);

  // Handle keyboard events (Space/Enter to capture, Escape to exit)
  useEffect(() => {
    const handleKeyDown = (ev) => {
      if (ev.code === 'Space' || ev.code === 'Enter') {
        const target = ev.target;
        if (target?.tagName === 'BUTTON' || target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        ev.preventDefault();
        if (scene === 'inside' && !isBusy) {
          startCaptureSession();
        }
      }
      if (ev.code === 'Escape' && scene === 'inside' && !isBusy) {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene, isBusy, captureMode, paperStyle, aspectRatio, downloadQuality]);

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Promise-based countdown timer inside React
  const runCountdownTimer = (seconds) => {
    return new Promise((resolve) => {
      setCountdown({ value: seconds, visible: true });
      let currentVal = seconds;

      const interval = setInterval(() => {
        currentVal -= 1;
        if (currentVal < 1) {
          clearInterval(interval);
          setCountdown({ value: 0, visible: false });
          resolve(true);
        } else {
          setCountdown({ value: currentVal, visible: true });
        }
      }, 1000);

      countdownCancelRef.current = () => {
        clearInterval(interval);
        setCountdown({ value: 0, visible: false });
        resolve(false);
      };
    });
  };

  // Camera capture loop session
  const startCaptureSession = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setCaptures([]);

    // Start camera stream
    const success = await Camera.start(videoRef.current, showToast);
    if (!success) {
      setIsBusy(false);
      return;
    }

    const maxFrames = captureMode === 'single' ? 1 : 3;
    const tempCaptures = [];
    let cancelled = false;

    captureSessionRef.current = {
      cancel: () => {
        cancelled = true;
      }
    };

    for (let i = 0; i < maxFrames; i++) {
      if (cancelled) break;

      // Count down 3 seconds
      const completed = await runCountdownTimer(3);
      if (!completed || cancelled) break;

      // Strobe flash overlay
      setFlashActive(true);
      await new Promise(r => setTimeout(r, 140));
      setFlashActive(false);

      // Grab static canvas frame
      const frame = Camera.captureFrame(videoRef.current, {
        aspect: aspectRatio === 'square' ? 1 : aspectRatio === '2x3' ? 2 / 3 : 3 / 4,
        maxWidth: downloadQuality === 'high' ? 1200 : 720,
      });

      if (frame) {
        tempCaptures.push(frame);
        setCaptures([...tempCaptures]);
      }

      await new Promise(r => setTimeout(r, 240)); // settle delay
    }

    captureSessionRef.current = null;

    if (!cancelled && tempCaptures.length > 0) {
      await finishCaptureBatch(tempCaptures);
    } else {
      setIsBusy(false);
    }
  };

  const finishCaptureBatch = async (tempCaptures) => {
    setIsBusy(true);
    Camera.stop(videoRef.current);

    // 1. Zoom camera out and return to street view
    await exitBoothSequence();

    // 2. Animate strip wiggling and emerging from slot
    if (tempCaptures.length) {
      await startPrinting(tempCaptures);
    } else {
      setIsBusy(false);
    }
  };

  const startPrinting = async (tempCaptures) => {
    setIsBusy(true);

    // 1. Build the high-quality base photo strip canvas
    const builtStrip = Strip.build(tempCaptures, {
      paperStyle,
      aspectRatio,
      timestamp: { enabled: false, format: 'DMY_HM', date: null },
      maxWidth: downloadQuality === 'high' ? 1200 : 720,
    });
    setStripCanvas(builtStrip);

    // 2. Measure slot for emerge slide translation
    const slotEl = printerSlotRef.current;
    if (slotEl) {
      const mouthEl = slotEl.querySelector('.printer-slot__mouth') || slotEl;
      const mouthRect = mouthEl.getBoundingClientRect();
      const stripW = Math.round(mouthRect.width);
      const aspect = builtStrip.height / builtStrip.width;
      const stripH = Math.round(stripW * aspect);

      // Setup absolute slot overlay details
      setEmergingStrip({
        left: `${mouthRect.left + (mouthRect.width - stripW) / 2}px`,
        top: `${mouthRect.bottom}px`,
        width: `${stripW}px`,
        height: `${stripH}px`,
        src: builtStrip.toDataURL('image/png'),
        active: false,
      });

      // Add mechanical vibration shimmy
      slotEl.classList.add('is-printing');

      // Trigger translate transform on next paint frame
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      setEmergingStrip(prev => prev ? { ...prev, active: true } : null);

      // Wait 3.6 seconds + 200ms slide emerge duration
      await new Promise(r => setTimeout(r, 3800));
      slotEl.classList.remove('is-printing');
    }

    // 3. Emerge done — remove slot overlay and open editor preview overlay
    await new Promise(r => setTimeout(r, 350));
    setEmergingStrip(null);
    setPreviewVisible(true);
    setIsBusy(false);
  };

  // Zoom into alleyway booth entrance
  const enterBoothSequence = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsBusy(true);

    const rig = cameraRigRef.current;
    const veil = interiorVeilRef.current;

    // 1. Bunch curtains to side
    setCurtainState('open');

    // 2. Scale camera rig forward
    gsap.to(rig, {
      scale: 2.6,
      yPercent: 8,
      duration: 2.2,
      ease: 'power2.inOut',
    });

    // 3. Fade in dark entrance backdrop
    setInteriorDarkVisible(true);

    // 4. Veil fades in to hide scene swap
    await new Promise(r => setTimeout(r, 1600));
    gsap.to(veil, { opacity: 1, duration: 0.5 });
    await new Promise(r => setTimeout(r, 600));

    // 5. Swap views & reset rig positioning
    setScene('inside');
    gsap.set(rig, { scale: 1, yPercent: 0 });

    // 6. Settle and fade out veil
    await new Promise(r => setTimeout(r, 150));
    gsap.to(veil, { opacity: 0, duration: 0.5 });
    await new Promise(r => setTimeout(r, 500));

    setIsTransitioning(false);
    setIsBusy(false);

    // Initialize webcam feed
    Camera.start(videoRef.current, showToast);
  };

  // Zoom back out of booth
  const exitBoothSequence = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Clear active sessions
    if (countdownCancelRef.current) countdownCancelRef.current();
    if (captureSessionRef.current) captureSessionRef.current.cancel();
    Camera.stop(videoRef.current);

    const rig = cameraRigRef.current;
    const veil = interiorVeilRef.current;

    // 1. Veil fades in
    gsap.to(veil, { opacity: 1, duration: 0.5 });
    await new Promise(r => setTimeout(r, 500));

    // 2. Swap back to alleyway scene
    setScene('outside');
    setInteriorDarkVisible(true);

    // 3. Transform rig instantly to zoom position (hidden by veil)
    gsap.set(rig, { scale: 2.6, yPercent: 8 });

    // 4. Close curtains
    setCurtainState('closed');

    // 5. Fade veil out
    gsap.to(veil, { opacity: 0, duration: 0.5 });

    // 6. Camera pulls back (tween rig from 2.6 back to 1)
    await gsap.to(rig, {
      scale: 1,
      yPercent: 0,
      duration: 2.2,
      ease: 'power2.inOut',
    });

    // 7. Dark entrance backdrop fades out
    setInteriorDarkVisible(false);

    setIsTransitioning(false);
  };

  const handleExit = async () => {
    if (isTransitioning) return;
    await exitBoothSequence();
    if (captures.length) {
      await startPrinting(captures);
    }
  };

  const handleNewPhoto = () => {
    setCaptures([]);
    setPreviewVisible(false);
    setStripCanvas(null);
  };

  return (
    <div id="world" className="world">
      <Loading />

      {/* Camera Rig encapsulates scenes for zooms */}
      <div id="cameraRig" ref={cameraRigRef} className="camera-rig">
        <OutsideScene
          visible={scene === 'outside'}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onEnterRequest={enterBoothSequence}
          curtainState={curtainState}
          printerSlotRef={printerSlotRef}
          onPrinterSlotClick={() => {
            // If they click the slot while a strip is printed, let them open preview
            if (stripCanvas && !isBusy) setPreviewVisible(true);
          }}
        />

        <InsideScene
          visible={scene === 'inside'}
          isBusy={isBusy}
          captureMode={captureMode}
          onCapture={startCaptureSession}
          onToggleMode={() => setCaptureMode(prev => (prev === 'single' ? 'triple' : 'single'))}
          onExit={handleExit}
          videoRef={videoRef}
        />
      </div>

      {/* World-level veil to mask scene switches */}
      <div 
        id="interiorVeil" 
        ref={interiorVeilRef} 
        className="interior-veil"
        style={{ pointerEvents: 'none', opacity: 0 }} 
      />

      <CountdownOverlay 
        value={countdown.value} 
        visible={countdown.visible} 
      />

      <FlashOverlay 
        active={flashActive} 
      />

      <Toast 
        message={toastMessage} 
        onClose={() => setToastMessage('')} 
      />

      <PreviewOverlay
        visible={previewVisible}
        captures={captures}
        paperStyle={paperStyle}
        aspectRatio={aspectRatio}
        downloadQuality={downloadQuality}
        onNewPhoto={handleNewPhoto}
      />

      {/* Declarative physical emerging strip overlay */}
      {emergingStrip && (
        <div
          id="emergingStripWrapper"
          style={{
            position: 'fixed',
            left: emergingStrip.left,
            top: emergingStrip.top,
            width: emergingStrip.width,
            height: emergingStrip.height,
            overflow: 'hidden',
            zIndex: 200,
            borderRadius: '0 0 3px 3px',
            boxShadow: '2px 8px 20px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          <img
            src={emergingStrip.src}
            style={{
              width: '100%',
              height: emergingStrip.height,
              display: 'block',
              transform: emergingStrip.active ? 'translateY(0%)' : 'translateY(-100%)',
              transition: 'transform 3.6s cubic-bezier(0.25, 0.1, 0.1, 1.0)',
              willChange: 'transform',
            }}
            alt="Emerging film strip"
          />
        </div>
      )}
    </div>
  );
}
