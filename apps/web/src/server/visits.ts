import crypto from "node:crypto";
import { prisma, audit } from "@calm-point/db";
import { AuthzError, type SessionUser } from "@/server/authorize";
import { activeVideoProvider, type JoinInfo } from "@/server/video";
import { putText, appendText, getText } from "@/server/storage";
import { runAiTask } from "@/server/ai/gateway";

const JOIN_EARLY_MIN = 15;

export async function loadVisitForUser(user: SessionUser, appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      provider: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      transcript: true,
      note: true,
    },
  });
  if (!appointment) throw new AuthzError(403, "Forbidden");
  const isPatient = user.role === "PATIENT" && appointment.patient.user.id === user.id;
  const isProvider = user.role === "PROVIDER" && appointment.provider.user.id === user.id;
  if (!isPatient && !isProvider) throw new AuthzError(403, "Forbidden");
  return { appointment, isProvider };
}

/**
 * Join rules: the provider (host) can start their visit any time before it
 * has ended; the patient can join once it's IN_PROGRESS or within the
 * early-join window of the scheduled start.
 */
export async function joinVisit(user: SessionUser, appointmentId: string): Promise<JoinInfo> {
  const { appointment, isProvider } = await loadVisitForUser(user, appointmentId);

  if (!["SCHEDULED", "CONFIRMED", "IN_PROGRESS"].includes(appointment.status)) {
    throw new AuthzError(403, "This visit is not joinable");
  }
  if (!isProvider) {
    const earlyOk =
      Date.now() >= appointment.startsAt.getTime() - JOIN_EARLY_MIN * 60_000;
    if (appointment.status !== "IN_PROGRESS" && !earlyOk) {
      throw new AuthzError(403, "The visit hasn't started yet");
    }
  }

  const provider = await activeVideoProvider();
  const sessionId =
    appointment.videoSessionId ?? (await provider.createSession(appointment.id));

  if (appointment.status !== "IN_PROGRESS" && isProvider) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "IN_PROGRESS", videoVendor: provider.vendor, videoSessionId: sessionId },
    });
  } else if (!appointment.videoSessionId) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { videoVendor: provider.vendor, videoSessionId: sessionId },
    });
  }

  await audit({
    actorId: user.id,
    action: "visit.join",
    resourceType: "Appointment",
    resourceId: appointment.id,
    metadata: { vendor: provider.vendor, host: isProvider },
  });

  const displayName = isProvider
    ? `${appointment.provider.user.firstName} ${appointment.provider.user.lastName}`
    : `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
  return provider.joinToken(sessionId, {
    userId: user.id,
    displayName,
    role: isProvider ? "host" : "attendee",
  });
}

/** Records scribe consent — REQUIRED before any transcript byte is stored. */
export async function recordScribeConsent(user: SessionUser, appointmentId: string) {
  const { appointment } = await loadVisitForUser(user, appointmentId);
  if (!appointment.scribeConsentAt) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { scribeConsentAt: new Date() },
    });
    await audit({
      actorId: user.id,
      action: "visit.scribe-consent",
      resourceType: "Appointment",
      resourceId: appointment.id,
    });
  }
}

/** Appends diarized transcript lines. Hard-gated on consent (docs/06 §A). */
export async function ingestTranscript(
  user: SessionUser,
  appointmentId: string,
  lines: Array<{ speaker: "patient" | "provider"; text: string }>,
) {
  const { appointment } = await loadVisitForUser(user, appointmentId);
  if (!appointment.scribeConsentAt) {
    throw new AuthzError(403, "Transcription requires recorded consent");
  }
  if (appointment.status !== "IN_PROGRESS") {
    throw new AuthzError(403, "Visit is not in progress");
  }

  const chunk =
    lines.map((l) => `${l.speaker}: ${l.text.replace(/\n/g, " ")}`).join("\n") + "\n";

  if (appointment.transcript) {
    await appendText(appointment.transcript.storageKey, chunk);
  } else {
    const storageKey = await putText(`transcripts/${appointment.id}.txt`, chunk);
    await prisma.visitTranscript.create({
      data: {
        appointmentId: appointment.id,
        storageKey,
        sttVendor: process.env.DEEPGRAM_API_KEY ? "deepgram" : "dev",
      },
    });
  }
}

const SOAP_SYSTEM = `You are a clinical documentation assistant drafting a SOAP note from a telehealth visit transcript.
Rules (non-negotiable):
- Include ONLY information present in the transcript. Never infer diagnoses, medications, or symptoms that are not explicitly mentioned.
- Preserve uncertainty: if audio was unclear, keep the [unclear] marker.
- The provider is the author of record; you produce a DRAFT for their review.
Return strict JSON: {"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}`;

export interface SoapSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  mock: boolean;
}

/**
 * Drafts a SOAP note from a diarized visit transcript. Pulled out of
 * completeVisit() so the scribe faithfulness eval harness
 * (apps/web/evals/scribe-faithfulness.ts) exercises the exact same prompt
 * and parsing the product uses, not a re-implementation of it.
 */
export async function draftSoapNote(transcript: string, userId?: string): Promise<SoapSections> {
  const result = await runAiTask({
    purpose: "scribe-soap",
    system: SOAP_SYSTEM,
    prompt: `Visit transcript (diarized):\n\n${transcript}`,
    userId,
    maxTokens: 3000,
  });
  try {
    const parsed = JSON.parse(result.text.replace(/^```json?\n?|```$/g, "")) as Partial<SoapSections>;
    return {
      subjective: parsed.subjective ?? "",
      objective: parsed.objective ?? "",
      assessment: parsed.assessment ?? "",
      plan: parsed.plan ?? "",
      mock: result.mock,
    };
  } catch {
    return { subjective: result.text, objective: "", assessment: "", plan: "", mock: result.mock };
  }
}

/** Completes the visit and generates the AI SOAP draft (if consented + transcribed). */
export async function completeVisit(user: SessionUser, appointmentId: string) {
  const { appointment, isProvider } = await loadVisitForUser(user, appointmentId);
  if (!isProvider) throw new AuthzError(403, "Only the provider can complete a visit");
  if (appointment.status !== "IN_PROGRESS") {
    throw new AuthzError(403, "Visit is not in progress");
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED" },
  });
  await audit({
    actorId: user.id,
    action: "visit.complete",
    resourceType: "Appointment",
    resourceId: appointment.id,
  });

  if (!appointment.transcript || appointment.note) return { noteDrafted: false };

  const transcript = await getText(appointment.transcript.storageKey);
  const sections = await draftSoapNote(transcript, user.id);

  const note = await prisma.clinicalNote.create({
    data: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      status: "AI_DRAFT",
      subjective: sections.subjective,
      objective: sections.objective,
      assessment: sections.assessment,
      plan: sections.plan,
    },
  });
  await audit({
    actorId: user.id,
    action: "note.ai-draft",
    resourceType: "ClinicalNote",
    resourceId: note.id,
    metadata: { mock: sections.mock },
  });
  return { noteDrafted: true, noteId: note.id };
}

export function noteContentHash(note: {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        s: note.subjective,
        o: note.objective,
        a: note.assessment,
        p: note.plan,
      }),
    )
    .digest("hex");
}
