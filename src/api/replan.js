import { API_BASE_URL as BASE_URL } from "./config.js";

// `planRequest` as stored/passed around the frontend never carries `city`
// (it's tracked as a sibling field everywhere else) but the backend's
// PlanRequest schema requires it, so it's merged in here.
export async function replan({ city, itinerary, planRequest, disruption }) {
  const res = await fetch(`${BASE_URL}/replan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      city,
      itinerary,
      plan_request: { ...planRequest, city },
      disruption,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `POST /replan failed: ${res.status}`);
  }
  return res.json();
}
