# happend-frontend

Frontend for Happend, a trip planner for day-by-day itineraries — builds and displays the itinerary, handles live disruptions ("running late," weather, a closed spot, etc.), and includes a conversational AI Guide for the trip. Talks to [happend-backend](https://github.com/Roopanbaskar2413/happend-backend), which has the actual planning logic and the Guide's API.

## Stack

React + Vite, React Router, `@dnd-kit` for drag-to-reorder itinerary items, Playwright for end-to-end tests.

## Running locally

```
npm install
npm run dev          # dev server
npm run build         # production build
npm run test:e2e      # Playwright end-to-end tests
```

### Environment variables

| Variable | Used for |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API. |

See the backend repo's README for what it needs to actually run (database, AI Guide provider keys, etc.).
