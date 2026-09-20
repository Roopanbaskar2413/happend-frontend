import { API_BASE_URL as BASE_URL } from "./config.js";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `request failed: ${res.status}`);
  }
  return res.json();
}

export function createMemory(savedPlanId) {
  return fetch(`${BASE_URL}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ saved_plan_id: savedPlanId }),
  }).then(handle);
}

export function getMemories() {
  return fetch(`${BASE_URL}/memories`, { credentials: "include" }).then(handle);
}

export function getMemory(id) {
  return fetch(`${BASE_URL}/memories/${id}`, { credentials: "include" }).then(handle);
}

export function deleteMemory(id) {
  return fetch(`${BASE_URL}/memories/${id}`, { method: "DELETE", credentials: "include" }).then(handle);
}

export function addStory(memoryId, text) {
  return fetch(`${BASE_URL}/memories/${memoryId}/stories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  }).then(handle);
}

export function updateStory(memoryId, storyId, text) {
  return fetch(`${BASE_URL}/memories/${memoryId}/stories/${storyId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  }).then(handle);
}

export function deleteStory(memoryId, storyId) {
  return fetch(`${BASE_URL}/memories/${memoryId}/stories/${storyId}`, {
    method: "DELETE",
    credentials: "include",
  }).then(handle);
}

export function uploadPhoto(memoryId, file) {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${BASE_URL}/memories/${memoryId}/photos`, {
    method: "POST",
    credentials: "include",
    body: form,
  }).then(handle);
}

export function photoUrl(memoryId, photoId) {
  return `${BASE_URL}/memories/${memoryId}/photos/${photoId}`;
}

export function deletePhoto(memoryId, photoId) {
  return fetch(`${BASE_URL}/memories/${memoryId}/photos/${photoId}`, {
    method: "DELETE",
    credentials: "include",
  }).then(handle);
}
