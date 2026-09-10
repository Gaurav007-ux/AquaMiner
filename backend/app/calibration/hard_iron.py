"""
AquaYantra — Hard-iron calibration.

Estimates static magnetometer offsets from background data.
Supports simple robust-median estimation and sphere fitting
when sufficient data is available.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import least_squares

from app.core.logging import get_logger

logger = get_logger("calibration.hard_iron")


@dataclass
class HardIronResult:
    """Result of hard-iron offset estimation."""
    offset_x: float = 0.0
    offset_y: float = 0.0
    offset_z: float = 0.0
    quality: float = 0.0  # 0–1
    method: str = "none"
    sample_count: int = 0


class HardIronCalibrator:
    """
    Hard-iron offset estimator.

    Uses robust median estimation by default.
    When sufficient spatially-distributed data is available,
    attempts sphere fitting for better accuracy.
    """

    SPHERE_FIT_MIN_SAMPLES = 200

    def __init__(self) -> None:
        self._samples: list[tuple[float, float, float]] = []

    def add_sample(self, x: float, y: float, z: float) -> None:
        """Add a raw magnetometer sample for calibration."""
        self._samples.append((x, y, z))

    def add_samples(self, samples: list[tuple[float, float, float]]) -> None:
        """Add multiple raw magnetometer samples."""
        self._samples.extend(samples)

    @property
    def sample_count(self) -> int:
        return len(self._samples)

    def estimate(self) -> HardIronResult:
        """
        Estimate hard-iron offsets.

        Uses robust median for small datasets and attempts
        sphere fitting when sufficient data exists.
        """
        if len(self._samples) < 10:
            logger.warning("insufficient_samples_for_hard_iron", count=len(self._samples))
            return HardIronResult(method="insufficient_data", sample_count=len(self._samples))

        arr = np.array(self._samples)

        # Always compute robust median estimate as fallback
        median_result = self._estimate_median(arr)

        # Attempt sphere fit if enough data
        if len(self._samples) >= self.SPHERE_FIT_MIN_SAMPLES:
            sphere_result = self._estimate_sphere_fit(arr)
            if sphere_result is not None and sphere_result.quality > median_result.quality:
                logger.info("sphere_fit_selected", quality=sphere_result.quality)
                return sphere_result

        return median_result

    def _estimate_median(self, arr: np.ndarray) -> HardIronResult:
        """Robust median-based offset estimation."""
        offset_x = float(np.median(arr[:, 0]))
        offset_y = float(np.median(arr[:, 1]))
        offset_z = float(np.median(arr[:, 2]))

        # Quality: based on spread — lower spread = higher quality
        spread = np.std(arr, axis=0)
        max_spread = float(np.max(spread))
        quality = max(0.0, min(1.0, 1.0 - (max_spread / 200.0)))

        logger.info(
            "hard_iron_median_estimate",
            offset=[offset_x, offset_y, offset_z],
            quality=quality,
            samples=len(arr),
        )
        return HardIronResult(
            offset_x=offset_x,
            offset_y=offset_y,
            offset_z=offset_z,
            quality=quality,
            method="median",
            sample_count=len(arr),
        )

    def _estimate_sphere_fit(self, arr: np.ndarray) -> HardIronResult | None:
        """
        Sphere fitting for hard-iron calibration.

        Fits a sphere to the magnetometer data points.
        The center of the sphere represents the hard-iron offset.
        """
        try:
            x0 = np.median(arr, axis=0)
            r0 = float(np.median(np.linalg.norm(arr - x0, axis=1)))

            def residuals(params: np.ndarray) -> np.ndarray:
                cx, cy, cz, r = params
                center = np.array([cx, cy, cz])
                distances = np.linalg.norm(arr - center, axis=1)
                return distances - r

            result = least_squares(
                residuals,
                x0=[x0[0], x0[1], x0[2], r0],
                method="lm",
                max_nfev=1000,
            )

            if not result.success:
                logger.warning("sphere_fit_failed", message=result.message)
                return None

            cx, cy, cz, r = result.x
            residual_std = float(np.std(result.fun))
            quality = max(0.0, min(1.0, 1.0 - (residual_std / r) * 5.0))

            logger.info(
                "hard_iron_sphere_fit",
                center=[cx, cy, cz],
                radius=r,
                residual_std=residual_std,
                quality=quality,
            )
            return HardIronResult(
                offset_x=float(cx),
                offset_y=float(cy),
                offset_z=float(cz),
                quality=quality,
                method="sphere_fit",
                sample_count=len(arr),
            )
        except Exception as e:
            logger.warning("sphere_fit_exception", error=str(e))
            return None

    def reset(self) -> None:
        """Clear all calibration samples."""
        self._samples.clear()
