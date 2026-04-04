import { createAsset, listAssets } from "@/lib/db";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  const assets = await listAssets();
  return Response.json({ ok: true, assets });
}

export async function POST(request) {
  const access = await requireProtectedAccess();
  if (!access.ok) {
    return access.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    let uploadFields = {};

    if (file instanceof File && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      uploadFields = {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileDataBase64: Buffer.from(arrayBuffer).toString("base64")
      };
    }

    const asset = await createAsset({
      assetKind: formData.get("assetKind"),
      title: formData.get("title"),
      classLabels: formData.get("classLabels"),
      notes: formData.get("notes"),
      externalUrl: formData.get("externalUrl"),
      isActive: formData.get("isActive") === "true",
      ...uploadFields
    });

    return Response.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create asset.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
