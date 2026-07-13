import { z } from "zod";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { sessionTurn } from "@/server/ai/therapist";
import { rateLimit } from "@/server/rate-limit";

const schema = z.object({ text: z.string().min(1).max(4000) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireRole("PATIENT");
    if (!(await rateLimit(`therapist-turn:${user.id}`, 30, 60_000))) {
      return Response.json({ error: "One breath at a time — try again in a moment." }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const { sessionId } = await params;
    const result = await sessionTurn(user, sessionId, parsed.data.text);
    return Response.json(result);
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
