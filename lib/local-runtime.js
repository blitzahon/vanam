import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp"]);
const baseDir = process.cwd();
const runtimeDir = path.join(baseDir, "runtime");
const runtimeModelsDir = path.join(runtimeDir, "models");
const storePath = path.join(runtimeDir, "local-store.json");
const datasetsDir = path.join(baseDir, "datasets");
const runsDir = path.join(baseDir, "runs");
const eventsDir = path.join(baseDir, "events");
const uploadsDir = path.join(baseDir, "videos", "uploads");

export async function ensureLocalRuntimeDirs() {
  await Promise.all([
    mkdir(runtimeDir, { recursive: true }),
    mkdir(runtimeModelsDir, { recursive: true }),
    mkdir(eventsDir, { recursive: true }),
    mkdir(uploadsDir, { recursive: true })
  ]);
}

export function getEventsDir() {
  return eventsDir;
}

export function getUploadsDir() {
  return uploadsDir;
}

export function getRuntimeModelsDir() {
  return runtimeModelsDir;
}

export function getBaseDir() {
  return baseDir;
}

export function toProjectRelative(targetPath) {
  return path.relative(baseDir, targetPath).split(path.sep).join("/");
}

export function resolveProjectPath(relativePath) {
  return path.resolve(baseDir, relativePath);
}

export async function readLocalStore() {
  await ensureLocalRuntimeDirs();

  if (!existsSync(storePath)) {
    const initial = getDefaultLocalStore();
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const content = await readFile(storePath, "utf8");
    const parsed = JSON.parse(content);
    return normalizeStoreShape(parsed);
  } catch {
    return getDefaultLocalStore();
  }
}

export async function writeLocalStore(store) {
  await ensureLocalRuntimeDirs();
  await writeFile(storePath, JSON.stringify(normalizeStoreShape(store), null, 2), "utf8");
}

export async function listProjectAssets() {
  await ensureLocalRuntimeDirs();
  const [datasetAssets, modelAssets] = await Promise.all([discoverDatasets(), discoverClassifierModels()]);
  return [...modelAssets, ...datasetAssets];
}

export async function getProjectAssetById(assetId) {
  const assets = await listProjectAssets();
  return assets.find((asset) => Number(asset.id) === Number(assetId)) ?? null;
}

export async function getPreferredClassifierModelPath() {
  const models = await discoverClassifierModels();
  const activeModel = models.find((asset) => asset.isActive) ?? models[0] ?? null;
  return activeModel?.localPath ? resolveProjectPath(activeModel.localPath) : null;
}

function getDefaultLocalStore() {
  return {
    roadEvents: [],
    cameraSources: [],
    notificationSettings: {
      smsEnabled: false,
      animalRecipients: [],
      accidentRecipients: [],
      cooldownSeconds: 60,
      testRecipient: ""
    }
  };
}

function normalizeStoreShape(store) {
  return {
    ...getDefaultLocalStore(),
    ...store,
    roadEvents: Array.isArray(store?.roadEvents) ? store.roadEvents : [],
    cameraSources: Array.isArray(store?.cameraSources) ? store.cameraSources : [],
    notificationSettings: {
      ...getDefaultLocalStore().notificationSettings,
      ...(store?.notificationSettings ?? {})
    }
  };
}

async function discoverDatasets() {
  if (!existsSync(datasetsDir)) {
    return [];
  }

  const entries = await readdir(datasetsDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).sort((left, right) => left.name.localeCompare(right.name));
  const assets = [];

  for (const [index, directory] of directories.entries()) {
    const datasetPath = path.join(datasetsDir, directory.name);
    const details = await inspectDataset(datasetPath);
    const stats = await stat(datasetPath);

    assets.push({
      id: 900100 + index,
      assetKind: "dataset",
      title: humanizeName(directory.name),
      filename: directory.name,
      contentType: "application/x-directory",
      fileSize: details.totalImages,
      storageMode: "local-file",
      externalUrl: null,
      notes: `${details.totalImages} images across ${details.classLabels.length || 0} classes in the local project dataset.`,
      classLabels: details.classLabels,
      isActive: index === 0,
      status: details.totalImages ? "connected" : "empty",
      createdAt: stats.mtime.toISOString(),
      downloadUrl: `/api/assets/${900100 + index}`,
      localPath: toProjectRelative(datasetPath)
    });
  }

  return assets;
}

async function discoverClassifierModels() {
  const classifyDir = path.join(runsDir, "classify");
  if (!existsSync(classifyDir)) {
    return [];
  }

  const entries = await readdir(classifyDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const weightsPath = path.join(classifyDir, entry.name, "weights", "best.pt");
    if (!existsSync(weightsPath)) {
      continue;
    }

    const stats = await stat(weightsPath);
    candidates.push({
      runName: entry.name,
      weightsPath,
      stats
    });
  }

  candidates.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);

  return candidates.map((candidate, index) => ({
    id: 900000 + index,
    assetKind: "trained-model",
    title: `Animal classifier (${humanizeName(candidate.runName)})`,
    filename: path.basename(candidate.weightsPath),
    contentType: "application/octet-stream",
    fileSize: candidate.stats.size,
    storageMode: "local-file",
    externalUrl: null,
    notes: `Local trained classifier checkpoint discovered in ${toProjectRelative(path.dirname(candidate.weightsPath))}.`,
    classLabels: [],
    isActive: index === 0,
    status: "ready",
    createdAt: candidate.stats.mtime.toISOString(),
    downloadUrl: `/api/assets/${900000 + index}`,
    localPath: toProjectRelative(candidate.weightsPath)
  }));
}

async function inspectDataset(datasetPath) {
  const splitDirectories = ["train", "val", "valid", "test"];
  const classLabels = new Set();
  let totalImages = 0;

  for (const split of splitDirectories) {
    const splitPath = path.join(datasetPath, split);
    if (!existsSync(splitPath)) {
      continue;
    }

    const classEntries = await readdir(splitPath, { withFileTypes: true });
    for (const entry of classEntries) {
      if (!entry.isDirectory()) {
        continue;
      }

      classLabels.add(entry.name);
      const classPath = path.join(splitPath, entry.name);
      const imageEntries = await readdir(classPath, { withFileTypes: true });
      totalImages += imageEntries.filter(
        (imageEntry) => imageEntry.isFile() && IMAGE_EXTENSIONS.has(path.extname(imageEntry.name).toLowerCase())
      ).length;
    }
  }

  return {
    totalImages,
    classLabels: Array.from(classLabels).sort((left, right) => left.localeCompare(right))
  };
}

function humanizeName(value) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
