"""
animal_logic.py – Zone-based animal crossing detection for VANAM 2.0.

The road frame is divided into three vertical zones:

    Zone A  │  Zone B  │  Zone C
   (left)   │ (centre) │  (right)

An animal crossing is confirmed when its centroid transitions
A → B → C  (or C → B → A) across at least CONFIRM_FRAMES consecutive frames.
"""

from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from detection import Detection

# ── Tunable parameters ────────────────────────────────────────────────────────
CONFIRM_FRAMES: int = 5   # consecutive frames the animal must stay in new zone
ZONE_BOUNDS: Tuple[float, float] = (0.33, 0.67)  # fraction of frame width


def _zone(x: float, frame_width: int) -> str:
    """Return 'A', 'B', or 'C' based on horizontal position."""
    ratio = x / frame_width
    if ratio < ZONE_BOUNDS[0]:
        return "A"
    elif ratio < ZONE_BOUNDS[1]:
        return "B"
    return "C"


class AnimalTracker:
    """
    Tracks individual animals by a simple nearest-centroid assignment.
    Each track records the zone history and a confirmation counter.
    """

    def __init__(self, frame_width: int):
        self.frame_width = frame_width
        # track_id → {label, zone_path, current_zone, confirm_count, crossed}
        self._tracks: Dict[int, dict] = {}
        self._next_id = 0
        self._max_dist = frame_width * 0.15   # max pixel distance for ID re-assignment

    # ── Public API ────────────────────────────────────────────────────────────

    def update(self, detections: List[Detection]) -> Optional[dict]:
        """
        Feed the current frame's animal detections.
        Returns an event dict if a crossing is confirmed, otherwise None.
        """
        animal_dets = [d for d in detections if d.category == "animal"]

        if not animal_dets:
            # Decay unmatched tracks slightly (optional; keeps memory tidy)
            return None

        self._assign(animal_dets)
        return self._check_crossings()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _assign(self, dets: List[Detection]):
        """Nearest-centroid assignment between existing tracks and new detections."""
        unmatched = list(dets)

        for tid, track in self._tracks.items():
            if not unmatched:
                break
            best_idx, best_dist = None, float("inf")
            for i, det in enumerate(unmatched):
                cx, _ = det.centroid
                dist = abs(cx - track["cx"])
                if dist < best_dist:
                    best_dist, best_idx = dist, i

            if best_idx is not None and best_dist < self._max_dist:
                det = unmatched.pop(best_idx)
                cx, _ = det.centroid
                new_zone = _zone(cx, self.frame_width)
                self._update_track(tid, new_zone, cx, det.label, det.confidence)

        # Create new tracks for unmatched detections
        for det in unmatched:
            cx, _ = det.centroid
            zone = _zone(cx, self.frame_width)
            self._tracks[self._next_id] = {
                "label":         det.label,
                "zone_path":     [zone],
                "current_zone":  zone,
                "confirm_count": 1,
                "crossed":       False,
                "cx":            cx,
                "confidence":    det.confidence,
            }
            self._next_id += 1

    def _update_track(self, tid: int, new_zone: str, cx: float,
                      label: str, confidence: float):
        track = self._tracks[tid]
        track["cx"] = cx
        track["confidence"] = confidence
        if new_zone == track["current_zone"]:
            track["confirm_count"] += 1
        else:
            # Zone changed – extend path if logical progression
            if new_zone != track["zone_path"][-1]:
                track["zone_path"].append(new_zone)
            track["current_zone"] = new_zone
            track["confirm_count"] = 1

    def _check_crossings(self) -> Optional[dict]:
        for tid, track in list(self._tracks.items()):
            if track["crossed"]:
                continue
            path = track["zone_path"]
            # Full A→B→C or C→B→A crossing
            if (path[:3] == ["A", "B", "C"] or path[:3] == ["C", "B", "A"]):
                if track["confirm_count"] >= CONFIRM_FRAMES:
                    track["crossed"] = True
                    return {
                        "event_type":  "Animal Crossing",
                        "object_type": track["label"].capitalize(),
                        "confidence":  track["confidence"],
                        "zone_path":   " → ".join(path),
                    }
        return None
