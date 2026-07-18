import React from 'react';

export default function PrinterSlot({
  lampStatus, // 'idle' | 'printing' | 'ready'
  motorActive,
  slotCanvasRef,
  instructionText,
  onDetach
}) {
  const isPrinting = lampStatus === 'printing';
  const isReady = lampStatus === 'ready';

  return (
    <div
      id="printerSlot"
      className={`printer-slot ${isPrinting ? 'is-printing' : ''} ${isReady ? 'is-ready' : ''}`}
      onClick={isReady ? onDetach : undefined}
      title={isReady ? 'Click to take & customize photo strip' : undefined}
    >
      <div className="printer-slot__header">
        <div
          className={`printer-slot__lamp ${isPrinting ? 'is-printing' : ''}`}
          style={{ backgroundColor: isReady ? '#39ff14' : isPrinting ? '#ff0055' : '' }}
        ></div>
        <div className="printer-slot__label">PHOTO BIN</div>
        <div className={`printer-slot__motor ${motorActive ? 'is-active' : ''}`}></div>
      </div>

      <div className="printer-slot__mouth">
        <div className="printer-slot__lip"></div>
        {/* Strip canvas emerging directly out of the machine's photo bin */}
        <canvas
          ref={slotCanvasRef}
          className="printer-slot__canvas"
        ></canvas>
      </div>

      {instructionText && (
        <div className={`printer-slot__prompt ${isReady ? 'is-pulse' : ''}`}>
          {instructionText}
        </div>
      )}
    </div>
  );
}
