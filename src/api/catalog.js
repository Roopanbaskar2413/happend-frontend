import { apiGet } from "./client.js";

export function getCities() {
  return apiGet("/cities");
}
