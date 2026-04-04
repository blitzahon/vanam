"""
accident_logic.py – Centroid-velocity accident detection for VANAM 2.0.

Algorithm
─────────
1. Track vehicle centroids across frames.
2. Compute per-vehicle velocity (pixels / frame).
3. Flag sudden deceleration  → velocity drops below DECEL_THRESHOLD
   within DECEL_WINDOW frames.
4. If the vehicle then remains stationary for FREEZE_FRAMES → ACCIDENT.
5. Optional: if two vehicle centroids are very close (collision radius),
   the confidence is elevated to HIGH.
"""

from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple
import math
from detection import Detection

# ── Tunable parameters ─────────────────────────────────────────────────────
DECEL_THRESHOLD: float = 5.0    # px/frame considered "stopped"
DECEL_WINDOW:    int   = 10     # frames to observe deceleration
FREEZE_FRAMES:   int   = 15     # frames stationary before accident confirmed
COLLISION_DIST:  float = 60.0   # px – two vehicles this close → HIGH confidence
MAX_TRACK_AGE:   int   = 30     # frames before removing a lost track


def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


class VehicleTracker:
    """
    Tracks vehicle centroids across frames and fires an accident event
    when the stopping pattern is confirmed.
    """

    def __init__(self, frame_width: int, frame_height: int):
        self.frame_width  = frame_width
        self.frame_height = frame_height
        self._max_dist    = frame_width * 0.10

        # track_id → deque of recent centroids (newest last)
        self._history:     Dict[int, deque] = {}
        self._age:         Dict[int, int]   = {}   # frames since last match
        self._freeze_cnt:  Dict[int, int]   = {}   # consecutive stopped frames
        self._accident_ids = set()
        self._next_id = 0

    # ── Public API ──────────────────────────────────────────────────────────

    def update(self, detections: List[Detection]) -> Optional[dict]:
        """
        Feed vehicle detections for the current frame.
        Returns an event dict when an accident is confirmed, else None.
        """
        vehicle_dets = [d for d in detections if d.category == "vehicle"]

        self._age_tracks()
        self._assign(vehicle_dets)
        return self._check_accidents(vehicle_dets)

    # ── Internal helpers ────────────────────────────────────────────────────

    def _age_tracks(self):
        """Increment age counters; prune stale tracks."""
        stale = [tid for tid, age in self._age.items() if age > MAX_TRACK_AGE]
        for tid in stale:
            del self._history[tid]
            del self._age[tid]
            self._freeze_cnt.pop(tid, None)

        for tid in list(self._age):
            self._age[tid] += 1

    def _assign(self, dets: List[Detection]):
        unmatched = list(dets)

        for tid in list(self._history):
            if not unmatched:
                break
            last_cx, last_cy = self._history[tid][-1]
            best_idx, best_dist = None, float("inf")
            for i, det in enumerate(unmatched):
                d = _dist(det.centroid, (last_cx, last_cy))
                if d < best_dist:
                    best_dist, best_idx = d, i

            if best_idx is not None and best_dist < self._max_dist:
                det = unmatched.pop(best_idx)
                self._history[tid].append(det.centroid)
                if len(self._history[tid]) > DECEL_WINDOW + 5:
                    self._history[tid].popleft()
                self._age[tid] = 0

        # New tracks
        for det in unmatched:
            self._history[self._next_id] = deque([det.centroid], maxlen=DECEL_WINDOW + 5)
            self._age[self._next_id]     = 0
            self._freeze_cnt[self._next_id] = 0
            self._next_id += 1

    def _velocity(self, tid: int) -> float:
        """Mean centroid displacement over the last few frames."""
        pts = list(self._history[tid])
        if len(pts) < 2:
            return float("inf")
        displacements = [_dist(pts[i], pts[i - 1]) for i in range(1, len(pts))]
        return sum(displacements) / len(displacements)

    def _check_accidents(self, vehicle_dets: List[Detection]) -> Optional[dict]:
        for tid in list(self._history):
            if tid in self._accident_ids:
                continue
            if len(self._history[tid]) < DECEL_WINDOW:
                continue

            vel = self._velocity(tid)

            if vel <= DECEL_THRESHOLD:
                self._freeze_cnt[tid] = self._freeze_cnt.get(tid, 0) + 1
            else:
                self._freeze_cnt[tid] = 0

            if self._freeze_cnt.get(tid, 0) >= FREEZE_FRAMES:
                self._accident_ids.add(tid)
                conf, label = self._assess_confidence(vehicle_dets)
                return {
                    "event_type":     "Accident",
                    "object_type":    label,
                    "confidence":     conf,
                    "vehicles_count": len(vehicle_dets),
                }
        return None

    def _assess_confidence(
        self, dets: List[Detection]
    ) -> Tuple[float, str]:
        """Compute confidence; elevate if two vehicles are very close."""
        base_conf = max((d.confidence for d in dets), default=0.70)
        label = f"{len(dets)} vehicle(s)"

        # Check collision proximity
        centroids = [d.centroid for d in dets]
        for i in range(len(centroids)):
            for j in range(i + 1, len(centroids)):
                if _dist(centroids[i], centroids[j]) < COLLISION_DIST:
                    base_conf = min(base_conf + 0.15, 0.99)
                    label = f"{len(dets)} vehicles (collision proximity)"
                    break

        return round(base_conf, 2), label
