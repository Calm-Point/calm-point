"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardTitle, GlassPanel, Badge } from "@calm-point/ui";

interface JoinInfo {
  vendor: string;
  sessionId: string;
  token: string;
  extra?: Record<string, string>;
}

/**
 * Visit surface. With a real vendor configured the SDK mounts into the stage
 * div (Zoom Video SDK / Daily prebuilt — wired when vendor keys exist). The
 * dev vendor renders a stand-in stage so the full clinical lifecycle —
 * consent → transcript → complete → AI draft — is exercisable everywhere.
 */
export function VisitRoom({
  appointmentId,
  isProvider,
  scribeConsented: initialConsent,
}: {
  appointmentId: string;
  isProvider: boolean;
  scribeConsented: boolean;
}) {
  const router = useRouter();
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const [consented, setConsented] = useState(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState("");
  const [sentLines, setSentLines] = useState<string[]>([]);

  async function doJoin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/visits/${appointmentId}/join`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not join the visit.");
        return;
      }
      setJoin(data.join);
    } finally {
      setBusy(false);
    }
  }

  async function consent() {
    const res = await fetch(`/api/v1/visits/${appointmentId}/consent`, { method: "POST" });
    if (res.ok) setConsented(true);
  }

  async function sendLine(e: React.FormEvent) {
    e.preventDefault();
    if (!line.trim()) return;
    const res = await fetch(`/api/v1/visits/${appointmentId}/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: [{ speaker: isProvider ? "provider" : "patient", text: line.trim() }],
      }),
    });
    if (res.ok) {
      setSentLines((l) => [...l, line.trim()]);
      setLine("");
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/visits/${appointmentId}/complete`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(data.noteId ? `/provider/notes` : "/provider");
        router.refresh();
      } else {
        setError(data.error ?? "Could not complete the visit.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      {!join ? (
        <Card className="text-center">
          <CardTitle className="mb-2">Ready for your visit?</CardTitle>
          <p className="mb-6 text-sm text-ink-soft">
            Check that your camera and microphone are working, find a quiet
            private space, and join when you&apos;re ready.
          </p>
          {error ? (
            <p role="alert" className="mb-4 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button size="lg" loading={busy} onClick={doJoin} className="w-full">
            {isProvider ? "Start visit" : "Join visit"}
          </Button>
        </Card>
      ) : (
        <>
          <GlassPanel className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
            <Badge tone="positive">connected · {join.vendor}</Badge>
            <p className="text-lg font-medium">Visit in progress</p>
            {join.vendor === "dev" ? (
              <p className="max-w-sm text-sm text-ink-soft">
                Development video stage — the real video tiles mount here once
                a vendor (Zoom/Daily) is configured with a BAA.
              </p>
            ) : (
              <div id="video-stage" className="h-full w-full" />
            )}
          </GlassPanel>

          <Card>
            <CardTitle className="mb-2 text-lg">AI visit notes</CardTitle>
            {!consented ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-soft">
                  With everyone&apos;s permission, Calm Point can transcribe this
                  visit so your provider can focus on you instead of typing.
                  Nothing is recorded without consent.
                </p>
                <Button variant="secondary" onClick={consent}>
                  I consent to transcription
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Badge tone="positive" className="self-start">
                  transcription consented
                </Badge>
                {join.vendor === "dev" ? (
                  <form onSubmit={sendLine} className="flex gap-2">
                    <input
                      value={line}
                      onChange={(e) => setLine(e.target.value)}
                      placeholder="Simulate dictation (dev only)…"
                      aria-label="Transcript line"
                      className="h-10 flex-1 rounded-md border border-ink/10 bg-surface px-3 text-sm"
                    />
                    <Button type="submit" size="sm" variant="secondary">
                      Add
                    </Button>
                  </form>
                ) : null}
                {sentLines.length > 0 ? (
                  <ul className="space-y-1 text-sm text-ink-soft">
                    {sentLines.map((sent, i) => (
                      <li key={i}>· {sent}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </Card>

          {isProvider ? (
            <Button variant="danger" loading={busy} onClick={complete}>
              End visit &amp; draft note
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
