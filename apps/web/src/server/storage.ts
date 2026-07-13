import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Object storage seam for transcripts/attachments (docs/03 §5). Production
 * uses S3 with SSE-KMS; dev/CI uses a local directory. Local mode is refused
 * in production because serverless filesystems are ephemeral.
 */

const LOCAL_ROOT = path.join(process.cwd(), ".data", "blobs");

function assertNotProd() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "1") {
    throw new Error("Local blob storage is not available in production — configure S3.");
  }
}

let s3Client: S3Client | null = null;
function s3(): S3Client {
  s3Client ??= new S3Client({ region: process.env.S3_REGION ?? "us-east-1" });
  return s3Client;
}

function sseParams() {
  const kmsKeyId = process.env.S3_KMS_KEY_ID;
  return kmsKeyId
    ? { ServerSideEncryption: "aws:kms" as const, SSEKMSKeyId: kmsKeyId }
    : { ServerSideEncryption: "AES256" as const };
}

async function streamToString(body: unknown): Promise<string> {
  // The AWS SDK v3 response body is a Node Readable in this runtime.
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function s3GetText(bucket: string, key: string): Promise<string> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToString(res.Body);
}

async function s3PutText(bucket: string, key: string, text: string, contentType = "text/plain"): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: text,
      ContentType: contentType,
      ...sseParams(),
    }),
  );
}

export async function putText(key: string, text: string): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    await s3PutText(bucket, key, text);
    return `s3:${key}`;
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
export async function putBinary(key: string, data: Buffer, contentType: string): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ...sseParams(),
      }),
    );
    return `s3:${key}`;
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
  if (storageKey.startsWith("s3:")) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not configured but an s3: key was requested");
    return s3GetText(bucket, storageKey.slice("s3:".length));
  }
  throw new Error(`Unsupported storage key scheme: ${storageKey}`);
}

/**
 * Appends to a stored text object. S3 has no native append — this reads the
 * current object and writes it back with the new text concatenated, which is
 * fine for the append volumes here (a transcript accumulates a few dozen
 * lines over a visit, not thousands) but would need a different design
 * (multipart parts, or per-chunk objects concatenated at read time) if that
 * assumption changes.
 */
export async function appendText(storageKey: string, text: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    assertNotProd();
    await fs.appendFile(path.join(LOCAL_ROOT, storageKey.slice("local:".length)), text, "utf8");
    return;
  }
  if (storageKey.startsWith("s3:")) {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error("S3_BUCKET is not configured but an s3: key was requested");
    const key = storageKey.slice("s3:".length);
    let existing = "";
    try {
      existing = await s3GetText(bucket, key);
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "NoSuchKey") throw err;
    }
    await s3PutText(bucket, key, existing + text);
    return;
  }
  throw new Error(`Unsupported storage key scheme: ${storageKey}`);
}
