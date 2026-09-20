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
