/* ============================================================
   camera.js
   getUserMedia wrapper. Captures frames to offscreen canvas.
   ============================================================ */

let stream = null;
let active = false;
let facingMode = 'user';

export async function start(videoEl, toastCb) {
  if (active) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (toastCb) toastCb('Camera not supported on this browser.');
    return false;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
    }
    active = true;
    return true;
  } catch (err) {
    console.warn('Camera error', err);
    _handleError(err, toastCb);
    return false;
  }
}

export function stop(videoEl) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
  active = false;
}

function _handleError(err, toastCb) {
  let msg = 'Camera unavailable.';
  if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
    msg = 'Camera permission denied. Please allow camera access in your browser settings.';
  } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
    msg = 'No camera found. The photobooth needs a camera to take photos.';
  } else if (err && err.name === 'NotReadableError') {
    msg = 'Camera is being used by another app. Close it and try again.';
  }
  if (toastCb) {
    toastCb(msg, 5000);
  }
}

/* Capture a single frame from the video to a canvas.
   Returns a HTMLCanvasElement with the captured frame at the
   requested aspect ratio (default 3:4 portrait). */
export function captureFrame(videoEl, opts = {}) {
  const v = videoEl;
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

export function isActive() { return active; }
export function getFacingMode() { return facingMode; }
export function setFacingMode(mode) { facingMode = mode; }
