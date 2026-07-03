import { redirect } from "next/navigation";
import { prisma } from "@calm-point/db";
import { Card, CardTitle, CardDescription } from "@calm-point/ui";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

import { ADMIN_NAV as NAV } from "./admin-nav";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [patients, providers, auditEvents] = await Promise.all([
    prisma.user.count({ where: { role: "PATIENT" } }),
    prisma.user.count({ where: { role: "PROVIDER" } }),
    prisma.auditEvent.count(),
  ]);

  return (
    <PortalShell
      title="Platform overview"
      userName={session.user.name ?? ""}
      roleLabel="Admin"
      nav={NAV}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardTitle className="text-3xl">{patients}</CardTitle>
          <CardDescription>Patients</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-3xl">{providers}</CardTitle>
          <CardDescription>Providers</CardDescription>
        </Card>
        <Card>
          <CardTitle className="text-3xl">{auditEvents}</CardTitle>
          <CardDescription>Audit events recorded</CardDescription>
        </Card>
      </div>
    </PortalShell>
  );
}
