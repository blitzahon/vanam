import { getCameraSources, upsertCameraSource } from "@/lib/db";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const cameraSources = await getCameraSources();
  return Response.json({ ok: true, cameraSources });
}

export async function POST(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const body = await request.json();
    const cameraSource = await upsertCameraSource(body);
    return Response.json({ ok: true, cameraSource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save camera source.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
