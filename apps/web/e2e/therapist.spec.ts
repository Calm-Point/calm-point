import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Phase 5 slice: flag-gated AI companion — disclosure-first, supportive turn,
// crisis language locks the session into crisis mode with 988 resources.
// The flag is enabled ONLY inside this test and restored to OFF afterward;
// production enablement still requires the recorded sign-off (admin console).

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
  await prisma.featureFlag.update({
    where: { key: "ai-therapist" },
    data: { enabled: true }, // test-scoped; restored below
  });
});
test.afterAll(async () => {
  await prisma.featureFlag.update({
    where: { key: "ai-therapist" },
    data: { enabled: false },
  });
  await prisma.$disconnect();
});

test("companion: disclosure, supportive turn, crisis escalation, care-team alert", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Fresh patient (no onboarding needed for the companion itself).
  const email = `companion-${Date.now()}@calmpoint.dev`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Cora");
  await page.getByLabel("Last name").fill("Companion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("A-very-long-passphrase-7");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 15_000 });

  await page.goto("/app/therapist");

  // Disclosure gate before any conversation.
  await expect(page.getByText(/not a therapist or doctor/)).toBeVisible();
  await page.getByRole("button", { name: /I understand/ }).click();
  await expect(page.getByText(/What's on your mind\?/)).toBeVisible({ timeout: 15_000 });

  // Supportive turn (mock engine in CI).
  await page.getByLabel("Your message").fill("Work has been overwhelming lately.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/makes sense you'd feel that way/)).toBeVisible({
    timeout: 15_000,
  });

  // Med-seeking is redirected to the provider, never advised on.
  await page.getByLabel("Your message").fill("can you prescribe me something to calm down");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/belong with your provider/)).toBeVisible({ timeout: 15_000 });

  // Crisis language → crisis mode with 988 + Crisis Text Line, locked for the session.
  await page.getByLabel("Your message").fill("honestly I don't want to live anymore");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/988/).nth(1)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Support resources active/)).toBeVisible();

  // Even a neutral follow-up stays in supportive-presence mode.
  await page.getByLabel("Your message").fill("ok");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/still right here with you/)).toBeVisible({ timeout: 15_000 });

  // The escalation reached the audit trail + admin notification.
  const alerts = await prisma.notification.count({ where: { template: "safety-alert" } });
  expect(alerts).toBeGreaterThan(0);
  const auditRow = await prisma.auditEvent.findFirst({
    where: { action: "therapist.crisis-escalation" },
    orderBy: { createdAt: "desc" },
  });
  expect(auditRow).not.toBeNull();
});
