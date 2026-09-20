import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  approveEdit,
  deleteSavedPlan,
  denyEdit,
  getSavedPlan,
  getSavedPlans,
  getSharedWithMe,
  listShares,
  requestEdit,
  revokeShare,
  sharePlan,
  updatePlanStatus,
} from "../api/savedPlans.js";
import { createMemory } from "../api/memories.js";
import { useAuth } from "../context/AuthContext.jsx";

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SharePanel({ planId, onClose }) {
  const [shares, setShares] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    listShares(planId)
      .then(setShares)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [planId]);

  async function handleShare(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sharePlan(planId, email);
      setEmail("");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(shareId) {
    await approveEdit(planId, shareId);
    refresh();
  }

  async function handleDeny(shareId) {
    await denyEdit(planId, shareId);
    refresh();
  }

  async function handleRevoke(shareId) {
    await revokeShare(planId, shareId);
    refresh();
  }

  return (
    <div className="add-place-panel share-panel">
      <div className="add-place-panel__header">
        <span>Share this trip</span>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="add-place-panel__note">
        Friends can only view by default. They can request edit access, but nothing changes
        until you approve it.
      </p>
      <form className="save-plan__form" onSubmit={handleShare}>
        <input
          type="email"
          required
          placeholder="friend@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Sharing…" : "Share"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      <div className="share-panel__list">
        {shares.length === 0 && <p className="add-place-panel__empty">Not shared with anyone yet.</p>}
        {shares.map((share) => (
          <div key={share.id} className="share-row">
            <div>
              <strong>{share.shared_with_email}</strong>
              <span className="add-place-row__meta">
                {share.role === "editor" ? "Can edit" : "View only"}
                {share.edit_requested && " · wants edit access"}
              </span>
            </div>
            <div className="share-row__actions">
              {share.edit_requested && (
                <>
                  <button type="button" onClick={() => handleApprove(share.id)}>
                    Approve
                  </button>
                  <button type="button" onClick={() => handleDeny(share.id)}>
                    Deny
                  </button>
                </>
              )}
              <button type="button" onClick={() => handleRevoke(share.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyTrips() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [sharedPlans, setSharedPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  function refresh() {
    setLoading(true);
    Promise.all([getSavedPlans(), getSharedWithMe()])
      .then(([owned, shared]) => {
        setPlans(owned);
        setSharedPlans(shared);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function openPlan(id) {
    setOpeningId(id);
    try {
      const full = await getSavedPlan(id);
      navigate("/itinerary", {
        state: {
          itinerary: full.itinerary,
          city: full.city,
          planRequest: full.plan_request,
          planId: full.id,
          canEdit: full.can_edit,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDelete(id) {
    await deleteSavedPlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleRequestEdit(id) {
    await requestEdit(id);
    refresh();
  }

  async function handleMarkCompleted(id) {
    try {
      await updatePlanStatus(id, "completed");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMemory(id) {
    try {
      const memory = await createMemory(id);
      navigate(`/memories/${memory.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="summary-page">
      <header className="itin-header">
        <Link to="/" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>My trips</h1>
        <button type="button" className="itin-header__summary-btn" onClick={logout}>
          Log out ({user?.email})
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {!loading && plans.length === 0 && <p className="itin-empty-day">No saved trips yet.</p>}

      <div className="summary-cards">
        {plans.map((plan) => (
          <div key={plan.id} className="summary-card">
            <div className="summary-card__title-row">
              <strong>{plan.city}</strong>
            </div>
            <p className="summary-card__meta">
              {formatDate(plan.arrival_date)} – {formatDate(plan.departure_date)}
            </p>
            <p className="summary-card__notes">
              {plan.reminder_sent_at ? "Reminder sent" : "Reminder pending"}
              {plan.status === "completed" && " · Completed"}
            </p>
            <div className="itin-card__links">
              <button type="button" onClick={() => openPlan(plan.id)} disabled={openingId === plan.id}>
                {openingId === plan.id ? "Opening…" : "View"}
              </button>
              <button type="button" onClick={() => setSharingId(plan.id)}>
                Share
              </button>
              {plan.status === "completed" ? (
                <button type="button" onClick={() => handleAddMemory(plan.id)}>
                  Add memory
                </button>
              ) : (
                <button type="button" onClick={() => handleMarkCompleted(plan.id)}>
                  Mark as completed
                </button>
              )}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(plan.id);
                }}
              >
                Delete
              </a>
            </div>
            {sharingId === plan.id && (
              <SharePanel planId={plan.id} onClose={() => setSharingId(null)} />
            )}
          </div>
        ))}
      </div>

      {sharedPlans.length > 0 && (
        <>
          <h2 className="landing__section-title" style={{ marginTop: "40px" }}>
            Shared with me
          </h2>
          <div className="summary-cards">
            {sharedPlans.map((plan) => (
              <div key={plan.id} className="summary-card">
                <div className="summary-card__title-row">
                  <strong>{plan.city}</strong>
                </div>
                <p className="summary-card__meta">
                  {formatDate(plan.arrival_date)} – {formatDate(plan.departure_date)}
                </p>
                <p className="summary-card__notes">
                  From {plan.owner_email} · {plan.role === "editor" ? "Can edit" : "View only"}
                </p>
                <div className="itin-card__links">
                  <button type="button" onClick={() => openPlan(plan.id)} disabled={openingId === plan.id}>
                    {openingId === plan.id ? "Opening…" : "View"}
                  </button>
                  {plan.role !== "editor" &&
                    (plan.edit_requested ? (
                      <span className="add-place-row__meta">Edit requested</span>
                    ) : (
                      <button type="button" onClick={() => handleRequestEdit(plan.id)}>
                        Request edit access
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
