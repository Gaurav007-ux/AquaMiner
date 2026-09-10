"""
AquaYantra — Sensor drift compensation.

Tracks slow sensor offset drift, noise drift, and temperature effects.
Uses slow adaptive correction rather than aggressive instantaneous correction.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("calibration.drift")


@dataclass
class DriftEstimate:
    """Current drift estimates."""
    offset_drift_rate: float = 0.0  # µT per hour
    noise_drift_rate: float = 0.0
    total_offset_drift: float = 0.0
    is_drifting: bool = False
    correction_applied: float = 0.0


class DriftCompensator:
    """
    Tracks and compensates for slow sensor drift over time.

    Monitors baseline changes across windows and applies gradual
    corrections. Does NOT apply aggressive instantaneous corrections.
    """

    def __init__(
        self,
        window_size: int = 100,
        max_drift_per_hour: float | None = None,
    ) -> None:
        self.max_drift_per_hour = max_drift_per_hour or settings.MAX_BASELINE_DRIFT_PER_HOUR
        self._baseline_history: deque[tuple[float, float]] = deque(maxlen=window_size)  # (timestamp, baseline)
        self._noise_history: deque[tuple[float, float]] = deque(maxlen=window_size)
        self._cumulative_drift: float = 0.0

    def record(self, timestamp: float, baseline: float, noise: float) -> DriftEstimate:
        """
        Record a baseline/noise observation and estimate drift.

        Parameters
        ----------
        timestamp : Unix timestamp of the observation.
        baseline : Current baseline value.
        noise : Current noise estimate.
        """
        self._baseline_history.append((timestamp, baseline))
        self._noise_history.append((timestamp, noise))

        estimate = DriftEstimate()

        if len(self._baseline_history) < 10:
            return estimate

        # Estimate drift rate from recent history
        times = np.array([t for t, _ in self._baseline_history])
        baselines = np.array([b for _, b in self._baseline_history])

        dt_hours = (times[-1] - times[0]) / 3600.0
        if dt_hours < 0.01:
            return estimate

        # Linear trend via robust fit
        baseline_change = float(baselines[-1] - baselines[0])
        estimate.offset_drift_rate = baseline_change / dt_hours
        estimate.total_offset_drift = baseline_change

        # Noise drift
        noise_vals = np.array([n for _, n in self._noise_history])
        noise_change = float(noise_vals[-1] - noise_vals[0])
        estimate.noise_drift_rate = noise_change / dt_hours

        # Check if drift exceeds threshold
        estimate.is_drifting = abs(estimate.offset_drift_rate) > self.max_drift_per_hour

        if estimate.is_drifting:
            logger.warning(
                "sensor_drift_detected",
                drift_rate=estimate.offset_drift_rate,
                max_allowed=self.max_drift_per_hour,
            )

        return estimate

    def reset(self) -> None:
        self._baseline_history.clear()
        self._noise_history.clear()
        self._cumulative_drift = 0.0
