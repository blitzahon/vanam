import { readFile } from "node:fs/promises";

import { getAssetById } from "@/lib/db";
import { getBaseDir, resolveProjectPath } from "@/lib/local-runtime";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const { assetId } = params;
  const asset = await getAssetById(Number(assetId));

  if (!asset) {
    return Response.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  if (asset.storageMode === "external-url" && asset.externalUrl) {
    return Response.redirect(asset.externalUrl, 302);
  }

  if (asset.storageMode === "local-file" && asset.localPath) {
    const absolutePath = resolveProjectPath(asset.localPath);
    if (!absolutePath.startsWith(getBaseDir())) {
      return Response.json({ ok: false, error: "Asset path is not allowed." }, { status: 403 });
    }

    try {
      const content = await readFile(absolutePath);
      return new Response(content, {
        headers: {
          "Content-Type": asset.contentType ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${asset.filename}"`
        }
      });
    } catch {
      return Response.json({ ok: false, error: "Asset content is unavailable." }, { status: 404 });
    }
  }

  if (!asset.fileDataBase64) {
    return Response.json({ ok: false, error: "Asset content is unavailable." }, { status: 404 });
  }

  const content = Buffer.from(asset.fileDataBase64, "base64");

  return new Response(content, {
    headers: {
      "Content-Type": asset.contentType,
      "Content-Disposition": `attachment; filename="${asset.filename}"`
    }
  });
}
