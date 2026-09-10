"""
AquaYantra — Temporal detection state machine.

A single noisy sample does NOT create a target. The FSM requires
sustained anomalies to confirm a detection event.

States: IDLE → WATCH → CANDIDATE → CONFIRMED_EVENT → COOLDOWN → BACKGROUND
"""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("ml.temporal")


class DetectionState(str, enum.Enum):
    IDLE = "IDLE"
    WATCH = "WATCH"
    CANDIDATE = "CANDIDATE"
    CONFIRMED_EVENT = "CONFIRMED_EVENT"
    COOLDOWN = "COOLDOWN"
    BACKGROUND = "BACKGROUND"


@dataclass
class TemporalEvent:
    """A confirmed detection event with temporal context."""
    start_time: float = 0.0
    peak_time: float = 0.0
    end_time: float = 0.0
    peak_anomaly: float = 0.0
    mean_anomaly: float = 0.0
    sample_count: int = 0
    duration_seconds: float = 0.0
    location: tuple[float, float] | None = None  # (lat, lon)
    depth: float | None = None
    feature_vector: dict[str, float] = field(default_factory=dict)
    confidence: float = 0.0
    confirmed: bool = False


class TemporalDetector:
    """
    Finite state machine for temporal anomaly detection.

    Prevents single-sample noise from creating false detections.
    Requires configurable persistence before confirming an event.
    """

    def __init__(
        self,
        watch_threshold: float | None = None,
        trigger_threshold: float | None = None,
        confirmation_threshold: float | None = None,
        min_persistence: int | None = None,
        cooldown_samples: int | None = None,
    ) -> None:
        self.watch_threshold = watch_threshold or settings.ANOMALY_WATCH_THRESHOLD
        self.trigger_threshold = trigger_threshold or settings.ANOMALY_THRESHOLD
        self.confirmation_threshold = confirmation_threshold or settings.ANOMALY_CONFIRMATION_THRESHOLD
        self.min_persistence = min_persistence or settings.ANOMALY_MIN_PERSISTENCE_SAMPLES
        self.cooldown_samples = cooldown_samples or settings.ANOMALY_COOLDOWN_SAMPLES

        self._state = DetectionState.IDLE
        self._consecutive_anomaly: int = 0
        self._cooldown_counter: int = 0

        # Current event tracking
        self._event_scores: list[float] = []
        self._event_start_time: float = 0.0
        self._event_peak_score: float = 0.0
        self._event_peak_time: float = 0.0
        self._event_locations: list[tuple[float, float]] = []
        self._event_depths: list[float] = []
        self._event_features: dict[str, float] = {}

    @property
    def state(self) -> DetectionState:
        return self._state

    @property
    def consecutive_anomaly_count(self) -> int:
        return self._consecutive_anomaly

    def process(
        self,
        anomaly_score: float,
        confidence: float = 0.0,
        timestamp: float | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        depth: float | None = None,
        feature_vector: dict[str, float] | None = None,
    ) -> TemporalEvent | None:
        """
        Process one sample through the temporal FSM.

        Returns a TemporalEvent when a detection is confirmed, else None.
        """
        ts = timestamp or time.time()

        # ── COOLDOWN state ───────────────────────────────────────
        if self._state == DetectionState.COOLDOWN:
            self._cooldown_counter += 1
            if self._cooldown_counter >= self.cooldown_samples:
                self._state = DetectionState.BACKGROUND
                self._cooldown_counter = 0
            return None

        # ── Check thresholds ─────────────────────────────────────
        above_watch = anomaly_score >= self.watch_threshold
        above_trigger = anomaly_score >= self.trigger_threshold
        above_confirm = anomaly_score >= self.confirmation_threshold

        if above_watch:
            self._consecutive_anomaly += 1
        else:
            # Score dropped below watch — end any active tracking
            if self._state in (DetectionState.WATCH, DetectionState.CANDIDATE, DetectionState.CONFIRMED_EVENT):
                event = self._finalize_event(ts, confidence)
                self._reset_tracking()
                if event and event.confirmed:
                    self._state = DetectionState.COOLDOWN
                    return event
            self._consecutive_anomaly = 0
            self._state = DetectionState.IDLE
            return None

        # ── IDLE → WATCH ─────────────────────────────────────────
        if self._state in (DetectionState.IDLE, DetectionState.BACKGROUND):
            self._state = DetectionState.WATCH
            self._event_start_time = ts
            self._event_scores = [anomaly_score]
            self._track_location(latitude, longitude, depth)
            if feature_vector:
                self._event_features = feature_vector.copy()
            return None

        # ── WATCH → CANDIDATE ────────────────────────────────────
        if self._state == DetectionState.WATCH:
            self._event_scores.append(anomaly_score)
            self._track_location(latitude, longitude, depth)

            if above_trigger and self._consecutive_anomaly >= 2:
                self._state = DetectionState.CANDIDATE
            return None

        # ── CANDIDATE → CONFIRMED_EVENT ──────────────────────────
        if self._state == DetectionState.CANDIDATE:
            self._event_scores.append(anomaly_score)
            self._track_location(latitude, longitude, depth)

            if anomaly_score > self._event_peak_score:
                self._event_peak_score = anomaly_score
                self._event_peak_time = ts

            if above_confirm and self._consecutive_anomaly >= self.min_persistence:
                self._state = DetectionState.CONFIRMED_EVENT
                logger.info(
                    "detection_confirmed",
                    peak=self._event_peak_score,
                    persistence=self._consecutive_anomaly,
                )
            return None

        # ── CONFIRMED_EVENT — still tracking ─────────────────────
        if self._state == DetectionState.CONFIRMED_EVENT:
            self._event_scores.append(anomaly_score)
            self._track_location(latitude, longitude, depth)
            if anomaly_score > self._event_peak_score:
                self._event_peak_score = anomaly_score
                self._event_peak_time = ts
            return None

        return None

    def _track_location(
        self,
        lat: float | None,
        lon: float | None,
        depth: float | None,
    ) -> None:
        if lat is not None and lon is not None:
            self._event_locations.append((lat, lon))
        if depth is not None:
            self._event_depths.append(depth)

    def _finalize_event(self, end_time: float, confidence: float) -> TemporalEvent | None:
        """Finalize the current tracking into an event if sufficient data."""
        if not self._event_scores:
            return None

        import numpy as np

        confirmed = (
            self._state in (DetectionState.CONFIRMED_EVENT, DetectionState.CANDIDATE)
            and len(self._event_scores) >= self.min_persistence
        )

        location = None
        if self._event_locations:
            lats = [loc[0] for loc in self._event_locations]
            lons = [loc[1] for loc in self._event_locations]
            location = (float(np.mean(lats)), float(np.mean(lons)))

        depth = float(np.mean(self._event_depths)) if self._event_depths else None

        return TemporalEvent(
            start_time=self._event_start_time,
            peak_time=self._event_peak_time or self._event_start_time,
            end_time=end_time,
            peak_anomaly=self._event_peak_score,
            mean_anomaly=float(np.mean(self._event_scores)),
            sample_count=len(self._event_scores),
            duration_seconds=end_time - self._event_start_time,
            location=location,
            depth=depth,
            feature_vector=self._event_features,
            confidence=confidence,
            confirmed=confirmed,
        )

    def _reset_tracking(self) -> None:
        """Reset event tracking state."""
        self._event_scores = []
        self._event_start_time = 0.0
        self._event_peak_score = 0.0
        self._event_peak_time = 0.0
        self._event_locations = []
        self._event_depths = []
        self._event_features = {}

    def reset(self) -> None:
        """Full state reset."""
        self._state = DetectionState.IDLE
        self._consecutive_anomaly = 0
        self._cooldown_counter = 0
        self._reset_tracking()
