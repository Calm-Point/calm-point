import { requireRole, authzErrorResponse } from "@/server/authorize";
import { erxVendor } from "@/server/erx";

export const runtime = "nodejs";

/** GET ?q=&state= → pharmacy directory search via the active eRx vendor. */
export async function GET(req: Request) {
  try {
    await requireRole("PROVIDER");
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const state = url.searchParams.get("state") ?? undefined;
    if (q.length < 2) return Response.json({ pharmacies: [] });
    const pharmacies = await erxVendor().searchPharmacies(q, state);
    return Response.json({ pharmacies });
  } catch (err) {
    const known = authzErrorResponse(err);
    if (known) return known;
    const message = err instanceof Error ? err.message : "Internal error";
    return Response.json({ error: message }, { status: 400 });
  }
}
