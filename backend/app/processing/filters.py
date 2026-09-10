"""
AquaYantra — Signal filters.

Median filter, exponential moving average, low-pass Butterworth.
All filters are stateful and independently testable.
"""

from __future__ import annotations

from collections import deque

import numpy as np
from scipy.signal import butter, lfilter_zi, sosfilt, sosfilt_zi, sosfiltfilt

from app.core.config import settings


class MedianFilter:
    """Sliding-window median filter that preserves short transient signals."""

    def __init__(self, kernel_size: int | None = None) -> None:
        self.kernel_size = kernel_size or settings.MEDIAN_FILTER_KERNEL
        self._buffer: deque[float] = deque(maxlen=self.kernel_size)

    def apply(self, value: float) -> float:
        self._buffer.append(value)
        return float(np.median(list(self._buffer)))

    def reset(self) -> None:
        self._buffer.clear()


class ExponentialMovingAverage:
    """EMA filter with configurable smoothing factor."""

    def __init__(self, alpha: float | None = None) -> None:
        self.alpha = alpha or settings.EMA_ALPHA
        self._value: float | None = None

    def apply(self, value: float) -> float:
        if self._value is None:
            self._value = value
        else:
            self._value = self.alpha * value + (1 - self.alpha) * self._value
        return self._value

    def reset(self) -> None:
        self._value = None

    @property
    def current(self) -> float | None:
        return self._value


class LowPassFilter:
    """
    Second-order Butterworth low-pass filter for real-time sample-by-sample processing.

    Removes high-frequency noise while preserving the shape of slower anomaly signals.
    """

    def __init__(
        self,
        cutoff_hz: float | None = None,
        sample_rate_hz: float | None = None,
        order: int = 2,
    ) -> None:
        cutoff = cutoff_hz or settings.LOWPASS_CUTOFF_HZ
        fs = sample_rate_hz or settings.LOWPASS_SAMPLE_RATE_HZ
        nyq = fs / 2.0
        normalized_cutoff = min(cutoff / nyq, 0.99)

        self._sos = butter(order, normalized_cutoff, btype="low", output="sos")
        self._zi = sosfilt_zi(self._sos)
        self._initialized = False

    def apply(self, value: float) -> float:
        if not self._initialized:
            self._zi = self._zi * value
            self._initialized = True
        filtered, self._zi = sosfilt(self._sos, [value], zi=self._zi)
        return float(filtered[0])

    def reset(self) -> None:
        self._zi = sosfilt_zi(self._sos)
        self._initialized = False


class RobustRollingStatistics:
    """
    Rolling window statistics using robust estimators (median, MAD, percentiles).

    Used for baseline estimation and outlier detection — more resistant to
    anomalous samples than mean/std.
    """

    def __init__(self, window_size: int | None = None) -> None:
        self.window_size = window_size or settings.ROLLING_WINDOW_SIZE
        self._buffer: deque[float] = deque(maxlen=self.window_size)

    def update(self, value: float) -> None:
        self._buffer.append(value)

    @property
    def count(self) -> int:
        return len(self._buffer)

    @property
    def median(self) -> float:
        if not self._buffer:
            return 0.0
        return float(np.median(list(self._buffer)))

    @property
    def mad(self) -> float:
        """Median Absolute Deviation."""
        if len(self._buffer) < 2:
            return 0.0
        arr = np.array(self._buffer)
        return float(np.median(np.abs(arr - np.median(arr))))

    @property
    def robust_std(self) -> float:
        """MAD-based robust standard deviation estimator."""
        return self.mad * 1.4826

    @property
    def percentile_range(self) -> tuple[float, float]:
        """5th and 95th percentile."""
        if len(self._buffer) < 5:
            return (0.0, 0.0)
        arr = np.array(self._buffer)
        return (float(np.percentile(arr, 5)), float(np.percentile(arr, 95)))

    @property
    def mean(self) -> float:
        if not self._buffer:
            return 0.0
        return float(np.mean(list(self._buffer)))

    @property
    def std(self) -> float:
        if len(self._buffer) < 2:
            return 0.0
        return float(np.std(list(self._buffer)))

    def is_outlier(self, value: float, threshold_mads: float = 3.0) -> bool:
        """Check if a value is an outlier based on MAD."""
        if self.count < 10:
            return False
        robust = self.robust_std
        if robust < 1e-6:
            return False
        return abs(value - self.median) > threshold_mads * robust

    def reset(self) -> None:
        self._buffer.clear()
