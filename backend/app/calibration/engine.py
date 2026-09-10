"""
AquaYantra — Calibration engine orchestrator.

Coordinates hard-iron, soft-iron, adaptive baseline, and drift compensation
into a single per-device calibration session.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.calibration.baseline import AdaptiveBaseline, BaselineState
from app.calibration.drift import DriftCompensator, DriftEstimate
from app.calibration.hard_iron import HardIronCalibrator, HardIronResult
from app.calibration.soft_iron import SoftIronCalibrator, SoftIronResult, apply_calibration
from app.core.config import settings
from app.core.logging import get_logger
from app.processing.magnetic import MagneticReading

logger = get_logger("calibration.engine")


class CalibrationStatus(str, enum.Enum):
    UNCALIBRATED = "uncalibrated"
    INITIALIZING = "initializing"
    CALIBRATED = "calibrated"
    ADAPTING = "adapting"
    FROZEN_DUE_TO_ANOMALY = "frozen_due_to_anomaly"
    LOW_CONFIDENCE = "low_confidence"
    SENSOR_FAULT = "sensor_fault"


@dataclass
class CalibrationState:
    """Full calibration state for a device."""
    status: CalibrationStatus = CalibrationStatus.UNCALIBRATED
    hard_iron: HardIronResult = field(default_factory=HardIronResult)
    soft_iron: SoftIronResult = field(default_factory=SoftIronResult)
    baseline: float = 0.0
    noise: float = 0.0
    quality: float = 0.0
    sample_count: int = 0
    drift: DriftEstimate = field(default_factory=DriftEstimate)


class CalibrationEngine:
    """
    Per-device calibration engine.

    Orchestrates:
    1. Hard-iron offset estimation
    2. Soft-iron matrix estimation
    3. Adaptive baseline tracking (with anomaly freeze)
    4. Drift compensation

    The engine separates calibration from anomaly detection.
    """

    def __init__(self, device_id: str) -> None:
        self.device_id = device_id
        self._hard_iron = HardIronCalibrator()
        self._soft_iron = SoftIronCalibrator()
        self._baseline = AdaptiveBaseline()
        self._drift = DriftCompensator()

        self._hard_iron_result = HardIronResult()
        self._soft_iron_result = SoftIronResult()

        self._status = CalibrationStatus.UNCALIBRATED
        self._total_samples: int = 0
        self._calibration_computed: bool = False

    @property
    def status(self) -> CalibrationStatus:
        return self._status

    @property
    def baseline_value(self) -> float:
        return self._baseline.value

    @property
    def noise_estimate(self) -> float:
        return self._baseline.noise

    @property
    def sample_count(self) -> int:
        return self._total_samples

    def process_sample(
        self,
        raw_x: float,
        raw_y: float,
        raw_z: float,
        timestamp: float,
        anomaly_probability: float = 0.0,
        sensor_healthy: bool = True,
        data_quality: float = 1.0,
    ) -> tuple[float, float, float, CalibrationState]:
        """
        Process a raw magnetometer sample through the calibration pipeline.

        Returns calibrated (x, y, z) and current calibration state.
        """
        self._total_samples += 1

        # Accumulate samples for hard/soft iron
        self._hard_iron.add_sample(raw_x, raw_y, raw_z)
        self._soft_iron.add_sample(raw_x, raw_y, raw_z)

        # Compute hard-iron if enough samples and not yet computed
        if (
            not self._calibration_computed
            and self._hard_iron.sample_count >= settings.CALIBRATION_MIN_SAMPLES
        ):
            self._hard_iron_result = self._hard_iron.estimate()
            self._soft_iron_result = self._soft_iron.estimate(
                hard_iron_offset=(
                    self._hard_iron_result.offset_x,
                    self._hard_iron_result.offset_y,
                    self._hard_iron_result.offset_z,
                )
            )
            self._calibration_computed = True
            logger.info(
                "calibration_computed",
                device=self.device_id,
                hard_iron_quality=self._hard_iron_result.quality,
            )

        # Apply calibration
        cal_x, cal_y, cal_z = apply_calibration(
            raw_x, raw_y, raw_z,
            offset_x=self._hard_iron_result.offset_x,
            offset_y=self._hard_iron_result.offset_y,
            offset_z=self._hard_iron_result.offset_z,
            matrix=self._soft_iron_result.matrix if not self._soft_iron_result.is_identity else None,
        )

        # Compute magnitude for baseline tracking
        magnitude = math.sqrt(cal_x ** 2 + cal_y ** 2 + cal_z ** 2)

        # Determine variance acceptability
        variance_ok = True  # Simplified; could track rolling variance

        # Update adaptive baseline
        baseline_status = self._baseline.update(
            magnitude,
            anomaly_probability=anomaly_probability,
            sensor_healthy=sensor_healthy,
            data_quality=data_quality,
            variance_acceptable=variance_ok,
        )

        # Track drift
        drift = self._drift.record(timestamp, baseline_status.value, baseline_status.noise_estimate)

        # Update overall status
        self._update_status(baseline_status.state, sensor_healthy, drift)

        state = CalibrationState(
            status=self._status,
            hard_iron=self._hard_iron_result,
            soft_iron=self._soft_iron_result,
            baseline=baseline_status.value,
            noise=baseline_status.noise_estimate,
            quality=self._compute_quality(),
            sample_count=self._total_samples,
            drift=drift,
        )

        return cal_x, cal_y, cal_z, state

    def _update_status(
        self,
        baseline_state: BaselineState,
        sensor_healthy: bool,
        drift: DriftEstimate,
    ) -> None:
        """Update calibration status based on subsystem states."""
        if not sensor_healthy:
            self._status = CalibrationStatus.SENSOR_FAULT
        elif baseline_state == BaselineState.UNINITIALIZED:
            self._status = CalibrationStatus.UNCALIBRATED
        elif baseline_state == BaselineState.INITIALIZING:
            self._status = CalibrationStatus.INITIALIZING
        elif baseline_state == BaselineState.FROZEN:
            self._status = CalibrationStatus.FROZEN_DUE_TO_ANOMALY
        elif not self._calibration_computed:
            self._status = CalibrationStatus.LOW_CONFIDENCE
        elif drift.is_drifting:
            self._status = CalibrationStatus.ADAPTING
        else:
            self._status = CalibrationStatus.CALIBRATED

    def _compute_quality(self) -> float:
        """Compute overall calibration quality score (0–1)."""
        factors = []

        # Hard-iron quality
        factors.append(self._hard_iron_result.quality)

        # Baseline initialization
        if self._baseline.state in (BaselineState.UNINITIALIZED, BaselineState.INITIALIZING):
            factors.append(0.2)
        elif self._baseline.state == BaselineState.FROZEN:
            factors.append(0.6)
        else:
            factors.append(0.9)

        # Sample count factor
        sample_factor = min(1.0, self._total_samples / 500.0)
        factors.append(sample_factor)

        return float(np.mean(factors))

    def get_state(self) -> CalibrationState:
        """Return current calibration state."""
        return CalibrationState(
            status=self._status,
            hard_iron=self._hard_iron_result,
            soft_iron=self._soft_iron_result,
            baseline=self._baseline.value,
            noise=self._baseline.noise,
            quality=self._compute_quality(),
            sample_count=self._total_samples,
        )

    def reset(self) -> None:
        """Reset all calibration state."""
        self._hard_iron.reset()
        self._soft_iron.reset()
        self._baseline.reset()
        self._drift.reset()
        self._hard_iron_result = HardIronResult()
        self._soft_iron_result = SoftIronResult()
        self._status = CalibrationStatus.UNCALIBRATED
        self._total_samples = 0
        self._calibration_computed = False
