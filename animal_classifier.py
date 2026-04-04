from pathlib import Path

import numpy as np

from detection import Detection
from paths import configure_ultralytics_env


class AnimalClassifier:
    """Optional animal-species classifier used to refine animal detections."""

    def __init__(self, model_path: str, conf_threshold: float = 0.55):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.model = None
        self._load_model(model_path)

    def _load_model(self, model_path: str) -> None:
        try:
            configure_ultralytics_env()
            from ultralytics import YOLO

            self.model = YOLO(model_path)
            print(f"[AnimalClassifier] Model loaded: {model_path}")
        except Exception as exc:
            print(f"[AnimalClassifier] WARNING: could not load classifier: {exc}")
            print("[AnimalClassifier] Continuing without species refinement.")

    def enrich_detections(self, frame: np.ndarray, detections: list[Detection]) -> list[Detection]:
        if self.model is None:
            return detections

        enriched: list[Detection] = []
        for detection in detections:
            if detection.category != "animal":
                enriched.append(detection)
                continue
            enriched.append(self._classify_crop(frame, detection))
        return enriched

    def _classify_crop(self, frame: np.ndarray, detection: Detection) -> Detection:
        x1, y1, x2, y2 = detection.bbox
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(frame.shape[1], x2)
        y2 = min(frame.shape[0], y2)

        if x2 <= x1 or y2 <= y1:
            return detection

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return detection

        try:
            result = self.model(crop, verbose=False)[0]
            if result.probs is None:
                return detection

            top_index = int(result.probs.top1)
            top_conf = float(result.probs.top1conf)
            top_label = str(result.names[top_index]).lower()

            if top_conf < self.conf_threshold:
                return detection

            return detection.relabeled(top_label, confidence=max(detection.confidence, top_conf))
        except Exception:
            return detection
