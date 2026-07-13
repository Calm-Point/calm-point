import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { ProviderPatientChartClient } from "@/components/provider-patient-chart-client";
import { PROVIDER_NAV } from "../../provider-nav";

export default async function PatientChartPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { patientId } = await params;
  return (
    <PortalShell
      title="Patient chart"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={PROVIDER_NAV}
    >
      <ProviderPatientChartClient patientId={patientId} />
    </PortalShell>
  );
}
