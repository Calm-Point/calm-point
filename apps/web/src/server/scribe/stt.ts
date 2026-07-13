/**
 * Speech-to-text seam for the ambient scribe (docs/10 spec §3 phase 3).
 * Diarized transcription behind a frozen interface:
 *  - mock:     deterministic segments for dev/CI
 *  - grok:     xAI STT (XAI_API_KEY) — spec's preferred vendor
 *  - deepgram: alternative (DEEPGRAM_API_KEY)
 * 🚦 Clinical audio is PHI: no vendor receives real patient audio without a BAA.
 * Production refuses the mock.
 */

export interface DiarizedSegment {
  speaker: "patient" | "provider" | "unknown";
  text: string;
  startMs?: number;
}

export interface SttVendor {
  readonly name: string;
  transcribe(audio: Buffer, contentType: string): Promise<DiarizedSegment[]>;
}

const mockVendor: SttVendor = {
  name: "mock",
  async transcribe() {
    return [
      { speaker: "provider", text: "Thanks for joining — what would you like to focus on today?" },
      { speaker: "patient", text: "The last two weeks the anxiety has been worse, especially at night." },
      { speaker: "provider", text: "Let's talk through what's changed and what has helped before." },
    ];
  },
};

function keyGated(name: string, envVar: string): SttVendor {
  return {
    name,
    async transcribe() {
      throw new Error(`${name} STT is not configured — set ${envVar} (and confirm the vendor BAA before real patient audio).`);
    },
  };
}

const grokVendor: SttVendor = {
  name: "grok",
  async transcribe(audio, contentType) {
    const key = process.env.XAI_API_KEY;
    if (!key) return keyGated("xAI Grok", "XAI_API_KEY").transcribe(audio, contentType);
    const res = await fetch("https://api.x.ai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": contentType },
      body: new Uint8Array(audio),
    });
    if (!res.ok) throw new Error(`Grok STT failed (${res.status})`);
    const data = (await res.json()) as {
      segments?: Array<{ speaker?: string; text: string; start?: number }>;
      text?: string;
    };
    if (data.segments?.length) {
      return data.segments.map((s) => ({
        speaker: s.speaker === "0" || s.speaker === "provider" ? "provider" : s.speaker ? "patient" : "unknown",
        text: s.text,
        startMs: s.start !== undefined ? Math.round(s.start * 1000) : undefined,
      }));
    }
    return data.text ? [{ speaker: "unknown", text: data.text }] : [];
  },
};

export function sttVendor(): SttVendor {
  const vendor = (process.env.STT_VENDOR ?? "mock").toLowerCase();
  if (vendor === "grok") return grokVendor;
  if (vendor === "deepgram") return keyGated("Deepgram", "DEEPGRAM_API_KEY");
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AI !== "1") {
    return keyGated("STT (no vendor configured)", "STT_VENDOR");
  }
  return mockVendor;
}
