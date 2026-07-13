import { processRetention } from "@/server/retention";

/**
 * Daily PHI retention tick (docs/10 spec §5.2). Guarded by CRON_SECRET so only
 * the scheduler can invoke it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || provided !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await processRetention();
  return Response.json({ ok: true, ...result });
}
