"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@calm-point/shared";
import { Button, Card, CardTitle, Field } from "@calm-point/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    dateOfBirth: "",
    stateOfResidence: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    pharmacyName: "",
    pharmacyAddress: "",
  });
  const [consents, setConsents] = useState({ telehealth: false, npp: false });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pharmacyName: form.pharmacyName || undefined,
          pharmacyAddress: form.pharmacyAddress || undefined,
          acceptTelehealthConsent: consents.telehealth,
          acceptNpp: consents.npp,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.details) {
          setErrors(
            Object.fromEntries(
              Object.entries(data.details as Record<string, string[]>).map(([k, v]) => [
                k,
                v[0] ?? "Invalid",
              ]),
            ),
          );
        }
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/app/appointments");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <Card>
        <CardTitle className="mb-1">A few details before your first visit</CardTitle>
        <p className="mb-6 text-sm text-ink-soft">
          Your provider needs this to care for you safely. It stays private and protected.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label="Date of birth"
            type="date"
            required
            value={form.dateOfBirth}
            onChange={set("dateOfBirth")}
            error={errors.dateOfBirth}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium text-ink">
              State of residence
            </label>
            <select
              id="state"
              required
              value={form.stateOfResidence}
              onChange={set("stateOfResidence")}
              className="h-11 rounded-md border border-ink/10 bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option value="">Choose your state…</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-sm text-ink-soft">
              Providers must be licensed in the state where you are during your visit.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Emergency contact name"
              required
              value={form.emergencyContactName}
              onChange={set("emergencyContactName")}
              error={errors.emergencyContactName}
            />
            <Field
              label="Emergency contact phone"
              type="tel"
              required
              value={form.emergencyContactPhone}
              onChange={set("emergencyContactPhone")}
              error={errors.emergencyContactPhone}
            />
          </div>
          <Field
            label="Preferred pharmacy (optional)"
            value={form.pharmacyName}
            onChange={set("pharmacyName")}
          />
          <Field
            label="Pharmacy address (optional)"
            value={form.pharmacyAddress}
            onChange={set("pharmacyAddress")}
          />
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={consents.telehealth}
              onChange={(e) => setConsents((c) => ({ ...c, telehealth: e.target.checked }))}
              className="mt-0.5 size-4 accent-[rgb(var(--cp-brand))]"
            />
            <span>
              I have read and agree to the{" "}
              <a href="/legal/telehealth-consent" target="_blank" className="underline">
                Telehealth Informed Consent
              </a>
              .
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              required
              checked={consents.npp}
              onChange={(e) => setConsents((c) => ({ ...c, npp: e.target.checked }))}
              className="mt-0.5 size-4 accent-[rgb(var(--cp-brand))]"
            />
            <span>
              I acknowledge the{" "}
              <a href="/legal/hipaa-npp" target="_blank" className="underline">
                Notice of Privacy Practices
              </a>
              .
            </span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Continue to booking
          </Button>
        </form>
      </Card>
    </main>
  );
}
