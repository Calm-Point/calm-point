import { requireRole, authzErrorResponse } from "@/server/authorize";
import { startSession } from "@/server/ai/therapist";
import { rateLimit } from "@/server/rate-limit";

export async function POST() {
  try {
    const user = await requireRole("PATIENT");
    if (!rateLimit(`therapist-start:${user.id}`, 10, 3_600_000)) {
      return Response.json({ error: "Too many sessions — take a breather." }, { status: 429 });
    }
    const session = await startSession(user);
    return Response.json({ sessionId: session.id }, { status: 201 });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
