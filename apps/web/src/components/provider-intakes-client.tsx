"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, Skeleton } from "@calm-point/ui";

/**
 * Provider intake inbox: the latest AI decision-support analysis per patient in
 * an active care relationship (docs/10 §1.3). The provider is the author of
 * record — the analysis suggests areas to explore, never a diagnosis.
 */

interface RiskFlag {
  severity: "critical" | "high" | "medium";
  label: string;
  detail: string;
}

interface InboxItem {
  id: string;
  patientId: string;
  patientName: string;
  status: string;
  riskFlags: RiskFlag[] | null;
  createdAt: string;
}

interface Detail {
  summary: string;
  riskFlags: RiskFlag[] | null;
  scores: Array<{ title: string; score: number; max: number; severity: string | null }> | null;
}

const FLAG_STYLES: Record<RiskFlag["severity"], string> = {
  critical: "border-l-4 border-danger",
  high: "border-l-4 border-warn",
  medium: "border-l-4 border-brand",
};

export function ProviderIntakesClient() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/provider/analyses");
      if (res.ok) setItems(((await res.json()) as { analyses: InboxItem[] }).analyses);
      else setItems([]);
    })();
  }, []);

  async function open(item: InboxItem) {
    setSelected(item);
    setDetail(null);
    const res = await fetch(`/api/v1/intake/analyze?patientId=${encodeURIComponent(item.patientId)}`);
    if (res.ok) {
      const data = (await res.json()) as { analysis: Detail | null };
      setDetail(data.analysis);
    }
  }

  if (items === null) {
    return (
      <Card className="max-w-2xl">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-3 h-16 w-full" />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No pending intake analyses"
        description="When a patient in your care completes the intake battery, the decision-support summary appears here for review before the visit."
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {items.map((item) => {
        const critical = (item.riskFlags ?? []).some((f) => f.severity === "critical");
        const high = (item.riskFlags ?? []).some((f) => f.severity === "high");
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => void open(item)}
            className="flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-surface px-5 py-4 text-left shadow-soft hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
          >
            <div>
              <p className="font-semibold">{item.patientName}</p>
              <p className="text-sm text-ink-soft">
                Intake analysis · {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge>{critical ? "urgent" : high ? "review" : "new"}</Badge>
          </button>
        );
      })}

      {selected ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">Reviewing · {selected.patientName}</h2>
          {detail ? (
            <>
              {(detail.riskFlags ?? []).map((flag) => (
                <div key={flag.label} className={`rounded-xl bg-ink/5 px-4 py-3 text-sm ${FLAG_STYLES[flag.severity]}`}>
                  <p className="font-medium">{flag.label}</p>
                  <p className="text-ink-soft">{flag.detail}</p>
                </div>
              ))}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  AI pre-visit summary — decision support only; you diagnose and sign
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{detail.summary}</p>
              </div>
              {detail.scores?.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Screening profile</p>
                  {detail.scores.map((s) => (
                    <div key={s.title} className="flex items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-sm">
                      <span>{s.title}</span>
                      <span className="tabular-nums text-ink-soft">
                        {s.score}/{s.max}
                        {s.severity ? ` · ${s.severity}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      ) : null}
    </div>
  );
}
