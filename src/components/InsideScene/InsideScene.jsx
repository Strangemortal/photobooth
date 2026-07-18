import React from 'react';
import CameraViewfinder from './CameraViewfinder';
import ControlPanel from './ControlPanel';

export default function InsideScene({
  hidden,
  videoRef,
  captureCanvasRef,
  captureMode,
  isBusy,
  onTakePhoto,
  onToggleMode,
  onExitBooth
}) {
  return (
    <section
      id="sceneInside"
      className="scene scene--inside"
      aria-label="Inside the photobooth"
      hidden={hidden}
    >
      <div className="inside__shell">
        <button
          id="exitBtn"
          className="inside__close-btn"
          type="button"
          aria-label="Exit booth"
          onClick={onExitBooth}
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

        <CameraViewfinder videoRef={videoRef} captureCanvasRef={captureCanvasRef} />

        <ControlPanel
          captureMode={captureMode}
          isBusy={isBusy}
          onTakePhoto={onTakePhoto}
          onToggleMode={onToggleMode}
        />
      </div>
    </section>
  );
}
