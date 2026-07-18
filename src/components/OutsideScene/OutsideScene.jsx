import React, { useState } from 'react';
import NeonSign from './NeonSign';
import PosterWall from './PosterWall';
import PrinterSlot from './PrinterSlot';
import CurtainCanvas from '../CurtainCanvas/CurtainCanvas';

export default function OutsideScene({
  hidden,
  onEnterBooth,
  currentScene,
  isTransitioning,
  interiorDarkVisible,
  slotCanvasRef,
  lampStatus,
  motorActive,
  instructionText,
  onDetachSlot
}) {
  const [vendingDispensed, setVendingDispensed] = useState(false);

  const handleVendingClick = () => {
    setVendingDispensed(true);
    setTimeout(() => setVendingDispensed(false), 1200);
  };

  return (
    <section
      id="sceneOutside"
      className="scene scene--outside"
      aria-label="Outside the photobooth"
      hidden={hidden}
    >
      <div className="outside__bg">
        <div className="outside__floor"></div>
        <div className="outside__wall"></div>
        <div className="outside__vignette"></div>
      </div>

      <div className="anime-particle anime-particle--1" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--2" aria-hidden="true"></div>
      <div className="anime-particle anime-particle--3" aria-hidden="true"></div>

      <div id="booth" className="booth">
        <div className="booth__cornice">
          <div className="booth__cornice-trim"></div>
        </div>

        <NeonSign />

        <div className="booth__body">
          <PosterWall />

          <div className="booth__entrance">
            <div className="entrance__frame">
              <div className="entrance__dark"></div>
              <div className="curtain-hint">PULL CURTAIN<br /><span>TO ENTER</span></div>
              <CurtainCanvas
                onEnterBooth={onEnterBooth}
                currentScene={currentScene}
                isTransitioning={isTransitioning}
              />
              <div
                id="interiorDark"
                className={`entrance__interior-dark ${interiorDarkVisible ? 'is-visible' : ''}`}
              ></div>
            </div>
          </div>

          <div className="booth__column booth__column--right">
            <PrinterSlot
              slotCanvasRef={slotCanvasRef}
              lampStatus={lampStatus}
              motorActive={motorActive}
              instructionText={instructionText}
              onDetach={onDetachSlot}
            />

            <div
              className={`booth-vending-decal ${vendingDispensed ? 'is-dispensing' : ''}`}
              onClick={handleVendingClick}
              title="Click vending machine to insert coin!"
            >
              <img src="./assets/wending.png" alt="Vending Machine" />
              {vendingDispensed && <div className="vending-coin-anim">🪙 CLINK!</div>}
            </div>
          </div>
        </div>

        {/* Photobooth Base & Feet anchored firmly to the floor */}
        <div className="booth__base">
          <div className="booth__foot booth__foot--left"></div>
          <div className="booth__foot booth__foot--right"></div>
        </div>

        <div className="booth__vibe" aria-hidden="true"></div>
      </div>
    </section>
  );
}
