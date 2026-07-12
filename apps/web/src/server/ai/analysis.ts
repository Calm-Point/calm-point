import { prisma } from "@calm-point/db";
import { runAiTask, runGeminiTask } from "./gateway";

/**
 * Intake analysis ensemble (docs/10 §1.3). After deterministic scoring, Claude
 * and Gemini each draft a provider-facing summary; Claude reconciles the two
 * into one analysis. This is DECISION SUPPORT ONLY — it never diagnoses or
 * prescribes; a licensed provider reviews, decides, and signs. Risk flags are
 * derived deterministically from the authoritative scores (not the model), so
 * safety signals never depend on model output.
 *
 * 🚦 Sends clinical scores to the AI vendors — gated behind the feature flag +
 * signed BAAs before any real patient PHI (CLAUDE.md, docs/05).
 */

export interface AnalysisInstrument {
  slug: string;
  title: string;
  score: number;
  max: number;
  severity: string | null;
  flaggedSafety: boolean;
}

export interface AnalysisInput {
  instruments: AnalysisInstrument[];
  safetyFlagged: boolean;
}

export interface RiskFlag {
  severity: "critical" | "high" | "medium";
  label: string;
  detail: string;
}

const HIGH_SEVERITIES = new Set(["severe", "moderately-severe"]);
const POSITIVE_SEVERITIES = new Set(["moderate", "positive-screen", "at-risk"]);

/** Deterministic risk flags from authoritative scores — independent of the AI. */
export function computeRiskFlags(input: AnalysisInput): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (input.safetyFlagged || input.instruments.some((i) => i.flaggedSafety)) {
    flags.push({
      severity: "critical",
      label: "Safety item endorsed",
      detail:
        "The patient endorsed a suicide/self-harm safety item. Prioritize a same-day safety assessment; a crisis divert (988) was shown to the patient.",
    });
  }
  for (const i of input.instruments) {
    if (i.severity && HIGH_SEVERITIES.has(i.severity)) {
      flags.push({
        severity: "high",
        label: `${i.title}: ${i.severity}`,
        detail: `Score ${i.score}/${i.max} indicates ${i.severity} severity — active treatment discussion recommended.`,
      });
    } else if (i.severity && POSITIVE_SEVERITIES.has(i.severity)) {
      flags.push({
        severity: "medium",
        label: `${i.title}: ${i.severity}`,
        detail: `Score ${i.score}/${i.max} screened positive — clinical exploration recommended.`,
      });
    }
  }
  return flags;
}

/** Build the PHI-minimal analysis input from completed questionnaire responses. */
export function buildAnalysisInput(
  responses: Array<{
    totalScore: number | null;
    severity: string | null;
    flaggedSafety: boolean;
    questionnaire: { slug: string; title: string; scoringRules: Array<{ maxScore: number }> };
  }>,
): AnalysisInput {
  const instruments: AnalysisInstrument[] = responses.map((r) => ({
    slug: r.questionnaire.slug,
    title: r.questionnaire.title,
    score: r.totalScore ?? 0,
    max: r.questionnaire.scoringRules.reduce((m, rule) => Math.max(m, rule.maxScore), 0),
    severity: r.severity,
    flaggedSafety: r.flaggedSafety,
  }));
  return { instruments, safetyFlagged: responses.some((r) => r.flaggedSafety) };
}

const ANALYST_SYSTEM = [
  "You are a clinical decision-support assistant writing a concise pre-visit summary FOR A LICENSED MENTAL-HEALTH PROVIDER.",
  "STRICT RULES:",
  "- You do NOT diagnose. You do NOT recommend or name medications or doses.",
  "- You never discourage professional care.",
  "- Surface any safety/suicidality signal first and prominently.",
  "- Base statements only on the provided instrument scores/severities; do not invent history.",
  "- Frame everything as areas for the provider to explore; the provider is the author of record.",
  "Write 150-250 words: presenting picture, what each positive instrument suggests, risk considerations, and suggested areas to explore.",
].join("\n");

const RECONCILE_SYSTEM = [
  "You are a senior clinician reconciling two independent AI-drafted pre-visit summaries into ONE.",
  "Keep the same strict rules: no diagnosis, no medication advice, safety first, decision-support only.",
  "Merge agreements, note any material disagreement between the drafts in one line, and produce a single clean provider-facing summary.",
].join("\n");

export interface EnsembleResult {
  summary: string;
  models: { claude: boolean; gemini: boolean; reconciled: boolean; mock: boolean };
}

export async function generateIntakeAnalysis(
  input: AnalysisInput,
  userId?: string,
): Promise<EnsembleResult> {
  const prompt = `Structured intake data (JSON):\n${JSON.stringify(input, null, 2)}\n\nWrite the provider-facing pre-visit summary per your instructions.`;

  const [claude, gemini] = await Promise.all([
    runAiTask({ purpose: "intake-analysis", system: ANALYST_SYSTEM, prompt, userId }).catch(
      () => null,
    ),
    runGeminiTask({ purpose: "intake-analysis", system: ANALYST_SYSTEM, prompt, userId }).catch(
      () => null,
    ),
  ]);

  const bothReal = Boolean(claude && gemini && !claude.mock && !gemini.mock);
  if (bothReal) {
    const recon = await runAiTask({
      purpose: "intake-analysis",
      system: RECONCILE_SYSTEM,
      prompt: `Draft A (Claude):\n${claude!.text}\n\nDraft B (Gemini):\n${gemini!.text}\n\nProduce one reconciled provider-facing summary.`,
      userId,
    }).catch(() => null);
    return {
      summary: recon?.text || claude!.text,
      models: { claude: true, gemini: true, reconciled: Boolean(recon), mock: false },
    };
  }

  const summary = claude?.text || gemini?.text || "Analysis unavailable.";
  return {
    summary,
    models: {
      claude: Boolean(claude && !claude.mock),
      gemini: Boolean(gemini && !gemini.mock),
      reconciled: false,
      mock: claude?.mock ?? true,
    },
  };
}

/** Generate + persist the analysis for a patient's completed intake responses. */
export async function analyzeAndPersist(params: {
  patientId: string;
  intakeSessionId?: string | null;
  userId?: string;
}): Promise<{ id: string; riskFlags: RiskFlag[]; models: EnsembleResult["models"] }> {
  const responses = await prisma.questionnaireResponse.findMany({
    where: {
      patientId: params.patientId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    include: { questionnaire: { include: { scoringRules: true } } },
  });

  const input = buildAnalysisInput(responses);
  const riskFlags = computeRiskFlags(input);
  const ensemble = await generateIntakeAnalysis(input, params.userId);

  const created = await prisma.intakeAnalysis.create({
    data: {
      patientId: params.patientId,
      intakeSessionId: params.intakeSessionId ?? null,
      status: "READY",
      summary: ensemble.summary,
      riskFlags: riskFlags as unknown as object,
      scores: input.instruments as unknown as object,
      models: ensemble.models as unknown as object,
    },
  });

  return { id: created.id, riskFlags, models: ensemble.models };
}
