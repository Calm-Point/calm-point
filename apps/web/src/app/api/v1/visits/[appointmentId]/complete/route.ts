import { requireRole, authzErrorResponse } from "@/server/authorize";
import { completeVisit } from "@/server/visits";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireRole("PROVIDER");
    const { appointmentId } = await params;
    const result = await completeVisit(user, appointmentId);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
