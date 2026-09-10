"""
AquaYantra — Magnetometer processing.

All magnetic field calculations: magnitude, rolling statistics, baseline deviation,
rate of change, SNR, gradient, anomaly scoring from raw/calibrated magnetometer data.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from app.core.config import settings


@dataclass
class MagneticReading:
    """Processed magnetic reading with raw and derived values."""
    raw_x: float
    raw_y: float
    raw_z: float

    calibrated_x: float = 0.0
    calibrated_y: float = 0.0
    calibrated_z: float = 0.0

    magnitude: float = 0.0
    baseline: float = 0.0
    deviation: float = 0.0
    absolute_deviation: float = 0.0

    rolling_mean: float = 0.0
    rolling_median: float = 0.0
    rolling_std: float = 0.0
    rolling_mad: float = 0.0
    noise_floor: float = 0.0

    rate_of_change: float = 0.0
    gradient: float = 0.0
    signal_to_noise: float = 0.0
    local_peak_strength: float = 0.0
    moving_variance: float = 0.0

    normalized_anomaly_score: float = 0.0


class MagneticProcessor:
    """
    Stateful processor for magnetometer data.

    Maintains rolling windows and computes all derived magnetic features.
    All window sizes and parameters are configurable.
    """

    def __init__(
        self,
        window_size: int | None = None,
        median_kernel: int | None = None,
    ) -> None:
        self.window_size = window_size or settings.ROLLING_WINDOW_SIZE
        self.median_kernel = median_kernel or settings.MEDIAN_FILTER_KERNEL

        # Rolling magnitude buffer
        self._magnitudes: deque[float] = deque(maxlen=self.window_size)
        self._previous_magnitude: float | None = None

        # Track per-axis for potential multi-axis analysis
        self._x_buffer: deque[float] = deque(maxlen=self.window_size)
        self._y_buffer: deque[float] = deque(maxlen=self.window_size)
        self._z_buffer: deque[float] = deque(maxlen=self.window_size)

    def process(
        self,
        raw_x: float,
        raw_y: float,
        raw_z: float,
        calibrated_x: float | None = None,
        calibrated_y: float | None = None,
        calibrated_z: float | None = None,
        baseline: float = 0.0,
    ) -> MagneticReading:
        """
        Process a single magnetometer sample and compute all derived features.

        Parameters
        ----------
        raw_x, raw_y, raw_z : Raw magnetometer values (µT).
        calibrated_x, calibrated_y, calibrated_z : Calibrated values.
            If None, raw values are used.
        baseline : Current adaptive baseline magnitude.
        """
        cx = calibrated_x if calibrated_x is not None else raw_x
        cy = calibrated_y if calibrated_y is not None else raw_y
        cz = calibrated_z if calibrated_z is not None else raw_z

        magnitude = math.sqrt(cx * cx + cy * cy + cz * cz)

        # Update buffers
        self._magnitudes.append(magnitude)
        self._x_buffer.append(cx)
        self._y_buffer.append(cy)
        self._z_buffer.append(cz)

        # Rolling statistics
        mag_arr = np.array(self._magnitudes)
        rolling_mean = float(np.mean(mag_arr))
        rolling_median = float(np.median(mag_arr))
        rolling_std = float(np.std(mag_arr)) if len(mag_arr) > 1 else 0.0
        rolling_mad = float(np.median(np.abs(mag_arr - rolling_median)))
        noise_floor = rolling_mad * 1.4826  # robust std estimator

        # Moving variance
        moving_variance = float(np.var(mag_arr)) if len(mag_arr) > 1 else 0.0

        # Deviation from baseline
        deviation = magnitude - baseline if baseline > 0 else 0.0
        absolute_deviation = abs(deviation)

        # Rate of change
        rate_of_change = 0.0
        if self._previous_magnitude is not None:
            rate_of_change = magnitude - self._previous_magnitude
        self._previous_magnitude = magnitude

        # Gradient (approx derivative over last few samples)
        gradient = 0.0
        if len(mag_arr) >= 3:
            gradient = float(np.gradient(mag_arr[-min(5, len(mag_arr)):]).mean())

        # Signal-to-noise ratio
        signal_to_noise = 0.0
        if noise_floor > 1e-6:
            signal_to_noise = absolute_deviation / noise_floor

        # Local peak strength (deviation from rolling median)
        local_peak_strength = abs(magnitude - rolling_median)

        # Normalized anomaly score: how many MADs from baseline
        normalized_anomaly_score = 0.0
        if noise_floor > 1e-6 and baseline > 0:
            normalized_anomaly_score = min(absolute_deviation / noise_floor, 10.0) / 10.0

        reading = MagneticReading(
            raw_x=raw_x,
            raw_y=raw_y,
            raw_z=raw_z,
            calibrated_x=cx,
            calibrated_y=cy,
            calibrated_z=cz,
            magnitude=magnitude,
            baseline=baseline,
            deviation=deviation,
            absolute_deviation=absolute_deviation,
            rolling_mean=rolling_mean,
            rolling_median=rolling_median,
            rolling_std=rolling_std,
            rolling_mad=rolling_mad,
            noise_floor=noise_floor,
            rate_of_change=rate_of_change,
            gradient=gradient,
            signal_to_noise=signal_to_noise,
            local_peak_strength=local_peak_strength,
            moving_variance=moving_variance,
            normalized_anomaly_score=normalized_anomaly_score,
        )
        return reading

    def reset(self) -> None:
        """Clear all internal buffers."""
        self._magnitudes.clear()
        self._x_buffer.clear()
        self._y_buffer.clear()
        self._z_buffer.clear()
        self._previous_magnitude = None

    @property
    def sample_count(self) -> int:
        return len(self._magnitudes)


def compute_magnitude(x: float, y: float, z: float) -> float:
    """Compute magnetic field magnitude B = sqrt(x² + y² + z²)."""
    return math.sqrt(x * x + y * y + z * z)
