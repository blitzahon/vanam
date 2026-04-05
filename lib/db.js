import { neon } from "@neondatabase/serverless";

import { demoPayload } from "@/lib/demo-data";
import { getProjectAssetById, listProjectAssets, readLocalStore, writeLocalStore } from "@/lib/local-runtime";

const defaultNotificationSettings = {
  smsEnabled: false,
  animalRecipients: [],
  accidentRecipients: [],
  cooldownSeconds: 60,
  testRecipient: ""
};

function getSqlClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  return neon(connectionString);
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function canUseLocalRuntime() {
  return !Boolean(process.env.VERCEL);
}

export function hasTwilioConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

export function normalizeEventInput(input) {
  return {
    eventType: input.eventType ?? input.event_type ?? "Unknown",
    objectType: input.objectType ?? input.object_type ?? "Unknown",
    confidence: Number(input.confidence ?? 0),
    occurredAt: input.occurredAt ?? input.occurred_at ?? input.timestamp ?? new Date().toISOString(),
    cameraId: input.cameraId ?? input.camera_id ?? "CAM-01",
    zonePath: input.zonePath ?? input.zone_path ?? null,
    imageUrl: input.imageUrl ?? input.image_url ?? null
  };
}

export async function getDashboardPayload() {
  const sql = getSqlClient();
  if (!sql) {
    if (canUseLocalRuntime()) {
      const localPayload = await getLocalDashboardPayload();
      return withEnvironmentDetails(localPayload ?? demoPayload);
    }

    return withEnvironmentDetails(createNeedsSetupPayload());
  }

  try {
    const summaryRow = await sql`
      SELECT
        COUNT(*)::int AS "totalEvents",
        COALESCE(SUM(CASE WHEN event_type = 'Animal Crossing' THEN 1 ELSE 0 END), 0)::int AS "animalEvents",
        COALESCE(SUM(CASE WHEN event_type = 'Accident' THEN 1 ELSE 0 END), 0)::int AS "accidentEvents",
        COUNT(DISTINCT camera_id)::int AS "activeCameras",
        COALESCE(AVG(confidence), 0)::float AS "averageConfidence",
        MAX(occurred_at) AS "latestEventAt"
      FROM road_events
    `;

    const eventMix = await sql`
      SELECT event_type AS "eventType", COUNT(*)::int AS "count"
      FROM road_events
      GROUP BY event_type
      ORDER BY "count" DESC, "eventType" ASC
    `;

    const cameraBreakdown = await sql`
      SELECT camera_id AS "cameraId", COUNT(*)::int AS "count", MAX(occurred_at) AS "latestEventAt"
      FROM road_events
      GROUP BY camera_id
      ORDER BY "count" DESC, "cameraId" ASC
    `;

    const trend = await sql`
      WITH day_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        day_series.day::text AS "date",
        COALESCE(COUNT(road_events.id), 0)::int AS "count"
      FROM day_series
      LEFT JOIN road_events
        ON DATE(road_events.occurred_at) = day_series.day
      GROUP BY day_series.day
      ORDER BY day_series.day ASC
    `;

    const recentEvents = await sql`
      SELECT
        id,
        event_type AS "eventType",
        object_type AS "objectType",
        confidence,
        occurred_at AS "occurredAt",
        camera_id AS "cameraId",
        zone_path AS "zonePath",
        image_url AS "imageUrl"
      FROM road_events
      ORDER BY occurred_at DESC
      LIMIT 8
    `;

    const [cameraSources, notificationSettings, assetRegistry] = await Promise.all([
      getCameraSources(),
      getNotificationSettings(),
      listAssets()
    ]);

    return withEnvironmentDetails({
      mode: "database",
      generatedAt: new Date().toISOString(),
      summary: hydrateSummary(summaryRow[0]),
      eventMix: eventMix.map((row) => ({
        eventType: row.eventType,
        count: row.count
      })),
      cameraBreakdown: cameraBreakdown.map((row) => ({
        cameraId: row.cameraId,
        count: row.count,
        latestEventAt: row.latestEventAt
      })),
      trend: trend.map((row) => ({
        date: row.date,
        count: row.count
      })),
      recentEvents: recentEvents.map(hydrateEvent),
      cameraSources,
      notificationSettings,
      assetRegistry
    });
  } catch (error) {
    if (canUseLocalRuntime()) {
      const localPayload = await getLocalDashboardPayload();
      if (localPayload) {
        return withEnvironmentDetails(localPayload);
      }
    }

    return withEnvironmentDetails({
      ...createNeedsSetupPayload(),
      error: error instanceof Error ? error.message : "Unknown database error"
    });
  }
}

