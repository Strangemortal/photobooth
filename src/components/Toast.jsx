import React, { useEffect, useState } from 'react';

export default function Toast({ message, duration = 3200, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (message) {
      setShouldRender(true);
      // Wait for mount, then add visible class for CSS transition
      const frame = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        const removeTimer = setTimeout(() => {
          setShouldRender(false);
          if (onClose) onClose();
        }, 400); // 400ms match for CSS transition-out
        return () => clearTimeout(removeTimer);
      }, duration);

      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(hideTimer);
      };
    } else {
      setIsVisible(false);
      setShouldRender(false);
    }
  }, [message, duration, onClose]);

  if (!shouldRender) return null;

  return (
    <div id="toast" className={`toast ${isVisible ? 'is-visible' : ''}`}>
      <div className="toast__icon">!</div>
      <div className="toast__text" id="toastText">{message}</div>
    </div>
  );
}
