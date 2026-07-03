import { requireRole, authzErrorResponse } from "@/server/authorize";
import { joinVisit } from "@/server/visits";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    const { appointmentId } = await params;
    const join = await joinVisit(user, appointmentId);
    return Response.json({ join });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
