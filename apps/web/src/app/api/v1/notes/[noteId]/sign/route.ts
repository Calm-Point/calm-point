import { prisma, audit } from "@calm-point/db";
import { requireRole, authzErrorResponse, AuthzError } from "@/server/authorize";
import { noteContentHash } from "@/server/visits";

/** Signing locks the note and stores a content hash — tamper evidence (docs/03 §6). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const user = await requireRole("PROVIDER");
    const { noteId } = await params;
    const note = await prisma.clinicalNote.findUnique({
      where: { id: noteId },
      include: { provider: { select: { userId: true } } },
    });
    if (!note || note.provider.userId !== user.id) throw new AuthzError(403, "Forbidden");
    if (note.status === "SIGNED" || note.status === "AMENDED") {
      return Response.json({ error: "Already signed" }, { status: 409 });
    }

    const signedHash = noteContentHash(note);
    await prisma.clinicalNote.update({
      where: { id: note.id },
      data: { status: "SIGNED", signedAt: new Date(), signedHash },
    });
    await audit({
      actorId: user.id,
      action: "note.sign",
      resourceType: "ClinicalNote",
      resourceId: note.id,
      metadata: { signedHash },
    });
    return Response.json({ ok: true, signedHash });
  } catch (err) {
    return authzErrorResponse(err) ?? Response.json({ error: "Internal error" }, { status: 500 });
  }
}
