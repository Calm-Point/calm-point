import { prisma, audit } from "@calm-point/db";
import { CRISIS_RESOURCES } from "@calm-point/shared";
import { AuthzError, type SessionUser } from "@/server/authorize";
import { putText, appendText, getText } from "@/server/storage";
import { runAiTask } from "./gateway";
import { classifyTurn, type SafetyCategory } from "./safety";

/**
 * AI Therapist text sessions (docs/06 §B). Flag-gated (`ai-therapist`, which
 * requires a recorded clinical+legal sign-off to enable — see admin flags).
 * Every user turn passes the safety classifier BEFORE any engine responds;
 * a flagged turn locks the session into crisis mode for its remainder.
 */

const DAILY_TURN_CAP = 200; // runaway/overuse guard; overuse is a wellbeing signal

const PERSONA_SYSTEM = `You are Calm Point's supportive AI companion — NOT a therapist, clinician, or medical professional, and you never claim to be.
Scope (non-negotiable):
- Never diagnose. Never give medication advice of any kind. Never discourage professional care.
- You support skills practice and reflection: CBT-style reframing, grounding (5-4-3-2-1), behavioral activation, journaling prompts, sleep hygiene basics, values reflection.
- If the user asks for diagnosis or medication guidance, warmly redirect them to their Calm Point provider.
- Tone: warm, plain, unhurried; no toxic positivity; validate before suggesting.
- Keep replies to 2-5 short paragraphs at most; end with one gentle question or invitation when natural.`;

export const CRISIS_MESSAGE = [
  "Thank you for telling me — that took courage, and I'm staying right here with you.",
  `What you're carrying deserves real human support, right now: you can call or text ${CRISIS_RESOURCES.lifeline.phone} (${CRISIS_RESOURCES.lifeline.label}) any time, day or night, or text HOME to 741741 (${CRISIS_RESOURCES.crisisText.label}).`,
  "If you're in immediate danger, please call 911 or go to your nearest emergency room.",
  "I've also let your care team know you could use extra support. I can stay with you here while you reach out — you don't have to do this alone.",
].join("\n\n");

const REDIRECT_MESSAGES: Partial<Record<SafetyCategory, string>> = {
  "med-seeking":
    "Medication questions are important — and they belong with your provider, who knows your full picture. I can't advise on prescriptions or doses. Would you like to send your care team a message from the Messages tab? Meanwhile, I'm happy to keep working through what's on your mind.",
  minor:
    "It sounds like you might be under 18. Calm Point is designed for adults, so I have to stop here — but you deserve support that fits you: the 988 Lifeline (call/text 988) helps people of every age, and a trusted adult, school counselor, or pediatrician can help you find care built for you.",
};

async function flagEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({ where: { key: "ai-therapist" } });
  return Boolean(flag?.enabled);
}

async function requireOwnSession(user: SessionUser, sessionId: string) {
  const session = await prisma.aiTherapySession.findFirst({
    where: { id: sessionId, patient: { userId: user.id } },
    include: { patient: true },
  });
  if (!session) throw new AuthzError(403, "Forbidden");
  return session;
}

export async function startSession(user: SessionUser) {
  if (!(await flagEnabled())) {
    throw new AuthzError(403, "The AI companion isn't available yet.");
  }
  const profile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new AuthzError(403, "Forbidden");

  const session = await prisma.aiTherapySession.create({
    data: { patientId: profile.id, engine: "CLAUDE_TEXT" },
  });
  await audit({
    actorId: user.id,
    action: "therapist.session.start",
    resourceType: "AiTherapySession",
    resourceId: session.id,
  });
  return session;
}

