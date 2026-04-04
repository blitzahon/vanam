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

await sql`
  CREATE TABLE IF NOT EXISTS camera_sources (
    id BIGSERIAL PRIMARY KEY,
    camera_id TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    source_value TEXT NOT NULL,
    location_label TEXT,
    gps_lat DOUBLE PRECISION,
    gps_lon DOUBLE PRECISION,
    zone_label TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS model_assets (
    id BIGSERIAL PRIMARY KEY,
    asset_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    filename TEXT,
    content_type TEXT,
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_mode TEXT NOT NULL DEFAULT 'inline',
    file_data_base64 TEXT,
    external_url TEXT,
    notes TEXT,
    class_labels TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS notification_dispatches (
    id BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,
    event_type TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS road_events_occurred_at_idx ON road_events (occurred_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS road_events_camera_id_idx ON road_events (camera_id)`;
await sql`CREATE INDEX IF NOT EXISTS road_events_event_type_idx ON road_events (event_type)`;
await sql`CREATE INDEX IF NOT EXISTS camera_sources_camera_id_idx ON camera_sources (camera_id)`;
await sql`CREATE INDEX IF NOT EXISTS model_assets_kind_idx ON model_assets (asset_kind, is_active DESC, created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS notification_dispatches_channel_event_idx ON notification_dispatches (channel, event_type, created_at DESC)`;

await sql`
  INSERT INTO platform_settings (setting_key, setting_value)
  VALUES (
    'notification_settings',
    '{"smsEnabled": false, "animalRecipients": [], "accidentRecipients": [], "cooldownSeconds": 60, "testRecipient": ""}'::jsonb
  )
  ON CONFLICT (setting_key) DO NOTHING
`;

console.log("Database schema is ready.");
