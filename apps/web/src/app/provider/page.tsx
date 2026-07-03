import { redirect } from "next/navigation";
import { Card, CardTitle, CardDescription } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

const NAV = [
  { href: "/provider", label: "Today" },
  { href: "/provider/calendar", label: "Calendar" },
  { href: "/provider/patients", label: "Patients" },
  { href: "/provider/inbox", label: "Inbox" },
  { href: "/provider/notes", label: "Notes" },
];

export default async function ProviderDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PortalShell
      title="Today"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={NAV}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardTitle className="mb-1 text-lg">Visit queue</CardTitle>
          <CardDescription>Today&apos;s appointments will appear here (Phase 3).</CardDescription>
        </Card>
        <Card>
          <CardTitle className="mb-1 text-lg">Unsigned notes</CardTitle>
          <CardDescription>AI-drafted notes awaiting your review and signature.</CardDescription>
        </Card>
        <Card>
          <CardTitle className="mb-1 text-lg">Inbox</CardTitle>
          <CardDescription>Patient messages ordered by response SLA.</CardDescription>
        </Card>
      </div>
    </PortalShell>
  );
}
