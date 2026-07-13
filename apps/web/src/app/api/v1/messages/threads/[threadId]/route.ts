import { z } from "zod";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { readThread, sendMessage } from "@/server/messaging";
import { rateLimit } from "@/server/rate-limit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const { threadId } = await params;
    return Response.json({ messages: await readThread(user, threadId) });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const sendSchema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    if (!(await rateLimit(`msg-send:${user.id}`, 60, 60_000))) {
      return Response.json({ error: "Too many messages" }, { status: 429 });
    }
    const parsed = sendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const { threadId } = await params;
    const message = await sendMessage(user, threadId, parsed.data.body);
    return Response.json({ ok: true, messageId: message.id }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
