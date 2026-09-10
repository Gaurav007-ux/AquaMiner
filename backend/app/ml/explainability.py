"""
AquaYantra — ML prediction explainability.

Generates human-readable explanations for anomaly detections.
Never exposes fake explanations — only reports what the model actually computed.
"""

from __future__ import annotations

from typing import Any

from app.ml.base import AnomalyResult


class ExplainabilityEngine:
    """
    Generates human-readable explanations for anomaly predictions.

    Uses feature contributions from the model and contextual factors
    to produce understandable reasons.
    """

    # Feature → human-readable description mapping
    FEATURE_DESCRIPTIONS: dict[str, str] = {
        "baseline_deviation": "Magnetic deviation from local baseline",
        "absolute_deviation": "Absolute magnetic field deviation",
        "magnitude": "Magnetic field magnitude",
        "signal_to_noise": "Signal-to-noise ratio",
        "rolling_std": "Magnetic field variability",
        "rolling_mad": "Robust variability measure",
        "rate_of_change": "Rate of magnetic field change",
        "gradient": "Magnetic gradient strength",
        "peak_amplitude": "Local peak signal amplitude",
        "moving_variance": "Signal variance in window",
        "depth": "Measurement depth",
        "turbidity": "Water turbidity level",
        "data_quality": "Sensor data quality",
        "battery_voltage": "Device battery state",
        "calibrated_x": "Calibrated X-axis field",
        "calibrated_y": "Calibrated Y-axis field",
        "calibrated_z": "Calibrated Z-axis field",
    }

    def explain(
        self,
        result: AnomalyResult,
        confidence: float = 0.0,
        calibration_quality: float = 0.0,
        persistence_samples: int = 0,
        data_quality: float = 1.0,
    ) -> dict[str, Any]:
        """
        Generate a full explanation for a prediction.

        Returns a dict with prediction label, scores, and human-readable reasons.
        """
        prediction_label = self._get_prediction_label(result.anomaly_score, confidence)
        reasons = self._generate_reasons(
            result, confidence, calibration_quality, persistence_samples, data_quality
        )

        return {
            "prediction": prediction_label,
            "anomaly_score": round(result.anomaly_score, 4),
            "confidence": round(confidence, 4),
            "reasons": reasons,
            "top_features": self._get_top_features(result.feature_contributions),
            "model_type": result.model_type,
        }

    def _get_prediction_label(self, anomaly_score: float, confidence: float) -> str:
        """Map score/confidence to a human-readable prediction label."""
        if anomaly_score < 0.3:
            return "BACKGROUND"
        elif anomaly_score < 0.5:
            return "WATCH"
        elif anomaly_score < 0.7:
            return "ANOMALY_DETECTED"
        elif confidence >= 0.7:
            return "POTENTIAL_TARGET"
        else:
            return "ANOMALY_DETECTED"

    def _generate_reasons(
        self,
        result: AnomalyResult,
        confidence: float,
        calibration_quality: float,
        persistence_samples: int,
        data_quality: float,
    ) -> list[str]:
        """Generate human-readable reasons for the detection."""
        reasons: list[str] = []

        if not result.is_anomaly:
            reasons.append("Signal within expected background range")
            return reasons

        # Feature-based reasons
        top_features = self._get_top_features(result.feature_contributions, n=3)
        for feat_name, contribution in top_features:
            desc = self.FEATURE_DESCRIPTIONS.get(feat_name, feat_name)
            if contribution > 0:
                reasons.append(f"{desc} significantly exceeds expected range")

        # Persistence
        if persistence_samples >= 3:
            reasons.append(f"Anomaly persisted across {persistence_samples} consecutive samples")
        elif persistence_samples >= 1:
            reasons.append("Anomaly detected in recent samples")

        # Calibration context
        if calibration_quality >= 0.7:
            reasons.append("Sensor calibration quality is high")
        elif calibration_quality < 0.3:
            reasons.append("Caution: calibration quality is low — detection may be less reliable")

        # Data quality
        if data_quality < 0.5:
            reasons.append("Warning: data quality is degraded — interpret with caution")

        return reasons if reasons else ["Anomaly detected based on model scoring"]

    def _get_top_features(
        self,
        contributions: dict[str, float],
        n: int = 5,
    ) -> list[tuple[str, float]]:
        """Return the top-N most contributing features."""
        if not contributions:
            return []
        sorted_feats = sorted(
            contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True,
        )
        return sorted_feats[:n]
