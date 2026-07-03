import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Phase 1 acceptance (docs/04 §1): seeded users sign in and land in
// role-correct portals; provider/admin are forced through MFA setup;
// role boundaries redirect rather than leak.

const PASSWORD = "CalmPoint-Dev-2026!";

// Other specs (admin/messaging/visit) enroll MFA on these fixtures — reset so
// the "forced into MFA setup" assertions hold on every run.
test.beforeAll(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL ??
          "postgresql://calmpoint:calmpoint@localhost:5432/calmpoint",
      },
    },
  });
  await prisma.user.updateMany({
    where: { email: { in: ["admin@calmpoint.dev", "provider@calmpoint.dev"] } },
    data: { mfaEnabled: false, mfaSecret: null },
  });
  await prisma.$disconnect();
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait for the post-login client navigation to settle before the test
  // navigates elsewhere — otherwise goto() races the session cookie.
  await page.waitForURL(/\/(app|provider|admin|mfa)/, { timeout: 15_000 });
}

test("patient signs in and lands on the patient dashboard", async ({ page }) => {
  await login(page, "patient@calmpoint.dev");
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();
});

test("patient cannot reach provider or admin portals", async ({ page }) => {
  await login(page, "patient@calmpoint.dev");
  await expect(page).toHaveURL(/\/app/);
  await page.goto("/provider");
  await expect(page).toHaveURL(/\/app/); // bounced home, not a 403 page
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app/);
});

test("provider without MFA is forced into MFA setup", async ({ page }) => {
  await login(page, "provider@calmpoint.dev");
  await page.goto("/provider");
  await expect(page).toHaveURL(/\/mfa\/setup/);
  await expect(
    page.getByRole("heading", { name: /two-factor authentication/i }),
  ).toBeVisible();
});

test("admin without MFA is forced into MFA setup", async ({ page }) => {
  await login(page, "admin@calmpoint.dev");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/mfa\/setup/);
});

test("unauthenticated visits to portals redirect to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp/);
});

test("bad credentials are rejected with a friendly error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("patient@calmpoint.dev");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/didn't match/)).toBeVisible();
});

test("signup creates an account and lands on the patient dashboard", async ({ page }) => {
  const email = `e2e-${Date.now()}@calmpoint.dev`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Enid");
  await page.getByLabel("Last name").fill("Endtoend");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-1");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });
});
