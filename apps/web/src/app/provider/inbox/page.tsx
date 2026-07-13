import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { MessagesClient } from "@/components/messages-client";
import { PROVIDER_NAV } from "../provider-nav";

export default async function ProviderInboxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Inbox"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={PROVIDER_NAV}
    >
      <MessagesClient />
    </PortalShell>
  );
}
