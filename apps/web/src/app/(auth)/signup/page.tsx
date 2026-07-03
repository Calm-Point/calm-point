"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, CardTitle, Field } from "@calm-point/ui";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [ageAttestation, setAgeAttestation] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setLoading(true);
    try {
      const intakeSessionToken =
        document.cookie.match(/(?:^|; )cp_intake=([^;]+)/)?.[1];
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ageAttestation,
          intakeSessionToken: intakeSessionToken
            ? decodeURIComponent(intakeSessionToken)
            : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.details) {
          setErrors(
            Object.fromEntries(
              Object.entries(data.details as Record<string, string[]>).map(
                ([k, v]) => [k, v[0] ?? "Invalid"],
              ),
            ),
          );
        }
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      router.push("/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardTitle className="mb-1">Create your account</CardTitle>
        <p className="mb-6 text-sm text-ink-soft">
          A few details and you&apos;re in. Your information is private and protected.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              autoComplete="given-name"
              required
              value={form.firstName}
              onChange={set("firstName")}
              error={errors.firstName}
            />
            <Field
              label="Last name"
              autoComplete="family-name"
              required
              value={form.lastName}
              onChange={set("lastName")}
              error={errors.lastName}
            />
          </div>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set("email")}
            error={errors.email}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            hint="At least 12 characters."
            value={form.password}
            onChange={set("password")}
            error={errors.password}
          />
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              required
              checked={ageAttestation}
              onChange={(e) => setAgeAttestation(e.target.checked)}
              className="mt-0.5 size-4 accent-[rgb(var(--cp-brand))]"
            />
            <span>
              I confirm I am 18 or older and agree to the{" "}
              <a href="/legal/terms" className="underline">Terms</a> and{" "}
              <a href="/legal/privacy" className="underline">Privacy Policy</a>.
            </span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-brand underline">
            Sign in
          </a>
        </p>
      </Card>
    </main>
  );
}
