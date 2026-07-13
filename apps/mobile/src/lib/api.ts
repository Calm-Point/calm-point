/**
 * Calm Point API client for mobile. Talks to the same /api/v1 contract as the
 * web portals; native networking persists the Auth.js session cookie across
 * requests. Point EXPO_PUBLIC_API_URL at your web deployment (defaults to the
 * local dev server for simulator work).
 */

const BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Auth.js credentials sign-in: precheck → csrf → callback. Cookie-based session. */
export async function signIn(email: string, password: string): Promise<{ mfaRequired?: boolean }> {
  const pre = await request<{ ok: boolean; mfaRequired?: boolean }>("/api/v1/auth/precheck", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!pre.ok) throw new ApiError("That email and password didn't match.", 401);
  if (pre.mfaRequired) return { mfaRequired: true };
  await completeSignIn(email, password);
  return {};
}

export async function completeSignIn(email: string, password: string, totpCode?: string) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: "include" });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    ...(totpCode ? { totpCode } : {}),
  });
  // `redirect: "manual"` avoids following Auth.js's post-login redirect: that
  // hop needs its own CORS headers when the app runs cross-origin (e.g. the
  // Expo web preview), which the redirect target doesn't carry, and the
  // browser aborts the whole fetch as a network failure otherwise. We don't
  // need the redirect's destination — success is verified by checking the
  // session afterward, the real source of truth on every platform.
  await fetch(`${BASE}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
    redirect: "manual",
  }).catch(() => {});
  const session = await getSession();
  if (!session.user) {
    throw new ApiError("Sign-in failed. Check your details and try again.", 401);
  }
}

export async function getSession(): Promise<{ user?: { name?: string; role?: string } }> {
  const res = await fetch(`${BASE}/api/auth/session`, { credentials: "include" });
  // Auth.js returns the JSON literal `null` (not `{}`) for an anonymous session.
  const data = await res.json().catch(() => null);
  return data ?? {};
}

export async function signOut() {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: "include" });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  await fetch(`${BASE}/api/auth/signout`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken }).toString(),
    credentials: "include",
  });
}

// ── Typed endpoint helpers (same contracts as the web client) ───────────────

export interface Appointment {
  id: string;
  kind: string;
  status: string;
  startsAt: string;
  providerName: string;
}
export const listAppointments = () =>
  request<{ appointments: Appointment[] }>("/api/v1/booking/appointments");

export interface ThreadSummary {
  id: string;
  with: string;
  lastMessage: { body: string; sentAt: string; mine: boolean } | null;
  unread: boolean;
}
export const listThreads = () => request<{ threads: ThreadSummary[] }>("/api/v1/messages/threads");

export interface Message {
  id: string;
  body: string;
  sentAt: string;
  mine: boolean;
}
export const readThread = (threadId: string) =>
  request<{ messages: Message[] }>(`/api/v1/messages/threads/${threadId}`);
export const sendMessage = (threadId: string, body: string) =>
  request<{ ok: boolean }>(`/api/v1/messages/threads/${threadId}`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });

export const startCompanionSession = () =>
  request<{ sessionId: string }>("/api/v1/therapist/start", { method: "POST" });
export const companionTurn = (sessionId: string, text: string) =>
  request<{ reply: string; crisisMode?: boolean }>(`/api/v1/therapist/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });

// ── Intake battery (docs/10 §1.2) ────────────────────────────────────────────

export interface CheckinQuestion {
  id: string;
  prompt: string;
  helpText: string | null;
  options: Array<{ id: string; label: string }>;
}
export interface CheckinQuestionnaire {
  slug: string;
  version: number;
  title: string;
  questions: CheckinQuestion[];
}
export const loadCheckin = (slug: string) =>
  request<{ questionnaire: CheckinQuestionnaire }>(`/api/v1/checkins/${slug}`);
export const submitCheckin = (slug: string, answers: Array<{ questionId: string; optionId: string }>) =>
  request<{ ok: boolean; crisis: boolean }>(`/api/v1/checkins/${slug}`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
export const requestIntakeAnalysis = () =>
  request<{ ok: boolean }>("/api/v1/intake/analyze", { method: "POST" }).catch(() => ({ ok: false }));

// ── Identity / insurance / consent (docs/10 §1.4) ────────────────────────────

export const uploadIdentity = (kind: "drivers_license" | "state_id" | "passport", image: string) =>
  request<{ ok: boolean }>("/api/v1/intake/identity", {
    method: "POST",
    body: JSON.stringify({ kind, image }),
  });

export const submitInsurance = (payload: {
  selfPay?: boolean;
  payerName?: string;
  memberId?: string;
  groupNumber?: string;
  frontImage?: string;
  backImage?: string;
}) => request<{ ok: boolean }>("/api/v1/intake/insurance", { method: "POST", body: JSON.stringify(payload) });

export const checkEligibility = (payerName: string, memberId: string) =>
  request<{ status: string; copayCents: number | null }>("/api/v1/intake/eligibility", {
    method: "POST",
    body: JSON.stringify({ payerName, memberId }),
  });

const CONSENT_VERSION = "2026-07";
export const recordConsents = () =>
  request<{ ok: boolean }>("/api/v1/intake/consent", {
    method: "POST",
    body: JSON.stringify({
      consents: [
        { docKey: "telehealth-consent", docVersion: CONSENT_VERSION },
        { docKey: "hipaa-npp", docVersion: CONSENT_VERSION },
        { docKey: "terms", docVersion: CONSENT_VERSION },
      ],
    }),
  });

// ── Booking + membership (docs/10 §1.5–1.6) ──────────────────────────────────

export interface Provider {
  id: string;
  name: string;
  credentials: string;
  specialties: string[];
  bio: string | null;
}
export const listProviders = () => request<{ providers: Provider[] }>("/api/v1/booking/providers");

export interface Slot {
  startsAt: string;
  endsAt: string;
}
export const listSlots = (providerId: string, days = 10) =>
  request<{ slots: Slot[] }>(`/api/v1/booking/slots?providerId=${providerId}&days=${days}`);

export const bookAppointment = (providerId: string, startsAt: string, kind: "INITIAL" | "FOLLOW_UP") =>
  request<{ ok: boolean; appointmentId: string }>("/api/v1/booking/appointments", {
    method: "POST",
    body: JSON.stringify({ providerId, startsAt, kind }),
  });

export const createVisitPaymentIntent = (appointmentId: string) =>
  request<{ clientSecret: string; amountCents: number }>("/api/v1/payments/visit-intent", {
    method: "POST",
    body: JSON.stringify({ appointmentId }),
  });

export const startMembership = () =>
  request<{ clientSecret: string }>("/api/v1/payments/membership", { method: "POST" });
