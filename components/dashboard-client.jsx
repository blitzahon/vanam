"use client";

import { useEffect, useState } from "react";

const refreshInterval = 10000;

export function DashboardClient({ initialPayload }) {
  const [payload, setPayload] = useState(initialPayload);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const nextPayload = await response.json();
        setPayload(nextPayload);
      } catch {
        // Keep the last successful payload if refresh fails.
      }
    }, refreshInterval);

    return () => clearInterval(timer);
  }, []);

  const summary = payload.summary;

  return (
    <div className="dashboard-shell">
      <section className="mode-banner">
        <div>
          <p className="mode-eyebrow">
            {payload.mode === "database" ? "Live database mode" : payload.mode === "needs-setup" ? "Database setup required" : "Demo mode"}
          </p>
          <h2>
            {payload.mode === "database"
              ? "VANAM is reading from Neon Postgres on a Vercel-ready API layer."
              : payload.mode === "needs-setup"
                ? "The frontend is connected, but the Postgres schema still needs to be created."
                : "The product UI is live and ready to switch to a real database."}
          </h2>
        </div>
        <div className="mode-meta">
          <span>Refreshes every 10s</span>
          <span>{formatDateTime(payload.generatedAt)}</span>
        </div>
      </section>

      {payload.setupMessage ? <section className="setup-card">{payload.setupMessage}</section> : null}

      <section className="metrics-grid">
        <MetricCard label="Total Events" value={summary.totalEvents} note={summary.latestEventAt ? `Latest: ${formatDateTime(summary.latestEventAt)}` : "No incidents logged yet"} />
        <MetricCard label="Animal Crossings" value={summary.animalEvents} note="Tracked wildlife movement" />
        <MetricCard label="Accidents" value={summary.accidentEvents} note="Detected vehicle incidents" />
        <MetricCard label="Average Confidence" value={`${Math.round((summary.averageConfidence ?? 0) * 100)}%`} note={`${summary.activeCameras} active camera source(s)`} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-stack">
          <Panel title="Event velocity" subtitle="A seven-day pulse of VANAM activity.">
            <div className="trend-chart">
              {payload.trend.map((point) => {
                const maxCount = Math.max(...payload.trend.map((entry) => entry.count), 1);
                const height = Math.max(18, Math.round((point.count / maxCount) * 180));
                return (
                  <div className="trend-column" key={point.date}>
                    <span className="trend-value">{point.count}</span>
                    <div className="trend-bar" style={{ height }} />
                    <span className="trend-label">{formatDate(point.date)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Recent incidents" subtitle="Evidence-ready operational feed from the platform.">
            <div className="event-grid">
              {payload.recentEvents.length ? (
                payload.recentEvents.map((event) => <EventCard event={event} key={event.id} />)
              ) : (
                <EmptyState message="No events are in the database yet. Use the ingest API or seed script to populate the dashboard." />
              )}
            </div>
          </Panel>
        </div>

        <div className="dashboard-stack">
          <Panel title="Event mix" subtitle="Distribution of detected incident classes.">
            <div className="pill-group">
              {payload.eventMix.length ? (
                payload.eventMix.map((item) => (
                  <div className="stat-pill" key={item.eventType}>
                    <span>{item.eventType}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <EmptyState message="No categorized events yet." />
              )}
            </div>
          </Panel>

          <Panel title="Camera activity" subtitle="Per-camera monitoring throughput.">
            <div className="camera-list">
              {payload.cameraBreakdown.length ? (
                payload.cameraBreakdown.map((camera) => (
                  <article className="camera-item" key={camera.cameraId}>
                    <div>
                      <strong>{camera.cameraId}</strong>
                      <span>{camera.latestEventAt ? formatDateTime(camera.latestEventAt) : "Waiting for first event"}</span>
                    </div>
                    <div className="camera-count">{camera.count}</div>
                  </article>
                ))
              ) : (
                <EmptyState message="No camera activity available yet." />
              )}
            </div>
          </Panel>

          <Panel title="API contract" subtitle="Use this route from the Python detector or any upstream ingest worker.">
            <div className="api-card">
              <code>POST /api/events</code>
              <pre>{`{
  "event_type": "Animal Crossing",
  "object_type": "Horse",
  "confidence": 0.93,
  "timestamp": "2026-04-04T17:42:11Z",
  "camera_id": "CAM-03",
  "zone_path": "A -> B -> C",
  "image_url": "https://..."
}`}</pre>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="panel-card">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EventCard({ event }) {
  return (
    <article className="event-card">
      <div className={`event-media ${event.eventType === "Accident" ? "accident" : "animal"}`}>
        {event.imageUrl ? <img alt={event.objectType} className="event-image" src={event.imageUrl} /> : <span>Snapshot pending</span>}
      </div>
      <div className="event-body">
        <div className="event-topline">
          <span className={`event-badge ${event.eventType === "Accident" ? "accident" : "animal"}`}>{event.eventType}</span>
          <span>{event.confidenceLabel} confidence</span>
        </div>
        <h4>{event.objectType}</h4>
        <p>{formatDateTime(event.occurredAt)}</p>
        <p>Camera: {event.cameraId}</p>
        {event.zonePath ? <p>Route: {event.zonePath}</p> : null}
        <div className="event-footer">
          <span>Confidence</span>
          <strong>{event.confidencePct}%</strong>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
