import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ADMIN_NAV } from "../admin-nav";
import { FlagsClient } from "./flags-client";

export default async function AdminFlagsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Feature flags"
      userName={session.user.name ?? ""}
      roleLabel="Admin"
      nav={ADMIN_NAV}
    >
      <FlagsClient />
    </PortalShell>
  );
}
