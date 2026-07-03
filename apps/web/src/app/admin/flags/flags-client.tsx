"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Skeleton } from "@calm-point/ui";

interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  gated: boolean;
}

export function FlagsClient() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signOffFor, setSignOffFor] = useState<string | null>(null);
  const [signOffNote, setSignOffNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/v1/admin/flags")
      .then((r) => r.json())
      .then((d) => setFlags(d.flags ?? []))
      .catch(() => setFlags([]));
  }, []);
  useEffect(load, [load]);

  async function toggle(flag: Flag, note?: string) {
    setMessage(null);
    const res = await fetch("/api/v1/admin/flags", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: flag.key,
        enabled: !flag.enabled,
        signOffNote: note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 428) {
      setSignOffFor(flag.key);
      setMessage(data.error);
      return;
    }
    setMessage(res.ok ? "Updated — recorded in the audit log." : (data.error ?? "Failed."));
    setSignOffFor(null);
    setSignOffNote("");
    load();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {message ? (
        <p role="status" className="rounded-md bg-warn/10 px-3 py-2 text-sm text-warn">
          {message}
        </p>
      ) : null}
      {flags === null ? (
        <Skeleton className="h-40" />
      ) : (
        flags.map((flag) => (
          <Card key={flag.key} data-flag={flag.key} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold">{flag.key}</p>
                <p className="text-sm text-ink-soft">{flag.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {flag.gated ? <Badge tone="warn">sign-off gated</Badge> : null}
                <Badge tone={flag.enabled ? "positive" : "neutral"}>
                  {flag.enabled ? "on" : "off"}
                </Badge>
                <Button
                  size="sm"
                  variant={flag.enabled ? "danger" : "primary"}
                  onClick={() => toggle(flag)}
                >
                  {flag.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
            {signOffFor === flag.key ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  toggle(flag, signOffNote);
                }}
                className="flex gap-2"
              >
                <input
                  value={signOffNote}
                  onChange={(e) => setSignOffNote(e.target.value)}
                  placeholder="Who approved this? (e.g. 'Clinical: Dr. X 7/3; Legal: Y 7/2')"
                  aria-label="Sign-off note"
                  required
                  className="h-10 flex-1 rounded-md border border-warn/40 bg-surface px-3 text-sm"
                />
                <Button type="submit" size="sm">
                  Enable with sign-off
                </Button>
              </form>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}
