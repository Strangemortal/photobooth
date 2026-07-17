/* ============================================================
   camera.js
   getUserMedia wrapper. Captures frames to offscreen canvas.
   Camera is initialized only when the user enters the booth.
   ============================================================ */

window.Camera = (function () {

  const video = () => document.getElementById('cameraVideo');
  const capture = () => document.getElementById('captureCanvas');

  let stream = null;
  let active = false;
  let facingMode = 'user';

  async function start() {
    if (active) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.toast('Camera not supported on this browser.');
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      const v = video();
      v.srcObject = stream;
      await v.play().catch(() => {});
      active = true;
      return true;
    } catch (err) {
      console.warn('Camera error', err);
      _handleError(err);
      return false;
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    const v = video();
    if (v) v.srcObject = null;
    active = false;
  }

  function _handleError(err) {
    let msg = 'Camera unavailable.';
    if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      msg = 'Camera permission denied. Please allow camera access in your browser settings.';
    } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
      msg = 'No camera found. The photobooth needs a camera to take photos.';
    } else if (err && err.name === 'NotReadableError') {
      msg = 'Camera is being used by another app. Close it and try again.';
    }
    UI.toast(msg, 5000);
  }

  /* Capture a single frame from the video to a canvas.
     Returns a HTMLCanvasElement with the captured frame at the
     requested aspect ratio (default 3:4 portrait). */
  function captureFrame(opts = {}) {
    const v = video();
    if (!v || !v.videoWidth) return null;

    const aspect = opts.aspect || (3 / 4);  // w/h
    const vw = v.videoWidth;
    const vh = v.videoHeight;

    // Crop to the desired aspect ratio, centered
    let sx, sy, sw, sh;
    const videoAspect = vw / vh;
    if (videoAspect > aspect) {
      // Source is wider than needed — crop horizontally
      sh = vh;
      sw = Math.round(vh * aspect);
      sy = 0;
      sx = Math.round((vw - sw) / 2);
    } else {
      // Source is taller — crop vertically
      sw = vw;
      sh = Math.round(vw / aspect);
      sx = 0;
      sy = Math.round((vh - sh) / 2);
    }

    const out = document.createElement('canvas');
    // Cap max dimension for performance
    const maxW = opts.maxWidth || 720;
    const scale = Math.min(1, maxW / sw);
    out.width = Math.round(sw * scale);
    out.height = Math.round(sh * scale);
    const ctx = out.getContext('2d');

    // Mirror to match the live preview
    ctx.save();
    ctx.translate(out.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, out.width, out.height);
    ctx.restore();

    return out;
  }

  function isActive() { return active; }

  return { start, stop, captureFrame, isActive };
})();
