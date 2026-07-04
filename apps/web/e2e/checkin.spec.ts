import { expect, test } from "@playwright/test";

// Phase 3.5 slice: recurring check-in — a patient completes a GAD-7 check-in
// from My Care and sees it reflected as "up to date" with a score trend.

test("patient completes a GAD-7 check-in and sees a score trend", async ({ page }) => {
  test.setTimeout(60_000);
  const email = `checkin-${Date.now()}@calmpoint.dev`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Cara");
  await page.getByLabel("Last name").fill("Checkin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-8");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  await page.goto("/app/care");
  // GAD-7 starts due for a fresh patient.
  const gad7 = page.locator("div", { has: page.getByText("GAD-7", { exact: true }) }).last();
  await gad7.getByRole("button", { name: "Check in now" }).click();
  await expect(page.getByRole("heading", { name: /GAD-7 check-in/ })).toBeVisible({ timeout: 15_000 });

  // Answer all 7 with "Not at all".
  for (let i = 0; i < 7; i++) {
    await page
      .locator("div")
      .filter({ hasText: new RegExp(`^${i + 1}\\.`) })
      .getByRole("button", { name: "Not at all" })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Submit check-in" }).click();
  await expect(page.getByText(/Thanks for checking in/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("up to date")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Latest:/)).toBeVisible();
});
