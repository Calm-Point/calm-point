import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ProviderBillingClient } from "@/components/provider-billing-client";

const NAV = [
  { href: "/provider", label: "Today" },
  { href: "/provider/intakes", label: "Intakes" },
  { href: "/provider/inbox", label: "Inbox" },
  { href: "/provider/notes", label: "Notes" },
  { href: "/provider/billing", label: "Billing" },
];

export default async function ProviderBillingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Billing & payouts"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={NAV}
    >
      <ProviderBillingClient />
    </PortalShell>
  );
}
