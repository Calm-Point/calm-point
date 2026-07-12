import fs from "node:fs/promises";
import path from "node:path";

/**
 * Object storage seam for transcripts/attachments (docs/03 §5). Production
 * uses S3 with SSE (implementation lands with infra keys — the interface is
 * frozen here). Dev/CI uses a local directory. Local mode is refused in
 * production because serverless filesystems are ephemeral.
 */

const LOCAL_ROOT = path.join(process.cwd(), ".data", "blobs");

function assertNotProd() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    throw new Error("Local blob storage is not available in production — configure S3.");
  }
}

export async function putText(key: string, text: string): Promise<string> {
  if (process.env.S3_BUCKET) {
    // TODO(phase-3.3): @aws-sdk/client-s3 PutObject with SSE-KMS once bucket
    // credentials are provisioned. Interface is stable; callers won't change.
    throw new Error("S3 storage not yet wired — unset S3_BUCKET to use local dev storage");
  }
  assertNotProd();
  const safeKey = key.replace(/[^a-zA-Z0-9/_.-]/g, "_");
  const file = path.join(LOCAL_ROOT, safeKey);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, "utf8");
  return `local:${safeKey}`;
}

/**
 * Store a binary object (e.g. an ID or insurance-card photo). Returns an opaque
 * storage key — never a public URL. Access is via signed URLs behind
 * authorization. Production uses S3 with SSE; local dev writes to disk.
 */
export async function putBinary(
  key: string,
  data: Buffer,
  _contentType: string,
): Promise<string> {
  if (process.env.S3_BUCKET) {
    // TODO(infra): @aws-sdk/client-s3 PutObject with SSE-KMS + ContentType once
    // bucket credentials are provisioned. Interface is stable.
    throw new Error("S3 storage not yet wired — unset S3_BUCKET to use local dev storage");
  }
  assertNotProd();
  const safeKey = key.replace(/[^a-zA-Z0-9/_.-]/g, "_");
  const file = path.join(LOCAL_ROOT, safeKey);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  return `local:${safeKey}`;
}

/** Max upload size for identity/insurance photos (8 MB). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

/**
 * Decode a `data:` URL image, enforcing type + size. Throws on anything that
 * isn't an allowed image within the size limit.
 */
export function decodeImageDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  const contentType = match[1]!.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error("Unsupported image type");
  }
  const buffer = Buffer.from(match[2]!, "base64");
  if (buffer.byteLength === 0) throw new Error("Empty image");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new Error("Image too large");
  return { buffer, contentType };
}

export async function getText(storageKey: string): Promise<string> {
  if (storageKey.startsWith("local:")) {
    assertNotProd();
    return fs.readFile(path.join(LOCAL_ROOT, storageKey.slice("local:".length)), "utf8");
  }
  throw new Error(`Unsupported storage key scheme: ${storageKey}`);
}

export async function appendText(storageKey: string, text: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    assertNotProd();
    await fs.appendFile(path.join(LOCAL_ROOT, storageKey.slice("local:".length)), text, "utf8");
    return;
  }
  throw new Error(`Unsupported storage key scheme: ${storageKey}`);
}
