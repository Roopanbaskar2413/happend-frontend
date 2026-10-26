import { useState } from "react";
import botBase from "../../assets/ai-guide-bot/base.png";
import botArm from "../../assets/ai-guide-bot/arm.png";
import botMap from "../../assets/ai-guide-bot/map.png";
import botEyeLeft from "../../assets/ai-guide-bot/eye-left.png";
import botEyeRight from "../../assets/ai-guide-bot/eye-right.png";

// The "AI Guide" mascot -- a rendered 3D robot travel guide, built from a
// base photo plus cut-out layers (left/right eye glow, waving arm, held
// map) stacked on top at identical position/size. Each layer gets its own
// CSS animation in index.css: the arm waves continuously around the
// shoulder, and the whole bot bobs. The eyes "blink" by clipping the glow
// artwork itself closed from both edges (like eyelids meeting in the
// middle) and back open -- clip-path doesn't distort the glow shape the
// way scaling it did, and since the base photo underneath already has the
// eyes erased/color-matched, there's nothing to mismatch. The map layer
// additionally gets a one-off "pop" animation on click -- it briefly
// lifts and unfolds in the bot's hand before the Guide panel opens.
export default function AIMascot({ className = "", onClick }) {
  const [mapPopKey, setMapPopKey] = useState(0);

  function handleClick(e) {
    setMapPopKey((k) => k + 1);
    onClick?.(e);
  }

  return (
    <span className={`ai-mascot ${className}`} onClick={handleClick} aria-hidden="true">
      <img src={botBase} alt="" className="ai-mascot__layer ai-mascot__base" />
      <img src={botArm} alt="" className="ai-mascot__layer ai-mascot__arm" />
      <img
        key={mapPopKey}
        src={botMap}
        alt=""
        className={`ai-mascot__layer ai-mascot__map ${mapPopKey > 0 ? "ai-mascot__map--pop" : ""}`}
      />
      <img src={botEyeLeft} alt="" className="ai-mascot__layer ai-mascot__eye ai-mascot__eye--left" />
      <img src={botEyeRight} alt="" className="ai-mascot__layer ai-mascot__eye ai-mascot__eye--right" />
    </span>
  );
}
