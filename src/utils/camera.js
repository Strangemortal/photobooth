/* ============================================================
   camera.js
   getUserMedia wrapper. Captures frames to offscreen canvas,
   with realistic fallback frame generator if webcam is unavailable.
   ============================================================ */

let stream = null;
let active = false;
let facingMode = 'user';

export async function startCamera(videoElement, onError) {
  if (active) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (onError) onError('Camera not supported on this browser. Demo mode active.');
    return false;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    if (videoElement) {
      videoElement.srcObject = stream;
      await videoElement.play().catch(() => {});
    }
    active = true;
    return true;
  } catch (err) {
    console.warn('Camera error', err);
    handleError(err, onError);
    return false;
  }
}

export function stopCamera(videoElement) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (videoElement) videoElement.srcObject = null;
  active = false;
}

function handleError(err, onError) {
  let msg = 'Camera unavailable. Interactive demo mode active.';
  if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
    msg = 'Camera permission denied. Using interactive photobooth demo snapshot.';
  } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
    msg = 'No camera found. Using interactive photobooth demo snapshot.';
  } else if (err && err.name === 'NotReadableError') {
    msg = 'Camera is being used by another app.';
  }
  if (onError) onError(msg);
}

export function captureFrame(videoElement, opts = {}) {
  const aspect = opts.aspect || (3 / 4);
  const maxW = opts.maxWidth || 720;
  const outW = maxW;
  const outH = Math.round(maxW / aspect);

  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');

  // If live camera video feed is available, capture it!
  if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    const videoAspect = vw / vh;
    let sx, sy, sw, sh;
    if (videoAspect > aspect) {
      sh = vh;
      sw = Math.round(vh * aspect);
      sy = 0;
      sx = Math.round((vw - sw) / 2);
    } else {
      sw = vw;
      sh = Math.round(vw / aspect);
      sx = 0;
      sy = Math.round((vh - sh) / 2);
    }

    ctx.save();
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, outW, outH);
    ctx.restore();
    return out;
  }

  // Fallback: Generate a high quality retro photobooth snapshot canvas
  generateFallbackFrame(ctx, outW, outH);
  return out;
}

function generateFallbackFrame(ctx, w, h) {
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#2b1b36');
  bgGrad.addColorStop(0.5, '#4a2545');
  bgGrad.addColorStop(1, '#1b1226');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Background light spotlight effect
  const spotGrad = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.4, w * 0.6);
  spotGrad.addColorStop(0, 'rgba(255, 0, 102, 0.4)');
  spotGrad.addColorStop(0.5, 'rgba(0, 217, 255, 0.2)');
  spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, w, h);

  // Stylized photobooth portrait silhouette
  ctx.fillStyle = '#100b17';
  ctx.beginPath();
  // Head
  ctx.arc(w / 2, h * 0.38, w * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Shoulders
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.78, w * 0.36, h * 0.28, 0, Math.PI, 0, true);
  ctx.fill();

  // Neon Japanese Purikura stamp accent
  ctx.save();
  ctx.font = `bold ${Math.round(w * 0.08)}px "Nority", "Space Grotesk", sans-serif`;
  ctx.fillStyle = '#ff0066';
  ctx.textAlign = 'center';
  ctx.fillText('プリクラ', w / 2, h * 0.18);
  ctx.fillStyle = '#00d9ff';
  ctx.fillText('PHOTOBOOTH', w / 2, h * 0.92);
  ctx.restore();

  // Subtle grain
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  let seed = (Math.random() * 1e9) | 0;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) | 0;
    const n = (((seed >>> 0) / 0xffffffff) - 0.5) * 35;
    d[i]   = Math.max(0, Math.min(255, d[i]   + n));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
  }
  ctx.putImageData(imgData, 0, 0);
}

export function isCameraActive() { return active; }
