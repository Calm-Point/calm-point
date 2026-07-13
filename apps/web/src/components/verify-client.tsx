"use client";

import { useState } from "react";
import { Badge, Button, Card, Field } from "@calm-point/ui";

/**
 * Identity + insurance + consent capture (docs/10 §1.4): government-ID photo,
 * insurance details with card photos (or self-pay) plus an optional real-time
 * eligibility check, and versioned consent acceptance. Images travel as data
 * URLs to the capture APIs, which store encrypted objects by opaque key.
 */

const CONSENT_VERSION = "2026-07";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function VerifyClient() {
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfPay, setSelfPay] = useState(false);
  const [payer, setPayer] = useState("");
  const [memberId, setMemberId] = useState("");
  const [group, setGroup] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [eligibility, setEligibility] = useState<string | null>(null);
  const [consents, setConsents] = useState({ telehealth: false, hipaa: false, terms: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function checkEligibility() {
    setError(null);
    if (!payer.trim() || !memberId.trim()) {
      setError("Enter your carrier and member ID first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/intake/eligibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payerName: payer.trim(), memberId: memberId.trim() }),
      });
      const data = (await res.json()) as { status?: string; copayCents?: number | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Eligibility check failed");
      setEligibility(
        data.status === "ACTIVE"
          ? `Coverage active${data.copayCents != null ? ` · est. copay $${(data.copayCents / 100).toFixed(2)}` : ""}`
          : `Coverage ${String(data.status).toLowerCase()} — you can continue self-pay`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eligibility check failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idFile) return setError("Please add a photo of your ID.");
    if (!selfPay && (!payer.trim() || !memberId.trim())) {
      return setError("Enter your insurance details, or choose self-pay.");
    }
    if (!consents.telehealth || !consents.hipaa || !consents.terms) {
      return setError("Please accept all three consents.");
    }
    setBusy(true);
    try {
      const idImage = await fileToDataUrl(idFile);
      const idRes = await fetch("/api/v1/intake/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "drivers_license", image: idImage }),
      });
      if (!idRes.ok) throw new Error((await idRes.json()).error ?? "ID upload failed");

      const insurancePayload: Record<string, unknown> = selfPay
        ? { selfPay: true }
        : {
            payerName: payer.trim(),
            memberId: memberId.trim(),
            groupNumber: group.trim() || undefined,
            frontImage: front ? await fileToDataUrl(front) : undefined,
            backImage: back ? await fileToDataUrl(back) : undefined,
          };
      const insRes = await fetch("/api/v1/intake/insurance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(insurancePayload),
      });
      if (!insRes.ok) throw new Error((await insRes.json()).error ?? "Insurance capture failed");

      const conRes = await fetch("/api/v1/intake/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consents: [
            { docKey: "telehealth-consent", docVersion: CONSENT_VERSION },
            { docKey: "hipaa-npp", docVersion: CONSENT_VERSION },
            { docKey: "terms", docVersion: CONSENT_VERSION },
          ],
        }),
      });
      if (!conRes.ok) throw new Error((await conRes.json()).error ?? "Consent recording failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="max-w-xl space-y-3 text-center">
        <Badge>Verified</Badge>
        <h2 className="text-xl font-semibold">You&apos;re ready to schedule.</h2>
        <p className="text-sm text-slate-600">
          Your documents are encrypted and shared only with your care team.
        </p>
        <Button onClick={() => (window.location.href = "/app/appointments")}>
          Find a time
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
      <Card className="space-y-3">
        <h2 className="font-semibold">Photo ID</h2>
        <p className="text-sm text-slate-600">Driver&apos;s license, state ID, or passport.</p>
        <input
          type="file"
          accept="image/*"
          aria-label="ID photo"
          onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        {idFile ? <Badge>{idFile.name}</Badge> : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Insurance</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selfPay} onChange={(e) => setSelfPay(e.target.checked)} />
          I&apos;ll self-pay (no insurance)
        </label>
        {!selfPay ? (
          <div className="space-y-3">
            <Field label="Insurance carrier" name="payer" value={payer} onChange={(e) => setPayer(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Member ID" name="memberId" value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              <Field label="Group # (optional)" name="group" value={group} onChange={(e) => setGroup(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="font-medium">Card front</span>
                <input type="file" accept="image/*" onChange={(e) => setFront(e.target.files?.[0] ?? null)} className="block w-full" />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Card back</span>
                <input type="file" accept="image/*" onChange={(e) => setBack(e.target.files?.[0] ?? null)} className="block w-full" />
              </label>
            </div>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void checkEligibility()}>
              Check coverage now
            </Button>
            {eligibility ? <p className="text-sm text-emerald-800">{eligibility}</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">Consent</h2>
        {(
          [
            ["telehealth", "I agree to the Telehealth Informed Consent."],
            ["hipaa", "I acknowledge the Notice of Privacy Practices (HIPAA)."],
            ["terms", "I agree to the Terms of Service and Privacy Policy."],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consents[key]}
              onChange={(e) => setConsents({ ...consents, [key]: e.target.checked })}
              className="mt-0.5"
            />
            {label}
          </label>
        ))}
      </Card>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Submitting…" : "Submit & schedule"}
      </Button>
    </form>
  );
}
