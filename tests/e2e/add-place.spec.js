import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test.describe("Add a place panel", () => {
  test("adds a place even when it may not be open at the computed time", async ({ page }) => {
    await generatePlan(page);
    await page.click(".add-place-trigger");
    await page.waitForSelector(".add-place-panel");

    const flaggedRow = page.locator(".add-place-row", { hasText: "May be closed at that time" }).first();
    await expect(flaggedRow).toBeVisible();
    // Regression guard: this row used to render faded/disabled-looking and
    // adding it popped a "remove these stops to make room" modal instead of
    // just adding it.
    await flaggedRow.locator("button", { hasText: "Add" }).click();
    await page.waitForTimeout(300);

    await expect(page.locator(".itin-toast")).toContainText("Added");
    await expect(page.locator(".release-prompt")).toHaveCount(0);
  });

  test("gives the newly added place a real travel connector, not a dangling stop", async ({ page }) => {
    await generatePlan(page);
    const lastCardBefore = page.locator(".itin-card").last();
    const titleBefore = await lastCardBefore.locator("h3").textContent();

    await page.click(".add-place-trigger");
    await page.waitForSelector(".add-place-panel");
    await page.fill(".add-place-panel__search", "rental bicycle");
    await page.waitForTimeout(150);
    await page.locator(".add-place-row").first().locator("button", { hasText: "Add" }).click();
    await page.waitForTimeout(300); // the panel closes itself once the add goes through

    // Regression guard: a place added this way used to just get appended
    // with no travel connector leading into it at all -- no distance, no
    // mode picker, same bug already fixed for drag-reorder and skip/undo.
    const cards = page.locator(".itin-card");
    const newCard = cards.last();
    await expect(newCard.locator("h3")).toContainText("Rental Bicycle");
    expect(await cards.nth(-2).locator("h3").textContent()).toBe(titleBefore);

    const connectorBeforeNewStop = page.locator(".itin-connector").last();
    await expect(connectorBeforeNewStop).toContainText(/\d+(\.\d+)?\s*km/);
    await expect(connectorBeforeNewStop.locator(".itin-connector__mode-chip")).toHaveCount(4);
  });

  test("searches by meaning, not literal spelling", async ({ page }) => {
    await generatePlan(page);
    await page.click(".add-place-trigger");
    await page.waitForSelector(".add-place-panel");

    // "food" should surface restaurants/cafes even though none of them are
    // literally named or categorized "food".
    await page.fill(".add-place-panel__search", "food");
    await page.waitForTimeout(150);
    const foodResultCount = await page.locator(".add-place-row").count();
    expect(foodResultCount).toBeGreaterThan(5);

    // A dish name only lives in a food item's notes -- there's no separate
    // menu field -- so this only works if notes are searched for meals.
    await page.fill(".add-place-panel__search", "pizza");
    await page.waitForTimeout(150);
    await expect(page.locator(".add-place-row").first()).toContainText(/pizza/i);

    // "rental bike" should find a place literally named "...Rental Bicycle"
    // via the bike/bicycle synonym expansion, not a literal substring match.
    await page.fill(".add-place-panel__search", "rental bike");
    await page.waitForTimeout(150);
    await expect(page.locator(".add-place-row")).toContainText(/Rental Bicycle/i);
  });

  test("lets an already-added place be found again for a second visit", async ({ page }) => {
    await generatePlan(page);
    await page.click(".add-place-trigger");
    await page.waitForSelector(".add-place-panel");
    await page.fill(".add-place-panel__search", "rental bicycle");
    await page.waitForTimeout(150);

    const row = page.locator(".add-place-row").first();
    await row.locator("button", { hasText: "Add" }).click();
    await page.waitForTimeout(300);

    // Reopen and search for the same thing again.
    await page.click(".add-place-trigger");
    await page.waitForSelector(".add-place-panel");
    await page.fill(".add-place-panel__search", "rental bicycle");
    await page.waitForTimeout(150);

    const rowAgain = page.locator(".add-place-row").first();
    await expect(rowAgain).toContainText("Already in today's plan");
    await rowAgain.locator("button", { hasText: "Add" }).click();
    await page.waitForTimeout(300);

    await expect(page.locator(".itin-card h3", { hasText: "Rental Bicycle" })).toHaveCount(2);
  });
});
