import { prisma } from "@calm-point/db";
import { zoomProvider } from "./zoom";
import { dailyProvider } from "./daily";
import { devProvider } from "./dev";

/**
 * VideoProvider abstraction (docs/02 D5): vendor choice is a feature-flag
 * value, never hardcoded at call sites. Tokens are minted server-side only.
 */
export interface JoinInfo {
  vendor: string;
  /** Vendor session identifier (room name / session name). */
  sessionId: string;
  /** Short-lived join token for this participant. */
  token: string;
  /** Vendor-specific extras the client SDK needs (SDK key, room URL, ...). */
  extra?: Record<string, string>;
}

export interface VideoProvider {
  readonly vendor: string;
  /** True when this vendor has the config it needs to mint sessions. */
  isConfigured(): boolean;
  createSession(appointmentId: string): Promise<string>;
  joinToken(sessionId: string, participant: {
    userId: string;
    displayName: string;
    role: "host" | "attendee";
  }): Promise<JoinInfo>;
}

const PROVIDERS: Record<string, VideoProvider> = {
  zoom: zoomProvider,
  daily: dailyProvider,
  dev: devProvider,
};

export async function activeVideoProvider(): Promise<VideoProvider> {
  const flag = await prisma.featureFlag.findUnique({ where: { key: "video-vendor" } });
  const requested = (flag?.value as string | null) ?? process.env.VIDEO_VENDOR ?? "zoom";
  const provider = PROVIDERS[requested] ?? PROVIDERS.zoom!;
  if (provider.isConfigured()) return provider;
  // No vendor credentials (local/dev/CI) → deterministic in-app dev room so
  // the visit lifecycle stays fully testable. Production must have real keys.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_VIDEO !== "1") {
    throw new Error(`Video vendor "${requested}" is not configured`);
  }
  return PROVIDERS.dev!;
}
