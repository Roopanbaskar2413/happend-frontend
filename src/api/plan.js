import { API_BASE_URL as BASE_URL } from "./config.js";

export async function createPlan(planRequest) {
  const res = await fetch(`${BASE_URL}/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(planRequest),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `POST /plan failed: ${res.status}`);
  }
  return res.json();
}

export async function getOptions() {
  const res = await fetch(`${BASE_URL}/options`, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`GET /options failed: ${res.status}`);
  }
  return res.json();
}
