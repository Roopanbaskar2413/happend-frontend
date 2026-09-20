import { API_BASE_URL as BASE_URL } from "./config.js";

export async function chatWithGuide({ city, day, contents }) {
  const res = await fetch(`${BASE_URL}/guide/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ city, day, contents }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `POST /guide/chat failed: ${res.status}`);
  }
  return res.json();
}
