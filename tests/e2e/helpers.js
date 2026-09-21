// Shared setup used by most specs: run the planner form through to a fresh,
// unsaved itinerary (own-stay toggle keeps it deterministic -- no live stay
// picker results to depend on).
export async function generatePlan(page) {
  await page.goto("/plan");
  await page.waitForSelector("form.planner-form");
  await page.click("form.planner-form button[type=submit]");
  await page.waitForSelector(".stay-select__own-toggle input[type=checkbox]");
  await page.check(".stay-select__own-toggle input[type=checkbox]");
  await page.click("button:has-text('Continue')");
  await page.waitForSelector(".itin-card", { timeout: 15_000 });
}

export async function dragHandleOnto(page, fromCard, toCard) {
  const handle = await fromCard.$(".itin-card__drag-handle");
  const handleBox = await handle.boundingBox();
  const toBox = await toCard.boundingBox();
  await page.mouse.move(handleBox.x + 5, handleBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 5, handleBox.y + 20, { steps: 5 });
  await page.mouse.move(toBox.x + 10, toBox.y + toBox.height / 2, { steps: 10 });
  await page.mouse.move(toBox.x + 10, toBox.y + toBox.height - 5, { steps: 5 });
  await page.mouse.up();
}
