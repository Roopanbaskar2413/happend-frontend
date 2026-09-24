import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getStays, logStaySelection } from "../api/stays.js";
import { createPlan } from "../api/plan.js";

const BAND_LABELS = { low: "Low", mid: "Mid", high: "High" };

function priceRangeLabel(stays, band) {
  const prices = stays.filter((s) => s.price_band === band).map((s) => s.price_per_night);
  if (prices.length === 0) return BAND_LABELS[band];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return `${BAND_LABELS[band]} (₹${min}–₹${max}/night)`;
}

export default function SelectStay() {
  const location = useLocation();
  const navigate = useNavigate();
  const { city = "pondicherry", form } = location.state ?? {};

  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hasOwnStay, setHasOwnStay] = useState(false);
  const [pricePreference, setPricePreference] = useState(form?.budget_level ?? "mid");
  const [query, setQuery] = useState("");
  const [selectedStayId, setSelectedStayId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    getStays(city)
      .then(setStays)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [city]);

  const q = query.trim().toLowerCase();
  const visibleStays = useMemo(() => {
    if (q) {
      return stays.filter((s) => [s.name, s.area].some((f) => f.toLowerCase().includes(q)));
    }
    return stays.filter((s) => s.price_band === pricePreference);
  }, [stays, q, pricePreference]);

  const selectedStay = stays.find((s) => s.id === selectedStayId);

  if (!form) {
    return (
      <div className="itin-empty">
        <p>Let's start from the planner form.</p>
      </div>
    );
  }

  async function handleContinue() {
    setSubmitting(true);
    setSubmitError(null);
    const planRequest = {
      ...form,
      has_own_stay: hasOwnStay,
      stay_id: hasOwnStay ? null : selectedStayId,
    };
    try {
      const itinerary = await createPlan({ city, ...planRequest });
      navigate("/itinerary", { state: { itinerary, city, planRequest } });
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="planner-page">
      <div className="planner-form-wrap stay-select">
        <h1>Where will you stay?</h1>
        <p className="planner-form-sub">
          This changes real travel times in your itinerary — not just decoration.
        </p>

        <label className="checkbox-row stay-select__own-toggle">
          <input
            type="checkbox"
            checked={hasOwnStay}
            onChange={(e) => setHasOwnStay(e.target.checked)}
          />
          I already have my stay sorted
        </label>

        {!hasOwnStay && (
          <>
            <div className="stay-select__budget">
              <p className="stay-select__label">What's your budget per night?</p>
              <div className="stay-select__budget-options">
                {["low", "mid", "high"].map((band) => (
                  <button
                    key={band}
                    type="button"
                    className={`interest-chip${pricePreference === band ? " is-selected" : ""}`}
                    onClick={() => setPricePreference(band)}
                  >
                    {priceRangeLabel(stays, band)}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              className="add-place-panel__search"
              placeholder="Or search if you already know where you want to stay…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {loadError && <p className="error">{loadError}</p>}
            {loading && <p className="itin-empty-day">Loading stays…</p>}

            <div className="summary-cards stay-select__grid">
              {visibleStays.map((stay) => (
                <div
                  key={stay.id}
                  className={`summary-card stay-card${selectedStayId === stay.id ? " is-selected" : ""}`}
                >
                  <div className="summary-card__title-row">
                    <strong>{stay.name}</strong>
                    <span>₹{stay.price_per_night}/night</span>
                  </div>
                  <p className="summary-card__meta">
                    {stay.area} · ★ {stay.rating}
                    {form.group_type && stay.group_fit.includes(form.group_type)
                      ? ` · good for ${form.group_type}`
                      : ""}
                  </p>
                  {stay.notes && <p className="summary-card__notes">{stay.notes}</p>}
                  <div className="stay-card__actions">
                    <button
                      type="button"
                      className="stay-card__select-btn"
                      onClick={() =>
                        setSelectedStayId((current) => {
                          const next = current === stay.id ? null : stay.id;
                          if (next) logStaySelection(city, next);
                          return next;
                        })
                      }
                    >
                      {selectedStayId === stay.id ? "Selected ✓" : "Select"}
                    </button>
                    {selectedStayId === stay.id && stay.booking_url && (
                      <a
                        href={stay.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="stay-card__book-link"
                      >
                        Book this stay ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!loading && visibleStays.length === 0 && (
                <p className="itin-empty-day">No matches.</p>
              )}
            </div>
          </>
        )}

        {submitError && <p className="error">{submitError}</p>}

        <button
          type="button"
          className="planner-submit stay-select__continue"
          onClick={handleContinue}
          disabled={submitting}
        >
          {submitting
            ? "Building your plan…"
            : hasOwnStay
              ? "Continue"
              : selectedStay
                ? `Continue with ${selectedStay.name} →`
                : "Continue without picking a stay →"}
        </button>
      </div>
    </div>
  );
}
