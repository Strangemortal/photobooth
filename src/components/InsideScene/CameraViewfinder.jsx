import React from 'react';

export default function CameraViewfinder({ videoRef, captureCanvasRef }) {
  return (
    <div className="viewfinder">
      <div className="viewfinder__frame">
        <div className="viewfinder__corner viewfinder__corner--tl"></div>
        <div className="viewfinder__corner viewfinder__corner--tr"></div>
        <div className="viewfinder__corner viewfinder__corner--bl"></div>
        <div className="viewfinder__corner viewfinder__corner--br"></div>
        <video ref={videoRef} id="cameraVideo" className="viewfinder__video" autoPlay playsInline muted></video>
        <canvas ref={captureCanvasRef} id="captureCanvas" className="viewfinder__capture" hidden></canvas>
        <div id="viewfinderReticle" className="viewfinder__reticle">
          <span></span><span></span>
        </div>
      </div>
      <div className="viewfinder__brand">PHOTOBOOTH · EST. 1958</div>
    </div>
  );
}
