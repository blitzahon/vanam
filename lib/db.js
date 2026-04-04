import { neon } from "@neondatabase/serverless";

import { demoPayload } from "@/lib/demo-data";

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
    return demoPayload;
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

    return {
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
      recentEvents: recentEvents.map(hydrateEvent)
    };
  } catch (error) {
    return {
      mode: "needs-setup",
      generatedAt: new Date().toISOString(),
      setupMessage: "Database connected, but the schema is not ready. Run npm run db:setup and optionally npm run db:seed.",
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
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  }
}

export async function getRecentEvents(limit = 25) {
  const sql = getSqlClient();
  if (!sql) {
    return demoPayload.recentEvents.slice(0, limit);
  }

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
}

export async function createEvent(input) {
  const sql = getSqlClient();
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const event = normalizeEventInput(input);

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

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { date: date.toISOString().slice(0, 10), count: 0 };
  });
}
