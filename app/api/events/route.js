import { createEvent, getRecentEvents, hasDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const events = await getRecentEvents(Number.isFinite(limit) ? limit : 25);
  return Response.json({
    mode: hasDatabase() ? "database" : "demo",
    events
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const created = await createEvent(body);
    return Response.json({ ok: true, event: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create event.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
