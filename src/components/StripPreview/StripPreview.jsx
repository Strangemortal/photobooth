import React, { useState } from 'react';

const FILTERS = [
  { id: 'vintage', emoji: '🎞️', tooltip: 'Vintage Sepia' },
  { id: 'bw', emoji: '🎬', tooltip: 'Noir B&W' },
  { id: 'warm', emoji: '🌅', tooltip: 'Warm Gold' },
  { id: 'cool', emoji: '🌃', tooltip: 'Cool Blue' },
  { id: 'neon', emoji: '⚡', tooltip: 'Cyber Neon' },
  { id: 'none', emoji: '✨', tooltip: 'Natural' },
];

export default function StripPreview({
  isVisible,
  previewCanvasRef,
  name,
  setName,
  date,
  setDate,
  includeDate,
  setIncludeDate,
  includeTime,
  setIncludeTime,
  filterStyle,
  setFilterStyle,
  onApplyDetails,
  onDownload,
  onNewPhoto,
  onClose,
  canDownload
}) {
  const [isZoomed, setIsZoomed] = useState(false);

  if (!isVisible) return null;

  const handleFilterSelect = (filterId) => {
    setFilterStyle(filterId);
    onApplyDetails({
      filterStyle: filterId,
      includeDate,
      includeTime,
      name,
      date
    });
  };

  const handleDateToggle = (e) => {
    const val = e.target.checked;
    setIncludeDate(val);
    onApplyDetails({
      filterStyle,
      includeDate: val,
      includeTime,
      name,
      date
    });
  };

  const handleTimeToggle = (e) => {
    const val = e.target.checked;
    setIncludeTime(val);
    onApplyDetails({
      filterStyle,
      includeDate,
      includeTime: val,
      name,
      date
    });
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    onApplyDetails({
      filterStyle,
      includeDate,
      includeTime,
      name: val,
      date
    });
  };

  const handleDateChange = (e) => {
    const val = e.target.value;
    setDate(val);
    onApplyDetails({
      filterStyle,
      includeDate,
      includeTime,
      name,
      date: val
    });
  };

  const handleCanvasClick = (e) => {
    e.stopPropagation();
    setIsZoomed(prev => !prev);
  };

  const handleOverlayClick = () => {
    if (isZoomed) {
      setIsZoomed(false);
    } else {
      onClose();
    }
  };

  return (
    <>
      <div
        id="previewOverlay"
        className={`preview-overlay preview-overlay--fixed ${isZoomed ? 'is-zoomed-blur' : ''}`}
        onClick={handleOverlayClick}
      ></div>

      <div
        id="stripPreview"
        className={`strip-preview strip-preview--compact ${isZoomed ? 'is-zoomed' : ''}`}
        onClick={(e) => {
          if (isZoomed) {
            e.stopPropagation();
            setIsZoomed(false);
          }
        }}
      >
        <div className="strip-preview__header">
          <div className="strip-preview__eyebrow">YOUR PHOTO STRIP</div>
        </div>

        {/* Canvas Preview Container — Click to zoom in place */}
        <div
          className="strip-preview__canvas-container"
          onClick={handleCanvasClick}
        >
          <canvas ref={previewCanvasRef} id="previewCanvas" className="strip-preview__canvas"></canvas>
        </div>

        <div className="strip-preview__form">
          {/* Name Input */}
          <input
            id="previewName"
            className="strip-preview__input"
            type="text"
            maxLength={28}
            placeholder="ADD YOUR NAME / MEMO..."
            autoComplete="off"
            value={name}
            onChange={handleNameChange}
          />

          {/* Separate Date and Time Toggles */}
          <div className="strip-preview__toggles-grid">
            <label className="strip-preview__checkbox-item">
              <input
                type="checkbox"
                className="strip-preview__checkbox"
                checked={includeDate}
                onChange={handleDateToggle}
              />
              <span>Date</span>
            </label>

            <label className="strip-preview__checkbox-item">
              <input
                type="checkbox"
                className="strip-preview__checkbox"
                checked={includeTime}
                onChange={handleTimeToggle}
              />
              <span>Time</span>
            </label>
          </div>

          {includeDate && (
            <input
              id="previewDateInput"
              className="strip-preview__input strip-preview__input--date"
              type="date"
              value={date}
              onChange={handleDateChange}
            />
          )}

          {/* Emoji Filters Bar */}
          <div className="strip-preview__emoji-filters">
            <span className="strip-preview__filter-title">FILTER:</span>
            <div className="strip-preview__emoji-bar">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`strip-preview__emoji-btn ${filterStyle === f.id ? 'is-active' : ''}`}
                  onClick={() => handleFilterSelect(f.id)}
                  title={f.tooltip}
                >
                  {f.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div className="strip-preview__compact-actions">
          <button
            id="downloadBtn"
            className="strip-preview__btn strip-preview__btn--download"
            type="button"
            onClick={onDownload}
            disabled={!canDownload}
            title="Download Photo Strip"
          >
            <span className="strip-preview__btn-icon">📥</span>
            <span>DOWNLOAD</span>
          </button>

          <button
            id="newPhotoBtn"
            className="strip-preview__btn strip-preview__btn--retake"
            type="button"
            onClick={onNewPhoto}
            title="Take New Photo"
          >
            <span className="strip-preview__btn-icon">📷</span>
            <span>RETAKE</span>
          </button>
        </div>
      </div>
    </>
  );
}
