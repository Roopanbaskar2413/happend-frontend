import { API_BASE_URL as BASE_URL } from "./config.js";

export async function getTravelInfo(city = "pondicherry") {
  const res = await fetch(`${BASE_URL}/travel-info?city=${encodeURIComponent(city)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`GET /travel-info failed: ${res.status}`);
  }
  return res.json();
}
