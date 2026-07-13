"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardTitle, EmptyState, Skeleton } from "@calm-point/ui";

interface Chart {
  patient: {
    name: string;
    pronouns: string | null;
    ageYears: number | null;
    stateOfResidence: string | null;
  };
  scores: Array<{
    title: string;
    slug: string;
    totalScore: number | null;
    severity: string | null;
    completedAt: string;
    flaggedSafety: boolean;
  }>;
  visits: Array<{ id: string; kind: string; status: string; startsAt: string }>;
  notes: Array<{ id: string; status: string; signedAt: string | null; createdAt: string }>;
  medications: Array<{ id: string; medicationName: string; directions: string | null; status: string }>;
  threadId: string | null;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function ProviderPatientChartClient({ patientId }: { patientId: string }) {
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/provider/patients/${patientId}/chart`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Could not load chart");
        setChart(data as Chart);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load chart"));
  }, [patientId]);

  if (error) {
    return (
      <EmptyState title="Can't open this chart" description={error} />
    );
  }

  if (!chart) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-3" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{chart.patient.name}</CardTitle>
            <p className="text-sm text-ink-soft">
              {[
                chart.patient.ageYears != null ? `${chart.patient.ageYears} yo` : null,
                chart.patient.pronouns,
                chart.patient.stateOfResidence,
              ]
                .filter(Boolean)
                .join(" · ") || "No demographics on file"}
            </p>
          </div>
          {chart.threadId ? (
            <a
              href="/provider/inbox"
              className="rounded-full bg-brand-tint px-4 py-1.5 text-sm font-medium text-brand"
            >
              Message patient
            </a>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle className="mb-3 text-base">Score trends</CardTitle>
          {chart.scores.length === 0 ? (
            <p className="text-sm text-ink-soft">No completed screeners yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {chart.scores.map((s) => (
                <div key={s.slug} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-ink-soft">{dateFmt.format(new Date(s.completedAt))}</p>
                  </div>
                  <Badge tone={s.flaggedSafety ? "danger" : "brand"}>
                    {s.totalScore ?? "—"}
                    {s.severity ? ` · ${s.severity}` : ""}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-3 text-base">Visit history</CardTitle>
          {chart.visits.length === 0 ? (
            <p className="text-sm text-ink-soft">No visits yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {chart.visits.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{dateFmt.format(new Date(v.startsAt))}</p>
                    <p className="text-xs text-ink-soft">{v.kind === "INITIAL" ? "First visit" : "Follow-up"}</p>
                  </div>
                  <Badge tone={v.status === "COMPLETED" ? "positive" : "neutral"}>
                    {v.status.replace("_", " ").toLowerCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-3 text-base">Notes</CardTitle>
          {chart.notes.length === 0 ? (
            <p className="text-sm text-ink-soft">No notes yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {chart.notes.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2">
                  <p className="text-sm">{dateFmt.format(new Date(n.createdAt))}</p>
                  <Badge tone={n.status === "SIGNED" || n.status === "AMENDED" ? "positive" : "warn"}>
                    {n.status.replace("_", " ").toLowerCase()}
                  </Badge>
                </div>
              ))}
              <a href="/provider/notes" className="text-sm font-medium text-brand underline">
                Open in notes queue
              </a>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3 text-base">Medications</CardTitle>
        {chart.medications.length === 0 ? (
          <p className="text-sm text-ink-soft">No active medications on file.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {chart.medications.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium">{m.medicationName}</span>
                  {m.directions ? <span className="text-ink-soft"> — {m.directions}</span> : null}
                </div>
                <Badge tone="neutral">{m.status.toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
