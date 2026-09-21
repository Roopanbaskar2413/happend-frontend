import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test("a reload restores edits instead of reverting to the pre-edit snapshot", async ({ page }) => {
  await generatePlan(page);

  // Regression guard: React Router hands back the ORIGINAL navigation
  // state on reload, not anything edited into component state since --
  // without a session cache keyed to location.key, a reload silently
  // reverted every edit back to the moment the plan was first generated.
  await page.locator(".itin-card").nth(1).locator(".itin-card__remove").click();
  await page.waitForTimeout(300);

  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator(".itin-card__undo")).toHaveCount(1);
});

test("a genuinely new plan does not inherit a leftover cached edit", async ({ page }) => {
  await generatePlan(page);
  await page.locator(".itin-card").first().locator(".itin-card__remove").click();
  await page.waitForTimeout(300);
  await expect(page.locator(".itin-card__undo")).toHaveCount(1);

  // Starting a brand new plan is a genuine new navigation (different
  // location.key), so it must win over any stale cached draft.
  await generatePlan(page);
  await expect(page.locator(".itin-card__undo")).toHaveCount(0);
});
