import { runAiTask } from "./gateway";

/**
 * Turn-level safety classifier (docs/06 §B) — wraps EVERY therapist turn.
 * Categories short-circuit the conversation before any engine responds.
 *
 * Two layers:
 *  - deterministic lexical screen (always on — catches explicit phrasing even
 *    if the model call fails, and IS the classifier in dev/CI mock mode)
 *  - model classification (claude-haiku via the gateway) for oblique phrasing
 * A turn is flagged if EITHER layer flags it — layers can only add safety.
 */

export type SafetyCategory =
  | "crisis"
  | "self-harm"
  | "harm-to-others"
  | "minor"
  | "med-seeking"
  | "none";

const LEXICAL_RULES: Array<[SafetyCategory, RegExp]> = [
  [
    "crisis",
    /suicid|kill (myself|me)|end (my|it) (life|all)|don'?t want to (live|be alive|wake up)|better off dead|take my (own )?life|no reason to (live|go on)/i,
  ],
  [
    "self-harm",
    /hurt(ing)? myself|harm(ing)? myself|cut(ting)? myself|self[- ]harm|starv(e|ing) myself|punish(ing)? myself physically/i,
  ],
  [
    "harm-to-others",
    /kill (him|her|them|someone)|hurt (him|her|them|someone) (bad|serious)|make (him|her|them) pay physically/i,
  ],
  ["minor", /i'?m (only )?(1[0-7]|[0-9]) (years? old|yo)\b|i'?m a minor|still in middle school/i],
  [
    "med-seeking",
    /prescribe me|can you give me (a prescription|meds|medication|adderall|xanax|klonopin)|increase my dose|what dose should i take|refill my/i,
  ],
];

export function lexicalScreen(text: string): SafetyCategory {
  for (const [category, pattern] of LEXICAL_RULES) {
    if (pattern.test(text)) return category;
  }
  return "none";
}

const CLASSIFIER_SYSTEM = `You classify a single message from a mental-health app user into exactly one category:
crisis          — active suicidal ideation, wanting to die, saying goodbye, a plan or intent
self-harm       — non-suicidal self-injury, urges or acts
harm-to-others  — intent or urges to seriously harm another person
minor           — the user indicates they are under 18
med-seeking     — requesting prescriptions, doses, refills, or medication changes
none            — anything else, including sadness, anxiety, or discussing past recovery
When uncertain between "none" and a risk category, choose the risk category.
Reply with ONLY the category token.`;

export async function classifyTurn(
  text: string,
  userId?: string,
): Promise<{ category: SafetyCategory; lexical: SafetyCategory }> {
  const lexical = lexicalScreen(text);

  let model: SafetyCategory = "none";
  try {
    const result = await runAiTask({
      purpose: "safety-check",
      system: CLASSIFIER_SYSTEM,
      prompt: text.slice(0, 4000),
      userId,
      maxTokens: 10,
    });
    if (!result.mock) {
      const token = result.text.trim().toLowerCase();
      if (
        ["crisis", "self-harm", "harm-to-others", "minor", "med-seeking", "none"].includes(token)
      ) {
        model = token as SafetyCategory;
      }
    }
  } catch {
    // Model layer failing must never weaken safety — lexical layer stands.
  }

  // Union of layers, preferring the more severe signal.
  const severityOrder: SafetyCategory[] = [
    "crisis",
    "self-harm",
    "harm-to-others",
    "minor",
    "med-seeking",
    "none",
  ];
  const category =
    severityOrder.indexOf(lexical) <= severityOrder.indexOf(model) ? lexical : model;
  return { category, lexical };
}
