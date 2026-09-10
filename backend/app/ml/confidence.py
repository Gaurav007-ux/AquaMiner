"""
AquaYantra — Confidence scoring engine.

Confidence ≠ anomaly score.
anomaly_score = "how unusual is the signal?"
confidence = "how trustworthy is this detection?"
"""

from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("ml.confidence")


class ConfidenceEngine:
    """
    Multi-factor confidence scorer.

    Combines sensor quality, signal strength, model agreement,
    temporal persistence, calibration quality, and environmental
    consistency into a single confidence value.
    """

    def __init__(
        self,
        sensor_weight: float | None = None,
        signal_weight: float | None = None,
        model_weight: float | None = None,
        persistence_weight: float | None = None,
        calibration_weight: float | None = None,
        environment_weight: float | None = None,
    ) -> None:
        self.w_sensor = sensor_weight or settings.CONFIDENCE_SENSOR_WEIGHT
        self.w_signal = signal_weight or settings.CONFIDENCE_SIGNAL_WEIGHT
        self.w_model = model_weight or settings.CONFIDENCE_MODEL_WEIGHT
        self.w_persistence = persistence_weight or settings.CONFIDENCE_PERSISTENCE_WEIGHT
        self.w_calibration = calibration_weight or settings.CONFIDENCE_CALIBRATION_WEIGHT
        self.w_environment = environment_weight or settings.CONFIDENCE_ENVIRONMENT_WEIGHT

    def compute(
        self,
        sensor_quality: float = 1.0,
        signal_strength: float = 0.0,
        model_score: float = 0.0,
        persistence: float = 0.0,
        calibration_quality: float = 0.5,
        environmental_consistency: float = 1.0,
    ) -> float:
        """
        Compute confidence score.

        Parameters
        ----------
        sensor_quality : 0–1, from the data quality engine.
        signal_strength : 0–1, how strong the magnetic deviation is.
        model_score : 0–1, the ML model's anomaly score.
        persistence : 0–1, temporal persistence (how many consecutive anomaly samples).
        calibration_quality : 0–1, from calibration engine.
        environmental_consistency : 0–1, consistency of environmental readings.

        Returns
        -------
        Confidence score between 0 and 1.
        """
        confidence = (
            self.w_sensor * sensor_quality
            + self.w_signal * signal_strength
            + self.w_model * model_score
            + self.w_persistence * persistence
            + self.w_calibration * calibration_quality
            + self.w_environment * environmental_consistency
        )

        # Normalize to account for weight sum
        total_weight = (
            self.w_sensor + self.w_signal + self.w_model
            + self.w_persistence + self.w_calibration + self.w_environment
        )
        if total_weight > 0:
            confidence /= total_weight

        return max(0.0, min(1.0, confidence))

    def compute_signal_strength(
        self,
        deviation: float,
        noise: float,
    ) -> float:
        """
        Compute signal strength as a 0–1 score from deviation and noise.

        Based on signal-to-noise ratio.
        """
        if noise < 1e-6:
            return 0.0 if abs(deviation) < 1e-6 else 1.0
        snr = abs(deviation) / noise
        # Map SNR to 0–1: SNR of 5+ → ~1.0
        return min(1.0, snr / 5.0)

    def compute_persistence_score(
        self,
        consecutive_anomaly_samples: int,
        min_persistence: int | None = None,
    ) -> float:
        """
        Compute temporal persistence score.

        More consecutive anomaly samples → higher persistence → higher confidence.
        """
        min_p = min_persistence or settings.ANOMALY_MIN_PERSISTENCE_SAMPLES
        if consecutive_anomaly_samples <= 0:
            return 0.0
        # Ramp from 0 to 1 over 2× minimum persistence
        return min(1.0, consecutive_anomaly_samples / (min_p * 2.0))
