import { expect, test } from "@playwright/test";

// Phase 2 acceptance: ad-click funnel — landing → screener → signup with
// answers linked; safety branch diverts to crisis resources (docs/04 §2).

test("anxiety funnel: landing → GAD-7 screener → results → signup links intake", async ({ page }) => {
  await page.goto("/anxiety?utm_source=e2e&utm_campaign=funnel-test");
  await page.getByRole("link", { name: /Start your free 2-minute check-in/ }).click();
  await expect(page).toHaveURL(/\/screener\/anxiety/);

  // Answer all 7 GAD-7 questions with the second option ("Several days" = 1).
  for (let i = 0; i < 7; i++) {
    await expect(page.getByText(`${i + 1} of 7`)).toBeVisible();
    await page.getByRole("radio", { name: /Several days/ }).click();
  }

  await expect(page.getByRole("heading", { name: /Thanks for sharing/ })).toBeVisible();
  await page.getByRole("button", { name: /Create your account/ }).click();
  await expect(page).toHaveURL(/\/signup/);

  const email = `funnel-${Date.now()}@calmpoint.dev`;
  await page.getByLabel("First name").fill("Fern");
  await page.getByLabel("Last name").fill("Funnel");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-2");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
});

test("depression screener diverts to crisis resources on safety item", async ({ page }) => {
  await page.goto("/screener/depression");

  // PHQ-9: answer items 1–8 benignly, then item 9 (safety) positively.
  for (let i = 0; i < 8; i++) {
    await expect(page.getByText(`${i + 1} of 9`)).toBeVisible();
    await page.getByRole("radio", { name: /Not at all/ }).click();
  }
  await expect(page.getByText("9 of 9")).toBeVisible();
  await page.getByRole("radio", { name: /Several days/ }).click();

  await expect(page).toHaveURL(/\/crisis/, { timeout: 10_000 });
  await expect(page.getByRole("link", { name: /Call 988/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Text HOME to 741741/ })).toBeVisible();
});

test("condition landing pages render with compliant CTAs", async ({ page }) => {
  for (const slug of ["adhd", "anxiety", "depression", "weight-loss", "sleep"]) {
    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/988/).first()).toBeVisible();
  }
});

test("legal draft pages render with review banner", async ({ page }) => {
  for (const doc of ["privacy", "terms", "telehealth-consent", "hipaa-npp"]) {
    await page.goto(`/legal/${doc}`);
    await expect(page.getByText(/DRAFT — pending legal review/)).toBeVisible();
  }
});
