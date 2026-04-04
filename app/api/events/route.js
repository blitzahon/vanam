import { createEvent, getRecentEvents, hasDatabase } from "@/lib/db";
import { dispatchSmsForEvent } from "@/lib/notifications";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const events = await getRecentEvents(Number.isFinite(limit) ? limit : 25);
  return Response.json({
    mode: hasDatabase() ? "database" : "demo",
    events
  });
}

export async function POST(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const body = await request.json();
    const created = await createEvent(body);
    const smsDispatch = await dispatchSmsForEvent(created);
    return Response.json({ ok: true, event: created, notifications: { sms: smsDispatch } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create event.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
