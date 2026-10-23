import { StarIcon } from "../icons/TravelIcons.jsx";

// Tall photo card: full-bleed image, dark gradient for text legibility,
// a rating badge (not a price badge -- these are free public attractions,
// so a "$0" badge would be odd), two tag pills from the place's own
// interests, and a single CTA that goes to the real place detail page.
export default function FeaturedPlaceCard({ image, name, description, rating, tags, onSelect }) {
  return (
    <div className="featured-place-card">
      <img className="featured-place-card__image" src={image} alt={name} />
      <div className="featured-place-card__gradient" />
      <span className="featured-place-card__rating">
        <StarIcon width="13" height="13" />
        {rating.toFixed(1)}
      </span>
      <div className="featured-place-card__body">
        <h3>{name}</h3>
        <p>{description}</p>
        <div className="featured-place-card__tags">
          {tags.map((tag) => (
            <span key={tag} className="featured-place-card__tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className="featured-place-card__action" onClick={onSelect}>
        Explore
      </button>
    </div>
  );
}
