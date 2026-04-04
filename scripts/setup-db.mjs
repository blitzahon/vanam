import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it before running db:setup.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS road_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    camera_id TEXT NOT NULL DEFAULT 'CAM-01',
    zone_path TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS road_events_occurred_at_idx ON road_events (occurred_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS road_events_camera_id_idx ON road_events (camera_id)`;
await sql`CREATE INDEX IF NOT EXISTS road_events_event_type_idx ON road_events (event_type)`;

console.log("Database schema is ready.");
