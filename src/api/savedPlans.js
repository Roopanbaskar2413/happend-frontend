import { API_BASE_URL as BASE_URL } from "./config.js";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `request failed: ${res.status}`);
  }
  return res.json();
}

export function savePlan({ city, arrivalDate, departureDate, itinerary, planRequest }) {
  return fetch(`${BASE_URL}/saved-plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      city,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      itinerary,
      plan_request: planRequest ?? {},
    }),
  }).then(handle);
}

export function getSavedPlans() {
  return fetch(`${BASE_URL}/saved-plans`, { credentials: "include" }).then(handle);
}

export function getSavedPlan(id) {
  return fetch(`${BASE_URL}/saved-plans/${id}`, { credentials: "include" }).then(handle);
}

export function updateSavedPlan(id, itinerary) {
  return fetch(`${BASE_URL}/saved-plans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itinerary }),
  }).then(handle);
}

export function deleteSavedPlan(id) {
  return fetch(`${BASE_URL}/saved-plans/${id}`, { method: "DELETE", credentials: "include" }).then(handle);
}

export function updatePlanStatus(id, status) {
  return fetch(`${BASE_URL}/saved-plans/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  }).then(handle);
}

export function sharePlan(id, email) {
  return fetch(`${BASE_URL}/saved-plans/${id}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  }).then(handle);
}

export function listShares(id) {
  return fetch(`${BASE_URL}/saved-plans/${id}/shares`, { credentials: "include" }).then(handle);
}

export function revokeShare(planId, shareId) {
  return fetch(`${BASE_URL}/saved-plans/${planId}/shares/${shareId}`, {
    method: "DELETE",
    credentials: "include",
  }).then(handle);
}

export function approveEdit(planId, shareId) {
  return fetch(`${BASE_URL}/saved-plans/${planId}/shares/${shareId}/approve-edit`, {
    method: "POST",
    credentials: "include",
  }).then(handle);
}

export function denyEdit(planId, shareId) {
  return fetch(`${BASE_URL}/saved-plans/${planId}/shares/${shareId}/deny-edit`, {
    method: "POST",
    credentials: "include",
  }).then(handle);
}

export function requestEdit(planId) {
  return fetch(`${BASE_URL}/saved-plans/${planId}/request-edit`, {
    method: "POST",
    credentials: "include",
  }).then(handle);
}

export function getSharedWithMe() {
  return fetch(`${BASE_URL}/shared-with-me`, { credentials: "include" }).then(handle);
}
