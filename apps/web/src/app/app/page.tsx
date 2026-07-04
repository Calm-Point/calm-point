import { redirect } from "next/navigation";
import { prisma } from "@calm-point/db";
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

  const profile = await prisma.patientProfile.findUnique({
    where: { userId: session.user.id },
    select: { onboardingCompletedAt: true },
  });
  const needsOnboarding = !profile?.onboardingCompletedAt;

  return (
    <PortalShell
      title={`Good to see you, ${session.user.name?.split(" ")[0] ?? "there"}`}
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      {needsOnboarding ? (
        <a
          href="/app/onboarding"
          className="mb-6 block rounded-lg bg-brand p-5 text-white shadow-soft transition-transform hover:-translate-y-0.5"
        >
          <p className="font-semibold">Finish setting up your care →</p>
          <p className="text-sm opacity-90">
            A few details (2 minutes) unlock booking your first visit.
          </p>
        </a>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardTitle className="mb-1 text-lg">Next appointment</CardTitle>
          <CardDescription>
            <a href="/app/appointments" className="text-brand underline">
              Book or manage your visits →
            </a>
          </CardDescription>
        </Card>
        <Card>
          <CardTitle className="mb-1 text-lg">Check-ins</CardTitle>
          <CardDescription>
            Your recurring wellbeing check-ins will appear here.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle className="mb-1 text-lg">Companion</CardTitle>
          <CardDescription>
            <a href="/app/therapist" className="text-brand underline">
              A space to think out loud between visits →
            </a>
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
