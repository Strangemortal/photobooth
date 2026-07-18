import React from 'react';

export default function Toast({ toastState }) {
  if (!toastState || !toastState.visible) return null;

  return (
    <div id="toast" className={`toast ${toastState.visible ? 'is-visible' : ''}`}>
      <div className="toast__icon">!</div>
      <div className="toast__text" id="toastText">{toastState.message}</div>
    </div>
  );
}
