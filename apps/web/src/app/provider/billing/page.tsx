import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ProviderBillingClient } from "@/components/provider-billing-client";
import { PROVIDER_NAV } from "../provider-nav";

export default async function ProviderBillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Billing & payouts"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={PROVIDER_NAV}
    >
      <ProviderBillingClient />
    </PortalShell>
  );
}
