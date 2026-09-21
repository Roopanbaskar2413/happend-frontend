import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAmenities, getFood, getPlaces } from "../api/places.js";
import { formatWindows, WEEKDAY_NAMES } from "../utils/time.js";

const GROUP_LABELS = { solo: "Solo", couple: "Couple", family: "Family", friends: "Friends" };
const SLOT_LABELS = {
  sunrise: "Sunrise",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

// Every field this page can show is exactly what the catalog JSON has --
// see backend/app/engine/models.py's Place/Food. There is no address,
// phone number, photo, or review data to show because the catalog was
// never built to hold it; this page is honest about that rather than
// implying more detail exists than actually does.
export default function PlaceDetail() {
  const { city, kind, id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(undefined); // undefined = loading, null = not found
  const [error, setError] = useState(null);

  useEffect(() => {
    setEntry(undefined);
    setError(null);
    const fetcher = kind === "meal" ? getFood : getPlaces;
    fetcher(city)
      .then((rows) => {
        const found = rows.find((r) => r.id === id);
        if (found) {
          setEntry(found);
          return;
        }
        // Not every real "place" the itinerary can add is in the curated
        // catalog -- amenities (gas stations, schools, ...) get scheduled
        // through the same UI, see amenityAsPlace() in Itinerary.jsx, but
        // live in a separate, unscheduled dataset. Check there before
        // giving up.
        if (kind !== "place") {
          setEntry(null);
          return;
        }
        getAmenities(city)
          .then((amenities) => {
            const amenity = amenities.find((a) => a.id === id);
            setEntry(amenity ? { ...amenity, is_amenity: true, category: amenity.raw_category } : null);
          })
          .catch((err) => setError(err.message));
      })
      .catch((err) => setError(err.message));
  }, [city, kind, id]);

  return (
    <div className="itin-page">
      <header className="itin-header">
        <Link to="/" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
      </header>

      <main className="place-detail">
        <button type="button" className="place-detail__back" onClick={() => navigate(-1)}>
          ← Back to itinerary
        </button>

        {error && <p className="place-detail__empty">Couldn't load this place: {error}</p>}
        {entry === undefined && !error && <p className="place-detail__empty">Loading…</p>}
        {entry === null && !error && <p className="place-detail__empty">Place not found.</p>}

        {entry && (
          <>
            <div className="place-detail__hero">
              <iframe
                title={`Map showing ${entry.name}`}
                src={`https://www.google.com/maps?q=${entry.lat},${entry.lng}&z=16&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="place-detail__title-row">
              <h1>{entry.name}</h1>
              <span className="place-detail__rating">★ {entry.rating}</span>
            </div>

            <div className="place-detail__badges">
              {entry.category && <span className="place-detail__badge">{entry.category}</span>}
              {(entry.meals ?? []).map((m) => (
                <span key={m} className="place-detail__badge">
                  {MEAL_LABELS[m] ?? m}
                </span>
              ))}
              {entry.price_band && <span className="place-detail__badge">{entry.price_band} budget</span>}
              {entry.veg_friendly && <span className="place-detail__badge">Veg-friendly</span>}
            </div>

            {entry.notes && <p className="place-detail__notes">{entry.notes}</p>}

            <div className="place-detail__facts">
              {!entry.is_amenity && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Hours</span>
                  <span>{formatWindows(entry.windows)}</span>
                </div>
              )}
              {entry.is_amenity && entry.phone && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Phone</span>
                  <span>{entry.phone}</span>
                </div>
              )}
              {!entry.is_amenity && entry.closed_days?.length > 0 && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Closed on</span>
                  <span>{entry.closed_days.map((d) => WEEKDAY_NAMES[d]).join(", ")}</span>
                </div>
              )}
              {entry.duration_min && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Typical visit</span>
                  <span>{entry.duration_min} min</span>
                </div>
              )}
              {!entry.is_amenity && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Cost</span>
                  <span>{entry.cost_pp > 0 ? `₹${entry.cost_pp} per person` : "Free"}</span>
                </div>
              )}
              {entry.area && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Area</span>
                  <span>{entry.area.replaceAll("_", " ")}</span>
                </div>
              )}
              {entry.group_fit?.length > 0 && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Best for</span>
                  <span>{entry.group_fit.map((g) => GROUP_LABELS[g] ?? g).join(", ")}</span>
                </div>
              )}
              {entry.best_slots?.length > 0 && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Best time of day</span>
                  <span>{entry.best_slots.map((s) => SLOT_LABELS[s] ?? s).join(", ")}</span>
                </div>
              )}
              {entry.interests?.length > 0 && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Interests</span>
                  <span>{entry.interests.join(", ")}</span>
                </div>
              )}
              {(entry.weather_dependent || entry.indoor || entry.heat_exposed) && (
                <div className="place-detail__fact">
                  <span className="place-detail__fact-label">Good to know</span>
                  <span>
                    {[
                      entry.weather_dependent && "weather-dependent",
                      entry.indoor && "indoor",
                      entry.heat_exposed && "can get hot/sunny",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>

            <div className="place-detail__links">
              <a href={`https://www.google.com/maps?q=${entry.lat},${entry.lng}`} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
              {entry.booking_url && (
                <a href={entry.booking_url} target="_blank" rel="noreferrer">
                  Book
                </a>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
