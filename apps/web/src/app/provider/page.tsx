import { redirect } from "next/navigation";
import { prisma, audit } from "@calm-point/db";
import { Badge, Card, CardTitle, CardDescription, EmptyState } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

const NAV = [
  { href: "/provider", label: "Today" },
  { href: "/provider/intakes", label: "Intakes" },
  { href: "/provider/inbox", label: "Inbox" },
  { href: "/provider/notes", label: "Notes" },
  { href: "/provider/billing", label: "Billing" },
];

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ProviderDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const upcoming = await prisma.appointment.findMany({
    where: {
      provider: { userId: session.user.id },
      status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
      endsAt: { gt: new Date() },
    },
    orderBy: { startsAt: "asc" },
    take: 20,
    include: {
      patient: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  await audit({
    actorId: session.user.id,
    action: "appointment.list",
    resourceType: "Appointment",
    metadata: { surface: "provider-dashboard" },
  });

  return (
    <PortalShell
      title="Today"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={NAV}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Upcoming visits</h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming visits"
              description="Booked appointments appear here the moment patients schedule."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((a) => (
                <Card key={a.id} className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-medium">
                      {a.patient.user.firstName} {a.patient.user.lastName}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {dateFmt.format(a.startsAt)} ·{" "}
                      {a.kind === "INITIAL" ? "First visit" : "Follow-up"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={a.status === "IN_PROGRESS" ? "positive" : "brand"}>
                      {a.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    <a
                      href={`/provider/visit/${a.id}`}
                      className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white"
                    >
                      {a.status === "IN_PROGRESS" ? "Rejoin" : "Start"}
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle className="mb-1 text-lg">Unsigned notes</CardTitle>
            <CardDescription>
              AI-drafted notes awaiting review land here (Phase 3.3).
            </CardDescription>
          </Card>
          <Card>
            <CardTitle className="mb-1 text-lg">Inbox</CardTitle>
            <CardDescription>Patient messages ordered by response SLA (Phase 3.4).</CardDescription>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
