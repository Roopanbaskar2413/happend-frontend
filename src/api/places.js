import { API_BASE_URL as BASE_URL } from "./config.js";

export async function getPlaces(city = "pondicherry") {
  const res = await fetch(`${BASE_URL}/places?city=${encodeURIComponent(city)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`GET /places failed: ${res.status}`);
  }
  return res.json();
}

export async function getFood(city = "pondicherry") {
  const res = await fetch(`${BASE_URL}/food?city=${encodeURIComponent(city)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`GET /food failed: ${res.status}`);
  }
  return res.json();
}
