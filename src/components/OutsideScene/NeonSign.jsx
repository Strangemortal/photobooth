import React, { useState, useRef } from 'react';

export default function NeonSign() {
  const [isBroken, setIsBroken] = useState(false);
  const [isFlickering, setIsFlickering] = useState(false);
  const signRef = useRef(null);

  const handleClick = () => {
    setIsFlickering(true);
    setTimeout(() => setIsFlickering(false), 1400);

    // Toggle broken hanging state on click
    setIsBroken(prev => !prev);
  };

  return (
    <div
      ref={signRef}
      id="neonSign"
      className={`neon neon--full-width ${isBroken ? 'is-broken' : ''} ${isFlickering ? 'is-flickering' : ''}`}
      onClick={handleClick}
      title="Click to break & swing sign!"
    >
      <div className="neon__chain neon__chain--left"></div>
      <div className="neon__chain neon__chain--right"></div>

      <div className="neon__backplate"></div>
      
      <div className="neon__tube">
        <span className="neon__title-main">PHOTOBOOTH</span>
      </div>

      {isBroken && <div className="neon__sparks" aria-hidden="true"><span>⚡</span><span>💥</span><span>⚡</span></div>}
    </div>
  );
}
