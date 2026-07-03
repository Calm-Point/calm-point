import type { VideoProvider, JoinInfo } from "./index";

/**
 * Daily.co implementation (fallback vendor, flag-selected). Rooms are private;
 * participants get short-lived meeting tokens. 🚦 BAA + HIPAA mode required
 * before production use (docs/05 §1).
 */

const API = "https://api.daily.co/v1";

async function dailyFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Daily API ${path} failed: ${res.status}`);
  return res.json();
}

export const dailyProvider: VideoProvider = {
  vendor: "daily",
  isConfigured() {
    return Boolean(process.env.DAILY_API_KEY);
  },
  async createSession(appointmentId: string): Promise<string> {
    const name = `cp-visit-${appointmentId}`;
    await dailyFetch("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name,
        privacy: "private",
        properties: { exp: Math.floor(Date.now() / 1000) + 6 * 3600, enable_chat: false },
      }),
    }).catch(async (err) => {
      // Room may already exist from a prior join — that's fine.
      const exists = await fetch(`${API}/rooms/${name}`, {
        headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      });
      if (!exists.ok) throw err;
    });
    return name;
  },
  async joinToken(sessionId, participant): Promise<JoinInfo> {
    const data = await dailyFetch("/meeting-tokens", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          room_name: sessionId,
          user_name: participant.displayName,
          is_owner: participant.role === "host",
          exp: Math.floor(Date.now() / 1000) + 2 * 3600,
        },
      }),
    });
    return {
      vendor: "daily",
      sessionId,
      token: data.token,
      extra: { roomUrl: `https://${process.env.DAILY_SUBDOMAIN ?? "calmpoint"}.daily.co/${sessionId}` },
    };
  },
};
