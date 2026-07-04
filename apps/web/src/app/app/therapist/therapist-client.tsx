"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, CardTitle, cn } from "@calm-point/ui";

interface Turn {
  who: "you" | "companion";
  text: string;
}

/**
 * AI companion chat (docs/06 §B). Disclosure-first: the user must acknowledge
 * this is AI — not a clinician, not for emergencies — before the first turn.
 * A persistent indicator stays visible during the session.
 */
export function TherapistClient() {
  const [acknowledged, setAcknowledged] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisisMode, setCrisisMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length]);

  async function begin() {
    setError(null);
    const res = await fetch("/api/v1/therapist/start", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't start a session right now.");
      return;
    }
    setSessionId(data.sessionId);
    setAcknowledged(true);
    setTurns([
      {
        who: "companion",
        text: "Hi — I'm glad you're here. This is your space to think out loud, practice skills, or just untangle the day. What's on your mind?",
      },
    ]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !sessionId) return;
    setDraft("");
    setTurns((t) => [...t, { who: "you", text }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/therapist/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setTurns((t) => [...t, { who: "companion", text: data.reply }]);
      if (data.crisisMode) setCrisisMode(true);
    } finally {
      setBusy(false);
    }
  }

  if (!acknowledged) {
    return (
      <Card className="max-w-xl">
        <CardTitle className="mb-3">Before we start</CardTitle>
        <ul className="mb-6 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">I'm an AI companion, not a therapist or doctor.</strong>{" "}
            I can't diagnose anything or advise on medication — your provider does that.
          </li>
          <li>
            <strong className="text-ink">I'm not for emergencies.</strong> If you're in crisis,
            call or text <a href="tel:988" className="underline">988</a> any time, or call 911.
          </li>
          <li>
            What we talk about is private to your account. Session summaries are yours — nothing
            is shared with your care team unless you choose to share it.
          </li>
        </ul>
        {error ? (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button onClick={begin} className="w-full">
          I understand — let's talk
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div
        className={cn(
          "flex items-center justify-between rounded-full px-4 py-2 text-xs font-medium",
          crisisMode ? "bg-danger/10 text-danger" : "bg-brand-tint text-brand",
        )}
      >
        <span>{crisisMode ? "Support resources active — you're not alone" : "AI companion — not a clinician · not for emergencies"}</span>
        <a href="tel:988" className="underline">
          Crisis? 988
        </a>
      </div>

      <Card className="flex min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {turns.map((turn, i) => (
            <div key={i} className={cn("flex", turn.who === "you" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-relaxed",
                  turn.who === "you" ? "bg-brand text-white" : "bg-ink/5 text-ink",
                )}
              >
                {turn.text}
              </div>
            </div>
          ))}
          {busy ? <p className="text-sm text-ink-soft">…</p> : null}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-ink/5 p-4">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say what's true for you right now…"
            aria-label="Your message"
            maxLength={4000}
            className="h-11 flex-1 rounded-full border border-ink/10 bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <Button type="submit" loading={busy} disabled={!draft.trim()}>
            Send
          </Button>
        </form>
      </Card>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