export async function getRecentEvents(limit = 25) {
  const sql = getSqlClient();
  if (!sql) {
    return canUseLocalRuntime() ? getLocalEvents(limit) : [];
  }

  try {
    const rows = await sql`
      SELECT
        id,
        event_type AS "eventType",
        object_type AS "objectType",
        confidence,
        occurred_at AS "occurredAt",
        camera_id AS "cameraId",
        zone_path AS "zonePath",
        image_url AS "imageUrl"
      FROM road_events
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `;

    return rows.map(hydrateEvent);
  } catch {
    return canUseLocalRuntime() ? getLocalEvents(limit) : [];
  }
}

export async function createEvent(input) {
  const sql = getSqlClient();
  if (!sql) {
    if (canUseLocalRuntime()) {
      return appendLocalEvent(input);
    }

    throw new Error("DATABASE_URL is not configured.");
  }

  const event = normalizeEventInput(input);

  try {
    const rows = await sql`
      INSERT INTO road_events (
        event_type,
        object_type,
        confidence,
        occurred_at,
        camera_id,
        zone_path,
        image_url
      )
      VALUES (
        ${event.eventType},
        ${event.objectType},
        ${event.confidence},
        ${event.occurredAt},
        ${event.cameraId},
        ${event.zonePath},
        ${event.imageUrl}
      )
      RETURNING
        id,
        event_type AS "eventType",
        object_type AS "objectType",
        confidence,
        occurred_at AS "occurredAt",
        camera_id AS "cameraId",
        zone_path AS "zonePath",
        image_url AS "imageUrl"
    `;

    return hydrateEvent(rows[0]);
  } catch {
    if (canUseLocalRuntime()) {
      return appendLocalEvent(event);
    }

    throw new Error("Unable to store the event without a configured database.");
  }
}

export async function getCameraSources() {
  const sql = getSqlClient();
  if (!sql) {
    return canUseLocalRuntime() ? getLocalCameraSources() : [];
  }

  try {
    const rows = await sql`
      SELECT
        id,
        camera_id AS "cameraId",
        source_type AS "sourceType",
        source_value AS "sourceValue",
        location_label AS "locationLabel",
        gps_lat AS "gpsLat",
        gps_lon AS "gpsLon",
        zone_label AS "zoneLabel",
        status,
        updated_at AS "updatedAt"
      FROM camera_sources
      ORDER BY camera_id ASC
    `;
    return rows.map(mapCameraSource);
  } catch {
    return canUseLocalRuntime() ? getLocalCameraSources() : [];
  }
}

