import { useState } from "react";

// Same tall-card visual language as FeaturedPlaceCard (gradient, rounded
// corners, title row, tags, full-width button), but for city selection,
// not individual places -- and with a real swipeable image carousel when
// a city has more than one photo. Cities with no real photos yet (coming
// soon) fall back to a solid gradient banner, same tint classes the old
// DestinationCard already used, with no dots and a disabled button.
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

  function next(e) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  }

  function prev(e) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  return (
    <div className={`city-card city-card--${tint}${comingSoon ? " is-coming-soon" : ""}`}>
      {images && images.length > 0 ? (
        <img className="city-card__image" src={images[index]} alt={name} />
      ) : (
        <div className="city-card__image city-card__image--placeholder" />
      )}
      <div className="city-card__gradient" />

      {hasCarousel && (
        <>
          <button type="button" className="city-card__tap city-card__tap--left" onClick={prev} aria-label="Previous photo" />
          <button type="button" className="city-card__tap city-card__tap--right" onClick={next} aria-label="Next photo" />
          <div className="city-card__dots">
            {images.map((_, i) => (
              <span key={i} className={i === index ? "is-active" : ""} />
            ))}
          </div>
        </>
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
