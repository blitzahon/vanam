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
  const workspaceStatus = getWorkspaceStatus(payload.mode);
  const notificationSettings = payload.notificationSettings ?? {};
  const cameraSources = payload.cameraSources ?? [];
  const recentEvents = payload.recentEvents ?? [];
  const activeCameraSources = cameraSources.filter((camera) => camera.status === "active").length;
  const smsRecipientCount =
    (notificationSettings.animalRecipients?.length ?? 0) + (notificationSettings.accidentRecipients?.length ?? 0);
  const smsReady = Boolean(notificationSettings.smsEnabled && notificationSettings.hasTwilioConfig && smsRecipientCount > 0);
  const snapshotCount = recentEvents.filter((event) => Boolean(event.imageUrl)).length;

  return (
    <div className="dashboard-shell">
      <section className="status-strip">
        <div className="status-chip">
          <span className={`status-dot ${workspaceStatus.dotClass}`} />
          <span>{workspaceStatus.label}</span>
        </div>
        <div className="status-strip-meta">
          <span>Updated {formatDateTime(payload.generatedAt)}</span>
          <span>Refresh every 10 seconds</span>
        </div>
      </section>

      {workspaceStatus.notice ? <section className="setup-card">{workspaceStatus.notice}</section> : null}

      <section className="metrics-grid">
        <MetricCard label="Total alerts" value={summary.totalEvents} note={summary.latestEventAt ? `Latest ${formatDateTime(summary.latestEventAt)}` : "Waiting for the first alert"} />
        <MetricCard label="Wildlife alerts" value={summary.animalEvents} note="Verified animal activity near the roadway" />
        <MetricCard label="Collision alerts" value={summary.accidentEvents} note="High-priority incident detections" />
        <MetricCard label="Monitored cameras" value={summary.activeCameras} note={`${Math.round((summary.averageConfidence ?? 0) * 100)}% average confidence`} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-stack">
          <Panel title="Activity trend" subtitle="Alert volume across the past seven days.">
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

          <Panel title="Latest alerts" subtitle="Recent verified events across the monitored network.">
            <div className="event-grid">
              {recentEvents.length ? recentEvents.map((event) => <EventCard event={event} key={event.id} />) : <EmptyState message="No alerts are available yet." />}
            </div>
          </Panel>
        </div>

        <div className="dashboard-stack">
          <Panel title="Alert mix" subtitle="Breakdown by alert category.">
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

          <Panel title="Camera coverage" subtitle="Most recent activity by monitored source.">
            <div className="camera-list">
              {payload.cameraBreakdown.length ? (
                payload.cameraBreakdown.map((camera) => (
                  <article className="camera-item" key={camera.cameraId}>
                    <div>
                      <strong>{camera.cameraId}</strong>
                      <span>{camera.latestEventAt ? formatDateTime(camera.latestEventAt) : "No recent activity"}</span>
                    </div>
                    <div className="camera-count">{camera.count}</div>
                  </article>
                ))
              ) : (
                <EmptyState message="No camera activity is available yet." />
              )}
            </div>
          </Panel>

          <Panel title="Response readiness" subtitle="What the operations team can act on right now.">
            <div className="readiness-list">
              <article className="readiness-item">
                <div>
                  <strong>SMS alerts</strong>
                  <span>
                    {smsReady
                      ? `${smsRecipientCount} recipient${smsRecipientCount === 1 ? "" : "s"} configured for urgent alerts`
                      : notificationSettings.smsEnabled
                        ? "SMS is enabled, but the delivery setup still needs attention"
                        : "SMS delivery is currently paused"}
                  </span>
                </div>
                <em className={`readiness-pill ${smsReady ? "" : "muted"}`}>{smsReady ? "Ready" : notificationSettings.smsEnabled ? "Action needed" : "Paused"}</em>
              </article>

              <article className="readiness-item">
                <div>
                  <strong>Camera registry</strong>
                  <span>
                    {cameraSources.length
                      ? `${activeCameraSources || cameraSources.length} source${(activeCameraSources || cameraSources.length) === 1 ? "" : "s"} currently active`
                      : "No camera sources have been registered yet"}
                  </span>
                </div>
                <em className={`readiness-pill ${cameraSources.length ? "" : "muted"}`}>{cameraSources.length ? "Available" : "Needs setup"}</em>
              </article>

              <article className="readiness-item">
                <div>
                  <strong>Snapshot evidence</strong>
                  <span>
                    {snapshotCount
                      ? `${snapshotCount} recent alert${snapshotCount === 1 ? "" : "s"} include attached imagery`
                      : "Recent alerts do not include attached snapshots yet"}
                  </span>
                </div>
                <em className={`readiness-pill ${snapshotCount ? "" : "muted"}`}>{snapshotCount ? "Available" : "Limited"}</em>
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

function getWorkspaceStatus(mode) {
  if (mode === "database") {
    return {
      label: "Live monitoring",
      notice: null,
      dotClass: "live"
    };
  }

  if (mode === "needs-setup") {
    return {
      label: "Configuration needed",
      notice: "Live incident data is not connected in this environment yet. Finish workspace setup before rolling this out to the operations team.",
      dotClass: "warn"
    };
  }

  return {
    label: "Preview workspace",
    notice: "This workspace is showing preview activity instead of live roadside alerts. Connect the live feed before employee rollout.",
    dotClass: "warn"
  };
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
