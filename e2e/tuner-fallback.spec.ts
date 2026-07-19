import { expect, test } from "@playwright/test";

// This project launches Chromium WITHOUT fake-media flags: getUserMedia is
// denied in headless, which is exactly the beginner-with-blocked-mic case.
test("denied mic lands in a usable reference-tone fallback", async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-tuner-start]").click();

  await expect(page.locator("[data-tuner-fallback]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("[data-tuner-fallback-reason]")).toContainText(
    "denied",
  );
  // All six reference tones present and clickable — no dead end.
  await expect(page.locator("[data-tuner-tone]")).toHaveCount(6);
  await page.locator("[data-tuner-tone]").first().click();
});

test("in-app webview gets the open-in-browser hint before any mic attempt", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0",
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.locator("[data-tuner-start]").click();

  await expect(page.locator("[data-tuner-fallback]")).toBeVisible();
  await expect(page.locator("[data-tuner-fallback-reason]")).toContainText(
    "Open this page in your regular browser",
  );
  await context.close();
});

test("unknown paths return 404", async ({ page }) => {
  const response = await page.goto("/no-such-tuning");
  expect(response?.status()).toBe(404);
});
