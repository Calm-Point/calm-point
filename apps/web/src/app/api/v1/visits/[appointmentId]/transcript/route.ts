import { z } from "zod";
import { requireRole, authzErrorResponse } from "@/server/authorize";
import { ingestTranscript } from "@/server/visits";
import { rateLimit } from "@/server/rate-limit";

const schema = z.object({
  lines: z
    .array(
      z.object({
        speaker: z.enum(["patient", "provider"]),
        text: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ appointmentId: string }> },
) {
  try {
    const user = await requireRole("PATIENT", "PROVIDER");
    if (!rateLimit(`transcript:${user.id}`, 240, 60_000)) {
      return Response.json({ error: "Too fast" }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
    const { appointmentId } = await params;
    await ingestTranscript(user, appointmentId, parsed.data.lines);
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
