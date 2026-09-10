"""
AquaYantra — Isolation Forest anomaly model.

Primary unsupervised anomaly detector. Wraps scikit-learn IsolationForest
with feature contribution analysis for explainability.
"""

from __future__ import annotations

import hashlib
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.base import AnomalyResult, BaseAnomalyModel
from app.processing.features import FEATURE_NAMES

logger = get_logger("ml.isolation_forest")


class IsolationForestModel(BaseAnomalyModel):
    """
    Isolation Forest anomaly detector.

    Trained on background data; anomalies are points that are easy to
    isolate (short average path length in random trees).

    Feature contributions are estimated via per-feature score
    comparison for explainability.
    """

    model_type = "isolation_forest"

    def __init__(
        self,
        n_estimators: int | None = None,
        contamination: float | None = None,
        random_state: int = 42,
    ) -> None:
        self._n_estimators = n_estimators or settings.ML_ISOLATION_FOREST_N_ESTIMATORS
        self._contamination = contamination or settings.ML_ISOLATION_FOREST_CONTAMINATION
        self._random_state = random_state

        self._model: IsolationForest | None = None
        self._scaler: StandardScaler = StandardScaler()
        self._is_fitted = False
        self._training_stats: dict[str, Any] = {}
        self._feature_means: np.ndarray | None = None
        self._feature_stds: np.ndarray | None = None

    def fit(self, features: np.ndarray) -> dict[str, Any]:
        """
        Train on background/non-anomaly feature matrix.

        Parameters
        ----------
        features : (n_samples, n_features) array of background data.

        Returns
        -------
        Training metrics dict.
        """
        if features.shape[0] < settings.ML_MIN_TRAINING_SAMPLES:
            raise ValueError(
                f"Need at least {settings.ML_MIN_TRAINING_SAMPLES} samples, "
                f"got {features.shape[0]}"
            )

        # Fit scaler on training data
        self._scaler.fit(features)
        scaled = self._scaler.transform(features)

        self._feature_means = np.mean(features, axis=0)
        self._feature_stds = np.std(features, axis=0)

        self._model = IsolationForest(
            n_estimators=self._n_estimators,
            contamination=self._contamination,
            random_state=self._random_state,
            n_jobs=-1,
        )
        self._model.fit(scaled)
        self._is_fitted = True

        # Compute training metrics
        train_scores = self._model.decision_function(scaled)
        self._training_stats = {
            "n_samples": int(features.shape[0]),
            "n_features": int(features.shape[1]),
            "score_mean": float(np.mean(train_scores)),
            "score_std": float(np.std(train_scores)),
            "score_min": float(np.min(train_scores)),
            "score_max": float(np.max(train_scores)),
            "anomaly_rate": float(np.mean(self._model.predict(scaled) == -1)),
        }

        logger.info("isolation_forest_trained", **self._training_stats)
        return self._training_stats

    def predict(self, features: np.ndarray) -> AnomalyResult:
        """
        Score a single sample.

        The raw IsolationForest score is converted to a 0–1 anomaly score where
        higher = more anomalous.
        """
        if not self._is_fitted or self._model is None:
            return AnomalyResult(model_type=self.model_type, model_version=self.version)

        sample = features.reshape(1, -1) if features.ndim == 1 else features[:1]
        scaled = self._scaler.transform(sample)

        # decision_function: higher = more normal, lower = more anomalous
        raw_score = float(self._model.decision_function(scaled)[0])

        # Convert to 0–1 anomaly score (invert and normalize)
        # Typical decision_function range is roughly [-0.5, 0.5]
        anomaly_score = self._normalize_score(raw_score)

        # Feature contributions
        contributions = self._compute_feature_contributions(scaled[0])

        threshold = settings.ANOMALY_THRESHOLD
        return AnomalyResult(
            anomaly_score=anomaly_score,
            is_anomaly=anomaly_score >= threshold,
            feature_contributions=contributions,
            model_type=self.model_type,
            model_version=self.version,
            raw_score=raw_score,
        )

    def predict_batch(self, features: np.ndarray) -> list[AnomalyResult]:
        """Score a batch of samples."""
        if not self._is_fitted or self._model is None:
            return [AnomalyResult(model_type=self.model_type) for _ in range(len(features))]

        scaled = self._scaler.transform(features)
        raw_scores = self._model.decision_function(scaled)

        results = []
        for i, raw in enumerate(raw_scores):
            score = self._normalize_score(float(raw))
            results.append(AnomalyResult(
                anomaly_score=score,
                is_anomaly=score >= settings.ANOMALY_THRESHOLD,
                feature_contributions=self._compute_feature_contributions(scaled[i]),
                model_type=self.model_type,
                model_version=self.version,
                raw_score=float(raw),
            ))
        return results

    def _normalize_score(self, raw_score: float) -> float:
        """
        Normalize IsolationForest decision_function score to [0, 1].

        decision_function returns the anomaly score of the input samples.
        The lower, the more abnormal.
        """
        mean = self._training_stats.get("score_mean", 0.0)
        std = self._training_stats.get("score_std", 1.0)
        if std < 1e-10:
            std = 1.0

        # Z-score then sigmoid-like mapping
        z = (mean - raw_score) / std
        # Clamp and scale to [0, 1]
        normalized = 1.0 / (1.0 + np.exp(-z))
        return float(np.clip(normalized, 0.0, 1.0))

    def _compute_feature_contributions(self, scaled_sample: np.ndarray) -> dict[str, float]:
        """
        Estimate per-feature contribution to the anomaly score.

        Uses a perturbation-based approach: score with each feature
        replaced by its mean, then measure the score change.
        """
        if self._model is None:
            return {}

        base_score = float(self._model.decision_function(scaled_sample.reshape(1, -1))[0])
        contributions: dict[str, float] = {}

        for i, name in enumerate(FEATURE_NAMES[:scaled_sample.shape[0]]):
            perturbed = scaled_sample.copy()
            perturbed[i] = 0.0  # Mean of scaled data is 0
            perturbed_score = float(self._model.decision_function(perturbed.reshape(1, -1))[0])
            # Positive contribution = this feature makes it more anomalous
            contributions[name] = round(base_score - perturbed_score, 4)

        return contributions

    def save(self, path: str) -> None:
        """Save model and scaler to disk."""
        if not self._is_fitted:
            raise RuntimeError("Cannot save unfitted model")
        data = {
            "model": self._model,
            "scaler": self._scaler,
            "training_stats": self._training_stats,
            "feature_means": self._feature_means,
            "feature_stds": self._feature_stds,
            "params": self.get_params(),
        }
        joblib.dump(data, path)
        logger.info("model_saved", path=path)

    def load(self, path: str) -> None:
        """Load model and scaler from disk."""
        data = joblib.load(path)
        self._model = data["model"]
        self._scaler = data["scaler"]
        self._training_stats = data["training_stats"]
        self._feature_means = data.get("feature_means")
        self._feature_stds = data.get("feature_stds")
        self._is_fitted = True
        logger.info("model_loaded", path=path)

    def get_params(self) -> dict[str, Any]:
        return {
            "n_estimators": self._n_estimators,
            "contamination": self._contamination,
            "random_state": self._random_state,
        }

    def compute_hash(self) -> str:
        """Compute a hash of the model for versioning."""
        if self._model is None:
            return ""
        import pickle
        model_bytes = pickle.dumps(self._model)
        return hashlib.sha256(model_bytes).hexdigest()[:16]

    @property
    def is_fitted(self) -> bool:
        return self._is_fitted
