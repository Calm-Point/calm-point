import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";

// TOTP secrets are encrypted at rest with a key derived from AUTH_SECRET.
// TODO(phase-6): move to a dedicated KMS-managed key before production PHI.
function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.createHash("sha256").update(`mfa:${secret}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((s) => Buffer.from(s, "base64"));
  if (!iv || !tag || !data) throw new Error("Malformed MFA secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateMfaSecret(): string {
  return generateSecret();
}

export function otpauthUrl(email: string, secret: string): string {
  return generateURI({ issuer: "Calm Point", label: email, secret });
}

export async function verifyTotp(encryptedSecret: string, code: string): Promise<boolean> {
  try {
    const result = await verify({
      token: code,
      secret: decryptSecret(encryptedSecret),
      epochTolerance: [30, 0], // accept the previous time-step only
    });
    return result.valid;
  } catch {
    return false;
  }
}
