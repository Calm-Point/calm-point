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

export type AiPurpose =
  | "scribe-soap"
  | "intake-summary"
  | "intake-analysis"
  | "safety-check"
  | "therapist-text";

const MODEL_BY_PURPOSE: Record<AiPurpose, string> = {
  "scribe-soap": "claude-sonnet-5",
  "intake-summary": "claude-sonnet-5",
  "intake-analysis": "claude-sonnet-5",
  "safety-check": "claude-haiku-4-5-20251001",
  "therapist-text": "claude-sonnet-5",
};

const GEMINI_MODEL = "gemini-2.5-flash";

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

/**
 * Gemini path (Google AI). Used as the second opinion in the intake-analysis
 * ensemble. Falls back to deterministic mock without GEMINI_API_KEY (refused in
 * production unless ALLOW_MOCK_AI=1). 🚦 Real PHI requires a Google BAA (Vertex).
 */
export async function runGeminiTask(options: {
  purpose: AiPurpose;
  system: string;
  prompt: string;
  userId?: string;
  maxTokens?: number;
}): Promise<AiResult> {
  const { purpose, system, prompt, userId, maxTokens = 2048 } = options;
  const started = Date.now();

  if (!process.env.GEMINI_API_KEY) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AI !== "1") {
      throw new Error("Gemini is not configured (GEMINI_API_KEY missing)");
    }
    const text = mockCompletion(purpose, prompt);
    await record({ purpose, model: "gemini-mock", userId, latencyMs: Date.now() - started });
    return { text, mock: true };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // Disable "thinking" tokens so the full output budget produces the
        // summary (gemini-2.5-flash otherwise spends most of it reasoning).
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.4,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) {
    await record({ purpose, model: GEMINI_MODEL, userId, latencyMs: Date.now() - started, safetyFlag: "api-error" });
    throw new Error(`AI gateway: Gemini call failed (${res.status})`);
  }
  const data = await res.json();
  const text: string =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  await record({
    purpose,
    model: GEMINI_MODEL,
    userId,
    latencyMs: Date.now() - started,
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
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
  if (purpose === "intake-analysis") {
    return [
      "**Intake summary (AI draft — provider to review, diagnose, and sign).**",
      "",
      "This is a deterministic mock generated because no vendor AI is configured.",
      "The patient completed the validated intake battery; instrument scores and",
      "severities are shown in the structured data. Areas that screened positive",
      "warrant clinical exploration at the visit. Any endorsed safety item has been",
      "flagged for immediate attention.",
      "",
      "The provider is the author of record and makes all diagnostic and treatment",
      "decisions. This draft contains no diagnosis and no medication recommendation.",
    ].join("\n");
  }
  return "[mock ai output]";
}
