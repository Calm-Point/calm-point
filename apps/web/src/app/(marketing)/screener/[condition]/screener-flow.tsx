"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, cn } from "@calm-point/ui";

interface Option {
  id: string;
  label: string;
}
interface Question {
  id: string;
  prompt: string;
  helpText: string | null;
  options: Option[];
}
interface Questionnaire {
  slug: string;
  version: number;
  title: string;
  questions: Question[];
}

type Phase = "loading" | "active" | "submitting" | "done" | "error";

/**
 * One-question-per-screen screener (docs/07 §3 Questionnaire Stepper):
 * autosaves each answer, keyboard 1–9 selection, back always available,
 * diverts to /crisis the moment a safety item is answered positively.
 */
export function ScreenerFlow({
  conditionSlug,
  conditionLabel,
}: {
  conditionSlug: string;
  conditionLabel: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ resultMessage: string; recommendVisit: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/v1/intake/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conditionSlug,
        utm: Object.fromEntries(
          ["source", "medium", "campaign"]
            .map((k) => [k, new URLSearchParams(window.location.search).get(`utm_${k}`)])
            .filter(([, v]) => v),
        ),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        setQuestionnaire(data.questionnaire);
        setPhase("active");
      })
      .catch(() => setPhase("error"));
  }, [conditionSlug]);

  const question = questionnaire?.questions[index];
  const progress = questionnaire
    ? Math.round((index / questionnaire.questions.length) * 100)
    : 0;

  async function choose(optionId: string) {
    if (!questionnaire || !question || phase !== "active") return;
    setSelections((s) => ({ ...s, [question.id]: optionId }));

    const res = await fetch("/api/v1/intake/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionnaireSlug: questionnaire.slug,
        questionnaireVersion: questionnaire.version,
        questionId: question.id,
        optionId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.crisis) {
      router.push("/crisis");
      return;
    }

    // Brief settle before auto-advance (docs/07: 150ms — fast, never jarring).
    await new Promise((r) => setTimeout(r, 150));
    if (index + 1 < questionnaire.questions.length) {
      setIndex(index + 1);
    } else {
      setPhase("submitting");
      const complete = await fetch("/api/v1/intake/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaireSlug: questionnaire.slug,
          questionnaireVersion: questionnaire.version,
        }),
      });
      const completeData = await complete.json().catch(() => null);
      if (completeData?.crisis) {
        router.push("/crisis");
        return;
      }
      if (completeData?.ok) {
        setResult(completeData);
        setPhase("done");
      } else {
        setPhase("error");
      }
    }
  }

  // Keyboard: digits select options.
  const optionCount = question?.options.length ?? 0;
  useMemo(() => optionCount, [optionCount]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!question) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.options.length) {
        void choose(question.options[n - 1]!.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, phase]);

  if (phase === "loading") {
    return <p className="mt-24 text-center text-ink-soft">Preparing your check-in…</p>;
  }
  if (phase === "error") {
    return (
      <Card className="mt-24 text-center">
        <p className="mb-4">Something went wrong loading the questionnaire.</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </Card>
    );
  }
  if (phase === "done" && result) {
    return (
      <div className="mt-16 flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Thanks for sharing.</h1>
        <p className="max-w-md text-lg text-ink-soft">{result.resultMessage}</p>
        <Button size="lg" onClick={() => router.push("/signup")}>
          Create your account
        </Button>
        <p className="text-sm text-ink-soft">
          Your answers carry over — a provider reviews them before your first visit.
        </p>
      </div>
    );
  }
  if (!question || !questionnaire) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-ink-soft">
          <span>{conditionLabel} check-in</span>
          <span>
            {index + 1} of {questionnaire.questions.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/5">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {question.helpText ? (
        <p className="text-sm text-ink-soft">{question.helpText}</p>
      ) : null}
      <h1 className="text-2xl font-semibold leading-snug tracking-tight">
        {question.prompt}
      </h1>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label={question.prompt}>
        {question.options.map((option, i) => (
          <button
            key={option.id}
            role="radio"
            aria-checked={selections[question.id] === option.id}
            onClick={() => choose(option.id)}
            className={cn(
              "min-h-[56px] rounded-lg border px-5 py-4 text-left text-base font-medium",
              "transition-all duration-150 ease-spring active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
              selections[question.id] === option.id
                ? "border-brand bg-brand-tint text-brand"
                : "border-ink/10 bg-surface hover:border-ink/20",
            )}
          >
            <span className="mr-3 inline-flex size-6 items-center justify-center rounded-full bg-ink/5 text-xs text-ink-soft">
              {i + 1}
            </span>
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={index === 0 || phase !== "active"}
          onClick={() => setIndex(Math.max(0, index - 1))}
        >
          ← Back
        </Button>
        {phase === "submitting" ? (
          <span className="text-sm text-ink-soft">Reviewing your answers…</span>
        ) : null}
      </div>
    </div>
  );
}
