import React, { useEffect, useState } from 'react';

export default function Loading({ onDismiss }) {
  const [isDone, setIsDone] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Replicates the original delay: setTimeout(() => UI.dismissLoading(), 1100)
    const doneTimer = setTimeout(() => {
      setIsDone(true);
    }, 1100);

    const hideTimer = setTimeout(() => {
      setVisible(false);
      if (onDismiss) onDismiss();
    }, 1100 + 700); // 1100ms loading, 700ms slide transition

    return () => {
      clearTimeout(doneTimer);
      clearTimeout(hideTimer);
    };
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div id="loading" className={`loading ${isDone ? 'is-done' : ''}`}>
      <div className="loading__door" aria-hidden="true">
        <div className="loading__door-light"></div>
        <div className="loading__door-panel loading__door-panel--left"></div>
        <div className="loading__door-panel loading__door-panel--right"></div>
      </div>
    </div>
  );
}
