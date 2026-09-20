import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCities } from "../api/catalog.js";
import { getUserLocation, getWeatherFor } from "../api/weather.js";
import DestinationCard from "../components/landing/DestinationCard.jsx";
import HowItAdapts from "../components/landing/HowItAdapts.jsx";
import { CloudShape, PlaneIcon } from "../components/icons/TravelIcons.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const HERO_VARIANTS = [
  {
    kicker: "Plans break. This one bends.",
    headline: () => "Running two hours late? Say so.",
    sub: () =>
      "Your trip rearranges itself around it — and tells you exactly what it dropped, and why.",
  },
  {
    kicker: "The last ferry out is 16:00.",
    headline: () => "Your plan already knew that.",
    sub: () =>
      "Every stop checked against real opening hours, closing days, and the time it actually takes to get there. Nothing sends you to a locked gate.",
  },
  {
    kicker: "Not another AI itinerary.",
    headline: () => "A plan that survives Sunday afternoon.",
    sub: () =>
      "Built on verified timings, not confident guesses. And when the day slips, it re-plans on the spot.",
  },
  {
    kicker: "Built for trips that go sideways.",
    headline: (isWeekend) =>
      isWeekend ? "Your next trip, sorted by Friday night." : "Your next weekend is already half-planned.",
    sub: () => "Plans change. Yours keeps up — and always says what changed.",
  },
];

const STARS = Array.from({ length: 24 }, (_, i) => ({
  top: `${(i * 37) % 60}%`,
  left: `${(i * 53) % 100}%`,
  delay: `${(i % 8) * 0.4}s`,
  size: `${1 + (i % 3)}px`,
}));

const RAINDROPS = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 13) % 100}%`,
  delay: `${(i % 10) * 0.25}s`,
  duration: `${0.6 + (i % 5) * 0.15}s`,
}));

// Kept clear of the centered text column (roughly 20%-80% wide, 8%-58% tall).
const CLOUDS = [
  { top: "10%", left: "2%", width: "140px", duration: "34s", delay: "0s" },
  { top: "8%", left: "80%", width: "110px", duration: "40s", delay: "-12s" },
  { top: "62%", left: "84%", width: "95px", duration: "28s", delay: "-6s" },
];

// Purely decorative theming, not tied to any one destination — the catalog covers
// many cities, so this reads the visitor's own local clock/calendar, not a city's.
function getLocalParts() {
  const now = new Date();
  return { hour: now.getHours(), month: now.getMonth() };
}

function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

// Broad-strokes seasonal palette (most of India: hot summer, monsoon rains, mild winter).
// Decorative only — never used as a stand-in for a specific destination's real forecast.
function getSeason(month) {
  if (month >= 2 && month <= 5) return "summer"; // Mar-Jun
  if (month >= 6 && month <= 10) return "monsoon"; // Jul-Nov
  return "winter"; // Dec-Feb
}

function useHeroCopy() {
  const [variant] = useState(
    () => HERO_VARIANTS[Math.floor(Math.random() * HERO_VARIANTS.length)]
  );
  const day = new Date().getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  return {
    kicker: variant.kicker,
    headline: variant.headline(isWeekend),
    sub: variant.sub(isWeekend),
  };
}

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
  const { kicker, headline, sub } = useHeroCopy();
  const [hasUsedApp, markUsed] = useHasUsedApp();
  const [{ hour, month }] = useState(getLocalParts);
  const timeOfDay = getTimeOfDay(hour);
  const season = getSeason(month);
  const isNight = timeOfDay === "night";
  const isMonsoon = season === "monsoon";
  const [weather, setWeather] = useState(null); // stays null unless/until the live read succeeds

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Best-effort, non-blocking: the page already looks right without this.
    // Denial, timeout, or a slow/failed fetch all just leave `weather` null.
    getUserLocation()
      .then(({ lat, lon }) => getWeatherFor(lat, lon))
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Real conditions beat the seasonal guess when we have them; season is just the fallback.
  const rainActive = weather ? weather.condition === "rain" || weather.condition === "storm" : isMonsoon;
  const weatherCondition = weather?.condition ?? null;
  const isHot = weather?.isHot ?? false;
  const isWindy = weather?.isWindy ?? false;

  function handleSelect(city) {
    markUsed();
    navigate("/plan", { state: { city: city.id } });
  }

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </span>
        <div className="nav__auth">
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

      <header
        className={`hero hero--${timeOfDay} hero--${season}${isHot ? " hero--hot" : ""}`}
      >
        <div className="hero__bg" />
        <div className={`hero__season-overlay hero__season-overlay--${season}`} />
        {weatherCondition && (
          <div className={`hero__weather-overlay hero__weather-overlay--${weatherCondition}`} />
        )}
        {weatherCondition === "storm" && <div className="hero__lightning" />}
        {isHot && <div className="hero__heat-overlay" />}
        <div className="hero__ambient" aria-hidden="true">
          {isNight &&
            STARS.map((star, i) => (
              <span
                key={i}
                className="star"
                style={{
                  top: star.top,
                  left: star.left,
                  animationDelay: star.delay,
                  width: star.size,
                  height: star.size,
                }}
              />
            ))}
          {rainActive &&
            RAINDROPS.map((drop, i) => (
              <span
                key={i}
                className="raindrop"
                style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
              />
            ))}
          {isNight ? (
            <>
              <span className="moon" />
              <span className="shooting-star shooting-star-1" />
              <span className="shooting-star shooting-star-2" />
            </>
          ) : (
            <>
              <span className={`sun sun--${timeOfDay}`} />
              {CLOUDS.map((cloud, i) => (
                <CloudShape
                  key={i}
                  className={`cloud cloud--${timeOfDay}`}
                  style={{
                    top: cloud.top,
                    left: cloud.left,
                    width: cloud.width,
                    animationDuration: isWindy
                      ? `${parseFloat(cloud.duration) * 0.4}s`
                      : cloud.duration,
                    animationDelay: cloud.delay,
                  }}
                />
              ))}
            </>
          )}
          <svg className="hero__route" viewBox="0 0 1400 320" preserveAspectRatio="none">
            <path
              className="hero__route-path"
              d="M-50 220 C 250 40, 550 320, 900 80 S 1300 -20, 1450 60"
            />
          </svg>
          <PlaneIcon className="hero__plane" />
        </div>

        <p className="hero__kicker reveal" style={{ "--reveal-delay": "0ms" }}>
          {kicker}
        </p>
        <h1 className="reveal" style={{ "--reveal-delay": "90ms" }}>
          {headline}
        </h1>
        <p className="hero__sub reveal" style={{ "--reveal-delay": "180ms" }}>
          {sub}
        </p>

        <svg
          className="hero__wave"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="hero__wave-path"
            d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,80 L0,80 Z"
            fill="#fdf8f2"
          />
        </svg>
      </header>

      <main className="landing">
        <h2 className="landing__section-title reveal" style={{ "--reveal-delay": "0ms" }}>
          Where to?
        </h2>
        <section className="landing__destinations">
          {error && <p className="error">Couldn't load destinations: {error}</p>}
          {cities.map((city, i) => (
            <DestinationCard key={city.id} city={city} index={i} onSelect={handleSelect} />
          ))}
        </section>

        {!hasUsedApp && <HowItAdapts />}
      </main>
    </div>
  );
}
