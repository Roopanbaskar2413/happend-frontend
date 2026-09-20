import { API_BASE_URL as BASE_URL } from "./config.js";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `request failed: ${res.status}`);
  }
  return res.json();
}

export function signup(email, password) {
  return fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function login(email, password) {
  return fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function logout() {
  return fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).then(handle);
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  return handle(res);
}
