import { test, expect } from "@playwright/test";
import { generatePlan, dragHandleOnto } from "./helpers.js";

test("drag-and-drop reorder always completes and rebuilds connectors", async ({ page }) => {
  await generatePlan(page);

  const cards = page.locator(".itin-card");
  await dragHandleOnto(page, await cards.nth(0).elementHandle(), await cards.nth(1).elementHandle());
  await page.waitForTimeout(400);

  // Regression guard: a reorder used to hard-reject the whole move if the
  // recomputed time didn't fit a place's real hours, and separately used to
  // drop every travel connector since the old ones described the wrong
  // adjacency.
  await expect(page.locator(".itin-toast")).toContainText("Reordered");
  await expect(page.locator(".itin-connector").first()).toBeVisible();
  await expect(page.locator(".itin-connector__mode-chip").first()).toBeVisible();
});
