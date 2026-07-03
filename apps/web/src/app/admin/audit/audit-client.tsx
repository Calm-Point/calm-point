"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Skeleton } from "@calm-point/ui";

interface AuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  ip: string | null;
  createdAt: string;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

export function AuditClient() {
  const [events, setEvents] = useState<AuditRow[] | null>(null);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (actor) params.set("actor", actor);
    fetch(`/api/v1/admin/audit?${params}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actor]);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action (e.g. note.sign)…"
          aria-label="Filter by action"
          className="h-11 flex-1 rounded-md border border-ink/10 bg-surface px-3.5"
        />
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="Filter by actor email…"
          aria-label="Filter by actor"
          className="h-11 flex-1 rounded-md border border-ink/10 bg-surface px-3.5"
        />
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {events === null ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink/5 bg-surface shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-ink/5 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                    {timeFmt.format(new Date(e.createdAt))}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        e.action.includes("failed") || e.action.includes("safety")
                          ? "danger"
                          : "neutral"
                      }
                    >
                      {e.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{e.actorEmail ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {e.resourceType}
                    {e.resourceId ? `:${e.resourceId.slice(0, 10)}…` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
