import { expect, test } from "@playwright/test";

// Fake mic feeds low E at −30 cents (e2-flat.wav).
test("a flat string reads 'too low' and never stabilizes", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-tuner-start]").click();

  await expect(page.locator("[data-tuner-note]")).toHaveText("E2", {
    timeout: 10_000,
  });
  await expect(page.locator("[data-tuner-status]")).toContainText(
    "Too low — tighten",
  );

  // Hold well past HOLD_MS: −30¢ must never earn a checkmark.
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-tuner-string="0"]')).not.toHaveClass(
    /string--done/,
  );
});