export async function sessionTurn(user: SessionUser, sessionId: string, text: string) {
  const session = await requireOwnSession(user, sessionId);
  if (session.endedAt) throw new AuthzError(403, "Session has ended");

  const turnsToday = await prisma.aiInteraction.count({
    where: {
      userId: user.id,
      purpose: "therapist-text",
      createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) },
    },
  });
  if (turnsToday >= DAILY_TURN_CAP) {
    return {
      reply:
        "We've talked a lot today — and I'm glad you keep reaching out. Let's take a breather until tomorrow. If something urgent is happening, your care team is one message away.",
      crisisMode: false,
      capped: true,
    };
  }

  const flags = (session.safetyFlags as { events?: unknown[] } | null) ?? {};
  const alreadyInCrisisMode = Boolean((flags as { crisisMode?: boolean }).crisisMode);

  // ── Safety gate — runs BEFORE any engine sees the turn ────────────────
  const { category } = await classifyTurn(text, user.id);
  if (category === "crisis" || category === "self-harm" || category === "harm-to-others") {
    await enterCrisisMode(user, session.id, category, flags);
    await logTranscript(session, text, CRISIS_MESSAGE);
    return { reply: CRISIS_MESSAGE, crisisMode: true };
  }
  if (category === "minor" || category === "med-seeking") {
    const reply = REDIRECT_MESSAGES[category]!;
    await audit({
      actorId: user.id,
      action: `therapist.redirect.${category}`,
      resourceType: "AiTherapySession",
      resourceId: session.id,
    });
    await logTranscript(session, text, reply);
    return { reply, crisisMode: alreadyInCrisisMode, endSession: category === "minor" };
  }

  // A session that entered crisis mode stays in supportive-presence mode.
  if (alreadyInCrisisMode) {
    const reply =
      "I'm still right here with you. If you haven't yet, please reach out to 988 (call or text) or text HOME to 741741 — real people, any hour. Would you like me to stay with you while you do?";
    await logTranscript(session, text, reply);
    return { reply, crisisMode: true };
  }

  // ── Normal supportive turn ────────────────────────────────────────────
  const history = await recentTranscript(session);
  const result = await runAiTask({
    purpose: "therapist-text",
    system: PERSONA_SYSTEM,
    prompt: `${history ? `Recent conversation:\n${history}\n\n` : ""}User: ${text}\n\nRespond as the Calm Point companion.`,
    userId: user.id,
    maxTokens: 700,
  });
  const reply = result.mock ? mockSupportiveReply(text) : result.text;
  await logTranscript(session, text, reply);
  return { reply, crisisMode: false };
}

export async function endSession(user: SessionUser, sessionId: string) {
  const session = await requireOwnSession(user, sessionId);
  if (session.endedAt) return { ok: true };

  let summaryKey: string | undefined;
  const transcript = await recentTranscript(session, 200);
  if (transcript) {
    const summary = await runAiTask({
      purpose: "therapist-text",
      system:
        "Summarize this supportive-companion session in 3-5 warm, patient-visible sentences: themes, skills practiced, and one thing to carry forward. No diagnosis, no clinical language.",
      prompt: transcript,
      userId: user.id,
      maxTokens: 400,
    }).catch(() => null);
    if (summary) {
      summaryKey = await putText(
        `therapist/summaries/${session.id}.txt`,
        summary.mock ? "You showed up for yourself today and practiced noticing what you feel. Carry forward: one small kind act for yourself tomorrow." : summary.text,
      );
    }
  }

  await prisma.aiTherapySession.update({
    where: { id: session.id },
    data: { endedAt: new Date(), summaryKey },
  });
  await audit({
    actorId: user.id,
    action: "therapist.session.end",
    resourceType: "AiTherapySession",
    resourceId: session.id,
  });
  return { ok: true };
}

// ── internals ─────────────────────────────────────────────────────────────

async function enterCrisisMode(
  user: SessionUser,
  sessionId: string,
  category: SafetyCategory,
  priorFlags: object,
) {
  await prisma.aiTherapySession.update({
    where: { id: sessionId },
    data: {
      safetyFlags: {
        ...priorFlags,
        crisisMode: true,
        events: [
          ...(((priorFlags as { events?: unknown[] }).events as unknown[]) ?? []),
          { category, at: new Date().toISOString() },
        ],
      } as never,
    },
  });
  // Care-team alert: never silently dropped (docs/05 §6).
  const session = await prisma.aiTherapySession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      patient: {
        include: {
          careRelationships: {
            where: { endedAt: null },
            include: { provider: { select: { userId: true } } },
          },
        },
      },
    },
  });
  const careTeamUserIds = session.patient.careRelationships.map((r) => r.provider.userId);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await prisma.notification.createMany({
    data: [...new Set([...careTeamUserIds, ...admins.map((a) => a.id)])].map((userId) => ({
      userId,
      channel: "IN_APP" as const,
      template: "safety-alert", // PHI-free template key; details live behind auth
      meta: { sessionId },
    })),
  });
  await audit({
    actorId: user.id,
    action: "therapist.crisis-escalation",
    resourceType: "AiTherapySession",
    resourceId: sessionId,
    metadata: { category },
  });
}

async function logTranscript(
  session: { id: string; summaryKey: string | null },
  userText: string,
  reply: string,
) {
  const chunk = `user: ${userText.replace(/\n/g, " ")}\nassistant: ${reply.replace(/\n/g, " ")}\n`;
  const key = `local:therapist/transcripts/${session.id}.txt`;
  try {
    await appendText(key, chunk);
  } catch {
    await putText(`therapist/transcripts/${session.id}.txt`, chunk);
  }
}

async function recentTranscript(session: { id: string }, lines = 30): Promise<string> {
  try {
    const text = await getText(`local:therapist/transcripts/${session.id}.txt`);
    return text.split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

function mockSupportiveReply(text: string): string {
  return `That sounds like a lot to carry, and it makes sense you'd feel that way. [MOCK COMPANION — no vendor AI configured]\n\nOne small thing we could try together: name what you're feeling in one word, and where you notice it in your body. Would you like to try that, or tell me more about "${text.slice(0, 60)}"?`;
}
