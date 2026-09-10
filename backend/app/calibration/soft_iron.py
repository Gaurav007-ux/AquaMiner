"""
AquaYantra — Soft-iron calibration.

Provides the 3x3 correction matrix framework.
B_corrected = M × (B_raw - offset)

Falls back to identity matrix when insufficient calibration data exists,
marking confidence as low.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.core.logging import get_logger

logger = get_logger("calibration.soft_iron")

# Identity matrix — no correction
IDENTITY_MATRIX = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]


@dataclass
class SoftIronResult:
    """Result of soft-iron calibration."""
    matrix: list[list[float]] = field(default_factory=lambda: [row[:] for row in IDENTITY_MATRIX])
    quality: float = 0.0
    method: str = "identity"
    is_identity: bool = True
    sample_count: int = 0


class SoftIronCalibrator:
    """
    Soft-iron / axis-alignment correction estimator.

    When sufficient spatially-distributed data exists, estimates a 3x3
    correction matrix via ellipsoid fitting. Otherwise, returns identity
    with low confidence.
    """

    ELLIPSOID_FIT_MIN_SAMPLES = 500

    def __init__(self) -> None:
        self._samples: list[tuple[float, float, float]] = []

    def add_sample(self, x: float, y: float, z: float) -> None:
        self._samples.append((x, y, z))

    def add_samples(self, samples: list[tuple[float, float, float]]) -> None:
        self._samples.extend(samples)

    @property
    def sample_count(self) -> int:
        return len(self._samples)

    def estimate(self, hard_iron_offset: tuple[float, float, float] = (0.0, 0.0, 0.0)) -> SoftIronResult:
        """
        Estimate soft-iron correction matrix.

        If insufficient data, returns identity matrix with low quality.
        """
        if len(self._samples) < self.ELLIPSOID_FIT_MIN_SAMPLES:
            logger.info(
                "soft_iron_insufficient_data",
                samples=len(self._samples),
                required=self.ELLIPSOID_FIT_MIN_SAMPLES,
            )
            return SoftIronResult(
                method="identity_insufficient_data",
                sample_count=len(self._samples),
            )

        # Attempt ellipsoid fit
        return self._estimate_ellipsoid(hard_iron_offset)

    def _estimate_ellipsoid(self, offset: tuple[float, float, float]) -> SoftIronResult:
        """
        Ellipsoid fitting for soft-iron correction.

        Centers data around hard-iron offset, fits ellipsoid,
        and derives the correction matrix to map ellipsoid → sphere.
        """
        try:
            arr = np.array(self._samples) - np.array(offset)

            # Covariance-based approach
            cov = np.cov(arr.T)
            eigenvalues, eigenvectors = np.linalg.eigh(cov)

            # Prevent division by zero
            eigenvalues = np.maximum(eigenvalues, 1e-10)

            # Correction scales: normalize to mean radius
            mean_scale = np.mean(np.sqrt(eigenvalues))
            scale_factors = mean_scale / np.sqrt(eigenvalues)

            # Build correction matrix: rotate, scale, rotate back
            scale_matrix = np.diag(scale_factors)
            correction = eigenvectors @ scale_matrix @ eigenvectors.T

            # Quality metric: how spherical the data is (ratio of eigenvalues)
            eig_ratio = float(np.min(eigenvalues) / np.max(eigenvalues))
            quality = eig_ratio  # 1.0 = perfect sphere (no correction needed)

            matrix = correction.tolist()

            logger.info(
                "soft_iron_ellipsoid_fit",
                eigenvalue_ratio=eig_ratio,
                quality=quality,
                samples=len(self._samples),
            )

            return SoftIronResult(
                matrix=matrix,
                quality=quality,
                method="ellipsoid_fit",
                is_identity=False,
                sample_count=len(self._samples),
            )
        except Exception as e:
            logger.warning("soft_iron_fit_failed", error=str(e))
            return SoftIronResult(
                method="identity_fit_failed",
                sample_count=len(self._samples),
            )

    def reset(self) -> None:
        self._samples.clear()


def apply_calibration(
    raw_x: float,
    raw_y: float,
    raw_z: float,
    offset_x: float = 0.0,
    offset_y: float = 0.0,
    offset_z: float = 0.0,
    matrix: list[list[float]] | None = None,
) -> tuple[float, float, float]:
    """
    Apply full calibration: B_corrected = M × (B_raw - offset).

    Parameters
    ----------
    raw_x, raw_y, raw_z : Raw magnetometer readings (µT).
    offset_x, offset_y, offset_z : Hard-iron offsets.
    matrix : 3×3 soft-iron/alignment correction matrix. Identity if None.

    Returns
    -------
    Tuple of (corrected_x, corrected_y, corrected_z).
    """
    v = np.array([raw_x - offset_x, raw_y - offset_y, raw_z - offset_z])

    if matrix is not None:
        m = np.array(matrix)
        v = m @ v

    return float(v[0]), float(v[1]), float(v[2])
