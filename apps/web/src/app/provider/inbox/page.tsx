import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { MessagesClient } from "@/components/messages-client";

const NAV = [
  { href: "/provider", label: "Today" },
  { href: "/provider/calendar", label: "Calendar" },
  { href: "/provider/patients", label: "Patients" },
  { href: "/provider/inbox", label: "Inbox" },
  { href: "/provider/notes", label: "Notes" },
];

export default async function ProviderInboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Inbox"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={NAV}
    >
      <MessagesClient />
    </PortalShell>
  );
}
