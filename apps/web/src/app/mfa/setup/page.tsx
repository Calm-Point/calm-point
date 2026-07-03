"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Button, Card, CardTitle, Field } from "@calm-point/ui";

export default function MfaSetupPage() {
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/mfa/setup", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setOtpauth(data.otpauth);
          setSecret(data.secret);
        } else {
          setError(data.error ?? "Could not start MFA setup.");
        }
      })
      .catch(() => setError("Could not start MFA setup."));
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/mfa/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      setDone(true);
      // JWT still says mfaEnabled=false — force a fresh login.
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardTitle className="mb-1">Set up two-factor authentication</CardTitle>
        <p className="mb-6 text-sm text-ink-soft">
          Provider and admin accounts require an authenticator app. Add the key
          below to your authenticator (1Password, Google Authenticator, Authy),
          then enter the 6-digit code.
        </p>
        {done ? (
          <p className="text-sm font-medium text-positive">
            Two-factor enabled. Signing you out to re-authenticate…
          </p>
        ) : otpauth ? (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div className="rounded-md bg-brand-tint p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand">
                Setup key
              </p>
              <code className="break-all text-sm text-ink">{secret}</code>
            </div>
            <a href={otpauth} className="text-sm text-brand underline">
              Or open directly in your authenticator app
            </a>
            <Field
              label="6-digit code"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={loading} className="w-full">
              Enable two-factor
            </Button>
          </form>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Preparing setup…</p>
        )}
      </Card>
    </main>
  );
}
