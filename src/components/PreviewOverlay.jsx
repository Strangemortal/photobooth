import React, { useEffect, useRef, useState } from 'react';
import * as Strip from '../utils/strip.js';

export default function PreviewOverlay({
  visible,
  captures,
  paperStyle,
  aspectRatio,
  downloadQuality,
  onNewPhoto,
}) {
  const canvasRef = useRef(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('vintage');
  const [isMagnified, setIsMagnified] = useState(false);
  const [hasDeveloped, setHasDeveloped] = useState(false);
  
  // Current built strip canvas reference
  const currentStripRef = useRef(null);

  // Set today's date on mount
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Re-trigger developing animation or redraw when visible, captures, or filter/text changes
  useEffect(() => {
    if (!visible || !captures || !captures.length) return;

    // 1. Build the base strip using strip.js build
    const baseStrip = Strip.build(captures, {
      paperStyle,
      aspectRatio,
      filterStyle: selectedFilter,
      timestamp: { enabled: false, format: 'DMY_HM', date: null },
      maxWidth: downloadQuality === 'high' ? 1200 : 720,
    });

    let finalStrip = baseStrip;

    // 2. Add details footer if name or date is set
    if (name.trim() || date) {
      const footerHeight = Math.max(84, Math.round(baseStrip.width * 0.1));
      const detailed = document.createElement('canvas');
      detailed.width = baseStrip.width;
      detailed.height = baseStrip.height + footerHeight;
      
      const ctx = detailed.getContext('2d');
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(0, 0, detailed.width, detailed.height);
      ctx.drawImage(baseStrip, 0, 0);
      
      // Divider line
      ctx.fillStyle = '#292b35';
      ctx.fillRect(0, baseStrip.height, detailed.width, 2);
      
      // Footer text
      ctx.fillStyle = '#292b35';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.max(18, Math.round(baseStrip.width * 0.035))}px Arial, sans-serif`;
      
      const dateText = date ? new Date(`${date}T00:00:00`).toLocaleDateString() : '';
      const labelText = [name.trim(), dateText].filter(Boolean).join('  ·  ');
      ctx.fillText(labelText, detailed.width / 2, baseStrip.height + footerHeight / 2);
      
      finalStrip = detailed;
    }

    currentStripRef.current = finalStrip;

    // 3. Draw on the preview canvas
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const aspect = finalStrip.height / finalStrip.width;
    const isMobile = window.innerWidth <= 600;
    const displayWidth = isMobile ? Math.min(150, window.innerWidth * 0.40) : Math.min(230, window.innerWidth * 0.46);
    const displayHeight = displayWidth * aspect;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    canvas.width = Math.round(displayWidth * scale);
    canvas.height = Math.round(displayHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // If it has already developed (e.g. they changed a filter after loading), draw instantly
    if (hasDeveloped) {
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(finalStrip, 0, 0, displayWidth, displayHeight);
      return;
    }

    // Otherwise, run the Polaroid fade-in loop
    let start = null;
    const duration = 1800; // 1.8s
    let animId = null;

    const drawStep = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw paper background
      ctx.fillStyle = '#f8f1e5';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.strokeStyle = 'rgba(40,20,5,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, displayWidth, displayHeight);

      // Fade-in math
      let opacity = 0;
      if (progress > 0.2) {
        opacity = (progress - 0.2) / 0.8;
        opacity = opacity * opacity; // soft curve
      }

      ctx.globalAlpha = opacity;
      ctx.drawImage(finalStrip, 0, 0, displayWidth, displayHeight);
      ctx.globalAlpha = 1.0;

      if (progress < 1) {
        animId = requestAnimationFrame(drawStep);
      } else {
        setHasDeveloped(true);
      }
    };

    animId = requestAnimationFrame(drawStep);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [visible, captures, name, date, selectedFilter, hasDeveloped]);

  // Reset development flag when opening/closing visible state
  useEffect(() => {
    if (visible) {
      setHasDeveloped(false);
      setIsMagnified(false);
      setName('');
    }
  }, [visible]);

  if (!visible) return null;

  const handleDownload = () => {
    const stripCanvas = currentStripRef.current;
    if (!stripCanvas) return;

    stripCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'photobooth-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  };

  const handleCanvasClick = () => {
    setIsMagnified(prev => !prev);
  };

  return (
    <>
      <div id="previewOverlay" className="preview-overlay preview-overlay--fixed" />
      
      <div id="stripPreview" className={`strip-preview strip-preview--fixed ${isMagnified ? 'is-magnified' : ''}`}>
        <div className="strip-preview__eyebrow">
          {hasDeveloped ? 'YOUR STRIP · READY!' : 'YOUR STRIP · DEVELOPING…'}
        </div>
        
        <canvas 
          ref={canvasRef} 
          id="previewCanvas" 
          className="strip-preview__canvas"
          onClick={handleCanvasClick}
          style={{ cursor: 'zoom-in' }}
        />
        
        <div className="strip-preview__details" id="previewDetails">
          <input 
            id="previewName" 
            className="strip-preview__input" 
            type="text" 
            maxLength={28} 
            placeholder="YOUR NAME" 
            autoComplete="off"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              // Mark developed so it updates instantly without replay
              setHasDeveloped(true);
            }}
          />
          <input 
            id="previewDateInput" 
            className="strip-preview__input" 
            type="date" 
            aria-label="Add a date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setHasDeveloped(true);
            }}
          />
          
          <div className="strip-preview__filters">
            <label htmlFor="filterSelect" className="strip-preview__label">FILTER:</label>
            <select 
              id="filterSelect" 
              className="strip-preview__select"
              value={selectedFilter}
              onChange={(e) => {
                setSelectedFilter(e.target.value);
                setHasDeveloped(true);
              }}
            >
              <option value="vintage">VINTAGE SEPIA</option>
              <option value="bw">NOIR (B&W)</option>
              <option value="warm">WARM GOLD</option>
              <option value="cool">COOL BLUE</option>
              <option value="neon">CYBERPINK</option>
              <option value="none">UNFILTERED</option>
            </select>
          </div>
        </div>
        
        <div className="printer-stage__actions" style={{ marginTop: '14px', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', zIndex: 10 }}>
          <button 
            id="downloadBtn" 
            className={`download-btn ${hasDeveloped ? 'is-ready' : ''}`}
            type="button" 
            disabled={!hasDeveloped}
            onClick={handleDownload}
          >
            <span className="download-btn__rim"></span>
            <span className="download-btn__cap">
              <span className="download-btn__icon">↓</span>
              <span className="download-btn__label">DOWNLOAD</span>
            </span>
          </button>

          <button 
            id="newPhotoBtn" 
            className="new-photo-btn is-ready" 
            type="button"
            onClick={onNewPhoto}
          >
            <span className="new-photo-btn__rim"></span>
            <span className="new-photo-btn__cap">
              <span className="new-photo-btn__icon">↻</span>
              <span className="new-photo-btn__label">NEW PHOTO</span>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
