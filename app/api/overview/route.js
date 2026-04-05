import { getDashboardErrorPayload, getDashboardPayload } from "@/lib/db";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const access = await requireProtectedAccess();
    if (!access.ok) {
      return access.response;
    }

    const payload = await getDashboardPayload();
    return Response.json(payload);
  } catch (error) {
    console.error("[api/overview]", error);
    const message = error instanceof Error ? error.message : "Unable to load overview.";
    return Response.json(getDashboardErrorPayload(message));
  }
}
