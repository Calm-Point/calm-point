"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Card, CardTitle, Field } from "@calm-point/ui";
import { Wordmark } from "@/components/brand";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!mfaStep) {
        const res = await fetch("/api/v1/auth/precheck", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (!data.ok) {
          setError("That email and password didn't match.");
          return;
        }
        if (data.mfaRequired) {
          setMfaStep(true);
          return;
        }
      }
      // Only include totpCode when present — signIn serializes the options
      // with URLSearchParams, which turns undefined into the string "undefined".
      const result = await signIn("credentials", {
        email,
        password,
        ...(totpCode ? { totpCode } : {}),
        redirect: false,
      });
      if (result?.error) {
        setError(mfaStep ? "That code didn't match." : "Sign-in failed. Try again.");
        return;
      }
      router.push(params.get("next") ?? "/app");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardTitle className="mb-1">Welcome back</CardTitle>
      <p className="mb-6 text-sm text-ink-soft">Sign in to your Calm Point account.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!mfaStep ? (
          <>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <Field
            label="Authenticator code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
            required
            hint="Enter the 6-digit code from your authenticator app."
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
          />
        )}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          {mfaStep ? "Verify" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        New to Calm Point?{" "}
        <a href="/signup" className="font-medium text-brand underline">
          Create an account
        </a>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <a href="/" aria-label="Calm Point home">
        <Wordmark />
      </a>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