export async function upsertCameraSource(input) {
  const sql = getSqlClient();
  if (!sql) {
    if (canUseLocalRuntime()) {
      return persistLocalCameraSource(input);
    }

    throw new Error("DATABASE_URL is not configured.");
  }

  const source = normalizeCameraSource(input);

  try {
    const rows = await sql`
      INSERT INTO camera_sources (
        camera_id,
        source_type,
        source_value,
        location_label,
        gps_lat,
        gps_lon,
        zone_label,
        status
      )
      VALUES (
        ${source.cameraId},
        ${source.sourceType},
        ${source.sourceValue},
        ${source.locationLabel},
        ${source.gpsLat},
        ${source.gpsLon},
        ${source.zoneLabel},
        ${source.status}
      )
      ON CONFLICT (camera_id)
      DO UPDATE SET
        source_type = EXCLUDED.source_type,
        source_value = EXCLUDED.source_value,
        location_label = EXCLUDED.location_label,
        gps_lat = EXCLUDED.gps_lat,
        gps_lon = EXCLUDED.gps_lon,
        zone_label = EXCLUDED.zone_label,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING
        id,
        camera_id AS "cameraId",
        source_type AS "sourceType",
        source_value AS "sourceValue",
        location_label AS "locationLabel",
        gps_lat AS "gpsLat",
        gps_lon AS "gpsLon",
        zone_label AS "zoneLabel",
        status,
        updated_at AS "updatedAt"
    `;

    return mapCameraSource(rows[0]);
  } catch {
    if (canUseLocalRuntime()) {
      return persistLocalCameraSource(source);
    }

    throw new Error("Unable to save the source without a configured database.");
  }
}

export async function getNotificationSettings() {
  const sql = getSqlClient();
  if (!sql) {
    return withTwilioDetails(canUseLocalRuntime() ? await getLocalNotificationSettings() : defaultNotificationSettings);
  }

  try {
    const setting = await getJsonSetting(sql, "notification_settings", defaultNotificationSettings);
    return withTwilioDetails({
      ...defaultNotificationSettings,
      ...setting,
      animalRecipients: normalizeRecipients(setting.animalRecipients),
      accidentRecipients: normalizeRecipients(setting.accidentRecipients),
      cooldownSeconds: normalizeCooldown(setting.cooldownSeconds),
      testRecipient: typeof setting.testRecipient === "string" ? setting.testRecipient.trim() : ""
    });
  } catch {
    return withTwilioDetails(canUseLocalRuntime() ? await getLocalNotificationSettings() : defaultNotificationSettings);
  }
}

export async function updateNotificationSettings(input) {
  const sql = getSqlClient();
  if (!sql) {
    if (canUseLocalRuntime()) {
      return persistLocalNotificationSettings(input);
    }

    throw new Error("DATABASE_URL is not configured.");
  }

  const normalized = {
    smsEnabled: Boolean(input.smsEnabled),
    animalRecipients: normalizeRecipients(input.animalRecipients),
    accidentRecipients: normalizeRecipients(input.accidentRecipients),
    cooldownSeconds: normalizeCooldown(input.cooldownSeconds),
    testRecipient: typeof input.testRecipient === "string" ? input.testRecipient.trim() : ""
  };

  await upsertJsonSetting(sql, "notification_settings", normalized);
  return withTwilioDetails(normalized);
}

export async function listAssets() {
  const projectAssets = await listProjectAssets();
  const sql = getSqlClient();
  if (!sql) {
    return canUseLocalRuntime() ? (projectAssets.length ? projectAssets : demoPayload.assetRegistry) : [];
  }

  try {
    const rows = await sql`
      SELECT
        id,
        asset_kind AS "assetKind",
        title,
        filename,
        content_type AS "contentType",
        file_size AS "fileSize",
        storage_mode AS "storageMode",
        external_url AS "externalUrl",
        notes,
        class_labels AS "classLabels",
        is_active AS "isActive",
        status,
        created_at AS "createdAt"
      FROM model_assets
      ORDER BY is_active DESC, created_at DESC
    `;
    return mergeAssetCollections(rows.map(hydrateAsset), projectAssets);
  } catch {
    return canUseLocalRuntime() ? projectAssets : [];
  }
}

