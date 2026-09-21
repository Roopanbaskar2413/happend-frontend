import { test, expect } from "@playwright/test";
import { generatePlan } from "./helpers.js";

test("a stop's note supports sentences, bullets, and checkboxes", async ({ page }) => {
  await generatePlan(page);

  const noteBtn = page.locator(".itin-card__note-btn").first();
  await expect(noteBtn).toHaveText("Add Notes");
  await noteBtn.click();
  await page.waitForSelector(".note-editor");

  await page.fill(".note-editor__textarea", "Try the ghee roast");
  await page.click(".note-editor__toolbar button:has-text('Bullet')");
  // Regression guard: clicking a toolbar button used to reset the caret to
  // the very start of the textarea, so typing right after landed at
  // position 0 instead of continuing from the inserted prefix.
  await page.waitForTimeout(100);
  await page.type(".note-editor__textarea", "get filter coffee");
  await page.click(".note-editor__toolbar button:has-text('Checkbox')");
  await page.waitForTimeout(100);
  await page.type(".note-editor__textarea", "ask for window seat");

  const draft = await page.inputValue(".note-editor__textarea");
  expect(draft).toBe("Try the ghee roast\n- get filter coffee\n[ ] ask for window seat");

  await page.click(".note-editor__save");
  await page.waitForTimeout(200);

  const lines = await page.locator(".itin-card__note-line").allTextContents();
  expect(lines.map((l) => l.trim())).toEqual(["Try the ghee roast", "get filter coffee", "ask for window seat"]);

  // Checking the box toggles and persists without reopening the editor.
  const checkbox = page.locator(".itin-card__note-line--checkbox input").first();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(noteBtn).toHaveText("Edit note");
});
