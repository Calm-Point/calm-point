import { expect, test, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import { PrismaClient } from "@prisma/client";

// Phase 3.4 slice: patient books (creating the CareRelationship), messages
// their provider; provider completes REAL MFA enrollment (TOTP generated in
// the test), reads the message, and replies. Serial: shares provider state.

const PASSWORD = "CalmPoint-Dev-2026!";
const MFA_PROVIDER_EMAIL = "provider2@calmpoint.dev";
test.describe.configure({ mode: "serial" });

// This spec enrolls MFA on its dedicated provider; reset that state up front
// so the flow is deterministic across runs.
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
  await prisma.user.update({
    where: { email: MFA_PROVIDER_EMAIL },
    data: { mfaEnabled: false, mfaSecret: null },
  });
  await prisma.$disconnect();
});

async function login(page: Page, email: string, totpSecret?: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (totpSecret) {
    await page.getByLabel("Authenticator code").fill(generateSync({ secret: totpSecret }));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await page.waitForURL(/\/(app|provider|admin|mfa)/, { timeout: 15_000 });
}

test("patient books then messages provider; provider enrolls MFA and replies", async ({
  browser,
}) => {
  test.setTimeout(120_000);

  // ── Patient: signup → onboard → book → message ─────────────────────────
  const patientContext = await browser.newContext();
  const patient = await patientContext.newPage();
  const runId = Date.now();
  const email = `msg-${runId}@calmpoint.dev`;
  const patientMsg = `Hi — quick question before my first visit. (#${runId})`;
  const providerMsg = `Of course — ask away. See you soon! (#${runId})`;

  await patient.goto("/signup");
  await patient.getByLabel("First name").fill("Mia");
  await patient.getByLabel("Last name").fill("Messenger");
  await patient.getByLabel("Email").fill(email);
  await patient.getByLabel("Password").fill("A-very-long-passphrase-5");
  await patient.getByRole("checkbox").check();
  await patient.getByRole("button", { name: "Create account" }).click();
  await expect(patient).toHaveURL(/\/app/, { timeout: 15_000 });

  await patient.goto("/app/onboarding");
  await patient.getByLabel("Date of birth").fill("1993-03-15");
  await patient.getByLabel("State of residence").selectOption("NY");
  await patient.getByLabel("Emergency contact name").fill("Emery Contact");
  await patient.getByLabel("Emergency contact phone").fill("212-555-0111");
  for (const checkbox of await patient.getByRole("checkbox").all()) await checkbox.check();
  await patient.getByRole("button", { name: "Continue to booking" }).click();
  await expect(patient).toHaveURL(/\/app\/appointments/, { timeout: 15_000 });

  await patient.getByText("Sam Chen, MD").click();
  const slotButtons = patient.locator("section:has-text('Times with') button");
  await expect(slotButtons.first()).toBeVisible({ timeout: 15_000 });
  await slotButtons.first().click();
  await expect(patient.getByText(/Booked!/)).toBeVisible({ timeout: 15_000 });

  await patient.goto("/app/messages");
  await patient.getByRole("button", { name: /Sam Chen/ }).click();
  const composer = patient.getByLabel("Message");
  await expect(composer).toBeVisible({ timeout: 15_000 });
  await composer.fill(patientMsg);
  await patient.getByRole("button", { name: "Send" }).click();
  await expect(
    patient.locator("p.whitespace-pre-wrap", { hasText: patientMsg }),
  ).toBeVisible({ timeout: 15_000 });

  // ── Provider: login → forced MFA setup → re-login with TOTP → reply ────
  const providerContext = await browser.newContext();
  const provider = await providerContext.newPage();
  await login(provider, MFA_PROVIDER_EMAIL);
  await expect(provider).toHaveURL(/\/mfa\/setup/);

  const setupKey = provider.locator("code");
  await expect(setupKey).toBeVisible({ timeout: 15_000 });
  const secret = (await setupKey.textContent())!.trim();
  await provider.getByLabel("6-digit code").fill(generateSync({ secret }));
  await provider.getByRole("button", { name: "Enable two-factor" }).click();
  await provider.waitForURL(/\/login/, { timeout: 20_000 });

  await login(provider, MFA_PROVIDER_EMAIL, secret);
  await expect(provider).toHaveURL(/\/provider/, { timeout: 15_000 });

  await provider.goto("/provider/inbox");
  await provider.getByRole("button", { name: `#${runId}` }).click();
  await expect(
    provider.locator("p.whitespace-pre-wrap", { hasText: patientMsg }),
  ).toBeVisible({ timeout: 15_000 });
  const reply = provider.getByLabel("Message");
  await reply.fill(providerMsg);
  await provider.getByRole("button", { name: "Send" }).click();
  await expect(provider.locator("p.whitespace-pre-wrap", { hasText: providerMsg })).toBeVisible({
    timeout: 15_000,
  });

  // ── Patient sees the reply (polling ≤10s) ───────────────────────────────
  await expect(patient.locator("p.whitespace-pre-wrap", { hasText: providerMsg })).toBeVisible({
    timeout: 20_000,
  });

  await patientContext.close();
  await providerContext.close();
});