export async function createAsset(input) {
  const sql = getSqlClient();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const asset = normalizeAssetInput(input);

  if (!asset.externalUrl && !asset.fileDataBase64) {
    throw new Error("Provide either an upload file or an external URL for the asset.");
  }

  if (asset.isActive) {
    await sql`UPDATE model_assets SET is_active = FALSE WHERE asset_kind = ${asset.assetKind}`;
  }

  const rows = await sql`
    INSERT INTO model_assets (
      asset_kind,
      title,
      filename,
      content_type,
      file_size,
      storage_mode,
      file_data_base64,
      external_url,
      notes,
      class_labels,
      is_active,
      status
    )
    VALUES (
      ${asset.assetKind},
      ${asset.title},
      ${asset.filename},
      ${asset.contentType},
      ${asset.fileSize},
      ${asset.storageMode},
      ${asset.fileDataBase64},
      ${asset.externalUrl},
      ${asset.notes},
      ${asset.classLabels.join(", ")},
      ${asset.isActive},
      ${asset.status}
    )
    RETURNING
      id,
      asset_kind AS "assetKind",
      title,
      filename,
      content_type AS "contentType",
      file_size AS "fileSize",
      storage_mode AS "storageMode",
      external_url AS "externalUrl",
      notes,
      class_labels AS "classLabels",
      is_active AS "isActive",
      status,
      created_at AS "createdAt"
  `;

  return hydrateAsset(rows[0]);
}

export async function getAssetById(assetId) {
  const sql = getSqlClient();
  if (!sql) {
    return canUseLocalRuntime() ? getProjectAssetById(assetId) : null;
  }

  try {
    const rows = await sql`
      SELECT
        id,
        asset_kind AS "assetKind",
        title,
        filename,
        content_type AS "contentType",
        file_size AS "fileSize",
        storage_mode AS "storageMode",
        file_data_base64 AS "fileDataBase64",
        external_url AS "externalUrl",
        notes,
        class_labels AS "classLabels",
        is_active AS "isActive",
        status,
        created_at AS "createdAt"
      FROM model_assets
      WHERE id = ${assetId}
      LIMIT 1
    `;

    if (!rows.length) {
      return canUseLocalRuntime() ? getProjectAssetById(assetId) : null;
    }

    const row = rows[0];
    return {
      ...hydrateAsset(row),
      fileDataBase64: row.fileDataBase64 ?? null,
      contentType: row.contentType ?? "application/octet-stream",
      filename: row.filename ?? `asset-${row.id}`
    };
  } catch {
    return canUseLocalRuntime() ? getProjectAssetById(assetId) : null;
  }
}

export async function getRuntimeConfig() {
  const [cameraSources, notificationSettings, assetRegistry] = await Promise.all([
    getCameraSources(),
    getNotificationSettings(),
    listAssets()
  ]);

  return {
    cameraSources,
    notificationSettings,
    activeAssets: assetRegistry.filter((asset) => asset.isActive)
  };
}

export async function getActiveRecognitionProfile() {
  const assetRegistry = await listAssets();
  const datasetAsset = pickActiveAsset(assetRegistry, "dataset");
  const classifierAsset = pickActiveAsset(assetRegistry, "trained-model");
  const monitoredSpecies = normalizeRecognitionLabels(
    classifierAsset?.classLabels?.length ? classifierAsset.classLabels : datasetAsset?.classLabels
  );

  return {
    datasetAsset,
    classifierAsset,
    monitoredSpecies
  };
}

