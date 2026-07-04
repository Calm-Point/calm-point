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
  const res = await fetch(`${BASE}/api/auth/callback/credentials?json=true`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    credentials: "include",
  });
  // Auth.js returns 200 with the session cookie on success; a redirect URL
  // containing "error" signals bad credentials.
  const text = await res.text();
  if (!res.ok || /error/i.test(text)) {
    throw new ApiError("Sign-in failed. Check your details and try again.", 401);
  }
}

export async function getSession(): Promise<{ user?: { name?: string; role?: string } }> {
  const res = await fetch(`${BASE}/api/auth/session`, { credentials: "include" });
  return res.json().catch(() => ({}));
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
