import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { VerifyClient } from "@/components/verify-client";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/appointments", label: "Appointments" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/care", label: "My care" },
];

export default async function VerifyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Verify identity & coverage"
      userName={session.user.name ?? ""}
      roleLabel="Patient"
      nav={NAV}
    >
      <p className="mb-4 max-w-xl text-sm text-ink-soft">
        Required before your first visit. Photos are encrypted at rest and shared only with your
        care team — never public.
      </p>
      <VerifyClient />
    </PortalShell>
  );
}
