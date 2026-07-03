"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton, cn } from "@calm-point/ui";

interface NoteSummary {
  id: string;
  status: string;
  patientName: string;
  visitDate: string;
  signedAt: string | null;
}
interface NoteDetail extends NoteSummary {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  amendments: Array<{ content: string; createdAt: string }>;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SECTIONS = ["subjective", "objective", "assessment", "plan"] as const;

export function NotesClient() {
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [active, setActive] = useState<NoteDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/v1/notes")
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => setNotes([]));
  }, []);
  useEffect(refresh, [refresh]);

  async function open(noteId: string) {
    const res = await fetch(`/api/v1/notes/${noteId}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.note) setActive(data.note);
  }

  async function save() {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/notes/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjective: active.subjective,
          objective: active.objective,
          assessment: active.assessment,
          plan: active.plan,
        }),
      });
      setMessage(res.ok ? "Draft saved." : "Save failed.");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!active) return;
    setBusy(true);
    setMessage(null);
    try {
      // Persist current edits before signing so the hash covers what's on screen.
      await fetch(`/api/v1/notes/${active.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjective: active.subjective,
          objective: active.objective,
          assessment: active.assessment,
          plan: active.plan,
        }),
      });
      const res = await fetch(`/api/v1/notes/${active.id}/sign`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Note signed and locked.");
        await open(active.id);
        refresh();
      } else {
        setMessage(data.error ?? "Signing failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  const locked = active?.status === "SIGNED" || active?.status === "AMENDED";

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3">
        {notes === null ? (
          <Skeleton className="h-24" />
        ) : notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="AI-drafted notes appear here after each visit."
          />
        ) : (
          notes.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n.id)}
              className={cn(
                "rounded-lg border border-ink/5 bg-surface p-4 text-left shadow-soft transition-all hover:-translate-y-0.5",
                active?.id === n.id && "ring-2 ring-brand",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium">{n.patientName}</p>
                <Badge tone={n.status === "AI_DRAFT" ? "warn" : n.status === "SIGNED" ? "positive" : "brand"}>
                  {n.status.replace("_", " ").toLowerCase()}
                </Badge>
              </div>
              <p className="text-sm text-ink-soft">{dateFmt.format(new Date(n.visitDate))}</p>
            </button>
          ))
        )}
      </div>

      <Card>
        {!active ? (
          <p className="py-16 text-center text-ink-soft">Select a note to review</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{active.patientName}</p>
                <p className="text-sm text-ink-soft">
                  Visit {dateFmt.format(new Date(active.visitDate))}
                  {active.signedAt
                    ? ` · signed ${dateFmt.format(new Date(active.signedAt))}`
                    : " · AI draft — review every section before signing"}
                </p>
              </div>
              {!locked ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" loading={busy} onClick={save}>
                    Save draft
                  </Button>
                  <Button size="sm" loading={busy} onClick={sign}>
                    Sign &amp; lock
                  </Button>
                </div>
              ) : (
                <Badge tone="positive">signed &amp; locked</Badge>
              )}
            </div>
            {message ? (
              <p role="status" className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand">
                {message}
              </p>
            ) : null}
            {SECTIONS.map((section) => (
              <div key={section} className="flex flex-col gap-1.5">
                <label htmlFor={`note-${section}`} className="text-sm font-semibold capitalize">
                  {section}
                </label>
                <textarea
                  id={`note-${section}`}
                  value={active[section]}
                  readOnly={locked}
                  onChange={(e) => setActive({ ...active, [section]: e.target.value })}
                  rows={section === "subjective" ? 6 : 4}
                  className={cn(
                    "rounded-md border border-ink/10 bg-surface p-3 text-sm leading-relaxed",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    locked && "bg-ink/5 text-ink-soft",
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
