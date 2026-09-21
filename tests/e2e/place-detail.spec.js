import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test("the info button opens a details page with real catalog data, and survives a reload", async ({ page }) => {
  await generatePlan(page);

  const infoBtn = page.locator(".itin-card__info-btn").first();
  const href = await infoBtn.getAttribute("href");
  expect(href).toMatch(/^\/place\/pondicherry\/(place|meal)\/[a-z0-9_]+$/);

  await infoBtn.click();
  await page.waitForSelector(".place-detail__title-row h1");
  await expect(page.locator(".place-detail__fact-label").first()).toContainText("Hours");
  await expect(page.locator(".place-detail__source")).toContainText(/Verified|Unverified/);

  // Regression guard: unlike the itinerary page, this route carries no
  // navigation state at all -- it must work as a cold direct link too.
  await page.reload();
  await expect(page.locator(".place-detail__title-row h1")).toBeVisible();

  await page.click(".place-detail__back");
  await expect(page.locator(".itin-card").first()).toBeVisible();
});
