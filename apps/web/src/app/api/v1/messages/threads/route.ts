import { z } from "zod";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { ensureThreadForRelationship, listThreads } from "@/server/messaging";
import { rateLimit } from "@/server/rate-limit";

export async function GET() {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    return Response.json({ threads: await listThreads(user) });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const createSchema = z.object({ withUserId: z.string().cuid() });

/** Create (or fetch) the thread with the other side of a care relationship. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    if (!rateLimit(`thread-create:${user.id}`, 20, 60_000)) {
      return Response.json({ error: "Too many attempts" }, { status: 429 });
    }
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const thread = await ensureThreadForRelationship(user, parsed.data.withUserId);
    return Response.json({ threadId: thread.id }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
