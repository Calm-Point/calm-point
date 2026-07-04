"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardTitle, EmptyState, Skeleton } from "@calm-point/ui";

interface Summary {
  id: string;
  visitDate: string;
  providerName: string;
  plan: string | null;
}
interface CheckinPoint {
  completedAt: string;
  totalScore: number | null;
  severity: string | null;
}
interface Checkin {
  slug: string;
  title: string;
  due: boolean;
  history: CheckinPoint[];
}
interface Question {
  id: string;
  prompt: string;
  helpText: string | null;
  options: { id: string; label: string }[];
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function CareClient() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null);
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [active, setActive] = useState<{ slug: string; title: string; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCheckins = useCallback(() => {
    fetch("/api/v1/checkins")
      .then((r) => r.json())
      .then((d) => setCheckins(d.checkins ?? []))
      .catch(() => setCheckins([]));
  }, []);

  useEffect(() => {
    fetch("/api/v1/care/summaries")
      .then((r) => r.json())
      .then((d) => setSummaries(d.summaries ?? []))
      .catch(() => setSummaries([]));
    loadCheckins();
  }, [loadCheckins]);

  async function startCheckin(slug: string) {
    setMessage(null);
    const res = await fetch(`/api/v1/checkins/${slug}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.questionnaire) {
      setActive({ slug, title: data.questionnaire.title, questions: data.questionnaire.questions });
      setAnswers({});
    }
  }

  async function submitCheckin() {
    if (!active) return;
    if (active.questions.some((q) => !answers[q.id])) {
      setMessage("Please answer every question.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/checkins/${active.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: active.questions.map((q) => ({ questionId: q.id, optionId: answers[q.id] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.crisis) {
        window.location.href = "/crisis";
        return;
      }
      if (res.ok) {
        setActive(null);
        setMessage("Thanks for checking in — your provider will see this.");
        loadCheckins();
      } else {
        setMessage(data.error ?? "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (active) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <div>
          <button onClick={() => setActive(null)} className="text-sm text-brand underline">
            ← Back to my care
          </button>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{active.title} check-in</h2>
          <p className="text-sm text-ink-soft">
            {active.questions[0]?.helpText}
          </p>
        </div>
        {active.questions.map((q, i) => (
          <Card key={q.id}>
            <p className="mb-3 font-medium">
              {i + 1}. {q.prompt}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                  className={`min-h-[44px] rounded-md border px-4 py-2.5 text-left text-sm transition-colors ${
                    answers[q.id] === o.id
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-ink/10 bg-surface hover:border-ink/20"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Card>
        ))}
        {message ? <p className="text-sm text-danger">{message}</p> : null}
        <Button onClick={submitCheckin} loading={busy} size="lg">
          Submit check-in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {message ? (
        <p role="status" className="rounded-md bg-brand-tint px-4 py-3 text-sm font-medium text-brand">
          {message}
        </p>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Check-ins</h2>
        {checkins === null ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="flex flex-col gap-4">
            {checkins.map((c) => (
              <Card key={c.slug}>
                <div className="mb-2 flex items-center justify-between">
                  <CardTitle className="text-lg">{c.title}</CardTitle>
                  {c.due ? (
                    <Button size="sm" onClick={() => startCheckin(c.slug)}>
                      Check in now
                    </Button>
                  ) : (
                    <Badge tone="positive">up to date</Badge>
                  )}
                </div>
                {c.history.length > 0 ? (
                  <ScoreTrend history={c.history} />
                ) : (
                  <p className="text-sm text-ink-soft">
                    Your first check-in creates a trend your provider can follow over time.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Visit summaries</h2>
        {summaries === null ? (
          <Skeleton className="h-32" />
        ) : summaries.length === 0 ? (
          <EmptyState
            title="Your visit summaries will appear here"
            description="After each visit, your provider signs a summary of your plan."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {summaries.map((s) => (
              <Card key={s.id}>
                <CardTitle className="mb-1 text-lg">{dateFmt.format(new Date(s.visitDate))}</CardTitle>
                <p className="mb-4 text-sm text-ink-soft">with {s.providerName}</p>
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand">
                  Your plan
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{s.plan}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Minimal inline sparkline — bars sized to score, labeled by date. */
function ScoreTrend({ history }: { history: CheckinPoint[] }) {
  const max = Math.max(...history.map((h) => h.totalScore ?? 0), 1);
  const latest = history[history.length - 1];
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: 60 }} aria-hidden>
        {history.map((h) => (
          <div
            key={h.completedAt}
            className="flex-1 rounded-t bg-brand/70"
            style={{ height: `${Math.max(6, ((h.totalScore ?? 0) / max) * 60)}px` }}
            title={`${shortFmt.format(new Date(h.completedAt))}: ${h.totalScore}`}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Latest: <span className="font-medium text-ink">{latest?.totalScore}</span>
        {latest?.severity ? ` · ${latest.severity.replace("-", " ")}` : ""} (
        {shortFmt.format(new Date(latest!.completedAt))})
      </p>
    </div>
  );
}
