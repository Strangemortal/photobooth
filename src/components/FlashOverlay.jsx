import React, { useEffect, useState } from 'react';

export default function FlashOverlay({ active, duration = 140, onComplete }) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (active) {
      setIsFlashing(true);
      const timer = setTimeout(() => {
        setIsFlashing(false);
        if (onComplete) onComplete();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [active, duration, onComplete]);

  return (
    <div 
      id="flash" 
      className={`flash ${isFlashing ? 'is-flashing' : ''}`}
    />
  );
}
