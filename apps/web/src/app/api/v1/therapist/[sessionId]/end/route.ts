import { requireRole, authzErrorResponse } from "@/server/authorize";
import { endSession } from "@/server/ai/therapist";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireRole("PATIENT");
    const { sessionId } = await params;
    return Response.json(await endSession(user, sessionId));
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
