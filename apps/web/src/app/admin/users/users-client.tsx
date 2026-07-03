"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Skeleton } from "@calm-point/ui";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export function UsersClient() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback((q: string) => {
    fetch(`/api/v1/admin/users?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]));
  }, []);
  useEffect(() => load(""), [load]);

  async function act(userId: string, action: string) {
    setMessage(null);
    const res = await fetch("/api/v1/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Done — recorded in the audit log." : (data.error ?? "Failed."));
    load(query);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search users"
          className="h-11 flex-1 rounded-md border border-ink/10 bg-surface px-3.5"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {message ? (
        <p role="status" className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand">
          {message}
        </p>
      ) : null}
      {users === null ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">
                  {u.firstName} {u.lastName}{" "}
                  <span className="text-sm font-normal text-ink-soft">{u.email}</span>
                </p>
                <div className="mt-1 flex gap-2">
                  <Badge tone="brand">{u.role.toLowerCase()}</Badge>
                  <Badge tone={u.status === "ACTIVE" ? "positive" : "danger"}>
                    {u.status.toLowerCase()}
                  </Badge>
                  {u.role !== "PATIENT" ? (
                    <Badge tone={u.mfaEnabled ? "positive" : "warn"}>
                      {u.mfaEnabled ? "mfa on" : "mfa pending"}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                {u.status === "ACTIVE" ? (
                  <Button variant="danger" size="sm" onClick={() => act(u.id, "suspend")}>
                    Suspend
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => act(u.id, "reactivate")}>
                    Reactivate
                  </Button>
                )}
                {u.mfaEnabled ? (
                  <Button variant="ghost" size="sm" onClick={() => act(u.id, "reset-mfa")}>
                    Reset MFA
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
