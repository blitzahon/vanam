"use client";

import { useEffect, useRef, useState } from "react";

const refreshInterval = 10000;

export function DashboardClient({ initialPayload }) {
  const [payload, setPayload] = useState(initialPayload);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [processingError, setProcessingError] = useState("");
  const [processingResult, setProcessingResult] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [testSmsStatus, setTestSmsStatus] = useState("");
  const [testSmsError, setTestSmsError] = useState("");

  const [notificationForm, setNotificationForm] = useState(() => buildNotificationForm(initialPayload.notificationSettings));
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const cameraPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const summary = payload.summary;
  const hasDatabase = Boolean(payload.hasDatabase);
  const supportsLocalMediaProcessing = Boolean(payload.supportsLocalMediaProcessing);
  const workspaceStatus = getWorkspaceStatus(payload.mode, supportsLocalMediaProcessing);
  const notificationSettings = payload.notificationSettings ?? {};
  const cameraSources = payload.cameraSources ?? [];
  const recentEvents = payload.recentEvents ?? [];
  const assetRegistry = payload.assetRegistry ?? [];
  const activeCameraSources = cameraSources.filter((camera) => camera.status === "active").length;
  const smsRecipientCount =
    (notificationSettings.animalRecipients?.length ?? 0) + (notificationSettings.accidentRecipients?.length ?? 0);
  const smsReady = Boolean(notificationSettings.smsEnabled && notificationSettings.hasTwilioConfig && smsRecipientCount > 0);
  const snapshotCount = recentEvents.filter((event) => Boolean(event.imageUrl)).length;
  const datasetAsset =
    assetRegistry.find((asset) => asset.assetKind === "dataset" && asset.isActive) ??
    assetRegistry.find((asset) => asset.assetKind === "dataset") ??
    null;
  const classifierAsset =
    assetRegistry.find((asset) => asset.assetKind === "trained-model" && asset.isActive) ??
    assetRegistry.find((asset) => asset.assetKind === "trained-model") ??
    null;
  const activeRecognitionLabels =
    (classifierAsset?.classLabels?.length ? classifierAsset.classLabels : datasetAsset?.classLabels ?? []).filter(Boolean);
  const trendPoints = payload.trend ?? [];
  const trendMaxCount = Math.max(...trendPoints.map((entry) => entry.count), 1);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        const raw = await response.text();
        if (!raw.trim()) {
          return;
        }
        const nextPayload = JSON.parse(raw);
        if (response.ok || nextPayload.summary) {
          setPayload(nextPayload);
        }
      } catch {
        // Keep the last successful payload if refresh fails.
      }
    }, refreshInterval);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream(cameraStreamRef, cameraPreviewRef);
    };
  }, []);

  useEffect(() => {
    setNotificationForm(buildNotificationForm(notificationSettings));
  }, [
    notificationSettings.smsEnabled,
    notificationSettings.cooldownSeconds,
    notificationSettings.testRecipient,
    (notificationSettings.animalRecipients ?? []).join(","),
    (notificationSettings.accidentRecipients ?? []).join(",")
  ]);

  async function refreshOverview() {
    const response = await fetch("/api/overview", { cache: "no-store" });
    const raw = await response.text();
    if (!raw.trim()) {
      throw new Error("Empty response from dashboard API.");
    }
    const nextPayload = JSON.parse(raw);
    if (!response.ok && !nextPayload.summary) {
      throw new Error(nextPayload.error ?? "Unable to refresh the dashboard.");
    }
    setPayload(nextPayload);
  }

  async function submitMediaFile(file, sourceType) {
    setIsSubmitting(true);
    setProcessingError("");
    setProcessingResult(null);
    setProcessingMessage(sourceType === "browser-camera" ? "Analysing live CCTV feed..." : "Analysing uploaded footage...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceType", sourceType);
      formData.append("cameraId", buildSourceId(sourceType));
      formData.append("locationLabel", sourceType === "browser-camera" ? "Browser camera capture" : "Uploaded placeholder video");

      const response = await fetch("/api/process-media", {
        method: "POST",
        body: formData
      });
      const raw = await response.text();
      let result = { ok: false, error: "Empty server response." };
      if (raw.trim()) {
        try {
          result = JSON.parse(raw);
        } catch {
          result = { ok: false, error: raw.slice(0, 200) || "Invalid JSON from server." };
        }
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Media processing failed.");
      }

      setProcessingResult(result);
      setProcessingMessage(
        result.eventCount
          ? `${result.eventCount} alert${result.eventCount === 1 ? "" : "s"} generated from ${sourceType === "browser-camera" ? "the live CCTV feed" : "the uploaded footage"}.`
          : "Analysis complete. No confirmed incidents detected on this footage."
      );
      setSelectedFile(null);
      await refreshOverview();
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : "Media processing failed.");
      setProcessingMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();
    if (!selectedFile || isSubmitting) {
      return;
    }

    await submitMediaFile(selectedFile, "video-file");
  }

  async function handleStartCamera() {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not expose camera access for recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      cameraStreamRef.current = stream;
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
      }
      setIsCameraReady(true);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Unable to start the camera.");
    }
  }

  function handleStopCamera() {
    stopCameraStream(cameraStreamRef, cameraPreviewRef);
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setIsCameraReady(false);
    setIsRecording(false);
  }

  function handleRecordCamera() {
    if (!cameraStreamRef.current || isSubmitting) {
      return;
    }

    const mimeType = getRecordingMimeType();
    if (!mimeType) {
      setCameraError("This browser cannot record a camera clip for upload.");
      return;
    }

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const extension = mimeType.includes("webm") ? "webm" : "mp4";
      const clip = new File(recordedChunksRef.current, `browser-camera.${extension}`, { type: mimeType });
      setIsRecording(false);
      if (clip.size > 0) {
        await submitMediaFile(clip, "browser-camera");
      }
    };

    recorder.start();
    setIsRecording(true);
    setProcessingMessage("Capturing live CCTV feed...");
    setProcessingError("");
  }

  function handleStopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
  }

  function handleNotificationFieldChange(event) {
    const { name, type, checked, value } = event.target;
    setNotificationForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleNotificationSubmit(event) {
    event.preventDefault();
    setIsSavingNotifications(true);
    setNotificationError("");
    setNotificationStatus("");

    try {
      const response = await fetch("/api/settings/notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          smsEnabled: notificationForm.smsEnabled,
          animalRecipients: splitRecipients(notificationForm.animalRecipients),
          accidentRecipients: splitRecipients(notificationForm.accidentRecipients),
          cooldownSeconds: Number(notificationForm.cooldownSeconds) || 60,
          testRecipient: notificationForm.testRecipient
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Unable to save SMS settings.");
      }

      setNotificationStatus("SMS settings saved.");
      await refreshOverview();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Unable to save SMS settings.");
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function handleTestSmsSubmit(event) {
    event.preventDefault();
    setIsSendingTestSms(true);
    setTestSmsStatus("");
    setTestSmsError("");

    try {
      const response = await fetch("/api/notifications/test-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: notificationForm.testRecipient,
          message: "VANAM test alert: SMS delivery path verified."
        })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Unable to send test SMS.");
      }

      setTestSmsStatus(`Test SMS sent to ${notificationForm.testRecipient}.`);
      await refreshOverview();
    } catch (error) {
      setTestSmsError(error instanceof Error ? error.message : "Unable to send test SMS.");
    } finally {
      setIsSendingTestSms(false);
    }
  }


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
      {payload.error ? (
        <section className="setup-card media-status-error">{String(payload.error)}</section>
      ) : null}

      <section className="media-lab-grid">
        <Panel
          title="Detection Engine"
          subtitle={
            supportsLocalMediaProcessing
              ? "AI models are active and scanning all registered CCTV feeds. Species recognition and vehicle tracking are running continuously."
              : "Classifier and dataset assets connected to this deployment. Configure models before activating live surveillance."
          }
        >
          <div className="runtime-grid">
            <RuntimeCard
              label="Dataset"
              value={datasetAsset ? datasetAsset.title : "Not found"}
              note={
                datasetAsset
                  ? `${datasetAsset.classLabels?.length ?? 0} classes${datasetAsset.fileSize ? ` - ${datasetAsset.fileSize} reference items` : ""}`
                  : "Add a prepared dataset under the project datasets folder."
              }
            />
            <RuntimeCard
              label="Classifier"
              value={classifierAsset ? "Connected" : "Pending"}
              note={classifierAsset ? classifierAsset.title : "Upload or train a classifier to refine animal labels."}
            />
            <RuntimeCard
              label="CCTV Sources"
              value={cameraSources.length}
              note={
                cameraSources.length
                  ? `${activeCameraSources || cameraSources.length} active feed${(activeCameraSources || cameraSources.length) === 1 ? "" : "s"} under surveillance`
                  : "No CCTV feeds have been registered yet."
              }
            />
          </div>

          <div className="asset-list">
            {assetRegistry.length ? (
              assetRegistry.map((asset) => (
                <article className="asset-item" key={`${asset.assetKind}-${asset.id}`}>
                  <div>
                    <strong>{asset.title}</strong>
                    <span>{asset.notes || asset.filename || "Project asset connected."}</span>
                  </div>
                  <em className={`readiness-pill ${asset.isActive ? "" : "muted"}`}>{asset.isActive ? "Active" : asset.status}</em>
                </article>
              ))
            ) : (
              <EmptyState
                message={
                  supportsLocalMediaProcessing
                    ? "No datasets or models found. Add datasets/<name>/ with train/ or val/ class folders, or optional classifier weights under runs/classify/.../weights/best.pt, or register assets below."
                    : "No dataset or model assets are registered yet."
                }
              />
            )}
          </div>

          <div className="recognition-profile">
            <div className="panel-head panel-head-compact">
              <div>
                <h3>Recognition profile</h3>
                <p>
                  Species actively monitored across all CCTV feeds. The system will generate alerts only for the classes listed below.
                </p>
              </div>
            </div>

            {activeRecognitionLabels.length ? (
              <div className="recognition-pill-list">
                {activeRecognitionLabels.map((label) => (
                  <span className="recognition-pill" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyState message="No active class labels are available yet. Upload a dataset or classifier with class labels to define the recognition profile." />
            )}
          </div>


        </Panel>

        <Panel
          title="CCTV Feed Analysis"
          subtitle={
            supportsLocalMediaProcessing
              ? "Submit recorded footage or connect a live CCTV feed for real-time threat detection and automated incident logging."
              : "Upload surveillance footage or connect a live camera feed for analysis and incident documentation."
          }
        >
          {!supportsLocalMediaProcessing ? (
            <div className="media-status">
              CCTV footage analysis requires a locally deployed runtime. Configure persistent storage and a processing worker before enabling this in production.
            </div>
          ) : (
            <div className="media-status">
              Powered by YOLOv8 with optional species classifier. Detects wildlife crossings and vehicle incidents in real time across all submitted feeds.
            </div>
          )}

          <form className="media-form" onSubmit={handleUploadSubmit}>
            <label className="media-field">
              <span>Upload CCTV footage</span>
              <input
                accept="video/*"
                disabled={isSubmitting || !supportsLocalMediaProcessing}
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <button className="media-button primary" disabled={!selectedFile || isSubmitting || !supportsLocalMediaProcessing} type="submit">
              {isSubmitting ? "Analysing..." : "Analyse footage"}
            </button>
          </form>

          <div className="camera-capture-card">
            <div className="camera-capture-head">
              <div>
                <strong>Live CCTV Feed</strong>
                <span>Connect a camera to stream live footage directly through the detection pipeline for real-time incident monitoring.</span>
              </div>
              <div className="camera-capture-actions">
                {isCameraReady ? (
                  <button className="media-button" disabled={isSubmitting || !supportsLocalMediaProcessing} onClick={handleStopCamera} type="button">
                    Disconnect feed
                  </button>
                ) : (
                  <button className="media-button" disabled={isSubmitting || !supportsLocalMediaProcessing} onClick={handleStartCamera} type="button">
                    Connect feed
                  </button>
                )}
                {!isRecording ? (
                  <button className="media-button primary" disabled={!isCameraReady || isSubmitting || !supportsLocalMediaProcessing} onClick={handleRecordCamera} type="button">
                    Capture & analyse
                  </button>
                ) : (
                  <button className="media-button primary" disabled={isSubmitting || !supportsLocalMediaProcessing} onClick={handleStopRecording} type="button">
                    Stop and analyse
                  </button>
                )}
              </div>
            </div>

            <div className="camera-preview-shell">
              {isCameraReady ? (
                <video autoPlay className="camera-preview" muted playsInline ref={cameraPreviewRef} />
              ) : (
                <div className="camera-preview camera-preview-empty">Live CCTV feed will appear here once the connection is authorised.</div>
              )}
            </div>
          </div>

          {processingMessage ? <div className="media-status">{processingMessage}</div> : null}
          {processingError ? <div className="media-status media-status-error">{processingError}</div> : null}
          {cameraError ? <div className="media-status media-status-error">{cameraError}</div> : null}
          {processingResult ? (
            <div className="media-result">
              <strong>{processingResult.eventCount} alert{processingResult.eventCount === 1 ? "" : "s"} generated</strong>
              <span>
                Source {processingResult.source.cameraId}
                {processingResult.classifierModel ? ` - classifier ${processingResult.classifierModel.split(/[\\/]/).slice(-3).join("/")}` : ""}
              </span>
              {processingResult.recognitionProfile?.monitoredSpecies?.length ? (
                <span>Monitoring {processingResult.recognitionProfile.monitoredSpecies.join(", ")}</span>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Total alerts" value={summary.totalEvents} note={summary.latestEventAt ? `Latest ${formatDateTime(summary.latestEventAt)}` : "Waiting for the first alert"} />
        <MetricCard label="Wildlife alerts" value={summary.animalEvents} note="Verified animal activity near the roadway" />
        <MetricCard label="Collision alerts" value={summary.accidentEvents} note="High-priority incident detections" />
        <MetricCard label="Active inputs" value={summary.activeCameras} note={`${Math.round((summary.averageConfidence ?? 0) * 100)}% average confidence`} />
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-stack">
          <Panel title="Activity trend" subtitle="Alert volume across the past seven days.">
            <div className="trend-chart">
              {trendPoints.map((point) => {
                const height = Math.max(18, Math.round((point.count / trendMaxCount) * 180));

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

          <Panel title="CCTV Coverage" subtitle="Live status of all registered surveillance feeds and their latest incident activity.">
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
                <EmptyState message="No source activity is available yet." />
              )}
            </div>
          </Panel>

          <Panel title="SMS alerts" subtitle="Configure recipients and verify Twilio delivery from the dashboard.">
            <form className="notification-form" onSubmit={handleNotificationSubmit}>
              <label className="toggle-row">
                <div>
                  <strong>Enable SMS delivery</strong>
                  <span>
                    {notificationSettings.hasTwilioConfig
                      ? `Twilio sender ${notificationSettings.fromNumberMasked || "configured"} is available in this environment.`
                      : "Twilio environment variables are still missing for this workspace."}
                  </span>
                </div>
                <input
                  checked={notificationForm.smsEnabled}
                  name="smsEnabled"
                  onChange={handleNotificationFieldChange}
                  type="checkbox"
                />
              </label>

              <label className="media-field">
                <span>Animal alert recipients</span>
                <textarea
                  name="animalRecipients"
                  onChange={handleNotificationFieldChange}
                  placeholder="+15551230001, +15551230002"
                  rows="3"
                  value={notificationForm.animalRecipients}
                />
              </label>

              <label className="media-field">
                <span>Collision alert recipients</span>
                <textarea
                  name="accidentRecipients"
                  onChange={handleNotificationFieldChange}
                  placeholder="+15551230003, +15551230004"
                  rows="3"
                  value={notificationForm.accidentRecipients}
                />
              </label>

              <div className="notification-grid">
                <label className="media-field">
                  <span>Cooldown seconds</span>
                  <input min="0" name="cooldownSeconds" onChange={handleNotificationFieldChange} type="number" value={notificationForm.cooldownSeconds} />
                </label>

                <label className="media-field">
                  <span>Test recipient</span>
                  <input name="testRecipient" onChange={handleNotificationFieldChange} placeholder="+15551230001" type="text" value={notificationForm.testRecipient} />
                </label>
              </div>

              <div className="env-hint-list">
                <code>TWILIO_ACCOUNT_SID</code>
                <code>TWILIO_AUTH_TOKEN</code>
                <code>TWILIO_FROM_NUMBER</code>
              </div>

              <div className="form-actions">
                <button className="media-button primary" disabled={isSavingNotifications} type="submit">
                  {isSavingNotifications ? "Saving..." : "Save SMS settings"}
                </button>
              </div>
            </form>

            <form className="test-sms-form" onSubmit={handleTestSmsSubmit}>
              <button
                className="media-button"
                disabled={!notificationForm.testRecipient || isSendingTestSms || !notificationSettings.hasTwilioConfig}
                type="submit"
              >
                {isSendingTestSms ? "Sending..." : "Send test SMS"}
              </button>
            </form>

            {notificationStatus ? <div className="media-status">{notificationStatus}</div> : null}
            {notificationError ? <div className="media-status media-status-error">{notificationError}</div> : null}
            {testSmsStatus ? <div className="media-status">{testSmsStatus}</div> : null}
            {testSmsError ? <div className="media-status media-status-error">{testSmsError}</div> : null}
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
                  <strong>CCTV Registry</strong>
                  <span>
                    {cameraSources.length
                      ? `${activeCameraSources || cameraSources.length} feed${(activeCameraSources || cameraSources.length) === 1 ? "" : "s"} currently active and under surveillance`
                      : "No CCTV feeds have been registered yet"}
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

function RuntimeCard({ label, value, note }) {
  return (
    <article className="runtime-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
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
        <p>Source {event.cameraId}</p>
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

function getWorkspaceStatus(mode, supportsLocalMediaProcessing = false) {
  if (mode === "database" && supportsLocalMediaProcessing) {
    return {
      label: "Local AI + database",
      notice:
        "Video and camera clips are analyzed on this machine. Folders under datasets/ (train or val class subfolders) and classifier weights at runs/classify/<run>/weights/best.pt are picked up automatically — registry uploads are optional.",
      dotClass: "live"
    };
  }

  if (mode === "database") {
    return {
      label: "Live monitoring",
      notice: null,
      dotClass: "live"
    };
  }

  if (mode === "local-runtime") {
    return {
      label: "Local AI ready",
      notice: "The workspace is using project-local datasets, classifier weights, and uploaded media clips so you can validate detections without a live CCTV deployment.",
      dotClass: "live"
    };
  }

  if (mode === "needs-setup") {
    return {
      label: "Configuration needed",
      notice: "Hosted incident storage is not available in this environment yet. Use the local AI runtime below or finish the database setup before rolling this out to the operations team.",
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
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function buildSourceId(sourceType) {
  const prefix = sourceType === "browser-camera" ? "BROWSER" : "UPLOAD";
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function stopCameraStream(cameraStreamRef, cameraPreviewRef) {
  if (cameraStreamRef.current) {
    for (const track of cameraStreamRef.current.getTracks()) {
      track.stop();
    }
    cameraStreamRef.current = null;
  }

  if (cameraPreviewRef.current) {
    cameraPreviewRef.current.srcObject = null;
  }
}

function buildNotificationForm(settings = {}) {
  return {
    smsEnabled: Boolean(settings.smsEnabled),
    animalRecipients: (settings.animalRecipients ?? []).join(", "),
    accidentRecipients: (settings.accidentRecipients ?? []).join(", "),
    cooldownSeconds: String(settings.cooldownSeconds ?? 60),
    testRecipient: settings.testRecipient ?? ""
  };
}

function splitRecipients(value) {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}


