import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  parseTwilioFrame,
  twilioMediaToXai,
  xaiAudioToTwilio,
  xaiSessionUpdate,
} from "./audio.js";
import {
  ACCOUNT_VERIFICATION_TOOL,
  BILLING_AGENT_SYSTEM_PROMPT,
  handleToolCall,
  type BillingLookup,
} from "./tools.js";

/**
 * Twilio Media Streams ↔ xAI Grok realtime voice bridge (docs/10 spec §4.1 /
 * Prompt 3). One inbound Twilio <Stream> per call is bridged to one xAI
 * realtime session configured as the billing/support agent.
 *
 * Deployment: a long-lived Node process (Cloud Run / Fly / a VM) — WebSockets
 * cannot live on Vercel serverless. Requires XAI_API_KEY; the billing lookup
 * calls the platform's internal API with a service token (PHI-free payload).
 */

const XAI_REALTIME_URL = process.env.XAI_REALTIME_URL ?? "wss://api.x.ai/v1/realtime";

/** Billing lookup via the platform API; returns null when unconfigured. */
export const platformBillingLookup: BillingLookup = async (email) => {
  const base = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_SERVICE_TOKEN;
  if (!base || !token) return null;
  const res = await fetch(`${base}/api/v1/internal/billing-lookup?email=${encodeURIComponent(email)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Awaited<ReturnType<BillingLookup>>;
};

export function createBridgeServer(lookup: BillingLookup = platformBillingLookup): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, xaiConfigured: Boolean(process.env.XAI_API_KEY) }));
      return;
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server, path: "/twilio" });

  wss.on("connection", (twilio) => {
    if (!process.env.XAI_API_KEY) {
      twilio.close(1011, "XAI_API_KEY not configured");
      return;
    }
    let streamSid: string | null = null;
    const xai = new WebSocket(XAI_REALTIME_URL, {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    });
    const pendingToTwilio: string[] = [];

    xai.on("open", () => {
      xai.send(xaiSessionUpdate(BILLING_AGENT_SYSTEM_PROMPT, [ACCOUNT_VERIFICATION_TOOL]));
    });

    xai.on("message", (raw) => {
      let event: { type?: string; name?: string; call_id?: string; arguments?: string };
      try {
        event = JSON.parse(String(raw));
      } catch {
        return;
      }
      // Audio back to the caller.
      if (streamSid) {
        const media = xaiAudioToTwilio(event, streamSid);
        if (media && twilio.readyState === WebSocket.OPEN) twilio.send(media);
      }
      // Tool calls → verified billing lookup → result back to the model.
      if (event.type === "response.function_call_arguments.done" && event.name && event.call_id) {
        void handleToolCall(
          { name: event.name, call_id: event.call_id, arguments: event.arguments ?? "{}" },
          lookup,
        ).then((result) => {
          if (xai.readyState !== WebSocket.OPEN) return;
          xai.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: result.call_id, output: result.output },
            }),
          );
          xai.send(JSON.stringify({ type: "response.create" }));
        });
      }
    });

    twilio.on("message", (raw) => {
      const frame = parseTwilioFrame(String(raw));
      if (!frame) return;
      if (frame.event === "start" && frame.start) streamSid = frame.start.streamSid;
      if (frame.event === "stop") {
        xai.close();
        return;
      }
      const audio = twilioMediaToXai(frame);
      if (!audio) return;
      if (xai.readyState === WebSocket.OPEN) xai.send(audio);
      else pendingToTwilio.push(audio); // buffer pre-open audio
    });

    xai.on("open", () => {
      for (const buffered of pendingToTwilio.splice(0)) xai.send(buffered);
    });

    const teardown = () => {
      if (xai.readyState === WebSocket.OPEN || xai.readyState === WebSocket.CONNECTING) xai.close();
      if (twilio.readyState === WebSocket.OPEN) twilio.close();
    };
    twilio.on("close", teardown);
    twilio.on("error", teardown);
    xai.on("close", teardown);
    xai.on("error", teardown);
  });

  return server;
}
