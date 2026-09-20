import { BackwatersIcon, BeachIcon, CompassIcon, HillsIcon } from "../icons/TravelIcons.jsx";

const THEME = {
  pondicherry: { className: "theme-pondicherry", Icon: BeachIcon },
  ooty: { className: "theme-ooty", Icon: HillsIcon },
  kerala: { className: "theme-kerala", Icon: BackwatersIcon },
};

export default function DestinationCard({ city, index, onSelect }) {
  const { name, blurb, coming_soon: comingSoon } = city;
  const theme = THEME[city.id] ?? { className: "theme-default", Icon: CompassIcon };
  const Icon = theme.Icon;

  return (
    <div
      className={`destination-card ${theme.className}${comingSoon ? " is-coming-soon" : ""}`}
      style={{ "--delay": `${index * 90}ms` }}
    >
      <div className="destination-card__banner">
        <span className="destination-card__shimmer" />
        <Icon className="destination-card__icon" />
        {comingSoon && <span className="badge">Coming soon</span>}
      </div>
      <div className="destination-card__body">
        <h3>{name}</h3>
        <p>{blurb}</p>
        <button
          type="button"
          className="destination-card__action"
          disabled={comingSoon}
          onClick={() => onSelect(city)}
        >
          {comingSoon ? "Not open yet" : "Start planning"}
          {!comingSoon && <span className="arrow">→</span>}
        </button>
      </div>
    </div>
  );
}
