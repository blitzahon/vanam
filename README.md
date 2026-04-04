# VANAM 2.0

VANAM is a local road-safety monitoring product for rural and highway footage. It detects animal crossings and vehicle accidents, stores evidence in SQLite, and includes a polished browser dashboard for reviewing incidents.

## Product highlights

- Unified monitoring pipeline for animal and accident detection
- Evidence logging with timestamps, camera IDs, confidence scores, and snapshots
- Local browser dashboard for metrics, trend tracking, and recent-event review
- Self-contained setup with no separate web framework or cloud service required

## Project structure

```text
VANAM/
|-- vanam.py            Main detector pipeline
|-- dashboard.py        Local browser dashboard
|-- detection.py        YOLOv8 wrapper
|-- animal_logic.py     Zone-based animal crossing logic
|-- accident_logic.py   Velocity-based accident logic
|-- database.py         SQLite storage and dashboard queries
|-- paths.py            Runtime-safe path helpers
|-- alerts.py           Console alerts and session output
|-- requirements.txt    Python dependencies
|-- events/             Saved event snapshots
`-- videos/             Input footage
```

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The first detection run will download `yolov8n.pt` automatically through Ultralytics.

## Run the detector

```bash
python vanam.py --video videos/road.mp4 --preview
```

Optional flags:

- `--camera CAM-02` to label a different camera source
- `--conf 0.45` to change the YOLO confidence threshold

## Open the dashboard

```bash
python dashboard.py
```

Then open [http://127.0.0.1:8050](http://127.0.0.1:8050) in your browser.

The dashboard reads directly from `database.db` and auto-refreshes every few seconds.

## Data model

The `events` table stores:

- `event_type`
- `object_type`
- `timestamp`
- `confidence`
- `image_path`
- `camera_id`
- `zone_path`

## Suggested git workflow

```bash
git init -b main
git add .
git commit -m "Initial VANAM product dashboard"
```

If GitHub CLI is authenticated on this machine, you can publish with:

```bash
gh repo create vanam --private --source . --remote origin --push
```
