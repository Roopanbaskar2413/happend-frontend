// Data stays in 24h "HH:MM" throughout (sorting, arithmetic, the API
// contract) -- only the on-screen label switches to a normal 12-hour clock.
export function formatTime12h(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// "10:00-18:00" -> "10:00 AM–6:00 PM"; multiple windows (e.g. a lunch/dinner
// split) join with a comma so the user can see exactly when a place is
// actually open, not just guess from a single "Closed at this time" tag.
export function formatWindows(windows) {
  return (windows || [])
    .map((w) => {
      const [start, end] = w.split("-");
      return `${formatTime12h(start)}–${formatTime12h(end)}`;
    })
    .join(", ");
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
