import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMemories } from "../api/memories.js";
import { getSavedPlans } from "../api/savedPlans.js";

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Memories() {
  const [memories, setMemories] = useState([]);
  const [plansById, setPlansById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getMemories(), getSavedPlans()])
      .then(([memoryList, plans]) => {
        setMemories(memoryList);
        setPlansById(Object.fromEntries(plans.map((p) => [p.id, p])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="summary-page">
      <header className="itin-header">
        <Link to="/" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Memories</h1>
        <Link to="/trips" className="itin-header__summary-btn">
          My trips
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {!loading && memories.length === 0 && (
        <p className="itin-empty-day">
          No memories yet — mark a trip as completed from <Link to="/trips">My trips</Link> to add one.
        </p>
      )}

      <div className="summary-cards">
        {memories.map((memory) => {
          const plan = plansById[memory.saved_plan_id];
          return (
            <Link key={memory.id} to={`/memories/${memory.id}`} className="summary-card memory-card">
              <div className="summary-card__title-row">
                <strong>{plan?.city ?? "Trip"}</strong>
              </div>
              {plan && (
                <p className="summary-card__meta">
                  {formatDate(plan.arrival_date)} – {formatDate(plan.departure_date)}
                </p>
              )}
              <p className="summary-card__notes">
                {memory.summary.done_count} stop{memory.summary.done_count === 1 ? "" : "s"} ·{" "}
                {memory.stories.length} stor{memory.stories.length === 1 ? "y" : "ies"} ·{" "}
                {memory.photos.length} photo{memory.photos.length === 1 ? "" : "s"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
