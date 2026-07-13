import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ADMIN_NAV } from "../admin-nav";
import { ProvidersClient } from "./providers-client";

export default async function AdminProvidersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Providers"
      userName={session.user.name ?? ""}
      roleLabel="Admin"
      nav={ADMIN_NAV}
    >
      <ProvidersClient />
    </PortalShell>
  );
}
