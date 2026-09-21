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
import { createMemory, uploadPhoto } from "../api/memories.js";
import { chatWithGuide } from "../api/guide.js";

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

// "10:00-18:00" -> "10:00 AM–6:00 PM"; multiple windows (e.g. a lunch/dinner
// split) join with a comma so the user can see exactly when a place is
// actually open, not just guess from a single "Closed at this time" tag.
function formatWindows(windows) {
  return (windows || [])
    .map((w) => {
      const [start, end] = w.split("-");
      return `${formatTime12h(start)}–${formatTime12h(end)}`;
    })
    .join(", ");
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

// Rough city-travel speeds (km/h) per mode, plus a small fixed buffer for
// waiting/parking/etc. Straight-line distance is inflated by the same 1.3x
// detour factor the backend planner uses, so estimates stay in the same
// ballpark as the auto-generated schedule instead of two different systems
// disagreeing with each other.
const TRANSPORT_MODES = [
  { key: "walk", label: "Walk", speedKmh: 4.5, bufferMin: 3 },
  { key: "cycle", label: "Cycle", speedKmh: 12, bufferMin: 4 },
  { key: "auto", label: "Auto", speedKmh: 22, bufferMin: 8 },
  { key: "bike", label: "Bike", speedKmh: 28, bufferMin: 6 },
];

function travelMinutesForMode(distanceKm, modeKey) {
  const mode = TRANSPORT_MODES.find((m) => m.key === modeKey) ?? TRANSPORT_MODES[2];
  return Math.max(1, Math.round(((distanceKm * 1.3) / mode.speedKmh) * 60 + mode.bufferMin));
}

// Common words a user types don't literally appear in the catalog data --
// "food" should surface every restaurant/cafe, "rental bike" should find a
// place named "Rental Bicycle". Each key expands to itself plus its
// synonyms/variants so a search term matches on meaning, not spelling.
const SEARCH_SYNONYMS = {
  food: ["restaurant", "cafe", "meal", "dining", "eatery", "breakfast", "lunch", "dinner", "snack"],
  restaurant: ["food", "meal", "dining", "eatery"],
  restaurants: ["food", "meal", "dining", "eatery"],
  cafe: ["coffee", "cafe"],
  coffee: ["cafe"],
  bike: ["bicycle", "cycle", "cycling"],
  bikes: ["bicycle", "cycle", "cycling"],
  bicycle: ["bike", "cycle", "cycling"],
  cycle: ["bicycle", "bike", "cycling"],
  cycling: ["bicycle", "bike", "cycle"],
  rental: ["rent", "hire"],
  rent: ["rental", "hire"],
  hire: ["rental", "rent"],
  temple: ["shrine"],
  church: ["basilica", "cathedral"],
  shopping: ["market", "boutique", "store", "shop"],
  shop: ["shopping", "market", "boutique", "store"],
  turf: ["sports", "cricket", "football"],
  sports: ["turf", "activity"],
};

function expandSearchTerm(word) {
  return [word, ...(SEARCH_SYNONYMS[word] ?? [])];
}

// A catalog entry matches a query when every typed word (or one of its
// synonyms) shows up somewhere in its searchable text -- words can match
// across different fields, so "rental bike" finds a place whose category
// says "activity" and whose name says "Rental Bicycle".
function matchesSearch(item, queryWords) {
  // Only match fields the row actually shows (name, category, hours-ish
  // meals) or that directly explain the result (kind). Matching against
  // free-text notes or hidden interest tags turned up results with no
  // visible reason to be there -- e.g. "food" surfacing a beach because its
  // notes happen to mention nearby cafes -- which just looks like broken
  // search since nothing on the row explains the match.
  //
  // Restaurants/cafes are the one exception: a dish name ("fried rice",
  // "shawarma") only ever shows up in a food item's notes, since there's no
  // separate menu field, and the row displays those notes for food items --
  // see AddPlacePanel -- so the match is still visible, not a mystery.
  const fields = [item.name, item.category, item.area, item.kind, ...(item.meals ?? [])];
  if (item.kind === "meal") fields.push(item.notes);
  const tokens = fields
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return queryWords.every((word) =>
    expandSearchTerm(word).some((variant) => tokens.some((token) => token.startsWith(variant)))
  );
}

function catalogEntryFor(item, placesById, foodById) {
  if (item.kind === "place") return placesById[item.ref_id];
  if (item.kind === "meal") return foodById[item.ref_id];
  return null;
}

// A travel connector's distance comes from whichever real stops sit right
// before and after it in the array -- always exactly one of each, since the
// generator alternates real/travel items.
function connectorDistanceKm(dayItems, idx, placesById, foodById) {
  const prevEntry = catalogEntryFor(dayItems[idx - 1] ?? {}, placesById, foodById);
  const nextEntry = catalogEntryFor(dayItems[idx + 1] ?? {}, placesById, foodById);
  if (!prevEntry || !nextEntry) return null;
  return haversineMeters(prevEntry.lat, prevEntry.lng, nextEntry.lat, nextEntry.lng) / 1000;
}

// Sets one item's exact start/end (not just how long it lasts -- a later
// chosen start just leaves a gap before it, which is fine, real idle time)
// and shifts every item after it by however much its END time changed.
function applyTimeRangeChange(items, idx, newStart, newEnd) {
  const oldEnd = timeToMinutes(items[idx].end);
  const delta = timeToMinutes(newEnd) - oldEnd;
  return items.map((it, i) => {
    if (i < idx) return it;
    if (i === idx) return { ...it, start: newStart, end: newEnd };
    if (delta === 0) return it;
    return {
      ...it,
      start: minutesToTime(timeToMinutes(it.start) + delta),
      end: minutesToTime(timeToMinutes(it.end) + delta),
    };
  });
}

// Whether a real catalog place's windows/closed_days fully cover a proposed
// [startMin, endMin) visit -- the one source of truth for "does this
// actually fit", used both to block an invalid edit before it's applied and
// to flag a downstream stop a shift pushed outside its own hours.
function windowsCoverRange(windows, closedDays, weekday, startMin, endMin) {
  if (closedDays.includes(weekday)) return false;
  return windows.some((w) => {
    const [s, e] = w.split("-").map(timeToMinutes);
    return startMin >= s && endMin <= e;
  });
}

// After a shift, a later real stop might now land outside its own real
// opening hours -- flag it plainly (reusing the existing warning line every
// card already renders) instead of silently leaving a broken schedule
// standing unremarked.
function flagInfeasibleItems(items, weekday, placesById, foodById) {
  return items.map((it) => {
    if (CONNECTOR_KINDS.has(it.kind) || it.status === "skipped") return it;
    const entry = catalogEntryFor(it, placesById, foodById);
    if (!entry) return it;
    const fits = windowsCoverRange(entry.windows, entry.closed_days, weekday, timeToMinutes(it.start), timeToMinutes(it.end));
    return { ...it, warning: fits ? null : `May be closed by then — real hours: ${formatWindows(entry.windows)}` };
  });
}

// Changes one item's duration in place and shifts every item after it by
// the same delta, keeping the rest of the day's relative timing intact --
// used by a connector's travel-mode change.
function applyDurationChange(items, idx, newDurationMinutes) {
  const item = items[idx];
  const oldDuration = timeToMinutes(item.end) - timeToMinutes(item.start);
  const delta = newDurationMinutes - oldDuration;
  if (delta === 0) return items;
  return items.map((it, i) => {
    if (i < idx) return it;
    if (i === idx) return { ...it, end: minutesToTime(timeToMinutes(it.start) + newDurationMinutes) };
    return {
      ...it,
      start: minutesToTime(timeToMinutes(it.start) + delta),
      end: minutesToTime(timeToMinutes(it.end) + delta),
    };
  });
}

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
// engine uses) where that's possible. A drag-and-drop is a "let me just try
// this order" gesture, not a commitment the user should have to defend --
// so an item that doesn't cleanly fit is never blocked, just placed
// back-to-back anyway and flagged with a warning the user can act on.
function recomputeWithFeasibility(items, weekday, placesById, foodById, anchorMinutes) {
  let cursor = anchorMinutes;
  const result = [];
  let allFit = true;
  for (const item of items) {
    // A skipped stop no longer happens, so it can't hold up anything after
    // it -- leave its own (now purely historical) time untouched and don't
    // advance the cursor, so the next active stop closes right up to
    // whatever came before it instead of waiting out the skipped slot.
    if (item.status === "skipped") {
      result.push(item);
      continue;
    }

    const duration = timeToMinutes(item.end) - timeToMinutes(item.start);
    const catalogEntry =
      item.kind === "place" ? placesById[item.ref_id] : item.kind === "meal" ? foodById[item.ref_id] : null;

    if (!catalogEntry) {
      const start = cursor;
      const end = start + duration;
      result.push({ ...item, start: minutesToTime(start), end: minutesToTime(end) });
      cursor = end;
      continue;
    }

    const fitStart = earliestStart(catalogEntry.windows, catalogEntry.closed_days, weekday, cursor, duration);
    const start = fitStart === null ? cursor : fitStart;
    const end = start + duration;
    const warning =
      fitStart === null ? `May be closed by then — real hours: ${formatWindows(catalogEntry.windows)}` : null;
    if (warning) allFit = false;
    result.push({ ...item, start: minutesToTime(start), end: minutesToTime(end), warning });
    cursor = end;
  }
  return { ok: true, items: result, allFit };
}

// Rebuilds the travel connectors between a freshly reordered/re-timed list
// of real stops. A reorder invalidates every old connector's adjacency (it
// described the PREVIOUS pair of neighbors, not these), but the rest of the
// itinerary still expects one between every pair of real stops -- both for
// the distance/mode picker UI and for later edits (e.g. picking a mode)
// that assume it's there. No travel time is allocated into the schedule
// here (that still needs live re-flow); it starts as a zero-length
// placeholder the user can expand by picking a transport mode.
function withRebuiltConnectors(realItems, placesById, foodById) {
  const result = [];
  realItems.forEach((item, i) => {
    if (i > 0) {
      const prev = realItems[i - 1];
      const prevEntry = catalogEntryFor(prev, placesById, foodById);
      const nextEntry = catalogEntryFor(item, placesById, foodById);
      if (prevEntry && nextEntry) {
        result.push({
          id: `travel_local_${Date.now()}_${i}`,
          start: prev.end,
          end: prev.end,
          kind: "travel",
          ref_id: null,
          title: `Travel to ${item.title}`,
          area: null,
          cost_pp: 0,
        });
      }
    }
    result.push(item);
  });
  return result;
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

// Coarse buckets for "when in the day" the AI guide asks about, before
// asking how long, before figuring out what to clear -- matches how a
// person actually thinks about a day, not raw minute ranges.
const DAY_SEGMENTS = [
  { key: "morning", label: "Morning", range: [360, 720] }, // 06:00-12:00
  { key: "afternoon", label: "Afternoon", range: [720, 1020] }, // 12:00-17:00
  { key: "evening", label: "Evening", range: [1020, 1380] }, // 17:00-23:00
];

const DURATION_OPTIONS_MIN = [30, 60, 90, 120];

// Bubbles are the primary way to answer "which category/segment/how long",
// but a user typing the answer instead ("3 hr", "evening") is completely
// natural and shouldn't silently fall through to the AI as an unrelated
// chat message. These let handleSend recognize a typed answer to whatever
// question is currently pending and resolve it exactly like a bubble click,
// entirely client-side -- no AI round-trip, and typed durations aren't even
// limited to the 4 preset bubble values.
function parseCategoryFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes("attraction") || lower.includes("activit")) return "place";
  if (lower.includes("restaurant") || lower.includes("food") || lower.includes("eat")) return "meal";
  return null;
}

