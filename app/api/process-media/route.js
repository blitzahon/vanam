import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { createEvent, getActiveRecognitionProfile, getAssetById, upsertCameraSource } from "@/lib/db";
import { ensureLocalRuntimeDirs, getRuntimeModelsDir, getUploadsDir, resolveProjectPath, toProjectRelative } from "@/lib/local-runtime";
import { stripBigInts } from "@/lib/strip-bigint";
import { requireProtectedAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const access = await requireProtectedAccess();
    if (!access.ok) {
      return access.response;
    }

    if (process.env.VERCEL) {
      return Response.json(
        {
          ok: false,
          error: "Local video upload and browser-camera processing are intended for the local workspace. Use persistent object storage before enabling this flow in Vercel production."
        },
        { status: 501 }
      );
    }

    await ensureLocalRuntimeDirs();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return Response.json({ ok: false, error: "A video file is required." }, { status: 400 });
    }

    const sourceType = normalizeValue(formData.get("sourceType"), "video-file");
    const cameraId = normalizeValue(formData.get("cameraId"), `SOURCE-${randomUUID().slice(0, 8).toUpperCase()}`);
    const locationLabel = normalizeValue(formData.get("locationLabel"), sourceType === "browser-camera" ? "Browser camera" : "Uploaded sample");
    const extension = path.extname(file.name) || getExtensionForMimeType(file.type);
    const safeFilename = `${Date.now()}-${sanitizeSegment(cameraId)}${extension}`;
    const absoluteUploadPath = path.join(getUploadsDir(), safeFilename);
    const relativeUploadPath = toProjectRelative(absoluteUploadPath);
    const arrayBuffer = await file.arrayBuffer();

    await writeFile(absoluteUploadPath, Buffer.from(arrayBuffer));
    await upsertCameraSource({
      cameraId,
      sourceType,
      sourceValue: relativeUploadPath,
      locationLabel,
      zoneLabel: normalizeValue(formData.get("zoneLabel"), null),
      status: "active"
    });

    const recognitionProfile = await getActiveRecognitionProfile();
    const classifierModelPath = await resolveClassifierModelPath(recognitionProfile.classifierAsset);
    const processorResult = await runProcessor({
      videoPath: absoluteUploadPath,
      cameraId,
      classifierModelPath,
      allowedAnimalLabels: recognitionProfile.monitoredSpecies
    });

    const createdEvents = [];
    for (const event of processorResult.events ?? []) {
      createdEvents.push(
        await createEvent({
          eventType: event.eventType,
          objectType: event.objectType,
          confidence: event.confidence,
          occurredAt: event.occurredAt,
          cameraId: event.cameraId,
          zonePath: event.zonePath,
          imageUrl: event.imageUrl
        })
      );
    }

    return Response.json(
      stripBigInts({
        ok: true,
        source: {
          cameraId,
          sourceType,
          sourceValue: relativeUploadPath,
          locationLabel
        },
        classifierModel: processorResult.classifierModel ?? null,
        recognitionProfile: {
          datasetTitle: recognitionProfile.datasetAsset?.title ?? null,
          classifierTitle: recognitionProfile.classifierAsset?.title ?? null,
          monitoredSpecies: recognitionProfile.monitoredSpecies
        },
        eventCount: createdEvents.length,
        events: createdEvents
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process media input.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveClassifierModelPath(classifierAsset) {
  if (!classifierAsset) {
    return null;
  }

  if (classifierAsset.storageMode === "local-file" && classifierAsset.localPath) {
    return resolveProjectPath(classifierAsset.localPath);
  }

  if (classifierAsset.storageMode !== "inline") {
    return null;
  }

  const fullAsset = await getAssetById(classifierAsset.id);
  if (!fullAsset?.fileDataBase64) {
    return null;
  }

  const extension = path.extname(fullAsset.filename || "") || ".pt";
  const outputPath = path.join(
    getRuntimeModelsDir(),
    `${classifierAsset.id}-${sanitizeSegment(path.basename(fullAsset.filename || classifierAsset.title, extension))}${extension}`
  );

  await writeFile(outputPath, Buffer.from(fullAsset.fileDataBase64, "base64"));
  return outputPath;
}

function runProcessor({ videoPath, cameraId, classifierModelPath, allowedAnimalLabels }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "process_media.py");
    const args = [scriptPath, "--video", videoPath, "--camera", cameraId];

    if (classifierModelPath) {
      args.push("--animal-cls-model", classifierModelPath);
    }

    if (allowedAnimalLabels?.length) {
      args.push("--allowed-animal-labels", JSON.stringify(allowedAnimalLabels));
    }

    const child = spawn(process.env.PYTHON_BIN || "python", args, {
      cwd: process.cwd(),
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const payload = parseProcessorPayload(stdout);
      if (code !== 0 || !payload?.ok) {
        reject(new Error(payload?.error || stderr.trim() || stdout.trim() || `Processor exited with code ${code}.`));
        return;
      }

      resolve(payload);
    });
  });
}

function parseProcessorPayload(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      continue;
    }
  }

  return null;
}

function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function normalizeValue(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function getExtensionForMimeType(mimeType) {
  if (mimeType === "video/webm") {
    return ".webm";
  }

  if (mimeType === "video/quicktime") {
    return ".mov";
  }

  return ".mp4";
}
