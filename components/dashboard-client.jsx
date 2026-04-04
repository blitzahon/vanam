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
  const systemMode =
    payload.mode === "database" ? "Live" : payload.mode === "needs-setup" ? "Setup pending" : "Demo";

  return (
    <div className="dashboard-shell">
      <section className="status-strip">
        <div className="status-chip">
          <span className={`status-dot ${payload.mode === "database" ? "live" : payload.mode === "needs-setup" ? "warn" : ""}`} />
          <span>{systemMode}</span>
        </div>
        <div className="status-strip-meta">
          <span>Updated {formatDateTime(payload.generatedAt)}</span>
          <span>Refresh 10s</span>
        </div>
      </section>

      {payload.setupMessage ? <section className="setup-card">Database setup pending. Complete schema initialization to switch this workspace to live event data.</section> : null}

      <section className="metrics-grid">
        <MetricCard label="Incidents" value={summary.totalEvents} note={summary.latestEventAt ? `Latest ${formatDateTime(summary.latestEventAt)}` : "Awaiting first event"} />
        <MetricCard label="Animal Alerts" value={summary.animalEvents} note="Crossing detections confirmed" />
        <MetricCard label="Accident Alerts" value={summary.accidentEvents} note="High-priority road events" />
        <MetricCard label="Camera Network" value={summary.activeCameras} note={`${Math.round((summary.averageConfidence ?? 0) * 100)}% average confidence`} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-stack">
          <Panel title="Activity trend" subtitle="Incident volume across the past seven days.">
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

          <Panel title="Incident feed" subtitle="Most recent verified detections across the monitored network.">
            <div className="event-grid">
              {payload.recentEvents.length ? (
                payload.recentEvents.map((event) => <EventCard event={event} key={event.id} />)
              ) : (
                <EmptyState message="No incidents available yet." />
              )}
            </div>
          </Panel>
        </div>

        <div className="dashboard-stack">
          <Panel title="Detection mix" subtitle="Relative volume by incident class.">
            <div className="pill-group">
              {payload.eventMix.length ? (
                payload.eventMix.map((item) => (
                  <div className="stat-pill" key={item.eventType}>
                    <span>{item.eventType}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <EmptyState message="No categorized activity yet." />
              )}
            </div>
          </Panel>

          <Panel title="Camera activity" subtitle="Latest monitored activity by source.">
            <div className="camera-list">
              {payload.cameraBreakdown.length ? (
                payload.cameraBreakdown.map((camera) => (
                  <article className="camera-item" key={camera.cameraId}>
                    <div>
                      <strong>{camera.cameraId}</strong>
                      <span>{camera.latestEventAt ? formatDateTime(camera.latestEventAt) : "No activity yet"}</span>
                    </div>
                    <div className="camera-count">{camera.count}</div>
                  </article>
                ))
              ) : (
                <EmptyState message="No camera activity available." />
              )}
            </div>
          </Panel>

          <Panel title="Alert readiness" subtitle="Dispatch channels and response paths.">
            <div className="readiness-list">
              <article className="readiness-item">
                <div>
                  <strong>SMS dispatch</strong>
                  <span>Primary urgent alert route</span>
                </div>
                <em className="readiness-pill">Ready</em>
              </article>
              <article className="readiness-item">
                <div>
                  <strong>Email evidence</strong>
                  <span>Snapshot and event context delivery</span>
                </div>
                <em className="readiness-pill">Ready</em>
              </article>
              <article className="readiness-item">
                <div>
                  <strong>Webhook routing</strong>
                  <span>External downstream integrations</span>
                </div>
                <em className="readiness-pill muted">Optional</em>
              </article>
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
        <p>Camera {event.cameraId}</p>
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
