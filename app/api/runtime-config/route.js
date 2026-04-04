import { getRuntimeConfig } from "@/lib/db";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const config = await getRuntimeConfig();
  return Response.json({ ok: true, config });
}
