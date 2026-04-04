import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it before running db:seed.");
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

const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM road_events`;

if (count > 0) {
  console.log("road_events already contains data. Seed skipped.");
  process.exit(0);
}

await sql`
  INSERT INTO road_events (event_type, object_type, confidence, occurred_at, camera_id, zone_path, image_url)
  VALUES
    ('Accident', '2 vehicles (collision proximity)', 0.98, NOW() - INTERVAL '8 minutes', 'CAM-01', NULL, NULL),
    ('Animal Crossing', 'Horse', 0.93, NOW() - INTERVAL '14 minutes', 'CAM-03', 'A -> B -> C', NULL),
    ('Animal Crossing', 'Elephant', 0.91, NOW() - INTERVAL '31 minutes', 'CAM-04', 'C -> B -> A', NULL),
    ('Accident', '1 vehicle(s)', 0.88, NOW() - INTERVAL '47 minutes', 'CAM-02', NULL, NULL),
    ('Animal Crossing', 'Dog', 0.82, NOW() - INTERVAL '2 hours', 'CAM-01', 'A -> B -> C', NULL),
    ('Accident', '3 vehicles', 0.86, NOW() - INTERVAL '4 hours', 'CAM-04', NULL, NULL)
`;

console.log("Seeded sample VANAM events.");
