import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { IntakeBatteryClient } from "@/components/intake-battery-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function IntakeBatteryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Your intake"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <p className="mb-4 max-w-xl text-sm text-slate-600">
        Validated screeners across mood, anxiety, attention, sleep, trauma, and substance use.
        Private — your answers and a decision-support summary go to your provider before your
        first visit. Not for emergencies: in crisis, call or text 988.
      </p>
      <IntakeBatteryClient />
    </PortalShell>
  );
}