export async function canSendSmsForEvent(eventType, cooldownSeconds) {
  const sql = getSqlClient();
  if (!sql) {
    return { allowed: false, reason: "database-unavailable" };
  }

  try {
    const rows = await sql`
      SELECT created_at AS "createdAt"
      FROM notification_dispatches
      WHERE channel = 'sms'
        AND event_type = ${eventType}
        AND status = 'sent'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!rows.length) {
      return { allowed: true, reason: "no-recent-dispatch" };
    }

    const lastSentAt = new Date(rows[0].createdAt);
    const elapsedSeconds = (Date.now() - lastSentAt.getTime()) / 1000;
    return elapsedSeconds >= cooldownSeconds
      ? { allowed: true, reason: "cooldown-complete" }
      : { allowed: false, reason: "cooldown-active", retryAfterSeconds: Math.ceil(cooldownSeconds - elapsedSeconds) };
  } catch {
    return { allowed: true, reason: "dispatch-log-unavailable" };
  }
}

export async function recordNotificationDispatch(input) {
  const sql = getSqlClient();
  if (!sql) {
    return null;
  }

  try {
    await sql`
      INSERT INTO notification_dispatches (
        channel,
        event_type,
        recipient,
        status,
        provider_message_id,
        response_body
      )
      VALUES (
        ${input.channel},
        ${input.eventType},
        ${input.recipient},
        ${input.status},
        ${input.providerMessageId ?? null},
        ${input.responseBody ?? null}
      )
    `;
  } catch {
    return null;
  }

  return true;
}

async function getJsonSetting(sql, key, fallback) {
  const rows = await sql`
    SELECT setting_value AS "settingValue"
    FROM platform_settings
    WHERE setting_key = ${key}
    LIMIT 1
  `;

  if (!rows.length) {
    return fallback;
  }

  const value = rows[0].settingValue;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value ?? fallback;
}

async function upsertJsonSetting(sql, key, value) {
  await sql`
    INSERT INTO platform_settings (setting_key, setting_value)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW()
  `;
}

function hydrateSummary(row) {
  return {
    totalEvents: row.totalEvents,
    animalEvents: row.animalEvents,
    accidentEvents: row.accidentEvents,
    activeCameras: row.activeCameras,
    averageConfidence: Number(row.averageConfidence ?? 0),
    latestEventAt: row.latestEventAt
  };
}

function hydrateEvent(row) {
  const confidence = Number(row.confidence ?? 0);
  return {
    id: row.id,
    eventType: row.eventType,
    objectType: row.objectType,
    confidence,
    confidencePct: Math.round(confidence * 100),
    confidenceLabel: confidence >= 0.85 ? "High" : confidence >= 0.6 ? "Medium" : "Low",
    occurredAt: row.occurredAt,
    cameraId: row.cameraId,
    zonePath: row.zonePath,
    imageUrl: row.imageUrl
  };
}

function hydrateAsset(row) {
  return {
    id: row.id,
    assetKind: row.assetKind,
    title: row.title,
    filename: row.filename,
    contentType: row.contentType,
    fileSize: Number(row.fileSize ?? 0),
    storageMode: row.storageMode,
    externalUrl: row.externalUrl,
    notes: row.notes,
    classLabels: splitClassLabels(row.classLabels),
    isActive: Boolean(row.isActive),
    status: row.status,
    createdAt: row.createdAt,
    downloadUrl: row.storageMode === "inline" ? `/api/assets/${row.id}` : row.externalUrl
  };
}

function mapCameraSource(row) {
  return {
    id: row.id,
    cameraId: row.cameraId,
    sourceType: row.sourceType,
    sourceValue: row.sourceValue,
    locationLabel: row.locationLabel,
    gpsLat: row.gpsLat === null ? null : Number(row.gpsLat),
    gpsLon: row.gpsLon === null ? null : Number(row.gpsLon),
    zoneLabel: row.zoneLabel,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

function normalizeCameraSource(input) {
  const cameraId = String(input.cameraId ?? "").trim();
  const sourceValue = String(input.sourceValue ?? "").trim();

  if (!cameraId) {
    throw new Error("Camera ID is required.");
  }

  if (!sourceValue) {
    throw new Error("Source value is required.");
  }

  return {
    cameraId,
    sourceType: String(input.sourceType ?? "video-file").trim() || "video-file",
    sourceValue,
    locationLabel: String(input.locationLabel ?? "").trim() || null,
    gpsLat: normalizeOptionalNumber(input.gpsLat),
    gpsLon: normalizeOptionalNumber(input.gpsLon),
    zoneLabel: String(input.zoneLabel ?? "").trim() || null,
    status: String(input.status ?? "active").trim() || "active"
  };
}

function normalizeAssetInput(input) {
  const assetKind = String(input.assetKind ?? "").trim();
  const title = String(input.title ?? "").trim();

  if (!assetKind) {
    throw new Error("Asset type is required.");
  }

  if (!title) {
    throw new Error("Asset title is required.");
  }

  return {
    assetKind,
    title,
    filename: input.filename ? String(input.filename).trim() : null,
    contentType: input.contentType ? String(input.contentType).trim() : null,
    fileSize: Number(input.fileSize ?? 0),
    storageMode: input.externalUrl ? "external-url" : "inline",
    fileDataBase64: input.fileDataBase64 ? String(input.fileDataBase64) : null,
    externalUrl: input.externalUrl ? String(input.externalUrl).trim() : null,
    notes: input.notes ? String(input.notes).trim() : null,
    classLabels: splitClassLabels(input.classLabels),
    isActive: Boolean(input.isActive),
    status: input.externalUrl ? "registered" : "ready"
  };
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeRecipients(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeCooldown(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 60;
  }
  return Math.round(number);
}

function splitClassLabels(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function withTwilioDetails(settings) {
  return {
    ...settings,
    hasTwilioConfig: hasTwilioConfig(),
    fromNumberMasked: process.env.TWILIO_FROM_NUMBER ? maskPhone(process.env.TWILIO_FROM_NUMBER) : null
  };
}

function withEnvironmentDetails(payload) {
  return {
    ...payload,
    hasDatabase: hasDatabase(),
    supportsLocalMediaProcessing: !Boolean(process.env.VERCEL),
    notificationSettings: withTwilioDetails(payload.notificationSettings ?? defaultNotificationSettings)
  };
}

function maskPhone(value) {
  const cleaned = String(value).trim();
  if (cleaned.length <= 4) {
    return cleaned;
  }
  return `${"*".repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
}

function createNeedsSetupPayload() {
  return {
    mode: "needs-setup",
    generatedAt: new Date().toISOString(),
    setupMessage: "Live incident data is not available in this environment yet.",
    summary: {
      totalEvents: 0,
      animalEvents: 0,
      accidentEvents: 0,
      activeCameras: 0,
      averageConfidence: 0,
      latestEventAt: null
    },
    eventMix: [],
    cameraBreakdown: [],
    trend: lastSevenDays(),
    recentEvents: [],
    cameraSources: [],
    notificationSettings: withTwilioDetails(defaultNotificationSettings),
    assetRegistry: []
  };
}

async function getLocalDashboardPayload() {
  const [store, assetRegistry, notificationSettings] = await Promise.all([
    readLocalStore(),
    listProjectAssets(),
    getLocalNotificationSettings()
  ]);

  const recentEvents = sortEventsDescending(store.roadEvents).map(hydrateEvent);
  const cameraSources = sortCameraSources(store.cameraSources);

  if (!recentEvents.length && !cameraSources.length && !assetRegistry.length) {
    return null;
  }

  return {
    mode: "local-runtime",
    generatedAt: new Date().toISOString(),
    summary: summarizeEvents(recentEvents),
    eventMix: buildEventMix(recentEvents),
    cameraBreakdown: buildCameraBreakdown(recentEvents),
    trend: buildTrend(recentEvents),
    recentEvents: recentEvents.slice(0, 8),
    cameraSources,
    notificationSettings,
    assetRegistry
  };
}

async function getLocalEvents(limit) {
  const store = await readLocalStore();
  return sortEventsDescending(store.roadEvents)
    .slice(0, limit)
    .map(hydrateEvent);
}

async function appendLocalEvent(input) {
  const event = normalizeEventInput(input);
  const store = await readLocalStore();
  const record = {
    id: nextLocalId(store.roadEvents),
    ...event
  };

  store.roadEvents = [record, ...store.roadEvents];
  await writeLocalStore(store);
  return hydrateEvent(record);
}

async function getLocalCameraSources() {
  const store = await readLocalStore();
  return sortCameraSources(store.cameraSources);
}

async function persistLocalCameraSource(input) {
  const source = normalizeCameraSource(input);
  const store = await readLocalStore();
  const existingIndex = store.cameraSources.findIndex((item) => item.cameraId === source.cameraId);
  const existing = existingIndex >= 0 ? store.cameraSources[existingIndex] : null;
  const nextSource = {
    id: existing?.id ?? nextLocalId(store.cameraSources),
    ...source,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    store.cameraSources.splice(existingIndex, 1, nextSource);
  } else {
    store.cameraSources.push(nextSource);
  }

  await writeLocalStore(store);
  return nextSource;
}

async function getLocalNotificationSettings() {
  const store = await readLocalStore();
  const localSettings = store.notificationSettings ?? defaultNotificationSettings;
  return {
    ...defaultNotificationSettings,
    ...localSettings,
    animalRecipients: normalizeRecipients(localSettings.animalRecipients),
    accidentRecipients: normalizeRecipients(localSettings.accidentRecipients),
    cooldownSeconds: normalizeCooldown(localSettings.cooldownSeconds),
    testRecipient: typeof localSettings.testRecipient === "string" ? localSettings.testRecipient.trim() : ""
  };
}

async function persistLocalNotificationSettings(input) {
  const normalized = {
    smsEnabled: Boolean(input.smsEnabled),
    animalRecipients: normalizeRecipients(input.animalRecipients),
    accidentRecipients: normalizeRecipients(input.accidentRecipients),
    cooldownSeconds: normalizeCooldown(input.cooldownSeconds),
    testRecipient: typeof input.testRecipient === "string" ? input.testRecipient.trim() : ""
  };

  const store = await readLocalStore();
  store.notificationSettings = normalized;
  await writeLocalStore(store);
  return withTwilioDetails(normalized);
}

function summarizeEvents(events) {
  const averageConfidence =
    events.length > 0 ? events.reduce((sum, event) => sum + Number(event.confidence ?? 0), 0) / events.length : 0;

  return {
    totalEvents: events.length,
    animalEvents: events.filter((event) => event.eventType === "Animal Crossing").length,
    accidentEvents: events.filter((event) => event.eventType === "Accident").length,
    activeCameras: new Set(events.map((event) => event.cameraId)).size,
    averageConfidence,
    latestEventAt: events[0]?.occurredAt ?? null
  };
}

function buildEventMix(events) {
  const counts = new Map();
  for (const event of events) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((left, right) => right.count - left.count || left.eventType.localeCompare(right.eventType));
}

function buildCameraBreakdown(events) {
  const counts = new Map();
  for (const event of events) {
    if (!counts.has(event.cameraId)) {
      counts.set(event.cameraId, {
        cameraId: event.cameraId,
        count: 0,
        latestEventAt: event.occurredAt
      });
    }

    const current = counts.get(event.cameraId);
    current.count += 1;
    if (new Date(event.occurredAt) > new Date(current.latestEventAt)) {
      current.latestEventAt = event.occurredAt;
    }
  }

  return Array.from(counts.values()).sort((left, right) => right.count - left.count || left.cameraId.localeCompare(right.cameraId));
}

function buildTrend(events) {
  const counts = new Map(lastSevenDays().map((entry) => [entry.date, 0]));
  for (const event of events) {
    const key = String(event.occurredAt).slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return lastSevenDays().map((entry) => ({
    date: entry.date,
    count: counts.get(entry.date) ?? 0
  }));
}

function sortEventsDescending(events) {
  return [...events].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function sortCameraSources(cameraSources) {
  return [...cameraSources].sort((left, right) => String(left.cameraId).localeCompare(String(right.cameraId)));
}

function nextLocalId(items) {
  return items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1;
}

function mergeAssetCollections(primaryAssets, secondaryAssets) {
  const seen = new Set();
  const merged = [];

  for (const asset of [...primaryAssets, ...secondaryAssets]) {
    const key = [asset.assetKind, asset.filename, asset.title, asset.localPath ?? "", asset.externalUrl ?? ""].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(asset);
  }

  return merged;
}

function pickActiveAsset(assets, assetKind) {
  return assets.find((asset) => asset.assetKind === assetKind && asset.isActive) ?? assets.find((asset) => asset.assetKind === assetKind) ?? null;
}

function normalizeRecognitionLabels(value) {
  return splitClassLabels(value).map((label) => label.toLowerCase());
}
