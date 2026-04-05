import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import cv2

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from accident_logic import VehicleTracker
from alerts import alert_accident, alert_animal_crossing
from animal_classifier import AnimalClassifier
from animal_logic import AnimalTracker
from detection import Detector
from paths import EVENTS_DIR, ensure_runtime_dirs, relative_to_base


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process a video file and emit VANAM detections as JSON.")
    parser.add_argument("--video", required=True, help="Path to the input video file")
    parser.add_argument("--camera", default="SOURCE-01", help="Source identifier used for saved events")
    parser.add_argument("--conf", type=float, default=0.40, help="Detector confidence threshold")
    parser.add_argument("--animal-cls-model", default=None, help="Optional classifier weights path")
    parser.add_argument("--animal-cls-conf", type=float, default=0.55, help="Classifier confidence threshold")
    parser.add_argument(
        "--allowed-animal-labels",
        default="",
        help="Optional JSON array of animal labels that should be treated as monitored species",
    )
    return parser.parse_args()


def get_sms_recipients() -> dict:
    animal = os.environ.get("VANAM_ANIMAL_SMS_TO", "").strip() or None
    accident = os.environ.get("VANAM_ACCIDENT_SMS_TO", "").strip() or None
    return {"animal": animal, "accident": accident}


def save_frame(frame, event_type: str, object_type: str, timestamp: str) -> str:
    ensure_runtime_dirs()
    safe_obj = object_type.replace(" ", "_").lower()
    safe_time = timestamp.replace(":", "-").replace(" ", "_")
    prefix = "animal" if event_type == "Animal Crossing" else "accident"
    output_path = EVENTS_DIR / f"{prefix}_{safe_obj}_{safe_time}.jpg"
    cv2.imwrite(str(output_path), frame)
    return relative_to_base(output_path)


def serialize_event(event_type: str, object_type: str, confidence: float, camera_id: str, timestamp: str, image_path: str, zone_path: str | None = None) -> dict:
    return {
        "eventType": event_type,
        "objectType": object_type,
        "confidence": confidence,
        "occurredAt": datetime.now().isoformat(),
        "cameraId": camera_id,
        "zonePath": zone_path,
        "imagePath": image_path,
        "imageUrl": f"/api/event-media?path={image_path}",
        "capturedAtLabel": timestamp,
    }


def parse_allowed_labels(raw_value: str) -> set[str]:
    if not raw_value:
        return set()

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError:
        return set()

    if not isinstance(parsed, list):
        return set()

    return {str(entry).strip().lower() for entry in parsed if str(entry).strip()}


def main() -> int:
    args = parse_args()
    video_file = Path(args.video).expanduser().resolve()

    if not video_file.exists():
        print(json.dumps({"ok": False, "error": f"Video file not found: {video_file}"}, ensure_ascii=True))
        return 1

    cap = cv2.VideoCapture(str(video_file))
    if not cap.isOpened():
        print(json.dumps({"ok": False, "error": f"Unable to open video: {video_file}"}, ensure_ascii=True))
        return 1

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    detector = Detector(conf_threshold=args.conf)
    animal_classifier = (
        AnimalClassifier(model_path=args.animal_cls_model, conf_threshold=args.animal_cls_conf)
        if args.animal_cls_model
        else None
    )
    animal_tracker = AnimalTracker(frame_w)
    vehicle_tracker = VehicleTracker(frame_w, frame_h)
    allowed_animal_labels = parse_allowed_labels(args.allowed_animal_labels)
    sms_recipients = get_sms_recipients()
    events = []

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            detections = detector.detect(frame)
            if animal_classifier:
                detections = animal_classifier.enrich_detections(frame, detections)

            animal_event = animal_tracker.update(detections)
            if animal_event:
                if allowed_animal_labels and animal_event["object_type"].strip().lower() not in allowed_animal_labels:
                    continue

                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                image_path = save_frame(frame, animal_event["event_type"], animal_event["object_type"], timestamp)
                alert_animal_crossing(
                    animal_type=animal_event["object_type"],
                    timestamp=timestamp,
                    confidence=animal_event["confidence"],
                    image_path=image_path,
                    zone_path=animal_event.get("zone_path"),
                    camera_id=args.camera,
                    sms_to=sms_recipients["animal"],
                )
                events.append(
                    serialize_event(
                        event_type=animal_event["event_type"],
                        object_type=animal_event["object_type"],
                        confidence=animal_event["confidence"],
                        camera_id=args.camera,
                        timestamp=timestamp,
                        image_path=image_path,
                        zone_path=animal_event.get("zone_path"),
                    )
                )

            accident_event = vehicle_tracker.update(detections)
            if accident_event:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                image_path = save_frame(frame, accident_event["event_type"], accident_event["object_type"], timestamp)
                alert_accident(
                    vehicles_count=accident_event["vehicles_count"],
                    timestamp=timestamp,
                    confidence=accident_event["confidence"],
                    image_path=image_path,
                    camera_id=args.camera,
                    sms_to=sms_recipients["accident"],
                )
                events.append(
                    serialize_event(
                        event_type=accident_event["event_type"],
                        object_type=accident_event["object_type"],
                        confidence=accident_event["confidence"],
                        camera_id=args.camera,
                        timestamp=timestamp,
                        image_path=image_path,
                    )
                )
    finally:
        cap.release()

    print(
        json.dumps(
            {
                "ok": True,
                "videoPath": str(video_file),
                "cameraId": args.camera,
                "classifierModel": args.animal_cls_model,
                "allowedAnimalLabels": sorted(allowed_animal_labels),
                "events": events,
            },
            ensure_ascii=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())