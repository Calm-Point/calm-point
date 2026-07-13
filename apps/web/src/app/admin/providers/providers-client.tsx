"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Skeleton } from "@calm-point/ui";

interface License {
  state: string;
  verified: boolean;
  expiresAt: string;
}
interface AdminProvider {
  id: string;
  name: string;
  email: string;
  credentials: string;
  specialties: string[];
  acceptingNew: boolean;
  licenses: License[];
  credentialed: boolean;
}

const DAY_MS = 86_400_000;

function licenseStatus(l: License): { label: string; tone: "positive" | "warn" | "danger" } {
  const daysToExpiry = (new Date(l.expiresAt).getTime() - Date.now()) / DAY_MS;
  if (daysToExpiry < 0) return { label: `${l.state} expired`, tone: "danger" };
  if (!l.verified) return { label: `${l.state} unverified`, tone: "warn" };
  if (daysToExpiry < 60) return { label: `${l.state} expires soon`, tone: "warn" };
  return { label: `${l.state} verified`, tone: "positive" };
}

function genTempPassword(): string {
  return `Calm-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}!A1`;
}

export function ProvidersClient() {
  const [providers, setProviders] = useState<AdminProvider[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const load = useCallback(() => {
    fetch("/api/v1/admin/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, []);
  useEffect(load, [load]);

  async function credential(providerId: string) {
    setBusyId(providerId);
    setMessage(null);
    const res = await fetch(`/api/v1/admin/providers/${providerId}/credential`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Licenses verified — provider credentialed." : (data.error ?? "Failed."));
    setBusyId(null);
    load();
  }

  async function invite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setMessage(null);
    const form = new FormData(formEl);
    const tempPassword = genTempPassword();
    const payload = {
      email: String(form.get("email") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      credentials: String(form.get("credentials") ?? ""),
      specialties: String(form.get("specialties") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      npi: String(form.get("npi") ?? "") || undefined,
      tempPassword,
      licenses: form.get("licenseState")
        ? [
            {
              state: String(form.get("licenseState")),
              licenseNumber: String(form.get("licenseNumber") ?? ""),
              licenseType: String(form.get("credentials") ?? ""),
              expiresAt: String(form.get("licenseExpiresAt") ?? ""),
            },
          ]
        : [],
    };
    const res = await fetch("/api/v1/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`Provider onboarded — temporary password: ${tempPassword} (share securely; invite email sent).`);
      setShowInvite(false);
      formEl.reset();
    } else {
      setMessage(data.error ?? "Failed to onboard provider.");
    }
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Credentialing gates a provider from seeing patients until their license(s) are verified.
        </p>
        <Button size="sm" onClick={() => setShowInvite((v) => !v)}>
          {showInvite ? "Cancel" : "Onboard provider"}
        </Button>
      </div>

      {showInvite ? (
        <Card className="p-5">
          <form onSubmit={invite} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" name="firstName" required />
              <Field label="Last name" name="lastName" required />
            </div>
            <Field label="Email" name="email" type="email" required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Credentials" name="credentials" placeholder="PMHNP-BC" required />
              <Field label="NPI (optional)" name="npi" />
            </div>
            <Field label="Specialties (comma-separated)" name="specialties" placeholder="anxiety, adhd, depression" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Initial license (optional — can be added later)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="State" name="licenseState" placeholder="NY" maxLength={2} />
              <Field label="License #" name="licenseNumber" />
              <Field label="Expires" name="licenseExpiresAt" type="date" />
            </div>
            <Button type="submit">Create account &amp; send invite</Button>
          </form>
        </Card>
      ) : null}

      {message ? (
        <p role="status" className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand">
          {message}
        </p>
      ) : null}

      {providers === null ? (
        <Skeleton className="h-40" />
      ) : providers.length === 0 ? (
        <p className="text-sm text-ink-soft">No providers yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {providers.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {p.name} <span className="text-sm font-normal text-ink-soft">{p.credentials}</span>
                  </p>
                  <p className="text-sm text-ink-soft">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.credentialed ? "positive" : "warn"}>
                    {p.credentialed ? "credentialed" : "pending credentialing"}
                  </Badge>
                  {!p.credentialed && p.licenses.length > 0 ? (
                    <Button size="sm" disabled={busyId === p.id} onClick={() => credential(p.id)}>
                      {busyId === p.id ? "Verifying…" : "Verify licenses"}
                    </Button>
                  ) : null}
                </div>
              </div>
              {p.specialties.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.specialties.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {p.licenses.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {p.licenses.map((l) => {
                    const status = licenseStatus(l);
                    return (
                      <Badge key={l.state} tone={status.tone}>
                        {status.label}
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-ink-soft">No licenses on file yet.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
