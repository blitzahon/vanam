import { getNotificationSettings, updateNotificationSettings } from "@/lib/db";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const notificationSettings = await getNotificationSettings();
  return Response.json({ ok: true, notificationSettings });
}

export async function POST(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const body = await request.json();
    const notificationSettings = await updateNotificationSettings(body);
    return Response.json({ ok: true, notificationSettings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save notification settings.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
