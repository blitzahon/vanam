import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote

from paths import BASE_DIR, DB_PATH, ensure_runtime_dirs, relative_to_base


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the SQLite database and event table if needed."""
    ensure_runtime_dirs()
    with _get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type  TEXT    NOT NULL,
                object_type TEXT,
                timestamp   TEXT    NOT NULL,
                confidence  REAL,
                image_path  TEXT,
                camera_id   TEXT    DEFAULT 'CAM-01',
                zone_path   TEXT
            )
            """
        )
        conn.commit()


def log_event(
    event_type: str,
    object_type: str,
    timestamp: str,
    confidence: float,
    image_path: str | Path | None,
    camera_id: str = "CAM-01",
    zone_path: str | None = None,
) -> int:
    """Insert a new event record and return its primary key."""
    init_db()
    stored_path = relative_to_base(image_path) if image_path else None
    with _get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events (event_type, object_type, timestamp, confidence,
                                image_path, camera_id, zone_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_type,
                object_type,
                timestamp,
                confidence,
                stored_path,
                camera_id,
                zone_path,
            ),
        )
        conn.commit()
        return int(cursor.lastrowid)


def fetch_all_events(limit: int | None = None) -> list[dict[str, Any]]:
    """Return serialized events ordered by most recent first."""
    init_db()
    query = "SELECT * FROM events ORDER BY timestamp DESC, id DESC"
    params: tuple[Any, ...] = ()
    if limit is not None:
        query += " LIMIT ?"
        params = (limit,)

    with _get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_serialize_event(row) for row in rows]


def fetch_recent_events(limit: int = 8) -> list[dict[str, Any]]:
    return fetch_all_events(limit=limit)


def fetch_events_by_type(event_type: str, limit: int | None = None) -> list[dict[str, Any]]:
    """Return serialized events filtered by event type."""
    init_db()
    query = "SELECT * FROM events WHERE event_type = ? ORDER BY timestamp DESC, id DESC"
    params: tuple[Any, ...] = (event_type,)
    if limit is not None:
        query += " LIMIT ?"
        params = (event_type, limit)

    with _get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_serialize_event(row) for row in rows]


def fetch_summary() -> dict[str, Any]:
    """Aggregate high-level dashboard metrics."""
    init_db()
    with _get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_events,
                SUM(CASE WHEN event_type = 'Animal Crossing' THEN 1 ELSE 0 END) AS animal_events,
                SUM(CASE WHEN event_type = 'Accident' THEN 1 ELSE 0 END) AS accident_events,
                COUNT(DISTINCT camera_id) AS active_cameras,
                AVG(confidence) AS avg_confidence,
                MAX(timestamp) AS latest_event_at
            FROM events
            """
        ).fetchone()

    return {
        "total_events": int(row["total_events"] or 0),
        "animal_events": int(row["animal_events"] or 0),
        "accident_events": int(row["accident_events"] or 0),
        "active_cameras": int(row["active_cameras"] or 0),
        "avg_confidence": round(float(row["avg_confidence"] or 0.0), 2),
        "latest_event_at": row["latest_event_at"],
    }


def fetch_event_mix() -> list[dict[str, Any]]:
    """Return counts grouped by event type."""
    init_db()
    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT event_type, COUNT(*) AS count
            FROM events
            GROUP BY event_type
            ORDER BY count DESC, event_type ASC
            """
        ).fetchall()

    return [{"event_type": row["event_type"], "count": int(row["count"])} for row in rows]


def fetch_camera_breakdown() -> list[dict[str, Any]]:
    """Return per-camera event counts."""
    init_db()
    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT camera_id, COUNT(*) AS count, MAX(timestamp) AS latest_event_at
            FROM events
            GROUP BY camera_id
            ORDER BY count DESC, camera_id ASC
            """
        ).fetchall()

    return [
        {
            "camera_id": row["camera_id"] or "CAM-01",
            "count": int(row["count"]),
            "latest_event_at": row["latest_event_at"],
        }
        for row in rows
    ]


def fetch_event_trend(days: int = 7) -> list[dict[str, Any]]:
    """Return a day-by-day event trend for the most recent window."""
    init_db()
    today = datetime.now().date()
    start_date = today - timedelta(days=max(days - 1, 0))
    labels = [(start_date + timedelta(days=offset)).isoformat() for offset in range(days)]

    with _get_connection() as conn:
        rows = conn.execute(
            """
            SELECT substr(timestamp, 1, 10) AS day, COUNT(*) AS count
            FROM events
            WHERE substr(timestamp, 1, 10) >= ?
            GROUP BY day
            ORDER BY day ASC
            """,
            (start_date.isoformat(),),
        ).fetchall()

    counts = {row["day"]: int(row["count"]) for row in rows}
    return [{"date": day, "count": counts.get(day, 0)} for day in labels]


def fetch_dashboard_payload(limit: int = 8) -> dict[str, Any]:
    """Return the normalized payload required by the dashboard UI."""
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "summary": fetch_summary(),
        "event_mix": fetch_event_mix(),
        "camera_breakdown": fetch_camera_breakdown(),
        "trend": fetch_event_trend(),
        "recent_events": fetch_recent_events(limit=limit),
    }


def _serialize_event(row: sqlite3.Row) -> dict[str, Any]:
    image_path = row["image_path"] or ""
    image_url = ""
    image_available = False

    if image_path:
        resolved_path = (BASE_DIR / image_path).resolve()
        try:
            resolved_path.relative_to(BASE_DIR.resolve())
            image_available = resolved_path.exists()
            if image_available:
                image_url = f"/event-asset?path={quote(image_path)}"
        except ValueError:
            image_available = False

    confidence = round(float(row["confidence"] or 0.0), 2)
    return {
        "id": int(row["id"]),
        "event_type": row["event_type"],
        "object_type": row["object_type"] or "Unknown",
        "timestamp": row["timestamp"],
        "confidence": confidence,
        "confidence_pct": int(confidence * 100),
        "confidence_label": _confidence_label(confidence),
        "camera_id": row["camera_id"] or "CAM-01",
        "zone_path": row["zone_path"],
        "image_path": image_path,
        "image_url": image_url,
        "image_available": image_available,
    }


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.85:
        return "High"
    if confidence >= 0.60:
        return "Medium"
    return "Low"
