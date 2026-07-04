import { redirect } from "next/navigation";
import { prisma } from "@calm-point/db";
import { EmptyState } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { TherapistClient } from "./therapist-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function TherapistPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const flag = await prisma.featureFlag.findUnique({ where: { key: "ai-therapist" } });

  return (
    <PortalShell
      title="Companion"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      {flag?.enabled ? (
        <TherapistClient />
      ) : (
        <EmptyState
          title="Your AI companion is almost ready"
          description="We're finishing clinical review so this space is genuinely safe and helpful. Meanwhile, your care team is one message away."
        />
      )}
    </PortalShell>
  );
}
