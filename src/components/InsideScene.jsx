import React, { useState } from 'react';

export default function InsideScene({
  visible,
  isBusy,
  captureMode,
  onCapture,
  onToggleMode,
  onExit,
  videoRef,
}) {
  const [isCapturePressed, setIsCapturePressed] = useState(false);
  const [isModePressed, setIsModePressed] = useState(false);
  const [isExitPressed, setIsExitPressed] = useState(false);

  if (!visible) return null;

  const handleCaptureClick = () => {
    if (isBusy) return;
    setIsCapturePressed(true);
    setTimeout(() => setIsCapturePressed(false), 220);
    onCapture();
  };

  const handleModeClick = () => {
    if (isBusy) return;
    setIsModePressed(true);
    setTimeout(() => setIsModePressed(false), 220);
    onToggleMode();
  };

  const handleExitClick = () => {
    setIsExitPressed(true);
    setTimeout(() => setIsExitPressed(false), 220);
    onExit();
  };

  return (
    <section id="sceneInside" className="scene scene--inside" aria-label="Inside the photobooth">
      <div className="inside__shell">
        <button 
          id="exitBtn" 
          className={`inside__close-btn ${isExitPressed ? 'is-pressed' : ''}`}
          type="button" 
          aria-label="Exit booth"
          onClick={handleExitClick}
        >
          ×
        </button>
        <div className="inside__wall inside__wall--back"></div>
        <div className="inside__wall inside__wall--left"></div>
        <div className="inside__wall inside__wall--right"></div>
        <div className="inside__wall inside__wall--top"></div>
        <div className="inside__floor"></div>
        <div className="inside__vignette"></div>

        <div className="inside__chain inside__chain--left" aria-hidden="true"><span></span></div>
        <div className="inside__chain inside__chain--right" aria-hidden="true"><span></span></div>

        <div className="inside__stool" aria-hidden="true">
          <div className="inside__stool-seat"></div>
          <div className="inside__stool-leg inside__stool-leg--left"></div>
          <div className="inside__stool-leg inside__stool-leg--right"></div>
          <div className="inside__stool-crossbar"></div>
        </div>

        {/* Camera viewfinder / preview */}
        <div className="viewfinder">
          <div className="viewfinder__frame">
            <div className="viewfinder__corner viewfinder__corner--tl"></div>
            <div className="viewfinder__corner viewfinder__corner--tr"></div>
            <div className="viewfinder__corner viewfinder__corner--bl"></div>
            <div className="viewfinder__corner viewfinder__corner--br"></div>
            <video 
              ref={videoRef} 
              id="cameraVideo" 
              className="viewfinder__video" 
              autoPlay 
              playsInline 
              muted
            />
            <div id="viewfinderReticle" className="viewfinder__reticle">
              <span></span><span></span>
            </div>
          </div>
          <div className="viewfinder__brand">PHOTOBOOTH · EST. 1958</div>
        </div>

        {/* Control panel buttons */}
        <div className="control-panel">
          <button 
            id="captureBtn" 
            className={`inside-action-btn inside-action-btn--primary ${isCapturePressed ? 'is-pressed' : ''} ${isBusy ? 'is-disabled' : ''}`}
            type="button" 
            aria-label="Take photo"
            onClick={handleCaptureClick}
            disabled={isBusy}
          >
            <span className="machine-btn__icon">●</span>
            <span className="machine-btn__label">TAKE PHOTO</span>
          </button>

          <button 
            id="modeBtn" 
            className={`inside-action-btn inside-action-btn--secondary ${isModePressed ? 'is-pressed' : ''}`}
            type="button" 
            aria-label={captureMode === 'triple' ? 'Switch to single photo' : 'Switch to three photo strip'}
            onClick={handleModeClick}
            disabled={isBusy}
          >
            <span className="machine-btn__icon">{captureMode === 'triple' ? '×3' : '1×'}</span>
            <span className="machine-btn__label">{captureMode === 'triple' ? '3 PHOTO STRIP' : '1 PHOTO'}</span>
          </button>
        </div>

      </div>
    </section>
  );
}
