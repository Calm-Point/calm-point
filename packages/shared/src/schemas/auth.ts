import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  /** Links the pre-auth screener session at account creation (docs/02 D7). */
  intakeSessionToken: z.string().optional(),
  /** 18+ platform — verified against DOB during onboarding. */
  ageAttestation: z.literal(true),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
