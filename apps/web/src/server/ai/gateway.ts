import { prisma } from "@calm-point/db";

/**
 * The single AI gateway (docs/02 D8): every model call in the platform goes
 * through here — zero-retention headers, AiInteraction audit rows, and one
 * place to swap models. No PHI ever goes to a vendor without a BAA (docs/05).
 *
 * Without ANTHROPIC_API_KEY (local/CI), tasks fall back to deterministic
 * mock output so clinical workflows stay fully testable. 🚦 The mock path is
 * refused in production.
 */

export type AiPurpose = "scribe-soap" | "intake-summary" | "safety-check" | "therapist-text";

const MODEL_BY_PURPOSE: Record<AiPurpose, string> = {
  "scribe-soap": "claude-sonnet-5",
  "intake-summary": "claude-sonnet-5",
  "safety-check": "claude-haiku-4-5-20251001",
  "therapist-text": "claude-sonnet-5",
};

interface AiResult {
  text: string;
  mock: boolean;
}

export async function runAiTask(options: {
  purpose: AiPurpose;
  system: string;
  prompt: string;
  userId?: string;
  maxTokens?: number;
}): Promise<AiResult> {
  const { purpose, system, prompt, userId, maxTokens = 2048 } = options;
  const model = MODEL_BY_PURPOSE[purpose];
  const started = Date.now();

  if (!process.env.ANTHROPIC_API_KEY) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AI !== "1") {
      throw new Error("AI gateway is not configured (ANTHROPIC_API_KEY missing)");
    }
    const text = mockCompletion(purpose, prompt);
    await record({ purpose, model: "mock", userId, latencyMs: Date.now() - started });
    return { text, mock: true };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    await record({ purpose, model, userId, latencyMs: Date.now() - started, safetyFlag: "api-error" });
    throw new Error(`AI gateway: model call failed (${res.status})`);
  }
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  await record({
    purpose,
    model,
    userId,
    latencyMs: Date.now() - started,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
  });
  return { text, mock: false };
}

async function record(row: {
  purpose: string;
  model: string;
  userId?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  safetyFlag?: string;
}) {
  try {
    await prisma.aiInteraction.create({
      data: {
        purpose: row.purpose,
        model: row.model,
        userId: row.userId ?? null,
        latencyMs: row.latencyMs,
        inputTokens: row.inputTokens ?? null,
        outputTokens: row.outputTokens ?? null,
        safetyFlag: row.safetyFlag ?? null,
      },
    });
  } catch (err) {
    console.error("[ai-gateway] failed to record interaction", err);
  }
}

/** Deterministic dev/CI output per purpose — keeps E2E meaningful. */
function mockCompletion(purpose: AiPurpose, prompt: string): string {
  if (purpose === "scribe-soap") {
    const lines = prompt
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(-12);
    return JSON.stringify({
      subjective:
        "Patient-reported concerns drawn from the visit conversation:\n" +
        lines
          .filter((l) => l.toLowerCase().startsWith("patient:"))
          .map((l) => `- ${l.replace(/^patient:\s*/i, "")}`)
          .join("\n"),
      objective:
        "Telehealth video visit. Patient alert and engaged. [MOCK DRAFT — no vendor AI configured]",
      assessment:
        "Draft assessment for provider review. This AI draft contains only information from the transcript; the provider is the author of record.",
      plan:
        "Provider to confirm plan discussed in visit:\n" +
        lines
          .filter((l) => l.toLowerCase().startsWith("provider:"))
          .map((l) => `- ${l.replace(/^provider:\s*/i, "")}`)
          .join("\n"),
    });
  }
  return "[mock ai output]";
}
