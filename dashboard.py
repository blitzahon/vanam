import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from database import fetch_dashboard_payload, init_db
from paths import BASE_DIR, EVENTS_DIR, ensure_runtime_dirs


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "VANAMDashboard/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path in {"/", "/index.html"}:
            return self._send_html(render_dashboard(fetch_dashboard_payload(limit=10)))
        if parsed.path == "/api/overview":
            return self._send_json(fetch_dashboard_payload(limit=10))
        if parsed.path == "/event-asset":
            return self._send_event_asset(parsed.query)
        self.send_error(HTTPStatus.NOT_FOUND, "Resource not found.")

    def log_message(self, format: str, *args) -> None:
        return

    def _send_html(self, html: str) -> None:
        payload = html.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, payload: dict) -> None:
        content = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _send_event_asset(self, query: str) -> None:
        requested = parse_qs(query).get("path", [""])[0]
        requested_path = (BASE_DIR / requested).resolve()

        try:
            requested_path.relative_to(EVENTS_DIR.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Asset path is not allowed.")
            return

        if not requested_path.exists() or not requested_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Asset not found.")
            return

        payload = requested_path.read_bytes()
        content_type = mimetypes.guess_type(str(requested_path))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def render_dashboard(payload: dict) -> str:
    initial = json.dumps(payload).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VANAM Dashboard</title>
  <style>
    :root {{
      --bg: #07111a; --panel: rgba(11, 24, 36, 0.82); --text: #edf4fb; --muted: #9bb0c4;
      --accent: #72dbff; --good: #9af0ba; --warn: #f7c56d; --danger: #ff876f; --line: rgba(255,255,255,0.08);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0; color: var(--text); font-family: "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(114,219,255,0.2), transparent 28%),
        radial-gradient(circle at top right, rgba(154,240,186,0.15), transparent 24%),
        linear-gradient(180deg, #061019 0%, #081521 50%, #07111a 100%);
      min-height: 100vh;
    }}
    .shell {{ width: min(1180px, calc(100% - 28px)); margin: 0 auto; padding: 24px 0 36px; }}
    .hero, .panel {{
      border: 1px solid var(--line); border-radius: 28px; background: var(--panel); backdrop-filter: blur(18px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    }}
    .hero {{ padding: 28px; background: linear-gradient(135deg, rgba(114,219,255,0.13), rgba(154,240,186,0.06)), var(--panel); }}
    .eyebrow {{ font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--good); }}
    h1 {{ margin: 14px 0 10px; font-size: clamp(34px, 5vw, 58px); line-height: 0.95; max-width: 760px; }}
    .sub {{ color: var(--muted); max-width: 760px; line-height: 1.7; font-size: 16px; }}
    .chips {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }}
    .chip {{ padding: 10px 14px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); background: rgba(255,255,255,0.03); }}
    .grid {{ display: grid; gap: 18px; margin-top: 20px; }}
    .metrics {{ grid-template-columns: repeat(4, minmax(0, 1fr)); }}
    .main {{ grid-template-columns: 1.35fr 0.85fr; align-items: start; }}
    .stack {{ display: grid; gap: 18px; }}
    .panel {{ padding: 22px; }}
    .title {{ margin: 0; font-size: 18px; }}
    .caption {{ margin: 6px 0 0; color: var(--muted); font-size: 14px; }}
    .metric-label {{ color: var(--muted); font-size: 14px; margin-bottom: 14px; }}
    .metric-value {{ font-size: 38px; font-weight: 700; letter-spacing: -0.04em; margin: 0; }}
    .metric-note {{ color: var(--muted); font-size: 13px; margin-top: 14px; }}
    .bars {{ display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; align-items: end; min-height: 220px; }}
    .bar {{ display: grid; gap: 10px; justify-items: center; }}
    .fill {{ width: 100%; min-height: 16px; border-radius: 20px 20px 8px 8px; background: linear-gradient(180deg, var(--accent), rgba(114,219,255,0.22)); border: 1px solid rgba(114,219,255,0.2); }}
    .small {{ font-size: 12px; color: var(--muted); }}
    .pills, .list {{ display: grid; gap: 12px; }}
    .pills {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    .pill, .item {{ padding: 14px 16px; border-radius: 18px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }}
    .item {{ display: flex; justify-content: space-between; gap: 12px; }}
    .cards {{ display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); }}
    .event {{ overflow: hidden; padding: 0; }}
    .media {{ width: 100%; height: 184px; object-fit: cover; display: block; border-bottom: 1px solid var(--line); background: linear-gradient(135deg, rgba(114,219,255,0.2), rgba(7,17,26,0.88)); }}
    .placeholder {{ display: grid; place-items: center; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.78); }}
    .placeholder.accident {{ background: linear-gradient(135deg, rgba(255,135,111,0.3), rgba(36,8,8,0.9)); }}
    .placeholder.animal {{ background: linear-gradient(135deg, rgba(154,240,186,0.18), rgba(7,28,19,0.9)); }}
    .body {{ padding: 18px; }}
    .row {{ display: flex; justify-content: space-between; gap: 12px; align-items: center; }}
    .badge {{ padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }}
    .badge.accident {{ color: var(--danger); }} .badge.animal {{ color: var(--good); }}
    .event-title {{ margin: 12px 0 6px; font-size: 20px; }}
    .meta {{ margin: 0; color: var(--muted); font-size: 14px; line-height: 1.6; }}
    .footer {{ margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }}
    .empty {{ padding: 26px; border-radius: 20px; border: 1px dashed var(--line); text-align: center; color: var(--muted); }}
    .stamp {{ margin-top: 14px; color: var(--muted); text-align: right; font-size: 13px; }}
    code {{ color: var(--text); }}
    @media (max-width: 1080px) {{ .metrics, .main, .cards, .pills {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="eyebrow">Road monitoring command center</div>
      <h1>VANAM converts roadside footage into an evidence-ready safety dashboard.</h1>
      <p class="sub">Track accident alerts, animal crossings, and camera activity from one local interface. The dashboard reads straight from the SQLite event log produced by the detection pipeline and refreshes automatically.</p>
      <div class="chips">
        <div class="chip">Live event telemetry</div>
        <div class="chip">SQLite-backed audit trail</div>
        <div class="chip">No extra web framework required</div>
      </div>
    </section>

    <section class="grid metrics" id="metrics"></section>

    <section class="grid main">
      <div class="stack">
        <section class="panel">
          <h2 class="title">7-day event trend</h2>
          <p class="caption">A quick signal on incident volume over the last week.</p>
          <div class="bars" id="trend"></div>
        </section>
        <section class="panel">
          <h2 class="title">Recent incidents</h2>
          <p class="caption">Latest logged evidence and metadata from the field.</p>
          <div id="events"></div>
        </section>
      </div>
      <div class="stack">
        <section class="panel">
          <h2 class="title">Event mix</h2>
          <p class="caption">Distribution of incident classes captured by VANAM.</p>
          <div class="pills" id="mix"></div>
        </section>
        <section class="panel">
          <h2 class="title">Camera activity</h2>
          <p class="caption">Per-camera event totals and latest activity.</p>
          <div class="list" id="cameras"></div>
        </section>
        <section class="panel">
          <h2 class="title">Quick start</h2>
          <p class="caption">Run the detector to populate the dashboard with live incidents.</p>
          <div class="list">
            <div class="item"><div><strong>Start monitoring</strong><div class="small"><code>python vanam.py --video videos/road.mp4 --preview</code></div></div></div>
            <div class="item"><div><strong>Open dashboard</strong><div class="small"><code>python dashboard.py</code></div></div></div>
            <div class="item"><div><strong>Review evidence</strong><div class="small">Snapshots go to <code>events/</code> and records go to <code>database.db</code>.</div></div></div>
          </div>
        </section>
      </div>
    </section>

    <div class="stamp">Last refresh: <span id="stamp">-</span></div>
  </main>

  <script id="initial" type="application/json">{initial}</script>
  <script>
    const initial = JSON.parse(document.getElementById("initial").textContent);

    const esc = (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

    function metrics(summary) {{
      return [
        {{ label: "Total logged events", value: summary.total_events, note: summary.latest_event_at || "No events yet" }},
        {{ label: "Animal crossings", value: summary.animal_events, note: "Confirmed multi-zone movement" }},
        {{ label: "Accidents detected", value: summary.accident_events, note: "High-risk deceleration patterns" }},
        {{ label: "Average confidence", value: `${{Math.round((summary.avg_confidence || 0) * 100)}}%`, note: `${{summary.active_cameras}} active camera source(s)` }},
      ].map(item => `
        <article class="panel">
          <div class="metric-label">${{esc(item.label)}}</div>
          <p class="metric-value">${{esc(item.value)}}</p>
          <div class="metric-note">${{esc(item.note)}}</div>
        </article>
      `).join("");
    }}

    function trend(points) {{
      if (!points.length) return `<div class="empty">No trend data yet.</div>`;
      const max = Math.max(...points.map(point => point.count), 1);
      return points.map(point => {{
        const height = Math.max(16, Math.round((point.count / max) * 180));
        const label = new Date(point.date + "T00:00:00").toLocaleDateString(undefined, {{ month: "short", day: "numeric" }});
        return `<div class="bar"><div>${{esc(point.count)}}</div><div class="fill" style="height:${{height}}px"></div><div class="small">${{esc(label)}}</div></div>`;
      }}).join("");
    }}

    function mix(items) {{
      if (!items.length) return `<div class="empty">Event categories will appear here after the first detection run.</div>`;
      return items.map(item => `<div class="pill">${{esc(item.event_type)}}<div class="small">${{esc(item.count)}} logged event(s)</div></div>`).join("");
    }}

    function cameras(items) {{
      if (!items.length) return `<div class="empty">No camera activity is available yet.</div>`;
      return items.map(item => `
        <div class="item">
          <div><strong>${{esc(item.camera_id)}}</strong><div class="small">${{esc(item.latest_event_at || "Waiting for first event")}}</div></div>
          <div><strong>${{esc(item.count)}}</strong><div class="small">events</div></div>
        </div>
      `).join("");
    }}

    function events(items) {{
      if (!items.length) return `<div class="empty">No incidents have been logged yet. Once VANAM processes a video stream, evidence cards will appear here automatically.</div>`;
      const cards = items.map(event => {{
        const kind = event.event_type === "Accident" ? "accident" : "animal";
        const media = event.image_available && event.image_url
          ? `<img class="media" src="${{event.image_url}}" alt="${{esc(event.object_type)}}" />`
          : `<div class="media placeholder ${{kind}}">Snapshot pending</div>`;
        const zone = event.zone_path ? `<p class="meta">Route: ${{esc(event.zone_path)}}</p>` : "";
        return `
          <article class="panel event">
            ${{media}}
            <div class="body">
              <div class="row">
                <div class="badge ${{kind}}">${{esc(event.event_type)}}</div>
                <div class="small">${{esc(event.confidence_label)}} confidence</div>
              </div>
              <h3 class="event-title">${{esc(event.object_type)}}</h3>
              <p class="meta">${{esc(event.timestamp)}}</p>
              <p class="meta">Camera: ${{esc(event.camera_id)}}</p>
              ${{zone}}
              <div class="footer row"><span>Confidence</span><strong>${{esc(event.confidence_pct)}}%</strong></div>
            </div>
          </article>
        `;
      }}).join("");
      return `<div class="cards">${{cards}}</div>`;
    }}

    function render(payload) {{
      document.getElementById("metrics").innerHTML = metrics(payload.summary);
      document.getElementById("trend").innerHTML = trend(payload.trend);
      document.getElementById("mix").innerHTML = mix(payload.event_mix);
      document.getElementById("cameras").innerHTML = cameras(payload.camera_breakdown);
      document.getElementById("events").innerHTML = events(payload.recent_events);
      const stamp = new Date(payload.generated_at);
      document.getElementById("stamp").textContent = Number.isNaN(stamp.valueOf()) ? payload.generated_at : stamp.toLocaleString();
    }}

    async function refresh() {{
      try {{
        const response = await fetch("/api/overview", {{ cache: "no-store" }});
        if (!response.ok) throw new Error(`status ${{response.status}}`);
        render(await response.json());
      }} catch (error) {{
        console.error("Dashboard refresh failed", error);
      }}
    }}

    render(initial);
    setInterval(refresh, 6000);
  </script>
</body>
</html>"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VANAM command dashboard")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind")
    parser.add_argument("--port", type=int, default=8050, help="Port for the dashboard server")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_runtime_dirs()
    init_db()
    server = ThreadingHTTPServer((args.host, args.port), DashboardHandler)
    address = f"http://{args.host}:{args.port}"
    print(f"[VANAM Dashboard] Serving on {address}")
    print("[VANAM Dashboard] Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("[VANAM Dashboard] Server stopped.")


if __name__ == "__main__":
    main()
