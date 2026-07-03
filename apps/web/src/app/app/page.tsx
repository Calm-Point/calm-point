import { redirect } from "next/navigation";
import { Card, CardTitle, CardDescription, EmptyState } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function PatientDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PortalShell
      title={`Good to see you, ${session.user.name?.split(" ")[0] ?? "there"}`}
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardTitle className="mb-1 text-lg">Next appointment</CardTitle>
          <CardDescription>
            Booking opens in Phase 3 — scheduling, video visits, and reminders.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle className="mb-1 text-lg">Check-ins</CardTitle>
          <CardDescription>
            Your recurring wellbeing check-ins will appear here.
          </CardDescription>
        </Card>
      </div>
      <div className="mt-6">
        <EmptyState
          title="Your care team will appear here"
          description="Once you book your first visit, everything you need lives on this page."
        />
      </div>
    </PortalShell>
  );
}
