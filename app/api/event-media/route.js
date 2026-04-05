import { readFile } from "node:fs/promises";
import path from "node:path";

import { getBaseDir, getEventsDir, resolveProjectPath } from "@/lib/local-runtime";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const relativePath = request.nextUrl.searchParams.get("path");
  if (!relativePath) {
    return Response.json({ ok: false, error: "Event path is required." }, { status: 400 });
  }

  const absolutePath = resolveProjectPath(relativePath);
  const eventsPath = getEventsDir();
  const basePath = getBaseDir();

  if (!absolutePath.startsWith(eventsPath) || !absolutePath.startsWith(basePath)) {
    return Response.json({ ok: false, error: "Event path is not allowed." }, { status: 403 });
  }

  try {
    const content = await readFile(absolutePath);
    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : "image/jpeg";

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return Response.json({ ok: false, error: "Event image not found." }, { status: 404 });
  }
}