function parseSegmentFromText(text, segments) {
  const lower = text.toLowerCase();
  return segments.find((seg) => lower.includes(seg.key))?.key ?? null;
}

function parseDurationFromText(text) {
  const lower = text.toLowerCase();
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)\b/);
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]) * 60);
  const minMatch = lower.match(/(\d+)\s*(?:mins?|minutes?|m)\b/);
  if (minMatch) return parseInt(minMatch[1], 10);
  return null;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// Which of the 3 day segments this place could actually be visited during,
// given its real opening windows and closed_days -- only offer segments
// that are genuinely possible, never all three by default.
function segmentsForPlace(place, weekday) {
  if (place.closed_days.includes(weekday)) return [];
  return DAY_SEGMENTS.filter((seg) =>
    place.windows.some((w) => {
      const [s, e] = w.split("-").map(timeToMinutes);
      return rangesOverlap(s, e, seg.range[0], seg.range[1]);
    })
  );
}

// Finds the smallest contiguous run of existing stops within `segmentRange`
// that, if removed, frees enough contiguous time for a `duration`-minute
// visit to `place` that also genuinely fits its real opening hours. Tries
// runs shortest-first so the suggestion never asks to remove more than
// necessary. Returns null if nothing in this segment would ever work (even
// clearing the whole segment isn't enough, or the place doesn't open in
// time within it).
function computeSegmentRemovalPlan(dayItems, weekday, place, segmentRange, duration) {
  const realItems = dayItems.filter((i) => !CONNECTOR_KINDS.has(i.kind) && i.status !== "skipped");
  // The segment is where the user wants to START, not a hard ceiling on how
  // much time can be freed -- a longer visit is allowed to run into later
  // segments too (e.g. "morning" spilling into early afternoon), as long as
  // the place is still genuinely open by real hours at that point. Only
  // stops ending at/after the segment start are candidates; nothing earlier
  // in the day is touched.
  const candidateIdxs = realItems
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => timeToMinutes(it.end) > segmentRange[0])
    .map(({ idx }) => idx);

  for (let runLen = 1; runLen <= candidateIdxs.length; runLen++) {
    for (let i = 0; i + runLen <= candidateIdxs.length; i++) {
      const runIdxs = candidateIdxs.slice(i, i + runLen);
      const first = realItems[runIdxs[0]];
      const last = realItems[runIdxs[runIdxs.length - 1]];
      const freedStart = Math.max(timeToMinutes(first.start), segmentRange[0]);
      const freedEnd = timeToMinutes(last.end);
      if (freedEnd - freedStart < duration) continue;
      const start = earliestStart(place.windows, place.closed_days, weekday, freedStart, duration);
      if (start !== null && start + duration <= freedEnd) {
        return { candidates: runIdxs.map((idx) => realItems[idx]), newStart: start, newEnd: start + duration };
      }
    }
  }
  return null;
}

