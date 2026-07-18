import React from 'react';

export default function CountdownOverlay({ countdownNumber, isVisible }) {
  if (!isVisible) return null;

  return (
    <div id="countdown" className="countdown">
      <div className="countdown__ring"></div>
      <div
        className="countdown__num"
        id="countdownNum"
        key={countdownNumber}
        style={{ animation: 'countdown-num 1s var(--ease-soft) both' }}
      >
        {countdownNumber}
      </div>
    </div>
  );
}
