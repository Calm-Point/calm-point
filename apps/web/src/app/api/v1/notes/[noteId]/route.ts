import { z } from "zod";
import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse, AuthzError } from "@/server/authorize";

async function loadOwnNote(userId: string, noteId: string) {
  const note = await prisma.clinicalNote.findUnique({
    where: { id: noteId },
    include: {
      provider: { select: { userId: true } },
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      appointment: { select: { startsAt: true } },
      amendments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!note || note.provider.userId !== userId) throw new AuthzError(403, "Forbidden");
  return note;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const user = await requireRole("PROVIDER");
    const { noteId } = await params;
    const note = await loadOwnNote(user.id, noteId);
    await audit({
      actorId: user.id,
      action: "note.read",
      resourceType: "ClinicalNote",
      resourceId: note.id,
    });
    return Response.json({
      note: {
        id: note.id,
        status: note.status,
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan,
        signedAt: note.signedAt?.toISOString() ?? null,
        patientName: `${note.patient.user.firstName} ${note.patient.user.lastName}`,
        visitDate: note.appointment.startsAt.toISOString(),
        amendments: note.amendments.map((a) => ({
          content: a.content,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}

const editSchema = z.object({
  subjective: z.string().max(20_000),
  objective: z.string().max(20_000),
  assessment: z.string().max(20_000),
  plan: z.string().max(20_000),
});

/** Edit an unsigned note. Signed notes accept only amendments. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const user = await requireRole("PROVIDER");
    const { noteId } = await params;
    const note = await loadOwnNote(user.id, noteId);
    if (note.status === "SIGNED" || note.status === "AMENDED") {
      return Response.json(
        { error: "Signed notes are locked — add an amendment instead." },
        { status: 409 },
      );
    }
    const parsed = editSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

    await prisma.clinicalNote.update({
      where: { id: note.id },
      data: { ...parsed.data, status: "IN_REVIEW" },
    });
    await audit({
      actorId: user.id,
      action: "note.edit",
      resourceType: "ClinicalNote",
      resourceId: note.id,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
