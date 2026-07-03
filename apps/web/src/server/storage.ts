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
