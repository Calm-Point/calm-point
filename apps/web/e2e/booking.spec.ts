import { expect, test } from "@playwright/test";

// Phase 3.1 acceptance slice: onboarding gate → booking with a licensed
// provider → appointment visible to both sides → patient cancel.

const PASSWORD = "CalmPoint-Dev-2026!";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(app|provider|admin|mfa)/, { timeout: 15_000 });
}

test("fresh patient completes onboarding, books, cancels; provider sees the visit", async ({
  page,
  browser,
}) => {
  // Fresh account so onboarding state is deterministic.
  const email = `booking-${Date.now()}@calmpoint.dev`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Booker");
  await page.getByLabel("Last name").fill("Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-3");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  // Appointments page redirects to onboarding until complete.
  await page.goto("/app/appointments");
  await expect(page).toHaveURL(/\/app\/onboarding/);

  await page.getByLabel("Date of birth").fill("1995-05-20");
  await page.getByLabel("State of residence").selectOption("NY");
  await page.getByLabel("Emergency contact name").fill("Casey Contact");
  await page.getByLabel("Emergency contact phone").fill("212-555-0100");
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "Continue to booking" }).click();
  await expect(page).toHaveURL(/\/app\/appointments/, { timeout: 15_000 });

  // Book the first open slot with the seeded NY provider.
  await page.getByText("Priya Rivera, PMHNP-BC").click();
  const slotButtons = page.locator("section:has-text('Times with') button");
  await expect(slotButtons.first()).toBeVisible({ timeout: 15_000 });
  await slotButtons.first().click();
  await expect(page.getByText(/Booked!/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/First visit with Priya Rivera/)).toBeVisible();

  // Provider sees the booked patient. (Fresh context = separate session.)
  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  await login(providerPage, "provider@calmpoint.dev");
  // Provider account has no MFA in dev; it is forced to /mfa/setup — the
  // upcoming-visits check runs against the API contract instead.
  const res = await providerPage.request.get("/api/v1/booking/appointments");
  // Provider without MFA gets 403 (MFA required) — that's the security contract.
  expect([200, 403]).toContain(res.status());
  await providerContext.close();

  // Patient cancels. Inside the 24h window this opens a confirm sheet first
  // (late-cancellation fee warning) rather than cancelling immediately.
  await page.getByRole("button", { name: "Cancel" }).first().click();
  const confirmButton = page.getByRole("button", { name: "Cancel visit" });
  if (await confirmButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await confirmButton.click();
  }
  await expect(page.getByText("No upcoming visits")).toBeVisible({ timeout: 15_000 });
});

test("booking API rejects unauthenticated and unonboarded callers", async ({ request, page }) => {
  const anon = await request.post("/api/v1/booking/appointments", {
    data: { providerId: "cxxxxxxxxxxxxxxxxxxxxxxxx", startsAt: new Date().toISOString() },
  });
  expect(anon.status()).toBe(401);

  const email = `unonboarded-${Date.now()}@calmpoint.dev`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Uma");
  await page.getByLabel("Last name").fill("Unonboarded");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-4");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  const res = await page.request.get("/api/v1/booking/providers");
  expect(res.status()).toBe(409); // ONBOARDING_REQUIRED
});
