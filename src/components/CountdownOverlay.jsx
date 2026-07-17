import React from 'react';

export default function CountdownOverlay({ value, visible }) {
  if (!visible) return null;

  return (
    <div id="countdown" className="countdown">
      <div className="countdown__ring"></div>
      <div 
        key={value} // Changing the key remounts the element, restarting the CSS animation
        className="countdown__num" 
        id="countdownNum"
        style={{ animation: 'countdown-num 1s var(--ease-soft) both' }}
      >
        {value}
      </div>
    </div>
  );
}
