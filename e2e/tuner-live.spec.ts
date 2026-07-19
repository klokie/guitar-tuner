import { expect, test } from "@playwright/test";

// Fake mic feeds a synthesized in-tune low E (e2-in-tune.wav). One test, one
// mic session: Chromium's fake audio capture doesn't reliably serve a second
// getUserMedia in the same browser, so the whole flow is exercised in order.
test("beginner happy path: start → mic → detect E2 → stabilize → checkmark → manual select", async ({
  page,
}) => {
  const events: string[] = [];
  await page.exposeFunction("__phCapture", (name: string) => {
    events.push(name);
  });
  await page.addInitScript(() => {
    (window as never as { posthog: unknown }).posthog = {
      capture: (name: string) =>
        (window as never as { __phCapture: (n: string) => void }).__phCapture(name),
    };
  });

  await page.goto("/");
  await expect(page.locator("[data-tuner-start]")).toBeVisible();
  // Privacy promise sits on the start panel (design doc: verbatim UX copy).
  await expect(page.locator("[data-tuner-start-panel]")).toContainText(
    "never uploaded",
  );

  await page.locator("[data-tuner-start]").click();
  await expect(page.locator("[data-tuner-live]")).toBeVisible();

  // Engine should read the fake mic's low E and label it.
  await expect(page.locator("[data-tuner-note]")).toHaveText("E2", {
    timeout: 10_000,
  });

  // The low-E peg (bottom-left on a 3+3 headstock) lights up.
  await expect(page.locator('[data-peg][data-string="E2"]')).toHaveClass(/peg--active/);

  // In-tune signal held 1.5s ⇒ string goes done and gets its checkmark.
  await expect(page.locator('[data-tuner-string="0"]')).toHaveClass(/string--done/, {
    timeout: 15_000,
  });

  // Funnel integrity: mic_granted → signal_detected → string_stabilized, in order.
  await expect
    .poll(() => events.filter((e) => e === "string_stabilized").length, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  const order = ["mic_granted", "signal_detected", "string_stabilized"].map((n) =>
    events.indexOf(n),
  );
  expect(order[0]).toBeGreaterThanOrEqual(0);
  expect(order[1]).toBeGreaterThan(order[0]!);
  expect(order[2]).toBeGreaterThan(order[1]!);
  // Single string ≠ full tuning: completion must NOT fire.
  expect(events).not.toContain("tuning_completed");

  // Manual selection, same mic session: tap A2 while the mic still hears E2 —
  // guidance must read far flat ("Too low"), never claim in-tune.
  await page.locator('[data-tuner-string="1"]').click();
  await expect(page.locator("[data-tuner-note]")).toHaveText("A2", {
    timeout: 10_000,
  });
  await expect(page.locator("[data-tuner-status]")).toContainText("Too low", {
    timeout: 10_000,
  });
});
