# VANAM 2.0

VANAM is a road-safety monitoring system for rural and highway footage. It detects animal crossings and vehicle accidents, saves evidence snapshots, logs incidents to SQLite, and exposes a polished local dashboard for review.

## What it does

- Detects animal movement across roadway zones
- Flags potential accidents from sudden deceleration and stopped vehicles
- Stores event records with timestamp, confidence, camera ID, and snapshot path
- Shows incident metrics, recent evidence, and camera activity in a browser dashboard
- Runs locally without requiring a cloud backend
- Includes a Vercel-ready Next.js product frontend backed by Neon Postgres

## Product overview

VANAM is designed as a practical monitoring product rather than just a detection script. The detection pipeline processes video frames, the event store creates an audit trail, and the dashboard gives you a clean operator view of what happened and when.

## Project structure

```text
VANAM/
|-- vanam.py            Main detection pipeline
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

The first detection run downloads `yolov8n.pt` through Ultralytics automatically.

## Run the detector

```bash
python vanam.py --video videos/road.mp4 --preview
```

Useful options:

- `--camera CAM-02` to label a different camera source
- `--conf 0.45` to change the YOLO confidence threshold
- `--preview` to show the live OpenCV output while processing

## Open the dashboard

```bash
python dashboard.py
```

Then open [http://127.0.0.1:8050](http://127.0.0.1:8050) in your browser.

The dashboard reads directly from `database.db` and refreshes automatically, so new incidents appear as soon as they are logged.

## Web product on Vercel

This repository now also includes a deployable `Next.js` product frontend at the repo root. It is designed for `Vercel` and uses `Neon Postgres` as the hosted SQL database.

### Frontend stack

- Next.js App Router
- Vercel deployment target
- Neon Postgres through `@neondatabase/serverless`
- Vercel Analytics

### Local web app setup

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Database setup

Add a `DATABASE_URL` environment variable for your Neon database.

You can provision Neon through Vercel Marketplace, then pull env vars locally with:

```bash
vercel env pull
```

To create the schema:

```bash
npm run db:setup
```

To load sample events:

```bash
npm run db:seed
```

### Product routes

- `/` product landing page
- `/dashboard` operations dashboard
- `GET /api/overview` dashboard payload
- `GET /api/events` recent events
- `POST /api/events` event ingestion endpoint

### Example ingestion payload

```json
{
  "event_type": "Animal Crossing",
  "object_type": "Horse",
  "confidence": 0.93,
  "timestamp": "2026-04-04T17:42:11Z",
  "camera_id": "CAM-03",
  "zone_path": "A -> B -> C",
  "image_url": "https://example.com/event.jpg"
}
```

## Train with your dataset

The dataset in `archive (1).zip` is a classification dataset arranged by animal class folders. That means it is best used to train an animal classifier, which VANAM can use to refine species labels after the detector finds an animal.

### 1. Prepare the dataset

```bash
python prepare_classifier_dataset.py --zip "C:\Users\nachi\Downloads\archive (1).zip" --output datasets/animal_classifier
```

This creates an Ultralytics-ready classification dataset with `train/` and `val/` folders.

### 2. Train the classifier

```bash
python train_classifier.py --data datasets/animal_classifier --epochs 20 --imgsz 224
```

The trained weights will be written under `runs/classify/vanam-animal-cls/`.

### 3. Use the trained model in VANAM

```bash
python vanam.py --video videos/road.mp4 --preview --animal-cls-model runs/classify/vanam-animal-cls/weights/best.pt
```

This keeps the main detector for localization and uses your trained classifier to improve the animal species name on detected animal crops.

## Event data

Each event record contains:

- `event_type`
- `object_type`
- `timestamp`
- `confidence`
- `image_path`
- `camera_id`
- `zone_path`

Snapshots are stored in `events/` and the event database is stored in `database.db`.

## Quick demo flow

1. Place a sample road video in `videos/`.
2. Run `python vanam.py --video videos/road.mp4 --preview`.
3. In another terminal, run `python dashboard.py`.
4. Open the dashboard and review incidents as they are detected.

## Git and GitHub

This project is already initialized as a local git repository.

To connect it to GitHub after creating a remote repository:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

If you install GitHub CLI, you can also publish directly with:

```bash
gh repo create vanam --private --source . --remote origin --push
```

## Tech stack

- Python 3.10+
- OpenCV
- Ultralytics YOLOv8
- NumPy
- SQLite
- Built-in Python HTTP server for the dashboard
