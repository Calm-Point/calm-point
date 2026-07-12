/**
 * Email (Resend) + SMS (Twilio) delivery (docs/10 §1.7). All bodies are
 * PHI-FREE — no condition, diagnosis, or clinical detail ever leaves in an
 * email/SMS; the details live behind authentication. When a vendor isn't
 * configured, sends are skipped (dev logs a mock line) so IN_APP delivery and
 * the rest of the flow keep working; callers that require delivery check the
 * result. 🚦 BAA required before real PHI (names count as identifiers).
 */

export interface SendResult {
  sent: boolean;
  mock: boolean;
  id?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

const isProd = () => process.env.NODE_ENV === "production";

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  if (!emailConfigured()) {
    if (!isProd()) console.log(`[email:mock] → ${input.to} :: ${input.subject}`);
    return { sent: false, mock: !isProd() };
  }
  const from = process.env.EMAIL_FROM ?? "Calm Point <care@calmpoint.example>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status})`);
  }
  const data = (await res.json()) as { id?: string };
  return { sent: true, mock: false, id: data.id };
}

export async function sendSms(input: { to: string; body: string }): Promise<SendResult> {
  if (!smsConfigured()) {
    if (!isProd()) console.log(`[sms:mock] → ${input.to} :: ${input.body}`);
    return { sent: false, mock: !isProd() };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const form = new URLSearchParams({
    To: input.to,
    From: process.env.TWILIO_FROM_NUMBER!,
    Body: input.body,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) {
    throw new Error(`Twilio send failed (${res.status})`);
  }
  const data = (await res.json()) as { sid?: string };
  return { sent: true, mock: false, id: data.sid };
}

/** Base URL for links in messages (never contains PHI). */
export function appBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://app.calmpoint.example"
  ).replace(/\/$/, "");
}

// ── Shared template shell ────────────────────────────────────────────────────

function shell(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1c1e26">
  <div style="padding:24px 4px"><span style="color:#3e6b5c;font-weight:700;font-size:18px">Calm Point</span></div>
  <div style="background:#fff;border:1px solid #eee;border-radius:16px;padding:28px">${bodyHtml}</div>
  <p style="color:#8b8f9a;font-size:12px;line-height:1.5;padding:16px 4px">
    Calm Point is a telehealth platform. This message never includes clinical details — sign in to view them.
    Not for emergencies; in crisis, call or text <b>988</b>.
  </p>
</div>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#3e6b5c;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;margin-top:14px">${label}</a>`;
}

// ── Domain messages (PHI-free) ───────────────────────────────────────────────

export async function sendVerificationEmail(to: string, token: string): Promise<SendResult> {
  const link = `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: "Verify your Calm Point email",
    html: shell(
      `<h2 style="margin:0 0 8px;font-size:20px">Confirm your email</h2>
       <p style="color:#565a67;line-height:1.6">Tap below to verify your email and secure your account.</p>${btn(link, "Verify email")}`,
    ),
    text: `Verify your Calm Point email: ${link}`,
  });
}

export async function sendAppointmentConfirmation(params: {
  email?: string | null;
  phone?: string | null;
  whenLabel: string; // e.g. "Mon, Jul 13, 9:00 AM" — no PHI
  appointmentId: string;
}): Promise<void> {
  const link = `${appBaseUrl()}/app/appointments`;
  const results: Promise<unknown>[] = [];
  if (params.email) {
    results.push(
      sendEmail({
        to: params.email,
        subject: "Your Calm Point visit is booked",
        html: shell(
          `<h2 style="margin:0 0 8px;font-size:20px">Visit confirmed</h2>
           <p style="color:#565a67;line-height:1.6">Your video visit is scheduled for <b>${params.whenLabel}</b>. We'll remind you before it starts.</p>${btn(link, "View appointment")}`,
        ),
        text: `Your Calm Point visit is booked for ${params.whenLabel}. ${link}`,
      }).catch((e) => console.error("[notify] confirmation email failed", e)),
    );
  }
  if (params.phone) {
    results.push(
      sendSms({
        to: params.phone,
        body: `Calm Point: your visit is booked for ${params.whenLabel}. Details: ${link}`,
      }).catch((e) => console.error("[notify] confirmation sms failed", e)),
    );
  }
  await Promise.all(results);
}

export async function sendVisitReminder(params: {
  email?: string | null;
  phone?: string | null;
  minutesLabel: string; // "in 24 hours" | "in 1 hour" | "in 5 minutes"
  appointmentId: string;
}): Promise<void> {
  const join = `${appBaseUrl()}/app/visit/${params.appointmentId}`;
  const results: Promise<unknown>[] = [];
  if (params.email) {
    results.push(
      sendEmail({
        to: params.email,
        subject: `Your Calm Point visit is ${params.minutesLabel}`,
        html: shell(
          `<h2 style="margin:0 0 8px;font-size:20px">Visit ${params.minutesLabel}</h2>
           <p style="color:#565a67;line-height:1.6">Find a quiet, private space. When it's time, tap to join your secure video visit.</p>${btn(join, "Join visit")}`,
        ),
        text: `Your Calm Point visit is ${params.minutesLabel}. Join: ${join}`,
      }).catch((e) => console.error("[notify] reminder email failed", e)),
    );
  }
  if (params.phone) {
    results.push(
      sendSms({
        to: params.phone,
        body: `Calm Point: your visit is ${params.minutesLabel}. Join: ${join}`,
      }).catch((e) => console.error("[notify] reminder sms failed", e)),
    );
  }
  await Promise.all(results);
}
