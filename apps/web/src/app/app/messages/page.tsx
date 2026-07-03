import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { MessagesClient } from "@/components/messages-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function PatientMessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Messages"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <MessagesClient />
    </PortalShell>
  );
}
