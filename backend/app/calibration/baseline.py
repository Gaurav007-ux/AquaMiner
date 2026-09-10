"""
AquaYantra — Adaptive baseline engine.

CRITICAL: The baseline must ONLY update from trustworthy background data.
Anomalies must NEVER be absorbed into the baseline.

Logic:
- IF stable background → update baseline slowly
- IF strong anomaly → FREEZE baseline
- IF uncertain → update extremely slowly or freeze
"""

from __future__ import annotations

import enum
from collections import deque
from dataclasses import dataclass

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("calibration.baseline")


class BaselineState(str, enum.Enum):
    """State of the adaptive baseline engine."""
    UNINITIALIZED = "uninitialized"
    INITIALIZING = "initializing"
    TRACKING = "tracking"
    FROZEN = "frozen"  # frozen due to active anomaly
    SLOW_ADAPT = "slow_adapt"  # uncertain — updating very slowly


@dataclass
class BaselineStatus:
    """Current state of the adaptive baseline."""
    value: float = 0.0
    state: BaselineState = BaselineState.UNINITIALIZED
    noise_estimate: float = 0.0
    sample_count: int = 0
    frozen_reason: str = ""
    last_update_delta: float = 0.0


class AdaptiveBaseline:
    """
    Adaptive baseline estimator for the magnetic field magnitude.

    Uses robust statistics (median, MAD) and enforces strict rules
    to prevent anomaly absorption.

    Key safety mechanisms:
    1. Only updates from samples classified as background
    2. Freezes when anomaly probability is high
    3. Limits maximum drift rate per update
    4. Requires minimum sample count before adaptation
    5. Uses exponentially weighted update with very small alpha
    """

    def __init__(
        self,
        init_window: int | None = None,
        update_rate: float | None = None,
        freeze_threshold: float | None = None,
        max_drift_per_update: float = 0.1,
        slow_rate_factor: float = 0.1,
    ) -> None:
        self.init_window = init_window or settings.CALIBRATION_INIT_WINDOW
        self.update_rate = update_rate or settings.BASELINE_UPDATE_RATE
        self.freeze_threshold = freeze_threshold or settings.BASELINE_FREEZE_ANOMALY_THRESHOLD
        self.max_drift_per_update = max_drift_per_update
        self.slow_rate_factor = slow_rate_factor

        self._init_buffer: deque[float] = deque(maxlen=self.init_window)
        self._background_buffer: deque[float] = deque(maxlen=500)

        self._baseline: float = 0.0
        self._noise: float = 0.0
        self._state = BaselineState.UNINITIALIZED
        self._sample_count: int = 0
        self._frozen_reason: str = ""

    @property
    def value(self) -> float:
        return self._baseline

    @property
    def noise(self) -> float:
        return self._noise

    @property
    def state(self) -> BaselineState:
        return self._state

    @property
    def sample_count(self) -> int:
        return self._sample_count

    def update(
        self,
        magnitude: float,
        anomaly_probability: float = 0.0,
        sensor_healthy: bool = True,
        data_quality: float = 1.0,
        variance_acceptable: bool = True,
    ) -> BaselineStatus:
        """
        Process a new magnitude sample and potentially update the baseline.

        Parameters
        ----------
        magnitude : Current magnetic field magnitude.
        anomaly_probability : 0–1 probability that this is an anomaly.
        sensor_healthy : Whether the sensor is reporting healthy.
        data_quality : 0–1 data quality score.
        variance_acceptable : Whether recent variance is within bounds.

        Returns
        -------
        Current baseline status after processing this sample.
        """
        self._sample_count += 1

        # Phase 1: Initialization
        if self._state in (BaselineState.UNINITIALIZED, BaselineState.INITIALIZING):
            return self._handle_initialization(magnitude)

        # Phase 2: Operational — decide whether to update
        return self._handle_operational(
            magnitude,
            anomaly_probability=anomaly_probability,
            sensor_healthy=sensor_healthy,
            data_quality=data_quality,
            variance_acceptable=variance_acceptable,
        )

    def _handle_initialization(self, magnitude: float) -> BaselineStatus:
        """Collect initialization window and compute initial baseline."""
        self._state = BaselineState.INITIALIZING
        self._init_buffer.append(magnitude)

        if len(self._init_buffer) < self.init_window:
            return self._make_status(last_delta=0.0)

        # Initialization complete — compute robust baseline
        arr = np.array(self._init_buffer)
        self._baseline = float(np.median(arr))
        mad = float(np.median(np.abs(arr - self._baseline)))
        self._noise = mad * 1.4826  # Robust std estimate

        self._state = BaselineState.TRACKING
        logger.info(
            "baseline_initialized",
            baseline=self._baseline,
            noise=self._noise,
            samples=len(self._init_buffer),
        )
        return self._make_status(last_delta=0.0)

    def _handle_operational(
        self,
        magnitude: float,
        anomaly_probability: float,
        sensor_healthy: bool,
        data_quality: float,
        variance_acceptable: bool,
    ) -> BaselineStatus:
        """Decide whether to update, freeze, or slow-adapt the baseline."""

        # ── FREEZE conditions ────────────────────────────────────
        if not sensor_healthy:
            self._state = BaselineState.FROZEN
            self._frozen_reason = "sensor_unhealthy"
            return self._make_status(last_delta=0.0)

        deviation_mads = 0.0
        if self._noise > 1e-6:
            deviation_mads = abs(magnitude - self._baseline) / self._noise

        if anomaly_probability > 0.7 or deviation_mads > self.freeze_threshold:
            self._state = BaselineState.FROZEN
            self._frozen_reason = (
                f"anomaly_detected (prob={anomaly_probability:.2f}, "
                f"deviation={deviation_mads:.1f} MADs)"
            )
            return self._make_status(last_delta=0.0)

        # ── SLOW ADAPT conditions ────────────────────────────────
        effective_rate = self.update_rate

        if data_quality < 0.5:
            self._state = BaselineState.SLOW_ADAPT
            effective_rate *= self.slow_rate_factor
        elif anomaly_probability > 0.3 or not variance_acceptable:
            self._state = BaselineState.SLOW_ADAPT
            effective_rate *= self.slow_rate_factor * 0.5
        else:
            self._state = BaselineState.TRACKING

        # ── Update baseline ──────────────────────────────────────
        self._background_buffer.append(magnitude)

        delta = magnitude - self._baseline
        clamped_delta = max(-self.max_drift_per_update, min(self.max_drift_per_update, delta))
        actual_update = effective_rate * clamped_delta

        self._baseline += actual_update

        # Update noise estimate from background buffer (slowly)
        if len(self._background_buffer) >= 20:
            bg_arr = np.array(self._background_buffer)
            bg_median = float(np.median(bg_arr))
            new_noise = float(np.median(np.abs(bg_arr - bg_median))) * 1.4826
            # Blend noise estimate slowly
            self._noise = 0.99 * self._noise + 0.01 * new_noise

        return self._make_status(last_delta=actual_update)

    def _make_status(self, last_delta: float) -> BaselineStatus:
        return BaselineStatus(
            value=self._baseline,
            state=self._state,
            noise_estimate=self._noise,
            sample_count=self._sample_count,
            frozen_reason=self._frozen_reason if self._state == BaselineState.FROZEN else "",
            last_update_delta=last_delta,
        )

    def force_freeze(self, reason: str = "manual") -> None:
        """Manually freeze the baseline."""
        self._state = BaselineState.FROZEN
        self._frozen_reason = reason

    def unfreeze(self) -> None:
        """Resume baseline tracking."""
        if self._state == BaselineState.FROZEN:
            self._state = BaselineState.TRACKING
            self._frozen_reason = ""

    def reset(self) -> None:
        """Reset all state."""
        self._init_buffer.clear()
        self._background_buffer.clear()
        self._baseline = 0.0
        self._noise = 0.0
        self._state = BaselineState.UNINITIALIZED
        self._sample_count = 0
        self._frozen_reason = ""
