// Mirrors backend/app/memory_summary.py exactly — used to preview a memory's
// stats before it actually exists as a row (see MemoryDetail's draft mode),
// so nothing is persisted just to show what the summary would look like.
export function computeSummary(itinerary) {
  const days = itinerary?.days ?? [];
  let done = 0;
  let skipped = 0;
  let totalSpend = 0;
  const placesVisited = [];

  for (const day of days) {
    for (const item of day.items ?? []) {
      if (item.kind !== "place" && item.kind !== "meal") continue;
      const status = item.status ?? "planned";
      if (status === "skipped") {
        skipped += 1;
        continue;
      }
      done += 1;
      totalSpend += item.cost_pp ?? 0;
      if (item.kind === "place" && item.title) {
        placesVisited.push(item.title);
      }
    }
  }

  return {
    days: days.length,
    done_count: done,
    skipped_count: skipped,
    total_spend: totalSpend,
    places_visited: placesVisited,
  };
}
