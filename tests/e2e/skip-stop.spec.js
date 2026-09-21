import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test("skipping a stop retimes the rest of the day and fades its connector", async ({ page }) => {
  await generatePlan(page);

  const cards = page.locator(".itin-card");
  const thirdStopTimeBefore = await cards.nth(2).locator(".itin-card__time-btn").textContent();

  await cards.nth(1).locator(".itin-card__remove").click();
  await page.waitForTimeout(300);

  // Regression guard: skipping used to only flip the item's status, leaving
  // every later stop stuck at the stale time computed back when the
  // skipped stop still occupied a slot.
  const thirdStopTimeAfter = await cards.nth(2).locator(".itin-card__time-btn").textContent();
  expect(thirdStopTimeAfter).not.toBe(thirdStopTimeBefore);

  // The connector leading into the now-skipped stop fades and drops its
  // mode picker, since that travel is no longer needed.
  const fadedConnector = page.locator(".itin-connector--faded");
  await expect(fadedConnector).toBeVisible();
  await expect(fadedConnector).toContainText("not needed, that stop is skipped");

  // Undo brings it back into the active flow.
  await cards.nth(1).locator(".itin-card__undo").click();
  await page.waitForTimeout(300);
  await expect(page.locator(".itin-card__undo")).toHaveCount(0);
});
