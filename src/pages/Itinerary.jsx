import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getFood, getPlaces } from "../api/places.js";
import { replan as replanApi } from "../api/replan.js";
import { updateSavedPlan } from "../api/savedPlans.js";

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CONNECTOR_KINDS = new Set(["travel", "transfer"]);
const REAL_KINDS_MESSAGE_TIMEOUT = 3500;

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Data stays in 24h "HH:MM" throughout (sorting, arithmetic, the API contract) —
// only the on-screen label switches to a normal 12-hour clock.
function formatTime12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const MAX_WAIT_MINUTES = 45;
const VISIT_RADIUS_METERS = 150;

// Distance between two lat/lng points, in meters. Used to auto-confirm a
// stop as visited when the phone's live GPS position is close enough to the
// place's known coordinates — not just "the plan says so."
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Mirrors the engine's earliest_start (backend/app/engine/engine.py): find the
// earliest a place/food item could feasibly start at-or-after `arriveMinutes`,
// waiting up to 45 min for a window to open, same as the original scheduler.
// A naive back-to-back repack would erase legitimate "waited for it to open"
// gaps (e.g. Sri Aurobindo Ashram's midday closure) and reject perfectly good
// reorders for the wrong reason.
function earliestStart(windows, closedDays, weekday, arriveMinutes, durationMinutes) {
  if (closedDays.includes(weekday)) return null;
  let best = null;
  for (const w of windows) {
    const [ws, we] = w.split("-").map(timeToMinutes);
    const candidateStart = Math.max(arriveMinutes, ws);
    const wait = candidateStart - arriveMinutes;
    if (wait > MAX_WAIT_MINUTES) continue;
    const candidateEnd = candidateStart + durationMinutes;
    if (candidateEnd > we) continue;
    if (best === null || candidateStart < best) best = candidateStart;
  }
  return best;
}

// Re-times a reordered list of items back-to-back from `anchorMinutes`,
// respecting each item's real opening hours (with the same wait tolerance the
// engine uses). Returns { ok: false, reason } on the first infeasible item,
// leaving the caller to reject the whole reorder rather than apply it partially.
function recomputeWithFeasibility(items, weekday, placesById, foodById, anchorMinutes) {
  let cursor = anchorMinutes;
  const result = [];
  for (const item of items) {
    const duration = timeToMinutes(item.end) - timeToMinutes(item.start);
    const catalogEntry =
      item.kind === "place" ? placesById[item.ref_id] : item.kind === "meal" ? foodById[item.ref_id] : null;

    if (item.status === "skipped" || !catalogEntry) {
      const start = cursor;
      const end = start + duration;
      result.push({ ...item, start: minutesToTime(start), end: minutesToTime(end) });
      cursor = end;
      continue;
    }

    const start = earliestStart(catalogEntry.windows, catalogEntry.closed_days, weekday, cursor, duration);
    if (start === null) {
      return { ok: false, reason: `${item.title} isn't open at that time.` };
    }
    const end = start + duration;
    result.push({ ...item, start: minutesToTime(start), end: minutesToTime(end) });
    cursor = end;
  }
  return { ok: true, items: result };
}

