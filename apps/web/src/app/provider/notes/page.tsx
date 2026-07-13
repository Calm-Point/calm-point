import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";
import { NotesClient } from "./notes-client";
import { PROVIDER_NAV } from "../provider-nav";

export default async function ProviderNotesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <PortalShell
      title="Notes"
      userName={session.user.name ?? ""}
      roleLabel="Provider"
      nav={PROVIDER_NAV}
    >
      <NotesClient />
    </PortalShell>
  );
}
