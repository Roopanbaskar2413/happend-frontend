import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test("generates a plan with real opening hours and km-based distances", async ({ page }) => {
  await generatePlan(page);

  const cards = page.locator(".itin-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(3);

  // Every real stop shows its actual catalog opening hours, not just the
  // scheduled slot -- regression guard for the "why did you remove the
  // opening and closing time of the place" report.
  await expect(page.locator(".itin-card__hours").first()).toContainText("Open");

  // Connector distances are always shown in km, never meters, regardless
  // of how short the hop is. (The very first connector of a day measures
  // from the base stay location, which has no catalog entry to show a
  // distance for at all, so this looks for one that actually has one.)
  const connectorWithDistance = page.locator(".itin-connector__label", { hasText: "km" }).first();
  await expect(connectorWithDistance).toBeVisible();
  const connectorText = await connectorWithDistance.textContent();
  expect(connectorText).toMatch(/\d+(\.\d+)?\s*km/);
  expect(connectorText).not.toMatch(/\d+\s*m\b/);
});
