// Tall photo card, matched to the reference design: dot pagination near
// the top of the photo, title + badge on one row, muted description,
// two tag pills, and a full-width pill button with margin inside the card.
export default function FeaturedPlaceCard({ image, name, description, rating, tags, tint, onSelect }) {
  return (
    <div className={`featured-place-card featured-place-card--${tint}`}>
      <img className="featured-place-card__image" src={image} alt={name} />
      <div className="featured-place-card__gradient" />
      <div className="featured-place-card__dots">
        <span className="is-active" />
        <span />
        <span />
      </div>
      <div className="featured-place-card__body">
        <div className="featured-place-card__title-row">
          <h3>{name}</h3>
          <span className="featured-place-card__badge">★ {rating.toFixed(1)}</span>
        </div>
        <p>{description}</p>
        <div className="featured-place-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="featured-place-card__tag">
              {tag}
            </span>
          ))}
        </div>
        <button type="button" className="featured-place-card__action" onClick={onSelect}>
          Explore
        </button>
      </div>
    </div>
  );
}
