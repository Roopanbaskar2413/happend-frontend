import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getTravelInfo } from "../api/travel.js";
import { getStays } from "../api/stays.js";
import { savePlan } from "../api/savedPlans.js";
import { useAuth } from "../context/AuthContext.jsx";

const COST_KINDS = new Set(["place", "meal"]);

function dayCost(day) {
  return day.items
    .filter((i) => COST_KINDS.has(i.kind) && i.status !== "skipped")
    .reduce((sum, i) => sum + i.cost_pp, 0);
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateRange(days) {
  if (days.length === 0) return "";
  return `${formatDate(days[0].date)} – ${formatDate(days[days.length - 1].date)}`;
}

function isMapsSearch(url) {
  return !!url && url.includes("google.com/maps");
}

function bookingLabel(url, fallback) {
  return isMapsSearch(url) ? "Find nearby options on Google Maps ↗" : fallback;
}

export default function TripSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login, signup } = useAuth();
  const { itinerary, city = "pondicherry", planRequest } = location.state ?? {};
  const [travelInfo, setTravelInfo] = useState(null);
  const [stays, setStays] = useState([]);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  useEffect(() => {
    getTravelInfo(city)
      .then(setTravelInfo)
      .catch(() => {});
    getStays(city)
      .then(setStays)
      .catch(() => {});
  }, [city]);

  if (!itinerary) {
    return (
      <div className="itin-empty">
        <p>No trip to summarize yet — build one first.</p>
        <Link to="/plan">Go to planner</Link>
      </div>
    );
  }

  const totalCost = itinerary.days.reduce((sum, d) => sum + dayCost(d), 0);
  const perPerson = planRequest?.party_size > 1;
  const stay = planRequest?.stay_id ? stays.find((s) => s.id === planRequest.stay_id) : null;
  const origin = travelInfo?.origins.find((o) => o.city === planRequest?.origin_city);
  const selectedOptions = origin ? origin.options.filter((o) => o.mode === planRequest?.transport_mode) : [];
  const otherOptions = origin ? origin.options.filter((o) => o.mode !== planRequest?.transport_mode) : [];
  const arrivalDate = planRequest?.arrival_date ?? itinerary.days[0]?.date;
  const departureDate = planRequest?.departure_date ?? itinerary.days[itinerary.days.length - 1]?.date;

  async function doSave() {
    setSaveState("saving");
    setSaveError(null);
    try {
      await savePlan({ city, arrivalDate, departureDate, itinerary, planRequest });
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err.message);
    }
  }

  async function handleSaveClick() {
    if (user) {
      doSave();
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setSaveState("saving");
    setSaveError(null);
    try {
      if (authMode === "signup") {
        await signup(authEmail, authPassword);
      } else {
        await login(authEmail, authPassword);
      }
      await doSave();
    } catch (err) {
      setSaveState("error");
      setSaveError(err.message);
    }
  }

  return (
    <div className="summary-page">
      <header className="itin-header">
        <Link to="/" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Trip summary</h1>
      </header>

      <section className="summary-stats">
        <div className="summary-stat">
          <span className="summary-stat__value">{itinerary.days.length}</span>
          <span className="summary-stat__label">days</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat__value">{formatDateRange(itinerary.days)}</span>
          <span className="summary-stat__label">dates</span>
        </div>
        {planRequest && (
          <>
            <div className="summary-stat">
              <span className="summary-stat__value summary-stat__value--cap">
                {planRequest.party_size} {planRequest.group_type}
              </span>
              <span className="summary-stat__label">travelers</span>
            </div>
            <div className="summary-stat">
              <span className="summary-stat__value summary-stat__value--cap">{planRequest.pace}</span>
              <span className="summary-stat__label">pace</span>
            </div>
          </>
        )}
        <div className="summary-stat summary-stat--highlight">
          <span className="summary-stat__value">
            ₹{totalCost}
            {perPerson ? " pp" : ""}
          </span>
          <span className="summary-stat__label">estimated cost</span>
        </div>
      </section>

      <section className="summary-section">
        <h2>Cost by day</h2>
        <div className="summary-cost-list">
          {itinerary.days.map((d, i) => (
            <div key={d.date} className="summary-cost-row">
              <span>Day {i + 1}</span>
              <span>₹{dayCost(d)}</span>
            </div>
          ))}
          <div className="summary-cost-row summary-cost-row--total">
            <span>Total{perPerson ? " (per person)" : ""}</span>
            <span>₹{totalCost}</span>
          </div>
        </div>
      </section>

      {stay ? (
        <section className="summary-section">
          <h2>Where you're staying</h2>
          <div className="summary-card">
            <div className="summary-card__title-row">
              <strong>{stay.name}</strong>
              <span>₹{stay.price_per_night}/night</span>
            </div>
            <p className="summary-card__meta">
              {stay.area} · ★ {stay.rating}
            </p>
            {stay.notes && <p className="summary-card__notes">{stay.notes}</p>}
          </div>
          <p className="summary-section__subhead">
            Your itinerary's travel times are calculated from here.
          </p>
        </section>
      ) : planRequest && !planRequest.has_own_stay ? (
        <section className="summary-section">
          <h2>Where you're staying</h2>
          <p className="summary-section__subhead">
            No specific stay picked — travel times use a generic White Town starting point.
            You can pick one next time you plan.
          </p>
        </section>
      ) : null}

      {origin && (
        <section className="summary-section">
          <h2>Getting there, from {origin.city}</h2>
          {selectedOptions.map((opt, i) => (
            <div key={opt.label} className="summary-card summary-card--selected">
              {i === 0 && (
                <span className="summary-card__badge">Your pick: {planRequest.transport_mode}</span>
              )}
              <div className="summary-card__title-row">
                <strong>{opt.label}</strong>
                <span>₹{opt.cost_pp}</span>
              </div>
              <p className="summary-card__meta">
                {Math.round(opt.duration_min / 60)}h · {opt.frequency}
              </p>
              {opt.notes && <p className="summary-card__notes">{opt.notes}</p>}
              {opt.booking_url ? (
                <a className="summary-card__book-btn" href={opt.booking_url} target="_blank" rel="noreferrer">
                  {bookingLabel(opt.booking_url, `Book this ${planRequest.transport_mode} →`)}
                </a>
              ) : (
                <p className="summary-card__no-link">
                  No online booking for this option — arrange it locally when you arrive.
                </p>
              )}
            </div>
          ))}

          {otherOptions.length > 0 && (
            <>
              <p className="summary-section__subhead">Other ways to get there</p>
              <div className="summary-cards">
                {otherOptions.map((opt) => (
                  <div key={opt.label} className="summary-card">
                    <div className="summary-card__title-row">
                      <strong>{opt.label}</strong>
                      <span>₹{opt.cost_pp}</span>
                    </div>
                    <p className="summary-card__meta">
                      {Math.round(opt.duration_min / 60)}h · {opt.frequency}
                    </p>
                    {opt.notes && <p className="summary-card__notes">{opt.notes}</p>}
                    {opt.booking_url && (
                      <a href={opt.booking_url} target="_blank" rel="noreferrer">
                        {bookingLabel(opt.booking_url, "Book")}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {travelInfo && (
        <section className="summary-section">
          <h2>Getting around</h2>
          {planRequest && !planRequest.has_own_vehicle && (
            <p className="summary-section__subhead">
              You said you won't have your own vehicle — you'll want one of these.
            </p>
          )}
          <div className="summary-cards">
            {travelInfo.local_transport.map((t) => (
              <div key={t.mode} className="summary-card">
                <div className="summary-card__title-row">
                  <strong>{t.label}</strong>
                  <span>₹{t.cost_per_day}/day</span>
                </div>
                {t.notes && <p className="summary-card__notes">{t.notes}</p>}
                {t.booking_url && (
                  <a href={t.booking_url} target="_blank" rel="noreferrer">
                    {bookingLabel(t.booking_url, "Find options")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="summary-section save-plan">
        <h2>Save this plan</h2>
        {saveState === "saved" ? (
          <p className="save-plan__confirmation">
            Saved. We'll email a reminder to <strong>{user?.email}</strong> a couple of days before{" "}
            {formatDate(arrivalDate)}.
          </p>
        ) : user ? (
          <>
            <p className="save-plan__note">Saving as {user.email}.</p>
            <button
              type="button"
              className="planner-submit"
              onClick={handleSaveClick}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving…" : "Save & remind me"}
            </button>
          </>
        ) : (
          <>
            <div className="save-plan__tabs">
              <button
                type="button"
                className={authMode === "login" ? "is-active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                className={authMode === "signup" ? "is-active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
            </div>
            <form className="save-plan__form" onSubmit={handleAuthSubmit}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
              <input
                type="password"
                required
                minLength={authMode === "signup" ? 8 : undefined}
                placeholder="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
              <button type="submit" disabled={saveState === "saving"}>
                {saveState === "saving"
                  ? "Saving…"
                  : authMode === "signup"
                    ? "Sign up & save"
                    : "Log in & save"}
              </button>
            </form>
            <p className="save-plan__note">
              An account keeps your saved trips private and lets you come back to them later.
            </p>
          </>
        )}
        {saveState === "error" && <p className="error">{saveError}</p>}
      </section>

      <div className="summary-actions">
        <button type="button" onClick={() => navigate(-1)}>
          Back to itinerary
        </button>
        <button type="button" className="summary-actions__primary" onClick={() => navigate("/")}>
          Plan another trip
        </button>
      </div>
    </div>
  );
}
