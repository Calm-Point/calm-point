import { z } from "zod";

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
] as const;

/** Current versions of the legal docs a patient accepts at onboarding. */
export const CONSENT_DOC_VERSIONS = {
  "telehealth-consent": "2026-07-draft",
  "hipaa-npp": "2026-07-draft",
} as const;

export const onboardingSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((s) => {
      const dob = new Date(`${s}T00:00:00Z`);
      if (Number.isNaN(dob.getTime())) return false;
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age <= 120;
    }, "You must be 18 or older to use Calm Point"),
  stateOfResidence: z.enum(US_STATES),
  emergencyContactName: z.string().min(1).max(200),
  emergencyContactPhone: z.string().min(7).max(25),
  pharmacyName: z.string().max(200).optional(),
  pharmacyAddress: z.string().max(400).optional(),
  acceptTelehealthConsent: z.literal(true),
  acceptNpp: z.literal(true),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
