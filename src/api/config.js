// Relative by default: Vite's dev server proxies /api to the backend (see
// vite.config.js), so this works unchanged whether the app is opened at
// localhost or through a tunnel someone else opens on their own machine —
// no cross-origin request, no CORS, no "which host is the backend on" issue.
// Override with VITE_API_BASE_URL only if the backend is served separately
// (e.g. a real deployment with the API on its own domain).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
