import React from 'react';

export default function LoadingScreen({ isDone }) {
  if (isDone) return null;

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
