import { useEffect, useState } from "react";

// Same tall-card visual language as FeaturedPlaceCard (gradient, rounded
// corners, title row, tags, full-width button), but for city selection,
// not individual places -- and with an auto-advancing, crossfading image
// carousel when a city has more than one photo. Cities with no real photos
// yet (coming soon) fall back to a solid gradient banner, same tint classes
// the old DestinationCard already used, with no dots and a disabled button.
const SLIDE_INTERVAL_MS = 4000;

export default function CityCarouselCard({
  name,
  blurb,
  tags,
  images,
  tint,
  comingSoon,
  onSelect,
}) {
  const [index, setIndex] = useState(0);
  const hasCarousel = images && images.length > 1;

  useEffect(() => {
    if (!hasCarousel) return undefined;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasCarousel, images]);

  return (
    <div className={`city-card city-card--${tint}${comingSoon ? " is-coming-soon" : ""}`}>
      {images && images.length > 0 ? (
        images.map((src, i) => (
          <img
            key={src}
            className={`city-card__image${i === index ? " is-active" : ""}`}
            src={src}
            alt={name}
          />
        ))
      ) : (
        <div className="city-card__image is-active city-card__image--placeholder" />
      )}
      {images && images.length > 0 && <div className="city-card__blur" />}
      <div className="city-card__gradient" />

      {hasCarousel && (
        <div className="city-card__dots">
          {images.map((_, i) => (
            <span key={i} className={i === index ? "is-active" : ""} />
          ))}
        </div>
      )}

      {comingSoon && <span className="city-card__badge">Coming soon</span>}

      <div className="city-card__body">
        <h3>{name}</h3>
        <p>{blurb}</p>
        {tags && (
          <div className="city-card__tags">
            {tags.map((tag) => (
              <span key={tag} className="city-card__tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="city-card__action" onClick={onSelect} disabled={comingSoon}>
          {comingSoon ? "Not open yet" : "Start planning"}
        </button>
      </div>
    </div>
  );
}
