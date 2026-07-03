import { expect, test, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import { PrismaClient } from "@prisma/client";

// Phase 3.2 + 3.3 slice: the full clinical loop on the dev video vendor —
// provider starts the visit, both consent to the scribe, transcript lines
// flow, provider ends the visit, an AI SOAP draft is generated, the provider
// edits and SIGNS it (locked + hashed).

const PASSWORD = "CalmPoint-Dev-2026!";
const PROVIDER_EMAIL = "provider2@calmpoint.dev";
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
    where: { email: PROVIDER_EMAIL },
    data: { mfaEnabled: false, mfaSecret: null },
  });
});
test.afterAll(async () => {
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

async function enrollMfa(page: Page): Promise<string> {
  await login(page, PROVIDER_EMAIL);
  await expect(page).toHaveURL(/\/mfa\/setup/);
  const setupKey = page.locator("code");
  await expect(setupKey).toBeVisible({ timeout: 15_000 });
  const secret = (await setupKey.textContent())!.trim();
  await page.getByLabel("6-digit code").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Enable two-factor" }).click();
  await page.waitForURL(/\/login/, { timeout: 20_000 });
  await login(page, PROVIDER_EMAIL, secret);
  await expect(page).toHaveURL(/\/provider/, { timeout: 15_000 });
  return secret;
}

test("visit lifecycle: join → consent → transcript → complete → AI draft → sign", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const runId = Date.now();

  // ── Patient: signup → onboard → book with Sam Chen ─────────────────────
  const patientContext = await browser.newContext();
  const patient = await patientContext.newPage();
  await patient.goto("/signup");
  await patient.getByLabel("First name").fill("Vera");
  await patient.getByLabel("Last name").fill(`Visit${runId}`);
  await patient.getByLabel("Email").fill(`visit-${runId}@calmpoint.dev`);
  await patient.getByLabel("Password").fill("A-very-long-passphrase-6");
  await patient.getByRole("checkbox").check();
  await patient.getByRole("button", { name: "Create account" }).click();
  await expect(patient).toHaveURL(/\/app/, { timeout: 15_000 });

  await patient.goto("/app/onboarding");
  await patient.getByLabel("Date of birth").fill("1990-01-10");
  await patient.getByLabel("State of residence").selectOption("NY");
  await patient.getByLabel("Emergency contact name").fill("Vic Contact");
  await patient.getByLabel("Emergency contact phone").fill("212-555-0122");
  for (const checkbox of await patient.getByRole("checkbox").all()) await checkbox.check();
  await patient.getByRole("button", { name: "Continue to booking" }).click();
  await expect(patient).toHaveURL(/\/app\/appointments/, { timeout: 15_000 });

  await patient.getByText("Sam Chen, MD").click();
  const slotButtons = patient.locator("section:has-text('Times with') button");
  await expect(slotButtons.first()).toBeVisible({ timeout: 15_000 });
  await slotButtons.first().click();
  await expect(patient.getByText(/Booked!/)).toBeVisible({ timeout: 15_000 });

  // ── Provider: MFA enroll → start the visit ─────────────────────────────
  const providerContext = await browser.newContext();
  const provider = await providerContext.newPage();
  await enrollMfa(provider);

  await provider.goto("/provider");
  await provider
    .locator(`div:has(> div > p:text("Vera Visit${runId}")) a:text("Start")`)
    .click();
  await provider.getByRole("button", { name: "Start visit" }).click();
  await expect(provider.getByText("Visit in progress")).toBeVisible({ timeout: 15_000 });

  // Consent (provider side records it — both parties see the same gate).
  await provider.getByRole("button", { name: /I consent to transcription/ }).click();
  await expect(provider.getByText("transcription consented")).toBeVisible();

  // ── Patient joins the in-progress visit ────────────────────────────────
  await patient.getByRole("button", { name: "Join", exact: true }).first().click();
  await patient.getByRole("button", { name: "Join visit" }).click();
  await expect(patient.getByText("Visit in progress")).toBeVisible({ timeout: 15_000 });

  // ── Transcript lines from both sides (dev STT path) ────────────────────
  const patientLine = patient.getByLabel("Transcript line");
  await expect(patientLine).toBeVisible({ timeout: 15_000 });
  await patientLine.fill("I've been feeling anxious mostly in the mornings.");
  await patient.getByRole("button", { name: "Add" }).click();

  const providerLine = provider.getByLabel("Transcript line");
  await providerLine.fill("Let's start a daily grounding practice and follow up in two weeks.");
  await provider.getByRole("button", { name: "Add" }).click();

  // ── Provider ends the visit → AI draft → lands on Notes ────────────────
  await provider.getByRole("button", { name: /End visit/ }).click();
  await provider.waitForURL(/\/provider\/notes/, { timeout: 20_000 });

  await provider.getByRole("button", { name: /Vera Visit/ }).first().click();
  const subjective = provider.locator("#note-subjective");
  await expect(subjective).toBeVisible({ timeout: 15_000 });
  await expect(subjective).toHaveValue(/anxious/, { timeout: 15_000 });

  // Edit, then sign — the note locks.
  await subjective.fill("Patient reports morning-predominant anxiety. (Provider-reviewed)");
  await provider.getByRole("button", { name: "Sign & lock" }).click();
  await expect(provider.getByText("signed & locked")).toBeVisible({ timeout: 15_000 });
  await expect(subjective).toHaveAttribute("readonly", "");

  // Locked note refuses further edits at the API level too.
  const noteId = await provider.evaluate(() => {
    const res = fetch("/api/v1/notes").then((r) => r.json());
    return res.then((d: { notes: Array<{ id: string; status: string }> }) =>
      d.notes.find((n) => n.status === "SIGNED")?.id,
    );
  });
  const editAttempt = await provider.request.put(`/api/v1/notes/${noteId}`, {
    data: { subjective: "tamper", objective: "", assessment: "", plan: "" },
  });
  expect(editAttempt.status()).toBe(409);

  await patientContext.close();
  await providerContext.close();
});
