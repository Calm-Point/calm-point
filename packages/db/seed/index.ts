/**
 * Development/staging seed: three role users, provider licensure, published
 * clinical questionnaires from @calm-point/shared content, and feature flags
 * (all risky flags OFF). Synthetic data only — never run against production.
 */
import { hash } from "@node-rs/argon2";
import { INSTRUMENTS } from "@calm-point/shared";
import { prisma } from "../src/index";

const DEV_PASSWORD = "CalmPoint-Dev-2026!";

async function seedUsers() {
  const passwordHash = await hash(DEV_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const patient = await prisma.user.upsert({
    where: { email: "patient@calmpoint.dev" },
    update: {},
    create: {
      role: "PATIENT",
      email: "patient@calmpoint.dev",
      emailVerified: new Date(),
      passwordHash,
      firstName: "Paige",
      lastName: "Patient",
      patientProfile: {
        create: {
          stateOfResidence: "NY",
          dateOfBirth: new Date("1996-04-12"),
        },
      },
    },
  });

  const provider = await prisma.user.upsert({
    where: { email: "provider@calmpoint.dev" },
    update: {},
    create: {
      role: "PROVIDER",
      email: "provider@calmpoint.dev",
      emailVerified: new Date(),
      passwordHash,
      firstName: "Priya",
      lastName: "Rivera",
      providerProfile: {
        create: {
          credentials: "PMHNP-BC",
          specialties: ["adhd", "anxiety", "depression"],
          bio: "Board-certified psychiatric nurse practitioner focused on whole-person care.",
          licenses: {
            create: [
              {
                state: "NY",
                licenseNumber: "NY-DEV-000001",
                licenseType: "PMHNP",
                expiresAt: new Date("2028-01-01"),
                verifiedAt: new Date(),
              },
              {
                state: "CA",
                licenseNumber: "CA-DEV-000001",
                licenseType: "PMHNP",
                expiresAt: new Date("2028-01-01"),
                verifiedAt: new Date(),
              },
            ],
          },
          availability: {
            create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
              dayOfWeek,
              startMin: 9 * 60,
              endMin: 17 * 60,
              slotSizeMin: 30,
            })),
          },
        },
      },
    },
  });

  // Second provider — dedicated to E2E flows that enroll MFA (messaging.spec)
  // so the primary provider keeps a clean no-MFA state for auth.spec.
  const provider2 = await prisma.user.upsert({
    where: { email: "provider2@calmpoint.dev" },
    update: {},
    create: {
      role: "PROVIDER",
      email: "provider2@calmpoint.dev",
      emailVerified: new Date(),
      passwordHash,
      firstName: "Sam",
      lastName: "Chen",
      providerProfile: {
        create: {
          credentials: "MD",
          specialties: ["depression", "sleep"],
          bio: "Psychiatrist focused on mood and sleep. Warm, evidence-based care.",
          licenses: {
            create: [
              {
                state: "NY",
                licenseNumber: "NY-DEV-000002",
                licenseType: "MD",
                expiresAt: new Date("2028-01-01"),
                verifiedAt: new Date(),
              },
            ],
          },
          availability: {
            create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
              dayOfWeek,
              startMin: 8 * 60,
              endMin: 18 * 60,
              slotSizeMin: 30,
            })),
          },
        },
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@calmpoint.dev" },
    update: {},
    create: {
      role: "ADMIN",
      email: "admin@calmpoint.dev",
      emailVerified: new Date(),
      passwordHash,
      firstName: "Ada",
      lastName: "Admin",
    },
  });

  return { patient, provider, provider2, admin };
}

async function seedQuestionnaires() {
  for (const instrument of INSTRUMENTS) {
    const existing = await prisma.questionnaire.findUnique({
      where: { slug_version: { slug: instrument.slug, version: instrument.version } },
    });
    if (existing) continue;

    await prisma.questionnaire.create({
      data: {
        slug: instrument.slug,
        version: instrument.version,
        kind: "SCREENER",
        title: instrument.title,
        description: instrument.description,
        isPublished: true,
        questions: {
          create: instrument.questions.map((q, order) => ({
            order,
            type: "SINGLE_CHOICE",
            prompt: q.prompt,
            helpText: instrument.preamble,
            isSafetyItem: q.isSafetyItem ?? false,
            meta: {
              scoringMethod: instrument.scoringMethod,
              ...(q.shadedMin !== undefined ? { shadedMin: q.shadedMin } : {}),
            },
            options: {
              // Per-question option scales (ISI, AUDIT-C) override the
              // instrument-level default when present.
              create: (q.options ?? instrument.options).map((option, optionOrder) => ({
                order: optionOrder,
                label: option.label,
                value: option.value,
              })),
            },
          })),
        },
        scoringRules: {
          create: instrument.rules.map((rule) => ({
            minScore: rule.minScore,
            maxScore: rule.maxScore,
            severity: rule.severity,
            recommendation: rule.recommendation,
          })),
        },
      },
    });
    console.log(`Seeded questionnaire ${instrument.slug} v${instrument.version}`);
  }
}

async function seedFlags() {
  const flags: Array<{ key: string; enabled: boolean; description: string }> = [
    { key: "ai-therapist", enabled: false, description: "AI Therapist — OFF until clinical + legal sign-off (CLAUDE.md)" },
    { key: "ai-scribe", enabled: false, description: "AI visit scribe — consent-gated; OFF until quality bar approved" },
    { key: "erx", enabled: false, description: "e-prescribing — post-launch project" },
    { key: "video-vendor", enabled: true, description: "Active video vendor selection (value: zoom|daily)" },
  ];
  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { description: flag.description },
      create: flag,
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production environment.");
  }
  const users = await seedUsers();
  await seedQuestionnaires();
  await seedFlags();
  console.log("Seed complete:", {
    patient: users.patient.email,
    provider: users.provider.email,
    admin: users.admin.email,
    devPassword: DEV_PASSWORD,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
