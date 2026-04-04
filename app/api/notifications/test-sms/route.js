import { sendTestSms } from "@/lib/notifications";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const body = await request.json();
    const result = await sendTestSms(body);
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send SMS test.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
