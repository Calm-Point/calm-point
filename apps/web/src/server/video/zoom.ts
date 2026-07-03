import crypto from "node:crypto";
import type { VideoProvider, JoinInfo } from "./index";

/**
 * Zoom Video SDK implementation. Sessions are named after the appointment;
 * the SDK JWT is signed server-side (HS256) per Zoom's Video SDK auth spec.
 * 🚦 BAA required before production use (docs/05 §1).
 */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signVideoSdkJwt(sessionName: string, roleType: 0 | 1): string {
  const key = process.env.ZOOM_VIDEO_SDK_KEY!;
  const secret = process.env.ZOOM_VIDEO_SDK_SECRET!;
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2h validity
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      app_key: key,
      tpc: sessionName,
      role_type: roleType,
      version: 1,
      iat,
      exp,
    }),
  );
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export const zoomProvider: VideoProvider = {
  vendor: "zoom",
  isConfigured() {
    return Boolean(process.env.ZOOM_VIDEO_SDK_KEY && process.env.ZOOM_VIDEO_SDK_SECRET);
  },
  async createSession(appointmentId: string): Promise<string> {
    // Video SDK sessions are created implicitly on first join by topic name.
    return `cp-visit-${appointmentId}`;
  },
  async joinToken(sessionId, participant): Promise<JoinInfo> {
    return {
      vendor: "zoom",
      sessionId,
      token: signVideoSdkJwt(sessionId, participant.role === "host" ? 1 : 0),
      extra: { sdkKey: process.env.ZOOM_VIDEO_SDK_KEY! },
    };
  },
};
