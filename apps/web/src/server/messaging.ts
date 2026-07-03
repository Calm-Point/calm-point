import { prisma, audit, type Role } from "@calm-point/db";
import { AuthzError, type SessionUser } from "@/server/authorize";

/**
 * Secure messaging (docs/04 §3.4). Threads exist only along an active
 * CareRelationship; both sides must be participants to read or write.
 */

export async function ensureThreadForRelationship(user: SessionUser, otherUserId: string) {
  // Resolve the (patient, provider) pair regardless of which side is asking.
  const [patientUserId, providerUserId] =
    user.role === "PATIENT" ? [user.id, otherUserId] : [otherUserId, user.id];

  const relationship = await prisma.careRelationship.findFirst({
    where: {
      endedAt: null,
      patient: { userId: patientUserId },
      provider: { userId: providerUserId },
    },
  });
  if (!relationship) {
    throw new AuthzError(403, "No active care relationship");
  }

  const existing = await prisma.messageThread.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: patientUserId } } },
        { participants: { some: { userId: providerUserId } } },
      ],
    },
  });
  if (existing) return existing;

  return prisma.messageThread.create({
    data: {
      participants: {
        create: [{ userId: patientUserId }, { userId: providerUserId }],
      },
    },
  });
}

export async function requireParticipant(userId: string, threadId: string) {
  const participant = await prisma.messageParticipant.findUnique({
    where: { threadId_userId: { threadId, userId } },
  });
  if (!participant) throw new AuthzError(403, "Not a participant");
  return participant;
}

export async function listThreads(user: SessionUser) {
  const threads = await prisma.messageThread.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });

  return threads.map((t) => {
    const me = t.participants.find((p) => p.userId === user.id);
    const others = t.participants.filter((p) => p.userId !== user.id);
    const last = t.messages[0];
    return {
      id: t.id,
      with: others
        .map((p) => `${p.user.firstName} ${p.user.lastName}`)
        .join(", "),
      withRole: (others[0]?.user.role ?? "PATIENT") as Role,
      lastMessage: last
        ? { body: last.body.slice(0, 120), sentAt: last.sentAt.toISOString(), mine: last.senderId === user.id }
        : null,
      unread: Boolean(
        last && last.senderId !== user.id && (!me?.lastReadAt || me.lastReadAt < last.sentAt),
      ),
    };
  });
}

export async function readThread(user: SessionUser, threadId: string) {
  await requireParticipant(user.id, threadId);
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { sentAt: "asc" },
    take: 200,
    include: { sender: { select: { id: true, firstName: true, lastName: true } } },
  });
  await prisma.messageParticipant.update({
    where: { threadId_userId: { threadId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });
  await audit({
    actorId: user.id,
    action: "message.thread.read",
    resourceType: "MessageThread",
    resourceId: threadId,
  });
  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    sentAt: m.sentAt.toISOString(),
    mine: m.sender.id === user.id,
    senderName: `${m.sender.firstName} ${m.sender.lastName}`,
  }));
}

export async function sendMessage(user: SessionUser, threadId: string, body: string) {
  await requireParticipant(user.id, threadId);
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { threadId, senderId: user.id, body },
    });
    await tx.messageThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    return created;
  });
  await audit({
    actorId: user.id,
    action: "message.send",
    resourceType: "Message",
    resourceId: message.id,
    metadata: { threadId },
  });
  return message;
}
