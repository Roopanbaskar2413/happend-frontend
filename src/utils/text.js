// Backend option lists (interests, transport modes, budget levels, group
// types, etc.) are lowercase snake_case slugs meant for the API, not
// display -- "local_life", "bus", "mid". This turns any such slug into a
// readable label ("Local life", "Bus", "Mid") without needing a hardcoded
// map per option list, since the set of possible slugs comes from the
// backend and can grow.
export function humanizeSlug(slug) {
  if (!slug) return slug;
  const words = String(slug).replace(/_/g, " ").trim().split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
