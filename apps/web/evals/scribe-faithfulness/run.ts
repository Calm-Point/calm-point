import { draftSoapNote } from "../../src/server/visits";
import { EVAL_TRANSCRIPTS } from "./transcripts";
import { judgeNote } from "./judge";

/**
 * AI scribe faithfulness eval (docs/04 §3.7 acceptance; CLAUDE.md "AI safety
 * is non-negotiable"). Drafts a SOAP note from each synthetic transcript
 * through the exact production path (draftSoapNote), then has Claude judge
 * the note against the transcript for fabrication, dropped denials,
 * unearned diagnoses, and safety-relevant omissions.
 *
 * Requires ANTHROPIC_API_KEY — without it, every call falls back to the
 * mock model layer, which cannot give a real faithfulness signal, so this
 * exits 0 with a warning rather than reporting a false pass.
 *
 * Run: pnpm --filter @calm-point/web evals
 */

const SCORE_THRESHOLD = 4; // out of 5

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[scribe-faithfulness] ANTHROPIC_API_KEY not set — skipping (mock model output gives no real faithfulness signal).",
    );
    return;
  }

  let failures = 0;
  const rows: Array<{ id: string; score: number; faithful: boolean; keywordHit: string | null }> = [];

  for (const item of EVAL_TRANSCRIPTS) {
    const note = await draftSoapNote(item.transcript);
    const verdict = await judgeNote(item.transcript, note);

    const noteText = `${note.subjective} ${note.objective} ${note.assessment} ${note.plan}`.toLowerCase();
    const keywordHit =
      item.mustNotMention?.find((phrase) => noteText.includes(phrase.toLowerCase())) ?? null;

    const pass = verdict.faithful && verdict.score >= SCORE_THRESHOLD && !keywordHit;
    if (!pass) failures++;

    rows.push({ id: item.id, score: verdict.score, faithful: verdict.faithful, keywordHit });

    const status = pass ? "PASS" : "FAIL";
    console.log(`[${status}] ${item.id} — score ${verdict.score}/5${note.mock ? " (mock model)" : ""}`);
    if (!pass) {
      if (keywordHit) console.log(`         keyword guard hit: "${keywordHit}"`);
      if (verdict.issues.length) console.log(`         issues: ${verdict.issues.join("; ")}`);
      console.log(`         rationale: ${verdict.rationale}`);
    }
  }

  const meanScore = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
  console.log(`\n${rows.length - failures}/${rows.length} passed · mean score ${meanScore.toFixed(2)}/5`);

  if (failures > 0) {
    console.error(`\n${failures} scribe faithfulness case(s) failed — do not merge prompt/parsing changes.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[scribe-faithfulness] eval run crashed:", err);
  process.exitCode = 1;
});
