import { processDueReminders } from "@/server/reminders";

/**
 * Reminder tick — schedule every ~15 min (vercel.json cron or external).
 * Guarded by CRON_SECRET so only the scheduler can invoke it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || provided !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await processDueReminders();
  return Response.json({ ok: true, ...result });
}
