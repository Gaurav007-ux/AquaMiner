"""
AquaYantra — Feature engineering for ML pipeline.

Builds versioned feature vectors from calibrated sensor data.
Separates raw values from derived features — never feeds unvalidated data to ML.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.processing.magnetic import MagneticReading


FEATURE_SCHEMA_VERSION = "1.0"

# Ordered feature names for consistent vector construction
FEATURE_NAMES: list[str] = [
    "calibrated_x",
    "calibrated_y",
    "calibrated_z",
    "magnitude",
    "baseline_deviation",
    "absolute_deviation",
    "rolling_mean",
    "rolling_std",
    "rolling_mad",
    "peak_amplitude",
    "rate_of_change",
    "gradient",
    "signal_to_noise",
    "moving_variance",
    "depth",
    "turbidity",
    "battery_voltage",
    "data_quality",
]


@dataclass
class FeatureVector:
    """Typed feature vector with metadata."""
    values: dict[str, float] = field(default_factory=dict)
    schema_version: str = FEATURE_SCHEMA_VERSION
    valid: bool = True
    missing_features: list[str] = field(default_factory=list)

    def to_array(self) -> list[float]:
        """Return features as an ordered list matching FEATURE_NAMES."""
        result = []
        for name in FEATURE_NAMES:
            val = self.values.get(name, 0.0)
            result.append(val)
        return result

    def to_dict(self) -> dict[str, Any]:
        return {
            "values": self.values,
            "schema_version": self.schema_version,
            "valid": self.valid,
        }


class FeatureEngineer:
    """
    Constructs ML feature vectors from processed sensor data.

    Uses only calibrated/derived values — never raw sensor data.
    """

    def build(
        self,
        mag: MagneticReading,
        depth: float | None = None,
        turbidity: float | None = None,
        battery_voltage: float | None = None,
        data_quality: float = 1.0,
    ) -> FeatureVector:
        """
        Build a feature vector from a processed magnetic reading
        and environmental context.
        """
        fv = FeatureVector()

        # Magnetic features
        fv.values["calibrated_x"] = mag.calibrated_x
        fv.values["calibrated_y"] = mag.calibrated_y
        fv.values["calibrated_z"] = mag.calibrated_z
        fv.values["magnitude"] = mag.magnitude
        fv.values["baseline_deviation"] = mag.deviation
        fv.values["absolute_deviation"] = mag.absolute_deviation
        fv.values["rolling_mean"] = mag.rolling_mean
        fv.values["rolling_std"] = mag.rolling_std
        fv.values["rolling_mad"] = mag.rolling_mad
        fv.values["peak_amplitude"] = mag.local_peak_strength
        fv.values["rate_of_change"] = mag.rate_of_change
        fv.values["gradient"] = mag.gradient
        fv.values["signal_to_noise"] = mag.signal_to_noise
        fv.values["moving_variance"] = mag.moving_variance

        # Environmental / context features
        fv.values["depth"] = depth if depth is not None else 0.0
        fv.values["turbidity"] = turbidity if turbidity is not None else 0.0
        fv.values["battery_voltage"] = battery_voltage if battery_voltage is not None else 12.0
        fv.values["data_quality"] = data_quality

        # Validate completeness
        for name in FEATURE_NAMES:
            if name not in fv.values:
                fv.missing_features.append(name)
                fv.values[name] = 0.0

        fv.valid = len(fv.missing_features) == 0
        return fv

    @staticmethod
    def get_schema() -> dict[str, Any]:
        """Return the current feature schema definition."""
        return {
            "version": FEATURE_SCHEMA_VERSION,
            "features": FEATURE_NAMES,
            "count": len(FEATURE_NAMES),
        }
