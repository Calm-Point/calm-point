import { redirect } from "next/navigation";
import { prisma } from "@calm-point/db";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { AppointmentsClient } from "./appointments-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingCompletedAt: true },
  });
  if (!profile?.onboardingCompletedAt) redirect("/app/onboarding");

  return (
    <PortalShell
      title="Appointments"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <AppointmentsClient />
    </PortalShell>
  );
}
