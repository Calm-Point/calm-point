import { z } from "zod";

export const APPOINTMENT_KINDS = ["INITIAL", "FOLLOW_UP", "THERAPY"] as const;

export const listSlotsSchema = z.object({
  providerId: z.string().cuid().optional(),
  /** ISO date (YYYY-MM-DD) the patient is browsing, interpreted in provider tz. */
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(1).max(14).default(7),
});

export const bookAppointmentSchema = z.object({
  providerId: z.string().cuid(),
  /** Slot start in ISO-8601 UTC, exactly as returned by the slots endpoint. */
  startsAt: z.string().datetime(),
  kind: z.enum(APPOINTMENT_KINDS).default("INITIAL"),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().cuid(),
  reason: z.string().max(500).optional(),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
