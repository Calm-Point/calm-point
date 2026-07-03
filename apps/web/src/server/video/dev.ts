import crypto from "node:crypto";
import type { VideoProvider, JoinInfo } from "./index";

/**
 * Dev/CI video provider: no real AV transport, but the full visit lifecycle
 * (session creation, tokens, join/leave, scribe consent) runs against it so
 * E2E tests cover everything except vendor pixels. Never used in production
 * (guarded in activeVideoProvider).
 */
export const devProvider: VideoProvider = {
  vendor: "dev",
  isConfigured() {
    return true;
  },
  async createSession(appointmentId: string): Promise<string> {
    return `dev-visit-${appointmentId}`;
  },
  async joinToken(sessionId, participant): Promise<JoinInfo> {
    return {
      vendor: "dev",
      sessionId,
      token: crypto.randomBytes(16).toString("base64url"),
      extra: { displayName: participant.displayName, role: participant.role },
    };
  },
};
