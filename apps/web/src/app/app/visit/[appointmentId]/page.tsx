import { redirect } from "next/navigation";
import { prisma } from "@calm-point/db";
import { auth } from "@/auth";
import { VisitRoom } from "@/components/visit-room";

export default async function PatientVisitPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { appointmentId } = await params;
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patient: { userId: session.user.id } },
    select: { scribeConsentAt: true },
  });
  if (!appointment) redirect("/app/appointments");
  return (
    <VisitRoom
      appointmentId={appointmentId}
      isProvider={false}
      scribeConsented={Boolean(appointment.scribeConsentAt)}
    />
  );
}
