import { useEffect, useMemo, useRef, useState } from "react";
import { musicUrl, photoUrl } from "../../api/memories.js";

const PHOTO_SLIDE_MS = 4000;
const STORY_SLIDE_MS = 4500;
const TITLE_SLIDE_MS = 3000;

export default function TripClipPlayer({ memory, city, onClose }) {
  const audioRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);

  const slides = useMemo(() => {
    const list = [{ kind: "title", duration: TITLE_SLIDE_MS }];
    for (const photo of memory.photos) {
      list.push({ kind: "photo", photo, duration: PHOTO_SLIDE_MS });
    }
    for (const story of memory.stories) {
      list.push({ kind: "story", story, duration: STORY_SLIDE_MS });
    }
    list.push({ kind: "end", duration: TITLE_SLIDE_MS });
    return list;
  }, [memory]);

  useEffect(() => {
    if (paused) return undefined;
    const slide = slides[index];
    const timer = setTimeout(() => {
      setIndex((i) => Math.min(i + 1, slides.length - 1));
    }, slide.duration);
    return () => clearTimeout(timer);
  }, [index, paused, slides]);

  useEffect(() => {
    if (!memory.has_music || !audioRef.current) return;
    if (paused) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [paused, memory.has_music]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") setPaused((p) => !p);
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, slides.length]);

  const slide = slides[index];
  const atEnd = index === slides.length - 1;

  return (
    <div className="trip-clip">
      {memory.has_music && (
        <audio ref={audioRef} src={musicUrl(memory.id)} autoPlay loop muted={muted} />
      )}

      <div className="trip-clip__stage" onClick={() => setPaused((p) => !p)}>
        {slide.kind === "title" && (
          <div className="trip-clip__card">
            <h1>{city}</h1>
            <p>
              {memory.summary.days} day{memory.summary.days === 1 ? "" : "s"} · {memory.summary.done_count}{" "}
              stops
            </p>
          </div>
        )}

        {slide.kind === "photo" && (
          <img
            key={slide.photo.id}
            className="trip-clip__photo"
            src={photoUrl(memory.id, slide.photo.id)}
            alt=""
          />
        )}

        {slide.kind === "story" && (
          <div className="trip-clip__card trip-clip__card--story">
            <p>{slide.story.text}</p>
          </div>
        )}

        {slide.kind === "end" && (
          <div className="trip-clip__card">
            <h1>The end.</h1>
            <p>Until the next one.</p>
          </div>
        )}

        {paused && <div className="trip-clip__paused">Paused — tap to resume</div>}
      </div>

      <div className="trip-clip__progress">
        {slides.map((s, i) => (
          <span key={i} className={i <= index ? "is-filled" : ""} />
        ))}
      </div>

      <div className="trip-clip__controls">
        {memory.has_music && (
          <button type="button" onClick={() => setMuted((m) => !m)}>
            {muted ? "Unmute" : "Mute"}
          </button>
        )}
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "Play" : "Pause"}
        </button>
        {atEnd ? (
          <button type="button" onClick={() => setIndex(0)}>
            Replay
          </button>
        ) : null}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
