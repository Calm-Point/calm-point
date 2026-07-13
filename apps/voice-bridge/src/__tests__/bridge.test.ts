import { describe, expect, it } from "vitest";
import {
  parseTwilioFrame,
  twilioMediaToXai,
  xaiAudioToTwilio,
  xaiSessionUpdate,
} from "../audio.js";
import { handleToolCall, type BillingRecord } from "../tools.js";

describe("Twilio ↔ xAI frame translation", () => {
  it("parses valid frames and rejects junk", () => {
    expect(parseTwilioFrame('{"event":"start","start":{"streamSid":"MZ1","callSid":"CA1"}}')?.event).toBe("start");
    expect(parseTwilioFrame("not json")).toBeNull();
    expect(parseTwilioFrame('{"foo":1}')).toBeNull();
  });

  it("maps media frames to input_audio_buffer.append and ignores others", () => {
    const media = twilioMediaToXai({ event: "media", media: { payload: "AAAA" } });
    expect(JSON.parse(media!)).toEqual({ type: "input_audio_buffer.append", audio: "AAAA" });
    expect(twilioMediaToXai({ event: "start" })).toBeNull();
  });

  it("maps xAI audio deltas to Twilio media messages with the stream sid", () => {
    const out = xaiAudioToTwilio({ type: "response.audio.delta", delta: "BBBB" }, "MZ9");
    expect(JSON.parse(out!)).toEqual({ event: "media", streamSid: "MZ9", media: { payload: "BBBB" } });
    expect(xaiAudioToTwilio({ type: "response.text.delta", delta: "hi" }, "MZ9")).toBeNull();
  });

  it("configures the session for 8kHz μ-law both ways with the tool schema", () => {
    const cfg = JSON.parse(xaiSessionUpdate("prompt", [{ name: "t" }]));
    expect(cfg.session.input_audio_format).toBe("g711_ulaw");
    expect(cfg.session.output_audio_format).toBe("g711_ulaw");
    expect(cfg.session.tools).toHaveLength(1);
  });
});

describe("executeAccountVerificationCheck", () => {
  const record: BillingRecord = {
    email: "pat@example.com",
    phoneLast4: "0142",
    membershipStatus: "ACTIVE",
    openBalanceCents: 4900,
    nextInvoiceDate: "2026-08-01",
  };
  const lookup = async (email: string) => (email === "pat@example.com" ? record : null);

  it("discloses billing state only when email AND phone last-4 both match", async () => {
    const ok = await handleToolCall(
      { name: "executeAccountVerificationCheck", call_id: "c1", arguments: '{"accountEmail":"Pat@Example.com","phoneLast4":"0142"}' },
      lookup,
    );
    const out = JSON.parse(ok.output);
    expect(out.verified).toBe(true);
    expect(out.openBalance).toBe("$49.00");
  });

  it("does not confirm account existence on mismatch", async () => {
    const bad = await handleToolCall(
      { name: "executeAccountVerificationCheck", call_id: "c2", arguments: '{"accountEmail":"pat@example.com","phoneLast4":"9999"}' },
      lookup,
    );
    expect(JSON.parse(bad.output).verified).toBe(false);
    const missing = await handleToolCall(
      { name: "executeAccountVerificationCheck", call_id: "c3", arguments: '{"accountEmail":"who@example.com","phoneLast4":"0142"}' },
      lookup,
    );
    // Same generic failure either way — no account-existence oracle.
    expect(JSON.parse(missing.output).reason).toBe(JSON.parse(bad.output).reason);
  });

  it("rejects malformed input and unknown tools safely", async () => {
    const malformed = await handleToolCall(
      { name: "executeAccountVerificationCheck", call_id: "c4", arguments: "{oops" },
      lookup,
    );
    expect(JSON.parse(malformed.output).error).toBeDefined();
    const unknown = await handleToolCall({ name: "otherTool", call_id: "c5", arguments: "{}" }, lookup);
    expect(JSON.parse(unknown.output).error).toBe("Unknown tool");
  });
});
