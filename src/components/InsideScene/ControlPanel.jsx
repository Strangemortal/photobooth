import React from 'react';

export default function ControlPanel({
  captureMode,
  isBusy,
  onTakePhoto,
  onToggleMode
}) {
  const isTriple = captureMode === 'triple';

  return (
    <div className="control-panel">
      <button
        id="captureBtn"
        className={`inside-action-btn inside-action-btn--primary ${isBusy ? 'is-disabled' : ''}`}
        type="button"
        aria-label="Take photo"
        onClick={onTakePhoto}
        disabled={isBusy}
      >
        <span className="machine-btn__icon">●</span>
        <span className="machine-btn__label">TAKE PHOTO</span>
      </button>

      <button
        id="modeBtn"
        className="inside-action-btn inside-action-btn--secondary"
        type="button"
        aria-label={isTriple ? 'Switch to single photo' : 'Switch to three photo strip'}
        onClick={onToggleMode}
        disabled={isBusy}
      >
        <span className="machine-btn__icon">{isTriple ? '×3' : '1×'}</span>
        <span className="machine-btn__label">{isTriple ? '3 PHOTO STRIP' : '1 PHOTO'}</span>
      </button>
    </div>
  );
}
