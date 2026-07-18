import React from 'react';

export default function FlashOverlay({ isFlashing }) {
  return (
    <div id="flash" className={`flash ${isFlashing ? 'is-flashing' : ''}`}></div>
  );
}
