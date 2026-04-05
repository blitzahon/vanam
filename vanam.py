"""
VANAM 2.0 entry point.

Usage:
    python vanam.py --video videos/road.mp4
    python vanam.py --video videos/road.mp4 --camera CAM-02 --conf 0.45

Press Q to quit the preview window.
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import cv2

from accident_logic import VehicleTracker
from alerts import (
    alert_accident,
    alert_animal_crossing,
    alert_system_start,
    alert_system_stop,
)
from animal_classifier import AnimalClassifier
from animal_logic import AnimalTracker
from database import init_db, log_event
from detection import Detector
from paths import EVENTS_DIR, VIDEOS_DIR, ensure_runtime_dirs, relative_to_base


def get_sms_recipients() -> dict:
    """Read SMS recipient numbers from environment variables."""
    animal = os.environ.get("VANAM_ANIMAL_SMS_TO", "").strip() or None
    accident = os.environ.get("VANAM_ACCIDENT_SMS_TO", "").strip() or None
    return {"animal": animal, "accident": accident}


def save_frame(frame, event_type: str, object_type: str, timestamp: str) -> Path:
    """Save the current frame to the events directory and return its absolute path."""
    ensure_runtime_dirs()
    safe_obj = object_type.replace(" ", "_").lower()
    safe_time = timestamp.replace(":", "-").replace(" ", "_")
    prefix = "animal" if event_type == "Animal Crossing" else "accident"
    output_path = EVENTS_DIR / f"{prefix}_{safe_obj}_{safe_time}.jpg"
    cv2.imwrite(str(output_path), frame)
    return output_path


def run(
    video_path: str,
    camera_id: str,
    conf_threshold: float,
    show_preview: bool,
    animal_cls_model: str | None = None,
    animal_cls_conf: float = 0.55,
) -> None:
    video_file = Path(video_path)
    if not video_file.is_absolute():
        video_file = (Path.cwd() / video_file).resolve()

    if not video_file.exists():
        print(f"[VANAM] ERROR: Video file not found -> {video_file}")
        sys.exit(1)

    cap = cv2.VideoCapture(str(video_file))
    if not cap.isOpened():
        print(f"[VANAM] ERROR: Could not open video -> {video_file}")
        sys.exit(1)

    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    init_db()
    detector = Detector(conf_threshold=conf_threshold)
    animal_classifier = (
        AnimalClassifier(model_path=animal_cls_model, conf_threshold=animal_cls_conf)
        if animal_cls_model
        else None
    )
    animal_tracker = AnimalTracker(frame_w)
    vehicle_tracker = VehicleTracker(frame_w, frame_h)
    sms_recipients = get_sms_recipients()

    alert_system_start()
    print(f"[VANAM] Camera ID        : {camera_id}")
    print(f"[VANAM] Video source     : {video_file}")
    print(f"[VANAM] Confidence floor : {conf_threshold:.2f}")
    print("[VANAM] Dashboard        : python dashboard.py")
    if animal_classifier:
        print(f"[VANAM] Animal classifier: {animal_cls_model}")
    if sms_recipients["animal"]:
        print(f"[VANAM] Animal SMS       : {sms_recipients['animal']}")
    if sms_recipients["accident"]:
        print(f"[VANAM] Accident SMS     : {sms_recipients['accident']}")

    events_logged = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[VANAM] End of video stream.")
                break

            detections = detector.detect(frame)
            if animal_classifier:
                detections = animal_classifier.enrich_detections(frame, detections)

            animal_event = animal_tracker.update(detections)
            if animal_event:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                image_path = save_frame(
                    frame,
                    animal_event["event_type"],
                    animal_event["object_type"],
                    timestamp,
                )
                log_event(
                    event_type=animal_event["event_type"],
                    object_type=animal_event["object_type"],
                    timestamp=timestamp,
                    confidence=animal_event["confidence"],
                    image_path=image_path,
                    camera_id=camera_id,
                    zone_path=animal_event.get("zone_path"),
                )
                alert_animal_crossing(
                    animal_type=animal_event["object_type"],
                    timestamp=timestamp,
                    confidence=animal_event["confidence"],
                    image_path=relative_to_base(image_path),
                    zone_path=animal_event.get("zone_path"),
                    camera_id=camera_id,
                    sms_to=sms_recipients["animal"],
                )
                events_logged += 1

            accident_event = vehicle_tracker.update(detections)
            if accident_event:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                image_path = save_frame(
                    frame,
                    accident_event["event_type"],
                    accident_event["object_type"],
                    timestamp,
                )
                log_event(
                    event_type=accident_event["event_type"],
                    object_type=accident_event["object_type"],
                    timestamp=timestamp,
                    confidence=accident_event["confidence"],
                    image_path=image_path,
                    camera_id=camera_id,
                )
                alert_accident(
                    vehicles_count=accident_event["vehicles_count"],
                    timestamp=timestamp,
                    confidence=accident_event["confidence"],
                    image_path=relative_to_base(image_path),
                    camera_id=camera_id,
                    sms_to=sms_recipients["accident"],
                )
                events_logged += 1

            if show_preview:
                _draw_overlay(frame, detections, frame_w, frame_h)
                cv2.imshow("VANAM 2.0 Preview", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    print("[VANAM] User quit preview.")
                    break

    except KeyboardInterrupt:
        print("\n[VANAM] Interrupted by user.")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        alert_system_stop(events_logged)


def _draw_overlay(frame, detections, frame_w: int, frame_h: int) -> None:
    """Draw bounding boxes and zone lines on the preview frame."""
    for frac in (0.33, 0.67):
        x = int(frame_w * frac)
        cv2.line(frame, (x, 0), (x, frame_h), (200, 200, 0), 1)

    for det in detections:
        x1, y1, x2, y2 = det.bbox
        color = (0, 200, 80) if det.category == "animal" else (80, 80, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label = f"{det.label} {det.confidence:.2f}"
        cv2.putText(
            frame,
            label,
            (x1, y1 - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VANAM 2.0 road safety monitor")
    parser.add_argument(
        "--video",
        default=str(VIDEOS_DIR / "road.mp4"),
        help="Path to the input video file",
    )
    parser.add_argument(
        "--camera",
        default="CAM-01",
        help="Camera identifier used in the evidence log",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.40,
        help="YOLO confidence threshold",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Show a live OpenCV preview window",
    )
    parser.add_argument(
        "--animal-cls-model",
        default=None,
        help="Optional trained classifier checkpoint used to refine animal species labels",
    )
    parser.add_argument(
        "--animal-cls-conf",
        type=float,
        default=0.55,
        help="Confidence threshold for classifier-based relabeling",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(
        video_path=args.video,
        camera_id=args.camera,
        conf_threshold=args.conf,
        show_preview=args.preview,
        animal_cls_model=args.animal_cls_model,
        animal_cls_conf=args.animal_cls_conf,
    )