function moveById(list, draggedId, targetId) {
  const fromIndex = list.findIndex((i) => i.id === draggedId);
  const toIndex = list.findIndex((i) => i.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return list;
  const copy = [...list];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function ItemCard({ item, editable, onSkip, onUndo }) {
  const isSkipped = item.status === "skipped";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable || isSkipped,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`itin-card itin-card--${item.kind}${isDragging ? " is-dragging" : ""}`}
    >
      {editable && !isSkipped && (
        <span className="itin-card__drag-handle" title="Drag to reorder" {...attributes} {...listeners}>
          ⋮⋮
        </span>
      )}
      {editable &&
        (isSkipped ? (
          <button type="button" className="itin-card__undo" onClick={onUndo}>
            Undo
          </button>
        ) : (
          <button
            type="button"
            className="itin-card__remove"
            onClick={onSkip}
            aria-label={`Remove ${item.title}`}
            title="Remove"
          >
            ×
          </button>
        ))}
      <div className={`itin-card__content${isSkipped ? " is-fading" : ""}`}>
        <div className="itin-card__time">
          {formatTime12h(item.start)} – {formatTime12h(item.end)}
        </div>
        <div className="itin-card__body">
          <div className="itin-card__title-row">
            <h3>{item.title}</h3>
            {item.status === "done" && <span className="itin-card__visited">Visited ✓</span>}
            {item.cost_pp > 0 && <span className="itin-card__cost">₹{item.cost_pp}</span>}
          </div>
          {item.notes && <p className="itin-card__notes">{item.notes}</p>}
          {item.warning && <p className="itin-card__warning">{item.warning}</p>}
          <div className="itin-card__links">
            {item.map_url && (
              <a href={item.map_url} target="_blank" rel="noreferrer">
                Map
              </a>
            )}
            {item.booking_url && (
              <a href={item.booking_url} target="_blank" rel="noreferrer">
                Book
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorRow({ item }) {
  return (
    <div className="itin-connector">
      <span className="itin-connector__line" />
      <span className="itin-connector__label">
        {item.title} ({formatTime12h(item.start)}–{formatTime12h(item.end)})
      </span>
    </div>
  );
}

const CHANGE_KIND_LABELS = {
  removed: "Removed",
  added: "Added",
  rescheduled: "Moved",
  modified: "Extended",
};

function ChangeLog({ changes, onDismiss }) {
  return (
    <div className="change-log">
      <div className="change-log__header">
        <h2>What changed</h2>
        <button type="button" onClick={onDismiss} aria-label="Dismiss change log">
          ×
        </button>
      </div>
      <ul className="change-log__list">
        {changes.map((c, i) => (
          <li key={i} className={`change-log__item change-log__item--${c.kind}`}>
            <span className="change-log__tag">{CHANGE_KIND_LABELS[c.kind] ?? c.kind}</span>
            <span className="change-log__reason">{c.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReflowBar({ realItems, busy, onApply }) {
  const [open, setOpen] = useState(null); // "running_late" | "closed" | "extend" | null
  const [nowTime, setNowTime] = useState("");
  const [targetId, setTargetId] = useState("");
  const [extendMinutes, setExtendMinutes] = useState(30);

  function toggle(kind) {
    setOpen((o) => (o === kind ? null : kind));
  }

  function submitRunningLate() {
    if (!nowTime) return;
    onApply({ type: "running_late", now_time: nowTime });
    setOpen(null);
  }

  function submitClosed() {
    if (!targetId) return;
    onApply({ type: "closed", item_id: targetId });
    setOpen(null);
    setTargetId("");
  }

  function submitExtend() {
    if (!targetId || !extendMinutes) return;
    onApply({ type: "extend", item_id: targetId, extend_minutes: Number(extendMinutes) });
    setOpen(null);
    setTargetId("");
  }

  return (
    <div className="reflow-bar">
      <span className="reflow-bar__label">Something changed?</span>
      <div className="reflow-bar__buttons">
        <button type="button" disabled={busy} onClick={() => toggle("running_late")}>
          Running late
        </button>
        <button type="button" disabled={busy} onClick={() => onApply({ type: "weather", weather: "rain" })}>
          Rain
        </button>
        <button type="button" disabled={busy} onClick={() => onApply({ type: "energy" })}>
          Feeling tired
        </button>
        <button type="button" disabled={busy} onClick={() => toggle("closed")}>
          Spot closed
        </button>
        <button type="button" disabled={busy} onClick={() => toggle("extend")}>
          Stay longer
        </button>
      </div>

      {open === "running_late" && (
        <div className="reflow-bar__panel">
          <label>
            It's now
            <input type="time" value={nowTime} onChange={(e) => setNowTime(e.target.value)} />
          </label>
          <button type="button" disabled={!nowTime || busy} onClick={submitRunningLate}>
            Re-flow the rest of the day
          </button>
        </div>
      )}

      {open === "closed" && (
        <div className="reflow-bar__panel">
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Which spot is closed?</option>
            {realItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <button type="button" disabled={!targetId || busy} onClick={submitClosed}>
            Re-flow around it
          </button>
        </div>
      )}

      {open === "extend" && (
        <div className="reflow-bar__panel">
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Stay longer where?</option>
            {realItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="10"
            step="10"
            value={extendMinutes}
            onChange={(e) => setExtendMinutes(e.target.value)}
          />
          <span>minutes</span>
          <button type="button" disabled={!targetId || busy} onClick={submitExtend}>
            Re-flow the rest of the day
          </button>
        </div>
      )}
    </div>
  );
}

function AddPlacePanel({ places, usedIds, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  const available = places.filter((p) => !usedIds.has(p.id));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? available.filter((p) =>
        [p.name, p.category, p.area, ...(p.interests ?? [])].some((field) =>
          field?.toLowerCase().includes(q)
        )
      )
    : available;

  return (
    <div className="add-place-panel">
      <div className="add-place-panel__header">
        <span>Add a place to this day</span>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <p className="add-place-panel__note">
        Added at the end of the day for now — travel time between stops isn't
        recalculated yet. That arrives with live re-flow.
      </p>
      <input
        type="text"
        className="add-place-panel__search"
        placeholder="Search places, categories, areas…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="add-place-panel__list">
        {filtered.length === 0 && (
          <p className="add-place-panel__empty">
            {available.length === 0 ? "Nothing left to add." : "No matches."}
          </p>
        )}
        {filtered.map((place) => (
          <div key={place.id} className="add-place-row">
            <div>
              <strong>{place.name}</strong>
              <span className="add-place-row__meta">
                {place.category} · {place.duration_min} min · ★ {place.rating}
              </span>
            </div>
            <button type="button" onClick={() => onAdd(place)}>
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Itinerary() {
  const location = useLocation();
  const navigate = useNavigate();
  const [itinerary, setItinerary] = useState(location.state?.itinerary ?? null);
  const city = location.state?.city ?? "pondicherry";
  const planRequest = location.state?.planRequest;
  const planId = location.state?.planId ?? null;
  // A freshly generated, not-yet-saved plan has no planId and is always editable.
  const canEdit = location.state?.canEdit ?? true;
  const [dayIndex, setDayIndex] = useState(0);
  const [places, setPlaces] = useState([]);
  const [food, setFood] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [changeLog, setChangeLog] = useState(null);
  const [reflowBusy, setReflowBusy] = useState(false);
  // A small activation distance means a tap (map/book links, skip button)
  // isn't mistaken for a drag start — works the same for mouse and touch,
  // since PointerSensor unifies both.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [checkInError, setCheckInError] = useState(null);
  const latestRef = useRef({});

  const day = itinerary?.days?.[dayIndex] ?? null;
  const realItems = day ? day.items.filter((i) => !CONNECTOR_KINDS.has(i.kind)) : [];
  const placesById = Object.fromEntries(places.map((p) => [p.id, p]));
  const foodById = Object.fromEntries(food.map((f) => [f.id, f]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const isToday = day?.date === todayIso;

  useEffect(() => {
    getPlaces(city).then(setPlaces).catch(() => {});
    getFood(city).then(setFood).catch(() => {});
  }, [city]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), REAL_KINDS_MESSAGE_TIMEOUT);
    return () => clearTimeout(t);
  }, [message]);

  // Kept fresh every render so the geolocation callback below (registered
  // once per toggle, not per render) never reads stale closures.
  useEffect(() => {
    latestRef.current = { realItems, placesById, foodById, dayIndex };
  });

  useEffect(() => {
    if (!checkInEnabled || !navigator.geolocation) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { realItems: items, placesById: pById, foodById: fById, dayIndex: di } = latestRef.current;
        const { latitude, longitude } = position.coords;

        for (const item of items) {
          if (item.status !== "planned") continue;
          const catalogEntry =
            item.kind === "place" ? pById[item.ref_id] : item.kind === "meal" ? fById[item.ref_id] : null;
          if (!catalogEntry) continue;

          const distance = haversineMeters(latitude, longitude, catalogEntry.lat, catalogEntry.lng);
          if (distance <= VISIT_RADIUS_METERS) {
            setItinerary((prev) => {
              const days = prev.days.map((d, i) =>
                i === di
                  ? { ...d, items: d.items.map((it) => (it.id === item.id ? { ...it, status: "done" } : it)) }
                  : d
              );
              return { ...prev, days };
            });
            setMessage(`✓ You're at ${item.title} — marked as visited.`);
          }
        }
      },
      (err) => setCheckInError(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [checkInEnabled]);

  if (!itinerary) {
    return (
      <div className="itin-empty">
        <p>No itinerary yet — build one first.</p>
        <Link to="/plan">Go to planner</Link>
      </div>
    );
  }

  const realItemIds = realItems.map((i) => i.id);

  const usedPlaceIds = new Set(
    itinerary.days.flatMap((d) => d.items.filter((i) => i.kind === "place").map((i) => i.ref_id))
  );

  function updateDay(updater) {
    setItinerary((prev) => {
      const days = prev.days.map((d, i) => (i === dayIndex ? updater(d) : d));
      return { ...prev, days };
    });
  }

  function setItemStatus(itemId, status) {
    updateDay((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
    }));
  }

  function handleAddPlace(place) {
    const lastItem = day.items[day.items.length - 1];
    const start = lastItem ? timeToMinutes(lastItem.end) : 9 * 60;
    const end = start + place.duration_min;
    const newItem = {
      id: `local_${Date.now()}`,
      start: minutesToTime(start),
      end: minutesToTime(end),
      kind: "place",
      ref_id: place.id,
      title: place.name,
      area: place.area,
      cost_pp: place.cost_pp,
      notes: place.notes,
      booking_url: place.booking_url,
      map_url: `https://www.google.com/maps?q=${place.lat},${place.lng}`,
      locked: false,
      status: "planned",
      warning: null,
    };
    updateDay((d) => ({ ...d, items: [...d.items, newItem] }));
    setPickerOpen(false);
  }

  function reorderItems(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;

    const realItems = day.items.filter((i) => !CONNECTOR_KINDS.has(i.kind));
    const anchor = timeToMinutes(realItems[0].start);
    const reordered = moveById(realItems, draggedId, targetId);
    const result = recomputeWithFeasibility(reordered, day.weekday, placesById, foodById, anchor);

    if (!result.ok) {
      setMessage(result.reason); // reject the whole reorder, leave the day untouched
      return;
    }

    // Reordering only makes sense for the "real" stops — old travel connectors
    // no longer describe the new adjacency, so they're dropped (same trade-off
    // "Add a place" already makes: no travel-time recalculation without re-flow).
    updateDay((d) => ({ ...d, items: result.items }));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderItems(active.id, over.id);
  }

  async function handleSaveChanges() {
    if (!planId) return;
    setSaveState("saving");
    try {
      await updateSavedPlan(planId, itinerary);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setMessage(err.message);
    }
  }

  async function applyDisruption(partial) {
    setReflowBusy(true);
    try {
      const result = await replanApi({
        city,
        itinerary,
        planRequest,
        disruption: { day_index: dayIndex, ...partial },
      });
      setItinerary(result.itinerary);
      setChangeLog(result.changes);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setReflowBusy(false);
    }
  }

  return (
    <div className="itin-page">
      <header className="itin-header">
        <Link to="/" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Your itinerary</h1>
        <div className="itin-header__actions">
          {!canEdit && <span className="itin-header__badge">View only</span>}
          {canEdit && planId && (
            <button
              type="button"
              className="itin-header__save-btn"
              onClick={handleSaveChanges}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save changes"}
            </button>
          )}
          <button
            type="button"
            className="itin-header__summary-btn"
            onClick={() => navigate("/summary", { state: { itinerary, city, planRequest } })}
          >
            Looks good →
          </button>
        </div>
      </header>

      <nav className="itin-day-tabs">
        {itinerary.days.map((d, i) => (
          <button
            key={d.date}
            className={`itin-day-tab${i === dayIndex ? " is-active" : ""}`}
            onClick={() => {
              setDayIndex(i);
              setPickerOpen(false);
              setChangeLog(null);
            }}
          >
            <span className="itin-day-tab__weekday">{WEEKDAY_NAMES[d.weekday]}</span>
            <span className="itin-day-tab__date">{formatDate(d.date)}</span>
          </button>
        ))}
      </nav>

      {canEdit && (
        <div className="check-in-bar">
          <label className="check-in-bar__toggle">
            <input
              type="checkbox"
              checked={checkInEnabled}
              disabled={!isToday}
              onChange={(e) => {
                setCheckInError(null);
                setCheckInEnabled(e.target.checked);
              }}
            />
            Auto check-in with my location
          </label>
          <span className="check-in-bar__note">
            {isToday
              ? "Keep this page open while you're out — stops get marked visited automatically."
              : "Only available on today's day tab."}
          </span>
          {checkInError && <span className="error">{checkInError}</span>}
        </div>
      )}

      {canEdit && <ReflowBar realItems={realItems} busy={reflowBusy} onApply={applyDisruption} />}

      {changeLog && changeLog.length > 0 && (
        <ChangeLog changes={changeLog} onDismiss={() => setChangeLog(null)} />
      )}

      {message && <div className="itin-toast">{message}</div>}

      <main className="itin-timeline">
        {day.items.length === 0 && <p className="itin-empty-day">Nothing scheduled this day.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={realItemIds} strategy={verticalListSortingStrategy}>
            {day.items.map((item) =>
              CONNECTOR_KINDS.has(item.kind) ? (
                <ConnectorRow key={item.id} item={item} />
              ) : (
                <ItemCard
                  key={item.id}
                  item={item}
                  editable={canEdit}
                  onSkip={() => setItemStatus(item.id, "skipped")}
                  onUndo={() => setItemStatus(item.id, "planned")}
                />
              )
            )}
          </SortableContext>
        </DndContext>

        {canEdit &&
          (pickerOpen ? (
            <AddPlacePanel
              places={places}
              usedIds={usedPlaceIds}
              onAdd={handleAddPlace}
              onClose={() => setPickerOpen(false)}
            />
          ) : (
            <button type="button" className="add-place-trigger" onClick={() => setPickerOpen(true)}>
              + Add a place
            </button>
          ))}
      </main>
    </div>
  );
}
