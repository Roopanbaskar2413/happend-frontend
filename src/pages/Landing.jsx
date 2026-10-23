import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCities } from "../api/catalog.js";
import CityCarouselCard from "../components/landing/CityCarouselCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import promenadeBeachImg from "../assets/places/promenade_beach.jpg";
import frenchQuarterImg from "../assets/places/french_quarter.jpg";
import pondicherryGateImg from "../assets/places/pondicherry_gate.jpg";

// Real photos for Pondicherry's carousel -- the only city with real photos
// so far. Ooty/Kerala fall back to a placeholder gradient (see
// CityCarouselCard) until real, properly-licensed photos exist for them.
const CITY_IMAGES = {
  pondicherry: [promenadeBeachImg, frenchQuarterImg, pondicherryGateImg],
};

const CITY_TAGS = {
  pondicherry: ["Beach", "Heritage", "Food"],
  ooty: ["Hills", "Tea gardens"],
  kerala: ["Backwaters", "Nature"],
};

// Matches the gradient/placeholder tint classes in index.css.
const CITY_TINTS = {
  pondicherry: "ocean",
  ooty: "green",
  kerala: "blue",
};

const USED_APP_KEY = "happend:usedApp";

// No accounts yet, so "new vs. returning" is tracked per-browser, not per-person.
// Set only once they actually use the planner, not just for loading the landing page.
function useHasUsedApp() {
  const [hasUsedApp] = useState(() => {
    try {
      return localStorage.getItem(USED_APP_KEY) === "true";
    } catch {
      return false; // storage blocked (private mode, etc.) — treat as never used
    }
  });

  function markUsed() {
    try {
      localStorage.setItem(USED_APP_KEY, "true");
    } catch {
      // Nothing to do — worst case the explainer shows again next visit.
    }
  }

  return [hasUsedApp, markUsed];
}

export default function Landing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [cities, setCities] = useState([]);
  const [error, setError] = useState(null);
  const [loadingCities, setLoadingCities] = useState(true);
  // Only shown if the fetch is genuinely slow (a Render free-tier cold
  // start can take 30-60s) -- a fast load never shows this at all.
  const [showColdStartHint, setShowColdStartHint] = useState(false);
  const [, markUsed] = useHasUsedApp();

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingCities(false));
  }, []);

  useEffect(() => {
    if (!loadingCities) return undefined;
    const t = setTimeout(() => setShowColdStartHint(true), 4000);
    return () => clearTimeout(t);
  }, [loadingCities]);

  function handleSelect(city) {
    markUsed();
    navigate("/plan", { state: { city: city.id } });
  }

  return (
    <div className="page page--simple">
      <nav className="nav nav--light">
        <span className="nav__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </span>
        <div className="nav__auth">
          <Link to="/plan" className="nav__cta">
            Plan your trip →
          </Link>
          {user ? (
            <>
              <Link to="/trips">My trips</Link>
              <Link to="/memories">Memories</Link>
              <button type="button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </div>
      </nav>

      <main className="landing landing--simple">
        <h1 className="landing__title">Where to?</h1>
        <p className="landing__subtitle">
          Built on verified timings, not confident guesses. And when the day slips, it re-plans on the spot.
        </p>

        {error && <p className="error">Couldn't load destinations: {error}</p>}
        {!error && loadingCities && (
          <p className="itin-empty-day">
            {showColdStartHint
              ? "Waking up the server — this can take up to a minute on the first visit in a while."
              : "Loading destinations…"}
          </p>
        )}

        <section className="landing__cities">
          {cities.map((city) => (
            <CityCarouselCard
              key={city.id}
              name={city.name}
              blurb={city.blurb}
              tags={CITY_TAGS[city.id]}
              images={CITY_IMAGES[city.id]}
              tint={CITY_TINTS[city.id] || "default"}
              comingSoon={city.coming_soon}
              onSelect={() => handleSelect(city)}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