// Removes the candidate stops, inserts the new place in their place, and
// shifts everything after it earlier by however much time was left over --
// a real (if local) re-flow, not just an append. Travel connectors are
// dropped throughout, same trade-off drag-reorder already makes: they no
// longer describe the new adjacency and aren't recalculated here.
function buildInsertedDayItems(dayItems, candidates, place, newStart, newEnd) {
  const candidateIds = new Set(candidates.map((c) => c.id));
  const removedEnd = timeToMinutes(candidates[candidates.length - 1].end);
  const delta = newEnd - removedEnd;
  const newItem = {
    id: `local_${Date.now()}`,
    start: minutesToTime(newStart),
    end: minutesToTime(newEnd),
    kind: place.kind ?? "place",
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

  const realItems = dayItems.filter((i) => !CONNECTOR_KINDS.has(i.kind));
  const result = [];
  let inserted = false;
  let pastRemoval = false;
  for (const item of realItems) {
    if (candidateIds.has(item.id)) {
      if (!inserted) {
        result.push(newItem);
        inserted = true;
      }
      pastRemoval = true;
      continue;
    }
    if (pastRemoval && delta !== 0) {
      result.push({
        ...item,
        start: minutesToTime(timeToMinutes(item.start) + delta),
        end: minutesToTime(timeToMinutes(item.end) + delta),
      });
    } else {
      result.push(item);
    }
  }
  if (!inserted) result.push(newItem);
  return result;
}

// Explicit "from this time to this time" entry instead of just a duration —
// closer to how a person actually plans ("I'll be at WTF from 8:46 to
// 10:16"), and it naturally allows a gap before the visit too (arrived
// earlier but chose to start later), not just a length.
function TimeRangeEditor({ currentStart, currentEnd, catalogEntry, weekday, onApply, onClose }) {
  const [from, setFrom] = useState(currentStart);
  const [to, setTo] = useState(currentEnd);
  const orderInvalid = !from || !to || timeToMinutes(to) <= timeToMinutes(from);
  // Block the edit outright if the entered range falls outside this exact
  // place's real hours -- not just a warning after the fact, since this is
  // the one moment we know precisely what the user is trying to set.
  const outsideHours =
    !orderInvalid &&
    catalogEntry &&
    !windowsCoverRange(catalogEntry.windows, catalogEntry.closed_days, weekday, timeToMinutes(from), timeToMinutes(to));

  return (
    <div className="duration-editor">
      <p>When will you actually be here?</p>
      <div className="duration-editor__range">
        <label>
          From
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {outsideHours && catalogEntry && (
        <p className="duration-editor__error">
          Closed then — real hours: {formatWindows(catalogEntry.windows)}
        </p>
      )}
      <div className="duration-editor__custom">
        <button type="button" disabled={orderInvalid || outsideHours} onClick={() => onApply(from, to)}>
          Set
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ItemCard({ item, editable, catalogEntry, weekday, onSkip, onUndo, onAddPhoto, photoBusy, onSetTimeRange }) {
  const isSkipped = item.status === "skipped";
  const fileInputRef = useRef(null);
  const [editingDuration, setEditingDuration] = useState(false);
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
        <div className="itin-card__time-block">
          {catalogEntry?.windows && (
            <div className="itin-card__hours">Open {formatWindows(catalogEntry.windows)}</div>
          )}
          {editable && !isSkipped && onSetTimeRange ? (
            <button
              type="button"
              className="itin-card__time-btn"
              onClick={() => setEditingDuration((o) => !o)}
            >
              {formatTime12h(item.start)} – {formatTime12h(item.end)}
            </button>
          ) : (
            <div className="itin-card__time">
              {formatTime12h(item.start)} – {formatTime12h(item.end)}
            </div>
          )}
          {editingDuration && (
            <TimeRangeEditor
              currentStart={item.start}
              currentEnd={item.end}
              catalogEntry={catalogEntry}
              weekday={weekday}
              onApply={(from, to) => {
                onSetTimeRange(item.id, from, to);
                setEditingDuration(false);
              }}
              onClose={() => setEditingDuration(false)}
            />
          )}
        </div>
        <div className="itin-card__body">
          <div className="itin-card__title-row">
            <h3>{item.title}</h3>
            {item.status === "done" && <span className="itin-card__visited">Visited ✓</span>}
            {item.status === "done" && onAddPhoto && (
              <>
                <button
                  type="button"
                  className="itin-card__photo-btn"
                  title="Add a photo to your trip memory"
                  aria-label={`Add a photo of ${item.title}`}
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📷
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onAddPhoto(file, item.title);
                  }}
                />
              </>
            )}
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

function ConnectorRow({ item, distanceKm, editable, onSelectMode, faded }) {
  return (
    <div className={`itin-connector${faded ? " itin-connector--faded" : ""}`}>
      <span className="itin-connector__line" />
      <div className="itin-connector__content">
        <span className="itin-connector__label">
          {item.title}
          {distanceKm != null && ` — ${distanceKm.toFixed(distanceKm < 1 ? 2 : 1)} km`}
          {item.travelMode && ` · ${formatTime12h(item.start)}–${formatTime12h(item.end)}`}
          {faded && " · not needed, that stop is skipped"}
        </span>
        {editable && !faded && distanceKm != null && onSelectMode && (
          <div className="itin-connector__modes">
            {TRANSPORT_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                className={`itin-connector__mode-chip${item.travelMode === mode.key ? " is-selected" : ""}`}
                onClick={() => onSelectMode(item.id, mode.key)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>
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

function AddPlacePanel({ places, food, usedIds, weekday, anchorMinutes, onAdd, onClose }) {
  const [query, setQuery] = useState("");
  // Places and restaurants/bars are both real catalog entries the user can
  // add — the only real constraint is whether it's actually open at the
  // time it'd be scheduled, not which catalog list it happens to live in.
  const catalog = [
    ...places.map((p) => ({ ...p, kind: "place" })),
    ...food.map((f) => ({ ...f, kind: "meal", category: f.price_band })),
  ];
  // Browsing with no search term hides stops already in today's plan, to
  // keep the default list short -- but a deliberate search still finds
  // them. Some places are genuinely visited twice in a day (rent a bike in
  // the morning, come back to return it by evening), so re-adding one on
  // purpose needs to stay possible, just not clutter the default browse.
  const unusedAvailable = catalog.filter((p) => !usedIds.has(p.id));
  const queryWords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = queryWords.length ? catalog.filter((p) => matchesSearch(p, queryWords)) : unusedAvailable;

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
        placeholder="Search places, restaurants, categories, areas…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="add-place-panel__list">
        {filtered.length === 0 && (
          <p className="add-place-panel__empty">
            {queryWords.length === 0 && unusedAvailable.length === 0 ? "Nothing left to add." : "No matches."}
          </p>
        )}
        {filtered.map((place) => {
          const feasible =
            earliestStart(place.windows, place.closed_days, weekday, anchorMinutes, place.duration_min) !==
            null;
          const alreadyAdded = usedIds.has(place.id);
          return (
            <div key={place.id} className="add-place-row">
              <div>
                <strong>{place.name}</strong>
                <span className="add-place-row__meta">
                  {place.category} · {place.duration_min} min · ★ {place.rating} · {formatWindows(place.windows)}
                  {!feasible && " · May be closed at that time — you can still add it"}
                  {alreadyAdded && " · Already in today's plan — add again for a second visit (e.g. returning a rental)"}
                </span>
                {place.kind === "meal" && place.notes && (
                  <span className="add-place-row__notes">{place.notes}</span>
                )}
              </div>
              <button type="button" onClick={() => onAdd(place)}>
                Add
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GUIDE_INTRO =
  "Hi! Tell me what you'd like to change — add a place, remove a stop, or move something earlier.";
const GUIDE_MAX_STEPS = 4;
// A network hiccup or backend issue should never surface as raw error text —
// the guide always answers in character, same principle as the backend's
// own fallback-to-friendly-reply behavior when Gemini itself is unavailable.
const GUIDE_TROUBLE_REPLY = "I'm having a little trouble right now — mind trying that again in a moment?";

function toGuideItem(item) {
  return { id: item.id, title: item.title, kind: item.kind, status: item.status, start: item.start, end: item.end };
}

// A conversational front-end to the same deterministic logic the buttons
// above already use (tryAddPlace/tryRemovePlace/tryReorderBefore) — the
// model picks *what* the user means, but every actual schedule change still
// goes through the same opening-hours/feasibility checks, so it can't
// produce an itinerary the rest of the app wouldn't also allow.
function GuideChat({
  city,
  itineraryRef,
  dayIndex,
  catalogById,
  usedPlaceIds,
  tryAddPlace,
  tryRemovePlace,
  tryReorderBefore,
  tryInsertPlace,
  onClose,
}) {
  const [displayMessages, setDisplayMessages] = useState([{ role: "assistant", text: GUIDE_INTRO }]);
  const [contents, setContents] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null); // the suggestion card currently showing detail + add/no
  // Which category (place/meal) has been picked per message index -- when a
  // message's suggestions span both, show category chips first and only
  // reveal individual places once one is picked, entirely client-side (no
  // extra AI round-trip needed, we already have the full list).
  const [categoryChoice, setCategoryChoice] = useState({});
  // Per-message state for the "when + how long + what to clear" flow that
  // kicks in when a place doesn't fit as-is: which segment (morning/
  // afternoon/evening) and duration the user picked, keyed by message index.
  const [segmentChoice, setSegmentChoice] = useState({});
  const [durationChoice, setDurationChoice] = useState({});
  // A multi-step turn (e.g. remove_place then add_place) makes several
  // chatWithGuide round-trips inside one already-running runTurn() call.
  // tryAddPlace/tryRemovePlace/tryReorderBefore themselves always read the
  // true latest state (via itineraryRef, kept synchronously fresh by the
  // parent's updateDay). But `catalogById`/the try* functions as PROPS are
  // still only refreshed when the parent re-renders -- reading them through
  // this ref, resynced every render, avoids acting on the specific prop
  // values captured back when this turn started.
  const latestRef = useRef(null);
  useEffect(() => {
    latestRef.current = { catalogById, tryAddPlace, tryRemovePlace, tryReorderBefore, tryInsertPlace };
  });

  function currentDayContext() {
    const d = itineraryRef.current.days[dayIndex];
    const realItems = d.items.filter((i) => !CONNECTOR_KINDS.has(i.kind));
    return { weekday: d.weekday, realItems };
  }

  function handleAddSuggestion(place) {
    const catalogEntry = catalogById[place.id];
    if (!catalogEntry) {
      setDisplayMessages((m) => [...m, { role: "assistant", text: "That place isn't in the catalog anymore." }]);
      setExpanded(null);
      return;
    }
    const result = tryAddPlace(catalogEntry);
    setDisplayMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: result.ok ? `Added ${place.name}! Anything else you'd like to change?` : result.reason,
      },
    ]);
    setExpanded(null);
  }

  function handleDeclineSuggestion() {
    setDisplayMessages((m) => [...m, { role: "assistant", text: "No problem — let me know if you'd like something else." }]);
    setExpanded(null);
  }

  function markMakeRoomResolved(messageIndex) {
    setDisplayMessages((m) =>
      m.map((msg, i) => (i === messageIndex ? { ...msg, makeRoomPrompt: { ...msg.makeRoomPrompt, resolved: true } } : msg))
    );
  }

  function handleConfirmMakeRoom(messageIndex, place, plan) {
    const current = latestRef.current;
    const result = current.tryInsertPlace(place, plan.candidates, plan.newStart, plan.newEnd);
    markMakeRoomResolved(messageIndex);
    setDisplayMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: result.ok
          ? `Added ${place.name} from ${formatTime12h(minutesToTime(plan.newStart))} to ${formatTime12h(minutesToTime(plan.newEnd))}! Anything else?`
          : "Something went wrong fitting that in — want to try again?",
      },
    ]);
  }

  function executeTool(name, args, onNeedsMakeRoom) {
    const current = latestRef.current;
    if (name === "add_place") {
      const place = current.catalogById[args.place_id];
      if (!place) return { error: "That place id doesn't exist in the catalog." };
      const result = current.tryAddPlace(place);
      if (result.ok) return { result: `Added ${place.name}.` };
      // Doesn't fit as-is -- kick off the "when + how long + what to
      // clear" flow instead of just failing outright, but only if the
      // place is actually possible during some segment of the day; if not,
      // the plain reason is the honest, complete answer.
      const { weekday } = currentDayContext();
      const segments = segmentsForPlace(place, weekday);
      if (segments.length > 0) {
        onNeedsMakeRoom({ place, segments });
        return {
          error: `${result.reason} The app is already asking the user when they'd like to visit and for how long, to figure out what to clear -- don't ask this yourself or guess a time/duration, just briefly acknowledge and wait for their choice.`,
        };
      }
      return { error: result.reason };
    }
    if (name === "remove_place") {
      const result = current.tryRemovePlace(args.item_id);
      return result.ok ? { result: `Removed ${result.title}.` } : { error: result.reason };
    }
    if (name === "reorder_before") {
      const result = current.tryReorderBefore(args.item_id, args.before_item_id);
      return result.ok ? { result: "Reordered." } : { error: result.reason };
    }
    return { error: `Unknown tool ${name}` };
  }

  async function runTurn(startContents) {
    setBusy(true);
    let pendingMakeRoom = null;
    try {
      let contentsSoFar = startContents;
      for (let step = 0; step < GUIDE_MAX_STEPS; step++) {
        // Read fresh from the ref on every iteration -- an earlier step in
        // this same turn (e.g. a remove_place) may have already changed the
        // itinerary, and the next step must see that change, not a snapshot
        // from when this turn started or from the last parent re-render.
        const { weekday, realItems: currentRealItems } = currentDayContext();
        const res = await chatWithGuide({
          city,
          day: { weekday, items: currentRealItems.map(toGuideItem) },
          contents: contentsSoFar,
        });
        contentsSoFar = res.contents;
        setContents(contentsSoFar);

        if (res.tool_call) {
          const toolResult = executeTool(res.tool_call.name, res.tool_call.args, (mr) => {
            pendingMakeRoom = mr;
          });
          contentsSoFar = [
            ...contentsSoFar,
            { role: "user", parts: [{ function_response: { name: res.tool_call.name, response: toolResult } }] },
          ];
          continue;
        }

        setDisplayMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: res.reply || "",
            suggestions: res.suggested_places || null,
            makeRoomPrompt: pendingMakeRoom,
          },
        ]);
        return;
      }
      setDisplayMessages((m) => [
        ...m,
        { role: "assistant", text: "That's a lot of steps for one request — could you break it into smaller asks?" },
      ]);
    } catch (err) {
      console.error("guide chat failed:", err);
      setDisplayMessages((m) => [...m, { role: "assistant", text: GUIDE_TROUBLE_REPLY }]);
    } finally {
      setBusy(false);
    }
  }

  // Finds the most recent assistant message that's still waiting on a
  // category/segment/duration answer -- NOT just the last message overall.
  // Each typed answer becomes its own new user message, so after the first
  // one the original question is no longer displayMessages[length-1]; this
  // walks backward past those typed replies to find what's actually still
  // pending, stopping at the first assistant message either way (only the
  // most recent interactive question should ever still be "listening").
  function findPendingPrompt() {
    for (let idx = displayMessages.length - 1; idx >= 0; idx--) {
      const msg = displayMessages[idx];
      if (msg.role !== "assistant") continue;

      const visibleSuggestions = (msg.suggestions || []).filter((s) => !usedPlaceIds.has(s.id));
      const kinds = [...new Set(visibleSuggestions.map((s) => s.kind))];
      if (kinds.length > 1 && !categoryChoice[idx]) return { idx, type: "category" };

      if (msg.makeRoomPrompt && !msg.makeRoomPrompt.resolved) {
        const { segments } = msg.makeRoomPrompt;
        const hasSegment = segmentChoice[idx] ?? (segments.length === 1 ? segments[0].key : null);
        if (!hasSegment) return { idx, type: "segment", segments };
        if (!durationChoice[idx]) return { idx, type: "duration" };
      }
      return null;
    }
    return null;
  }

  // If there's a pending question, try to resolve it directly from the
  // typed text before treating this as a fresh message to the AI -- same
  // outcome as clicking the matching bubble, just without requiring the click.
  function tryAnswerPendingPrompt(text) {
    const pending = findPendingPrompt();
    if (!pending) return false;

    if (pending.type === "category") {
      const kind = parseCategoryFromText(text);
      if (kind) {
        setCategoryChoice((c) => ({ ...c, [pending.idx]: kind }));
        return true;
      }
    } else if (pending.type === "segment") {
      const seg = parseSegmentFromText(text, pending.segments);
      if (seg) {
        setSegmentChoice((c) => ({ ...c, [pending.idx]: seg }));
        return true;
      }
    } else if (pending.type === "duration") {
      const mins = parseDurationFromText(text);
      if (mins) {
        setDurationChoice((c) => ({ ...c, [pending.idx]: mins }));
        return true;
      }
    }

    return false;
  }

  function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setDisplayMessages((m) => [...m, { role: "user", text }]);

    if (tryAnswerPendingPrompt(text)) return;

    const nextContents = [...contents, { role: "user", parts: [{ text }] }];
    setContents(nextContents);
    runTurn(nextContents);
  }

  return (
    <div className="guide-chat">
      <div className="guide-chat__header">
        <span>AI Guide</span>
        <button type="button" onClick={onClose} aria-label="Close guide">
          ×
        </button>
      </div>
      <div className="guide-chat__messages">
        {displayMessages.map((m, i) => {
          const visibleSuggestions = (m.suggestions || []).filter((s) => !usedPlaceIds.has(s.id));
          const kinds = [...new Set(visibleSuggestions.map((s) => s.kind))];
          const chosenKind = categoryChoice[i];
          // When a message's suggestions span both attractions and
          // restaurants, ask which category first instead of dumping every
          // chip at once -- resolved entirely client-side from data already
          // in hand, no extra AI call needed.
          const showCategoryPicker = kinds.length > 1 && !chosenKind;
          const placesToShow = showCategoryPicker
            ? []
            : visibleSuggestions.filter((s) => !chosenKind || s.kind === chosenKind);
          return (
            <div key={i}>
              <div className={`guide-chat__bubble guide-chat__bubble--${m.role}`}>{m.text}</div>
              {showCategoryPicker && (
                <div className="guide-suggestions">
                  {kinds.map((k) => {
                    const count = visibleSuggestions.filter((s) => s.kind === k).length;
                    return (
                      <button
                        key={k}
                        type="button"
                        className="guide-suggestion__chip"
                        onClick={() => setCategoryChoice((c) => ({ ...c, [i]: k }))}
                      >
                        {k === "place" ? "Attractions/activities" : "Restaurants/bars"} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              {placesToShow.length > 0 && (
                <div className="guide-suggestions">
                  {placesToShow.map((s) => (
                    <div key={s.id} className="guide-suggestion">
                      <button
                        type="button"
                        className="guide-suggestion__chip"
                        onClick={() => setExpanded((cur) => (cur?.id === s.id ? null : s))}
                      >
                        {s.name}
                        {s.closes_at && ` · until ${formatTime12h(s.closes_at)}`}
                      </button>
                      {expanded?.id === s.id && (
                        <div className="guide-suggestion__detail">
                          {catalogById[s.id]?.notes && <p>{catalogById[s.id].notes}</p>}
                          <p className="guide-suggestion__meta">
                            {s.category} · {s.duration_min} min · ₹{s.cost_pp} · ★ {s.rating}
                            {s.closes_at && ` · closes ${formatTime12h(s.closes_at)}`}
                          </p>
                          <p>Add this to your plan?</p>
                          <div className="guide-suggestion__actions">
                            <button type="button" onClick={() => handleAddSuggestion(s)}>
                              Yes, add it
                            </button>
                            <button type="button" onClick={handleDeclineSuggestion}>
                              No thanks
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {m.makeRoomPrompt &&
                !m.makeRoomPrompt.resolved &&
                (() => {
                  const { place, segments } = m.makeRoomPrompt;
                  const chosenSegmentKey = segmentChoice[i] ?? (segments.length === 1 ? segments[0].key : null);
                  const chosenSegment = DAY_SEGMENTS.find((s) => s.key === chosenSegmentKey);
                  const chosenDuration = durationChoice[i];
                  const weekday = itineraryRef.current.days[dayIndex].weekday;

                  if (!chosenSegment) {
                    return (
                      <div className="guide-chat__bubble guide-chat__bubble--assistant">
                        <p>
                          When would you like to visit <strong>{place.name}</strong>? (open {formatWindows(place.windows)})
                        </p>
                        <div className="guide-suggestions">
                          {segments.map((seg) => (
                            <button
                              key={seg.key}
                              type="button"
                              className="guide-suggestion__chip"
                              onClick={() => setSegmentChoice((c) => ({ ...c, [i]: seg.key }))}
                            >
                              {seg.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (!chosenDuration) {
                    return (
                      <div className="guide-chat__bubble guide-chat__bubble--assistant">
                        <p>How long would you like to spend there?</p>
                        <div className="guide-suggestions">
                          {DURATION_OPTIONS_MIN.map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              className="guide-suggestion__chip"
                              onClick={() => setDurationChoice((c) => ({ ...c, [i]: mins }))}
                            >
                              {mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)} hr`}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const plan = computeSegmentRemovalPlan(
                    itineraryRef.current.days[dayIndex].items,
                    weekday,
                    place,
                    chosenSegment.range,
                    chosenDuration
                  );

                  if (!plan) {
                    return (
                      <div className="guide-chat__bubble guide-chat__bubble--assistant">
                        <p>
                          Even clearing all of {chosenSegment.label.toLowerCase()}, there isn't enough time for a{" "}
                          {chosenDuration}-min visit. Try a different time or a shorter visit?
                        </p>
                        <div className="guide-suggestions">
                          <button
                            type="button"
                            className="guide-suggestion__chip"
                            onClick={() => {
                              setSegmentChoice((c) => ({ ...c, [i]: null }));
                              setDurationChoice((c) => ({ ...c, [i]: null }));
                            }}
                          >
                            Choose again
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="guide-chat__bubble guide-chat__bubble--assistant release-prompt">
                      <p>
                        Remove {plan.candidates.length === 1 ? "this stop" : `these ${plan.candidates.length} stops`}{" "}
                        to fit {place.name} ({chosenDuration} min) in the {chosenSegment.label.toLowerCase()}:
                      </p>
                      <div className="release-prompt__candidates">
                        {plan.candidates.map((c) => (
                          <span key={c.id} className="release-prompt__chip">
                            {c.title} ({formatTime12h(c.start)}–{formatTime12h(c.end)})
                          </span>
                        ))}
                      </div>
                      <div className="release-prompt__actions">
                        <button type="button" onClick={() => handleConfirmMakeRoom(i, place, plan)}>
                          Remove &amp; add {place.name}
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          );
        })}
        {busy && (
          <div className="guide-chat__bubble guide-chat__bubble--assistant guide-chat__bubble--typing">…</div>
        )}
      </div>
      <div className="guide-chat__input-row">
        <input
          type="text"
          placeholder="e.g. add the museum, remove the boat house…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={busy}
        />
        <button type="button" onClick={handleSend} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default function Itinerary() {
  const location = useLocation();
  const navigate = useNavigate();
  const [itinerary, setItinerary] = useState(location.state?.itinerary ?? null);
  // Mirrors `itinerary` synchronously (updated the instant updateDay runs,
  // not after React flushes a re-render). The AI guide can make several
  // add/remove/reorder calls back-to-back within one conversational turn;
  // reading from this ref instead of the `itinerary` state/`day` closure
  // means each call sees the true latest state even if the ones before it
  // haven't been reflected in a re-render yet.
  const itineraryRef = useRef(itinerary);
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const latestRef = useRef({});
  const memoryIdRef = useRef(null);

  const day = itinerary?.days?.[dayIndex] ?? null;
  const realItems = day ? day.items.filter((i) => !CONNECTOR_KINDS.has(i.kind)) : [];
  const placesById = Object.fromEntries(places.map((p) => [p.id, { ...p, kind: "place" }]));
  const foodById = Object.fromEntries(food.map((f) => [f.id, { ...f, kind: "meal" }]));
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const isToday = day?.date === todayIso;

  useEffect(() => {
    getPlaces(city).then(setPlaces).catch(() => {});
    getFood(city).then(setFood).catch(() => {});
  }, [city]);

  // Safety net for setItinerary calls outside updateDay (initial load,
  // replan, GPS auto-check-in) -- updateDay itself keeps the ref in sync
  // synchronously already, this just covers the other paths.
  useEffect(() => {
    itineraryRef.current = itinerary;
  }, [itinerary]);

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

            if ("Notification" in window && Notification.permission === "granted") {
              const notification = new Notification(`You reached ${item.title}`, {
                body: "Tap to continue your trip.",
                tag: item.id,
              });
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }
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

  // Scoped to today only, not the whole multi-day trip -- a place used on
  // Monday has no reason to block adding it on Sunday too. Skipped items are
  // excluded as well: removing a stop should free it back up, not keep it
  // permanently blocked from re-adding.
  const usedPlaceIds = new Set(
    day.items
      .filter((i) => (i.kind === "place" || i.kind === "meal") && i.status !== "skipped")
      .map((i) => i.ref_id)
  );

  function updateDay(updater) {
    // Computed synchronously from the ref, not from setItinerary's async
    // updater callback -- so itineraryRef.current is authoritative the
    // instant this returns, before React has necessarily re-rendered.
    const next = {
      ...itineraryRef.current,
      days: itineraryRef.current.days.map((d, i) => (i === dayIndex ? updater(d) : d)),
    };
    itineraryRef.current = next;
    setItinerary(next);
  }

  // Skipping (or un-skipping) a stop changes how much time is actually
  // spoken for that day, so everything after it needs to close the gap (or
  // make room again on undo) instead of keeping whatever times were
  // computed back when the stop was still active.
  function setItemStatus(itemId, status) {
    const currentDay = itineraryRef.current.days[dayIndex];
    const realItems = currentDay.items.filter((i) => !CONNECTOR_KINDS.has(i.kind));
    const anchor = timeToMinutes(realItems[0].start);
    const updated = realItems.map((i) => (i.id === itemId ? { ...i, status } : i));
    const result = recomputeWithFeasibility(updated, currentDay.weekday, placesById, foodById, anchor);
    const withConnectors = withRebuiltConnectors(result.items, placesById, foodById);
    updateDay((d) => ({ ...d, items: withConnectors }));
  }

  // Shared by the "+Add a place" button and the AI guide's add_place tool —
  // both need the same feasibility check and the same mutation.
  function tryAddPlace(place) {
    // Read from the ref, not the `day` closure -- the AI guide can chain
    // several add/remove/reorder calls within one turn, and each one must
    // see the true latest state even if React hasn't re-rendered yet.
    const currentDay = itineraryRef.current.days[dayIndex];
    // Skipped items stay in the array (faded, not removed) so they can be
    // undone -- anchoring on the literal last array element meant skipping
    // the last stop(s) of the day never actually freed up their time for a
    // new add, since a skipped item's end time was still used as the anchor.
    // Travel connectors also need excluding here: they never get marked
    // "skipped" themselves even when the real stop they lead to is, so one
    // sitting right before a skipped item would still carry that item's
    // stale, late end time and become the (wrong) last "active" element.
    const activeItems = currentDay.items.filter((i) => !CONNECTOR_KINDS.has(i.kind) && i.status !== "skipped");
    const lastItem = activeItems[activeItems.length - 1];
    const start = lastItem ? timeToMinutes(lastItem.end) : 9 * 60;
    // Always add it where it was asked, back-to-back after the day's last
    // stop — the schedule doesn't get to reject a choice the user made on
    // purpose. If it lands outside the place's real hours, flag it instead
    // of blocking, same as a dragged reorder does.
    const fits = earliestStart(place.windows, place.closed_days, currentDay.weekday, start, place.duration_min) !== null;
    const end = start + place.duration_min;
    const newItem = {
      id: `local_${Date.now()}`,
      start: minutesToTime(start),
      end: minutesToTime(end),
      kind: place.kind ?? "place",
      ref_id: place.id,
      title: place.name,
      area: place.area,
      cost_pp: place.cost_pp,
      notes: place.notes,
      booking_url: place.booking_url,
      map_url: `https://www.google.com/maps?q=${place.lat},${place.lng}`,
      locked: false,
      status: "planned",
      warning: fits ? null : `May be closed by then — real hours: ${formatWindows(place.windows)}`,
    };
    updateDay((d) => ({ ...d, items: [...d.items, newItem] }));
    return { ok: true, fits };
  }

  function handleAddPlace(place) {
    const result = tryAddPlace(place);
    setMessage(
      result.fits
        ? `Added ${place.name}!`
        : `Added ${place.name} — check its flagged time, it may be closed then.`
    );
    setPickerOpen(false);
  }

  // Shared by removing/skipping a stop from the UI and the AI guide's
  // remove_place tool.
  function tryRemovePlace(itemId) {
    const currentDay = itineraryRef.current.days[dayIndex];
    const item = currentDay.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: "That stop isn't in today's plan." };
    setItemStatus(itemId, "skipped");
    return { ok: true, title: item.title };
  }

  // Shared by drag-reorder and the AI guide's reorder_before tool.
  function tryReorderBefore(draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return { ok: false, reason: "Nothing to reorder." };

    const currentDay = itineraryRef.current.days[dayIndex];
    const realItems = currentDay.items.filter((i) => !CONNECTOR_KINDS.has(i.kind));
    const anchor = timeToMinutes(realItems[0].start);
    const reordered = moveById(realItems, draggedId, targetId);
    const result = recomputeWithFeasibility(reordered, currentDay.weekday, placesById, foodById, anchor);

    // Old travel connectors described the previous adjacency, not this one —
    // rebuild a fresh one between every pair of real stops so the
    // distance/mode picker still shows up after a reorder.
    const withConnectors = withRebuiltConnectors(result.items, placesById, foodById);
    updateDay((d) => ({ ...d, items: withConnectors }));
    return { ok: true, allFit: result.allFit };
  }

  // Used by the AI guide's segment/duration "make room" flow: replaces the
  // chosen candidates with the new place at the computed time, shifting
  // whatever follows earlier by the leftover gap.
  function tryInsertPlace(place, candidates, newStart, newEnd) {
    const currentDay = itineraryRef.current.days[dayIndex];
    const newItems = buildInsertedDayItems(currentDay.items, candidates, place, newStart, newEnd);
    updateDay((d) => ({ ...d, items: newItems }));
    return { ok: true };
  }

  // User-entered "I'll actually be here from X to Y" for a real stop,
  // shifting everything after it to match and flagging any later stop that
  // no longer fits its own real hours as a result.
  function handleSetItemTimeRange(itemId, newStart, newEnd) {
    const currentDay = itineraryRef.current.days[dayIndex];
    const idx = currentDay.items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const shifted = applyTimeRangeChange(currentDay.items, idx, newStart, newEnd);
    const flagged = flagInfeasibleItems(shifted, currentDay.weekday, placesById, foodById);
    updateDay((d) => ({ ...d, items: flagged }));
  }

  // User-picked transport mode for a travel connector -- recomputes its
  // real duration from the actual distance and that mode's speed, then
  // shifts everything after it to match (and re-checks feasibility, same
  // as a manual time-range edit does).
  function handleSelectConnectorMode(connectorId, modeKey) {
    const currentDay = itineraryRef.current.days[dayIndex];
    const idx = currentDay.items.findIndex((i) => i.id === connectorId);
    if (idx === -1) return;
    const distanceKm = connectorDistanceKm(currentDay.items, idx, placesById, foodById);
    if (distanceKm == null) return;
    const minutes = travelMinutesForMode(distanceKm, modeKey);
    const withMode = currentDay.items.map((it, i) => (i === idx ? { ...it, travelMode: modeKey } : it));
    const shifted = applyDurationChange(withMode, idx, minutes);
    const flagged = flagInfeasibleItems(shifted, currentDay.weekday, placesById, foodById);
    updateDay((d) => ({ ...d, items: flagged }));
  }

  function reorderItems(draggedId, targetId) {
    const result = tryReorderBefore(draggedId, targetId);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage(
      result.allFit
        ? "Reordered — we can go at that time."
        : "Reordered — check the flagged stop below, it may not fit that time."
    );
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

  async function handleAddPhoto(file, placeTitle) {
    if (!planId) {
      setMessage("Save this trip before adding photos to memories.");
      return;
    }
    setPhotoBusy(true);
    try {
      if (!memoryIdRef.current) {
        const memory = await createMemory(planId);
        memoryIdRef.current = memory.id;
      }
      await uploadPhoto(memoryIdRef.current, file);
      setMessage(`📷 Photo from ${placeTitle} added to your trip memory.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setPhotoBusy(false);
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
          {canEdit && (
            <button
              type="button"
              className="itin-header__guide-btn"
              onClick={() => setGuideOpen((o) => !o)}
            >
              AI Guide
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

      {canEdit && guideOpen && (
        <GuideChat
          city={city}
          itineraryRef={itineraryRef}
          dayIndex={dayIndex}
          catalogById={{ ...placesById, ...foodById }}
          usedPlaceIds={usedPlaceIds}
          tryAddPlace={tryAddPlace}
          tryRemovePlace={tryRemovePlace}
          tryReorderBefore={tryReorderBefore}
          tryInsertPlace={tryInsertPlace}
          onClose={() => setGuideOpen(false)}
        />
      )}

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
                if (e.target.checked && "Notification" in window && Notification.permission === "default") {
                  Notification.requestPermission();
                }
              }}
            />
            Auto check-in with my location
          </label>
          <span className="check-in-bar__note">
            {isToday
              ? "Keep this page open while you're out — stops get marked visited automatically, with a notification when you arrive."
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
            {day.items.map((item, idx) =>
              CONNECTOR_KINDS.has(item.kind) ? (
                <ConnectorRow
                  key={item.id}
                  item={item}
                  editable={canEdit}
                  distanceKm={connectorDistanceKm(day.items, idx, placesById, foodById)}
                  onSelectMode={canEdit ? handleSelectConnectorMode : null}
                  faded={day.items[idx + 1]?.status === "skipped"}
                />
              ) : (
                <ItemCard
                  key={item.id}
                  item={item}
                  editable={canEdit}
                  catalogEntry={catalogEntryFor(item, placesById, foodById)}
                  weekday={day.weekday}
                  onSkip={() => setItemStatus(item.id, "skipped")}
                  onUndo={() => setItemStatus(item.id, "planned")}
                  onAddPhoto={canEdit ? handleAddPhoto : null}
                  photoBusy={photoBusy}
                  onSetTimeRange={canEdit ? handleSetItemTimeRange : null}
                />
              )
            )}
          </SortableContext>
        </DndContext>

        {canEdit &&
          (pickerOpen ? (
            <AddPlacePanel
              places={places}
              food={food}
              usedIds={usedPlaceIds}
              weekday={day.weekday}
              anchorMinutes={(() => {
                const activeItems = day.items.filter((i) => !CONNECTOR_KINDS.has(i.kind) && i.status !== "skipped");
                return activeItems.length ? timeToMinutes(activeItems[activeItems.length - 1].end) : 9 * 60;
              })()}
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
