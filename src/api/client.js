import { API_BASE_URL as BASE_URL } from "./config.js";

export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json();
}
