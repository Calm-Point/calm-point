import { requireRole, authzErrorResponse } from "@/server/authorize";
import { recordScribeConsent } from "@/server/visits";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const { appointmentId } = await params;
    await recordScribeConsent(user, appointmentId);
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
