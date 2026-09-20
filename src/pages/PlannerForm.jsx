import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getOptions } from "../api/plan.js";

function defaultDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function PlannerForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const city = location.state?.city ?? "pondicherry";

  const [options, setOptions] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    origin_city: "Chennai",
    transport_mode: "bus",
    arrival_date: defaultDate(7),
    arrival_time: "10:00",
    departure_date: defaultDate(9),
    departure_time: "18:00",
    group_type: "couple",
    party_size: 2,
    budget_level: "mid",
    pace: "balanced",
    diet: "any",
    interests: [],
    has_own_vehicle: false,
  });

  useEffect(() => {
    getOptions()
      .then(setOptions)
      .catch((err) => setError(err.message));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleInterest(interest) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(interest)
        ? f.interests.filter((i) => i !== interest)
        : [...f.interests, interest],
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/plan/stay", { state: { city, form } });
  }

  return (
    <div className="planner-page">
      <div className="planner-form-wrap">
        <h1>Plan your trip</h1>
        <p className="planner-form-sub">A few details and we'll build your day-by-day itinerary.</p>

        {error && <p className="error">{error}</p>}

        <form className="planner-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Coming from
              <select value={form.origin_city} onChange={(e) => update("origin_city", e.target.value)}>
                {(options?.origins ?? ["Chennai"]).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Transport
              <select
                value={form.transport_mode}
                onChange={(e) => update("transport_mode", e.target.value)}
              >
                {(options?.transport_modes ?? ["bus"]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Arrival date
              <input
                type="date"
                value={form.arrival_date}
                onChange={(e) => update("arrival_date", e.target.value)}
              />
            </label>
            <label>
              Arrival time
              <input
                type="time"
                value={form.arrival_time}
                onChange={(e) => update("arrival_time", e.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Departure date
              <input
                type="date"
                value={form.departure_date}
                onChange={(e) => update("departure_date", e.target.value)}
              />
            </label>
            <label>
              Departure time
              <input
                type="time"
                value={form.departure_time}
                onChange={(e) => update("departure_time", e.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Group
              <select value={form.group_type} onChange={(e) => update("group_type", e.target.value)}>
                {(options?.group_types ?? ["couple"]).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Party size
              <input
                type="number"
                min="1"
                value={form.party_size}
                onChange={(e) => update("party_size", Number(e.target.value))}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Budget
              <select value={form.budget_level} onChange={(e) => update("budget_level", e.target.value)}>
                {(options?.budget_levels ?? ["mid"]).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pace
              <select value={form.pace} onChange={(e) => update("pace", e.target.value)}>
                {(options?.paces ?? ["balanced"]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Diet
              <select value={form.diet} onChange={(e) => update("diet", e.target.value)}>
                {(options?.diets ?? ["any"]).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.has_own_vehicle}
              onChange={(e) => update("has_own_vehicle", e.target.checked)}
            />
            I'll have my own scooter/car there
          </label>

          <fieldset className="interests-field">
            <legend>Interests</legend>
            <div className="interests-grid">
              {(options?.interests ?? []).map((interest) => (
                <button
                  type="button"
                  key={interest}
                  className={`interest-chip${form.interests.includes(interest) ? " is-selected" : ""}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </fieldset>

          <button type="submit" className="planner-submit">
            Next: choose your stay →
          </button>
        </form>
      </div>
    </div>
  );
}
