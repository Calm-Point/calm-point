import { redirect } from "next/navigation";
import { prisma, audit } from "@calm-point/db";
import { Badge, Card, CardTitle, CardDescription, EmptyState } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { listThreads } from "@/server/messaging";
import { MarkNoShowButton } from "@/components/mark-no-show-button";
import { PROVIDER_NAV } from "./provider-nav";

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

  const now = new Date();
  const [upcoming, pastDue, unsignedCount, threads] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        provider: { userId: session.user.id },
        status: { in: ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"] },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: "asc" },
      take: 20,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        provider: { userId: session.user.id },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startsAt: { lt: now },
      },
      orderBy: { startsAt: "desc" },
      take: 10,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.clinicalNote.count({
      where: { provider: { userId: session.user.id }, status: { in: ["AI_DRAFT", "IN_REVIEW"] } },
    }),
    listThreads(session.user),
  ]);
  const unreadCount = threads.filter((t) => t.unread).length;
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
      nav={PROVIDER_NAV}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {pastDue.length > 0 ? (
            <div className="mb-6">
              <h2 className="mb-4 text-lg font-semibold">Needs attention</h2>
              <div className="flex flex-col gap-3">
                {pastDue.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between border-warn/20 bg-warn/10 p-5">
                    <div>
                      <p className="font-medium">
                        {a.patient.user.firstName} {a.patient.user.lastName}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {dateFmt.format(a.startsAt)} · scheduled but never started
                      </p>
                    </div>
                    <MarkNoShowButton appointmentId={a.id} />
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
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
                      href={`/provider/patients/${a.patientId}`}
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-ink/5"
                    >
                      Chart
                    </a>
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
          <a href="/provider/notes">
            <Card className="transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Unsigned notes</CardTitle>
                {unsignedCount > 0 ? <Badge tone="warn">{unsignedCount}</Badge> : null}
              </div>
              <CardDescription>
                {unsignedCount === 0
                  ? "You're all caught up — nothing awaiting review."
                  : `${unsignedCount} AI draft${unsignedCount === 1 ? "" : "s"} awaiting your review.`}
              </CardDescription>
            </Card>
          </a>
          <a href="/provider/inbox">
            <Card className="transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Inbox</CardTitle>
                {unreadCount > 0 ? <Badge tone="brand">{unreadCount}</Badge> : null}
              </div>
              <CardDescription>
                {unreadCount === 0
                  ? "No unread patient messages."
                  : `${unreadCount} conversation${unreadCount === 1 ? "" : "s"} with unread messages.`}
              </CardDescription>
            </Card>
          </a>
        </div>
      </div>
    </PortalShell>
  );
}
