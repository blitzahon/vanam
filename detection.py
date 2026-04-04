"""
detection.py – YOLOv8 wrapper for VANAM 2.0.

Detects animals and vehicles in a single frame and returns structured
Detection objects that the logic modules can work with.
"""

from dataclasses import dataclass, field
from typing import List, Tuple
import numpy as np
from paths import configure_ultralytics_env

# ── Label sets ────────────────────────────────────────────────────────────────
ANIMAL_LABELS   = {
    "bird",
    "cat",
    "cow",
    "dog",
    "elephant",
    "goat",
    "horse",
    "lion",
    "sheep",
}
VEHICLE_LABELS  = {"car", "motorcycle", "truck", "bus", "bicycle"}

# COCO class names for reference (YOLOv8 pretrained)
COCO_NAMES = [
    "person","bicycle","car","motorcycle","airplane","bus","train","truck",
    "boat","traffic light","fire hydrant","stop sign","parking meter","bench",
    "bird","cat","dog","horse","sheep","cow","elephant","bear","zebra","giraffe",
    "backpack","umbrella","handbag","tie","suitcase","frisbee","skis","snowboard",
    "sports ball","kite","baseball bat","baseball glove","skateboard","surfboard",
    "tennis racket","bottle","wine glass","cup","fork","knife","spoon","bowl",
    "banana","apple","sandwich","orange","broccoli","carrot","hot dog","pizza",
    "donut","cake","chair","couch","potted plant","bed","dining table","toilet",
    "tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven",
    "toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear",
    "hair drier","toothbrush"
]


@dataclass
class Detection:
    label: str          # e.g. "cow", "car"
    confidence: float   # 0.0 – 1.0
    bbox: Tuple[int, int, int, int]   # (x1, y1, x2, y2) in pixels
    category: str = field(init=False)  # "animal" | "vehicle" | "other"

    def __post_init__(self):
        if self.label in ANIMAL_LABELS:
            self.category = "animal"
        elif self.label in VEHICLE_LABELS:
            self.category = "vehicle"
        else:
            self.category = "other"

    @property
    def centroid(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    def relabeled(self, label: str, confidence: float | None = None) -> "Detection":
        return Detection(
            label=label,
            confidence=self.confidence if confidence is None else confidence,
            bbox=self.bbox,
        )


class Detector:
    """
    Thin wrapper around a YOLOv8 model.
    Falls back to an empty detection list if the model is unavailable
    (useful for unit-testing without a GPU/model file).
    """

    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.40):
        self.conf_threshold = conf_threshold
        self.model = None
        self._load_model(model_path)

    def _load_model(self, model_path: str):
        try:
            configure_ultralytics_env()
            from ultralytics import YOLO
            self.model = YOLO(model_path)
            print(f"[Detector] Model loaded: {model_path}")
        except Exception as exc:
            print(f"[Detector] WARNING – could not load YOLO model: {exc}")
            print("[Detector] Running in MOCK mode (no detections).")

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """Run inference on a single BGR frame; return a list of Detection objects."""
        if self.model is None:
            return []

        results = self.model(frame, verbose=False)[0]
        detections: List[Detection] = []

        for box in results.boxes:
            conf = float(box.conf[0])
            if conf < self.conf_threshold:
                continue

            cls_id = int(box.cls[0])
            label  = COCO_NAMES[cls_id] if cls_id < len(COCO_NAMES) else str(cls_id)
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            detections.append(Detection(
                label=label,
                confidence=conf,
                bbox=(x1, y1, x2, y2),
            ))

        return detections
