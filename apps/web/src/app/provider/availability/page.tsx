import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ProviderAvailabilityClient } from "@/components/provider-availability-client";
import { PROVIDER_NAV } from "../provider-nav";

export default async function ProviderAvailabilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Availability"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={PROVIDER_NAV}
    >
      <ProviderAvailabilityClient />
    </PortalShell>
  );
}
