/**
 * Pure frame translation between Twilio Media Streams and the xAI realtime
 * voice WebSocket. Twilio sends 8 kHz μ-law audio as base64 in JSON frames;
 * xAI realtime accepts/returns base64 audio buffer events. No I/O here —
 * everything is unit-testable.
 */

export interface TwilioFrame {
  event: "connected" | "start" | "media" | "stop" | "mark";
  streamSid?: string;
  start?: { streamSid: string; callSid: string };
  media?: { payload: string; timestamp?: string; track?: string };
}

/** Parse a raw Twilio WS message; returns null on non-JSON/unknown frames. */
export function parseTwilioFrame(raw: string): TwilioFrame | null {
  try {
    const data = JSON.parse(raw) as TwilioFrame;
    return data && typeof data.event === "string" ? data : null;
  } catch {
    return null;
  }
}

/** Twilio media frame → xAI input_audio_buffer.append event (or null). */
export function twilioMediaToXai(frame: TwilioFrame): string | null {
  if (frame.event !== "media" || !frame.media?.payload) return null;
  return JSON.stringify({ type: "input_audio_buffer.append", audio: frame.media.payload });
}

/** xAI audio delta event → Twilio media message for the given stream. */
export function xaiAudioToTwilio(xaiEvent: unknown, streamSid: string): string | null {
  const e = xaiEvent as { type?: string; delta?: string; audio?: string };
  const payload = e?.type === "response.audio.delta" ? (e.delta ?? e.audio) : null;
  if (!payload) return null;
  return JSON.stringify({ event: "media", streamSid, media: { payload } });
}

/** xAI session config: 8 kHz μ-law both directions to match Twilio's codec. */
export function xaiSessionUpdate(systemPrompt: string, tools: object[]): string {
  return JSON.stringify({
    type: "session.update",
    session: {
      instructions: systemPrompt,
      modalities: ["audio", "text"],
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      turn_detection: { type: "server_vad" },
      tools,
    },
  });
}
