import { API_BASE_URL as BASE_URL } from "./config.js";

export async function getStays(city = "pondicherry") {
  const res = await fetch(`${BASE_URL}/stays?city=${encodeURIComponent(city)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`GET /stays failed: ${res.status}`);
  }
  return res.json();
}

// Fire-and-forget referral tracking for a "Select" click in the planner flow --
// deliberately silent on failure (rate-limited, or the browser is offline);
// this must never block or interrupt the person actually planning their trip.
export function logStaySelection(city, stayId) {
  fetch(`${BASE_URL}/stays/selections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ city, stay_id: stayId }),
  }).catch(() => {});
}
