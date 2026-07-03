"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, EmptyState, Skeleton } from "@calm-point/ui";

interface Summary {
  id: string;
  visitDate: string;
  providerName: string;
  plan: string | null;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function CareClient() {
  const [summaries, setSummaries] = useState<Summary[] | null>(null);

  useEffect(() => {
    fetch("/api/v1/care/summaries")
      .then((r) => r.json())
      .then((d) => setSummaries(d.summaries ?? []))
      .catch(() => setSummaries([]));
  }, []);

  if (summaries === null) return <Skeleton className="h-40" />;
  if (summaries.length === 0) {
    return (
      <EmptyState
        title="Your visit summaries will appear here"
        description="After each visit, your provider signs a summary of your plan — you'll always know what's next."
      />
    );
  }
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {summaries.map((s) => (
        <Card key={s.id}>
          <CardTitle className="mb-1 text-lg">
            {dateFmt.format(new Date(s.visitDate))}
          </CardTitle>
          <p className="mb-4 text-sm text-ink-soft">with {s.providerName}</p>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand">
            Your plan
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{s.plan}</p>
        </Card>
      ))}
    </div>
  );
}
