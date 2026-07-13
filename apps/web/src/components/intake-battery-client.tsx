"use client";

import { useCallback, useEffect, useState } from "react";
import { INTAKE_BATTERY } from "@calm-point/shared";
import { Badge, Button, Card, ProgressBar, Skeleton } from "@calm-point/ui";

/**
 * Signed-in intake battery runner (docs/10 §1.2): administers each validated
 * instrument one question per screen, submits per-instrument to
 * /api/v1/checkins/[slug] (server-side scoring), diverts to crisis resources
 * on an endorsed safety item, and finishes by requesting the AI analysis
 * (feature-flagged; a 403 is a normal, quiet outcome).
 */

interface Question {
  id: string;
  prompt: string;
  helpText: string | null;
  options: Array<{ id: string; label: string }>;
}

interface LoadedInstrument {
  slug: string;
  title: string;
  questions: Question[];
}

type Stage =
  | { kind: "loading" }
  | { kind: "asking"; instrumentIdx: number; questionIdx: number }
  | { kind: "submitting" }
  | { kind: "crisis" }
  | { kind: "done"; analysisRequested: boolean }
  | { kind: "error"; message: string };

export function IntakeBatteryClient() {
  const [instruments, setInstruments] = useState<LoadedInstrument[]>([]);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded: LoadedInstrument[] = [];
        for (const item of INTAKE_BATTERY) {
          const res = await fetch(`/api/v1/checkins/${item.slug}`);
          if (!res.ok) throw new Error(`Could not load ${item.slug}`);
          const data = (await res.json()) as { questionnaire: LoadedInstrument };
          loaded.push(data.questionnaire);
        }
        if (!cancelled) {
          setInstruments(loaded);
          setStage({ kind: "asking", instrumentIdx: 0, questionIdx: 0 });
        }
      } catch (e) {
        if (!cancelled) setStage({ kind: "error", message: e instanceof Error ? e.message : "Load failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalQuestions = instruments.reduce((n, i) => n + i.questions.length, 0);
  const answeredBefore = (ii: number, qi: number) =>
    instruments.slice(0, ii).reduce((n, i) => n + i.questions.length, 0) + qi;

  // Keyboard 1–9 selection (docs/07 §3: Questionnaire Stepper).
  useEffect(() => {
    if (stage.kind !== "asking") return;
    const options = instruments[stage.instrumentIdx]?.questions[stage.questionIdx]?.options;
    if (!options) return;
    function onKeyDown(e: KeyboardEvent) {
      const n = Number(e.key);
      const option = options![n - 1];
      if (!option) return;
      void choose(option.id);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, instruments]);

  const submitInstrument = useCallback(
    async (instrument: LoadedInstrument, chosen: Record<string, string>) => {
      const res = await fetch(`/api/v1/checkins/${instrument.slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: instrument.questions.map((q) => ({ questionId: q.id, optionId: chosen[q.id]! })),
        }),
      });
      if (!res.ok) throw new Error(`Could not save ${instrument.title}`);
      return (await res.json()) as { ok: boolean; crisis: boolean };
    },
    [],
  );

  async function choose(optionId: string) {
    if (stage.kind !== "asking") return;
    const { instrumentIdx, questionIdx } = stage;
    const instrument = instruments[instrumentIdx]!;
    const question = instrument.questions[questionIdx]!;
    const nextAnswers = {
      ...answers,
      [instrument.slug]: { ...(answers[instrument.slug] ?? {}), [question.id]: optionId },
    };
    setAnswers(nextAnswers);

    if (questionIdx + 1 < instrument.questions.length) {
      setStage({ kind: "asking", instrumentIdx, questionIdx: questionIdx + 1 });
      return;
    }
    // Instrument complete → submit it before advancing.
    setStage({ kind: "submitting" });
    try {
      const result = await submitInstrument(instrument, nextAnswers[instrument.slug]!);
      if (result.crisis) {
        setStage({ kind: "crisis" });
        return;
      }
      if (instrumentIdx + 1 < instruments.length) {
        setStage({ kind: "asking", instrumentIdx: instrumentIdx + 1, questionIdx: 0 });
      } else {
        const analysis = await fetch("/api/v1/intake/analyze", { method: "POST" });
        setStage({ kind: "done", analysisRequested: analysis.ok });
      }
    } catch (e) {
      setStage({ kind: "error", message: e instanceof Error ? e.message : "Save failed" });
    }
  }

  if (stage.kind === "loading") {
    return (
      <Card className="max-w-xl">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="mt-3 h-8 w-full" />
        <Skeleton className="mt-2 h-8 w-full" />
      </Card>
    );
  }

  if (stage.kind === "error") {
    return (
      <Card className="max-w-xl">
        <p className="text-sm text-danger">{stage.message}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (stage.kind === "crisis") {
    return (
      <Card className="max-w-xl space-y-4">
        <h2 className="text-xl font-semibold">Thank you for being honest. Let&apos;s get you real support, right now.</h2>
        <p className="text-sm text-ink-soft">
          Some of what you shared tells us you deserve more immediate care than an online intake.
          Your care team has been alerted. Free, confidential help is available 24/7.
        </p>
        <div className="flex flex-col gap-2">
          <a href="tel:988" className="rounded-xl bg-brand px-5 py-3 text-center font-semibold text-on-brand">
            Call or text 988 — Suicide &amp; Crisis Lifeline
          </a>
          <a href="sms:741741" className="rounded-xl border border-brand px-5 py-3 text-center font-semibold text-brand">
            Text HOME to 741741 — Crisis Text Line
          </a>
        </div>
        <p className="text-xs text-ink-soft">In immediate danger? Call 911 or go to your nearest emergency room.</p>
      </Card>
    );
  }

  if (stage.kind === "done") {
    return (
      <Card className="max-w-xl space-y-3 text-center">
        <Badge>Intake complete</Badge>
        <h2 className="text-xl font-semibold">Thank you — this really helps.</h2>
        <p className="text-sm text-ink-soft">
          Your responses{stage.analysisRequested ? " and an AI-generated summary" : ""} are shared
          securely with your provider, who reviews them before your visit.
        </p>
        <Button onClick={() => (window.location.href = "/app/verify")}>Continue: verify &amp; coverage</Button>
      </Card>
    );
  }

  if (stage.kind === "submitting") {
    return (
      <Card className="max-w-xl">
        <p className="text-sm text-ink-soft">Saving…</p>
      </Card>
    );
  }

  const instrument = instruments[stage.instrumentIdx]!;
  const question = instrument.questions[stage.questionIdx]!;
  const progress = answeredBefore(stage.instrumentIdx, stage.questionIdx);

  return (
    <Card className="max-w-xl" aria-live="polite">
      <div className="mb-3 flex items-center justify-between text-sm text-ink-soft">
        <span>{instrument.title}</span>
        <span className="tabular-nums">
          {progress + 1} of {totalQuestions}
        </span>
      </div>
      <ProgressBar
        className="mb-5"
        value={progress}
        max={totalQuestions}
        label={`Question ${progress + 1} of ${totalQuestions}`}
      />
      {question.helpText ? <p className="mb-1 text-sm text-ink-soft">{question.helpText}</p> : null}
      <h2 className="mb-4 text-lg font-semibold leading-snug">{question.prompt}</h2>
      <div role="group" aria-label={question.prompt} className="flex flex-col gap-2">
        {question.options.map((option, idx) => (
          <button
            key={option.id}
            type="button"
            onClick={() => void choose(option.id)}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/10 bg-surface px-4 py-3 text-left text-sm font-medium hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
          >
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-tint text-xs font-semibold text-brand">
              {idx + 1}
            </span>
            {option.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
