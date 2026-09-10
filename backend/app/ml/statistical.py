"""
AquaYantra — Statistical anomaly model.

Robust statistical detector using MAD, Z-score, and percentile methods.
Serves as a reliable baseline detector and complement to the ML model.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.base import AnomalyResult, BaseAnomalyModel
from app.processing.features import FEATURE_NAMES

logger = get_logger("ml.statistical")


class StatisticalAnomalyModel(BaseAnomalyModel):
    """
    Multi-method statistical anomaly detector.

    Combines Z-score, MAD-based, and percentile-based detection
    into an ensemble anomaly score.
    """

    model_type = "statistical"

    def __init__(self, z_threshold: float = 3.0, mad_threshold: float = 3.5) -> None:
        self._z_threshold = z_threshold
        self._mad_threshold = mad_threshold
        self._means: np.ndarray | None = None
        self._stds: np.ndarray | None = None
        self._medians: np.ndarray | None = None
        self._mads: np.ndarray | None = None
        self._p05: np.ndarray | None = None
        self._p95: np.ndarray | None = None
        self._is_fitted = False
        self._n_samples = 0

    def fit(self, features: np.ndarray) -> dict[str, Any]:
        """Compute background statistics from training data."""
        self._means = np.mean(features, axis=0)
        self._stds = np.std(features, axis=0)
        self._medians = np.median(features, axis=0)
        self._mads = np.median(np.abs(features - self._medians), axis=0)
        self._p05 = np.percentile(features, 5, axis=0)
        self._p95 = np.percentile(features, 95, axis=0)
        self._is_fitted = True
        self._n_samples = features.shape[0]

        metrics = {
            "n_samples": int(features.shape[0]),
            "n_features": int(features.shape[1]),
            "method": "statistical_ensemble",
        }
        logger.info("statistical_model_fitted", **metrics)
        return metrics

    def predict(self, features: np.ndarray) -> AnomalyResult:
        """Score a single sample using statistical methods."""
        if not self._is_fitted:
            return AnomalyResult(model_type=self.model_type, model_version=self.version)

        sample = features.flatten()

        # Z-score based
        z_scores = np.zeros_like(sample)
        mask = self._stds > 1e-10
        z_scores[mask] = np.abs(sample[mask] - self._means[mask]) / self._stds[mask]
        z_max = float(np.max(z_scores))
        z_anomaly = min(1.0, z_max / (self._z_threshold * 2))

        # MAD-based
        mad_scores = np.zeros_like(sample)
        robust_stds = self._mads * 1.4826
        mask_mad = robust_stds > 1e-10
        mad_scores[mask_mad] = np.abs(sample[mask_mad] - self._medians[mask_mad]) / robust_stds[mask_mad]
        mad_max = float(np.max(mad_scores))
        mad_anomaly = min(1.0, mad_max / (self._mad_threshold * 2))

        # Percentile-based: fraction of features outside 5-95 range
        below = sample < self._p05
        above = sample > self._p95
        pct_outside = float(np.mean(below | above))
        pct_anomaly = min(1.0, pct_outside * 5.0)

        # Ensemble: weighted average
        anomaly_score = 0.4 * z_anomaly + 0.4 * mad_anomaly + 0.2 * pct_anomaly
        anomaly_score = float(np.clip(anomaly_score, 0.0, 1.0))

        # Feature contributions
        contributions: dict[str, float] = {}
        for i, name in enumerate(FEATURE_NAMES[:len(sample)]):
            contributions[name] = round(float(mad_scores[i]) if i < len(mad_scores) else 0.0, 4)

        return AnomalyResult(
            anomaly_score=anomaly_score,
            is_anomaly=anomaly_score >= settings.ANOMALY_THRESHOLD,
            feature_contributions=contributions,
            model_type=self.model_type,
            model_version=self.version,
            raw_score=anomaly_score,
        )

    def predict_batch(self, features: np.ndarray) -> list[AnomalyResult]:
        return [self.predict(features[i]) for i in range(features.shape[0])]

    def save(self, path: str) -> None:
        import joblib
        joblib.dump({
            "means": self._means,
            "stds": self._stds,
            "medians": self._medians,
            "mads": self._mads,
            "p05": self._p05,
            "p95": self._p95,
            "params": self.get_params(),
            "n_samples": self._n_samples,
        }, path)

    def load(self, path: str) -> None:
        import joblib
        data = joblib.load(path)
        self._means = data["means"]
        self._stds = data["stds"]
        self._medians = data["medians"]
        self._mads = data["mads"]
        self._p05 = data["p05"]
        self._p95 = data["p95"]
        self._n_samples = data.get("n_samples", 0)
        self._is_fitted = True

    def get_params(self) -> dict[str, Any]:
        return {
            "z_threshold": self._z_threshold,
            "mad_threshold": self._mad_threshold,
        }

    @property
    def is_fitted(self) -> bool:
        return self._is_fitted
