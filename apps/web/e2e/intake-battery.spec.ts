import { test, expect } from "@playwright/test";

/**
 * New-pipeline coverage (docs/10): the signed-in 37-item intake battery runner
 * and the identity/insurance/consent verification step, end to end against the
 * real server + database.
 */

const runId = Date.now().toString(36);
const EMAIL = `battery-${runId}@calmpoint.dev`;
const PASSWORD = "CalmPoint-E2E-2026!";

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("patient completes the full intake battery then verifies identity, coverage, and consent", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Sign up a fresh patient.
  await page.goto("/signup");
  await page.getByLabel(/first name/i).fill("Battery");
  await page.getByLabel(/last name/i).fill("Tester");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });

  // Run the battery: 37 items, always the first option (all-zero → no crisis).
  await page.goto("/app/intake");
  await expect(page.getByText(/1 of 37/)).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 45; i++) {
    const done = await page
      .getByText(/Thank you — this really helps/i)
      .isVisible()
      .catch(() => false);
    if (done) break;
    const option = page.locator('[role="group"] button').first();
    await option.waitFor({ state: "visible", timeout: 15_000 });
    await option.click();
    await page.waitForTimeout(120);
  }
  await expect(page.getByText(/Thank you — this really helps/i)).toBeVisible({ timeout: 20_000 });

  // Continue to verify & coverage.
  await page.getByRole("button", { name: /verify & coverage/i }).click();
  await page.waitForURL("**/app/verify");

  // ID photo upload.
  await page.getByLabel("ID photo").setInputFiles({
    name: "license.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  // Insurance + real-time eligibility (mock vendor: odd last digit → ACTIVE + copay).
  await page.getByLabel(/insurance carrier/i).fill("Aetna");
  await page.getByLabel(/member id/i).fill("W123456789");
  await page.getByRole("button", { name: /check coverage now/i }).click();
  await expect(page.getByText(/coverage active/i)).toBeVisible({ timeout: 15_000 });

  // Consents + submit.
  for (const label of [/telehealth informed consent/i, /privacy practices/i, /terms of service/i]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole("button", { name: /submit & schedule/i }).click();
  await expect(page.getByText(/ready to schedule/i)).toBeVisible({ timeout: 20_000 });
});

test("intake analysis endpoint stays feature-flag gated", async ({ page }) => {
  // Sign in as the patient created above (or any patient) and hit the endpoint:
  // with the intake_ai_analysis flag OFF (seed default), it must 403.
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
  const status = await page.evaluate(async () => {
    const res = await fetch("/api/v1/intake/analyze", { method: "POST" });
    return res.status;
  });
  expect(status).toBe(403);
});
