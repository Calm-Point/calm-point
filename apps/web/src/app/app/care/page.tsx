import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { CareClient } from "./care-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function CarePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="My care"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <CareClient />
    </PortalShell>
  );
}
