import { expect, test, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import { PrismaClient } from "@prisma/client";

// Phase 3.7 slice: admin enrolls MFA, searches users, suspends/reactivates,
// reads the audit log, and hits the sign-off gate on the ai-therapist flag.

const PASSWORD = "CalmPoint-Dev-2026!";
test.describe.configure({ mode: "serial" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL ??
        "postgresql://calmpoint:calmpoint@localhost:5432/calmpoint",
    },
  },
});

test.beforeAll(async () => {
  await prisma.user.update({
    where: { email: "admin@calmpoint.dev" },
    data: { mfaEnabled: false, mfaSecret: null },
  });
  // Ensure the gated flag starts OFF regardless of prior runs.
  await prisma.featureFlag.update({
    where: { key: "ai-therapist" },
    data: { enabled: false },
  });
});
test.afterAll(async () => {
  await prisma.$disconnect();
});

async function loginWithMfaEnrollment(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/mfa\/setup/, { timeout: 15_000 });
  const secret = (await page.locator("code").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Enable two-factor" }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Authenticator code").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL(/\/admin/, { timeout: 15_000 });
}

test("admin manages users, reads audit log, and gated flag requires sign-off", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginWithMfaEnrollment(page, "admin@calmpoint.dev");

  // ── Users: search + suspend + reactivate the seeded patient ────────────
  await page.goto("/admin/users");
  await page.getByLabel("Search users").fill("patient@calmpoint.dev");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Paige Patient")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Suspend" }).click();
  await expect(page.getByText("suspended")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("button", { name: "Suspend" })).toBeVisible({ timeout: 15_000 });

  // ── Audit log shows the actions we just took ───────────────────────────
  await page.goto("/admin/audit");
  await page.getByLabel("Filter by action").fill("admin.user");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("admin.user.suspend").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("admin.user.reactivate").first()).toBeVisible();

  // ── Flags: ai-therapist is gated — enable without sign-off is refused ──
  await page.goto("/admin/flags");
  const therapistCard = page.locator('[data-flag="ai-therapist"]');
  await expect(page.getByText("sign-off gated")).toBeVisible({ timeout: 15_000 });
  await therapistCard.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByText(/requires clinical \+ legal sign-off/)).toBeVisible({
    timeout: 15_000,
  });
  // Leave the flag OFF — enabling for real requires human sign-off (CLAUDE.md).
});
