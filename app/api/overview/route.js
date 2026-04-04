import { getDashboardPayload } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getDashboardPayload();
  return Response.json(payload);
}
